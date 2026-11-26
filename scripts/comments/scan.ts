import { splitSentences } from "../markdown/format.ts";

// コードのコメントが 1 文 1 行になっているかを判定する純粋関数。
// ルールは .claude/rules/code-style.md の「コメント」。
// 検査は scripts/comments/check.ts。

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
	// 行の全体がコメントのときに、コメントの本文を 1 番目のグループで返す
	readonly comment: RegExp;
};

/**
 * 行に書くと、その行の検査を省略する文字列 (言い回しの検査と同じ)
 */
export const IGNORE_MARK = "wording-ok";

const COMMENT_STYLES: readonly CommentStyle[] = [
	{
		// `//`、`/*`、JSDoc の ` * `
		files: /\.(?:ts|tsx|mts|cts|js|mjs|cjs|css)$/,
		comment: /^\s*(?:\/\/+|\/\*+|\*)\s?(.*)$/,
	},
	{
		files: /(?:\.(?:sh|yml|yaml)|(?:^|\/)justfile)$/,
		comment: /^\s*#+\s?(.*)$/,
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
 * 検査対象のパスかを判定する (リポジトリ直下からの相対パス)
 */
export const isTarget = (path: string): boolean => {
	return (
		styleOf(path) !== undefined &&
		!EXCLUDED_PATTERNS.some((pattern) => pattern.test(path))
	);
};

const hasMultipleSentences = (line: string, style: CommentStyle): boolean => {
	const text = style.comment.exec(line)?.[1];

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

	return text
		.split("\n")
		.map((line, index): CommentViolation => {
			return { path, line: index + 1, text: line.trim() };
		})
		.filter((candidate) => hasMultipleSentences(candidate.text, style));
};

/**
 * 違反 1 件を「パス:行: 内容」の 1 行にする
 */
export const formatViolation = (violation: CommentViolation): string => {
	return `${violation.path}:${violation.line}: ${violation.text}`;
};
