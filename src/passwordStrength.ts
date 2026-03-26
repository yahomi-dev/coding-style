/**
 * パスワードの判定関数
 */
type PasswordChecker = (password: string) => boolean;

/**
 * パスワードの個別ルール定義
 */
type PasswordRule = {
	checker: PasswordChecker;
	label: string;
};

/**
 * 強度ラベル
 */
type StrengthLevel = "weak" | "medium" | "strong";

/**
 * 強度レベルの判定関数
 */
type StrengthChecker = (matchCount: number) => boolean;

/**
 * 強度レベルの定義
 */
type StrengthRule = {
	checker: StrengthChecker;
	level: StrengthLevel;
};

/**
 * パスワード強度判定の結果
 */
type PasswordStrengthResult = {
	level: StrengthLevel;
	matchedLabels: string[];
};

/**
 * パスワードルール定義
 */
const passwordRules = [
	{
		checker: (pw) => {
			return pw.length >= 8;
		},
		label: "8文字以上",
	},

	{
		checker: (pw) => {
			return /[A-Z]/.test(pw);
		},
		label: "大文字を含む",
	},

	{
		checker: (pw) => {
			return /[a-z]/.test(pw);
		},
		label: "小文字を含む",
	},

	{
		checker: (pw) => {
			return /[0-9]/.test(pw);
		},
		label: "数字を含む",
	},

	{
		checker: (pw) => {
			return /[^A-Za-z0-9]/.test(pw);
		},
		label: "記号を含む",
	},
] as const satisfies readonly PasswordRule[];

/**
 * 強度レベル定義
 */
const strengthRules = [
	{
		checker: (count) => {
			return count >= 4;
		},
		level: "strong",
	},

	{
		checker: (count) => {
			return count >= 2;
		},
		level: "medium",
	},
] as const satisfies readonly StrengthRule[];

/**
 * パスワードが満たしたルールのラベル一覧を返す
 */
export const getMatchedLabels = (
	password: string,
	rules: readonly PasswordRule[],
): string[] => {
	return rules
		.filter((rule) => {
			return rule.checker(password);
		})
		.map((rule) => {
			return rule.label;
		});
};

/**
 * マッチ数から強度レベルを判定する
 */
export const determineStrengthLevel = (
	matchCount: number,
	rules: readonly StrengthRule[],
): StrengthLevel => {
	const matched = rules.filter((rule) => {
		return rule.checker(matchCount);
	});

	const first = matched[0];

	if (first === undefined) {
		return "weak";
	}

	return first.level;
};

/**
 * パスワードの強度を判定する
 */
export const checkPasswordStrength = (
	password: string,
): PasswordStrengthResult => {
	const matchedLabels = getMatchedLabels(password, passwordRules);
	const level = determineStrengthLevel(matchedLabels.length, strengthRules);

	return { level, matchedLabels };
};

export type {
	PasswordChecker,
	PasswordRule,
	PasswordStrengthResult,
	StrengthChecker,
	StrengthLevel,
	StrengthRule,
};
