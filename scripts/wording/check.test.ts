import { describe, expect, test } from "vitest";
import { WORDING_RULES } from "./rules.ts";
import { checkText, findViolations, isTarget } from "./scan.ts";

const idsOf = (line: string): readonly string[] => {
	return findViolations(line, WORDING_RULES).map((v) => v.ruleId);
};

describe("no-hiku", () => {
	test.each([
		"行を引く",
		"単価を引いて合計する",
		"キーで引ける",
		"店舗を引かない",
		"設定を引き当てる",
		"値を引きます",
		"値を引き、合計する",
		"値を引こう",
		"項目を引く",
		"中身を引く",
		"相手を引き当てる",
		"末尾を引く",
	])("取得や算出の意味は違反: %s", (line) => {
		expect(idsOf(line)).toStrictEqual(["no-hiku"]);
	});

	test.each([
		"差し引く",
		"割り引く",
		"線を引く",
		"引き継ぐ",
		"引き直す",
		"引き出す",
		"引き渡す",
		"引き算",
		"引き起こす",
		"引き受ける",
		"引き返す",
		"引数",
		"引用",
		"取引",
		"長引く",
		"取り消し線を引く",
		"引き下げ",
		"引き上げ",
		"導入の手引き、設定の手引き",
		"値引きます",
		"割引く",
		"取り引きする",
		"間引き、残りを使う",
		"駆け引き、交渉する",
		"差し引きます",
		"書かないものの線引き、決定しないこと",
	])("複合語は除外: %s", (line) => {
		expect(idsOf(line)).toStrictEqual([]);
	});

	test.each([
		"風邪を引いた",
		"くじを引く",
		"注意を引く",
		"興味を引く",
		"関心を引く",
	])("別の意味の慣用句は除外: %s", (line) => {
		expect(idsOf(line)).toStrictEqual([]);
	});

	test("除外の語が同じ行にあっても別の出現は検出する", () => {
		const violations = findViolations("差し引く値を行から引く", WORDING_RULES);

		expect(
			violations.map((v) => {
				return [v.ruleId, v.column];
			}),
		).toStrictEqual([["no-hiku", 10]]);
	});
});

describe("表記のルール", () => {
	test("全角の丸括弧は出現ごとに違反", () => {
		expect(idsOf("説明（補足）")).toStrictEqual([
			"no-fullwidth-paren",
			"no-fullwidth-paren",
		]);
	});

	test("半角の丸括弧は違反にしない", () => {
		expect(idsOf("説明 (補足)")).toStrictEqual([]);
	});

	test("Unicode の矢印は出現ごとに違反", () => {
		expect(idsOf("A → B ← C ⇒ D ⇐ E ↔ F")).toStrictEqual([
			"no-unicode-arrow",
			"no-unicode-arrow",
			"no-unicode-arrow",
			"no-unicode-arrow",
			"no-unicode-arrow",
		]);
	});

	test("ASCII の矢印は違反にしない", () => {
		expect(idsOf("A -> B <- C <-> D")).toStrictEqual([]);
	});

	test.each(["➡ 次", "➔ 次", "\u2794", "\u27BF"])(
		"Dingbats の矢印 (U+2794-27BF) は違反: %s",
		(line) => {
			expect(idsOf(line)).toStrictEqual(["no-unicode-arrow"]);
		},
	);

	test.each(["\u2793", "\u27C0"])(
		"Dingbats の矢印の範囲の外は違反にしない: %s",
		(line) => {
			expect(idsOf(line)).toStrictEqual([]);
		},
	);
});

describe("checkText", () => {
	test("wording-ok と書いた行は検査せず、行番号は 1 始まり", () => {
		const text = ["ok", "値を引く", "値を引く <!-- wording-ok -->"].join("\n");

		expect(
			checkText("a.md", text, WORDING_RULES).map((v) => {
				return [v.path, v.line, v.ruleId];
			}),
		).toStrictEqual([["a.md", 2, "no-hiku"]]);
	});
});

describe("isTarget", () => {
	test.each([
		"README.md",
		"justfile",
		"docs/a.mmd",
		"src/a.ts",
		"src/a.tsx",
		"lefthook.yml",
		"deploy/values.yaml",
		"scripts/a.sh",
		"package.json",
		"./README.md",
		"./docs/a.md",
	])("対象: %s", (path) => {
		expect(isTarget(path)).toBe(true);
	});

	test.each([
		"docs/a.svg",
		"docs/a.html",
		"pnpm-lock.yaml",
		"node_modules/x/a.ts",
		"packages/x/dist/a.ts",
		"scripts/wording/rules.ts",
		"docs/wording-guideline.md",
		".claude/rules/wording.md",
		"src/a.png",
		"./docs/wording-guideline.md",
		"./.claude/rules/wording.md",
		"./scripts/wording/rules.ts",
		"docs/../docs/wording-guideline.md",
	])("対象外: %s", (path) => {
		expect(isTarget(path)).toBe(false);
	});
});
