---
paths:
  - "docs/adr/**"
---

# ADR のルール (機械向けの要約)

正本は coding-style リポジトリの `docs/adr-guideline.md`、雛形は `docs/adr-template.md`。ここは `docs/adr/` を触るときに守る要点だけ。

## 書く前に

- ADR にするのは「後から なぜ が問われ、覆すコストが高く、複数の案から選んだ」決定だけ。実装の詳細、移行計画、タスク、チケット番号、抽象原則だけのものは ADR にしない
- 問い: 実現方式を別の方式に置き換えたとき書き換えが要る文は、ADR ではなく仕様かコードに置く
- 雛形を写す。節は Context / Decision / Alternatives / Consequences / 参考 の順で固定。使わない節は「無し」と書く

## 書くとき (MUST)

- 単体で読めるように書く。他の文書や会話の記憶を前提にしない
- Context は観測した事実と前提だけ。前提には「崩れたら再検討する」と書く
- Decision は能動態「〜する」、強度は MUST / SHOULD、適用範囲を書く。末尾に「決定しないこと」と委譲先 (実在するファイルか ADR 番号 + 題)
- Decision に関数名、環境変数名、列名、例外の扱いを書かない
- Alternatives を 1 つ以上書き、不採用の理由を付ける
- Consequences に悪い影響と再評価の条件を書く
- 根拠は一次資料 (計測、公式文書、コード) と照合できる形。打ち合わせの記憶だけを根拠にしない
- 参照は番号と章題で指す。行番号で指さない。ADR 同士は「ADR NNNN (題)」
- 内部限定の情報 (ローカルのメモ、個人のパス、チケット番号、エージェントやセッションの話) を書かない
- 括弧は半角 `()`、矢印は `->`、日付は YYYY-MM-DD

## ステータス (MUST)

- `status` は proposed | accepted | deprecated | superseded。未確定を残したまま accepted にしない
- accepted の後は本文 (Context / Decision / Alternatives / Consequences) を書き換えない。変えるなら新しい ADR を書き、新 ADR に `supersedes`、旧 ADR に `superseded_by` と `status: superseded`。一部の項だけが変わるときは旧 ADR を accepted のまま「追記」で置き換え先を示す
- accepted の後に足してよいのは frontmatter と末尾の「追記」(日付付きの事実) だけ
- status を変えたら `docs/adr/README.md` の一覧も直す

## 長さ (SHOULD)

- 50〜150 行。10 分で書けない大きさなら分けるか、実装の詳細を外す
