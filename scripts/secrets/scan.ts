import { normalizePath } from "../shared/path.ts";
import type { SecretRule } from "./rules.ts";

/**
 * シークレットに見える行 1 件 (行番号は 1 始まり)。
 * 検出した文字列そのものは持たない (ログに出力しないため)。
 */
export type SecretFinding = {
	readonly path: string;
	readonly line: number;
	readonly ruleId: string;
	readonly label: string;
};

/**
 * 行に書くと、その行の検査を省略する文字列 (見本の値など、意図的な例外に使う)
 */
export const IGNORE_MARK = "secrets-ok";

// 画像、フォントなど、テキストではないファイル
const BINARY_PATTERN =
	/\.(?:png|jpe?g|gif|webp|ico|pdf|zip|gz|woff2?|ttf|otf|mp4|mov)$/i;

// 検査しないパス
const EXCLUDED_PATTERNS: readonly RegExp[] = [
	/(?:^|\/)node_modules\//,
	/(?:^|\/)dist\//,
	/(?:^|\/)pnpm-lock\.yaml$/,
	// ルールとテストは、検査する形の見本を含む
	/^scripts\/secrets\//,
];

/**
 * 検査対象のパスかを判定する (リポジトリ直下からの相対パス。先頭の ./ などは取り除いてから判定する)
 */
export const isTarget = (path: string): boolean => {
	const normalized = normalizePath(path);

	return (
		!BINARY_PATTERN.test(normalized) &&
		!EXCLUDED_PATTERNS.some((pattern) => pattern.test(normalized))
	);
};

const matchedRule = (
	line: string,
	rules: readonly SecretRule[],
): SecretRule | undefined => {
	if (line.includes(IGNORE_MARK)) {
		return undefined;
	}

	return rules.find((rule) => rule.pattern.test(line));
};

/**
 * ファイルの本文から、シークレットに見える行を返す (1 行につき、最初に一致したルール 1 件)
 */
export const findSecrets = (
	path: string,
	text: string,
	rules: readonly SecretRule[],
): readonly SecretFinding[] => {
	return text.split("\n").flatMap((line, index) => {
		const rule = matchedRule(line, rules);

		return rule === undefined
			? []
			: [{ path, line: index + 1, ruleId: rule.id, label: rule.label }];
	});
};

/**
 * 検出 1 件を「パス:行: [ルール] 内容」の 1 行にする
 */
export const formatFinding = (finding: SecretFinding): string => {
	return `${finding.path}:${finding.line}: [${finding.ruleId}] ${finding.label}`;
};
