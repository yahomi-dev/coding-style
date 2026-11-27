import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// 検査の入口のスクリプト (scripts/*/check.ts) が共通で使う、ファイルの読み込み。
// パスの判定は、入出力を持たない scripts/shared/path.ts に置く。

/**
 * git 管理下のファイルの一覧を返す (リポジトリ直下からの相対パス)
 */
export const trackedFiles = (): readonly string[] => {
	return execFileSync("git", ["ls-files"], { encoding: "utf8" })
		.split("\n")
		.filter((path) => path !== "");
};

/**
 * ファイルの本文を返す。
 * 削除済みでステージに残っているファイルは読めないので、undefined を返して検査から除外する。
 */
export const readOptional = (path: string): string | undefined => {
	try {
		return readFileSync(path, "utf8");
	} catch {
		return undefined;
	}
};
