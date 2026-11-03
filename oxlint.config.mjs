import { defineConfig } from "oxlint";

export default defineConfig({
	ignorePatterns: ["dist/**", "coverage/**", "_site/**"],
	env: {
		browser: true,
		node: true,
	},
	categories: {
		correctness: "error",
		suspicious: "error",
	},
	rules: {
		"no-underscore-dangle": "off",
	},
});
