# 文書の規約

## 概要

文書の書き方は「判断が必要なルール」として扱う。  
正本は `docs/` に、機械向けの要約は `.claude/rules/` に置く。  
用語、表記、改行は、ツールが検査する。  
そのほかはレビューで確認する。

コードの規約は `docs/coding-standards.md`。

## 規約の一覧

| 規約 | 対象 | 正本 | 機械向けの要約 | 検査 |
|---|---|---|---|---|
| 文書の表記と用語 | 返答、コミットメッセージ、PR / MR、設計書、コメント、図のラベル | `docs/wording-guideline.md` | `.claude/rules/wording.md` (常時読み込み) | 一部を言い回しの検査が行う<br>そのほかはレビュー |
| 設計書の書き方 | 名前が `-design.md` で終わる Markdown | `docs/design-doc-guideline.md` | `.claude/rules/design-doc.md` (`**/*-design.md` で読み込み) | レビュー<br>書き方の機械検査は、プロジェクトで用意する |
| 外向けの文書 | コミットメッセージ、PR / MR、コミットされるファイル、リリースノート | `docs/outward-writing.md` | `.claude/rules/outward-writing.md` (常時読み込み) | レビュー<br>シークレットの検査と走査のパターンは、プロジェクトで用意する |
| ADR の書き方と運用 | `docs/adr/` の ADR | `docs/adr-guideline.md` (雛形は `docs/adr-template.md`) | `.claude/rules/adr.md` (`docs/adr/**` で読み込み) | レビュー |

## ツールによる検査

### 言い回しの検査 (scripts/wording)

文書とコメントの言い回しを検査する。  
規則は `scripts/wording/rules.ts` の配列で、追加は要素の追加だけで完結する。  
対象は git 管理下のテキストファイルで、コードのコメントと文字列も含む。  
検証コマンド (`just verify`) と、コミットの前の検査で実行する。

| 規則 ID | 内容 | 根拠 |
|---|---|---|
| no-hiku | 「引く」を、意味ごとの語 (求める、取得する、特定する、抽出する) に言い換える | `docs/wording-guideline.md` の用語 <!-- wording-ok --> |
| no-fullwidth-paren | 半角の `()` を使う | `docs/wording-guideline.md` の表記 |
| no-unicode-arrow | `->` `<-` を使う | `docs/wording-guideline.md` の表記 |

- 意図的な例外は、該当行に `wording-ok` と書く (Markdown では `<!-- wording-ok -->`)
- 検査しないパス (生成物、外部からコピーしたファイル) は、`scripts/wording/scan.ts` の `EXCLUDED_PATTERNS` に追加する

### 改行の検査 (scripts/markdown)

Markdown の改行の決まり (`docs/wording-guideline.md` の「改行」) を検査する。  
`scripts/markdown/format.ts` が本文を決まりに合わせて整形し、整形の前後で内容が変わるファイルを違反とする。  
対象は git 管理下の Markdown。  
検証コマンド (`just verify`) と、コミットの前の検査で実行する。

| コマンド | 内容 |
|---|---|
| `pnpm md:check` | 決まりに合っていないファイルと、最初に異なる行を出力する |
| `pnpm md:format` | 決まりに合わせて書き直す |
