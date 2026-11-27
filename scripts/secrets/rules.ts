// シークレットの形をした文字列のルール。
// 追加は配列への要素追加だけで完結する。
// 検査は scripts/secrets/check.ts (just secrets-check)。
// 根拠は .claude/rules/security.md。

/**
 * シークレットの形 1 件
 */
export type SecretRule = {
	readonly id: string;
	readonly pattern: RegExp;
	// 何を検出したか
	readonly label: string;
};

// 認証情報に見えるキーの名前 (DB_PASSWORD、aws_secret_access_key のように、名前の末尾がこの語のものも対象にする)
const CREDENTIAL_KEY =
	"(?:client_?secret|api[_-]?key|access[_-]?key|credential|password|passwd|pwd)";

// 値がプレースホルダ (${VAR}、$VAR、$(...)、<...>) か、パス (/、./、../、~/) で始まるときは検出しない
const NOT_PLACEHOLDER_OR_PATH = String.raw`(?!\$[{(A-Za-z_]|<|\.{0,2}/|~/)`;

// 引用符で囲んだ値 (空白を含まない 8 文字以上)
const QUOTED_VALUE = String.raw`(["'])${NOT_PLACEHOLDER_OR_PATH}[^"'\s]{8,}\1`;

// 行末 (空白と # のコメントは許す)
const LINE_END = String.raw`\s*(?:#.*)?$`;

// 引用符で囲まない値 (YAML、dotenv、INI の形)。
// コードの式 (process.env.API_KEY; や f(x),) と区別するため、記号を含まない 8 文字以上の値が行末まで続くときだけ検出する。
// ドットでつないだ識別子 (settings.API_KEY) は、コードの参照とみなして検出しない。
const UNQUOTED_VALUE = String.raw`${NOT_PLACEHOLDER_OR_PATH}(?![A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+${LINE_END})[^\s"'\x60,;()[\]{}<>]{8,}${LINE_END}`;

/**
 * 検査するルールの一覧 (プロジェクトで使うサービスのトークンの形は、ここに追加する)
 */
export const SECRET_RULES = [
	{
		// PEM の形 (RSA、EC、OPENSSH など) と、PGP の形
		id: "private-key-block",
		pattern: /-----BEGIN [A-Z ]*PRIVATE KEY(?: BLOCK)?-----/,
		label: "秘密鍵のブロック",
	},
	{
		id: "credential-assignment",
		pattern: new RegExp(
			String.raw`${CREDENTIAL_KEY}["']?\s*[:=]\s*(?:${QUOTED_VALUE}|${UNQUOTED_VALUE})`,
			"i",
		),
		label: "認証情報に見える値の代入",
	},
	{
		id: "connection-string-password",
		pattern: new RegExp(
			String.raw`(?:Password|Pwd)=${NOT_PLACEHOLDER_OR_PATH}[^;"'\s]{8,}`,
			"i",
		),
		label: "接続文字列の中のパスワード",
	},
	{
		// scheme://user:password@host の形 (ユーザの部分は空でもよい)。
		// scheme の前の否定の後読みは、長い英数字の並びで照合が 2 乗の時間になることを防ぐ (scheme の文字の並びの先頭だけから照合する)
		id: "url-credentials",
		pattern: new RegExp(
			String.raw`(?<![a-z0-9+.-])[a-z][a-z0-9+.-]*://[^\s:@/]*:${NOT_PLACEHOLDER_OR_PATH}[^\s@/]+@`,
			"i",
		),
		label: "URL の中の認証情報",
	},
	{
		// AKIA は長期のアクセスキー、ASIA は一時的な (AWS STS の) アクセスキー ID の接頭辞。
		// 出どころは https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_identifiers.html#identifiers-prefixes (2026-11-27 に確認)。
		id: "aws-access-key-id",
		pattern: /(?:AKIA|ASIA)[0-9A-Z]{16}/,
		label: "AWS のアクセスキー ID",
	},
	{
		// 接頭辞は ghp_、gho_、ghu_、ghs_、ghr_、github_pat_ の 6 種類。
		// 出どころは https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github#githubs-token-formats (2026-11-27 に確認)。
		// 長さと文字の種類は文書に書かれていないので、接頭辞の後ろに英数字と _ が 20 文字以上続くものを検出する。
		id: "github-token",
		pattern: /\b(?:gh[pousr]_|github_pat_)[0-9A-Za-z_]{20,}/,
		label: "GitHub のトークン",
	},
	{
		id: "gitlab-personal-access-token",
		pattern: /glpat-[0-9A-Za-z_-]{20,}/,
		label: "GitLab のパーソナルアクセストークン",
	},
] as const satisfies readonly SecretRule[];
