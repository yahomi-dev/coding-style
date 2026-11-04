---
status: proposed
date: YYYY-MM-DD
# supersedes: [NNNN]
# superseded_by: NNNN
# review_by: YYYY-MM
# confidence: medium
---

# 決定の内容が分かる題

## Context

決定が必要になった事実を中立に書く。このプロジェクトで実際に起きている問題、制約、計測値。

前提:

- 前提 1 (崩れたら再検討する)
- 前提 2

## Decision

何をするかを能動態で書く。強度は MUST / SHOULD で示す。

1. 〜する (MUST)
2. 〜する (SHOULD)

適用範囲: どのリポジトリ、どの層、どの期間に効くか。

決定しないこと:

- 〜は決めない。委譲先: `path/to/file` か ADR NNNN (題)

## Alternatives

- 案 A: 内容。採らなかった理由
- 案 B: 内容。採らなかった理由

## Consequences

- 良い影響:
- 悪い影響と生じる負債:
- 中立な影響:
- 再評価の条件: いつ、何が起きたら見直すか

## 参考

- リポジトリ内の実在物 (ファイル、ADR NNNN (題))
- 外部の一次資料 (URL、YYYY-MM-DD 確認)

<!-- accepted の後は本文を書き換えず、下の「追記」に日付付きで事実だけを足す -->
<!--
## 追記

- YYYY-MM-DD: 再評価の結果、前提の変化、置き換え先
-->
