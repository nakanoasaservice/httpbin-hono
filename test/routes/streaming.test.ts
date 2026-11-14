import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import app from "../../src/index";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz";

describe("Streaming and dynamic data", () => {
	describe("GET /stream/:n", () => {
		it("should stream n JSON objects, one per line", async () => {
			const res = await app.request("/stream/3?foo=bar", {}, env);

			expect(res.status).toBe(200);
			expect(res.headers.get("content-type")).toBe("application/json");
			const lines = (await res.text()).trimEnd().split("\n");
			expect(lines).toHaveLength(3);
			lines.forEach((line, i) => {
				const message = JSON.parse(line);
				expect(message.id).toBe(i);
				expect(message.args).toEqual({ foo: "bar" });
				expect(message.url).toContain("/stream/3");
			});
		});

		it("should cap the stream at 100 messages", async () => {
			const res = await app.request("/stream/500", {}, env);

			expect((await res.text()).trimEnd().split("\n")).toHaveLength(100);
		});

		it("should return 400 for a non-integer count", async () => {
			const res = await app.request("/stream/abc", {}, env);

			expect(res.status).toBe(400);
		});
	});

	describe("GET /stream-bytes/:n", () => {
		it("should stream n random bytes", async () => {
			const res = await app.request("/stream-bytes/1000", {}, env);

			expect(res.status).toBe(200);
			expect(res.headers.get("content-type")).toBe("application/octet-stream");
			expect((await res.arrayBuffer()).byteLength).toBe(1000);
		});

		it("should return the same bytes as /bytes for the same seed", async () => {
			const streamed = await app.request(
				"/stream-bytes/300?seed=42&chunk_size=7",
				{},
				env,
			);
			const whole = await app.request("/bytes/300?seed=42", {}, env);

			expect(new Uint8Array(await streamed.arrayBuffer())).toEqual(
				new Uint8Array(await whole.arrayBuffer()),
			);
		});

		it("should cap the size at 100KB", async () => {
			const res = await app.request("/stream-bytes/200000", {}, env);

			expect((await res.arrayBuffer()).byteLength).toBe(102400);
		});

		it("should return 400 for an invalid seed", async () => {
			const res = await app.request("/stream-bytes/10?seed=x", {}, env);

			expect(res.status).toBe(400);
		});
	});

	describe("GET /drip", () => {
		it("should return numbytes asterisks with the requested status", async () => {
			const res = await app.request(
				"/drip?numbytes=5&duration=0&code=201",
				{},
				env,
			);

			expect(res.status).toBe(201);
			expect(res.headers.get("content-type")).toBe("application/octet-stream");
			expect(await res.text()).toBe("*****");
		});

		it("should default to 10 bytes", async () => {
			const res = await app.request("/drip?duration=0", {}, env);

			expect(await res.text()).toBe("*".repeat(10));
		});

		it("should spread the bytes over the duration", async () => {
			const start = Date.now();
			const res = await app.request("/drip?numbytes=4&duration=0.3", {}, env);
			const body = await res.text();
			const elapsed = Date.now() - start;

			expect(body).toBe("****");
			expect(elapsed).toBeGreaterThanOrEqual(150);
			expect(elapsed).toBeLessThan(1500);
		});

		it("should accept case-insensitive query parameters", async () => {
			const res = await app.request("/drip?NumBytes=3&Duration=0", {}, env);

			expect(await res.text()).toBe("***");
		});

		it.each([
			["numbytes=0", "number of bytes must be positive"],
			["numbytes=abc", "number of bytes must be positive"],
			["duration=-1", "duration must be a non-negative number"],
			["code=999", "Invalid status code"],
			["code=204", "Invalid status code"],
		])("should return 400 for %s", async (query, message) => {
			const res = await app.request(`/drip?${query}`, {}, env);

			expect(res.status).toBe(400);
			expect(await res.text()).toBe(message);
		});
	});

	describe("GET /range/:numbytes", () => {
		it("should return the full resource without a Range header", async () => {
			const res = await app.request("/range/26", {}, env);

			expect(res.status).toBe(200);
			expect(await res.text()).toBe(ALPHABET);
			expect(res.headers.get("etag")).toBe("range26");
			expect(res.headers.get("accept-ranges")).toBe("bytes");
			expect(res.headers.get("content-range")).toBe("bytes 0-25/26");
		});

		it.each([
			["bytes=0-4", "abcde", "bytes 0-4/26"],
			["bytes=24-", "yz", "bytes 24-25/26"],
			["bytes=-3", "xyz", "bytes 23-25/26"],
			["bytes=10-12", "klm", "bytes 10-12/26"],
		])("should return 206 for %s", async (range, body, contentRange) => {
			const res = await app.request(
				"/range/26",
				{ headers: { Range: range } },
				env,
			);

			expect(res.status).toBe(206);
			expect(await res.text()).toBe(body);
			expect(res.headers.get("content-range")).toBe(contentRange);
		});

		it("should repeat the alphabet past 26 bytes", async () => {
			const res = await app.request(
				"/range/100?chunk_size=7",
				{ headers: { Range: "bytes=50-55" } },
				env,
			);

			expect(await res.text()).toBe("yzabcd");
		});

		it.each(["bytes=30-40", "bytes=5-2"])(
			"should return 416 for unsatisfiable range %s",
			async (range) => {
				const res = await app.request(
					"/range/26",
					{ headers: { Range: range } },
					env,
				);

				expect(res.status).toBe(416);
				expect(res.headers.get("content-range")).toBe("bytes */26");
			},
		);

		it.each(["0", "102401", "abc"])(
			"should return 404 for numbytes %s",
			async (numbytes) => {
				const res = await app.request(`/range/${numbytes}`, {}, env);

				expect(res.status).toBe(404);
				expect(await res.text()).toBe(
					"number of bytes must be in the range (0, 102400]",
				);
			},
		);
	});

	describe("GET /links", () => {
		it("should render n links with the current offset unlinked", async () => {
			const res = await app.request("/links/3/1", {}, env);

			expect(res.status).toBe(200);
			expect(res.headers.get("content-type")).toContain("text/html");
			expect(await res.text()).toBe(
				"<html><head><title>Links</title></head><body>" +
					"<a href='/links/3/0'>0</a> 1 <a href='/links/3/2'>2</a> " +
					"</body></html>",
			);
		});

		it("should clamp n to between 1 and 200", async () => {
			const zero = await app.request("/links/0/5", {}, env);
			const many = await app.request("/links/500/0", {}, env);

			expect(await zero.text()).toContain("<a href='/links/1/0'>0</a>");
			expect((await many.text()).match(/<a /g)).toHaveLength(199);
		});

		it("should redirect /links/:n to offset 0", async () => {
			const res = await app.request("/links/10", {}, env);

			expect(res.status).toBe(302);
			expect(res.headers.get("location")).toBe("/links/10/0");
		});
	});
});
