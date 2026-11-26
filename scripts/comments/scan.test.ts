import { describe, expect, test } from "vitest";
import { findCommentViolations, isTarget } from "./scan.ts";

const linesOf = (path: string, text: string): readonly number[] => {
	return findCommentViolations(path, text).map((violation) => violation.line);
};

describe("findCommentViolations", () => {
	test("1 行に複数の文があるコメントを、行番号つきで返す", () => {
		const text = [
			"// A する。B する",
			"const a = 1;",
			" * C する。D する。",
		].join("\n");

		expect(findCommentViolations("src/a.ts", text)).toStrictEqual([
			{ path: "src/a.ts", line: 1, text: "// A する。B する" },
			{ path: "src/a.ts", line: 3, text: "* C する。D する。" },
		]);
	});

	test("1 文だけのコメントは違反にしない", () => {
		expect(linesOf("src/a.ts", "// A する。\n// B する")).toStrictEqual([]);
	});

	test("括弧とインラインコードの中の句点は、文の区切りにしない", () => {
		expect(
			linesOf("src/a.ts", "// A する (B する。C する) と `D。E` を書く"),
		).toStrictEqual([]);
	});

	test("コードの後ろに書いたコメントと、文字列の中は検査しない", () => {
		const text = [
			'const a = "A する。B する";',
			"run(); // C する。D する",
		].join("\n");

		expect(linesOf("src/a.ts", text)).toStrictEqual([]);
	});

	test("シェル、YAML、justfile は # のコメントを検査する", () => {
		expect(linesOf("scripts/a.sh", "# A する。B する")).toStrictEqual([1]);
		expect(linesOf("lefthook.yml", "  # A する。B する")).toStrictEqual([1]);
		expect(linesOf("justfile", "# A する。B する")).toStrictEqual([1]);
	});

	test("wording-ok と書いた行は検査しない", () => {
		expect(linesOf("src/a.ts", "// A する。B する wording-ok")).toStrictEqual(
			[],
		);
	});

	test("対象外の種類のファイルは検査しない", () => {
		expect(linesOf("docs/a.md", "# A する。B する")).toStrictEqual([]);
	});
});

describe("isTarget", () => {
	test.each([
		"src/a.ts",
		"src/a.tsx",
		"src/a.css",
		"scripts/a.sh",
		"lefthook.yml",
		"justfile",
	])("対象: %s", (path) => {
		expect(isTarget(path)).toBe(true);
	});

	test.each([
		"docs/a.md",
		"package.json",
		"pnpm-lock.yaml",
		"node_modules/x/a.ts",
		"packages/x/dist/a.ts",
	])("対象外: %s", (path) => {
		expect(isTarget(path)).toBe(false);
	});
});
