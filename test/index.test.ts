import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import app from "../src/index";

type Spec = { host: string; schemes: string[]; paths: Record<string, unknown> };

describe("App", () => {
	describe("GET /spec.json", () => {
		it("should use the request's host and scheme", async () => {
			const res = await app.request("https://example.com/spec.json", {}, env);

			expect(res.status).toBe(200);
			expect(res.headers.get("cache-control")).toBe("public, max-age=604800");
			const spec = (await res.json()) as Spec;
			expect(spec.host).toBe("example.com");
			expect(spec.schemes).toEqual(["https"]);
			expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
		});

		it("should not leak host or scheme between requests", async () => {
			await app.request("https://first.example/spec.json", {}, env);
			const res = await app.request("http://second.example/spec.json", {}, env);

			const spec = (await res.json()) as Spec;
			expect(spec.host).toBe("second.example");
			expect(spec.schemes).toEqual(["http"]);
		});
	});

	describe("pretty JSON", () => {
		it("should indent JSON responses with two spaces", async () => {
			const res = await app.request("/uuid", {}, env);

			expect(await res.text()).toMatch(/^\{\n {2}"uuid": "/);
		});

		it("should leave non-JSON responses untouched", async () => {
			const res = await app.request("/robots.txt", {}, env);

			expect(await res.text()).toBe("User-agent: *\nDisallow: /deny\n");
		});
	});
});
