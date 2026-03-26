---
name: test-impl
description: テストケースにコードを実装し、全テストがRedであることを確認する
user_invocable: true
---

# /test-impl — テスト実装（Red）

`/test-cases` で作成したテストケースにテストコードを実装する。

## 手順

1. `/test-cases` で作成されたテストファイルを読む
2. `/design` で作成された型定義・関数シグネチャを読む
3. 各 `it` にテストコードを実装する
4. テストを実行し、全テストが失敗（Red）することを確認する

## テスト実装ルール

- @.claude/rules/typescript.md に従う
- `expect` を使ったアサーションを書く
- 1つの `it` に1つの `expect`（原則）
- テスト対象の関数を import する
- テストデータはテスト内にベタ書きする（共通化しない）
- モックは最小限にする。純粋関数ならモック不要

## import の形式

```ts
import { describe, expect, it } from "vitest";
import { 関数名 } from "./ファイル名.js";
```

## 出力フォーマット

```ts
import { describe, expect, it } from "vitest";
import { fizzBuzz } from "./fizzBuzz.js";

describe("fizzBuzz", () => {
    it("正常系: 1を渡すと['1']を返す", () => {
        const result = fizzBuzz(1);

        expect(result).toStrictEqual(["1"]);
    });
});
```

## 確認事項

- `npx vitest run` を実行し、全テストが**失敗**することを確認する
- 失敗理由が「未実装による期待値不一致」であることを確認する（テストコード自体のエラーではない）
- コンパイルエラーがないことを `tsc --noEmit` で確認する

## 注意事項

- このステップではプロダクションコードの実装を行わない
- テストが失敗する状態（Red）が正しい。全テストがRedであることをユーザーに報告する
