# コーディング規約

## 概要

本プロジェクトのコーディング規約を定義する。ルールは以下の2種類に分類される。

| 種類       | 強制方法                              | 詳細の管理場所        |
| ---        | ---                                   | ---                   |
| ツール強制 | Biome formatter / linter が自動で適用 | 本ドキュメント        |
| 判断が必要 | 開発者・AIが判断して遵守              | `.claude/rules/` 配下 |

## ツール強制ルール

以下はBiomeが自動で強制するため、開発者が意識する必要はない。`biome.json` が正本。

### フォーマット

| 項目       | ルール         | Biome設定                                     |
| ---        | ---            | ---                                           |
| インデント | タブ           | `formatter.indentStyle: "tab"`                |
| クォート   | ダブルクォート | `javascript.formatter.quoteStyle: "double"`   |
| import整理 | 自動ソート     | `assist.actions.source.organizeImports: "on"` |

### Lint

| 項目           | ルール                       | Biome設定                                    |
| ---            | ---                          | ---                                          |
| default export | 禁止                         | `style.noDefaultExport: "on"`                |
| 型定義の統一   | type に統一（interface禁止） | `style.useConsistentTypeDefinitions: "type"` |

## 判断が必要なルール

以下は開発者・AIが判断して遵守するルール。詳細は各ファイルを参照。

### TypeScript コーディングルール

詳細: `.claude/rules/typescript.md`

- class構文を使用しない
- enum を使用しない（ユニオン型・as constで代替）
- null を使用しない（undefined に統一）
- const のみ使用（let / var 禁止）
- アロー関数で統一（ブロック省略禁止）
- switch文・三項演算子・短絡評価による分岐を禁止
- 逐次ループ禁止（高階関数を使用）
- 高階関数のコールバック内でif文禁止
- named export のみ（default export 禁止）
- 関数型には type alias を使う
- JSDocスタイルのコメント

### 設計・実装方針

詳細: `.claude/rules/design-policy.md`

- 関数はテスト可能な単位でexportする
- 戻り値の型は統一する
- ルールや条件はデータ駆動で設計する
- 条件判定は関数型で表現する
- ルールの組み合わせは高階関数の合成で表現する
- 副作用は関数の外に切り出す
