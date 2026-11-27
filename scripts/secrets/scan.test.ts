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
		["password: hunter2hunter2", "credential-assignment"],
		["password: hunter2hunter2 # 開発用", "credential-assignment"],
		["API_KEY=abcdef1234567890", "credential-assignment"],
		["export API_KEY=abcdef1234567890", "credential-assignment"],
		[
			"aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
			"credential-assignment",
		],
	])("引用符で囲まない値を検出する: %s", (line, ruleId) => {
		expect(idsOf(line)).toStrictEqual([ruleId]);
	});

	test.each([
		[
			"DATABASE_URL=postgres://admin:S3cretPassw0rd@db.example.com/app",
			"url-credentials",
		],
		["redis://:S3cretPassw0rd@localhost:6379", "url-credentials"],
		["-----BEGIN PGP PRIVATE KEY BLOCK-----", "private-key-block"],
		["-----BEGIN OPENSSH PRIVATE KEY-----", "private-key-block"],
		["ASIAIOSFODNN7EXAMPLE", "aws-access-key-id"],
		[`ghp_${"0".repeat(36)}`, "github-token"],
		[`gho_${"0".repeat(36)}`, "github-token"],
		[`ghu_${"0".repeat(36)}`, "github-token"],
		[`ghs_${"0".repeat(36)}`, "github-token"],
		[`ghr_${"0".repeat(36)}`, "github-token"],
		[`github_pat_${"0".repeat(40)}`, "github-token"],
	])(
		"URL の中の認証情報、PGP の秘密鍵、トークンを検出する: %s",
		(line, ruleId) => {
			expect(idsOf(line)).toStrictEqual([ruleId]);
		},
	);

	test.each([
		"const apiKey = process.env.API_KEY;",
		'const password = "";',
		'const label = "password";',
		"-----BEGIN PUBLIC KEY-----",
		"-----BEGIN PGP PUBLIC KEY BLOCK-----",
		"パスワードは 8 文字以上にする",
	])("シークレットではない行は検出しない: %s", (line) => {
		expect(idsOf(line)).toStrictEqual([]);
	});

	// biome-ignore-start lint/suspicious/noTemplateCurlyInString: 入力は、設定のファイルに書くプレースホルダの文字列そのもの
	test.each([
		'password: "${POSTGRES_PASSWORD}"',
		"password: ${POSTGRES_PASSWORD}",
		"password: $POSTGRES_PASSWORD",
		"password: ${{ secrets.DB_PASSWORD }}",
		"password: <your-password>",
		'api_key: "<api-key>"',
		"password: ''",
		'password: ""',
		"API_KEY=",
		"DB_PASSWORD=${DB_PASSWORD}",
		"PASSWORD=$(cat secret.txt)",
		"postgres://user:${PASSWORD}@db.example.com/app",
		"postgres://user:$PASSWORD@db.example.com/app",
		"postgres://user:<password>@db.example.com/app",
		"const url = `postgres://${user}:${password}@${host}/app`;",
	])("値がプレースホルダなら検出しない: %s", (line) => {
		expect(idsOf(line)).toStrictEqual([]);
	});
	// biome-ignore-end lint/suspicious/noTemplateCurlyInString: プレースホルダの入力はここまで

	test.each([
		'"pwd": "/home/user/project"',
		"pwd: /home/user/project",
		"PWD=/home/user/project",
		'password: "./secrets/db.txt"',
		"password = ~/secrets/db.txt",
		"password = ../secrets/db.txt",
	])("値がパスなら検出しない: %s", (line) => {
		expect(idsOf(line)).toStrictEqual([]);
	});

	test.each([
		"api_key = settings.API_KEY",
		"password: z.string().min(8),",
		"  password: string;",
		"const f = (password: Password) => {",
		"password: {{ .Values.password }}",
	])("コードの式とテンプレートの参照は検出しない: %s", (line) => {
		expect(idsOf(line)).toStrictEqual([]);
	});

	test.each([
		"git@github.com:org/repo.git",
		"ssh://git@github.com:22/org/repo",
		"http://localhost:3000/@scope/pkg",
		"https://example.com:8080/a@b",
		"laughs_for_the_whole_room_long_enough",
	])(
		"認証情報を含まない URL と、トークンの接頭辞を含む語は検出しない: %s",
		(line) => {
			expect(idsOf(line)).toStrictEqual([]);
		},
	);

	test("区切りの無い長い行 (20 万文字) でも、検査がテストの制限時間の中で終わる", () => {
		expect(idsOf("a".repeat(200_000))).toStrictEqual([]);
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

	test("検出した文字列そのものは出力しない", () => {
		const line = "postgres://admin:S3cretPassw0rd@db.example.com/app";
		const output = findSecrets("a.yml", line, SECRET_RULES)
			.map(formatFinding)
			.join("\n");

		expect(output).toBe("a.yml:1: [url-credentials] URL の中の認証情報");
	});
});

describe("isTarget", () => {
	test.each([
		"src/a.ts",
		".env.example",
		"README.md",
		"justfile",
		"./src/a.ts",
	])("対象: %s", (path) => {
		expect(isTarget(path)).toBe(true);
	});

	test.each([
		"docs/a.png",
		"pnpm-lock.yaml",
		"node_modules/x/a.ts",
		"packages/x/dist/a.js",
		"scripts/secrets/rules.ts",
		"./scripts/secrets/rules.ts",
		"./scripts/secrets/scan.test.ts",
		"./node_modules/x/a.ts",
	])("対象外: %s", (path) => {
		expect(isTarget(path)).toBe(false);
	});
});
