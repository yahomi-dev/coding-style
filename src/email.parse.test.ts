import { describe, expect, expectTypeOf, it } from "vitest";
import type { Email } from "./email.parse.js";
import { parseEmail } from "./email.parse.js";

describe("parseEmail", () => {
	it("正常系: @ を含む文字列を Email として受理する", () => {
		const result = parseEmail("alice@example.com");

		expect(result).toStrictEqual({ ok: true, value: "alice@example.com" });
	});

	it("正常系: @ を含まない文字列を kind 付きエラーで拒否する", () => {
		const result = parseEmail("not-an-email");

		expect(result).toStrictEqual({
			ok: false,
			error: { kind: "invalid_email", input: "not-an-email" },
		});
	});

	it("境界値: 空文字列を拒否する", () => {
		const result = parseEmail("");

		expect(result.ok).toBe(false);
	});

	it("型契約: 素の string は Email に代入できない", () => {
		expectTypeOf<string>().not.toExtend<Email>();
	});
});
