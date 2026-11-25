// 文書とコメントの言い回しの規則。追加は配列への要素追加だけで完結する。
// 検査は scripts/wording/check.ts (just wording-check)。根拠は docs/wording-guideline.md。

/**
 * 言い回しの規則 1 件
 */
export type WordingRule = {
	readonly id: string;
	// 違反の候補。行の中の出現ごとに判定する
	readonly pattern: RegExp;
	// 候補が複合語などの一部であれば違反にしない語。候補がこの語の範囲に含まれるときだけ除外する
	readonly exclude?: RegExp;
	// 何に言い換えるか
	readonly message: string;
};

/**
 * 検査する規則の一覧 (検査する文字そのものは書かず、符号位置で指定する)
 */
export const WORDING_RULES = [
	{
		id: "no-hiku",
		pattern: /引(?:き当て|く|い|け|か)/g,
		exclude:
			/差し引|割り引|線を引|引き継|引き直|引き出|引き渡|引き算|引き起こ|引き受け|引き返|引数|引用|取引|長引|引き下げ|引き上げ/g,
		message:
			"求める / 算出する (量)、取得する / 参照する (行や値)、特定する (キーで 1 件)、抽出する (条件で複数) に言い換える",
	},
	{
		id: "no-fullwidth-paren",
		pattern: /[（）]/g,
		message: "半角の () を使う",
	},
	{
		// Arrows / Supplemental Arrows-A / Supplemental Arrows-B
		id: "no-unicode-arrow",
		pattern: /[←-⇿⟰-⟿⤀-⥿]/g,
		message: "-> / <- を使う",
	},
] as const satisfies readonly WordingRule[];
