import { posix } from "node:path";

// AI が dotenv のファイルを読むこと、編集することを拒否するための判定。
// Claude Code の PreToolUse hook (scripts/hooks/deny-env-access.ts) が使う。
// ルールは .claude/rules/security.md。
//
// 対象の名前:
//   - パスの最後の要素が .env であるか、.env. で始まるもの (.env.example を除く) と、.envrc
//   - 大文字と小文字は区別しない (.ENV、.Env.Local も対象にする)
//   - 途中の要素は対象にしない (例: Python の仮想環境の .env/bin/activate)
//
// 判定できる範囲:
//   - Read / Edit / Write / NotebookEdit: 対象のファイルのパス
//   - Grep / Glob: 検索するパスと、ファイル名のパターン
//   - Bash: コマンドの語に、対象の名前があるか
//   - ワイルドカード (* ? [...]) とブレース ({a,b}) の指定は、対象の名前に一致するかで判定する
//   - Bash の語は、空白と、シェルの演算子 (< > | ; & ( )) と、= : で分ける
//   - bash -c "..." と eval "..." の文字列と、二重引用符の中のコマンド置換は、コマンドとして判定する
//   - ヒアドキュメントの本文は判定しない。
//     ただし、シェルやインタプリタが本文を受け取るときと、本文の中のコマンド置換は判定する
//   - 上記以外の、空白を含む引用符の文字列は、説明の文として扱う (コミットメッセージ、PR の本文など)
//
// 判定できない範囲 (この hook では拒否できない):
//   - 変数やコマンド置換で名前を組み立てるコマンド (例: f=.e; cat ${f}nv)
//   - スクリプトの中でファイルを開く処理 (例: node -e の中の readFileSync)
//   - ファイルを名指ししない検索 (例: grep -r pattern .、find . -name '*.env')
//   - bash -c と eval 以外で、引用符の文字列をコマンドとして実行するもの (例: ssh host "cat ...")
//   - 長い指定やブレースの多い指定の、ワイルドカードの判定 (下の MAX_GLOB_LENGTH と MAX_BRACES)
//   - 引用符の中の << (例: echo 'a <<EOF') をヒアドキュメントとして扱い、終端の行までを判定しないこと
//   - matcher (.claude/settings.json) に無いツール

type Word = {
	// 引用符とバックスラッシュを取り除いた値
	readonly value: string;
	// 単一引用符の部分を除いた元の文字列 (コマンド置換を探す対象)
	readonly code: string;
};

// パスの最後の要素が .env であるか、.env. で始まる名前 (小文字にそろえてから比較する)
const ENV_FILE = /^\.env(?:\.[\s\S]*)?$/;
const EXTRA_NAMES: readonly string[] = [".envrc"];
const ALLOWED_NAMES: readonly string[] = [".env.example"];

// ワイルドカードとブレースの指定を照合する名前
const GLOB_TARGETS: readonly string[] = [
	".env",
	".env.local",
	".env.production",
	".envrc",
];
const GLOB_CHARS = /[*?[{]|[@!+]\(/;
// ブレースの範囲 ({1..9}、{a..z}) は、展開せずに * として扱う (展開すると時間がかかるため)
const BRACE_RANGE = /\{[^{},]*\.\.[^{},]*\}/g;
// ブレースが多い指定は、展開の数が増えて時間がかかるので、ブレースの全体を * として扱う
const MAX_BRACES = 4;
// これより長い指定は、ワイルドカードの判定をしない
const MAX_GLOB_LENGTH = 256;

// Read などのパスは / と \ で分ける。
// Bash の語は / だけで分ける (\.env のような正規表現を、パスとして扱わないため)。
const FILE_SEPARATOR = /[/\\]/;
const BASH_SEPARATOR = /\//;
const BRACE_PIECE_SEPARATOR = /[{},]/;

// 行の継続 (バックスラッシュと改行)
const LINE_CONTINUATION = /\\\n/g;

// ヒアドキュメント (<<TAG から、終端の行まで)。
// 終端の名前は、引用符で囲む形とバックスラッシュで始める形も受け付ける。
// 1 番目から 3 番目のグループ (<<- の形) と、4 番目から 6 番目のグループ (<< の形) のどれか 1 つが終端の名前になる。
// <<- の形だけ、終端の行の先頭のタブを許す。
const HEREDOC_HEADER = String.raw`[ \t]*(?:'([^'\n]*)'|"([^"\n]*)"|\\?([^\s'"<>|;&()]+))[^\n]*\n(?:[^\n]*\n)*?`;
const HEREDOC = new RegExp(
	[
		String.raw`(?<!<)<<-${HEREDOC_HEADER}\t*(?:\1\2\3)(?=\n|$)`,
		String.raw`(?<!<)<<(?![-<])${HEREDOC_HEADER}(?:\4\5\6)(?=\n|$)`,
	].join("|"),
	"g",
);
const QUOTED_HEREDOC = /^<<-?[ \t]*['"\\]/;
const HEREDOC_OPERATOR = /<</g;
// << が多いコマンドは、本文の範囲を求める処理に時間がかかるので、本文を除外しない (すべて判定する)
const MAX_HEREDOCS = 100;

// ヒアドキュメントの本文を受け取ると、本文をコマンドとして実行するもの
const INTERPRETERS: readonly string[] = [
	"sh",
	"bash",
	"zsh",
	"dash",
	"ksh",
	"fish",
	"eval",
	"source",
	".",
	"python",
	"node",
	"deno",
	"bun",
	"ruby",
	"perl",
	"php",
	"xargs",
];
// python3、python3.12 のようなバージョンの番号
const VERSION_SUFFIX = /(?<=[a-z])[\d.]+$/;
// <<TAG の行の語 (引用符の中の語も含める)
const HEADER_WORD = /[^\s'"<>|;&()=:`]+/g;

// 1 つのコマンドの範囲 (区切りは、引用符の外の ; & | ( ) 改行 `)
const SEGMENT =
	/(?:'[^']*'?|"(?:[^"\\]|\\[\s\S])*\\?"?|\\[\s\S]|\\$|[^'"\\;&|()\n`])+/g;
// 1 つの語の範囲 (区切りは、引用符の外の空白と < > = :)
const WORD =
	/(?:'[^']*'?|"(?:[^"\\]|\\[\s\S])*\\?"?|\\[\s\S]|\\$|[^'"\\\s<>=:])+/g;
// 語の中の部分 (単一引用符、二重引用符、バックスラッシュ、それ以外)
const WORD_PART =
	/'([^']*)'?|"((?:[^"\\]|\\[\s\S])*)\\?"?|\\([\s\S]?)|([^'"\\]+)/g;
// 二重引用符の中で、バックスラッシュが機能する文字
const DOUBLE_QUOTE_ESCAPE = /\\([$`"\\])/g;
// コマンド置換 ($(...) と `...`) の中身 (入れ子は扱わない)
const COMMAND_SUBSTITUTION = /(?<!\\)\$\(([^)]*)\)?|(?<!\\)`([^`]*)`?/g;
// 直後の文字列をコマンドとして実行するオプション (-c と、-lc のように -c を含むもの)
const COMMAND_OPTION = /^-[a-z]*c[a-z]*$/i;
const WHITESPACE = /\s/;

// ツールごとの、パスかファイル名のパターンが入る項目
const FILE_TOOL_FIELDS: Readonly<Record<string, readonly string[]>> = {
	Read: ["file_path"],
	Edit: ["file_path"],
	Write: ["file_path"],
	NotebookEdit: ["notebook_path"],
	Grep: ["path", "glob"],
	Glob: ["path", "pattern"],
};

const isDefined = <T>(value: T | undefined): value is T => {
	return value !== undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
	return typeof value === "object" && value !== null;
};

const stringField = (record: Record<string, unknown>, key: string): string => {
	const value = record[key];

	return typeof value === "string" ? value : "";
};

/**
 * ファイルの名前が、拒否する対象かを判定する (大文字と小文字は区別しない)
 */
export const isEnvFile = (name: string): boolean => {
	const lower = name.toLowerCase();

	return (
		(ENV_FILE.test(lower) || EXTRA_NAMES.includes(lower)) &&
		!ALLOWED_NAMES.includes(lower)
	);
};

const simplifyBraces = (pattern: string): string => {
	const ranged = pattern.replace(BRACE_RANGE, "*");
	const braces = ranged.split("{").length - 1;

	return braces > MAX_BRACES ? ranged.replace(/\{[\s\S]*\}/, "*") : ranged;
};

const matchesEnvGlob = (name: string): boolean => {
	if (!GLOB_CHARS.test(name) || name.length > MAX_GLOB_LENGTH) {
		return false;
	}

	const pattern = simplifyBraces(name.toLowerCase());

	return GLOB_TARGETS.some((target) => posix.matchesGlob(target, pattern));
};

const isEnvName = (name: string): boolean => {
	return isEnvFile(name) || matchesEnvGlob(name);
};

const lastElement = (path: string, separator: RegExp): string => {
	return path.split(separator).at(-1) ?? "";
};

// パスの最後の要素と、ブレースの中の各候補 ({a/.env,b} の a/.env など) の最後の要素
const nameCandidates = (path: string, separator: RegExp): string[] => {
	const pieces = path.includes("{") ? path.split(BRACE_PIECE_SEPARATOR) : [];

	return [path, ...pieces].map((piece) => lastElement(piece, separator));
};

const envNameInElements = (
	path: string,
	separator: RegExp,
): string | undefined => {
	return nameCandidates(path, separator).find(isEnvName);
};

/**
 * Read などのツールのパスから、拒否する対象の名前を探す (/ と \ で分け、最後の要素を判定する)
 */
export const envNameInPath = (path: string): string | undefined => {
	return envNameInElements(path, FILE_SEPARATOR);
};

const commandName = (word: string): string => {
	return lastElement(word, BASH_SEPARATOR).replace(VERSION_SUFFIX, "");
};

const feedsInterpreter = (headerLine: string): boolean => {
	return (headerLine.match(HEADER_WORD) ?? [])
		.map(commandName)
		.some((name) => INTERPRETERS.includes(name));
};

const substitutionsIn = (code: string): string[] => {
	return Array.from(
		code.matchAll(COMMAND_SUBSTITUTION),
		(match) => match[1] ?? match[2] ?? "",
	);
};

// ヒアドキュメントの本文のうち、判定するもの
const heredocBodyToJudge = (
	headerLine: string,
	body: string,
	quoted: boolean,
): string => {
	if (feedsInterpreter(headerLine)) {
		return body;
	}

	// 終端の名前を引用符で囲まない形では、本文の中のコマンド置換をシェルが実行する
	return quoted ? "" : substitutionsIn(body).join("\n");
};

// ヒアドキュメント 1 つを、判定する文字列に置き換える (<<TAG の行の残りは残す)
const replaceHeredoc = (text: string, match: RegExpExecArray): string => {
	const source = match[0];
	const headerEnd = source.indexOf("\n");
	const lineStart = text.lastIndexOf("\n", match.index) + 1;
	const headerLine = text.slice(lineStart, match.index + headerEnd);
	const body = source.slice(headerEnd + 1, source.lastIndexOf("\n"));
	const judged = heredocBodyToJudge(
		headerLine,
		body,
		QUOTED_HEREDOC.test(source),
	);

	return `${source.slice(0, headerEnd)}\n${judged}\n`;
};

const matchEnd = (match: RegExpExecArray | undefined): number => {
	return match === undefined ? 0 : match.index + match[0].length;
};

const stripHeredocs = (text: string): string => {
	if ((text.match(HEREDOC_OPERATOR) ?? []).length > MAX_HEREDOCS) {
		return text;
	}

	const matches = Array.from(text.matchAll(HEREDOC));
	const replaced = matches.map(
		(match, index) =>
			text.slice(matchEnd(matches[index - 1]), match.index) +
			replaceHeredoc(text, match),
	);

	return [...replaced, text.slice(matchEnd(matches.at(-1)))].join("");
};

const unescapeDoubleQuoted = (text: string): string => {
	return text.replace(DOUBLE_QUOTE_ESCAPE, "$1");
};

// 語の中の部分 1 つの、値と、コマンド置換を探す対象の文字列
const wordPart = (match: RegExpExecArray): Word => {
	const [, single, double, escaped, plain] = match;

	if (single !== undefined) {
		return { value: single, code: " " };
	}

	if (double !== undefined) {
		return { value: unescapeDoubleQuoted(double), code: double };
	}

	if (escaped !== undefined) {
		return { value: escaped, code: " " };
	}

	return { value: plain ?? "", code: plain ?? "" };
};

const parseWord = (raw: string): Word => {
	const parts = Array.from(raw.matchAll(WORD_PART), wordPart);

	return {
		value: parts.map((part) => part.value).join(""),
		code: parts.map((part) => part.code).join(""),
	};
};

const wordsIn = (segment: string): Word[] => {
	return Array.from(segment.matchAll(WORD), (match) => parseWord(match[0]));
};

const segmentsIn = (command: string): string[] => {
	return Array.from(command.matchAll(SEGMENT), (match) => match[0]);
};

/**
 * Bash のコマンドを語に分ける (引用符の中の空白と演算子では分けない)。
 * 値は、引用符とバックスラッシュを取り除いたもの。
 * 引用符が閉じていないときは、最後までを 1 つの語にする。
 */
export const splitArguments = (command: string): readonly string[] => {
	return segmentsIn(command).flatMap((segment) =>
		wordsIn(segment).map((word) => word.value),
	);
};

// 空白を含む語は、説明の文として扱う。
// ただし、最後の / の後ろに空白が無いとき (例: "my dir/.env") は、パスとして判定する。
const envNameInSentence = (value: string): string | undefined => {
	const last = lastElement(value, BASH_SEPARATOR);

	return WHITESPACE.test(last)
		? undefined
		: envNameInElements(last, BASH_SEPARATOR);
};

const envNameInWord = (
	word: Word,
	runsAsCommand: boolean,
): string | undefined => {
	if (runsAsCommand) {
		return envNameInCommand(word.value);
	}

	const inSubstitution = substitutionsIn(word.code)
		.map(envNameInCommand)
		.find(isDefined);

	if (inSubstitution !== undefined) {
		return inSubstitution;
	}

	return WHITESPACE.test(word.value)
		? envNameInSentence(word.value)
		: envNameInElements(word.value, BASH_SEPARATOR);
};

// 語をコマンドとして判定するか (直前の語が -c か、eval の後ろの語)
const runsAsCommand = (
	words: readonly Word[],
	evalIndex: number,
	index: number,
): boolean => {
	const previous = words[index - 1];

	return (
		(evalIndex !== -1 && index > evalIndex) ||
		(previous !== undefined && COMMAND_OPTION.test(previous.value))
	);
};

const envNameInSegment = (segment: string): string | undefined => {
	const words = wordsIn(segment);
	const evalIndex = words.findIndex(
		(word) => commandName(word.value) === "eval",
	);

	return words
		.values()
		.map((word, index) =>
			envNameInWord(word, runsAsCommand(words, evalIndex, index)),
		)
		.find(isDefined);
};

/**
 * Bash のコマンドから、拒否する対象の名前を探す
 */
export const envNameInCommand = (command: string): string | undefined => {
	const text = stripHeredocs(command.replace(LINE_CONTINUATION, ""));

	return segmentsIn(text).values().map(envNameInSegment).find(isDefined);
};

const fileToolFields = (toolName: string): readonly string[] => {
	return Object.hasOwn(FILE_TOOL_FIELDS, toolName)
		? (FILE_TOOL_FIELDS[toolName] ?? [])
		: [];
};

/**
 * ツールの入力から、拒否する対象の名前を探す。
 * 対象が無いとき、入力の形が想定と違うときは undefined を返す。
 */
export const deniedEnvName = (payload: unknown): string | undefined => {
	if (!isRecord(payload) || !isRecord(payload.tool_input)) {
		return undefined;
	}

	const toolName = stringField(payload, "tool_name");
	const toolInput = payload.tool_input;

	if (toolName === "Bash") {
		return envNameInCommand(stringField(toolInput, "command"));
	}

	return fileToolFields(toolName)
		.map((key) => envNameInPath(stringField(toolInput, key)))
		.find(isDefined);
};

/**
 * 拒否の理由 (AI に返す文)
 */
export const denyMessage = (name: string): string => {
	return [
		`.env のファイル (${name}) は、読むことも編集することもできません (.claude/rules/security.md)。`,
		"値が必要なときは、変数の名前だけを .env.example で確認するか、ユーザーに確認してください。",
	].join("");
};
