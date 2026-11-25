import type { WordingRule } from "./rules.ts";

/**
 * 1 行の中の違反 1 件
 */
export type Violation = {
	readonly ruleId: string;
	readonly column: number;
	readonly context: string;
	readonly message: string;
};

/**
 * ファイルの中の違反 1 件 (行番号は 1 始まり)
 */
export type FileViolation = Violation & {
	readonly path: string;
	readonly line: number;
};

/**
 * 行に書くと、その行の検査を省略する文字列 (規則の説明文など、意図的な例外に使う)
 */
export const IGNORE_MARK = "wording-ok";

const CONTEXT_WIDTH = 12;

type Range = readonly [number, number];

const rangesOf = (line: string, pattern: RegExp): readonly Range[] => {
	return [...line.matchAll(new RegExp(pattern, "g"))].map((m): Range => {
		return [m.index, m.index + m[0].length];
	});
};

const overlaps = (a: Range, b: Range): boolean => {
	return a[0] < b[1] && b[0] < a[1];
};

/**
 * 1 行に規則を適用して、違反の一覧を返す。
 * 除外の語は、候補と重なる範囲にあるときだけ適用する (同じ行の別の出現は検出する)。
 */
export const findViolations = (
	line: string,
	rules: readonly WordingRule[],
): readonly Violation[] => {
	if (line.includes(IGNORE_MARK)) {
		return [];
	}

	return rules.flatMap((rule) => {
		const excluded =
			rule.exclude === undefined ? [] : rangesOf(line, rule.exclude);

		return rangesOf(line, rule.pattern)
			.filter((hit) => !excluded.some((range) => overlaps(hit, range)))
			.map((hit): Violation => {
				return {
					ruleId: rule.id,
					column: hit[0] + 1,
					context: line
						.slice(Math.max(0, hit[0] - CONTEXT_WIDTH), hit[1] + CONTEXT_WIDTH)
						.trim(),
					message: rule.message,
				};
			});
	});
};

/**
 * ファイルの本文を行ごとに検査する
 */
export const checkText = (
	path: string,
	text: string,
	rules: readonly WordingRule[],
): readonly FileViolation[] => {
	return text.split("\n").flatMap((line, index) => {
		return findViolations(line, rules).map((violation): FileViolation => {
			return { ...violation, path, line: index + 1 };
		});
	});
};

const TARGET_PATTERN =
	/(?:\.(?:md|mmd|ts|tsx|mts|cts|js|mjs|cjs|css|json|yaml|yml|sh)|(?:^|\/)justfile)$/;

// 検査しないパス。生成物や外部からコピーしたファイルがあるプロジェクトは、ここに追加する
const EXCLUDED_PATTERNS: readonly RegExp[] = [
	/(?:^|\/)node_modules\//,
	/(?:^|\/)dist\//,
	/(?:^|\/)pnpm-lock\.yaml$/,
	// 規則とテストは、検査する語そのものを含む
	/^scripts\/wording\//,
	// 言い換えの表は、使わない語そのものを含む
	/^docs\/wording-guideline\.md$/,
	/^\.claude\/rules\/wording\.md$/,
];

/**
 * 検査対象のパスかを判定する (リポジトリ直下からの相対パス)
 */
export const isTarget = (path: string): boolean => {
	return (
		TARGET_PATTERN.test(path) &&
		!EXCLUDED_PATTERNS.some((pattern) => pattern.test(path))
	);
};

/**
 * 違反 1 件を「パス:行: [規則] 前後の文字 -> 言い換え」の 1 行にする
 */
export const formatViolation = (v: FileViolation): string => {
	return `${v.path}:${v.line}: [${v.ruleId}] ${v.context} -> ${v.message}`;
};
