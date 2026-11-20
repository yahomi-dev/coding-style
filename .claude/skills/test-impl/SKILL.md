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
4. テストを実行し、追加したテストが失敗（Red）することを確認する

## テスト実装ルール

- 規約 `typescript.md` と `design-policy.md` (テスト戦略) に従う (全体の規約として `~/.claude/rules/` から読み込まれている。正は coding-style の `.claude/rules/`)
- `expect` を使ったアサーションを書く。値の比較は `toStrictEqual` を既定にする
- 1 つの `it` は 1 つの振る舞いを主張する (同じ振る舞いを複数の入力で確かめる `expect` の並びは可)
- テスト対象の関数を import する
- テストデータはテスト内にベタ書きする（共通化しない）
- Mock (呼び出しの回数や順序の検証) は使わない。I/O は引数で渡し、外部境界 (HTTP・DB・ファイル等) だけ値を返す Stub か軽量な本物の Fake を渡す。純粋関数なら何も差し替えない

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

- プロジェクトの検査コマンド (下の「検査コマンド」) を実行する
- 追加したテストが**失敗**し、既存のテストは通ることを確認する
- 失敗理由が「未実装による期待値不一致」であることを確認する（テストコード自体のエラーではない）
- テスト以外の検査 (lint・ast-grep・型検査) はすべて通ることを確認する (テストコードも規約の対象)

## 検査コマンド

`npx` で個々のツールを叩かず、プロジェクトの検査コマンドを使う。

- justfile に `verify` があればそれ (lint・ast-grep・型検査・テストをまとめて実行する)
- 無ければ justfile か package.json の scripts から、lint・ast-grep・型検査・テストに当たるものをすべて実行する
- `sgconfig.yml` があるのに検査コマンドに ast-grep が含まれていなければ、`ast-grep scan` も実行する
- `verify` のように途中の失敗で止まる検査では、テストより前の検査 (lint・ast-grep・型検査) が通ったうえでテストだけが落ちていることを確かめる

## 注意事項

- このステップではプロダクションコードの実装を行わない
- 追加したテストが失敗する状態（Red）が正しい。追加したテストが Red で、それ以外の検査が通ったことをユーザーに報告する
