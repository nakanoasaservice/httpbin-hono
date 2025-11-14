import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { responseInspection } from "../../src/routes/response-inspection";

type GetResponse = {
	args: Record<string, string | string[]>;
	headers: Record<string, string>;
	origin: string;
	url: string;
};

type ResponseHeadersResponse = Record<string, string | string[]>;

describe("Response Inspection", () => {
	describe("GET /cache", () => {
		it("should return 200 with Last-Modified and ETag headers", async () => {
			const res = await responseInspection.request("/cache", {}, env);

			expect(res.status).toBe(200);
			expect(res.headers.get("last-modified")).toBeTruthy();
			expect(res.headers.get("etag")).toBeTruthy();

			const data = (await res.json()) as GetResponse;
			expect(data.args).toEqual({});
			expect(data.url).toContain("/cache");
		});

		it("should return 304 when If-Modified-Since header is present", async () => {
			const res = await responseInspection.request(
				"/cache",
				{
					headers: {
						"If-Modified-Since": "Wed, 21 Oct 2015 07:28:00 GMT",
					},
				},
				env,
			);

			expect(res.status).toBe(304);
			const text = await res.text();
			expect(text).toBe("");
		});

		it("should return 304 when If-None-Match header is present", async () => {
			const res = await responseInspection.request(
				"/cache",
				{
					headers: {
						"If-None-Match": '"abc123"',
					},
				},
				env,
			);

			expect(res.status).toBe(304);
			const text = await res.text();
			expect(text).toBe("");
		});

		it("should return 304 when both If-Modified-Since and If-None-Match headers are present", async () => {
			const res = await responseInspection.request(
				"/cache",
				{
					headers: {
						"If-Modified-Since": "Wed, 21 Oct 2015 07:28:00 GMT",
						"If-None-Match": '"abc123"',
					},
				},
				env,
			);

			expect(res.status).toBe(304);
			const text = await res.text();
			expect(text).toBe("");
		});
	});

	describe("GET /cache/:value", () => {
		it("should set Cache-Control header with max-age", async () => {
			const res = await responseInspection.request("/cache/60", {}, env);

			expect(res.status).toBe(200);
			expect(res.headers.get("cache-control")).toBe("public, max-age=60");

			const data = (await res.json()) as GetResponse;
			expect(data.url).toContain("/cache/60");
		});

		it("should handle different max-age values", async () => {
			const maxAge = "3600";
			const res = await responseInspection.request(`/cache/${maxAge}`, {}, env);

			expect(res.status).toBe(200);
			expect(res.headers.get("cache-control")).toBe(
				`public, max-age=${maxAge}`,
			);
		});
	});

	describe("GET /etag/:etag", () => {
		it("should return 200 with ETag header", async () => {
			const etag = "abc123";
			const res = await responseInspection.request(`/etag/${etag}`, {}, env);

			expect(res.status).toBe(200);
			expect(res.headers.get("etag")).toBe(etag);

			const data = (await res.json()) as GetResponse;
			expect(data.url).toContain(`/etag/${etag}`);
		});

		it("should return 304 when If-None-Match matches the ETag", async () => {
			const etag = "abc123";
			const res = await responseInspection.request(
				`/etag/${etag}`,
				{
					headers: {
						"If-None-Match": etag,
					},
				},
				env,
			);

			expect(res.status).toBe(304);
			expect(res.headers.get("etag")).toBe(etag);
			const text = await res.text();
			expect(text).toBe("");
		});

		it("should return 304 when If-None-Match contains wildcard", async () => {
			const etag = "abc123";
			const res = await responseInspection.request(
				`/etag/${etag}`,
				{
					headers: {
						"If-None-Match": "*",
					},
				},
				env,
			);

			expect(res.status).toBe(304);
			expect(res.headers.get("etag")).toBe(etag);
		});

		it("should return 304 when If-None-Match contains multiple values including the ETag", async () => {
			const etag = "abc123";
			const res = await responseInspection.request(
				`/etag/${etag}`,
				{
					headers: {
						"If-None-Match": '"xyz789", "abc123", "def456"',
					},
				},
				env,
			);

			expect(res.status).toBe(304);
			expect(res.headers.get("etag")).toBe(etag);
		});

		it("should return 200 when If-None-Match does not match the ETag", async () => {
			const etag = "abc123";
			const res = await responseInspection.request(
				`/etag/${etag}`,
				{
					headers: {
						"If-None-Match": '"different-etag"',
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			expect(res.headers.get("etag")).toBe(etag);
		});

		it("should return 412 when If-Match does not match the ETag", async () => {
			const etag = "abc123";
			const res = await responseInspection.request(
				`/etag/${etag}`,
				{
					headers: {
						"If-Match": '"different-etag"',
					},
				},
				env,
			);

			expect(res.status).toBe(412);
			const text = await res.text();
			expect(text).toBe("");
		});

		it("should return 200 when If-Match matches the ETag", async () => {
			const etag = "abc123";
			const res = await responseInspection.request(
				`/etag/${etag}`,
				{
					headers: {
						"If-Match": etag,
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			expect(res.headers.get("etag")).toBe(etag);
		});

		it("should return 200 when If-Match contains wildcard", async () => {
			const etag = "abc123";
			const res = await responseInspection.request(
				`/etag/${etag}`,
				{
					headers: {
						"If-Match": "*",
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			expect(res.headers.get("etag")).toBe(etag);
		});

		it("should handle weak ETags in If-None-Match", async () => {
			const etag = "abc123";
			const res = await responseInspection.request(
				`/etag/${etag}`,
				{
					headers: {
						"If-None-Match": `W/${etag}`,
					},
				},
				env,
			);

			expect(res.status).toBe(304);
			expect(res.headers.get("etag")).toBe(etag);
		});

		it("should handle multiple weak ETags in If-None-Match", async () => {
			const etag = "abc123";
			const res = await responseInspection.request(
				`/etag/${etag}`,
				{
					headers: {
						"If-None-Match": 'W/"xyz789", W/"abc123"',
					},
				},
				env,
			);

			expect(res.status).toBe(304);
			expect(res.headers.get("etag")).toBe(etag);
		});
	});

	describe.each([
		{ method: "GET", requestOptions: {} },
		{ method: "POST", requestOptions: { method: "POST" } },
	])("$method /response-headers", ({ requestOptions }) => {
		it("should return empty object when no query parameters are provided", async () => {
			const res = await responseInspection.request(
				"/response-headers",
				requestOptions,
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as ResponseHeadersResponse;
			expect(data).toEqual({});
		});

		it("should set response headers from query parameters", async () => {
			const res = await responseInspection.request(
				"/response-headers?Content-Type=application/json&X-Custom-Header=test",
				requestOptions,
				env,
			);

			expect(res.status).toBe(200);
			expect(res.headers.get("content-type")).toBe("application/json");
			expect(res.headers.get("x-custom-header")).toBe("test");

			const data = (await res.json()) as ResponseHeadersResponse;
			// Query parameter keys are preserved as-is (case-sensitive)
			// But JSON keys might be normalized to lowercase
			expect(data["Content-Type"] || data["content-type"]).toBe(
				"application/json",
			);
			expect(data["X-Custom-Header"] || data["x-custom-header"]).toBe("test");
		});

		it("should include response headers in JSON body", async () => {
			const res = await responseInspection.request(
				"/response-headers?X-Test-Header=test-value",
				requestOptions,
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as ResponseHeadersResponse;
			expect(data["X-Test-Header"] || data["x-test-header"]).toBe("test-value");
		});

		it("should handle multiple values for the same header", async () => {
			const res = await responseInspection.request(
				"/response-headers?X-Multiple=value1&X-Multiple=value2",
				requestOptions,
				env,
			);

			expect(res.status).toBe(200);
			const headerValues = res.headers.get("x-multiple");
			expect(headerValues).toBeTruthy();

			const data = (await res.json()) as ResponseHeadersResponse;
			// Multiple values should be represented as array or single value
			expect(data["X-Multiple"] || data["x-multiple"]).toBeTruthy();
		});

		it("should handle URL-encoded header values", async () => {
			const headerValue = "test%20value";
			const res = await responseInspection.request(
				`/response-headers?X-Encoded=${encodeURIComponent(headerValue)}`,
				requestOptions,
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as ResponseHeadersResponse;
			expect(data["X-Encoded"] || data["x-encoded"]).toBeTruthy();
		});

		it("should handle special characters in header names", async () => {
			const res = await responseInspection.request(
				"/response-headers?X-Test-123=value",
				requestOptions,
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as ResponseHeadersResponse;
			expect(data["X-Test-123"] || data["x-test-123"]).toBe("value");
		});
	});
});
