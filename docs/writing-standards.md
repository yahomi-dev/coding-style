# 文書作成の規約

文書作成の規約は、文書を書くときに守るルールの全体である。  
この文書は、その対象、配置場所、確認の方法をまとめる。  
ルールの内容は、それぞれの正本に書く。  
コードを書くときのルールは、コーディング規約 (`docs/coding-standards.md`) にまとめる。

この文書でいう「文書」とは、人が読むために書く文章の全体を指す。  
Markdown のファイル、コミットメッセージ、PR / MR の本文、コードのコメント、チャットの返答、図のラベルが対象である。

## 対象

書くものごとに、適用する規約が異なる。

| 書くもの | 用語と表記 | 改行のルール | 外向けの文書 | 設計書、ADR の書き方 |
|---|---|---|---|---|
| Markdown のファイル (`docs/`、README、CLAUDE.md、rules など。場所を問わない) | 対象 | 対象 | 対象 | `*-design.md` と `docs/adr/` だけ |
| コミットメッセージ、PR / MR の本文 | 対象 | 対象外 | 対象 | 対象外 |
| コードのコメント | 対象 | 対象外 | 対象 | 対象外 |
| チャットの返答 | 対象 | 対象外 | 対象外 | 対象外 |
| 図のラベル | 対象 | 対象外 | 対象 | 対象外 |

## 配置場所

| 種類 | 配置場所 | 読み手 | 書く内容 |
|---|---|---|---|
| 正本 | `docs/` | 人 | 規約の全文、理由、例 |
| 機械向けの要約 | `.claude/rules/` | AI | 書くときに守る要点 |
| 検査のスクリプト | `scripts/` | ツール | ツールで判定できるルール |

## 確認の方法

| 確認の方法 | 確認する内容 | 実行する時 |
|---|---|---|
| ツールで検査する | 用語の一部、括弧と矢印の表記、改行 | 検証コマンド、コミットの前 |
| レビューで確認する | ツールで判定できない内容 (構成、書く範囲、用語の選び方) | MR のレビュー |

## 規約の一覧

| 規約 | 対象 | 正本 | 機械向けの要約 | 確認の方法 |
|---|---|---|---|---|
| 文書の表記と用語 | 返答、コミットメッセージ、PR / MR、設計書、コメント、図のラベル | `docs/wording-guideline.md` | `.claude/rules/wording.md` (常時読み込み) | 言い回しの検査と改行の検査<br>そのほかはレビュー |
| 設計書の書き方 | 名前が `-design.md` で終わる Markdown | `docs/design-doc-guideline.md` | `.claude/rules/design-doc.md` (`**/*-design.md` で読み込み) | レビュー<br>書き方の機械検査は、プロジェクトで用意する |
| 外向けの文書 | コミットメッセージ、PR / MR、コミットされるファイル、リリースノート | `docs/outward-writing.md` | `.claude/rules/outward-writing.md` (常時読み込み) | レビュー<br>シークレットの検査と走査のパターンは、プロジェクトで用意する |
| ADR の書き方と運用 | `docs/adr/` の ADR | `docs/adr-guideline.md` (雛形は `docs/adr-template.md`) | `.claude/rules/adr.md` (`docs/adr/**` で読み込み) | レビュー |

## ツールによる検査

### 言い回しの検査 (scripts/wording)

文書とコメントの言い回しを検査する。  
ルールは `scripts/wording/rules.ts` の配列で、追加は要素の追加だけで完結する。  
対象は git 管理下のテキストファイルで、コードのコメントと文字列も含む。  
検証コマンド (`just verify`) と、コミットの前の検査で実行する。

| ルール ID | 内容 | 根拠 |
|---|---|---|
| no-hiku | 「引く」を、意味ごとの語 (求める、取得する、特定する、抽出する) に言い換える | `docs/wording-guideline.md` の用語 <!-- wording-ok --> |
| no-fullwidth-paren | 半角の `()` を使う | `docs/wording-guideline.md` の表記 |
| no-unicode-arrow | `->` `<-` を使う | `docs/wording-guideline.md` の表記 |

- 意図的な例外は、該当行に `wording-ok` と書く (Markdown では `<!-- wording-ok -->`)
- 検査しないパス (生成物、外部からコピーしたファイル) は、`scripts/wording/scan.ts` の `EXCLUDED_PATTERNS` に追加する

### 改行の検査 (scripts/markdown)

Markdown の改行のルール (`docs/wording-guideline.md` の「改行」) を検査する。  
`scripts/markdown/format.ts` が本文をルールに合わせて整形し、整形の前後で内容が変わるファイルを違反とする。  
対象は git 管理下の Markdown。  
検証コマンド (`just verify`) と、コミットの前の検査で実行する。

| コマンド | 内容 |
|---|---|
| `pnpm md:check` | ルールに合っていないファイルと、最初に異なる行を出力する |
| `pnpm md:format` | ルールに合わせて書き直す |

### 見直しの条件

言い回しの検査と改行の検査は、Biome が Markdown のプラグインに対応していないので、自前のスクリプトにしている。  
Biome が対応したら、2 つのスクリプトを Biome のプラグインに移すことを検討する。
