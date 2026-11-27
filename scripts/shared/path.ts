import { posix } from "node:path";

// 検査の対象を判定する前に、パスの表記をそろえる純粋関数。
// 4 つの検査 (wording、markdown、comments、secrets) の isTarget が使う。

/**
 * パスを、リポジトリ直下からの相対パスの表記にそろえる (先頭の ./、途中の . と ..、重なった / を取り除く)
 */
export const normalizePath = (path: string): string => {
	return posix.normalize(path);
};
