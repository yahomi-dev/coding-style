// AI が .env のファイルを読むこと、編集することを拒否するための判定。
// Claude Code の PreToolUse hook (scripts/hooks/deny-env-access.ts) が使う。
// ルールは .claude/rules/security.md。
//
// 判定できる範囲:
//   - Read / Edit / Write / NotebookEdit: 対象のファイルのパス
//   - Grep / Glob: 検索するパスと、ファイル名のパターン
//   - Bash: コマンドの引数に、.env のファイルの名前があるか
//
// 判定できない範囲 (この hook では拒否できない):
//   - ファイルを名指ししないコマンド (例: grep -r pattern .)
//   - スクリプトの中でファイルを開く処理

type QuoteChar = '"' | "'";

type SplitState = {
	readonly tokens: readonly string[];
	readonly current: string;
	// 引用符で始めた空の引数 ("") も 1 つの引数として残すための属性
	readonly started: boolean;
	readonly quote: QuoteChar | undefined;
	readonly escaped: boolean;
};

// .env、.env.local、.env.production など。
// .env* のようなワイルドカードの指定も対象にする。
const ENV_FILE = /^\.env(?:[.*?[].*)?$/;
const ALLOWED_NAMES: readonly string[] = [".env.example"];

// ヒアドキュメントの本文 (<<EOF から EOF まで)。
// 本文はコマンドの引数ではないので、判定から除外する。
const HEREDOC = /<<-?\s*(['"]?)(\w+)\1[\s\S]*?\n\2\b/g;

// 引数の前後に付く記号 (リダイレクト、括弧、区切り)
const EDGE_CHARS = /^[<>()[\]{};,&|"'`$]+|[<>()[\]{};,&|"'`$]+$/g;

// 引用符で囲んだ文字列の中で、ファイルを読むコマンドとして扱う語
const READ_COMMANDS: readonly string[] = [
	"cat",
	"less",
	"more",
	"head",
	"tail",
	"bat",
	"grep",
	"rg",
	"sed",
	"awk",
	"cut",
	"sort",
	"uniq",
	"wc",
	"tee",
	"diff",
	"nl",
	"tac",
	"source",
	".",
	"cp",
	"mv",
	"scp",
	"rsync",
	"base64",
	"xxd",
	"od",
	"strings",
	"vi",
	"vim",
	"nano",
	"code",
	"open",
	"jq",
	"yq",
	"python",
	"python3",
	"node",
	"sh",
	"bash",
	"zsh",
	"env",
	"export",
];

// ツールごとの、パスかファイル名のパターンが入る項目
const FILE_TOOL_FIELDS: Readonly<Record<string, readonly string[]>> = {
	Read: ["file_path"],
	Edit: ["file_path"],
	Write: ["file_path"],
	NotebookEdit: ["notebook_path"],
	Grep: ["path", "glob"],
	Glob: ["path", "pattern"],
};

const INITIAL_STATE: SplitState = {
	tokens: [],
	current: "",
	started: false,
	quote: undefined,
	escaped: false,
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
 * ファイルの名前が、拒否する対象かを判定する
 */
export const isEnvFile = (name: string): boolean => {
	return ENV_FILE.test(name) && !ALLOWED_NAMES.includes(name);
};

/**
 * パスの各要素から、拒否する対象の名前を探す (ファイル名のパターンも含む)
 */
export const envNameInPath = (path: string): string | undefined => {
	return path.split(/[/\\]/).find(isEnvFile);
};

const append = (state: SplitState, char: string): SplitState => {
	return { ...state, current: state.current + char, started: true };
};

const endToken = (state: SplitState): SplitState => {
	return state.started
		? {
				...state,
				tokens: [...state.tokens, state.current],
				current: "",
				started: false,
			}
		: state;
};

const isQuoteChar = (char: string): char is QuoteChar => {
	return char === '"' || char === "'";
};

// シェルの引数の区切りを、引用符とバックスラッシュを考慮して 1 文字ずつ判定する
const splitChar = (state: SplitState, char: string): SplitState => {
	if (state.escaped) {
		return { ...append(state, char), escaped: false };
	}

	if (char === "\\" && state.quote !== "'") {
		return { ...state, escaped: true, started: true };
	}

	if (state.quote !== undefined) {
		return char === state.quote
			? { ...state, quote: undefined }
			: append(state, char);
	}

	if (isQuoteChar(char)) {
		return { ...state, quote: char, started: true };
	}

	return /\s/.test(char) ? endToken(state) : append(state, char);
};

/**
 * Bash のコマンドを引数に分ける (引用符の中の空白では分けない)。
 * 引用符が閉じていないときは、最後までを 1 つの引数にする。
 */
export const splitArguments = (command: string): readonly string[] => {
	return endToken([...command].reduce(splitChar, INITIAL_STATE)).tokens;
};

const envNameAfterReadCommand = (
	words: readonly string[],
): string | undefined => {
	const index = words.findIndex((word) => READ_COMMANDS.includes(word));

	return index === -1
		? undefined
		: words
				.slice(index + 1)
				.map(envNameInPath)
				.find(isDefined);
};

// 引数 1 つから、拒否する対象の名前を探す
const envNameInArgument = (argument: string): string | undefined => {
	// --env-file=.env や VAR=$(cat .env) のように、記号で連結された引数を分ける
	const words = argument
		.split(/[=:\s]/)
		.map((piece) => piece.replace(EDGE_CHARS, ""));

	// 空白を含む引数 (引用符で囲んだ文字列) は、説明の文のことが多い。
	// bash -c "cat .env" のように、ファイルを読むコマンドの後ろに名前があるときだけ拒否する。
	return /\s/.test(argument)
		? envNameAfterReadCommand(words)
		: words.map(envNameInPath).find(isDefined);
};

/**
 * Bash のコマンドの引数から、拒否する対象の名前を探す
 */
export const envNameInCommand = (command: string): string | undefined => {
	return splitArguments(command.replace(HEREDOC, ""))
		.map(envNameInArgument)
		.find(isDefined);
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

	return (FILE_TOOL_FIELDS[toolName] ?? [])
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
