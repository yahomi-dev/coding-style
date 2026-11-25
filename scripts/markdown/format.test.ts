import { describe, expect, test } from "vitest";
import { firstDifference, formatMarkdown, splitSentences } from "./format.ts";

const lines = (...rows: readonly string[]): string => {
	return rows.join("\n");
};

describe("splitSentences", () => {
	test("句点で文を分け、句点は文の末尾に残す", () => {
		expect(splitSentences("A する。B する。C する")).toStrictEqual([
			"A する。",
			"B する。",
			"C する",
		]);
	});

	test("括弧、かぎ括弧、インラインコードの中の句点では分けない", () => {
		expect(
			splitSentences(
				"A する (例: 30 秒。300 秒とは書かない)。「B。C」と `D。E` を書く。",
			),
		).toStrictEqual([
			"A する (例: 30 秒。300 秒とは書かない)。",
			"「B。C」と `D。E` を書く。",
		]);
	});

	test("句点の後ろが閉じの記号だけなら、前の文に付ける", () => {
		expect(splitSentences("**A する。**")).toStrictEqual(["**A する。**"]);
	});
});

describe("段落", () => {
	test("1 行に複数の文があれば、1 文 1 行にして行末に半角スペース 2 つを付ける", () => {
		expect(formatMarkdown("A する。B する。")).toBe(
			lines("A する。  ", "B する。"),
		);
	});

	test("文が次の行に続くときは、行末に半角スペース 2 つを付ける", () => {
		expect(formatMarkdown(lines("A する。", "B する。", "", "C する。"))).toBe(
			lines("A する。  ", "B する。", "", "C する。"),
		);
	});

	test("行末の半角スペースが 1 つや 3 つのときは、2 つにそろえる", () => {
		expect(formatMarkdown(lines("A する。 ", "B する。   ", "C する。"))).toBe(
			lines("A する。  ", "B する。  ", "C する。"),
		);
	});

	test("段落の最後の行には、行末の半角スペースを付けない", () => {
		expect(formatMarkdown(lines("A する。  ", "", "# 見出し"))).toBe(
			lines("A する。", "", "# 見出し"),
		);
	});

	test("引用は、続きの行にも引用の記号を付ける", () => {
		expect(formatMarkdown("> A する。B する。")).toBe(
			lines("> A する。  ", "> B する。"),
		);
	});
});

describe("箇条書きと番号付きの手順", () => {
	test("句点を書かず、文の区切りは行末の半角スペース 2 つと次の行の字下げにする", () => {
		expect(formatMarkdown("- A する。B する。")).toBe(
			lines("- A する  ", "  B する"),
		);
	});

	test("入れ子の項目と番号付きの手順は、記号の幅だけ字下げする", () => {
		expect(
			formatMarkdown(lines("  - A する。B する", "1. C する。D する")),
		).toBe(lines("  - A する  ", "    B する", "1. C する  ", "   D する"));
	});

	test("文が 1 つの項目は、末尾の句点だけを削除する", () => {
		expect(formatMarkdown(lines("- A する。", "- B する"))).toBe(
			lines("- A する", "- B する"),
		);
	});
});

describe("表のセル", () => {
	test("句点を書かず、文の区切りは <br> にする", () => {
		expect(formatMarkdown("| A する。B する。 | C する。 |")).toBe(
			"| A する<br>B する | C する |",
		);
	});

	test("括弧の中の句点は変えない", () => {
		expect(formatMarkdown("| A する (B。C) | D |")).toBe(
			"| A する (B。C) | D |",
		);
	});
});

describe("整形しない行", () => {
	test("コードブロックと frontmatter は変えない", () => {
		const text = lines(
			"---",
			"title: A する。B する。",
			"---",
			"",
			"```ts",
			"// A する。B する。",
			"```",
		);

		expect(formatMarkdown(text)).toBe(text);
	});

	test("見出しは変えない", () => {
		expect(formatMarkdown("## A する。B する。")).toBe("## A する。B する。");
	});
});

describe("formatMarkdown", () => {
	test("整形済みの本文は変えない", () => {
		const text = lines(
			"A する。  ",
			"B する。",
			"",
			"- C する  ",
			"  D する",
			"",
			"| E する<br>F する |",
			"",
		);

		expect(formatMarkdown(text)).toBe(text);
	});
});

describe("firstDifference", () => {
	test("内容が異なる最初の行を 1 始まりで返す", () => {
		expect(firstDifference(lines("a", "b", "c"), lines("a", "x", "c"))).toBe(2);
	});

	test("同じ内容なら undefined を返す", () => {
		expect(firstDifference("a", "a")).toBe(undefined);
	});
});
