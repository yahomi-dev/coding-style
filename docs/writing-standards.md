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

表の「改行のルール」は、Markdown の改行のルール (`docs/wording-guideline.md` の「改行」) を指す。  
コードのコメントには、別のルールがある。  
コメントは 1 文 1 行で書く (`.claude/rules/code-style.md` の「コメント」)。  
検査は `pnpm comments:check` が行う (`docs/coding-standards.md` の「コメントの改行」)。

## 配置場所

次の表は、文書作成の規約の配置場所である。  
コーディング規約には当てはまらない。  
コーディング規約は、レビューで確認するルールの正本を `.claude/rules/` に置く (`docs/coding-standards.md` の「概要」)。

| 種類 | 配置場所 | 読み手 | 書く内容 |
|---|---|---|---|
| 正本 | `docs/` | 人 | 規約の全文、理由、例 |
| 機械向けの要約 | `.claude/rules/` | AI | 書くときに守る要点 |
| 検査のスクリプト | `scripts/` | ツール | ツールで判定できるルール |

正本を変更するときは、同じ変更で、機械向けの要約も修正する。  
AI は要約だけを読むので、要約に無い内容は AI に届かない。  
レビューでは、正本と要約の両方が修正されているかを確認する。

## 確認の方法

| 確認の方法 | 確認する内容 | 実行する時 |
|---|---|---|
| ツールで検査する | 用語の一部、括弧と矢印の表記、Markdown の改行、コメントの改行、シークレットの形をした文字列 | 検証コマンド、コミットの前 |
| レビューで確認する | ツールで判定できない内容 (構成、書く範囲、用語の選び方) | MR のレビュー |

## 規約の一覧

| 規約 | 対象 | 正本 | 機械向けの要約 | 確認の方法 |
|---|---|---|---|---|
| 文書の表記と用語 | 返答、コミットメッセージ、PR / MR、設計書、ADR、コメント、図のラベル | `docs/wording-guideline.md` | `.claude/rules/wording.md` (常時読み込み) | 言い回しの検査と改行の検査<br>そのほかはレビュー |
| 設計書の書き方 | 名前が `-design.md` で終わる Markdown | `docs/design-doc-guideline.md` | `.claude/rules/design-doc.md` (`**/*-design.md` で読み込み) | レビュー<br>書き方の機械検査は、プロジェクトで用意する |
| 外向けの文書 | コミットメッセージ、PR / MR、コミットされるファイル、リリースノート | `docs/outward-writing.md` | `.claude/rules/outward-writing.md` (常時読み込み) | レビュー<br>シークレットの形をした文字列は、シークレットの検査が検出する<br>プロジェクトに固有のパスやラベルを走査する検索のパターンは、プロジェクトで用意する |
| ADR の書き方と運用 | `docs/adr/` の ADR | `docs/adr-guideline.md` (雛形は `docs/adr-template.md`) | `.claude/rules/adr.md` (`docs/adr/**` で読み込み) | レビュー |

## ツールによる検査

文書の検査は、言い回しの検査と改行の検査の 2 つである。  
コードのコメントの改行の検査 (`pnpm comments:check`) と、シークレットの検査 (`pnpm secrets:check`) は、`docs/coding-standards.md` に書く。

### 言い回しの検査 (scripts/wording)

文書とコメントの言い回しを検査する。  
ルールは `scripts/wording/rules.ts` の配列で、追加は要素の追加だけで完結する。  
対象は、git 管理下のファイルのうち、`scripts/wording/scan.ts` の `TARGET_PATTERN` の拡張子に一致するもの (Markdown、Mermaid、TypeScript、JavaScript、CSS、JSON、YAML、シェル、justfile) で、コードのコメントと文字列も含む。  
HTML と、拡張子の無い設定ファイルは対象にしない。  
検証コマンド (`just verify`) と、コミットの前の検査で実行する。

| ルール ID | 内容 | 根拠 |
|---|---|---|
| no-hiku | 「引く」を、意味ごとの語 (求める、取得する、特定する、抽出する) に言い換える | `docs/wording-guideline.md` の用語 <!-- wording-ok --> |
| no-fullwidth-paren | 半角の `()` を使う | `docs/wording-guideline.md` の表記 |
| no-unicode-arrow | Unicode の矢印 (Arrows、Dingbats の矢印、Supplemental Arrows-A、Supplemental Arrows-B) を使わず、`->` `<-` を使う | `docs/wording-guideline.md` の表記 |

- no-hiku が検出するのは、取得や算出の意味で使う活用の形だけである  
  複合語 (割引、引数など) と、別の意味の慣用句 (注意を引く など) は、`scripts/wording/rules.ts` の除外の語に登録する <!-- wording-ok -->
- 意図的な例外は、該当行に `wording-ok` と書く (Markdown では `<!-- wording-ok -->`)
- 検査しないパス (生成物、外部からコピーしたファイル) は、`scripts/wording/scan.ts` の `EXCLUDED_PATTERNS` に追加する  
  このリポジトリでは、`node_modules/`、`dist/`、`pnpm-lock.yaml` と、検査する語そのものを含むファイル (`scripts/wording/`、`docs/wording-guideline.md`、`.claude/rules/wording.md`) を登録している

### 改行の検査 (scripts/markdown)

Markdown の改行のルール (`docs/wording-guideline.md` の「改行」) を検査する。  
`scripts/markdown/format.ts` が本文をルールに合わせて整形し、整形の前後で内容が変わるファイルを違反とする。  
対象は git 管理下の Markdown。  
検証コマンド (`just verify`) と、コミットの前の検査で実行する。

| コマンド | 内容 |
|---|---|
| `pnpm md:check` | ルールに合っていないファイルと、最初に異なる行を出力する |
| `pnpm md:format` | ルールに合わせて書き直す |

整形は、別の要素に変わるおそれがある行を変更しない。  
変更しない範囲は、`pnpm md:check` も検出しないので、レビューで確認する。

- 変更しない範囲
  - コードブロック (閉じていないものを含む)、frontmatter (`---` で囲む形だけ)、HTML のコメント
  - HTML のタグで始まる行から、次の空行まで
  - 先頭のパイプが無い表と、表の行の直後に続く行 (先頭にパイプがある表のセルは整形する)
  - 下線の形の見出し (次の行が `===` か `---` の行)
  - 内容が別の要素 (見出し、箇条書き、コードブロックなど) で始まる項目と、整形すると別の要素になる行
- 行ごとに判定する範囲
  - 複数行にまたがるインラインコード、強調、リンク
  - 引用の段落の続きで、引用の記号が無い行 (引用の外の段落として整形する)
- 句点の扱い
  - ASCII の二重引用符の中の句点では、文を分ける (括弧、かぎ括弧、インラインコードの中の句点では分けない)
  - 句点の直後の強調の記号は、その記号が行の先頭から数えて奇数回目で、後ろが空白か行末のときだけ、閉じの記号として前の文に含める  
    それ以外のときは、その句点では分けない

### 見直しの条件

言い回しの検査と改行の検査は、Biome が Markdown のプラグインに対応していないので、自前のスクリプトにしている。  
Biome が対応したら、2 つのスクリプトを Biome のプラグインに移すことを検討する。
