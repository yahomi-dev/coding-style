import { describe, expect, it } from "vitest";
import { renderFetchError, renderFetchState } from "./fetchState.js";

describe("renderFetchState", () => {
	it("正常系: idle は待機中の文言を返す", () => {
		expect(renderFetchState({ status: "idle" })).toBe("待機中");
	});

	it("正常系: loading は読み込み中の文言を返す", () => {
		expect(renderFetchState({ status: "loading" })).toBe("読み込み中");
	});

	it("正常系: success はユーザー名を返す", () => {
		const result = renderFetchState({ status: "success", userName: "Alice" });

		expect(result).toBe("Alice");
	});

	it("正常系: error はエラーの文言を返す", () => {
		const result = renderFetchState({
			status: "error",
			error: { kind: "http", statusCode: 404 },
		});

		expect(result).toBe("HTTP エラー（404）");
	});
});

describe("renderFetchError", () => {
	it("正常系: network エラーを文言に変換する", () => {
		const result = renderFetchError({ kind: "network" });

		expect(result).toBe("ネットワークエラーが発生しました");
	});
});
