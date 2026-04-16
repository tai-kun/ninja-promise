import { isPromiseLike } from "@tai-kun/is-promise-like";

/**
 * NinjaPromise の基本型です。
 *
 * @template T 非同期処理の結果として返される値の型です。
 */
interface BaseNinjaPromise<T> {
  /**
   * Promise が解決または拒否された際のコールバックを登録します。
   *
   * @template TResult1 解決時コールバックの戻り値の型です。
   * @template TResult2 拒否時コールバックの戻り値の型です。
   * @param onfulfilled 解決時に実行されるコールバックです。
   * @param onrejected 拒否時に実行されるコールバックです。
   * @returns 新しい NinjaPromise インスタンスです。
   */
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): NinjaPromise<TResult1 | TResult2>;
}

/**
 * 待機状態（pending）にある NinjaPromise を表すインターフェースです。
 *
 * @template T 非同期処理の結果として返される値の型です。
 */
export interface PendingNinjaPromise<T> extends BaseNinjaPromise<T> {
  /**
   * 現在の状態を示します。
   */
  status: "pending";
}

/**
 * 完了状態（fulfilled）にある NinjaPromise を表すインターフェースです。
 *
 * @template T 非同期処理の結果として返される値の型です。
 */
export interface FulfilledNinjaPromise<T> extends BaseNinjaPromise<T> {
  /**
   * 現在の状態を示します。
   */
  status: "fulfilled";

  /**
   * 解決された値です。
   */
  value: T;
}

/**
 * 拒否状態（rejected）にある NinjaPromise を表すインターフェースです。
 *
 * @template T 非同期処理の結果として期待されていた値の型です。
 */
export interface RejectedNinjaPromise<T = never> extends BaseNinjaPromise<T> {
  /**
   * 現在の状態を示します。
   */
  status: "rejected";

  /**
   * 拒否された理由（エラー内容）です。
   */
  reason: unknown;
}

/**
 * NinjaPromise は、すでに解決または拒否された状態であっても、続く解決や拒否の指示を静かに無視します。
 *
 * 内部状態を外部から同期的に参照できます。
 *
 * PromiseLike を実装します。
 *
 * @template T 非同期処理の結果として返される値の型です。
 */
// 最後にクラスの実装と一緒に export します。
type NinjaPromise<T> = PendingNinjaPromise<T> | FulfilledNinjaPromise<T> | RejectedNinjaPromise<T>;

/**
 * 外部から解決または拒否が可能な NinjaPromise のリゾルバー群を表すインターフェースです。
 *
 * @template T NinjaPromise が解決された際の値の型です。
 */
export interface NinjaPromiseWithResolvers<T> {
  /**
   * 現在のステータスを持つ NinjaPromise オブジェクトです。
   */
  promise: NinjaPromise<T>;

  /**
   * NinjaPromise を解決（resolve）させる関数です。
   *
   * @param value 解決に用いる値です。
   */
  resolve(value: T | PromiseLike<T>): void;

  /**
   * NinjaPromise を拒否（reject）させる関数です。
   *
   * @param reason 拒否の理由です。
   */
  reject(reason?: unknown): void;
}

/**
 * NinjaPromise が取り得る状態のユニオン型です。
 */
type NinjaPromiseState = "pending" | "fulfilled" | "rejected";

/**
 * then メソッドで登録されるコールバックと、それに関連する解決・拒否関数を保持する型です。
 *
 * @template T 元の Promise が解決された際の値の型です。
 * @template TResult コールバックの実行結果として返される値の型です。
 */
type PromiseCallback<T, TResult> = {
  /**
   * 後続の Promise を拒否するための関数です。
   */
  readonly reject: (reason?: unknown) => void;

  /**
   * 後続の Promise を解決するための関数です。
   */
  readonly resolve: (value: TResult) => void;

  /**
   * 拒否時に実行されるユーザー定義のコールバックです。
   */
  readonly onRejected: ((reason: unknown) => TResult | PromiseLike<TResult>) | null | undefined;

  /**
   * 解決時に実行されるユーザー定義のコールバックです。
   */
  readonly onFulfilled: ((value: T) => TResult | PromiseLike<TResult>) | null | undefined;
};

/**
 * 動的に解決された値や拒否理由を保持するためのベースクラスを作成する定数です。
 */
const Options = class {} as {
  new <T>(): {
    /**
     * 解決された値です。
     */
    value?: T;

    /**
     * 拒否された理由（エラー内容）です。
     */
    reason?: unknown;
  };
};

const NinjaPromise = class NinjaPromise<T> extends Options<T> implements PromiseLike<T> {
  /**
   * 指定された関数を実行し、その結果を NinjaPromise として返します。
   *
   * 関数が同期的に例外を投げた場合、拒否状態の NinjaPromise を返します。
   *
   * @template T 関数の戻り値の型です。
   * @param callbackFn 実行するコールバック関数です。
   * @returns 実行結果をラップした NinjaPromise です。
   */
  public static try<T>(callbackFn: () => T | PromiseLike<T>): NinjaPromise<Awaited<T>> {
    let value;
    try {
      value = callbackFn();
      if (!isPromiseLike(value)) {
        return this.resolve(value) as NinjaPromise<Awaited<T>>;
      }
    } catch (ex) {
      return this.reject<T>(ex) as NinjaPromise<Awaited<T>>;
    }

    // oxlint-disable-next-line typescript/unbound-method
    const { reject, resolve, promise } = this.withResolvers<Awaited<T>>();
    (async () => resolve(await value))().catch(reject);

    return promise as NinjaPromise<Awaited<T>>;
  }

  /**
   * 既に拒否状態となっている NinjaPromise インスタンスを作成します。
   *
   * @template T NinjaPromise が期待していた値の型です。
   * @param reason 拒否の理由です。
   * @returns 拒否状態の NinjaPromise です。
   */
  public static reject<T = never>(reason?: unknown): RejectedNinjaPromise<T> {
    const promise = new this<T>(() => {});
    promise.#reject(reason);

    return promise as RejectedNinjaPromise<T>;
  }

  /**
   * 既に解決状態となっている NinjaPromise インスタンスを作成します。
   *
   * @returns 解決状態の NinjaPromise です。
   */
  public static resolve(): FulfilledNinjaPromise<undefined>;

  /**
   * 既に解決状態となっている NinjaPromise インスタンスを作成します。
   *
   * @template T 解決される値の型です。
   * @param value 解決に用いる値です。
   * @returns 解決状態の NinjaPromise です。
   */
  public static resolve<T>(value: T): FulfilledNinjaPromise<Awaited<T>>;

  public static resolve(value?: unknown): FulfilledNinjaPromise<unknown> {
    const promise = new this<unknown>(() => {});
    promise.#resolve(value);

    return promise as FulfilledNinjaPromise<unknown>;
  }

  /**
   * NinjaPromise と、それを外部から制御するためのリゾルバー（resolve/reject）を作成します。
   *
   * @template T NinjaPromise が解決された際の値の型です。
   * @returns NinjaPromise とリゾルバーを含むオブジェクトです。
   */
  public static withResolvers<T>(): NinjaPromiseWithResolvers<T> {
    const promise = new this<T>(() => {});

    return {
      reject(reason) {
        promise.#reject(reason);
      },
      resolve(value) {
        promise.#resolve(value);
      },
      // @ts-expect-error
      promise,
    };
  }

  /**
   * 現在の NinjaPromise の状態です。
   */
  #status: NinjaPromiseState = "pending";

  /**
   * 解決または拒否を待機しているコールバックのキューです。
   */
  readonly #queue: PromiseCallback<T, any>[] = [];

  /**
   * NinjaPromise の新しいインスタンスを作成します。
   *
   * @param executor resolve および reject 関数を引数として受け取る関数です。この関数はコンストラクター内で即座に実行されます。
   */
  constructor(
    executor: (
      resolve: (value: T | PromiseLike<T>) => void,
      reject: (reason?: any) => void,
    ) => void,
  ) {
    super();

    try {
      // 標準の Promise 同様、executor を即座に同期実行します。
      // 内部のプライベートメソッドをバインドして渡します。
      executor(
        (value) => this.#resolve(value),
        (reason) => this.#reject(reason),
      );
    } catch (ex) {
      // executor 内で同期的にエラーが投げられた場合は reject します。
      this.#reject(ex);
    }
  }

  /**
   * 内部的に NinjaPromise を拒否状態に遷移させます。
   *
   * @param reason 拒否の理由です。
   */
  #reject(reason?: unknown): void {
    // すでに解決/拒否された状態であっても、エラーを投げることなく静かに無視します。
    if (this.#status !== "pending") {
      return;
    }

    this.#status = "rejected";
    this.reason = reason;
    this.#processQueue();
  }

  /**
   * 内部的に Promise を解決状態に遷移させます。
   *
   * 引数が PromiseLike の場合は、その状態を継承します。
   *
   * @param value 解決に用いる値、または PromiseLike オブジェクトです。
   */
  #resolve(value: T | PromiseLike<T>): void {
    // すでに解決/拒否された状態であっても、エラーを投げることなく静かに無視します。
    if (this.#status !== "pending") {
      return;
    }

    // 自身を解決しようとすると無限再帰に陥り、スタックオーバーフローやハングを引き起こすため、検証します。
    if (value === this) {
      this.#reject(new TypeError("Chaining cycle detected for NinjaPromise"));
      return;
    }

    if (!isPromiseLike(value)) {
      // 値による解決を行います。
      this.#status = "fulfilled";
      this.value = value;
      this.#processQueue();
      return;
    }

    // 受け取った値が PromiseLike だった場合、その状態を継承します。
    try {
      // 再帰的に待機します。
      value.then.call(
        value,
        (y: T) => this.#resolve(y),
        (r: unknown) => this.#reject(r),
      );
    } catch (ex) {
      this.#reject(ex);
    }
  }

  /**
   * キューに積まれたコールバックを順次実行します。
   *
   * ステータスが確定していない場合は何もしません。
   */
  #processQueue(): void {
    if (this.#status === "pending") {
      return;
    }

    // Promise の仕様に従い、マイクロタスクに入れて非同期実行を保証します。
    queueMicrotask(() => {
      while (this.#queue.length > 0) {
        const callback = this.#queue.shift();
        if (!callback) {
          continue;
        }

        const { reject, resolve, onRejected, onFulfilled } = callback;
        try {
          if (this.#status === "fulfilled") {
            if (typeof onFulfilled === "function") {
              const result = onFulfilled(this.value!);
              resolve(result);
            } else {
              // コールバックがない場合は値を透過させます。
              resolve(this.value);
            }
          } else if (this.#status === "rejected") {
            if (typeof onRejected === "function") {
              const result = onRejected(this.reason);
              resolve(result); // エラーハンドリング成功時は次の Promise は resolve されます。
            } else {
              // コールバックがない場合はエラーを透過させます。
              reject(this.reason);
            }
          }
        } catch (ex) {
          // コールバック実行中にエラーが発生した場合は、後続の Promise を拒否します。
          reject(ex);
        }
      }
    });
  }

  /**
   * 現在の NinjaPromise の状態です。
   */
  public get status(): NinjaPromiseState {
    return this.#status;
  }

  /**
   * NinjaPromise が解決または拒否された際のコールバックを登録します。
   *
   * @template TResult1 解決時コールバックの戻り値の型です。
   * @template TResult2 拒否時コールバックの戻り値の型です。
   * @param onfulfilled 解決時に実行されるコールバックです。
   * @param onrejected 拒否時に実行されるコールバックです。
   * @returns 新しい NinjaPromise インスタンスです。
   */
  // oxlint-disable-next-line unicorn/no-thenable
  public then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): NinjaPromise<TResult1 | TResult2> {
    // 新しい NinjaPromise を作成してチェーンをつなぎます。
    const Constructor = this.constructor as typeof NinjaPromise;
    const nextPromise = new Constructor<TResult1 | TResult2>(() => {});

    this.#queue.push({
      reject(reason) {
        nextPromise.#reject(reason);
      },
      resolve(value) {
        nextPromise.#resolve(value);
      },
      onRejected: onrejected,
      onFulfilled: onfulfilled,
    });

    // すでに解決/拒否済みかもしれないのでキュー処理を試行します。
    this.#processQueue();

    return nextPromise as NinjaPromise<TResult1 | TResult2>;
  }
};

export default NinjaPromise;
