# コーディング規約

## 概要

ルールは「ツール強制」と「判断が必要」の2層で管理する。静的検査可能なルールはプロンプト(.claude/rules/)ではなくツールに置き、.claude/rules/ には原則と判断ルールだけを残す。

| 種類       | 強制方法                               | 正本                                              |
| ---        | ---                                    | ---                                               |
| ツール強制 | Biome / ast-grep / tsconfig / 言い回しの検査が自動検出 | biome.json / ast-grep/rules/ / tsconfig.base.json / scripts/wording/rules.ts |
| 判断が必要 | 開発者・AI が判断して遵守              | `.claude/rules/` 配下                             |

検証コマンド: `just verify`(check + scan + wording-check + typecheck-scripts + test-rules + test + build)

## ツール強制ルール

### フォーマット(Biome)

| 項目       | ルール         | 設定                                           |
| ---        | ---            | ---                                            |
| インデント | タブ           | `formatter.indentStyle: "tab"`                 |
| クォート   | ダブルクォート | `javascript.formatter.quoteStyle: "double"`    |
| import整理 | 自動ソート     | `assist.actions.source.organizeImports: "on"`  |

### Lint(Biome)

`preset: recommended` に加えて明示有効化しているもの:

| ルール                                  | 内容                             |
| ---                                     | ---                              |
| style/noDefaultExport                   | default export 禁止              |
| style/useConsistentTypeDefinitions      | type に統一(interface 禁止)    |
| style/useBlockStatements                | if 等のブロック必須              |
| style/noNonNullAssertion                | 非 null アサーション `!` 禁止    |
| style/useImportType                     | type-only import の強制          |
| style/noNestedTernary                   | ネストした三項演算子の禁止       |
| style/noEnum / style/noNamespace        | enum / namespace 禁止            |
| style/noParameterAssign / style/useConst| 引数再代入禁止 / const 強制      |
| suspicious/noVar(error 指定)          | var 禁止                         |
| complexity/noForEach                    | forEach 禁止                     |

### スタイルルール(ast-grep)

`ast-grep/rules/` が正本。原則として各ルールに Tsx 変種(`<rule-id>-tsx`)がある(no-leaked-render は Tsx のみ)。ルール自体のテストは `ast-grep/rule-tests/`(`just test-rules`)。

| ルール ID                  | 内容                                       | 正当な逃し方                                  |
| ---                        | ---                                        | ---                                           |
| no-let                     | let 禁止(const のみ)                     | アダプタ層(`**/adapters/**` / `*.adapter.ts`)は対象外 |
| no-loops                   | for / for-in / do-while 禁止               | -                                             |
| no-for-of-outside-adapter  | for-of はアダプタ層の逐次 await のみ       | `**/adapters/**` / `*.adapter.ts` に置く      |
| no-while-outside-adapter   | while はアダプタ層のみ                     | `**/adapters/**` / `*.adapter.ts` に置く      |
| no-function-keyword        | function 構文・ジェネレータ・メソッド禁止  | -                                             |
| no-class                   | class 禁止                                 | フレームワーク強制時は suppression            |
| no-null                    | null 禁止(`=== null` 等の比較は許可)     | ライブラリ契約(useRef 等)は suppression     |
| no-enum                    | enum 禁止                                  | -                                             |
| no-switch                  | switch 禁止(ts-pattern を使う)           | -                                             |
| no-else-if                 | else if 禁止(早期 return)                | -                                             |
| no-ternary-statement       | 三項演算子を文として使うこと禁止           | -                                             |
| no-short-circuit-statement | `&&` / `\|\|` を文として使うこと禁止       | -                                             |
| no-array-mutation          | 破壊的メソッド禁止                         | 局所ミューテーション例外は suppression        |
| no-object-assign-mutation  | Object.assign の第一引数変更禁止           | -                                             |
| no-member-mutation         | プロパティ代入 / delete 禁止               | アダプタ層は対象外、`/Ref$/` の `.current` 書き込み(= / += / ++)は除外、例外は suppression |
| no-branching-in-callback   | インラインコールバック内の分岐禁止         | 名前付き関数に抽出                            |
| no-leaked-render           | JSX の `&&` 条件描画禁止(Tsx のみ)       | 三項 + undefined で書く                       |
| no-as-cast                 | as キャスト禁止(as const は除く)         | 境界パーサを `*.parse.ts` / `parse/` に置く   |
| arrow-body-block           | 宣言束縛アローはブロック本体必須           | インラインコールバックは式本体可              |
| no-to-equal                | `toEqual` 禁止(`toStrictEqual` を使う)   | -                                             |

suppression の書き方: 違反行の**前行**に `// ast-grep-ignore: <rule-id>` を置き、理由を添える。

### 言い回しの検査(scripts/wording)

文書とコメントの言い回しを検査する。規則は `scripts/wording/rules.ts` の配列で、追加は要素の追加だけで完結する。対象は git 管理下のテキストファイル。検査しないパス(生成物、外部からコピーしたファイル)は、`scripts/wording/scan.ts` の `EXCLUDED_PATTERNS` に追加する。

| 規則 ID            | 内容                                                         | 根拠                                |
| ---                | ---                                                          | ---                                 |
| no-hiku            | 「引く」を、意味ごとの語(求める、取得する、特定する、抽出する)に言い換える | `docs/wording-guideline.md` の用語 <!-- wording-ok --> |
| no-fullwidth-paren | 半角の `()` を使う(コメント、文字列、文書も含む)           | `docs/wording-guideline.md` の表記  |
| no-unicode-arrow   | `->` `<-` を使う                                             | `docs/wording-guideline.md` の表記  |

意図的な例外は、該当行に `wording-ok` と書く(Markdown では `<!-- wording-ok -->`)。

### コンパイラ強制(tsconfig.base.json)

| フラグ                                                    | 効果                                                         |
| ---                                                       | ---                                                          |
| strict / noUncheckedIndexedAccess / exactOptionalPropertyTypes | 厳格な型検査(添字アクセスは undefined を含む)        |
| erasableSyntaxOnly                                        | enum / ランタイム namespace / class parameter properties を言語レベルで禁止 |
| verbatimModuleSyntax                                      | type-only import を型エラーで強制                            |
| isolatedDeclarations(ライブラリのみ)                    | exported シンボルの型明示を強制。declaration を出力するパッケージの tsconfig でのみ有効化する(アプリでは使わない。exported な Zod スキーマ定数と相性が悪い点に注意) |

## 開発ツール

ツールそのものは指定しない。プロジェクトは、次の決まりを満たすツールを選ぶ。

| 決まり                         | 内容                                                                                                   | このリポジトリでの実現                      |
| ---                            | ---                                                                                                    | ---                                         |
| 検証コマンドを 1 つにする      | lint、ast-grep、型検査、テストをまとめて実行するコマンドを 1 つ用意する。コミットの前と変更の確認にはこのコマンドを使い、個々のツールを直接実行しない | `just verify`                               |
| バージョンを 1 か所で固定する  | ランタイムとパッケージマネージャのバージョンを、リポジトリの 1 か所に書く                              | `package.json` の `packageManager` と `engines` |
| コミットの前に検査する         | ステージしたファイルに、整形、走査、言い回しの検査を実行する                                           | lefthook の pre-commit (`lefthook.yml`)     |
| エディタと Git の設定をそろえる | 文字コード、改行コード、末尾の改行、行末の空白、インデントをそろえる                                   | `.editorconfig`、`.gitattributes`           |

### エディタの設定(EditorConfig)

`.editorconfig` は、Biome が整形しないファイル(Markdown、YAML、シェルなど)にも、文字コード、改行コード、末尾の改行、行末の空白の設定を適用する。エディタが従う設定であり、検証コマンドでは検査しない。

| 項目       | ルール                                                   |
| ---        | ---                                                      |
| 文字コード | UTF-8                                                    |
| 改行コード | LF                                                       |
| 末尾の改行 | 入れる                                                   |
| 行末の空白 | 削除する。Markdown は削除しない(行末の空白 2 つが改行を表すため) |
| インデント | タブ。Markdown、YAML、シェルスクリプトは空白 2 つ、justfile は空白 4 つ |

- コードの整形は Biome を正とする。`.editorconfig` のインデントは、`biome.json` の `formatter.indentStyle` と同じ値にする
- Biome の `formatter.useEditorconfig` は使わない(`biome.json` の設定が優先されるので、定義が 2 か所に分かれるため)

### 改行コード(.gitattributes)

`.gitattributes` の `* text=auto eol=lf` で、リポジトリと作業ツリーの改行コードを LF にそろえる。エディタを通らない変更にも適用される。画像は binary と指定する。

## 判断が必要なルール

詳細: `.claude/rules/typescript.md` / `.claude/rules/design-policy.md` / `.claude/rules/react.md`(React プロジェクトのみ)

- 5原則(データと振る舞いの分離 / 型でドメイン表現 / イミュータブル / Result / 副作用の境界化)
- discriminated union / branded type / Parse, Don't Validate(Zod + fromZod)
- 型アサーションの三分法(型注釈 = 契約 / satisfies = 検査 / as = 最終手段)
- 型で表現する範囲の線引き(数えられる状態 = DU / 形式で書ける制約 = parse / 実行時にしか判らない性質と計算違い = テスト)、文脈ごとに型を分ける、素直な型を選ぶ(条件型 / infer / 多段ジェネリクスによる導出を避ける)
- エラーは kind タグ付き DU。期待される失敗のみ Result、バグは throw
- 反復語彙の使い分け(filterMap / groupBy / fromEntries / Iterator helpers / reduce は最終手段)
- 回数不定の反復はライブラリ委譲(p-retry / p-limit)、逐次 await はアダプタ層の for-of、並列 fan-out は `Promise.all(items.map(async ...))`、再帰はデータの形に沿う場合のみ
- 局所ミューテーションの二層制(アルゴリズム的必然 = 理由コメント / 性能目的 = 計測必須)
- JSDoc は exported シンボルのみ必須
- 標準依存: ts-pattern / zod / p-retry / p-limit、vendored: src/result.ts / src/array.ts / src/schema.ts / src/brand.ts

## 文書の規約

文書の書き方も「判断が必要なルール」として扱う。正本は `docs/` に、機械向けの要約は `.claude/rules/` に置く。用語と表記の一部は `scripts/wording` が検査する(上の「言い回しの検査」)。そのほかはレビューで確認する。

| 規約               | 対象                                                                 | 正本                                                     | 機械向けの要約                                               | 強制レイヤ      |
| ---                | ---                                                                  | ---                                                      | ---                                                          | ---             |
| 文書の表記と用語   | 返答、コミットメッセージ、PR / MR、設計書、コメント、図のラベル      | `docs/wording-guideline.md`                              | `.claude/rules/wording.md` (常時読み込み)                    | 一部を `scripts/wording` が検査。そのほかはレビュー |
| 設計書の書き方     | 名前が `-design.md` で終わる Markdown                                | `docs/design-doc-guideline.md`                           | `.claude/rules/design-doc.md` (`**/*-design.md` で読み込み)  | なし (レビュー)。書き方の機械検査は、プロジェクトで用意する |
| 外向けの文書       | コミットメッセージ、PR / MR、コミットされるファイル、リリースノート  | `docs/outward-writing.md`                                | `.claude/rules/outward-writing.md` (常時読み込み)            | なし (レビュー)。シークレットの検査と走査のパターンは、プロジェクトで用意する |
| ADR の書き方と運用 | `docs/adr/` の ADR                                                   | `docs/adr-guideline.md` (雛形は `docs/adr-template.md`)  | `.claude/rules/adr.md` (`docs/adr/**` で読み込み)            | なし (レビュー) |
