import { splitSentences } from "../markdown/format.ts";
import { normalizePath } from "../shared/path.ts";

// コードのコメントが 1 文 1 行になっているかを判定する純粋関数。
// ルールは .claude/rules/code-style.md の「コメント」。
// 検査は scripts/comments/check.ts。
// 検査の対象は日本語の文 (句点「。」で区切る文) だけで、英語の文 (ピリオドで区切る文) は対象にしない。

/**
 * 1 行に複数の文があるコメント 1 件 (行番号は 1 始まり)
 */
export type CommentViolation = {
	readonly path: string;
	readonly line: number;
	readonly text: string;
};

type CommentStyle = {
	readonly files: RegExp;
	// 行の全体がコメントのときに、コメントの本文を 1 番目のグループで返す (先頭から順に試す)。
	// 本文の前後の空白は、照合の後で取り除く (正規表現で取り除くと、長い空白の並びで照合が 2 乗の時間になるため)
	readonly comments: readonly RegExp[];
	// ブロックのコメントの続きの行 (行の先頭がブロックのコメントの中にある行だけに適用する)
	readonly continuation?: RegExp;
	// ブロックのコメント全体を 1 番目のグループで囲む (split でコードとコメントに分けるため)
	readonly block?: RegExp;
};

/**
 * 行に書くと、その行の検査を省略する文字列 (言い回しの検査と同じ)
 */
export const IGNORE_MARK = "wording-ok";

const COMMENT_STYLES: readonly CommentStyle[] = [
	{
		files: /\.(?:ts|tsx|mts|cts|js|mjs|cjs|css)$/,
		comments: [
			// `//` のコメント
			/^\s*\/\/+\s?(.*)$/,
			// `/*` と `/**` で始まる行 (本文は `*/` の前まで。`*/` の後ろのコードは本文に含めない)
			/^\s*\/\*+(.*?)(?:\*+\/.*)?$/,
		],
		// JSDoc などの ` * ` で始まる行 (`*/` の前まで)。
		// ブロックのコメントの外 (テンプレートリテラルの中など) の `*` で始まる行は、コメントとみなさない
		continuation: /^\s*\*(?!\/)(.*?)(?:\*+\/.*)?$/,
		// `/*` から `*/` まで (閉じていなければファイルの末尾まで)
		block: /(\/\*[\s\S]*?(?:\*\/|$))/,
	},
	{
		files: /(?:\.(?:sh|yml|yaml)|(?:^|\/)justfile)$/,
		comments: [/^\s*#+\s?(.*)$/],
	},
];

const EXCLUDED_PATTERNS: readonly RegExp[] = [
	/(?:^|\/)node_modules\//,
	/(?:^|\/)dist\//,
	/(?:^|\/)pnpm-lock\.yaml$/,
];

const styleOf = (path: string): CommentStyle | undefined => {
	return COMMENT_STYLES.find((style) => style.files.test(path));
};

/**
 * 検査対象のパスかを判定する (リポジトリ直下からの相対パス。先頭の ./ などは取り除いてから判定する)
 */
export const isTarget = (path: string): boolean => {
	const normalized = normalizePath(path);

	return (
		styleOf(normalized) !== undefined &&
		!EXCLUDED_PATTERNS.some((pattern) => pattern.test(normalized))
	);
};

// 行ごとに、行の先頭がブロックのコメントの中 (`/*` より後ろ) にあるかを返す。
// block で split すると、コードとブロックのコメントが交互に並ぶ (奇数番目がコメント)。
// 各部分の中の改行の後ろが次の行の先頭なので、その行はその部分の種類に従う。
const blockLineFlags = (
	text: string,
	style: CommentStyle,
): readonly boolean[] => {
	if (style.block === undefined) {
		return text.split("\n").map(() => false);
	}

	return [
		false,
		...text.split(style.block).flatMap((part, index) => {
			return part
				.split("\n")
				.slice(1)
				.map(() => index % 2 === 1);
		}),
	];
};

const bodyOf = (
	line: string,
	inBlock: boolean,
	style: CommentStyle,
): string | undefined => {
	const patterns =
		inBlock && style.continuation !== undefined
			? [...style.comments, style.continuation]
			: style.comments;

	return patterns
		.map((pattern) => pattern.exec(line)?.[1]?.trim())
		.find((body) => body !== undefined);
};

const hasMultipleSentences = (
	line: string,
	inBlock: boolean,
	style: CommentStyle,
): boolean => {
	const text = bodyOf(line, inBlock, style);

	if (text === undefined || line.includes(IGNORE_MARK)) {
		return false;
	}

	return splitSentences(text).length > 1;
};

/**
 * ファイルの本文から、1 行に複数の文があるコメントを返す。
 * 行の全体がコメントの行だけを検査する (コードの後ろに書いたコメントは検査しない)。
 */
export const findCommentViolations = (
	path: string,
	text: string,
): readonly CommentViolation[] => {
	const style = styleOf(path);

	if (style === undefined) {
		return [];
	}

	const inBlock = blockLineFlags(text, style);

	return text.split("\n").flatMap((line, index) => {
		const trimmed = line.trim();

		return hasMultipleSentences(trimmed, inBlock[index] ?? false, style)
			? [{ path, line: index + 1, text: trimmed }]
			: [];
	});
};

/**
 * 違反 1 件を「パス:行: 内容」の 1 行にする
 */
export const formatViolation = (violation: CommentViolation): string => {
	return `${violation.path}:${violation.line}: ${violation.text}`;
};
