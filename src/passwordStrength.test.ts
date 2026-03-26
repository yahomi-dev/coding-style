import { describe, expect, it } from "vitest";
import type { PasswordRule, StrengthRule } from "./passwordStrength.js";
import {
	checkPasswordStrength,
	determineStrengthLevel,
	getMatchedLabels,
} from "./passwordStrength.js";

describe("getMatchedLabels", () => {
	it("正常系: すべてのルールを満たすパスワードの場合、全ルールのラベルを返す", () => {
		const rules: PasswordRule[] = [
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
					return /[0-9]/.test(pw);
				},
				label: "数字を含む",
			},
		];

		const result = getMatchedLabels("Abcdefg1", rules);

		expect(result).toStrictEqual(["8文字以上", "大文字を含む", "数字を含む"]);
	});

	it("正常系: 一部のルールのみ満たすパスワードの場合、満たしたルールのラベルだけを返す", () => {
		const rules: PasswordRule[] = [
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
		];

		const result = getMatchedLabels("abcdefgh", rules);

		expect(result).toStrictEqual(["8文字以上"]);
	});

	it("正常系: どのルールも満たさないパスワードの場合、空配列を返す", () => {
		const rules: PasswordRule[] = [
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
		];

		const result = getMatchedLabels("abc", rules);

		expect(result).toStrictEqual([]);
	});

	it("境界値: 空文字列の場合、空配列を返す", () => {
		const rules: PasswordRule[] = [
			{
				checker: (pw) => {
					return pw.length >= 8;
				},
				label: "8文字以上",
			},
		];

		const result = getMatchedLabels("", rules);

		expect(result).toStrictEqual([]);
	});

	it("境界値: ルール配列が空の場合、空配列を返す", () => {
		const result = getMatchedLabels("Abcdefg1!", []);

		expect(result).toStrictEqual([]);
	});
});

describe("determineStrengthLevel", () => {
	const strengthRules: StrengthRule[] = [
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
	];

	it("正常系: マッチ数が多い場合、strongを返す", () => {
		const result = determineStrengthLevel(5, strengthRules);

		expect(result).toBe("strong");
	});

	it("正常系: マッチ数が中程度の場合、mediumを返す", () => {
		const result = determineStrengthLevel(3, strengthRules);

		expect(result).toBe("medium");
	});

	it("正常系: マッチ数が少ない場合、weakを返す", () => {
		const result = determineStrengthLevel(1, strengthRules);

		expect(result).toBe("weak");
	});

	it("境界値: マッチ数が0の場合、weakを返す", () => {
		const result = determineStrengthLevel(0, strengthRules);

		expect(result).toBe("weak");
	});

	it("境界値: どのStrengthRuleにもマッチしない場合、weakを返す", () => {
		const result = determineStrengthLevel(10, []);

		expect(result).toBe("weak");
	});
});

describe("checkPasswordStrength", () => {
	it("正常系: 全ルールを満たす強いパスワードの場合、strongと全ラベルを返す", () => {
		const result = checkPasswordStrength("Abcdefg1!");

		expect(result.level).toBe("strong");
		expect(result.matchedLabels.length).toBeGreaterThanOrEqual(4);
	});

	it("正常系: 一部ルールを満たすパスワードの場合、mediumと該当ラベルを返す", () => {
		const result = checkPasswordStrength("abcdefgh");

		expect(result.level).toBe("medium");
		expect(result.matchedLabels.length).toBeGreaterThanOrEqual(2);
	});

	it("正常系: ほぼルールを満たさない弱いパスワードの場合、weakと該当ラベルを返す", () => {
		const result = checkPasswordStrength("abc");

		expect(result.level).toBe("weak");
	});

	it("境界値: 空文字列の場合、weakと空配列を返す", () => {
		const result = checkPasswordStrength("");

		expect(result.level).toBe("weak");
		expect(result.matchedLabels).toStrictEqual([]);
	});
});
