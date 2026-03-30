import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { responseFormats } from "../../src/routes/response-formats";

type JsonResponse = {
	slideshow: {
		title: string;
		date: string;
		author: string;
		slides: Array<{
			type: string;
			title: string;
			items?: string[];
		}>;
	};
};

type CompressionResponse = {
	method: string;
	headers: Record<string, string>;
	origin: string;
	brotli?: boolean;
	deflated?: boolean;
	gzipped?: boolean;
};

describe("Response Formats", () => {
	describe("GET /json", () => {
		it("should return JSON response with slideshow data", async () => {
			const res = await responseFormats.request("/json", {}, env);

			expect(res.status).toBe(200);
			expect(res.headers.get("content-type")).toContain("application/json");
			const data = (await res.json()) as JsonResponse;
			expect(data.slideshow).toBeDefined();
			expect(data.slideshow.title).toBe("Sample Slide Show");
			expect(data.slideshow.date).toBe("date of publication");
			expect(data.slideshow.author).toBe("Yours Truly");
			expect(data.slideshow.slides).toHaveLength(2);
			expect(data.slideshow.slides?.[0]?.type).toBe("all");
			expect(data.slideshow.slides?.[0]?.title).toBe(
				"Wake up to WonderWidgets!",
			);
			expect(data.slideshow.slides?.[1]?.type).toBe("all");
			expect(data.slideshow.slides?.[1]?.title).toBe("Overview");
			expect(data.slideshow.slides?.[1]?.items).toEqual([
				"Why <em>WonderWidgets</em> are great",
				"Who <em>buys</em> WonderWidgets",
			]);
		});
	});

	describe("GET /xml", () => {
		it("should return XML response", async () => {
			const res = await responseFormats.request("/xml", {}, env);

			expect(res.status).toBe(200);
			expect(res.headers.get("content-type")).toBe("application/xml");
			const text = await res.text();
			expect(text).toContain("<?xml");
		});
	});

	describe("GET /html", () => {
		it("should return HTML response", async () => {
			const res = await responseFormats.request("/html", {}, env);

			expect(res.status).toBe(200);
			expect(res.headers.get("content-type")).toBe("text/html");
			const text = await res.text();
			expect(text.length).toBeGreaterThan(0);
		});
	});

	describe("GET /robots.txt", () => {
		it("should return robots.txt content", async () => {
			const res = await responseFormats.request("/robots.txt", {}, env);

			expect(res.status).toBe(200);
			expect(res.headers.get("content-type")).toBe("text/plain");
			const text = await res.text();
			expect(text).toContain("User-agent: *");
			expect(text).toContain("Disallow: /deny");
		});
	});

	describe("GET /deny", () => {
		it("should return ASCII art denial message", async () => {
			const res = await responseFormats.request("/deny", {}, env);

			expect(res.status).toBe(200);
			expect(res.headers.get("content-type")).toBe("text/plain");
			const text = await res.text();
			expect(text).toContain("YOU SHOULDN'T BE HERE");
		});
	});

	describe("GET /encoding/utf8", () => {
		it("should return UTF-8 encoded content", async () => {
			const res = await responseFormats.request("/encoding/utf8", {}, env);

			expect(res.status).toBe(200);
			expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
			const text = await res.text();
			expect(text.length).toBeGreaterThan(0);
		});
	});

	describe("GET /brotli", () => {
		it("should return JSON response indicating brotli compression", async () => {
			const res = await responseFormats.request(
				"/brotli",
				{
					headers: {
						"Accept-Encoding": "br",
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as CompressionResponse;
			expect(data.method).toBe("GET");
			expect(data.brotli).toBe(true);
			expect(data.origin).toBeDefined();
			expect(data.headers).toBeDefined();
		});

		it("should return JSON response without Accept-Encoding header", async () => {
			const res = await responseFormats.request("/brotli", {}, env);

			expect(res.status).toBe(200);
			const data = (await res.json()) as CompressionResponse;
			expect(data.method).toBe("GET");
			expect(data.brotli).toBe(true);
			expect(data.origin).toBeDefined();
		});
	});

	describe("GET /deflate", () => {
		it("should return JSON response indicating deflate compression", async () => {
			const res = await responseFormats.request(
				"/deflate",
				{
					headers: {
						"Accept-Encoding": "deflate",
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as CompressionResponse;
			expect(data.method).toBe("GET");
			expect(data.deflated).toBe(true);
			expect(data.origin).toBeDefined();
			expect(data.headers).toBeDefined();
		});

		it("should return JSON response without Accept-Encoding header", async () => {
			const res = await responseFormats.request("/deflate", {}, env);

			expect(res.status).toBe(200);
			const data = (await res.json()) as CompressionResponse;
			expect(data.method).toBe("GET");
			expect(data.deflated).toBe(true);
			expect(data.origin).toBeDefined();
		});
	});

	describe("GET /gzip", () => {
		it("should return JSON response indicating gzip compression", async () => {
			const res = await responseFormats.request(
				"/gzip",
				{
					headers: {
						"Accept-Encoding": "gzip",
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as CompressionResponse;
			expect(data.method).toBe("GET");
			expect(data.gzipped).toBe(true);
			expect(data.origin).toBeDefined();
			expect(data.headers).toBeDefined();
		});

		it("should return JSON response without Accept-Encoding header", async () => {
			const res = await responseFormats.request("/gzip", {}, env);

			expect(res.status).toBe(200);
			const data = (await res.json()) as CompressionResponse;
			expect(data.method).toBe("GET");
			expect(data.gzipped).toBe(true);
			expect(data.origin).toBeDefined();
		});
	});
});
