import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

type HookResult = {
	readonly status: number | undefined;
	readonly stderr: string;
};

const HOOK = fileURLToPath(new URL("./deny-env-access.ts", import.meta.url));

// hook のスクリプトを node で起動し、標準入力にツールの入力を書き込む
const runHook = (input: string): HookResult => {
	const result = spawnSync(process.execPath, [HOOK], {
		input,
		encoding: "utf8",
	});

	return { status: result.status ?? undefined, stderr: result.stderr };
};

const bashInput = (command: string): string => {
	return JSON.stringify({ tool_name: "Bash", tool_input: { command } });
};

describe("deny-env-access.ts", () => {
	test("拒否する入力では、理由を stderr に出力して終了コード 2 で終了する", () => {
		expect(runHook(bashInput("cat .env.local"))).toStrictEqual({
			status: 2,
			stderr:
				".env のファイル (.env.local) は、読むことも編集することもできません (.claude/rules/security.md)。値が必要なときは、変数の名前だけを .env.example で確認するか、ユーザーに確認してください。\n",
		});
	});

	test("対象外の入力では、何も出力せずに終了コード 0 で終了する", () => {
		expect(runHook(bashInput("cat .env.example"))).toStrictEqual({
			status: 0,
			stderr: "",
		});
	});

	test.each(["{not json", ""])(
		"入力を JSON として解釈できないときは、判定せずに終了コード 0 で終了する: %j",
		(input) => {
			expect(runHook(input)).toStrictEqual({ status: 0, stderr: "" });
		},
	);
});
