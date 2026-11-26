import { describe, expect, test } from "vitest";
import {
	deniedEnvName,
	denyMessage,
	envNameInCommand,
	isEnvFile,
	splitArguments,
} from "./envAccess.ts";

const fileTool = (toolName: string, input: Record<string, string>): unknown => {
	return { tool_name: toolName, tool_input: input };
};

const bash = (command: string): unknown => {
	return { tool_name: "Bash", tool_input: { command } };
};

describe("isEnvFile", () => {
	test.each([".env", ".env.local", ".env.production", ".env*", ".env.l?cal"])(
		"拒否する名前: %s",
		(name) => {
			expect(isEnvFile(name)).toBe(true);
		},
	);

	test.each([
		".env.example",
		".envrc",
		"env.ts",
		"dotenv.md",
		"environment.ts",
	])("拒否しない名前: %s", (name) => {
		expect(isEnvFile(name)).toBe(false);
	});
});

describe("splitArguments", () => {
	test("空白で分け、引用符の中の空白では分けない", () => {
		expect(splitArguments(`cat "a b" 'c d' e\\ f`)).toStrictEqual([
			"cat",
			"a b",
			"c d",
			"e f",
		]);
	});

	test("引用符が閉じていないときは、最後までを 1 つの引数にする", () => {
		expect(splitArguments(`echo "a b`)).toStrictEqual(["echo", "a b"]);
	});
});

describe("ファイルを扱うツール", () => {
	test.each([
		["Read", { file_path: "/repo/.env" }],
		["Read", { file_path: "/repo/apps/api/.env.local" }],
		["Edit", { file_path: "/repo/.env.production" }],
		["Write", { file_path: "/repo/.env" }],
		["NotebookEdit", { notebook_path: "/repo/.env" }],
		["Grep", { pattern: "KEY", path: "/repo/.env" }],
		["Grep", { pattern: "KEY", glob: ".env.*" }],
		["Glob", { pattern: "**/.env" }],
		["Glob", { pattern: "**/.env*" }],
	])("拒否する: %s %o", (toolName, input) => {
		expect(deniedEnvName(fileTool(toolName, input))).toBeTypeOf("string");
	});

	test.each([
		["Read", { file_path: "/repo/.env.example" }],
		["Read", { file_path: "/repo/src/env.ts" }],
		["Read", { file_path: "/repo/.envrc" }],
		["Grep", { pattern: "API_KEY", path: "/repo/src" }],
		["Grep", { pattern: "\\.env", path: "/repo/docs" }],
		["Task", { prompt: "cat .env" }],
	])("拒否しない: %s %o", (toolName, input) => {
		expect(deniedEnvName(fileTool(toolName, input))).toBe(undefined);
	});

	test("拒否するときは、対象のファイルの名前を返す", () => {
		expect(
			deniedEnvName(fileTool("Read", { file_path: "/repo/api/.env.local" })),
		).toBe(".env.local");
	});
});

describe("Bash", () => {
	test.each([
		"cat .env",
		"less ./.env.local",
		"source .env && pnpm test",
		"grep KEY apps/api/.env.production | head",
		"docker run --env-file=.env img",
		"X=$(cat .env); echo $X",
		"python3 -c 'print(1)' < .env",
		'cat ".env"',
		'bash -c "cat .env"',
		'echo "$(cat .env)"',
		"cp .env.example .env",
		"echo .env >> .gitignore",
		"cat .env*",
	])("引数にファイルの名前があれば拒否する: %s", (command) => {
		expect(deniedEnvName(bash(command))).toBeTypeOf("string");
	});

	test.each([
		"cat .env.example",
		"pnpm test && git status",
		"printenv PATH; env | wc -l",
		"echo '説明: `.env` は読まない'",
		'git commit -m "docs: .env の保護のルールを追加"',
	])("ファイルを読まないコマンドは拒否しない: %s", (command) => {
		expect(deniedEnvName(bash(command))).toBe(undefined);
	});

	test("ヒアドキュメントの本文は判定しない", () => {
		const command = ["cat > doc.md <<'EOF'", "cat .env", "EOF"].join("\n");

		expect(envNameInCommand(command)).toBe(undefined);
	});
});

describe("deniedEnvName", () => {
	test.each([undefined, "text", 1, {}, { tool_name: "Read" }])(
		"入力の形が想定と違うときは判定しない: %o",
		(payload) => {
			expect(deniedEnvName(payload)).toBe(undefined);
		},
	);
});

describe("denyMessage", () => {
	test("対象の名前と、ルールの文書を示す", () => {
		expect(denyMessage(".env.local")).toBe(
			".env のファイル (.env.local) は、読むことも編集することもできません (.claude/rules/security.md)。値が必要なときは、変数の名前だけを .env.example で確認するか、ユーザーに確認してください。",
		);
	});
});
