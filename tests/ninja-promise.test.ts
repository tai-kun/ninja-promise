import { describe, test } from "vitest";

import NinjaPromise, {
  type FulfilledNinjaPromise,
  type RejectedNinjaPromise,
} from "../src/ninja-promise.js";

describe("NinjaPromise の状態遷移と基本動作", () => {
  test("初期化された直後は pending 状態である", ({ expect }) => {
    // Arrange & Act
    const promise = new NinjaPromise(() => {});

    // Assert
    expect(promise.status).toBe("pending");
  });

  test("executor 内で resolve されると fulfilled 状態になり、解決された値を持つ", ({ expect }) => {
    // Arrange & Act
    const promise = new NinjaPromise<string>((resolve) => {
      resolve("ok");
    });

    // Assert
    expect(promise.status).toBe("fulfilled");
    expect((promise as FulfilledNinjaPromise<string>).value).toBe("ok");
  });

  test("executor 内で reject されると rejected 状態になり、拒否された理由を持つ", ({ expect }) => {
    // Arrange & Act
    const promise = new NinjaPromise((_, reject) => {
      reject("error");
    });

    // Assert
    expect(promise.status).toBe("rejected");
    expect((promise as RejectedNinjaPromise).reason).toBe("error");
  });

  test("一度 settled 状態になった後は、後続の resolve 呼び出しを無視する", ({ expect }) => {
    // Arrange
    const promise = new NinjaPromise<string>((resolve) => {
      resolve("first");
      resolve("second");
    });

    // Assert
    expect((promise as FulfilledNinjaPromise<string>).value).toBe("first");
  });

  test("executor 内で例外が発生したとき、自動的に rejected 状態になる", ({ expect }) => {
    // Arrange
    const error = new Error("unexpected error");

    // Act
    const promise = new NinjaPromise(() => {
      throw error;
    });

    // Assert
    expect(promise.status).toBe("rejected");
    expect((promise as RejectedNinjaPromise).reason).toBe(error);
  });
});

describe("静的メソッドによるインスタンス生成", () => {
  test("NinjaPromise.resolve を呼び出すとき、即座に解決されたインスタンスを返す", ({ expect }) => {
    // Act
    const promise = NinjaPromise.resolve("success");

    // Assert
    expect(promise.status).toBe("fulfilled");
    expect(promise.value).toBe("success");
  });

  test("NinjaPromise.reject を呼び出すとき、即座に拒否されたインスタンスを返す", ({ expect }) => {
    // Act
    const promise = NinjaPromise.reject("fail");

    // Assert
    expect(promise.status).toBe("rejected");
    expect(promise.reason).toBe("fail");
  });

  test("withResolvers を使用するとき、外部から解決可能な promise と resolver を提供する", ({
    expect,
  }) => {
    // Arrange
    // oxlint-disable-next-line typescript/unbound-method
    const { promise, resolve } = NinjaPromise.withResolvers<string>();

    // Act
    resolve("done");

    // Assert
    expect(promise.status).toBe("fulfilled");
    expect((promise as FulfilledNinjaPromise<string>).value).toBe("done");
  });

  test("try で関数を実行したとき、その戻り値で解決される", ({ expect }) => {
    // Act
    const promise = NinjaPromise.try(() => 10);

    // Assert
    expect(promise.status).toBe("fulfilled");
    expect((promise as FulfilledNinjaPromise<number>).value).toBe(10);
  });

  test("try 内で例外が投げられたとき、拒否されたインスタンスを返す", ({ expect }) => {
    // Act
    const promise = NinjaPromise.try(() => {
      throw "exception";
    });

    // Assert
    expect(promise.status).toBe("rejected");
    expect((promise as RejectedNinjaPromise).reason).toBe("exception");
  });
});

describe("then メソッドによるチェーンと非同期処理", () => {
  test("then を使用したとき、戻り値が次の promise に引き継がれる", async ({ expect }) => {
    // Arrange
    const promise = NinjaPromise.resolve(2);

    // Act
    const nextPromise = promise.then((v) => v * 2);

    // Assert
    // 非同期的な解決を待機するために await する（実装が microtask を使用しているため）。
    await nextPromise;
    expect((nextPromise as FulfilledNinjaPromise<number>).value).toBe(4);
  });

  test("then のコールバックは、現在のコールスタック終了後のマイクロタスクで実行される", ({
    expect,
  }) => {
    // Arrange
    const promise = NinjaPromise.resolve("sync");
    let called = false;

    // Act
    promise.then(() => {
      called = true;
    });

    // Assert
    // 登録直後はまだ実行されていないことを検証する。
    expect(called).toBe(false);
  });

  test("コールバックに非関数が渡されたとき、前の promise の値をそのまま次へ透過させる", async ({
    expect,
  }) => {
    // Arrange
    const promise = NinjaPromise.resolve("passed");

    // Act
    const nextPromise = promise.then(null, null);

    // Assert
    await nextPromise;
    expect((nextPromise as FulfilledNinjaPromise<string>).value).toBe("passed");
  });

  test("拒否された promise を then の第 2 引数で処理したとき、次の promise は解決状態になる", async ({
    expect,
  }) => {
    // Arrange
    const promise = NinjaPromise.reject("error");

    // Act
    const nextPromise = promise.then(null, (ex) => `recovered from ${String(ex)}`);

    // Assert
    await nextPromise;
    expect(nextPromise.status).toBe("fulfilled");
    expect((nextPromise as FulfilledNinjaPromise<string>).value).toBe("recovered from error");
  });

  test("then の中で例外が発生したとき、次の promise は rejected 状態になる", async ({ expect }) => {
    // Arrange
    const promise = NinjaPromise.resolve();

    // Act
    const nextPromise = promise.then(() => {
      throw "fail in then";
    });

    // Assert
    try {
      await nextPromise;
    } catch {
      // rejection 待機
    }
    expect(nextPromise.status).toBe("rejected");
    expect((nextPromise as RejectedNinjaPromise).reason).toBe("fail in then");
  });
});

describe("境界値と特殊な相互運用", () => {
  test("自分自身で解決しようとしたとき、TypeError で拒否される", async ({ expect }) => {
    // Arrange
    // oxlint-disable-next-line typescript/unbound-method
    const { promise, resolve } = NinjaPromise.withResolvers();

    // Act
    resolve(promise);

    // Assert
    try {
      await promise;
    } catch (e) {
      expect(e).toBeInstanceOf(TypeError);
      expect((e as TypeError).message).toContain("Chaining cycle detected");
    }
  });

  test("標準の Promise を resolve に渡したとき、その解決を待機してから同じ状態になる", async ({
    expect,
  }) => {
    // Arrange
    const standardPromise = Promise.resolve("from standard");

    // Act
    const ninjaPromise = NinjaPromise.resolve(standardPromise);

    // Assert
    expect(ninjaPromise.status).toBe("pending");
    await ninjaPromise;
    expect(ninjaPromise.status).toBe("fulfilled");
    expect(ninjaPromise.value).toBe("from standard");
  });

  test("複数の then コールバックを登録したとき、登録された順序で実行される", async ({ expect }) => {
    // Arrange
    const promise = NinjaPromise.resolve();
    const results: number[] = [];

    // Act
    promise.then(() => results.push(1));
    promise.then(() => results.push(2));
    promise.then(() => results.push(3));

    // Assert
    await promise.then(() => {}); // 全てのタスク完了を待機
    expect(results).toHaveLength(3);
    expect(results[0]).toBe(1);
    expect(results[1]).toBe(2);
    expect(results[2]).toBe(3);
  });
});
