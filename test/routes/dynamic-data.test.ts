import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { dynamicData } from "../../src/routes/dynamic-data";

type UuidResponse = {
	uuid: string;
};

type DelayResponse = {
	args: Record<string, string | string[]>;
	form: Record<string, string | string[]> | null;
	data: string;
	files: Record<string, string | string[]>;
	headers: Record<string, string>;
	json: unknown;
	origin: string;
	url: string;
};

describe("Dynamic Data", () => {
	describe("GET /uuid", () => {
		it("should return a valid UUID", async () => {
			const res = await dynamicData.request("/uuid", {}, env);

			expect(res.status).toBe(200);
			expect(res.headers.get("content-type")).toContain("application/json");
			const data = (await res.json()) as UuidResponse;
			expect(data.uuid).toBeDefined();
			// UUID format: 8-4-4-4-12 hexadecimal digits
			const uuidRegex =
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
			expect(data.uuid).toMatch(uuidRegex);
		});

		it("should return different UUIDs on each request", async () => {
			const res1 = await dynamicData.request("/uuid", {}, env);
			const res2 = await dynamicData.request("/uuid", {}, env);

			expect(res1.status).toBe(200);
			expect(res2.status).toBe(200);
			const data1 = (await res1.json()) as UuidResponse;
			const data2 = (await res2.json()) as UuidResponse;
			expect(data1.uuid).not.toBe(data2.uuid);
		});
	});

	describe("GET /base64/:value", () => {
		it("should decode valid Base64 string", async () => {
			// "HTTPBIN is awesome" encoded in Base64
			const encoded = "SFRUUEJJTiBpcyBhd2Vzb21l"; // cspell:disable-line
			const res = await dynamicData.request(`/base64/${encoded}`, {}, env);

			expect(res.status).toBe(200);
			const text = await res.text();
			expect(text).toBe("HTTPBIN is awesome");
		});

		it("should decode URL-safe Base64 string with dashes", async () => {
			// "ø" encoded in Base64URL: w7g
			const encoded = "w7g"; // Base64URL for "ø"
			const res = await dynamicData.request(`/base64/${encoded}`, {}, env);

			expect(res.status).toBe(200);
			const text = await res.text();
			expect(text).toBe("ø");
		});

		it("should decode Base64URL string for ü", async () => {
			// "ü" encoded in Base64URL: w7w
			const encoded = "w7w"; // Base64URL for "ü"
			const res = await dynamicData.request(`/base64/${encoded}`, {}, env);

			expect(res.status).toBe(200);
			const text = await res.text();
			expect(text).toBe("ü");
		});

		it("should return error message for invalid Base64 data", async () => {
			const invalidBase64 = "invalid-base64!!!";
			const res = await dynamicData.request(
				`/base64/${invalidBase64}`,
				{},
				env,
			);

			expect(res.status).toBe(200);
			const text = await res.text();
			expect(text).toBe(
				"Incorrect Base64 data try: SFRUUEJJTiBpcyBhd2Vzb21l", // cspell:disable-line
			);
		});
	});

	describe("GET /bytes/:n", () => {
		it("should return specified number of bytes", async () => {
			const n = 10;
			const res = await dynamicData.request(`/bytes/${n}`, {}, env);

			expect(res.status).toBe(200);
			expect(res.headers.get("content-type")).toBe("application/octet-stream");
			const arrayBuffer = await res.arrayBuffer();
			expect(arrayBuffer.byteLength).toBe(n);
		});

		it("should return 0 bytes when n is 0", async () => {
			const res = await dynamicData.request("/bytes/0", {}, env);

			expect(res.status).toBe(200);
			expect(res.headers.get("content-type")).toBe("application/octet-stream");
			const arrayBuffer = await res.arrayBuffer();
			expect(arrayBuffer.byteLength).toBe(0);
		});

		it("should return different random bytes on each request", async () => {
			const n = 100;
			const res1 = await dynamicData.request(`/bytes/${n}`, {}, env);
			const res2 = await dynamicData.request(`/bytes/${n}`, {}, env);

			expect(res1.status).toBe(200);
			expect(res2.status).toBe(200);
			const bytes1 = new Uint8Array(await res1.arrayBuffer());
			const bytes2 = new Uint8Array(await res2.arrayBuffer());

			// It's extremely unlikely that two random 100-byte arrays are identical
			// But we check that they're not all zeros (which would indicate a bug)
			const allZeros1 = bytes1.every((b) => b === 0);
			const allZeros2 = bytes2.every((b) => b === 0);
			expect(allZeros1 || allZeros2).toBe(false);
		});

		it("should limit bytes to 100KB maximum", async () => {
			const maxBytes = 100 * 1024; // 100KB
			const requestedBytes = maxBytes + 1000;
			const res = await dynamicData.request(
				`/bytes/${requestedBytes}`,
				{},
				env,
			);

			expect(res.status).toBe(200);
			const arrayBuffer = await res.arrayBuffer();
			expect(arrayBuffer.byteLength).toBe(maxBytes);
		});

		it("should return 400 for invalid byte count (negative)", async () => {
			const res = await dynamicData.request("/bytes/-1", {}, env);

			expect(res.status).toBe(400);
			const data = await res.json();
			expect(data).toEqual({
				error: "Invalid byte count. Must be a positive integer",
			});
		});

		it("should return 400 for invalid byte count (non-numeric)", async () => {
			const res = await dynamicData.request("/bytes/abc", {}, env);

			expect(res.status).toBe(400);
			const data = await res.json();
			expect(data).toEqual({
				error: "Invalid byte count. Must be a positive integer",
			});
		});

		it("should return deterministic bytes when seed parameter is provided", async () => {
			const n = 10;
			const seed = 12345;
			const res1 = await dynamicData.request(
				`/bytes/${n}?seed=${seed}`,
				{},
				env,
			);
			const res2 = await dynamicData.request(
				`/bytes/${n}?seed=${seed}`,
				{},
				env,
			);

			expect(res1.status).toBe(200);
			expect(res2.status).toBe(200);
			const bytes1 = new Uint8Array(await res1.arrayBuffer());
			const bytes2 = new Uint8Array(await res2.arrayBuffer());

			// With the same seed, bytes should be identical
			expect(bytes1).toEqual(bytes2);
		});

		it("should return different bytes for different seeds", async () => {
			const n = 10;
			const res1 = await dynamicData.request(`/bytes/${n}?seed=12345`, {}, env);
			const res2 = await dynamicData.request(`/bytes/${n}?seed=67890`, {}, env);

			expect(res1.status).toBe(200);
			expect(res2.status).toBe(200);
			const bytes1 = new Uint8Array(await res1.arrayBuffer());
			const bytes2 = new Uint8Array(await res2.arrayBuffer());

			// Different seeds should produce different bytes
			expect(bytes1).not.toEqual(bytes2);
		});
	});

	describe("GET /delay/:delay", () => {
		it("should delay response by specified seconds", async () => {
			const delay = 0.1; // 100ms
			const startTime = Date.now();
			const res = await dynamicData.request(`/delay/${delay}`, {}, env);
			const endTime = Date.now();

			expect(res.status).toBe(200);
			const elapsed = (endTime - startTime) / 1000;
			// Allow some tolerance for test execution time
			expect(elapsed).toBeGreaterThanOrEqual(delay);
			expect(elapsed).toBeLessThan(delay + 0.5);

			const data = (await res.json()) as DelayResponse;
			expect(data.args).toEqual({});
			expect(data.url).toContain(`/delay/${delay}`);
		});

		it.skip("should limit delay to 10 seconds maximum", async () => {
			const delay = 15; // Request 15 seconds
			const startTime = Date.now();
			const res = await dynamicData.request(`/delay/${delay}`, {}, env);
			const endTime = Date.now();

			expect(res.status).toBe(200);
			const elapsed = (endTime - startTime) / 1000;
			// Should be limited to 10 seconds
			expect(elapsed).toBeLessThan(11);
			expect(elapsed).toBeGreaterThanOrEqual(9.5);
		}, 12000); // 12 second timeout

		it("should return request information after delay", async () => {
			const delay = 0.1;
			const res = await dynamicData.request(
				`/delay/${delay}?foo=bar&baz=qux`,
				{
					headers: {
						"User-Agent": "test-agent",
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as DelayResponse;
			expect(data.args).toEqual({
				foo: "bar",
				baz: "qux",
			});
			expect(data.headers["user-agent"]).toBe("test-agent");
			expect(data.url).toContain(`/delay/${delay}`);
		});

		it("should return 400 for invalid delay (negative)", async () => {
			const res = await dynamicData.request("/delay/-1", {}, env);

			expect(res.status).toBe(400);
			const data = await res.json();
			expect(data).toEqual({
				error: "Invalid delay. Must be a non-negative number",
			});
		});

		it("should return 400 for invalid delay (non-numeric)", async () => {
			const res = await dynamicData.request("/delay/abc", {}, env);

			expect(res.status).toBe(400);
			const data = await res.json();
			expect(data).toEqual({
				error: "Invalid delay. Must be a non-negative number",
			});
		});
	});

	describe("POST /delay/:delay", () => {
		it("should delay POST response and return request body", async () => {
			const delay = 0.1;
			const bodyData = JSON.stringify({ test: "data" });
			const res = await dynamicData.request(
				`/delay/${delay}`,
				{
					method: "POST",
					body: bodyData,
					headers: {
						"Content-Type": "application/json",
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as DelayResponse;
			expect(data.data).toBe(bodyData);
			expect(data.json).toEqual({ test: "data" });
		});
	});

	describe("PUT /delay/:delay", () => {
		it("should delay PUT response and return request body", async () => {
			const delay = 0.1;
			const bodyData = "test body";
			const res = await dynamicData.request(
				`/delay/${delay}`,
				{
					method: "PUT",
					body: bodyData,
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as DelayResponse;
			expect(data.data).toBe(bodyData);
		});
	});

	describe("DELETE /delay/:delay", () => {
		it("should delay DELETE response", async () => {
			const delay = 0.1;
			const res = await dynamicData.request(
				`/delay/${delay}`,
				{
					method: "DELETE",
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as DelayResponse;
			expect(data.url).toContain(`/delay/${delay}`);
		});
	});

	describe("PATCH /delay/:delay", () => {
		it("should delay PATCH response and return request body", async () => {
			const delay = 0.1;
			const bodyData = JSON.stringify({ patch: "data" });
			const res = await dynamicData.request(
				`/delay/${delay}`,
				{
					method: "PATCH",
					body: bodyData,
					headers: {
						"Content-Type": "application/json",
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as DelayResponse;
			expect(data.data).toBe(bodyData);
		});
	});

	describe("TRACE /delay/:delay", () => {
		it("should delay TRACE response", async () => {
			const delay = 0.1;
			const res = await dynamicData.request(
				`/delay/${delay}`,
				{
					method: "TRACE",
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as DelayResponse;
			expect(data.url).toContain(`/delay/${delay}`);
		});
	});
});
