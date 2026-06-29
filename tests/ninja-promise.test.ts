import { describe, test } from "vitest";

import NinjaPromise, {
  type FulfilledNinjaPromise,
  type RejectedNinjaPromise,
} from "../src/ninja-promise.js";

describe("NinjaPromise", () => {
  test("コンストラクターで同期的に resolve を呼ぶと即座に fulfilled 状態になる", ({ expect }) => {
    // 準備
    const promise = new NinjaPromise<number>((resolve) => {
      resolve(42);
    });

    // 実行と検証
    expect(promise.status).toBe("fulfilled");
    expect((promise as FulfilledNinjaPromise<number>).value).toBe(42);
  });

  test("コンストラクターで同期的 reject を呼ぶと即座に rejected 状態になる", ({ expect }) => {
    // 準備
    const error = new Error("テストエラー");
    const promise = new NinjaPromise((_resolve, reject) => {
      reject(error);
    });

    // 実行と検証
    expect(promise.status).toBe("rejected");
    expect((promise as RejectedNinjaPromise).reason).toBe(error);
  });

  test("executor が同期的に例外を投げると即座に rejected 状態になる", ({ expect }) => {
    // 準備
    const error = new Error("executor エラー");
    const promise = new NinjaPromise(() => {
      throw error;
    });

    // 実行と検証
    expect(promise.status).toBe("rejected");
    expect((promise as RejectedNinjaPromise).reason).toBe(error);
  });

  test("静的 resolve で fulfilled 状態のインスタンスを作成できる", ({ expect }) => {
    // 準備
    const promise = NinjaPromise.resolve("hello");

    // 実行と検証
    expect(promise.status).toBe("fulfilled");
    expect((promise as FulfilledNinjaPromise<string>).value).toBe("hello");
  });

  test("静的 reject で rejected 状態のインスタンスを作成できる", ({ expect }) => {
    // 準備
    const error = new Error("拒否");
    const promise = NinjaPromise.reject(error);

    // 実行と検証
    expect(promise.status).toBe("rejected");
    expect((promise as RejectedNinjaPromise).reason).toBe(error);
  });

  test("withResolvers で外部から解決できる", ({ expect }) => {
    // 準備
    const { promise, resolve } = NinjaPromise.withResolvers<number>();

    // 実行
    resolve(99);

    // 検証
    expect(promise.status).toBe("fulfilled");
    expect((promise as FulfilledNinjaPromise<number>).value).toBe(99);
  });

  test("withResolvers で外部から拒否できる", ({ expect }) => {
    // 準備
    const { promise, reject } = NinjaPromise.withResolvers();
    const error = new Error("外部拒否");

    // 実行
    reject(error);

    // 検証
    expect(promise.status).toBe("rejected");
    expect((promise as RejectedNinjaPromise).reason).toBe(error);
  });

  test("fulfilled 状態で then を呼ぶと onfulfilled が非同期に実行される", async ({ expect }) => {
    // 準備
    const promise = NinjaPromise.resolve(10);

    // 実行
    let result: number | undefined;
    const next = promise.then((value) => {
      result = value;
      return value * 2;
    });

    // 検証
    // then のコールバックはマイクロタスクで実行される
    expect(result).toBeUndefined();
    expect(next.status).toBe("pending");

    // マイクロタスクの完了を待つ
    await promise.toPromise();

    // 検証
    expect(result).toBe(10);
    expect(next.status).toBe("fulfilled");
    expect((next as FulfilledNinjaPromise<number>).value).toBe(20);
  });

  test("rejected 状態で then を呼ぶと onrejected が非同期に実行される", async ({ expect }) => {
    // 準備
    const error = new Error("拒否");
    const promise = NinjaPromise.reject(error);

    // 実行
    let result: unknown;
    const next = promise.then(null, (reason) => {
      result = reason;
      return "回復";
    });

    // 検証
    expect(result).toBeUndefined();

    // マイクロタスクの完了を待つ
    await promise.toPromise().catch(() => {});

    // 検証
    expect(result).toBe(error);
    expect(next.status).toBe("fulfilled");
    expect((next as FulfilledNinjaPromise<string>).value).toBe("回復");
  });

  test("onfulfilled 内の例外は次の Promise を拒否する", async ({ expect }) => {
    // 準備
    const error = new Error("コールバックエラー");
    const promise = NinjaPromise.resolve(1);

    // 実行
    const next = promise.then(() => {
      throw error;
    });

    // マイクロタスクの完了を待つ
    await promise.toPromise().catch(() => {});

    // 検証
    expect(next.status).toBe("rejected");
    expect((next as RejectedNinjaPromise).reason).toBe(error);
  });

  test("自身を解決しようとすると TypeError で拒否される", ({ expect }) => {
    // 準備
    const { promise, resolve } = NinjaPromise.withResolvers();

    // 実行
    resolve(promise as unknown as number);

    // 検証
    expect(promise.status).toBe("rejected");
    expect((promise as RejectedNinjaPromise).reason).toBeInstanceOf(TypeError);
  });

  test("2 回目の解決は無視される", ({ expect }) => {
    // 準備
    const { promise, resolve } = NinjaPromise.withResolvers<number>();

    // 実行
    resolve(1);
    resolve(2);

    // 検証
    expect(promise.status).toBe("fulfilled");
    expect((promise as FulfilledNinjaPromise<number>).value).toBe(1);
  });

  test("解決後の拒否は無視される", ({ expect }) => {
    // 準備
    const { promise, resolve, reject } = NinjaPromise.withResolvers<number>();

    // 実行
    resolve(1);
    reject(new Error("後からの拒否"));

    // 検証
    expect(promise.status).toBe("fulfilled");
    expect((promise as FulfilledNinjaPromise<number>).value).toBe(1);
  });

  test("toPromise でネイティブの Promise に変換できる", async ({ expect }) => {
    // 準備
    const ninjaPromise = NinjaPromise.resolve("promise");

    // 実行
    const nativePromise = ninjaPromise.toPromise();

    // 検証
    expect(nativePromise).toBeInstanceOf(Promise);
    await expect(nativePromise).resolves.toBe("promise");
  });

  test("静的 try は同期関数の結果を解決する", ({ expect }) => {
    // 準備
    const promise = NinjaPromise.try(() => 42);

    // 検証
    expect(promise.status).toBe("fulfilled");
    expect((promise as FulfilledNinjaPromise<number>).value).toBe(42);
  });

  test("静的 try は同期例外を拒否する", ({ expect }) => {
    // 準備
    const error = new Error("try エラー");
    const promise = NinjaPromise.try(() => {
      throw error;
    });

    // 検証
    expect(promise.status).toBe("rejected");
    expect((promise as RejectedNinjaPromise).reason).toBe(error);
  });

  test("静的 try は非同期関数の結果を解決する", async ({ expect }) => {
    // 準備
    const promise = NinjaPromise.try(async () => "非同期");

    // 検証
    expect(promise.status).toBe("pending");

    // マイクロタスクの完了を待つ
    await promise.toPromise();

    // 検証
    expect(promise.status).toBe("fulfilled");
    expect((promise as FulfilledNinjaPromise<string>).value).toBe("非同期");
  });

  test("resolve に PromiseLike を渡すとその状態を継承する", async ({ expect }) => {
    // 準備
    const { promise, resolve } = NinjaPromise.withResolvers<number>();

    // 実行
    resolve(Promise.resolve(7));

    // 検証
    expect(promise.status).toBe("pending");

    // マイクロタスクの完了を待つ
    await promise.toPromise();

    // 検証
    expect(promise.status).toBe("fulfilled");
    expect((promise as FulfilledNinjaPromise<number>).value).toBe(7);
  });

  test("resolve に拒否された PromiseLike を渡すと rejected 状態になる", async ({ expect }) => {
    // 準備
    const { promise, resolve } = NinjaPromise.withResolvers();
    const error = new Error("継承エラー");

    // 実行
    resolve(Promise.reject(error));

    // マイクロタスクの完了を待つ
    await promise.toPromise().catch(() => {});

    // 検証
    expect(promise.status).toBe("rejected");
    expect((promise as RejectedNinjaPromise).reason).toBe(error);
  });

  test("status を同期的に参照できる", ({ expect }) => {
    // 準備
    const pending = new NinjaPromise(() => {});
    const fulfilled = NinjaPromise.resolve("完了");
    const rejected = NinjaPromise.reject(new Error("失敗"));

    // 実行と検証
    expect(pending.status).toBe("pending");
    expect(fulfilled.status).toBe("fulfilled");
    expect(rejected.status).toBe("rejected");
  });
});
