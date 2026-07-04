import type { Result } from "./result.js";
import { err, ok } from "./result.js";

/**
 * 検証済みメールアドレス（branded type）
 */
export type Email = string & { readonly __brand: "Email" };

/**
 * メールアドレスのパース失敗
 */
export type EmailParseError = {
	kind: "invalid_email";
	input: string;
};

/**
 * 文字列を Email としてパースするスマートコンストラクタ
 *
 * brand 付与の as は境界パーサ（*.parse.ts）内でのみ許可される。
 */
export const parseEmail = (input: string): Result<Email, EmailParseError> => {
	if (!input.includes("@")) {
		return err({ kind: "invalid_email", input });
	}

	return ok(input as Email);
};
