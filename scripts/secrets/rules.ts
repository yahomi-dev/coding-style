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

/**
 * 検査するルールの一覧 (プロジェクトで使うサービスのトークンの形は、ここに追加する)
 */
export const SECRET_RULES = [
	{
		id: "private-key-block",
		pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
		label: "秘密鍵のブロック",
	},
	{
		id: "credential-assignment",
		pattern:
			/(?:client_?secret|api[_-]?key|access[_-]?key|credential|password|passwd|pwd)["']?\s*[:=]\s*["'][^"'\s]{8,}["']/i,
		label: "認証情報に見える値の代入",
	},
	{
		id: "connection-string-password",
		pattern: /(?:Password|Pwd)=[^;"'\s]{8,}/i,
		label: "接続文字列の中のパスワード",
	},
	{
		id: "aws-access-key-id",
		pattern: /AKIA[0-9A-Z]{16}/,
		label: "AWS のアクセスキー ID",
	},
	{
		id: "gitlab-personal-access-token",
		pattern: /glpat-[0-9A-Za-z_-]{20,}/,
		label: "GitLab のパーソナルアクセストークン",
	},
] as const satisfies readonly SecretRule[];
