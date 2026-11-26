import { describe, expect, test } from "vitest";
import { SECRET_RULES } from "./rules.ts";
import { findSecrets, formatFinding, isTarget } from "./scan.ts";

const idsOf = (line: string): readonly string[] => {
	return findSecrets("a.ts", line, SECRET_RULES).map(
		(finding) => finding.ruleId,
	);
};

describe("SECRET_RULES", () => {
	test.each([
		["-----BEGIN RSA PRIVATE KEY-----", "private-key-block"],
		["-----BEGIN PRIVATE KEY-----", "private-key-block"],
		['const apiKey = "abcdefgh12345678";', "credential-assignment"],
		["password: 'abcdefgh12345678'", "credential-assignment"],
		["Server=db;Password=abcdefgh1234;", "connection-string-password"],
		["AKIAIOSFODNN7EXAMPLE", "aws-access-key-id"],
		["glpat-abcdefghijklmnopqrst", "gitlab-personal-access-token"],
	])("シークレットの形を検出する: %s", (line, ruleId) => {
		expect(idsOf(line)).toStrictEqual([ruleId]);
	});

	test.each([
		"const apiKey = process.env.API_KEY;",
		'const password = "";',
		'const label = "password";',
		"-----BEGIN PUBLIC KEY-----",
		"パスワードは 8 文字以上にする",
	])("シークレットではない行は検出しない: %s", (line) => {
		expect(idsOf(line)).toStrictEqual([]);
	});
});

describe("findSecrets", () => {
	test("行番号は 1 始まりで、検出した文字列そのものは結果に含めない", () => {
		const text = ["const a = 1;", "AKIAIOSFODNN7EXAMPLE"].join("\n");

		expect(findSecrets("src/a.ts", text, SECRET_RULES)).toStrictEqual([
			{
				path: "src/a.ts",
				line: 2,
				ruleId: "aws-access-key-id",
				label: "AWS のアクセスキー ID",
			},
		]);
	});

	test("secrets-ok と書いた行は検査しない", () => {
		expect(idsOf("AKIAIOSFODNN7EXAMPLE // secrets-ok")).toStrictEqual([]);
	});
});

describe("formatFinding", () => {
	test("パス、行、ルール、内容を 1 行にする", () => {
		expect(
			formatFinding({
				path: "src/a.ts",
				line: 2,
				ruleId: "aws-access-key-id",
				label: "AWS のアクセスキー ID",
			}),
		).toBe("src/a.ts:2: [aws-access-key-id] AWS のアクセスキー ID");
	});
});

describe("isTarget", () => {
	test.each(["src/a.ts", ".env.example", "README.md", "justfile"])(
		"対象: %s",
		(path) => {
			expect(isTarget(path)).toBe(true);
		},
	);

	test.each([
		"docs/a.png",
		"pnpm-lock.yaml",
		"node_modules/x/a.ts",
		"packages/x/dist/a.js",
		"scripts/secrets/rules.ts",
	])("対象外: %s", (path) => {
		expect(isTarget(path)).toBe(false);
	});
});
