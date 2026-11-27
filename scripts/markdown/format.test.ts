import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { firstDifference, formatMarkdown, splitSentences } from "./format.ts";

type Example = {
	readonly title: string;
	readonly input: string;
	readonly expected: string;
};

type FenceExample = {
	readonly title: string;
	readonly block: readonly string[];
};

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const QUOTE_PREFIX = /^(?:[ \t]*>)+/;
const CHANGEABLE = /[\s。]/g;

const lines = (...rows: readonly string[]): string => {
	return rows.join("\n");
};

const unchanged = (title: string, input: string): Example => {
	return { title, input, expected: input };
};

const isIdempotent = (text: string): boolean => {
	const once = formatMarkdown(text);

	return formatMarkdown(once) === once;
};

// 整形で変わってよい文字 (空白、改行、句点、<br>、行頭の引用の記号) を除いた本文
const contentOf = (text: string): string => {
	return text
		.split("\n")
		.map((line) => line.replace(QUOTE_PREFIX, ""))
		.join("")
		.replaceAll("<br>", "")
		.replace(CHANGEABLE, "");
};

const keepsContent = (text: string): boolean => {
	return contentOf(formatMarkdown(text)) === contentOf(text);
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

	test("リンクのテキストの中の句点では分けない", () => {
		expect(
			splitSentences("[A する。B する](x.md) を見る。C する。"),
		).toStrictEqual(["[A する。B する](x.md) を見る。", "C する。"]);
	});

	test("インラインコードは、開始と同じ数のバッククォートで閉じる", () => {
		expect(splitSentences("`` a`b。c ``。d。")).toStrictEqual([
			"`` a`b。c ``。",
			"d。",
		]);
	});

	test("閉じていないバッククォートの後ろの句点では分ける", () => {
		expect(splitSentences("a `b。c。")).toStrictEqual(["a `b。", "c。"]);
	});

	test("HTML のコメントの中の句点では分けない", () => {
		expect(splitSentences("a <!-- b。c --> d。e。")).toStrictEqual([
			"a <!-- b。c --> d。",
			"e。",
		]);
	});

	test("強調の閉じの記号の後ろが空白なら、閉じの記号の後ろで分ける", () => {
		expect(splitSentences("**注意。** 補足する。")).toStrictEqual([
			"**注意。**",
			"補足する。",
		]);
	});

	test("句点の後ろの記号に空白以外の文字が続くときは、その句点では分けない", () => {
		expect(splitSentences("**注意。**です。")).toStrictEqual([
			"**注意。**です。",
		]);
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

// 既存のテストの入力 (2 回整形したときのテストに使う)
const EXISTING_INPUTS: readonly string[] = [
	"A する。B する。",
	lines("A する。", "B する。", "", "C する。"),
	lines("A する。 ", "B する。   ", "C する。"),
	lines("A する。  ", "", "# 見出し"),
	"> A する。B する。",
	"- A する。B する。",
	lines("  - A する。B する", "1. C する。D する"),
	lines("- A する。", "- B する"),
	"| A する。B する。 | C する。 |",
	"| A する (B。C) | D |",
	lines(
		"---",
		"title: A する。B する。",
		"---",
		"",
		"```ts",
		"// A する。B する。",
		"```",
	),
	"## A する。B する。",
	lines(
		"A する。  ",
		"B する。",
		"",
		"- C する  ",
		"  D する",
		"",
		"| E する<br>F する |",
		"",
	),
];

const FENCE_CHARS: readonly string[] = ["`", "~"];
const FENCE_LENGTHS: readonly number[] = [3, 4, 5];

const otherFenceChar = (char: string): string => {
	return char === "`" ? "~" : "`";
};

// 開始の行と同じ記号で短い行、別の記号の行、情報の文字列がある行は、コードブロックを閉じない
const fenceExampleOf = (char: string, length: number): FenceExample => {
	const open = char.repeat(length);
	const other = otherFenceChar(char).repeat(length);
	const shorter = char.repeat(length - 1);

	return {
		title: `${open} の中の ${other}、${shorter}、${open}js`,
		block: [`${open}md`, other, `${open}js`, shorter, "x。y。", other, open],
	};
};

const FENCE_EXAMPLES: readonly FenceExample[] = [
	...FENCE_CHARS.flatMap((char) =>
		FENCE_LENGTHS.map((length) => fenceExampleOf(char, length)),
	),
	{
		title: "開始より長い記号の行で閉じる",
		block: ["```", "x。y。", "`````"],
	},
	{
		title: "箇条書きの中のコードブロック",
		block: ["- 項目", "", "  ~~~~", "  ~~~", "  x。y。", "  ~~~~"],
	},
	{
		title: "引用の中のコードブロック",
		block: ["> ````", "> ```", "> x。y。", "> ```", "> ````"],
	},
];

const fenceInputOf = (example: FenceExample): string => {
	return lines(...example.block, "", "あと。の段落。");
};

describe("コードブロック (フェンス)", () => {
	test.each(FENCE_EXAMPLES)(
		"$title: 中身を変えず、後ろの段落を整形する",
		(example) => {
			expect(formatMarkdown(fenceInputOf(example))).toBe(
				lines(...example.block, "", "あと。  ", "の段落。"),
			);
		},
	);
});

// 内容を壊す入力と、2 回整形すると結果が変わる入力 (コードレビューの再現)
const REVIEW_EXAMPLES: readonly Example[] = [
	{
		title: "バッククォート 4 つのブロックの中を変えない",
		input: "````md\n```js\nx。y。\n```\n````\n\nあと。の段落。\n",
		expected: "````md\n```js\nx。y。\n```\n````\n\nあと。  \nの段落。\n",
	},
	{
		title: "チルダのブロックの中のバッククォートを、開始として扱わない",
		input: "~~~md\n```\n~~~\n\nあと。の段落。\n",
		expected: "~~~md\n```\n~~~\n\nあと。  \nの段落。\n",
	},
	unchanged(
		"チルダのブロックの中で、バッククォートの行の後ろを変えない",
		"~~~md\n```\nx。y。\n~~~\n",
	),
	unchanged("空行の後ろの字下げ 4 つの行を変えない", "段落。\n\n    x。y。\n"),
	unchanged(
		"箇条書きの中の字下げのコードブロックを変えない",
		"- 手順\n\n      code。x。\n",
	),
	{
		title:
			"段落の 2 行目が字下げされているだけの行は、段落として整形し、句点を残す",
		input: "a。\n  b。c。\n",
		expected: "a。  \n  b。  \n  c。\n",
	},
	unchanged("句点の直後の - では分けない", "次のとおり。- 項目\n"),
	unchanged("句点の直後の 1. では分けない", "手順は次のとおり。1. 開く\n"),
	unchanged("句点の直後の # では分けない", "次のとおり。# 見出し\n"),
	unchanged("句点の直後の | では分けない", "次のとおり。| a |\n"),
	unchanged("句点の直後の --- では分けない", "区切り。---\n"),
	unchanged("句点の直後の > では分けない", "次のとおり。> 引用\n"),
	{
		title: "引用の中の箇条書きを、箇条書きとして整形する",
		input: "> - a。b。\n",
		expected: "> - a  \n>   b\n",
	},
	{
		title: "句点の後ろの強調の閉じの記号は、前の文に含める",
		input: "**注意。** 補足する。\n",
		expected: "**注意。**  \n補足する。\n",
	},
	{
		title: "箇条書きでも、強調の閉じの記号を前の文に含め、強調の中の句点を残す",
		input: "- **注意。** 補足する。\n",
		expected: "- **注意。**  \n  補足する\n",
	},
	{
		title: "強調の後ろの句点で分ける",
		input: "**注意**。補足する。\n",
		expected: "**注意**。  \n補足する。\n",
	},
	{
		title: "2 つのバッククォートで囲んだコードの後ろの句点で分ける",
		input: "``a ` b``。c。d。\n",
		expected: "``a ` b``。  \nc。  \nd。\n",
	},
	unchanged(
		"リンクのテキストの中の句点では分けない",
		"[a。b](https://x)の説明。\n",
	),
	unchanged("画像の代替テキストの中の句点では分けない", "![図。説明](x.png)\n"),
	unchanged(
		"リンクのテキストの末尾の句点では分けない",
		"[設計書を参照する。](docs/x.md)\n",
	),
	unchanged("複数行の HTML のコメントの中を変えない", "<!--\na。b。\n-->\n"),
	{
		title: "1) の番号付きの手順を、箇条書きとして整形する",
		input: "1) a。b。\n",
		expected: "1) a  \n   b\n",
	},
	unchanged(
		"表のセルのエスケープしたパイプでは、括弧の深さを 0 にしない",
		"| (a \\| b。c) | d |\n",
	),
];

// 行頭に来ると別の要素になる文の前では分けない (2 回目の整形で結果が変わるため)
const BLOCK_START_EXAMPLES: readonly Example[] = [
	unchanged("+ の箇条書き", "次のとおり。+ 項目"),
	unchanged("* の箇条書き", "次のとおり。* 項目"),
	unchanged("1) の番号付きの手順", "手順は次のとおり。1) 開く"),
	unchanged("setext の見出しの下線", "区切り。==="),
	unchanged("- だけの行", "区切り。-"),
	unchanged("フェンス", "次のとおり。```"),
	unchanged("HTML のタグ", "次のとおり。<div>"),
	unchanged("リンクの定義", "次のとおり。[x]: https://x"),
	unchanged(
		"箇条書きの続きの行で、入れ子の項目になる文",
		"- 次のとおり。- 項目",
	),
	{
		title: "後ろの文は分ける",
		input: "次のとおり。- 項目。続きの文。",
		expected: lines("次のとおり。- 項目。  ", "続きの文。"),
	},
];

const EMPHASIS_EXAMPLES: readonly Example[] = [
	{
		title: "_ の強調",
		input: "_注意。_ 補足する。",
		expected: lines("_注意。_  ", "補足する。"),
	},
	{
		title: "~~ の取り消し線",
		input: "~~注意。~~ 補足する。",
		expected: lines("~~注意。~~  ", "補足する。"),
	},
	unchanged(
		"記号の後ろが空白でないときは、開始の記号の可能性があるので分けない",
		"注意する。**太字**です。",
	),
	unchanged("閉じの記号の後ろに文字が続くときは分けない", "**注意。**です。"),
	{
		title: "句点の後ろのインラインコードは、次の文に含める",
		input: "A する。`B` を使う。",
		expected: lines("A する。  ", "`B` を使う。"),
	},
	{
		title: "表のセルでは、閉じの記号の後ろで <br> にする",
		input: "| **注意。** 補足する。 |",
		expected: "| **注意。**<br>補足する |",
	},
	{
		title: "整形済みの強調の行は変えない",
		input: lines("**注意。**  ", "補足する。"),
		expected: lines("**注意。**  ", "補足する。"),
	},
	{
		title: "2 文にまたがる強調は、閉じの記号を前の行に残す",
		input: "**注意。必ず確認する。** 補足する。",
		expected: lines("**注意。  ", "必ず確認する。**  ", "補足する。"),
	},
	{
		title: "箇条書きでも、2 文にまたがる強調の閉じの記号を前の行に残す",
		input: "- **注意。必ず確認する。** 補足する。",
		expected: lines("- **注意  ", "  必ず確認する。**  ", "  補足する"),
	},
	{
		title: "表のセルでも、2 文にまたがる強調の閉じの記号を前の文に残す",
		input: "| **注意。必ず確認する。** 補足する。 |",
		expected: "| **注意<br>必ず確認する。**<br>補足する |",
	},
	unchanged(
		"行の先頭からの記号の数が偶数なら、句点の後ろの記号は閉じではないので分けない",
		"**A** を行う。** B",
	),
];

const QUOTE_EXAMPLES: readonly Example[] = [
	{
		title: "入れ子の引用",
		input: "> > a。b。",
		expected: lines("> > a。  ", "> > b。"),
	},
	{
		title: "引用の中の番号付きの手順の続きの行",
		input: lines("> 1. a。b。", ">    c。"),
		expected: lines("> 1. a  ", ">    b  ", ">    c"),
	},
	unchanged("空の引用の行の記号は変えない", lines("> a。", ">", "> b。")),
	{
		title: "引用の中の表",
		input: "> | a。b。 |",
		expected: "> | a<br>b |",
	},
];

const HTML_EXAMPLES: readonly Example[] = [
	unchanged("1 行の HTML のコメント", "<!-- a。b。 -->"),
	{
		title:
			"行の途中で開いたコメントは、閉じる行までを変えず、後ろの段落を整形する",
		input: lines("a <!--", "b。c。", "-->", "", "d。e。"),
		expected: lines("a <!--", "b。c。", "-->", "", "d。  ", "e。"),
	},
	{
		title: "インラインコードの中の <!-- は、コメントの開始として扱わない",
		input: lines("文 `<!--` を書く。次。", "", "あと。の段落。"),
		expected: lines("文 `<!--` を書く。  ", "次。", "", "あと。  ", "の段落。"),
	},
	{
		title: "HTML のタグで始まる行は、空行までを変えない",
		input: lines("<div>", "a。b。", "</div>", "", "c。d。"),
		expected: lines("<div>", "a。b。", "</div>", "", "c。  ", "d。"),
	},
];

const NOT_FENCE_EXAMPLES: readonly Example[] = [
	{
		title:
			"空行の後ろの字下げ 4 つのフェンスの行は、字下げのコードブロックとして扱う",
		input: lines("段落。", "", "    ```", "    x。y。", "", "あと。の段落。"),
		expected: lines(
			"段落。",
			"",
			"    ```",
			"    x。y。",
			"",
			"あと。  ",
			"の段落。",
		),
	},
	{
		title: "情報の文字列にバッククォートを含む行は、フェンスとして扱わない",
		input: lines("```a`b", "", "あと。の段落。"),
		expected: lines("```a`b", "", "あと。  ", "の段落。"),
	},
];

const OTHER_EXAMPLES: readonly Example[] = [
	unchanged("setext の見出しを変えない", "見出し。です\n===\n"),
	unchanged(
		"- の下線の setext の見出しは、複数行でも変えない",
		lines("a。", "b。", "---"),
	),
	{
		title: "箇条書きの後ろの空行の後ろで、字下げが内容の位置に届かない行は段落",
		input: lines("1. a", "", "  b。c。"),
		expected: lines("1. a", "", "  b。  ", "  c。"),
	},
	{
		title: "箇条書きの中の段落は、句点を書かない",
		input: lines("- a", "", "  b。c。"),
		expected: lines("- a", "", "  b  ", "  c"),
	},
	{
		title: "表のセルのインラインコードの中のパイプでは、セルを分けない",
		input: "| `a|b。c` | d。 |",
		expected: "| `a|b。c` | d |",
	},
	{
		title: "表のセルの既存の <br> の前には、<br> を追加しない",
		input: "| a。<br>b。 |",
		expected: "| a<br>b |",
	},
	unchanged(
		"先頭のパイプが無い表は変えない",
		lines("a | b。c", "--- | ---", "d。e | f"),
	),
	unchanged(
		"表の行の後ろに空行を挟まずに続く行は、表の行なので変えない",
		lines("| a |", "|---|", "b。c。"),
	),
];

// コードレビューで問題が無かった書き方 (旧実装と同じ結果になることを確認した)
const KEPT_EXAMPLES: readonly Example[] = [
	{
		title: "入れ子の箇条書き",
		input: "- a\n  - b。c。\n",
		expected: "- a\n  - b  \n    c\n",
	},
	unchanged("箇条書きの中のコードブロック", "- a\n\n  ```\n  x。y。\n  ```\n"),
	{
		title: "10. の番号付きの手順は、字下げを 4 つにする",
		input: "10. a。b。\n",
		expected: "10. a  \n    b\n",
	},
	{
		title: "表のセルのインラインコードの中のパイプ",
		input: "| `a|b`。c。 | d |\n",
		expected: "| `a|b`<br>c | d |\n",
	},
	{
		title: "frontmatter の後ろの段落",
		input: "---\ntitle: a。b。\n---\n\nc。d。\n",
		expected: "---\ntitle: a。b。\n---\n\nc。  \nd。\n",
	},
	unchanged("脚注の定義", "[^1]: a。b。\n"),
	{
		title: "句点の直後と行末の空白を削除する",
		input: "a。  b。 \n",
		expected: "a。  \nb。\n",
	},
	{
		title: "強調の中の句点で分ける",
		input: "**a。b。**\n",
		expected: "**a。  \nb。**\n",
	},
];

// 整形した行が別の要素になるときは、その行を変えない
const FORMATTED_LINE_EXAMPLES: readonly Example[] = [
	unchanged("句点を削除すると見出しになる項目", "- #。b。"),
	unchanged("分けた 1 文目がフェンスになる行", "```a。``b"),
	unchanged("内容が引用で始まる項目", "- > a。b。"),
	{
		title: "記号だけの断片の前でも分けない",
		input: "前の文。1) ",
		expected: "前の文。1)",
	},
	{
		title: "続けて書いた句点は、すべて削除する",
		input: "- a。。b。",
		expected: lines("- a  ", "  b"),
	},
	{
		title: "句点の前の空白も削除する",
		input: "- a 。b 。",
		expected: lines("- a  ", "  b"),
	},
];

const EXAMPLE_GROUPS: readonly (readonly [string, readonly Example[]])[] = [
	["コードレビューの再現", REVIEW_EXAMPLES],
	["行頭に来ると別の要素になる文", BLOCK_START_EXAMPLES],
	["強調の閉じの記号", EMPHASIS_EXAMPLES],
	["引用", QUOTE_EXAMPLES],
	["HTML", HTML_EXAMPLES],
	["フェンスではない行", NOT_FENCE_EXAMPLES],
	["そのほかの書き方", OTHER_EXAMPLES],
	["整形した行が別の要素になる行", FORMATTED_LINE_EXAMPLES],
	["コードレビューで問題が無かった書き方", KEPT_EXAMPLES],
];

describe.each(EXAMPLE_GROUPS)("%s", (_name, examples) => {
	test.each(examples)("$title", ({ input, expected }) => {
		expect(formatMarkdown(input)).toBe(expected);
	});
});

// 全角の括弧 (言い回しの検査の対象の文字なので、符号位置で書く)
const FULLWIDTH_OPEN = String.fromCodePoint(0xff08);
const FULLWIDTH_CLOSE = String.fromCodePoint(0xff09);

// 整形しても対応できない書き方 (変えずに残すか、整形で表示が変わる。2 回整形したときのテストにだけ使う)
const UNSUPPORTED_INPUTS: readonly string[] = [
	'彼は "a。b。" と言った。\n',
	'+++\ntitle = "a。b。"\n+++\n',
	"> a。\nb。c。\n",
	`${FULLWIDTH_OPEN}例。${FULLWIDTH_CLOSE}です。\n`,
	"テキスト `a。\n次。` 後。\n",
];

// 文の前後と次の行の組み合わせ (fast-check の代わりに、直積で入力を作成する)
const PREFIXES: readonly string[] = [
	"",
	"- ",
	"1. ",
	"1) ",
	"> ",
	"> - ",
	"| ",
	"  - ",
];
const SECOND_SENTENCES: readonly string[] = [
	"次の文。",
	"- 項目",
	"* 項目",
	"+ 項目",
	"1. 手順",
	"1) 手順",
	"# 見出し",
	"| a |",
	"> 引用",
	"---",
	"===",
	"-",
	"```",
	"~~~",
	"<div>",
	"<!-- c。",
	"[x]: y",
	"**注意。** 補足。",
	"**注意。**です。",
	"`code。` 後。",
	"``a ` b``。後。",
	"[a。b](x)。",
	"<!-- c。 -->後。",
	"_強調。_ 後。",
	"(括弧。中)。後。",
	"\\| 後。",
];
const NEXT_LINES: readonly string[] = [
	"",
	"\n",
	"\n続きの文。後。",
	"\n  続き。後。",
	"\n- 次の項目。後。",
	"\n===",
	"\n---",
	"\n| a。b。 |",
	"\n> 引用。後。",
	"\n\n    code。x。",
	"\n```\nx。y。",
];

const COMBINED_INPUTS: readonly string[] = PREFIXES.flatMap((prefix) =>
	SECOND_SENTENCES.flatMap((second) =>
		NEXT_LINES.map((next) => `${prefix}前の文。${second}${next}`),
	),
);

const ALL_INPUTS: readonly string[] = [
	...EXISTING_INPUTS,
	...FENCE_EXAMPLES.map(fenceInputOf),
	...EXAMPLE_GROUPS.flatMap(([, examples]) =>
		examples.map((example) => example.input),
	),
	...UNSUPPORTED_INPUTS,
	...COMBINED_INPUTS,
];

const trackedMarkdown = (): readonly string[] => {
	return execFileSync("git", ["ls-files", "*.md"], {
		cwd: ROOT,
		encoding: "utf8",
	})
		.split("\n")
		.filter((path) => path !== "");
};

const readMarkdown = (path: string): string => {
	return readFileSync(join(ROOT, path), "utf8");
};

describe("性質", () => {
	test("テストに使う入力は、2 回整形しても 1 回目と同じ", () => {
		expect(ALL_INPUTS.filter((input) => !isIdempotent(input))).toStrictEqual(
			[],
		);
	});

	test("テストに使う入力は、空白、改行、句点、<br>、引用の記号のほかは変わらない", () => {
		expect(ALL_INPUTS.filter((input) => !keepsContent(input))).toStrictEqual(
			[],
		);
	});

	test("リポジトリの Markdown のファイルは、2 回整形しても 1 回目と同じ", () => {
		const paths = trackedMarkdown();

		// ファイルが 1 つも無いと検査が空振りするので、件数が 0 でないことも同じ値で検証する
		expect({
			hasFiles: paths.length > 0,
			notIdempotent: paths.filter((path) => !isIdempotent(readMarkdown(path))),
		}).toStrictEqual({ hasFiles: true, notIdempotent: [] });
	});
});
