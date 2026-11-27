import { describe, expect, test } from "vitest";
import { normalizePath } from "./path.ts";

describe("normalizePath", () => {
	test.each([
		["./docs/x.md", "docs/x.md"],
		["docs/./x.md", "docs/x.md"],
		["docs//x.md", "docs/x.md"],
		["scripts/../docs/x.md", "docs/x.md"],
		["././justfile", "justfile"],
	])("表記をそろえる: %s -> %s", (path, expected) => {
		expect(normalizePath(path)).toBe(expected);
	});

	test.each(["docs/x.md", "justfile", ".claude/rules/wording.md"])(
		"そろっているパスは変えない: %s",
		(path) => {
			expect(normalizePath(path)).toBe(path);
		},
	);
});
