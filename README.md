# coding-style

TypeScript のコーディング規約と、文書作成の規約をまとめたリポジトリである。  
規約の文書、ツールで検査するルールの設定、検査のスクリプト、プロジェクトへコピーして使うユーティリティを置く。

リポジトリ: https://github.com/yahomi-dev/coding-style

## 読む順番

1. `docs/coding-standards.md`  
   コーディング規約の全体と、ツールで検査するルールの一覧
2. `docs/writing-standards.md`  
   文書作成の規約の全体と、文書の検査
3. `docs/harness-engineering.md`  
   AI エージェントにルールを適用する仕組みの使い分けと、ルールと値の分類
4. 書くものに合わせて、下の一覧から個別の文書を読む

## 文書の一覧

### 全体をまとめる文書

| 文書 | 内容 |
|---|---|
| `docs/coding-standards.md` | コーディング規約の全体<br>ツールで検査するルール、開発ツール、レビューで確認するルールの要点 |
| `docs/writing-standards.md` | 文書作成の規約の全体<br>対象、配置場所、確認の方法、文書の検査 |
| `docs/harness-engineering.md` | Claude Code のコンポーネントの使い分け<br>ルールと値の分類 (変更の権限)、外部仕様の一覧 |

### コーディング規約

正本は `.claude/rules/` にある。  
AI が読み、開発者も同じ文書を読む。

| 文書 | 内容 | AI が読み込む時 |
|---|---|---|
| `.claude/rules/typescript.md` | TypeScript のルール (関数型 × データ指向)<br>判断の順、型、エラー処理、反復処理 | 常時 |
| `.claude/rules/design-policy.md` | 関数の設計、副作用の分離、テスト戦略 | 常時 |
| `.claude/rules/code-style.md` | 命名、コメント、検査の方法 | 常時 |
| `.claude/rules/security.md` | シークレット、実データ、入力の検証<br>AI が dotenv のファイルを読まないための仕組み | 常時 |
| `.claude/rules/react.md` | React のルール (typescript.md への追加と緩和) | 常時 |
| `.claude/rules/responsive.md` | CSS のレスポンシブのルール | 常時 |
| `.claude/rules/change-authority.md` | ルールと値の分類 (`docs/harness-engineering.md` の要約) | 常時 |

### 文書作成の規約

正本は `docs/` にあり、`.claude/rules/` には機械向けの要約を置く。

| 規約 | 正本 | 機械向けの要約 | AI が読み込む時 |
|---|---|---|---|
| 文書の表記と用語 | `docs/wording-guideline.md` | `.claude/rules/wording.md` | 常時 |
| 外向けの文書 | `docs/outward-writing.md` | `.claude/rules/outward-writing.md` | 常時 |
| 設計書の書き方 | `docs/design-doc-guideline.md` | `.claude/rules/design-doc.md` | `*-design.md` を扱う時 |
| ADR の書き方と運用 | `docs/adr-guideline.md`<br>雛形は `docs/adr-template.md` | `.claude/rules/adr.md` | `docs/adr/` を扱う時 |

## ディレクトリ

| 場所 | 内容 |
|---|---|
| `docs/` | 規約の文書 |
| `.claude/rules/` | AI が読むルール |
| `.claude/settings.json` | AI が dotenv のファイルを読むことを拒否する設定 (`permissions.deny` と hook) |
| `biome.json` | 整形と lint の設定 |
| `ast-grep/` | スタイルルール (`rules/`) と、ルールのテスト (`rule-tests/`)<br>設定は `sgconfig.yml` |
| `tsconfig.base.json` | コンパイラの設定の共通の部分 |
| `scripts/` | 検査のスクリプト (言い回し、Markdown の改行、コメントの改行、シークレット) と hook |
| `src/` | プロジェクトへコピーして使うユーティリティ (`result.ts`、`array.ts`、`schema.ts`、`brand.ts`) と、ルールに沿った実装の例 |

## プロジェクトへの導入

規約を導入するプロジェクトへ、次のファイルをコピーする。

| コピーするもの | 補足 |
|---|---|
| `.claude/rules/` | React を使わないプロジェクトでは、`react.md` は不要 |
| `docs/` の規約の文書 | `.claude/rules/` の要約が、正本として参照する |
| `biome.json`、`ast-grep/`、`sgconfig.yml`、`tsconfig.base.json` | プロジェクトの tsconfig は `tsconfig.base.json` を extends する |
| `scripts/` | 検査のスクリプトは `scripts/shared/` を読み込むので、一緒にコピーする<br>実行するコマンドは `package.json` の `scripts` を参照する |
| `.claude/settings.json` | hook は `scripts/hooks/deny-env-access.ts` を実行する |
| `.editorconfig`、`.gitattributes`、`lefthook.yml` | コミットの前の検査は `lefthook.yml` が実行する |
| `src/` の `result.ts`、`array.ts`、`schema.ts`、`brand.ts` | `.claude/rules/typescript.md` の「標準依存」 |

- 検査しないパス (言い回しの検査、シークレットの検査) は、プロジェクトの構成に合わせて各 `scan.ts` の `EXCLUDED_PATTERNS` を修正する
- 規約「ルールと値の分類 (変更の権限)」を採用するかは、プロジェクトごとに確認する (`.claude/rules/change-authority.md` の「採用の確認 (最初に読む)」)
- プロジェクトで決めるものは、次の文書に書いてある
  - 用語集: `docs/wording-guideline.md` の「プロジェクトで決めること」
  - 外部仕様の一覧: `docs/harness-engineering.md` の「外部仕様の一覧」
  - 認証情報のファイルを拒否する設定など、「プロジェクトで用意する」と書いた仕組み: `.claude/rules/security.md`

## 検証

Node.js 26 以上、pnpm、just を使う (バージョンは `package.json` の `engines` と `packageManager`)。

```sh
pnpm install
just verify
```

`just verify` は、整形と lint、ast-grep、文書とコメントの検査、シークレットの検査、型検査、テスト、ビルドをまとめて実行する。  
内訳は `docs/coding-standards.md` の「概要」に書く。
