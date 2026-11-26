import { readFileSync } from "node:fs";
import { deniedEnvName, denyMessage } from "./envAccess.ts";

// Claude Code の PreToolUse hook。
// AI が .env と .env.* のファイルを読むこと、編集することを拒否する。
// 拒否するときは、理由を stderr に出力して、終了コード 2 で終了する。
// 対象外のときは、何も出力せずに終了コード 0 で終了する。
// 判定の内容は scripts/hooks/envAccess.ts。

const STDIN = 0;
const EXIT_DENY = 2;

// 入力を JSON として解釈できないときは、判定しない (ほかの権限の判定に任せる)
const readPayload = (): unknown => {
	try {
		return JSON.parse(readFileSync(STDIN, "utf8"));
	} catch {
		return undefined;
	}
};

const main = (): void => {
	const name = deniedEnvName(readPayload());

	if (name === undefined) {
		return;
	}

	console.error(denyMessage(name));
	process.exit(EXIT_DENY);
};

main();
