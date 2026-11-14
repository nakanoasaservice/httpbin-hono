import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vite-plus";

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: "./wrangler.jsonc" },
		}),
	],
	fmt: {
		useTabs: true,
		printWidth: 80,
		ignorePatterns: ["public/**", "worker-configuration.d.ts"],
		sortImports: {
			customGroups: [{ groupName: "protocol", elementNamePattern: ["*:*"] }],
			groups: [
				"builtin",
				["external", "protocol"],
				["internal", "subpath"],
				["parent", "sibling", "index"],
				"unknown",
			],
		},
		overrides: [{ files: ["*.jsonc"], options: { trailingComma: "none" } }],
	},
	lint: {
		ignorePatterns: ["public/**", "worker-configuration.d.ts"],
		jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
		rules: { "vite-plus/prefer-vite-plus-imports": "error" },
		options: { typeAware: true, typeCheck: true },
	},
});
