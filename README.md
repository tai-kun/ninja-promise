# ninja-promise

非同期処理の状態（`"pending"` / `"fulfilled"` / `"rejected"`）を同期的に参照できる Promise ライクな JavaScript / TypeScript クラスです。

## 特長

- **状態の同期的確認**: `promise.status` で解決済みか拒否済みかを同期的に判定できます。
- **型安全**: TypeScript の型ガードにより、`status` に応じて `value` や `reason` に安全にアクセスできます。
- **標準 Promise との互換性**: `PromiseLike` を実装しており、`await` や `then` チェーン、`Promise.resolve()` との相互運用が可能です。
- **既存の Promise にない静的メソッド**: `Promise.try()`（ES2025）に対応しています。

## インストール

```sh
pnpm add ninja-promise
```

## 基本的な使い方

```ts
import NinjaPromise from "ninja-promise";

// 既に解決された Promise を作成
const resolved = NinjaPromise.resolve("完了");
console.log(resolved.status); // "fulfilled"
console.log(resolved.status === "fulfilled" && resolved.value); // "完了"

// 既に拒否された Promise を作成
const rejected = NinjaPromise.reject(new Error("失敗"));
console.log(rejected.status); // "rejected"
console.log(rejected.status === "rejected" && rejected.reason); // Error: "失敗"

// コンストラクターで非同期処理をラップ
const promise = new NinjaPromise<string>((resolve) => {
  setTimeout(() => resolve("3秒後"), 3000);
});
console.log(promise.status); // "pending"

// await や then も通常の Promise と同様に使える
const result = await promise.then((value) => value.toUpperCase());
console.log(result); // "3秒後"
```

## API

### `status` プロパティー

Promise の現在の状態を返します。型ガードと組み合わせることで、`value` や `reason` に安全にアクセスできます。

```ts
if (promise.status === "fulfilled") {
  console.log(promise.value); // 値に安全にアクセス
}

if (promise.status === "rejected") {
  console.error(promise.reason); // 拒否理由に安全にアクセス
}
```

### `then(onfulfilled?, onrejected?)`

標準の `Promise.prototype.then` と同じインターフェースです。コールバックはマイクロタスクとして非同期に実行されます。

```ts
NinjaPromise.resolve(5)
  .then((value) => value * 2)
  .then((value) => console.log(value)); // 10
```

### `toPromise()`

`NinjaPromise` をネイティブの `Promise` に変換します。

```ts
const ninjaPromise = NinjaPromise.resolve("変換");
const nativePromise = ninjaPromise.toPromise();
console.log(nativePromise instanceof Promise); // true
console.log(await nativePromise); // "変換"
```

### 静的メソッド

#### `NinjaPromise.resolve(value?)`

解決状態の `NinjaPromise` インスタンスを作成します。引数に `PromiseLike` を渡すと、その状態を再帰的に継承します。

```ts
const p1 = NinjaPromise.resolve("直接値");
console.log(p1.status); // "fulfilled"

const p2 = NinjaPromise.resolve(Promise.resolve("非同期値"));
console.log(p2.status); // "pending"（継承元が解決されると "fulfilled" になる）
```

#### `NinjaPromise.reject(reason?)`

拒否状態の `NinjaPromise` インスタンスを作成します。

```ts
const promise = NinjaPromise.reject(new Error("エラー"));
console.log(promise.status); // "rejected"
```

#### `NinjaPromise.withResolvers()`

`NinjaPromise` と、それを外部から解決・拒否するための関数を生成します。

```ts
const { promise, resolve, reject } = NinjaPromise.withResolvers<string>();

someAsyncOperation((error, data) => {
  if (error) {
    reject(error);
  } else {
    resolve(data);
  }
});

console.log(promise.status); // "pending"
```

#### `NinjaPromise.try(callbackFn, ...args)`

関数を実行し、その結果を `NinjaPromise` として返します。同期例外は即座に拒否状態になります。

```ts
// 同期的な成功
const p1 = NinjaPromise.try(() => JSON.parse('{"key":"value"}'));
console.log(p1.status); // "fulfilled"

// 同期的な例外は即座に拒否
const p2 = NinjaPromise.try(() => JSON.parse("不正な JSON"));
console.log(p2.status); // "rejected"

// 非同期関数にも対応
const p3 = NinjaPromise.try(async () => {
  const response = await fetch("/api/data");
  return response.json();
});
console.log(p3.status); // "pending"
```

## 開発

```sh
pnpm install
pnpm run build
```

テスト:

```sh
CI=1 pnpm run test
```

## ライセンス

[MIT](LICENSE)
