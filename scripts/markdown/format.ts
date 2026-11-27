// Markdown の改行のルールに合わせて本文を整形する純粋関数。
// ルールは docs/wording-guideline.md の「3. 改行」。
// 検査と書き込みは scripts/markdown/check.ts。
// 最優先の原則は、内容を壊さないこと。
// 行の種類を判定できないときと、整形して意味が変わる恐れがあるときは、その行を変えない。

type LineKind =
	| "verbatim"
	| "blank"
	| "quote"
	| "table"
	| "listItem"
	| "listContinuation"
	| "paragraph";

// 開いているコードブロックの、開始の行の記号の種類と長さ
type Fence = {
	readonly char: string;
	readonly length: number;
};

// 行の種類の判定の状態 (1 行を読むごとに作成する)
type BlockState = {
	// 直前に読んだ行の種類 (最初の行の前は undefined)
	readonly kind: LineKind | undefined;
	readonly fence: Fence | undefined;
	// 開いている HTML のブロックの、終了の行の条件
	readonly htmlEnd: RegExp | undefined;
	// 開いている箇条書きの項目の、内容の開始の位置 (外側の項目から順に並べる)
	readonly lists: readonly number[];
};

// HTML のブロックの開始の条件と、終了の行の条件 (CommonMark の HTML のブロック)
type HtmlStart = {
	readonly start: RegExp;
	readonly end: RegExp;
};

// HTML のブロックの開始の行を読んだ結果 (end が undefined なら、同じ行で閉じている)
type HtmlOpen = {
	readonly end: RegExp | undefined;
};

type TokenRole =
	| "open"
	| "close"
	| "period"
	| "pipe"
	| "openComment"
	| "text"
	| "atom";

// 強調の記号の文字 (* と _ と ~) ごとの、記号の連続の数
type MarkerRuns = Readonly<Partial<Record<string, number>>>;

type Token = {
	readonly role: TokenRole;
	readonly start: number;
	readonly end: number;
	// 句点の直後の、強調の閉じの記号の候補 (句点以外のトークンと、記号が無い句点は空文字列)
	readonly closers: string;
};

// 文の区切りの状態 (トークンを 1 つ読むごとに作成する)
type SplitState = {
	// 括弧の深さ
	readonly depth: number;
	// 行の先頭からこのトークンまでの、強調の記号の連続の数 (インラインコードなどの中は数えない)
	readonly runs: MarkerRuns;
	// このトークンで文を区切るときの、区切りの位置
	readonly boundary: number | undefined;
};

// 連続する行の範囲 (end の行は含まない)
type LineRange = {
	readonly start: number;
	readonly end: number;
};

type Step<S, T> = (state: S, item: T) => S;

type DepthStep = (depth: number) => number;

// 区切った断片を、前の断片につなげるかを判定する
type Joiner = (part: string) => boolean;

type LineFormatter = (
	line: string,
	kind: LineKind,
	next: LineKind | undefined,
) => readonly string[];

const PERIOD = "。";
const LINE_BREAK = "  ";
const CELL_BREAK = "<br>";
const CODE_INDENT = 4;
const TAB_STOP = 4;

const BLANK = /^\s*$/;
const INDENT = /^\s*/;
const SPACES = /^[ \t]*/;
const TRAILING_SPACE = /\s*$/;
const HEADING = /^[ \t]*#{1,6}(?:[ \t]|$)/;
const THEMATIC_BREAK = /^[ \t]*([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const SETEXT_UNDERLINE = /^[ \t]*(?:=+|-+)[ \t]*$/;
const LINK_DEFINITION = /^[ \t]*\[[^\]]+\]:/;
const QUOTE_MARKER = /^[ \t]*> ?/;
const TABLE_ROW = /^[ \t]*\|/;
// 表の見出しと本文の区切りの行 (|、-、: だけの行)
const DELIMITER_ROW =
	/^[ \t]*\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;
const LIST_ITEM = /^[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+/;
// 箇条書きの記号 (記号だけの行を含む)
const LIST_MARKER = /^[ \t]*(?:[-*+]|\d{1,9}[.)])(?:[ \t]|$)/;
const FENCE_OPEN = /^[ \t]*(?<marker>`{3,}|~{3,})(?<info>.*)$/;
const FENCE_CLOSE = /^[ \t]*(?<marker>`{3,}|~{3,})[ \t]*$/;
const FENCE_LIKE = /^[ \t]*(?:`{3,}|~{3,})/;
const HTML_LIKE = /^[ \t]*<[a-zA-Z/!?]/;
const COMMENT_END = /-->/;
const CELL_BREAK_START = /^<br/i;
// 文の末尾の句点 (後ろに続く強調の閉じの記号を含む)
const SENTENCE_END = /。[*_~]*$/;
// 句点の後ろに残った閉じの記号と句点だけの断片 (強調の閉じなど) は、前の文に付ける
const ONLY_MARKUP = /^[\s*_~`)」』\]。]*$/;
// 文の末尾の句点 (続けて書いた句点と、句点の前の空白を含む)
const TRAILING_PERIODS = /(?:\s*。)+$/;

// 本文のトークン。
// 上から順に、エスケープ、インラインコード (開始と同じ数のバッククォートで閉じる。閉じが無ければ記号だけ)、HTML のコメント、HTML のタグ、括弧の開始、括弧の終了、句点、パイプ、それ以外の文字。
// 句点の直後の記号 (`**` `*` `_` `~~`) は、後ろが空白か行末のときだけ、強調の閉じの記号の候補として句点のトークンに含める。
// 句点の直後に記号が続き、その後ろが空白でないとき (開始の記号の可能性がある) は、句点として扱わない。
const INLINE_TOKEN =
	/\\[\s\S]|(`+)(?!`)(?:[\s\S]*?[^`]\1(?!`))?|<!--[\s\S]*?-->|(?<openComment><!--[\s\S]*)|<[a-zA-Z/!?][^<>]*>|(?<open>[(「『[])|(?<close>[)」』\]])|(?<period>。(?<closers>[*_~]+(?=\s|$))?)(?![*_~])|(?<pipe>\|)|(?<text>[^\\`<(「『[)」』\]。|]+)|[\s\S]/g;
// 強調の記号の連続 (** や _ など)
const MARKER_RUN = /\*+|_+|~+/g;
const MARKER_CHARS: readonly string[] = ["*", "_", "~"];

// 名前付きのグループと、トークンの役割の対応
const TOKEN_ROLES: readonly (readonly [string, TokenRole])[] = [
	["openComment", "openComment"],
	["open", "open"],
	["close", "close"],
	["period", "period"],
	["pipe", "pipe"],
	["text", "text"],
];

const DEPTH_STEPS: Readonly<Record<TokenRole, DepthStep>> = {
	open: (depth) => depth + 1,
	close: (depth) => Math.max(0, depth - 1),
	period: (depth) => depth,
	pipe: (depth) => depth,
	openComment: (depth) => depth,
	text: (depth) => depth,
	atom: (depth) => depth,
};

// 1 行で完結し、整形しない要素 (見出し、水平線、リンクの定義)
const SINGLE_LINE_BLOCKS: readonly RegExp[] = [
	HEADING,
	THEMATIC_BREAK,
	LINK_DEFINITION,
];

// 行頭に来ると、段落の続きではない要素になる書き方
const BLOCK_STARTS: readonly RegExp[] = [
	HEADING,
	THEMATIC_BREAK,
	SETEXT_UNDERLINE,
	LINK_DEFINITION,
	QUOTE_MARKER,
	TABLE_ROW,
	LIST_MARKER,
	FENCE_LIKE,
	HTML_LIKE,
];

// 上から順に判定する (最初に一致したものを使う)
const HTML_STARTS: readonly HtmlStart[] = [
	{
		start: /^<(?:script|pre|style|textarea)(?:[\s>]|$)/i,
		end: /<\/(?:script|pre|style|textarea)>/i,
	},
	{ start: /^<!--/, end: COMMENT_END },
	{ start: /^<\?/, end: /\?>/ },
	{ start: /^<!\[CDATA\[/, end: /\]\]>/ },
	{ start: /^<![a-zA-Z]/, end: />/ },
	// そのほかのタグで始まる行は、空行までを HTML のブロックとして扱う
	{ start: /^<\/?[a-zA-Z]/, end: BLANK },
];

const TEXT_KINDS: readonly LineKind[] = [
	"paragraph",
	"listItem",
	"listContinuation",
];

// 表の行の後ろに続くと、表の行になる種類
const TABLE_BODY_KINDS: readonly LineKind[] = ["paragraph", "listContinuation"];

const INITIAL_BLOCK: BlockState = {
	kind: undefined,
	fence: undefined,
	htmlEnd: undefined,
	lists: [],
};

// reduce の途中の状態を、読んだ要素ごとにすべて返す。
// 性能目的の局所ミューテーション: 状態の配列をスプレッドで積み上げると、入力の長さの 2 乗の時間がかかる。
// 計測 (2026-11-27、Node 26): 本文 20,000 行は、スプレッドで 3,138ms、push で 117ms (行ごとに前の行のフェンスをすべて数える旧実装は 4,659ms)。
// 計測 (2026-11-27、Node 26): 1 行に 5,000 文は、スプレッドで 145ms、push で 11ms。
const scanStates = <T, S>(
	items: readonly T[],
	step: Step<S, T>,
	initial: S,
): readonly S[] => {
	const states: S[] = [];

	items.reduce((state, item) => {
		const next = step(state, item);
		// 関数の外から観測されない配列への push (性能目的の局所ミューテーション。計測は関数の上のコメント)
		// ast-grep-ignore: no-array-mutation
		states.push(next);

		return next;
	}, initial);

	return states;
};

// 字下げの幅 (タブは次の 4 の倍数の位置まで進める)
const columnWidth = (text: string): number => {
	return [...text].reduce(
		(width, char) =>
			char === "\t" ? width + TAB_STOP - (width % TAB_STOP) : width + 1,
		0,
	);
};

const indentOf = (line: string): number => {
	return columnWidth(SPACES.exec(line)?.[0] ?? "");
};

const startsBlock = (text: string): boolean => {
	return BLOCK_STARTS.some((pattern) => pattern.test(text));
};

const roleOf = (match: RegExpExecArray): TokenRole => {
	const groups = match.groups ?? {};

	return (
		TOKEN_ROLES.find(([name]) => groups[name] !== undefined)?.[1] ?? "atom"
	);
};

const tokenOf = (match: RegExpExecArray): Token => {
	return {
		role: roleOf(match),
		start: match.index,
		end: match.index + match[0].length,
		closers: match.groups?.closers ?? "",
	};
};

const tokenize = (text: string): readonly Token[] => {
	return Array.from(text.matchAll(INLINE_TOKEN), tokenOf);
};

const countRuns = (runs: MarkerRuns, text: string): MarkerRuns => {
	const chars = Array.from(text.matchAll(MARKER_RUN), (match) =>
		match[0].charAt(0),
	);

	if (chars.length === 0) {
		return runs;
	}

	return Object.fromEntries(
		MARKER_CHARS.map((marker) => [
			marker,
			(runs[marker] ?? 0) + chars.filter((char) => char === marker).length,
		]),
	);
};

// 強調の記号を数える範囲 (本文のトークンと、句点の直後の記号)
const markedText = (text: string, token: Token): string => {
	return token.role === "text"
		? text.slice(token.start, token.end)
		: token.closers;
};

// 句点の直後の記号は、行の先頭からその句点までに同じ記号の連続が奇数回出ている (閉じていない開始の記号がある) ときだけ、強調の閉じの記号として前の文に含めて区切る。
// 偶数回のとき (`次のとおり。* 項目` など) は、開始の記号の可能性があるので、その句点では区切らない。
const closesEmphasis = (runs: MarkerRuns, token: Token): boolean => {
	return (runs[token.closers.charAt(0)] ?? 0) % 2 === 1;
};

const isBoundary = (
	state: SplitState,
	token: Token,
	depth: number,
): boolean => {
	return (
		token.role === "period" &&
		depth === 0 &&
		(token.closers === "" || closesEmphasis(state.runs, token))
	);
};

const splitStepOf = (text: string): Step<SplitState, Token> => {
	return (state, token) => {
		const depth = DEPTH_STEPS[token.role](state.depth);

		return {
			depth,
			runs: countRuns(state.runs, markedText(text, token)),
			boundary: isBoundary(state, token, depth) ? token.end : undefined,
		};
	};
};

const INITIAL_SPLIT: SplitState = { depth: 0, runs: {}, boundary: undefined };

// 括弧、インラインコード、HTML のコメントとタグの外にある句点の直後で、本文を区切る。
// 区切った断片をつなぐと、元の本文になる。
const rawParts = (text: string): readonly string[] => {
	const ends = scanStates(tokenize(text), splitStepOf(text), INITIAL_SPLIT)
		.map((state) => state.boundary)
		.filter((boundary) => boundary !== undefined);

	return [0, ...ends].map((start, index) =>
		text.slice(start, ends[index] ?? text.length),
	);
};

const mergeParts = (
	parts: readonly string[],
	joins: Joiner,
): readonly string[] => {
	const starts = parts.flatMap((part, index) =>
		index > 0 && joins(part) ? [] : [index],
	);

	return starts.map((start, index) =>
		parts.slice(start, starts[index + 1]).join(""),
	);
};

const isMarkupOnly: Joiner = (part) => {
	return ONLY_MARKUP.test(part);
};

// 行頭に来ると別の要素になる断片は、前の文につなげたまま分けない (2 回目の整形で結果が変わるため)。
// 整形した行では文の前後の空白を削除するので、空白を削除した形で判定する。
const joinsInLine: Joiner = (part) => {
	return isMarkupOnly(part) || startsBlock(part.trim());
};

const sentencesOf = (text: string, joins: Joiner): readonly string[] => {
	return mergeParts(rawParts(text), joins)
		.map((part) => part.trim())
		.filter((part) => part !== "");
};

/**
 * 本文を文ごとに分ける (句点は各文の末尾に残す。括弧、かぎ括弧、リンクのテキスト、インラインコードの中の句点では分けない)
 */
export const splitSentences = (text: string): readonly string[] => {
	return sentencesOf(text, isMarkupOnly);
};

const lineSentences = (text: string): readonly string[] => {
	return sentencesOf(text, joinsInLine);
};

// 句点の前の空白も削除する (行末やセルの末尾に空白を残さないため)
const dropPeriod = (sentence: string): string => {
	return sentence.replace(TRAILING_PERIODS, "");
};

const isNotEmpty = (text: string): boolean => {
	return text !== "";
};

const joinCellTexts = (texts: readonly string[]): string => {
	return texts
		.map((text, index) =>
			index === 0 || CELL_BREAK_START.test(text)
				? text
				: `${CELL_BREAK}${text}`,
		)
		.join("");
};

// 表のセル: 句点を書かず、文の区切りは <br> にする
const formatCell = (cell: string): string => {
	const sentences = splitSentences(cell);
	const endsWithPeriod = sentences.at(-1)?.endsWith(PERIOD) === true;
	const texts = sentences.map(dropPeriod).filter(isNotEmpty);

	if ((sentences.length < 2 && !endsWithPeriod) || texts.length === 0) {
		return cell;
	}

	const leading = INDENT.exec(cell)?.[0] ?? "";
	const trailing = TRAILING_SPACE.exec(cell)?.[0] ?? "";

	return `${leading}${joinCellTexts(texts)}${trailing}`;
};

// セルの区切りは、エスケープしたパイプ (\|) とインラインコードの中のパイプを除いたパイプ
const formatTableRow = (line: string): string => {
	const row = line.trimEnd();
	const pipes = tokenize(row)
		.filter((token) => token.role === "pipe")
		.map((token) => token.start);
	const cells = [0, ...pipes.map((pipe) => pipe + 1)].map((start, index) =>
		row.slice(start, pipes[index] ?? row.length),
	);

	return cells.map(formatCell).join("|");
};

const isBulletKind = (kind: LineKind): boolean => {
	return kind === "listItem" || kind === "listContinuation";
};

const prefixOf = (line: string, kind: LineKind): string => {
	const pattern = kind === "listItem" ? LIST_ITEM : INDENT;

	return pattern.exec(line)?.[0] ?? "";
};

const continuationPrefix = (prefix: string, kind: LineKind): string => {
	return kind === "listItem" ? " ".repeat(columnWidth(prefix)) : prefix;
};

const continues = (kind: LineKind, next: LineKind | undefined): boolean => {
	return isBulletKind(kind)
		? next === "listContinuation"
		: next === "paragraph";
};

// 段落: 1 文 1 行。
// 続く行があれば、行末に半角スペース 2 つを付ける。
// 箇条書き: 句点を書かず、文の区切りは行末の半角スペース 2 つと、次の行の字下げにする。
// 整形した行が別の要素で始まるとき (句点を削除した行がコードブロックの開始や見出しになるときなど) は、その行を変えない。
const formatTextLine: LineFormatter = (line, kind, next) => {
	const prefix = prefixOf(line, kind);
	const sentences = lineSentences(line.slice(prefix.length));
	const isBullet = isBulletKind(kind);
	const texts = isBullet
		? sentences.map(dropPeriod).filter(isNotEmpty)
		: sentences;

	if (texts.length === 0 || texts.some(startsBlock)) {
		return [line];
	}

	const endsSentence = isBullet || SENTENCE_END.test(texts.at(-1) ?? "");
	const breakAfterLast = continues(kind, next) && endsSentence;
	const restPrefix = continuationPrefix(prefix, kind);

	return texts.map((text, index) => {
		const head = index === 0 ? prefix : restPrefix;
		const tail = index < texts.length - 1 || breakAfterLast ? LINE_BREAK : "";

		return `${head}${text}${tail}`;
	});
};

const keepLine: LineFormatter = (line) => {
	return [line];
};

const LINE_FORMATTERS: Readonly<Record<LineKind, LineFormatter>> = {
	verbatim: keepLine,
	blank: keepLine,
	// 引用は、まとまりごとに formatQuoteGroup で整形する
	quote: keepLine,
	table: (line) => [formatTableRow(line)],
	listItem: formatTextLine,
	listContinuation: formatTextLine,
	paragraph: formatTextLine,
};

const closesFence = (fence: Fence, line: string): boolean => {
	const marker = FENCE_CLOSE.exec(line)?.groups?.marker ?? "";

	return marker.startsWith(fence.char) && marker.length >= fence.length;
};

// バッククォートのフェンスの情報の文字列には、バッククォートを書けない (書いた行はインラインコード)
const fenceOf = (line: string): Fence | undefined => {
	const groups = FENCE_OPEN.exec(line)?.groups;
	const marker = groups?.marker;

	if (marker === undefined) {
		return undefined;
	}

	if (marker.startsWith("`") && (groups?.info ?? "").includes("`")) {
		return undefined;
	}

	return { char: marker.charAt(0), length: marker.length };
};

const htmlStartOf = (line: string): HtmlOpen | undefined => {
	const text = line.trimStart();
	const html = HTML_STARTS.find((candidate) => candidate.start.test(text));

	if (html === undefined) {
		return undefined;
	}

	const rest = text.replace(html.start, "");

	return { end: html.end.test(rest) ? undefined : html.end };
};

// 行の途中で開き、同じ行で閉じていない HTML のコメントがあるか (インラインコードの中は除く)
const opensComment = (line: string): boolean => {
	return tokenize(line).some((token) => token.role === "openComment");
};

const textKindOf = (state: BlockState, indent: number): LineKind => {
	return state.lists.length > 0 && indent > 0
		? "listContinuation"
		: "paragraph";
};

// コードブロック、HTML のブロック、見出しなどの開始を判定する
const readBlockStart = (
	state: BlockState,
	line: string,
	indent: number,
): BlockState => {
	const fence = fenceOf(line);

	if (fence !== undefined) {
		return { ...state, kind: "verbatim", fence };
	}

	const html = htmlStartOf(line);

	if (html !== undefined) {
		return { ...state, kind: "verbatim", htmlEnd: html.end };
	}

	if (opensComment(line)) {
		return { ...state, kind: "verbatim", htmlEnd: COMMENT_END };
	}

	if (SINGLE_LINE_BLOCKS.some((pattern) => pattern.test(line))) {
		return { ...state, kind: "verbatim" };
	}

	if (QUOTE_MARKER.test(line)) {
		return { ...state, kind: "quote" };
	}

	if (TABLE_ROW.test(line)) {
		return { ...state, kind: "table" };
	}

	const item = LIST_ITEM.exec(line)?.[0];

	if (item !== undefined) {
		return {
			...state,
			kind: "listItem",
			lists: [...state.lists, columnWidth(item)],
		};
	}

	return { ...state, kind: textKindOf(state, indent) };
};

// 段落の続きの行 (前の行が本文で、この行が別の要素で始まらない) は、箇条書きの範囲を変えない。
// それ以外の行は、字下げが項目の内容の位置に届かない項目を閉じる。
// 空行などの後ろで、字下げが項目の内容の位置より 4 つ以上深い行は、字下げのコードブロック。
const readBlock = (state: BlockState, line: string): BlockState => {
	const indent = indentOf(line);
	const afterText = state.kind !== undefined && TEXT_KINDS.includes(state.kind);
	const lazy = afterText && !startsBlock(line);
	const lists = lazy
		? state.lists
		: state.lists.filter((column) => column <= indent);
	const base = lists.at(-1) ?? 0;
	const next = { ...state, lists };

	if (!afterText && indent >= base + CODE_INDENT) {
		return { ...next, kind: "verbatim" };
	}

	return readBlockStart(next, line, indent);
};

const readFenceLine = (
	state: BlockState,
	fence: Fence,
	line: string,
): BlockState => {
	return {
		...state,
		kind: "verbatim",
		fence: closesFence(fence, line) ? undefined : fence,
	};
};

const readHtmlLine = (
	state: BlockState,
	end: RegExp,
	line: string,
): BlockState => {
	return {
		...state,
		kind: BLANK.test(line) ? "blank" : "verbatim",
		htmlEnd: end.test(line) ? undefined : end,
	};
};

const readLine: Step<BlockState, string> = (state, line) => {
	if (state.fence !== undefined) {
		return readFenceLine(state, state.fence, line);
	}

	if (state.htmlEnd !== undefined) {
		return readHtmlLine(state, state.htmlEnd, line);
	}

	if (BLANK.test(line)) {
		return { ...state, kind: "blank" };
	}

	return readBlock(state, line);
};

// setext の見出し (= か - だけの行の直前に続く段落の行) か
const setextFlags = (
	lines: readonly string[],
	kinds: readonly LineKind[],
): readonly boolean[] => {
	const rows = kinds.map((kind, index) => {
		return {
			isParagraph: kind === "paragraph",
			beforeUnderline: SETEXT_UNDERLINE.test(lines[index + 1] ?? ""),
		};
	});

	return scanStates(
		rows.toReversed(),
		(below, row) => row.isParagraph && (row.beforeUnderline || below),
		false,
	).toReversed();
};

const isDelimiterRow = (line: string): boolean => {
	return DELIMITER_ROW.test(line) && line.includes("|");
};

// 表 (GFM) の行か。
// | で始まる行に加えて、区切りの行の直前のパイプを含む行 (見出しの行) と、表の行の後ろに空行を挟まずに続く本文の行も表の行になる。
const tableFlags = (
	lines: readonly string[],
	kinds: readonly LineKind[],
): readonly boolean[] => {
	const rows = kinds.map((kind, index) => {
		const line = lines[index] ?? "";

		return {
			isTable: kind === "table",
			canContinue: TABLE_BODY_KINDS.includes(kind) || isDelimiterRow(line),
			headsTable: line.includes("|") && isDelimiterRow(lines[index + 1] ?? ""),
		};
	});

	return scanStates(
		rows,
		(above, row) =>
			row.isTable || (row.canContinue && (row.headsTable || above)),
		false,
	);
};

// setext の見出しと、表の行のうち | で始まらない行は変えない
const lineKinds = (lines: readonly string[]): readonly LineKind[] => {
	const kinds = scanStates(lines, readLine, INITIAL_BLOCK).map(
		(state) => state.kind ?? "verbatim",
	);
	const setext = setextFlags(lines, kinds);
	const table = tableFlags(lines, kinds);

	return kinds.map((kind, index) =>
		setext[index] === true || (table[index] === true && kind !== "table")
			? "verbatim"
			: kind,
	);
};

const quoteRanges = (kinds: readonly LineKind[]): readonly LineRange[] => {
	const starts = kinds.flatMap((kind, index) =>
		kind === "quote" && kinds[index - 1] !== "quote" ? [index] : [],
	);
	const ends = kinds.flatMap((kind, index) =>
		kind === "quote" && kinds[index + 1] !== "quote" ? [index + 1] : [],
	);

	return starts.map((start, index) => {
		return { start, end: ends[index] ?? kinds.length };
	});
};

// 引用の記号を 1 つ取り除いた中身を、引用の外と同じ関数で整形してから、各行の元の記号を再度付ける
const formatQuoteGroup = (
	lines: readonly string[],
): readonly (readonly string[])[] => {
	const markers = lines.map((line) => QUOTE_MARKER.exec(line)?.[0] ?? "");
	const inner = formatLines(
		lines.map((line, index) => line.slice(markers[index]?.length ?? 0)),
	);

	return inner.map((outputs, index) =>
		outputs.map((output) => `${markers[index] ?? ""}${output}`),
	);
};

const formatQuotes = (
	lines: readonly string[],
	kinds: readonly LineKind[],
): Readonly<Partial<Record<number, readonly string[]>>> => {
	return Object.fromEntries(
		quoteRanges(kinds).flatMap((range) => {
			const outputs = formatQuoteGroup(lines.slice(range.start, range.end));

			return outputs.map((output, offset) => [range.start + offset, output]);
		}),
	);
};

// 入力の行ごとに、整形した行 (1 行以上) を返す
const formatLines = (
	lines: readonly string[],
): readonly (readonly string[])[] => {
	const kinds = lineKinds(lines);
	const quoted = formatQuotes(lines, kinds);

	return lines.map((line, index) => {
		const kind = kinds[index] ?? "verbatim";

		return quoted[index] ?? LINE_FORMATTERS[kind](line, kind, kinds[index + 1]);
	});
};

// 先頭の frontmatter (--- で囲んだ範囲) の行数
const frontmatterLength = (lines: readonly string[]): number => {
	const close = lines[0] === "---" ? lines.indexOf("---", 1) : -1;

	return close === -1 ? 0 : close + 1;
};

/**
 * Markdown の本文を、改行のルールに合わせて整形する (整形済みの本文は変えない)
 */
export const formatMarkdown = (text: string): string => {
	const lines = text.split("\n");
	const head = frontmatterLength(lines);

	return [
		...lines.slice(0, head),
		...formatLines(lines.slice(head)).flat(),
	].join("\n");
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
