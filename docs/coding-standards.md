# コーディング規約

## 概要

コーディング規約は、コードを書くときに守るルールの全体である。  
ルールは、守られているかを確認する方法で 2 つに分ける。  
ツールで検査できるルールはツールに置く。  
`.claude/rules/` には、ツールで検査できない原則と判断の基準に加えて、ツールで検査するルールの根拠と例外を書く。

| 種類       | 確認の方法                             | 正本                                              |
| ---        | ---                                    | ---                                               |
| ツールで検査するルール | Biome / ast-grep / tsconfig が自動で検出する | biome.json / ast-grep/rules/ / tsconfig.base.json |
| レビューで確認するルール | 開発者と AI が読んで従い、レビューで確認する | `.claude/rules/` 配下 |

検証コマンド: `just verify`(check + scan + wording-check + md-check + comments-check + secrets-check + typecheck-scripts + test-rules + test + build)

文書作成の規約と、文書とコメントの検査(wording-check、md-check)は `docs/writing-standards.md`。  
文書の一覧と読む順番は `README.md`。

## ツールで検査するルール

### フォーマット(Biome)

| 項目       | ルール         | 設定                                           |
| ---        | ---            | ---                                            |
| インデント | タブ           | `formatter.indentStyle: "tab"`                 |
| クォート   | ダブルクォート | `javascript.formatter.quoteStyle: "double"`    |
| import整理 | 自動ソート     | `assist.actions.source.organizeImports: "on"`  |

- YAML も Biome が整形し、検査する
- Markdown は Biome の対象から外す(Biome は frontmatter を書き換える。改行のルールは `scripts/markdown` が整形する)

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
| style/noParameterAssign / style/useConst | 引数再代入禁止 / const 強制      |
| suspicious/noVar(error 指定)          | var 禁止                         |
| complexity/noForEach                    | forEach 禁止                     |

suppression の書き方: 違反行の**前行**に `// biome-ignore lint/<グループ>/<ルール>: <理由>` を置く(例: `// biome-ignore lint/style/noDefaultExport: vitest の設定は default export が必須`)。

### スタイルルール(ast-grep)

`ast-grep/rules/` が正本。  
原則として各ルールに Tsx 変種(`<rule-id>-tsx`)がある(no-leaked-render は Tsx のみ)。  
ルール自体のテストは `ast-grep/rule-tests/`(`just test-rules`)。

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

### コメントの改行(scripts/comments)

コードのコメントは 1 文 1 行で書く(`.claude/rules/code-style.md` の「コメント」)。  
`pnpm comments:check` が、1 行に複数の文があるコメントを検出する。  
対象は、行の全体がコメントの行(TypeScript、JavaScript、CSS の `//` の行、`/*` で始まる行、ブロックのコメントの中の `*` で始まる行。シェル、YAML、justfile の `#` の行)。  
`/*` で始まる行と `*` で始まる行は、`*/` の前までを本文とする(1 行で閉じるコメントも、1 文なら違反にしない)。  
ブロックのコメントの外にある `*` で始まる行(テンプレートリテラルの中など)は検査しない。  
検出するのは日本語の文(句点で区切る文)だけで、英語の文(ピリオドで区切る文)は対象にしない。  
文の途中で改行しているコメントは、機械で判定できないので、レビューで確認する。  
意図的な例外は、該当行に `wording-ok` と書く。

### シークレットの検査(scripts/secrets)

シークレットの形をした文字列が、リポジトリに入っていないかを検査する。  
ルールは `scripts/secrets/rules.ts` の配列で、追加は要素の追加だけで完結する。  
プロジェクトで使うサービスのトークンの形は、ここに追加する。  
検出した文字列そのものは出力しない。  
見本の値などの意図的な例外は、該当行に `secrets-ok` と書く。

| ルール ID                    | 検出する内容                        |
| ---                          | ---                                 |
| private-key-block            | 秘密鍵のブロック(PEM の形と PGP の形) |
| credential-assignment        | 認証情報に見える値の代入(値を引用符で囲むかは問わない) |
| connection-string-password   | 接続文字列の中のパスワード          |
| url-credentials              | URL の中の認証情報(スキームとホストの間に、ユーザ名とパスワードを書く形) |
| aws-access-key-id            | AWS のアクセスキー ID(長期のキーの `AKIA` と、一時的なキーの `ASIA`) |
| github-token                 | GitHub のトークン(`ghp_`、`gho_`、`ghu_`、`ghs_`、`ghr_`、`github_pat_`) |
| gitlab-personal-access-token | GitLab のパーソナルアクセストークン |

- 値がプレースホルダ(`${VAR}`、`$VAR`、`$(...)`、`<...>`)か、パス(`/`、`./`、`../`、`~/`)で始まるときは検出しない
- 引用符で囲まない値は、記号を含まない 8 文字以上の値が行末まで続くときだけ検出する  
  引用符の無い見本の値(`API_KEY=your-api-key-here` の形)も検出するので、見本の行には `secrets-ok` と書く
- 検査しないパスは、`scripts/secrets/scan.ts` の `EXCLUDED_PATTERNS`(`node_modules/`、`dist/`、`pnpm-lock.yaml`、`scripts/secrets/`)と、画像などのバイナリの拡張子

### `.env` の保護(.claude/settings.json と hook)

AI が dotenv のファイル(`.env` と `.env.*`。`.env.example` は対象外)を読むこと、編集することを、Claude Code の設定で拒否する。  
`.claude/settings.json` の `permissions.deny` と、PreToolUse の hook(`scripts/hooks/deny-env-access.ts`)を重ねる。  
`permissions.deny` は、よく使う名前だけを Read と Edit の対象から外す。  
名前が `.env.` で始まるファイルの全体、direnv の設定ファイル(`.envrc`)、Write などのほかのツールは、hook が拒否する。  
hook が失敗したとき(起動の失敗、タイムアウト、0 と 2 以外の終了コード)も拒否する(`.claude/settings.json` の `onFailure: "block"`)。  
判定の内容は `scripts/hooks/envAccess.ts` にあり、テストの対象になる。  
拒否できる範囲と、できない範囲は `.claude/rules/security.md` に書く。

### コンパイラ強制(tsconfig.base.json)

| フラグ                                                    | 効果                                                         |
| ---                                                       | ---                                                          |
| strict / noUncheckedIndexedAccess / exactOptionalPropertyTypes | 厳格な型検査(添字アクセスは undefined を含む)        |
| erasableSyntaxOnly                                        | enum / ランタイム namespace / class parameter properties を言語レベルで禁止 |
| verbatimModuleSyntax                                      | type-only import を型エラーで強制                            |
| isolatedDeclarations(ライブラリのみ)                    | exported シンボルの型明示を強制<br>`tsconfig.base.json` には書かず、declaration を出力するパッケージの tsconfig でのみ有効化する(このリポジトリでは `tsconfig.json`。アプリでは使わない。exported な Zod スキーマ定数と相性が悪い点に注意) |

## 開発ツール

ツールそのものは指定しない。  
プロジェクトは、次のルールを満たすツールを選ぶ。

| ルール                         | 内容                                                                                                   | このリポジトリでの実現                      |
| ---                            | ---                                                                                                    | ---                                         |
| 検証コマンドを 1 つにする      | lint、ast-grep、型検査、テストをまとめて実行するコマンドを 1 つ用意する<br>コミットの前と変更の確認にはこのコマンドを使い、個々のツールを直接実行しない | `just verify`                               |
| バージョンを 1 か所で指定する  | ランタイムとパッケージマネージャのバージョン(固定の値か、下限の範囲)を、リポジトリの 1 か所に書く     | `package.json` の `packageManager` と `engines` |
| コミットの前に検査する         | ステージしたファイルに、整形、走査、言い回しの検査、Markdown の改行の検査、コメントの改行の検査、シークレットの検査を実行する | lefthook の pre-commit (`lefthook.yml`)     |
| エディタと Git の設定をそろえる | 文字コード、改行コード、末尾の改行、行末の空白、インデントをそろえる                                   | `.editorconfig`、`.gitattributes`           |

コミットの前の検査のうち、言い回し、コメントの改行、シークレットの検査は、対象を絞る指定(glob)を持たない。  
対象のファイルは、それぞれのスクリプトの `isTarget` が判定する(検証コマンドと同じ判定になる)。  
引数のパスは、先頭の `./` などを取り除いてから判定する(`scripts/shared/path.ts`)。

### エディタの設定(EditorConfig)

`.editorconfig` は、Biome が整形しないファイル(Markdown、シェルなど)にも、文字コード、改行コード、末尾の改行、行末の空白の設定を適用する。  
エディタが従う設定であり、検証コマンドでは検査しない。

| 項目       | ルール                                                   |
| ---        | ---                                                      |
| 文字コード | UTF-8                                                    |
| 改行コード | LF                                                       |
| 末尾の改行 | 入れる                                                   |
| 行末の空白 | 削除する<br>Markdown は削除しない(行末の空白 2 つが改行を表すため) |
| インデント | タブ<br>Markdown、YAML、シェルスクリプトは空白 2 つ、justfile は空白 4 つ |

- コードの整形は Biome を正とする  
  `.editorconfig` のインデントは、`biome.json` の `formatter.indentStyle` と同じ値にする
- Biome の `formatter.useEditorconfig` は使わない(`biome.json` の設定が優先されるので、定義が 2 か所に分かれるため)

### 改行コード(.gitattributes)

`.gitattributes` の `* text=auto eol=lf` で、リポジトリと作業ツリーの改行コードを LF にそろえる。  
エディタを通らない変更にも適用される。  
画像は binary と指定する。

## レビューで確認するルール

詳細: `.claude/rules/typescript.md` / `.claude/rules/design-policy.md` / `.claude/rules/react.md`(React プロジェクトのみ)

- 5原則(データと振る舞いの分離 / 型でドメイン表現 / イミュータブル / Result / 副作用の境界化)
- discriminated union(以下 DU) / branded type / Parse, Don't Validate(Zod + fromZod)
- 型アサーションの三分法(型注釈 = 契約 / satisfies = 検査 / as = 最終手段)
- 型で表現する範囲の線引き(数えられる状態 = DU / 形式で書ける制約 = parse / 実行時にしか判らない性質 = 実行時検査と運用 / 計算違い = テストとドメインレビュー)、文脈ごとに型を分ける、素直な型を選ぶ(条件型 / infer / 多段ジェネリクスによる導出を避ける)
- エラーは kind タグ付き DU  
  期待される失敗のみ Result、バグは throw
- 反復語彙の使い分け(filterMap / groupBy / fromEntries / Iterator helpers / reduce は最終手段)
- 回数不定の反復はライブラリ委譲(p-retry / p-limit)、逐次 await はアダプタ層の for-of、並列 fan-out は `Promise.all(items.map(async ...))`、再帰はデータの形に沿う場合のみ
- 局所ミューテーションの二層制(アルゴリズム的必然 = 理由コメント / 性能目的 = 計測必須)
- JSDoc は exported シンボルのみ必須
- 標準依存: ts-pattern / zod / p-retry / p-limit、vendored(このリポジトリの `src/` からコピーして使うファイル): src/result.ts / src/array.ts / src/schema.ts / src/brand.ts
