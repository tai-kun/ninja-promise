import { isThenable } from "maypromise";

/**
 * {@link NinjaPromise} のすべての状態に共通するインターフェースです。
 *
 * @template T 非同期処理の結果として返される値の型です。
 */
interface BaseNinjaPromise<T> {
  /**
   * {@link NinjaPromise} が解決または拒否された際のコールバックを登録します。
   *
   * 標準の {@link Promise.prototype.then} と同じインターフェースを持ち、コールバックはマイクロタスクとして非同期に実行されます。
   *
   * @template TResult1 解決時コールバックの戻り値の型です。
   * @template TResult2 拒否時コールバックの戻り値の型です。
   * @param onfulfilled 解決時に実行されるコールバックです。`null` を渡すと値がそのまま透過されます。
   * @param onrejected 拒否時に実行されるコールバックです。`null` を渡すとエラーがそのまま透過されます。
   * @returns 新しい {@link NinjaPromise} インスタンスです。
   *
   * @example
   * ```ts
   * import NinjaPromise from "ninja-promise";
   *
   * const promise = NinjaPromise.resolve("hello");
   * const next = promise.then(value => value.length);
   * console.log(next.status); // "pending"（マイクロタスクで処理）
   * await next;
   * console.log(next.status === "fulfilled" && next.value); // 5
   * ```
   */
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): NinjaPromise<TResult1 | TResult2>;

  /**
   * {@link NinjaPromise} をネイティブの {@link Promise} に変換します。
   *
   * @returns ネイティブの {@link Promise} オブジェクトです。
   *
   * @example
   * ```ts
   * import NinjaPromise from "ninja-promise";
   *
   * const ninjaPromise = NinjaPromise.resolve("変換");
   * const nativePromise = ninjaPromise.toPromise();
   * console.log(nativePromise instanceof Promise); // true
   * console.log(await nativePromise); // "変換"
   * ```
   */
  toPromise(): Promise<T>;
}

/**
 * 待機状態にある {@link NinjaPromise} を表すインターフェースです。
 *
 * @template T 非同期処理の結果として返される値の型です。
 *
 * @example
 * ```ts
 * import NinjaPromise from "ninja-promise";
 *
 * const { promise } = NinjaPromise.withResolvers<string>();
 *
 * if (promise.status === "pending") {
 *   console.log("まだ解決も拒否もされていません");
 * }
 * ```
 */
export interface PendingNinjaPromise<T> extends BaseNinjaPromise<T> {
  /**
   * 現在の状態です。常に `"pending"` になります。
   */
  status: "pending";
}

/**
 * 完了状態にある {@link NinjaPromise} を表すインターフェースです。
 *
 * @template T 非同期処理の結果として返される値の型です。
 *
 * @example
 * ```ts
 * import NinjaPromise from "ninja-promise";
 *
 * const promise = NinjaPromise.resolve(42);
 *
 * if (promise.status === "fulfilled") {
 *   console.log(promise.value); // 42
 * }
 * ```
 */
export interface FulfilledNinjaPromise<T> extends BaseNinjaPromise<T> {
  /**
   * 現在の状態です。常に `"fulfilled"` になります。
   */
  status: "fulfilled";

  /**
   * 解決された値です。
   */
  value: T;
}

/**
 * 拒否状態にある {@link NinjaPromise} を表すインターフェースです。
 *
 * @template T 非同期処理の結果として期待されていた値の型です。
 *
 * @example
 * ```ts
 * import NinjaPromise from "ninja-promise";
 *
 * const error = new Error("データの取得に失敗しました");
 * const promise = NinjaPromise.reject(error);
 *
 * if (promise.status === "rejected") {
 *   console.error(promise.reason); // Error: "データの取得に失敗しました"
 * }
 * ```
 */
export interface RejectedNinjaPromise<T = never> extends BaseNinjaPromise<T> {
  /**
   * 現在の状態です。常に `"rejected"` になります。
   */
  status: "rejected";

  /**
   * 拒否された理由です。
   */
  reason: unknown;
}

/**
 * {@link NinjaPromise} は、すでに解決または拒否された状態であっても、続く解決や拒否の指示を静かに無視する {@link PromiseLike} なクラスです。
 *
 * {@link PendingNinjaPromise} / {@link FulfilledNinjaPromise} / {@link RejectedNinjaPromise} の3つの状態のうち、現在の状態を `status` プロパティーで同期的に参照できます。
 *
 * @template T 非同期処理の結果として返される値の型です。
 *
 * @example
 * ```ts
 * import NinjaPromise from "ninja-promise";
 *
 * // 同期的に状態を確認
 * const promise = NinjaPromise.resolve("同期的確認");
 * console.log(promise.status); // "fulfilled"
 * console.log(promise.status === "fulfilled" && promise.value); // "同期的確認"
 *
 * // await や then チェーンも利用可能
 * const result = await promise.then(value => value.toUpperCase());
 * console.log(result); // "同期的確認".toUpperCase()
 * ```
 */
// 最後にクラスの実装と一緒に export します。
type NinjaPromise<T> = PendingNinjaPromise<T> | FulfilledNinjaPromise<T> | RejectedNinjaPromise<T>;

/**
 * 外部から解決または拒否が可能な {@link NinjaPromise} のリゾルバー群を表すインターフェースです。
 *
 * {@link NinjaPromiseConstructor.withResolvers | `NinjaPromise.withResolvers()`} の戻り値の型です。
 *
 * @template T {@link NinjaPromise} が解決された際の値の型です。
 *
 * @example
 * ```ts
 * import NinjaPromise from "ninja-promise";
 *
 * const { promise, resolve, reject } = NinjaPromise.withResolvers<string>();
 *
 * // コールバックベースの API を Promise でラップ
 * someAsyncOperation((error, data) => {
 *   if (error) {
 *     reject(error);
 *   } else {
 *     resolve(data);
 *   }
 * });
 *
 * // 同期的に状態を確認可能
 * console.log(promise.status); // "pending"（まだ解決されていない）
 * ```
 */
export interface NinjaPromiseWithResolvers<T> {
  /**
   * 現在の状態を持つ {@link NinjaPromise} オブジェクトです。
   */
  promise: NinjaPromise<T>;

  /**
   * {@link NinjaPromise} を解決する関数です。
   *
   * @param value 解決に用いる値です。{@link PromiseLike} を渡すとその状態を再帰的に継承します。
   */
  resolve: (value: T | PromiseLike<T>) => void;

  /**
   * {@link NinjaPromise} を拒否する関数です。
   *
   * @param reason 拒否の理由です。
   */
  reject: (reason?: unknown) => void;
}

/**
 * {@link NinjaPromise} が取り得る状態のユニオン型です。
 *
 * `"pending"` | `"fulfilled"` | `"rejected"` のいずれかです。
 */
type NinjaPromiseStatus = NinjaPromise<unknown>["status"];

/**
 * {@link then} メソッドで登録されるコールバックと、それに関連する解決・拒否関数を保持する型です。
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
     * 拒否された理由です。
     */
    reason?: unknown;
  };
};

/**
 * {@link NinjaPromise} のコンストラクター型です。
 *
 * 標準の {@link Promise} と同じインターフェースに加え、状態を同期的に参照するための静的メソッドを提供します。
 *
 * @example
 * ```ts
 * import NinjaPromise from "ninja-promise";
 *
 * // コンストラクターで非同期処理をラップ
 * const promise = new NinjaPromise<string>((resolve) => {
 *   setTimeout(() => resolve("3秒後"), 3000);
 * });
 * console.log(promise.status); // "pending"
 *
 * // 静的メソッドで既に確定した状態のインスタンスを作成
 * const resolved = NinjaPromise.resolve("即時");
 * console.log(resolved.status); // "fulfilled"
 * ```
 */
export interface NinjaPromiseConstructor {
  // ES2015

  /**
   * 新しい {@link NinjaPromise} インスタンスを作成します。
   *
   * @param executor `resolve` および `reject` 関数を引数として受け取る関数です。この関数はコンストラクター内で即座に同期的に実行されます。関数内で同期的に例外が投げられた場合、自動的に拒否状態になります。
   *
   * @example
   * ```ts
   * import NinjaPromise from "ninja-promise";
   *
   * // fetch を NinjaPromise でラップ
   * const promise = new NinjaPromise<{ id: number }>((resolve, reject) => {
   *   fetch("/api/data")
   *     .then(response => response.json())
   *     .then(data => resolve(data))
   *     .catch(error => reject(error));
   * });
   *
   * // 同期的に状態を確認
   * console.log(promise.status); // "pending"
   * ```
   */
  new <T>(
    executor: (
      resolve: (value: T | PromiseLike<T>) => void,
      reject: (reason?: unknown) => void,
    ) => void,
  ): NinjaPromise<T>;

  /**
   * 既に拒否状態となっている {@link NinjaPromise} インスタンスを作成します。
   *
   * @template T NinjaPromise が期待していた値の型です。
   * @param reason 拒否の理由です。
   * @returns 拒否状態の {@link NinjaPromise} です。
   *
   * @example
   * ```ts
   * import NinjaPromise from "ninja-promise";
   *
   * const promise = NinjaPromise.reject(new Error("設定ファイルが見つかりません"));
   *
   * console.log(promise.status); // "rejected"
   * console.log(promise.reason); // Error: "設定ファイルが見つかりません"
   * ```
   */
  reject<T = never>(reason?: unknown): RejectedNinjaPromise<T>;

  /**
   * 値なしで既に解決状態となっている {@link NinjaPromise} インスタンスを作成します。
   *
   * @returns 解決状態の {@link NinjaPromise} です。`value` は `undefined` になります。
   *
   * @example
   * ```ts
   * import NinjaPromise from "ninja-promise";
   *
   * const promise = NinjaPromise.resolve();
   *
   * console.log(promise.status); // "fulfilled"
   * console.log(promise.value);  // undefined
   * ```
   */
  resolve(): FulfilledNinjaPromise<undefined>;

  /**
   * 指定された値で既に解決状態となっている {@link NinjaPromise} インスタンスを作成します。
   *
   * 引数に {@link PromiseLike} を渡すと、その状態を再帰的に継承します。この場合、継承元が解決されるまでは `status` は `"pending"` になります。
   *
   * @template T 解決される値の型です。
   * @param value 解決に用いる値です。{@link PromiseLike} の場合はその状態を再帰的に継承します。
   * @returns 解決状態の {@link NinjaPromise} です。
   *
   * @example
   * ```ts
   * import NinjaPromise from "ninja-promise";
   *
   * // 値による解決
   * const p1 = NinjaPromise.resolve("直接値");
   * console.log(p1.status); // "fulfilled"
   * console.log(p1.value);  // "直接値"
   *
   * // PromiseLike による解決（状態の継承）
   * const p2 = NinjaPromise.resolve(Promise.resolve("非同期値"));
   * console.log(p2.status); // "pending"（継承元が解決されていないため）
   * await p2;
   * console.log(p2.status); // "fulfilled"
   * console.log(p2.value);  // "非同期値"
   * ```
   */
  resolve<T>(value: T): FulfilledNinjaPromise<Awaited<T>>;

  // ES2024

  /**
   * {@link NinjaPromise} と、それを外部から制御するためのリゾルバーを作成します。
   *
   * @template T {@link NinjaPromise} が解決された際の値の型です。
   * @returns `{@link NinjaPromiseWithResolvers | promise, resolve, reject}` を含むオブジェクトです。
   *
   * @example
   * ```ts
   * import NinjaPromise from "ninja-promise";
   *
   * const { promise, resolve, reject } = NinjaPromise.withResolvers<Buffer>();
   *
   * // コールバックベースのファイル読み込みをラップ
   * fs.readFile("config.json", (err, data) => {
   *   if (err) {
   *     reject(err);
   *   } else {
   *     resolve(data);
   *   }
   * });
   *
   * // 同期的に状態を確認可能
   * console.log(promise.status); // "pending"（まだコールバック待ち）
   * ```
   */
  withResolvers<T>(): NinjaPromiseWithResolvers<T>;

  // ES2025

  /**
   * 指定された関数を実行し、その結果を {@link NinjaPromise} として返します。
   *
   * 標準の {@link Promise.try | `Promise.try()`} と同じ動作をします。関数が同期的に例外を投げた場合は即座に拒否状態のインスタンスを返します。関数の戻り値が {@link PromiseLike} の場合は、その状態を再帰的に継承します。
   *
   * @template T 関数の戻り値の型です。
   * @template TArgs 関数に渡す引数の型配列です。
   * @param callbackFn 実行するコールバック関数です。
   * @param args 関数に渡す引数です。
   * @returns 実行結果をラップした {@link NinjaPromise} です。
   *
   * @example
   * ```ts
   * import NinjaPromise from "ninja-promise";
   *
   * // 同期的な成功
   * const p1 = NinjaPromise.try(() => JSON.parse('{"key":"value"}'));
   * console.log(p1.status); // "fulfilled"
   * console.log(p1.value);  // { key: "value" }
   *
   * // 同期的な例外は即座に拒否
   * const p2 = NinjaPromise.try(() => JSON.parse("不正な JSON"));
   * console.log(p2.status); // "rejected"
   *
   * // 非同期関数も対応
   * const p3 = NinjaPromise.try(async () => {
   *   const response = await fetch("/api/data");
   *   return response.json();
   * });
   * console.log(p3.status); // "pending"
   * ```
   */
  try<T, U extends unknown[]>(
    callbackFn: (...args: U) => T | PromiseLike<T>,
    ...args: U
  ): NinjaPromise<Awaited<T>>;
}

// @ts-expect-error
const NinjaPromise: NinjaPromiseConstructor = class NinjaPromise<T>
  extends Options<T>
  implements PromiseLike<T>
{
  /**
   * 指定された関数を実行し、その結果を {@link NinjaPromise} として返します。
   *
   * 関数が同期的に例外を投げた場合は即座に拒否状態のインスタンスを返します。関数の戻り値が {@link PromiseLike} の場合は、その状態を再帰的に継承します。
   *
   * @template T 関数の戻り値の型です。
   * @template TArgs 関数に渡す引数の型配列です。
   * @param callbackFn 実行するコールバック関数です。
   * @param args 関数に渡す引数です。
   * @returns 実行結果をラップした {@link NinjaPromise} です。
   */
  public static try<T, U extends unknown[]>(
    callbackFn: (...args: U) => T | PromiseLike<T>,
    ...args: U
  ): NinjaPromise<Awaited<T>> {
    let value;
    try {
      value = callbackFn(...args);
      if (!isThenable(value)) {
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
   * 既に拒否状態となっている {@link NinjaPromise} インスタンスを作成します。
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
   * 値なしで既に解決状態となっている {@link NinjaPromise} インスタンスを作成します。
   *
   * @returns 解決状態の {@link NinjaPromise} です。`value` は `undefined` になります。
   */
  public static resolve(): FulfilledNinjaPromise<undefined>;

  /**
   * 指定された値で既に解決状態となっている {@link NinjaPromise} インスタンスを作成します。
   *
   * @template T 解決される値の型です。
   * @param value 解決に用いる値です。{@link PromiseLike} の場合はその状態を再帰的に継承します。
   * @returns 解決状態の {@link NinjaPromise} です。
   */
  public static resolve<T>(value: T): FulfilledNinjaPromise<Awaited<T>>;

  public static resolve(value?: unknown): FulfilledNinjaPromise<unknown> {
    const promise = new this<unknown>(() => {});
    promise.#resolve(value);

    return promise as FulfilledNinjaPromise<unknown>;
  }

  /**
   * {@link NinjaPromise} と、それを外部から制御するためのリゾルバーを作成します。
   *
   * @template T {@link NinjaPromise} が解決された際の値の型です。
   * @returns 新しい {@link NinjaPromiseWithResolvers} オブジェクトです。
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
   * 現在の {@link NinjaPromise} の状態です。
   */
  #status: NinjaPromiseStatus = "pending";

  /**
   * 解決または拒否を待機しているコールバックのキューです。
   */
  readonly #queue: PromiseCallback<T, any>[] = [];

  /**
   * 新しい {@link NinjaPromise} インスタンスを作成します。
   *
   * @param executor `resolve` および `reject` 関数を引数として受け取る関数です。この関数はコンストラクター内で即座に同期的に実行されます。関数内で同期的に例外が投げられた場合、自動的に拒否状態になります。
   */
  constructor(
    executor: (
      resolve: (value: T | PromiseLike<T>) => void,
      reject: (reason?: unknown) => void,
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
   * 内部的に {@link NinjaPromise} を拒否状態に遷移させます。
   *
   * すでに解決または拒否されている場合は何も行いません。
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

    if (!isThenable(value)) {
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
   * 現在の {@link NinjaPromise} の状態を返します。
   *
   * 状態は `"pending"`、`"fulfilled"`、`"rejected"` のいずれかです。このプロパティーにより、非同期処理の状態を同期的に判定できます。
   *
   * @returns 現在の状態です。
   *
   * @example
   * ```ts
   * import NinjaPromise from "ninja-promise";
   *
   * const { promise, resolve } = NinjaPromise.withResolvers<number>();
   * console.log(promise.status); // "pending"
   *
   * resolve(42);
   * console.log(promise.status); // "fulfilled"
   *
   * // 型ガードで value / reason に安全にアクセス
   * if (promise.status === "fulfilled") {
   *   console.log(promise.value); // 42
   * }
   * ```
   */
  public get status(): NinjaPromiseStatus {
    return this.#status;
  }

  /**
   * {@link NinjaPromise} が解決または拒否された際のコールバックを登録します。
   *
   * 標準の {@link Promise.prototype.then} と同様のインターフェースです。コールバックはマイクロタスクとして非同期に実行されます。
   *
   * @template TResult1 解決時コールバックの戻り値の型です。
   * @template TResult2 拒否時コールバックの戻り値の型です。
   * @param onfulfilled 解決時に実行されるコールバックです。`null` または省略時は値がそのまま透過されます。
   * @param onrejected 拒否時に実行されるコールバックです。`null` または省略時はエラーがそのまま透過されます。
   * @returns 新しい {@link NinjaPromise} インスタンスです。
   *
   * @example
   * ```ts
   * import NinjaPromise from "ninja-promise";
   *
   * const promise = NinjaPromise.resolve(5);
   *
   * promise
   *   .then(value => value * 2)
   *   .then(value => console.log(value)); // 10（非同期）
   *
   * // エラーハンドリング
   * const rejected = NinjaPromise.reject(new Error("失敗"));
   * rejected.then(null, error => {
   *   console.error(error.message); // "失敗"
   *   return "回復";
   * });
   * ```
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

  /**
   * {@link NinjaPromise} をネイティブの {@link Promise} に変換します。
   *
   * @returns ネイティブの {@link Promise} オブジェクトです。
   *
   * @example
   * ```ts
   * import NinjaPromise from "ninja-promise";
   *
   * const ninjaPromise = NinjaPromise.resolve("ネイティブ変換");
   * const nativePromise = ninjaPromise.toPromise();
   *
   * console.log(nativePromise instanceof Promise); // true
   * const value = await nativePromise;
   * console.log(value); // "ネイティブ変換"
   * ```
   */
  public toPromise(): Promise<T> {
    return Promise.resolve(this);
  }
};

export default NinjaPromise;
