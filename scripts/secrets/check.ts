import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { SECRET_RULES } from "./rules.ts";
import { findSecrets, formatFinding, isTarget } from "./scan.ts";

// シークレットの混入の検査 (検証コマンドと pre-commit で実行する)。
// 引数のファイルだけ、無ければ git 管理下の全対象ファイルを検査する。
// 1 件でもあれば終了コード 1。
// 検出した文字列そのものは出力しない。
// 見本の値などの意図的な例外は、該当行に secrets-ok と書く。

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
	const findings = files.flatMap((path) => {
		const text = readOptional(path);

		return text === undefined ? [] : findSecrets(path, text, SECRET_RULES);
	});

	if (findings.length === 0) {
		console.log(`secrets-check: OK (${files.length} ファイル)`);

		return;
	}

	console.error(findings.map(formatFinding).join("\n"));
	console.error(
		`\nsecrets-check: ${findings.length} 件の、シークレットに見える行があります。値を環境変数などに移してください。見本の値なら、行に secrets-ok と書いてください。`,
	);
	process.exit(1);
};

main();
