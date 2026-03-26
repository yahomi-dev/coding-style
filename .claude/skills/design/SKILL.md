---
name: design
description: 型・インターフェース設計。関数シグネチャのガワだけをexportする
user_invocable: true
---

# /design — 型・IF設計

ユーザーが実装したい機能の説明を元に、型定義と関数シグネチャを設計する。

## 手順

1. ユーザーから機能の要件を聞く（引数で渡された場合はそれを使う）
2. 以下を設計する:
   - 型定義（type alias）
   - 関数シグネチャ（export付き、中身は未実装）
3. 設計結果をファイルに書き出す

## 設計ルール

- @.claude/rules/typescript.md に従う
- @.claude/rules/design-policy.md に従う
- 関数の中身は実装しない。シグネチャだけ定義する
- 未実装の関数本体には仮の戻り値を入れてコンパイルを通す（`throw new Error("not implemented")` は使わない）

## 仮の戻り値の例

```ts
// string を返す関数
export const formatName = (first: string, last: string): string => {
    return "";
};

// string[] を返す関数
export const getNames = (count: number): string[] => {
    return [];
};

// number を返す関数
export const calculate = (x: number, y: number): number => {
    return 0;
};

// boolean を返す関数
export const isValid = (input: string): boolean => {
    return false;
};
```

## 出力フォーマット

1. まず設計意図を簡潔に説明する
2. 型定義と関数シグネチャをファイルに書き出す
3. `tsc --noEmit` と `biome check` を実行してエラーがないことを確認する
4. 各関数の役割を一覧で示す

## 注意事項

- このステップでは本実装を行わない
- 副作用（console.log等）を含む関数は作らない。エントリポイント（index.ts等）に委ねる
- ユーザーがレビューして修正を依頼できるよう、設計の意図を説明する
