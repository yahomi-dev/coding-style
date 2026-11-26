// Markdown の改行のルールに合わせて本文を整形する純粋関数。
// ルールは docs/wording-guideline.md の「改行」。
// 検査と書き込みは scripts/markdown/check.ts。

type LineKind =
	| "verbatim"
	| "blank"
	| "table"
	| "listItem"
	| "listContinuation"
	| "paragraph";

type ScanState = {
	readonly depth: number;
	readonly inCode: boolean;
	readonly parts: readonly string[];
	readonly current: string;
};

type Scanner = (state: ScanState, char: string) => ScanState;

const PERIOD = "。";
const LINE_BREAK = "  ";
const OPENERS = "(「『";
const CLOSERS = ")」』";

const FENCE = /^\s*(?:```|~~~)/;
const BLANK = /^\s*$/;
const HEADING = /^\s{0,3}#{1,6}\s/;
const TABLE_ROW = /^\s*\|/;
const LIST_ITEM = /^\s*(?:[-*+]|\d+\.)\s+/;
const QUOTE = /^\s*(?:>\s?)+/;
const INDENT = /^\s*/;
// HTML のタグとコメント、水平線、リンクの定義は整形しない
const HTML_OR_RULE =
	/^\s*(?:<!--|<\/?[a-zA-Z]|-{3,}\s*$|\*{3,}\s*$|\[[^\]]+\]:)/;
// 句点の後ろに残った閉じの記号だけの断片 (強調の閉じなど) は、前の文に付ける
const ONLY_MARKUP = /^[\s*_~`)」』]*$/;

const INITIAL_STATE: ScanState = {
	depth: 0,
	inCode: false,
	parts: [],
	current: "",
};

const append = (state: ScanState, char: string): ScanState => {
	return { ...state, current: state.current + char };
};

// 1 文字ずつ読み、括弧とインラインコードの外にある句点で文を区切る
const scanChar: Scanner = (state, char) => {
	if (char === "`") {
		return { ...append(state, char), inCode: !state.inCode };
	}

	if (state.inCode) {
		return append(state, char);
	}

	if (OPENERS.includes(char)) {
		return { ...append(state, char), depth: state.depth + 1 };
	}

	if (CLOSERS.includes(char)) {
		return { ...append(state, char), depth: Math.max(0, state.depth - 1) };
	}

	if (char === PERIOD && state.depth === 0) {
		return {
			...state,
			parts: [...state.parts, state.current + char],
			current: "",
		};
	}

	return append(state, char);
};

// 表の行では、セルの区切りで括弧の深さを 0 に戻す (閉じていない括弧が次のセルに影響しないように)
const scanTableChar: Scanner = (state, char) => {
	if (char === "|" && !state.inCode) {
		return { ...append(state, char), depth: 0 };
	}

	return scanChar(state, char);
};

const scanParts = (scanner: Scanner, text: string): readonly string[] => {
	const end = [...text].reduce(scanner, INITIAL_STATE);

	return end.current === "" ? end.parts : [...end.parts, end.current];
};

const mergeTrailingMarkup = (parts: readonly string[]): readonly string[] => {
	const last = parts.at(-1);
	const previous = parts.at(-2);

	if (last === undefined || previous === undefined || !ONLY_MARKUP.test(last)) {
		return parts;
	}

	return [...parts.slice(0, -2), `${previous}${last}`];
};

/**
 * 本文を文ごとに分ける (句点は各文の末尾に残す。括弧、かぎ括弧、インラインコードの中の句点では分けない)
 */
export const splitSentences = (text: string): readonly string[] => {
	return mergeTrailingMarkup(
		scanParts(scanChar, text)
			.map((part) => part.trim())
			.filter((part) => part !== ""),
	);
};

const dropPeriod = (sentence: string): string => {
	return sentence.endsWith(PERIOD) ? sentence.slice(0, -1) : sentence;
};

const formatTablePart = (
	part: string,
	previous: string | undefined,
	next: string | undefined,
): string => {
	// 句点の後ろがセルの区切りなら、区切りの前の空白を残す
	const startsCell = part.trimStart().startsWith("|");
	const afterBreak = previous?.endsWith(PERIOD) === true && !startsCell;
	const text = afterBreak ? part.trimStart() : part;

	if (!text.endsWith(PERIOD)) {
		return text;
	}

	const body = text.slice(0, -1);
	const endsCell = next === undefined || next.trimStart().startsWith("|");

	return endsCell ? body : `${body}<br>`;
};

// 表のセル: 句点を書かず、文の区切りは <br> にする
const formatTableRow = (line: string): string => {
	const parts = scanParts(scanTableChar, line.trimEnd());

	return parts
		.map((part, index) =>
			formatTablePart(part, parts[index - 1], parts[index + 1]),
		)
		.join("");
};

const prefixOf = (line: string, kind: LineKind): string => {
	const pattern = kind === "listItem" ? LIST_ITEM : QUOTE;

	return pattern.exec(line)?.[0] ?? INDENT.exec(line)?.[0] ?? "";
};

const continuationPrefix = (prefix: string, kind: LineKind): string => {
	return kind === "listItem" ? " ".repeat(prefix.length) : prefix;
};

const isBulletKind = (kind: LineKind): boolean => {
	return kind === "listItem" || kind === "listContinuation";
};

const continues = (kind: LineKind, next: LineKind | undefined): boolean => {
	return isBulletKind(kind)
		? next === "listContinuation"
		: next === "paragraph";
};

// 段落: 1 文 1 行。
// 続く行があれば、行末に半角スペース 2 つを付ける。
// 箇条書き: 句点を書かず、文の区切りは行末の半角スペース 2 つと、次の行の字下げにする。
const formatTextLine = (
	line: string,
	kind: LineKind,
	next: LineKind | undefined,
): readonly string[] => {
	const prefix = prefixOf(line, kind);
	const sentences = splitSentences(line.slice(prefix.length));

	if (sentences.length === 0) {
		return [line.trimEnd()];
	}

	const isBullet = isBulletKind(kind);
	const endsSentence = isBullet || sentences.at(-1)?.endsWith(PERIOD) === true;
	const breakAfterLast = continues(kind, next) && endsSentence;
	const texts = isBullet ? sentences.map(dropPeriod) : sentences;
	const restPrefix = continuationPrefix(prefix, kind);

	return texts.map((text, index) => {
		const head = index === 0 ? prefix : restPrefix;
		const tail = index < texts.length - 1 || breakAfterLast ? LINE_BREAK : "";

		return `${head}${text}${tail}`;
	});
};

const kindOf = (line: string, isVerbatim: boolean): LineKind => {
	if (isVerbatim || HEADING.test(line) || HTML_OR_RULE.test(line)) {
		return "verbatim";
	}

	if (BLANK.test(line)) {
		return "blank";
	}

	if (TABLE_ROW.test(line)) {
		return "table";
	}

	if (LIST_ITEM.test(line)) {
		return "listItem";
	}

	return /^\s/.test(line) ? "listContinuation" : "paragraph";
};

// コードブロックの中、コードブロックの区切りの行、先頭の frontmatter は整形しない
const verbatimFlags = (lines: readonly string[]): readonly boolean[] => {
	const frontmatterEnd = lines[0] === "---" ? lines.indexOf("---", 1) : -1;

	return lines.map((line, index) => {
		const fencesBefore = lines
			.slice(0, index)
			.filter((before) => FENCE.test(before)).length;

		return (
			index <= frontmatterEnd || FENCE.test(line) || fencesBefore % 2 === 1
		);
	});
};

const formatLine = (
	line: string,
	kind: LineKind,
	next: LineKind | undefined,
): readonly string[] => {
	if (kind === "verbatim" || kind === "blank") {
		return [line];
	}

	if (kind === "table") {
		return [formatTableRow(line)];
	}

	return formatTextLine(line, kind, next);
};

/**
 * Markdown の本文を、改行のルールに合わせて整形する (整形済みの本文は変えない)
 */
export const formatMarkdown = (text: string): string => {
	const lines = text.split("\n");
	const flags = verbatimFlags(lines);
	const kinds = lines.map((line, index) => kindOf(line, flags[index] === true));

	return lines
		.flatMap((line, index) => {
			return formatLine(line, kinds[index] ?? "verbatim", kinds[index + 1]);
		})
		.join("\n");
};

/**
 * 整形の前後で内容が異なる最初の行 (1 始まり)。
 * 同じなら undefined
 */
export const firstDifference = (
	before: string,
	after: string,
): number | undefined => {
	const afterLines = after.split("\n");
	const index = before
		.split("\n")
		.findIndex((line, lineIndex) => line !== afterLines[lineIndex]);

	return index === -1 ? undefined : index + 1;
};
