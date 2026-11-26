import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { findCommentViolations, formatViolation, isTarget } from "./scan.ts";

// コードのコメントの改行の検査 (検証コマンドと pre-commit で実行する)。
// 引数のファイルだけ、無ければ git 管理下の全対象ファイルを検査する。
// 1 行に複数の文があるコメントが 1 件でもあれば、終了コード 1。
// 意図的な例外は、該当行に wording-ok と書く。

const trackedFiles = (): readonly string[] => {
	return execFileSync("git", ["ls-files"], { encoding: "utf8" })
		.split("\n")
		.filter((path) => path !== "");
};

// 削除済みでステージに残っているファイルは読めないので、undefined にして検査から除外する
const readOptional = (path: string): string | undefined => {
	try {
		return readFileSync(path, "utf8");
	} catch {
		return undefined;
	}
};

const main = (): void => {
	const args = process.argv.slice(2);
	const files = (args.length > 0 ? args : trackedFiles()).filter(isTarget);
	const violations = files.flatMap((path) => {
		const text = readOptional(path);

		return text === undefined ? [] : findCommentViolations(path, text);
	});

	if (violations.length === 0) {
		console.log(`comments-check: OK (${files.length} ファイル)`);

		return;
	}

	console.error(violations.map(formatViolation).join("\n"));
	console.error(
		`\ncomments-check: ${violations.length} 件のコメントに、1 行に複数の文があります。1 文 1 行に分けてください。`,
	);
	process.exit(1);
};

main();
