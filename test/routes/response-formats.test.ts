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

	/**
	 * Decompress a manually encoded response body and parse it as JSON
	 */
	async function decompressJSON(
		res: Response,
		format: "gzip" | "deflate",
	): Promise<CompressionResponse> {
		const body = res.body?.pipeThrough(new DecompressionStream(format));
		return (await new Response(body).json()) as CompressionResponse;
	}

	describe.each([
		{ path: "/gzip", format: "gzip", flag: "gzipped" },
		{ path: "/deflate", format: "deflate", flag: "deflated" },
	] as const)("GET $path", ({ path, format, flag }) => {
		it(`should return a ${format}-compressed JSON body`, async () => {
			const res = await responseFormats.request(path, {}, env);

			expect(res.status).toBe(200);
			expect(res.headers.get("content-type")).toBe("application/json");
			expect(res.headers.get("content-encoding")).toBe(format);
			const data = await decompressJSON(res, format);
			expect(data[flag]).toBe(true);
			expect(data.method).toBe("GET");
			expect(data.origin).toBeDefined();
			expect(data.headers).toBeDefined();
		});

		it("should compress regardless of Accept-Encoding, like httpbin", async () => {
			const res = await responseFormats.request(
				path,
				{ headers: { "Accept-Encoding": "identity" } },
				env,
			);

			expect(res.headers.get("content-encoding")).toBe(format);
			expect((await decompressJSON(res, format))[flag]).toBe(true);
		});
	});

	describe("GET /brotli", () => {
		it("should mark the response as brotli for the runtime to encode", async () => {
			// The runtime applies brotli when sending, so the body is plain here
			const res = await responseFormats.request("/brotli", {}, env);

			expect(res.status).toBe(200);
			expect(res.headers.get("content-encoding")).toBe("br");
			const data = (await res.json()) as CompressionResponse;
			expect(data.brotli).toBe(true);
			expect(data.method).toBe("GET");
			expect(data.origin).toBeDefined();
		});
	});
});
