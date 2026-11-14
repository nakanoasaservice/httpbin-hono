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

		it("should sort keys and end with a newline, like httpbin's jsonify", async () => {
			const res = await app.request(
				"/anything?b=1&a=2",
				{ method: "POST", body: '{"z":1,"y":{"d":1,"c":2}}' },
				env,
			);
			const text = await res.text();

			expect(text.endsWith("}\n")).toBe(true);
			const keys = [...text.matchAll(/^ {2}"(\w+)":/gm)].map((m) => m[1]);
			expect(keys).toEqual([
				"args",
				"data",
				"files",
				"form",
				"headers",
				"json",
				"method",
				"origin",
				"url",
			]);
			expect(text).toContain('"args": {\n    "a": "2",\n    "b": "1"\n  }');
		});

		it("should leave non-JSON responses untouched", async () => {
			const res = await app.request("/robots.txt", {}, env);

			expect(await res.text()).toBe("User-agent: *\nDisallow: /deny\n");
		});
	});

	describe("CORS", () => {
		it("should echo the request Origin with credentials allowed", async () => {
			const res = await app.request(
				"/get",
				{ headers: { Origin: "https://example.com" } },
				env,
			);

			expect(res.headers.get("access-control-allow-origin")).toBe(
				"https://example.com",
			);
			expect(res.headers.get("access-control-allow-credentials")).toBe("true");
			expect(res.headers.get("access-control-allow-methods")).toBeNull();
		});

		it("should allow any origin when no Origin is sent", async () => {
			const res = await app.request("/status/418", {}, env);

			expect(res.headers.get("access-control-allow-origin")).toBe("*");
		});

		it("should answer preflight requests with 200", async () => {
			const res = await app.request(
				"/post",
				{
					method: "OPTIONS",
					headers: {
						Origin: "https://example.com",
						"Access-Control-Request-Method": "POST",
						"Access-Control-Request-Headers": "X-Custom, Content-Type",
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			expect(res.headers.get("access-control-allow-origin")).toBe(
				"https://example.com",
			);
			expect(res.headers.get("access-control-allow-methods")).toBe(
				"GET, POST, PUT, DELETE, PATCH, OPTIONS",
			);
			expect(res.headers.get("access-control-max-age")).toBe("3600");
			expect(res.headers.get("access-control-allow-headers")).toBe(
				"X-Custom, Content-Type",
			);
		});
	});

	describe("HTML pages", () => {
		it("should serve an HTML form that posts to /post", async () => {
			const res = await app.request("/forms/post", {}, env);

			expect(res.status).toBe(200);
			expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
			expect(await res.text()).toContain('<form method="post" action="/post">');
		});
	});
});
