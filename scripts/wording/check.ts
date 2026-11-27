import { readOptional, trackedFiles } from "../shared/files.ts";
import { WORDING_RULES } from "./rules.ts";
import { checkText, formatViolation, isTarget } from "./scan.ts";

// 文書とコメントの言い回しの検査 (検証コマンドと pre-commit で実行する)。
// 引数のファイルだけ、無ければ git 管理下の全対象ファイルを検査する。
// 1 件でもあれば終了コード 1。
// 意図的な例外は、該当行に wording-ok と書く。ルールは scripts/wording/rules.ts。

const main = (): void => {
	const args = process.argv.slice(2);
	const files = (args.length > 0 ? args : trackedFiles()).filter(isTarget);
	const violations = files.flatMap((path) => {
		const text = readOptional(path);

		return text === undefined ? [] : checkText(path, text, WORDING_RULES);
	});

	if (violations.length === 0) {
		console.log(`wording-check: OK (${files.length} ファイル)`);

		return;
	}

	console.error(violations.map(formatViolation).join("\n"));
	console.error(
		`\nwording-check: ${violations.length} 件の言い回しの違反があります。意図的な例外は、行に wording-ok と書いてください。`,
	);
	process.exit(1);
};

main();
