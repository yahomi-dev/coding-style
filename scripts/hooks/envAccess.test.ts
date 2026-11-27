import { describe, expect, test } from "vitest";
import {
	deniedEnvName,
	denyMessage,
	envNameInCommand,
	isEnvFile,
	splitArguments,
} from "./envAccess.ts";

const fileTool = (toolName: string, input: Record<string, string>): unknown => {
	return { tool_name: toolName, tool_input: input };
};

const bash = (command: string): unknown => {
	return { tool_name: "Bash", tool_input: { command } };
};

describe("isEnvFile", () => {
	test.each([
		".env",
		".env.local",
		".env.production",
		".env.",
		".envrc",
		".ENV",
		".Env.Local",
	])("拒否する名前: %s", (name) => {
		expect(isEnvFile(name)).toStrictEqual(true);
	});

	test.each([
		".env.example",
		".ENV.EXAMPLE",
		".env-local",
		".env_prod",
		".env~",
		"prod.env",
		"env.ts",
		"dotenv.md",
		"environment.ts",
	])("拒否しない名前: %s", (name) => {
		expect(isEnvFile(name)).toStrictEqual(false);
	});
});

describe("splitArguments", () => {
	test("空白で分け、引用符の中の空白では分けない", () => {
		expect(splitArguments(`cat "a b" 'c d' e\\ f`)).toStrictEqual([
			"cat",
			"a b",
			"c d",
			"e f",
		]);
	});

	test("引用符が閉じていないときは、最後までを 1 つの語にする", () => {
		expect(splitArguments(`echo "a b`)).toStrictEqual(["echo", "a b"]);
	});

	test("シェルの演算子と = : で分ける", () => {
		expect(splitArguments("cat<a|b;c&&d>e (f) --opt=g h:i")).toStrictEqual([
			"cat",
			"a",
			"b",
			"c",
			"d",
			"e",
			"f",
			"--opt",
			"g",
			"h",
			"i",
		]);
	});

	test("引用符の中の演算子では分けない", () => {
		expect(splitArguments(`echo "a;b|c" 'd<e' "f=g:h"`)).toStrictEqual([
			"echo",
			"a;b|c",
			"d<e",
			"f=g:h",
		]);
	});

	test('二重引用符の中のバックスラッシュは、$ ` " \\ の前でだけ取り除く', () => {
		expect(splitArguments(`rg "\\.x" '\\.y' "\\$a \\" \\\\"`)).toStrictEqual([
			"rg",
			"\\.x",
			"\\.y",
			'$a " \\',
		]);
	});
});

describe("ファイルを扱うツール", () => {
	test.each([
		["Read", { file_path: "/repo/.env" }, ".env"],
		["Read", { file_path: "/repo/apps/api/.env.local" }, ".env.local"],
		["Read", { file_path: "/mnt/c/repo/.ENV" }, ".ENV"],
		["Read", { file_path: "C:\\repo\\.env" }, ".env"],
		["Read", { file_path: "/repo/.envrc" }, ".envrc"],
		["Edit", { file_path: "/repo/.env.production" }, ".env.production"],
		["Write", { file_path: "/repo/.env" }, ".env"],
		["NotebookEdit", { notebook_path: "/repo/.env" }, ".env"],
		["Grep", { pattern: "KEY", path: "/repo/.env" }, ".env"],
		["Grep", { pattern: "KEY", glob: ".env.*" }, ".env.*"],
		[
			"Grep",
			{ pattern: "KEY", glob: "{.env,.env.local}" },
			"{.env,.env.local}",
		],
		["Grep", { pattern: "KEY", glob: ".e*" }, ".e*"],
		["Grep", { pattern: "KEY", glob: ".en?" }, ".en?"],
		["Glob", { pattern: "**/.env" }, ".env"],
		["Glob", { pattern: "**/.env*" }, ".env*"],
		["Glob", { pattern: ".env{,.local}" }, ".env{,.local}"],
	])("拒否する: %s %o", (toolName, input, name) => {
		expect(deniedEnvName(fileTool(toolName, input))).toStrictEqual(name);
	});

	test.each([
		["Read", { file_path: "/repo/.env.example" }],
		["Read", { file_path: "/repo/.ENV.EXAMPLE" }],
		["Read", { file_path: "/repo/src/env.ts" }],
		["Read", { file_path: "/repo/.env/lib/python3.12/site-packages/x.py" }],
		["Grep", { pattern: "API_KEY", path: "/repo/src" }],
		["Grep", { pattern: "\\.env", path: "/repo/docs" }],
		["Glob", { pattern: "**/*" }],
		["Glob", { pattern: "**/*.ts" }],
		["Task", { prompt: "cat .env" }],
	])("拒否しない: %s %o", (toolName, input) => {
		expect(deniedEnvName(fileTool(toolName, input))).toStrictEqual(undefined);
	});
});

describe("Bash", () => {
	test.each([
		["cat .env", ".env"],
		["less ./.env.local", ".env.local"],
		["source .env && pnpm test", ".env"],
		["grep KEY apps/api/.env.production | head", ".env.production"],
		["docker run --env-file=.env img", ".env"],
		["X=$(cat .env); echo $X", ".env"],
		["python3 -c 'print(1)' < .env", ".env"],
		['cat ".env"', ".env"],
		["cat .envrc", ".envrc"],
	])("引数にファイルの名前があれば拒否する: %s", (command, name) => {
		expect(deniedEnvName(bash(command))).toStrictEqual(name);
	});

	test.each([
		["cat<.env", ".env"],
		["cat .env|base64", ".env"],
		["cat .env;ls", ".env"],
		["cat .env&&ls", ".env"],
		["cat .env>/tmp/x", ".env"],
		["(cat .env)", ".env"],
	])("空白を挟まない演算子の前後の名前も拒否する: %s", (command, name) => {
		expect(deniedEnvName(bash(command))).toStrictEqual(name);
	});

	test.each([
		["cat .ENV", ".ENV"],
		["cat .Env.Local", ".Env.Local"],
	])("大文字と小文字を区別せずに拒否する: %s", (command, name) => {
		expect(deniedEnvName(bash(command))).toStrictEqual(name);
	});

	test.each([
		["cat .env*", ".env*"],
		["cat .e*", ".e*"],
		["cat .E*", ".E*"],
		["cat .en?", ".en?"],
		["cat .[e]nv", ".[e]nv"],
		["cat .*", ".*"],
		["cat {x,.env}", "{x,.env}"],
		["cat .{env,x}", ".{env,x}"],
		["cat .en{u..w}", ".en{u..w}"],
		["cat {a/.env,b}", ".env"],
		["rg -n '[.]env' docs", "[.]env"],
	])(
		"対象の名前に一致するワイルドカードとブレースを拒否する: %s",
		(command, name) => {
			expect(deniedEnvName(bash(command))).toStrictEqual(name);
		},
	);

	test.each([
		'bash -c "cat .env"',
		'bash -c "cat<.env"',
		'bash -c "/bin/cat .env"',
		'bash -c "tr a a < .env"',
		'bash -c "dd if=.env"',
		'bash -c "docker compose --env-file .env config"',
		'bash -lc "cat .env"',
		"sh -c 'cat .env | base64'",
		'eval "dd if=.env"',
	])("-c と eval の文字列は、コマンドとして判定する: %s", (command) => {
		expect(deniedEnvName(bash(command))).toStrictEqual(".env");
	});

	test.each([
		'echo "$(cat .env)"',
		'echo "x $(cat .env) y"',
		'echo "$(cat ".env")"',
		'git commit -m "fix: `cat .env`"',
	])(
		"二重引用符の中のコマンド置換は、コマンドとして判定する: %s",
		(command) => {
			expect(deniedEnvName(bash(command))).toStrictEqual(".env");
		},
	);

	test.each([
		"cp .env.example .env",
		"echo .env >> .gitignore",
		"ls -la .env",
		"git check-ignore -v .env",
		"grep -n '.env' .gitignore",
		"grep -c x <<< .env",
	])("中身を読まないコマンドでも、名前があれば拒否する: %s", (command) => {
		expect(deniedEnvName(bash(command))).toStrictEqual(".env");
	});

	test("空白を含む文字列でも、最後の / の後ろが対象の名前なら拒否する", () => {
		expect(deniedEnvName(bash('cat "my dir/.env"'))).toStrictEqual(".env");
	});

	test("行の継続 (バックスラッシュと改行) を取り除いてから判定する", () => {
		expect(deniedEnvName(bash("cat .e\\\nnv"))).toStrictEqual(".env");
	});

	test.each([
		"cat .env.example",
		"cat .env-local",
		"cat .env_prod",
		"cat prod.env",
		"pnpm test && git status",
		"printenv PATH; env | wc -l",
		"source .env/bin/activate",
		"wc -l scripts/hooks/*",
		"ls *",
		"for i in {1..5}; do echo $i; done",
	])("対象の名前が無いコマンドは拒否しない: %s", (command) => {
		expect(deniedEnvName(bash(command))).toStrictEqual(undefined);
	});

	test.each([
		"echo '説明: `.env` は読まない'",
		'git commit -m "docs: .env の保護のルールを追加"',
		'git commit -m "fix: cat .env を拒否する"',
		'git commit -m "docs: sort .env keys"',
		'gh pr create --title t --body "hook が cat .env を拒否する"',
		"echo '$(cat .env)'",
	])("空白を含む引用符の文字列は、説明の文として拒否しない: %s", (command) => {
		expect(deniedEnvName(bash(command))).toStrictEqual(undefined);
	});

	test.each([
		'rg -n "\\.env" docs',
		"rg -n '\\.env' docs",
		"grep -n '\\.env' docs/x.md",
	])("バックスラッシュで書いた正規表現は拒否しない: %s", (command) => {
		expect(deniedEnvName(bash(command))).toStrictEqual(undefined);
	});
});

describe("Bash のヒアドキュメント", () => {
	test.each([
		["cat > doc.md <<'EOF'", "cat .env", "EOF"],
		["cat > doc.md <<EOF", "cat .env", "EOF"],
		["cat <<'END-DOC'", "cat .env", "END-DOC"],
		["cat <<-EOF", "\tcat .env", "\tEOF"],
		["git commit -F - <<'EOF'", "fix: cat .env を拒否する", "EOF"],
		["git commit -m \"$(cat <<'EOF'", "fix: cat .env を拒否する", "EOF", ')"'],
	])("本文は判定しない: %s", (...lines) => {
		expect(envNameInCommand(lines.join("\n"))).toStrictEqual(undefined);
	});

	test("<< の形では、タブで字下げした行を終端にしない", () => {
		const command = ["cat > doc.md <<EOF", "\tEOF", "cat .env", "EOF"].join(
			"\n",
		);

		expect(envNameInCommand(command)).toStrictEqual(undefined);
	});

	test.each([
		["bash <<'EOF'", "cat .env", "EOF"],
		["cat <<EOF | sh", "cat .env", "EOF"],
		["python3 - <<'PY'", "print(open('.env').read())", "PY"],
		["ssh host 'bash -s' <<'EOF'", "cat .env", "EOF"],
	])("シェルやインタプリタが受け取る本文は判定する: %s", (...lines) => {
		expect(envNameInCommand(lines.join("\n"))).toStrictEqual(".env");
	});

	test("<<TAG と同じ行の残りは判定する", () => {
		const command = ["cat <<EOF > out.txt && cat .env", "body", "EOF"].join(
			"\n",
		);

		expect(envNameInCommand(command)).toStrictEqual(".env");
	});

	test("終端の行の後ろのコマンドは判定する", () => {
		const command = ["cat > doc.md <<'EOF'", "body", "EOF", "cat .env"].join(
			"\n",
		);

		expect(envNameInCommand(command)).toStrictEqual(".env");
	});

	test("終端の名前を引用符で囲まない形では、本文の中のコマンド置換を判定する", () => {
		const command = ["cat > out.txt <<EOF", "$(cat .env)", "EOF"].join("\n");

		expect(envNameInCommand(command)).toStrictEqual(".env");
	});

	test("終端の行が無いときは、本文も判定する", () => {
		expect(envNameInCommand("cat <<EOF\ncat .env")).toStrictEqual(".env");
	});
});

describe("Bash の大きい入力", () => {
	test("語が多いコマンドも判定できる (語の数の 2 乗の時間をかけない)", () => {
		expect(envNameInCommand(`echo ${"a ".repeat(80_000)}.env`)).toStrictEqual(
			".env",
		);
	});

	test.each([
		["ブレースの範囲", "echo {1..100000}"],
		["20 個のブレース", `cat ${"{a,b}".repeat(20)}`],
		["20,000 個の <<", `cat ${"<<a ".repeat(20_000)}`],
	])("展開や探索に時間がかかる指定も判定できる: %s", (_label, command) => {
		expect(envNameInCommand(command)).toStrictEqual(undefined);
	});

	test("ブレースが多い指定は、ブレースの全体をワイルドカードとして判定する", () => {
		expect(envNameInCommand(`cat .e${"{n,x}".repeat(6)}v`)).toStrictEqual(
			`.e${"{n,x}".repeat(6)}v`,
		);
	});
});

describe("deniedEnvName", () => {
	test.each([undefined, "text", 1, {}, { tool_name: "Read" }])(
		"入力の形が想定と違うときは判定しない: %o",
		(payload) => {
			expect(deniedEnvName(payload)).toStrictEqual(undefined);
		},
	);

	test.each(["constructor", "__proto__", "toString", "hasOwnProperty"])(
		"tool_name が Object の属性の名前でも例外を投げない: %s",
		(toolName) => {
			expect(
				deniedEnvName(fileTool(toolName, { file_path: "/repo/.env" })),
			).toStrictEqual(undefined);
		},
	);
});

describe("denyMessage", () => {
	test("対象の名前と、ルールの文書を示す", () => {
		expect(denyMessage(".env.local")).toStrictEqual(
			".env のファイル (.env.local) は、読むことも編集することもできません (.claude/rules/security.md)。値が必要なときは、変数の名前だけを .env.example で確認するか、ユーザーに確認してください。",
		);
	});
});
