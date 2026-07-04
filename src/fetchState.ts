import { match } from "ts-pattern";

/**
 * データ取得の失敗（kind タグ付き discriminated union）
 */
export type FetchError =
	| { kind: "network" }
	| { kind: "http"; statusCode: number };

/**
 * データ取得の状態（boolean フラグを並べず discriminated union で排他にする）
 */
export type FetchState =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "success"; userName: string }
	| { status: "error"; error: FetchError };

/**
 * 取得エラー -> 表示文言（エラーはデータで持ち、文言化は境界で行う）
 */
export const renderFetchError = (error: FetchError): string => {
	return match(error)
		.with({ kind: "network" }, () => "ネットワークエラーが発生しました")
		.with({ kind: "http" }, ({ statusCode }) => `HTTP エラー（${statusCode}）`)
		.exhaustive();
};

/**
 * 取得状態 -> 表示文言（DU の分岐は ts-pattern の match().exhaustive() が正規手段）
 */
export const renderFetchState = (state: FetchState): string => {
	return match(state)
		.with({ status: "idle" }, () => "待機中")
		.with({ status: "loading" }, () => "読み込み中")
		.with({ status: "success" }, ({ userName }) => userName)
		.with({ status: "error" }, ({ error }) => renderFetchError(error))
		.exhaustive();
};
