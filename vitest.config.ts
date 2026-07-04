import { defineConfig } from "vitest/config";

/**
 * dist に emit されたテスト複製の二重実行を防ぐため、対象を src に限定する
 */
// biome-ignore lint/style/noDefaultExport: vitest の設定は default export が必須
export default defineConfig({
	test: {
		include: ["src/**/*.test.ts"],
	},
});
