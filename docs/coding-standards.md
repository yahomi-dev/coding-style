# コーディング規約

## 概要

ルールは「ツール強制」と「判断が必要」の2層で管理する。静的検査可能なルールはプロンプト（.claude/rules/）ではなくツールに置き、.claude/rules/ には原則と判断ルールだけを残す。

| 種類       | 強制方法                               | 正本                                              |
| ---        | ---                                    | ---                                               |
| ツール強制 | Biome / ast-grep / tsconfig が自動検出 | biome.json / ast-grep/rules/ / tsconfig.base.json |
| 判断が必要 | 開発者・AI が判断して遵守              | `.claude/rules/` 配下                             |

検証コマンド: `just verify`（check + scan + test-rules + test + build）

## ツール強制ルール

### フォーマット（Biome）

| 項目       | ルール         | 設定                                           |
| ---        | ---            | ---                                            |
| インデント | タブ           | `formatter.indentStyle: "tab"`                 |
| クォート   | ダブルクォート | `javascript.formatter.quoteStyle: "double"`    |
| import整理 | 自動ソート     | `assist.actions.source.organizeImports: "on"`  |

### Lint（Biome）

`preset: recommended` に加えて明示有効化しているもの:

| ルール                                  | 内容                             |
| ---                                     | ---                              |
| style/noDefaultExport                   | default export 禁止              |
| style/useConsistentTypeDefinitions      | type に統一（interface 禁止）    |
| style/useBlockStatements                | if 等のブロック必須              |
| style/noNonNullAssertion                | 非 null アサーション `!` 禁止    |
| style/useImportType                     | type-only import の強制          |
| style/noNestedTernary                   | ネストした三項演算子の禁止       |
| style/noEnum / style/noNamespace        | enum / namespace 禁止            |
| style/noParameterAssign / style/useConst| 引数再代入禁止 / const 強制      |
| suspicious/noVar（error 指定）          | var 禁止                         |
| complexity/noForEach                    | forEach 禁止                     |

### スタイルルール（ast-grep）

`ast-grep/rules/` が正本。原則として各ルールに Tsx 変種（`<rule-id>-tsx`）がある（no-leaked-render は Tsx のみ）。ルール自体のテストは `ast-grep/rule-tests/`（`just test-rules`）。

| ルール ID                  | 内容                                       | 正当な逃し方                                  |
| ---                        | ---                                        | ---                                           |
| no-let                     | let 禁止（const のみ）                     | アダプタ層（`**/adapters/**` / `*.adapter.ts`）は対象外 |
| no-loops                   | for / for-in / do-while 禁止               | -                                             |
| no-for-of-outside-adapter  | for-of はアダプタ層の逐次 await のみ       | `**/adapters/**` / `*.adapter.ts` に置く      |
| no-while-outside-adapter   | while はアダプタ層のみ                     | `**/adapters/**` / `*.adapter.ts` に置く      |
| no-function-keyword        | function 構文・ジェネレータ・メソッド禁止  | -                                             |
| no-class                   | class 禁止                                 | フレームワーク強制時は suppression            |
| no-null                    | null 禁止（`=== null` 等の比較は許可）     | ライブラリ契約（useRef 等）は suppression     |
| no-enum                    | enum 禁止                                  | -                                             |
| no-switch                  | switch 禁止（ts-pattern を使う）           | -                                             |
| no-else-if                 | else if 禁止（早期 return）                | -                                             |
| no-ternary-statement       | 三項演算子を文として使うこと禁止           | -                                             |
| no-short-circuit-statement | `&&` / `\|\|` を文として使うこと禁止       | -                                             |
| no-array-mutation          | 破壊的メソッド禁止                         | 局所ミューテーション例外は suppression        |
| no-object-assign-mutation  | Object.assign の第一引数変更禁止           | -                                             |
| no-member-mutation         | プロパティ代入 / delete 禁止               | アダプタ層は対象外、`/Ref$/` の `.current` 書き込み（= / += / ++）は除外、例外は suppression |
| no-branching-in-callback   | インラインコールバック内の分岐禁止         | 名前付き関数に抽出                            |
| no-leaked-render           | JSX の `&&` 条件描画禁止（Tsx のみ）       | 三項 + undefined で書く                       |
| no-as-cast                 | as キャスト禁止（as const は除く）         | 境界パーサを `*.parse.ts` / `parse/` に置く   |
| arrow-body-block           | 宣言束縛アローはブロック本体必須           | インラインコールバックは式本体可              |

suppression の書き方: 違反行の**前行**に `// ast-grep-ignore: <rule-id>` を置き、理由を添える。

### コンパイラ強制（tsconfig.base.json）

| フラグ                                                    | 効果                                                         |
| ---                                                       | ---                                                          |
| strict / noUncheckedIndexedAccess / exactOptionalPropertyTypes | 厳格な型検査（添字アクセスは undefined を含む）        |
| erasableSyntaxOnly                                        | enum / ランタイム namespace / class parameter properties を言語レベルで禁止 |
| verbatimModuleSyntax                                      | type-only import を型エラーで強制                            |
| isolatedDeclarations（ライブラリのみ）                    | exported シンボルの型明示を強制。declaration を出力するパッケージの tsconfig でのみ有効化する（アプリでは使わない。exported な Zod スキーマ定数と相性が悪い点に注意） |

## 判断が必要なルール

詳細: `.claude/rules/typescript.md` / `.claude/rules/design-policy.md` / `.claude/rules/refactoring.md`（常時適用せず `/refactor` で opt-in） / `.claude/rules/react.md`（React プロジェクトのみ）

- 5原則（データと振る舞いの分離 / 型でドメイン表現 / イミュータブル / Result / 副作用の境界化）
- discriminated union / branded type / Parse, Don't Validate（Zod + fromZod）
- 型アサーションの三分法（型注釈 = 契約 / satisfies = 検査 / as = 最終手段）
- 型で表現する範囲の線引き（数えられる状態 = DU / 形式で書ける制約 = parse / 実行時にしか判らない性質と計算違い = テスト）、文脈ごとに型を分ける、素直な型を選ぶ（条件型 / infer / 多段ジェネリクスによる導出を避ける）
- エラーは kind タグ付き DU。期待される失敗のみ Result、バグは throw
- 反復語彙の使い分け（filterMap / groupBy / fromEntries / Iterator helpers / reduce は最終手段）
- 回数不定の反復はライブラリ委譲（p-retry / p-limit）、逐次 await はアダプタ層の for-of、並列 fan-out は `Promise.all(items.map(async ...))`、再帰はデータの形に沿う場合のみ
- 局所ミューテーションの二層制（アルゴリズム的必然 = 理由コメント / 性能目的 = 計測必須）
- リファクタリングはスメル検出（5文超過 / 抽象度混在 / 共通接頭辞 / 分岐の散在 / 未使用の一般性）とレシピの適用で機械的に進める（refactoring.md。常時適用せず `/refactor` で opt-in）
- JSDoc は exported シンボルのみ必須
- 標準依存: ts-pattern / zod / p-retry / p-limit、vendored: src/result.ts / src/array.ts / src/schema.ts / src/brand.ts
