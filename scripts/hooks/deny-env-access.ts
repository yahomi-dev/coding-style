import { readFileSync } from "node:fs";
import { deniedEnvName, denyMessage } from "./envAccess.ts";

// Claude Code の PreToolUse hook。
// AI が dotenv のファイル (.env、.env.*、.envrc) を読むこと、編集することを拒否する。
// 拒否するときは、理由を stderr に出力して、終了コード 2 で終了する。
// 判定の途中で想定外の例外が起きたときも、理由を stderr に出力して、終了コード 2 で終了する (拒否する)。
// 対象外のときと、入力を JSON として解釈できないときは、何も出力せずに終了コード 0 で終了する。
// hook の起動に失敗したとき (node が無い、ファイルが無い) の扱いは、.claude/settings.json の onFailure で指定する。
// 判定の内容は scripts/hooks/envAccess.ts。

type Payload =
	| { readonly kind: "parsed"; readonly value: unknown }
	| { readonly kind: "invalid" };

type Judgement =
	| { readonly kind: "judged"; readonly name: string | undefined }
	| { readonly kind: "failed"; readonly cause: unknown };

const STDIN = 0;
const EXIT_DENY = 2;

// 入力を JSON として解釈できないときは、判定しない (ほかの権限の判定に任せる)
const readPayload = (): Payload => {
	try {
		return { kind: "parsed", value: JSON.parse(readFileSync(STDIN, "utf8")) };
	} catch {
		return { kind: "invalid" };
	}
};

// 判定の途中の想定外の例外は、拒否として扱う (保護のための hook なので、壊れたときに通さない)
const judge = (payload: unknown): Judgement => {
	try {
		return { kind: "judged", name: deniedEnvName(payload) };
	} catch (cause) {
		return { kind: "failed", cause };
	}
};

const failureMessage = (cause: unknown): string => {
	return `.env のファイルの判定の途中で想定外のエラーが発生したので、拒否します (scripts/hooks/envAccess.ts): ${String(cause)}`;
};

const main = (): void => {
	const payload = readPayload();

	if (payload.kind === "invalid") {
		return;
	}

	const judgement = judge(payload.value);

	if (judgement.kind === "failed") {
		console.error(failureMessage(judgement.cause));
		process.exit(EXIT_DENY);
	}

	if (judgement.name === undefined) {
		return;
	}

	console.error(denyMessage(judgement.name));
	process.exit(EXIT_DENY);
};

main();
