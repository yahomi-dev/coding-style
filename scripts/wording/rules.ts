// 文書とコメントの言い回しのルール。
// 追加は配列への要素追加だけで完結する。
// 検査は scripts/wording/check.ts (just wording-check)。
// 根拠は docs/wording-guideline.md。

/**
 * 言い回しのルール 1 件
 */
export type WordingRule = {
	readonly id: string;
	// 違反の候補。
	// 行の中の出現ごとに判定する
	readonly pattern: RegExp;
	// 候補が複合語などの一部であれば違反にしない語。
	// 候補がこの語の範囲に含まれるときだけ除外する
	readonly exclude?: RegExp;
	// 何に言い換えるか
	readonly message: string;
};

/**
 * 検査するルールの一覧。
 * 記号 (全角の括弧と矢印) は、見た目で別の記号と区別しにくいので、文字そのものは書かず符号位置 (\uXXXX) で指定する。
 * 語のルール (no-hiku) は、除外の語と並べて読めるように文字で書く。
 */
export const WORDING_RULES = [
	{
		id: "no-hiku",
		pattern: /引(?:き(?:当て|ます|、)|く|い|け|か|こ)/g,
		// 複合語と、別の意味の慣用句 (風邪を引く、注意を引く など)。
		// 慣用句は 2 文字以上の語だけを登録する (目を引く のような 1 文字の語は、項目を引く などの検出を妨げるため)
		exclude:
			/差し引|割り引|割引|取り引|取引|値引|手引|間引|駆け引|長引|線を引|線引|引き継|引き直|引き出|引き渡|引き算|引き起こ|引き受け|引き返|引き下げ|引き上げ|引数|引用|風邪を引|くじを引|注意を引|興味を引|関心を引/g,
		message:
			"求める / 算出する (量)、取得する / 参照する (行や値)、特定する (キーで 1 件)、抽出する (条件で複数) に言い換える",
	},
	{
		// U+FF08 と U+FF09 (全角の丸括弧)
		id: "no-fullwidth-paren",
		pattern: /[\uFF08\uFF09]/g,
		message: "半角の () を使う",
	},
	{
		// Arrows (U+2190-21FF)、Dingbats の矢印 (U+2794-27BF)、Supplemental Arrows-A (U+27F0-27FF)、Supplemental Arrows-B (U+2900-297F)
		id: "no-unicode-arrow",
		pattern: /[\u2190-\u21FF\u2794-\u27BF\u27F0-\u27FF\u2900-\u297F]/g,
		message: "-> / <- を使う",
	},
] as const satisfies readonly WordingRule[];
