import { writeFileSync } from "node:fs";
import { readOptional, trackedFiles } from "../shared/files.ts";
import { normalizePath } from "../shared/path.ts";
import { firstDifference, formatMarkdown } from "./format.ts";

// Markdown の改行のルールの検査 (検証コマンドと pre-commit で実行する)。
// 引数のファイルだけ、無ければ git 管理下の全 Markdown を検査する。
// 整形の前後で内容が変わるファイルがあれば終了コード 1。
// --write を付けると、整形した内容を書き込む。
// ルールは docs/wording-guideline.md の「改行」。

type Finding = {
	readonly path: string;
	readonly line: number;
	readonly formatted: string;
};

const WRITE_FLAG = "--write";
const TARGET_PATTERN = /\.md$/;
const EXCLUDED_PATTERNS: readonly RegExp[] = [
	/(?:^|\/)node_modules\//,
	/(?:^|\/)dist\//,
];

const isTarget = (path: string): boolean => {
	const normalized = normalizePath(path);

	return (
		TARGET_PATTERN.test(normalized) &&
		!EXCLUDED_PATTERNS.some((pattern) => pattern.test(normalized))
	);
};

const findingOf = (path: string): Finding | undefined => {
	const text = readOptional(path);

	if (text === undefined) {
		return undefined;
	}

	const formatted = formatMarkdown(text);

	if (formatted === text) {
		return undefined;
	}

	return { path, line: firstDifference(text, formatted) ?? 1, formatted };
};

const isFinding = (finding: Finding | undefined): finding is Finding => {
	return finding !== undefined;
};

const write = (finding: Finding): void => {
	writeFileSync(finding.path, finding.formatted);
};

const main = (): void => {
	const args = process.argv.slice(2);
	const paths = args.filter((arg) => arg !== WRITE_FLAG);
	const files = (paths.length > 0 ? paths : trackedFiles()).filter(isTarget);
	const findings = files.map(findingOf).filter(isFinding);

	if (findings.length === 0) {
		console.log(`md-check: OK (${files.length} ファイル)`);

		return;
	}

	if (args.includes(WRITE_FLAG)) {
		findings.forEach(write);
		console.log(`md-format: ${findings.length} ファイルを整形しました`);

		return;
	}

	console.error(
		findings.map((finding) => `${finding.path}:${finding.line}`).join("\n"),
	);
	console.error(
		`\nmd-check: ${findings.length} ファイルが改行のルールに合っていません。pnpm md:format で整形してください。`,
	);
	process.exit(1);
};

main();
