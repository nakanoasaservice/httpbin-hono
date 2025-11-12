import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { statusCodes } from "../../src/routes/status-codes";

describe("Status Codes", () => {
	describe("GET /status/:codes", () => {
		it("should return 200 status code", async () => {
			const res = await statusCodes.request("/status/200", {}, env);

			expect(res.status).toBe(200);
			const text = await res.text();
			expect(text).toBe("");
		});

		it("should return 301 status code with Location header", async () => {
			const res = await statusCodes.request("/status/301", {}, env);

			expect(res.status).toBe(301);
			expect(res.headers.get("location")).toBe("/redirect/1");
			const text = await res.text();
			expect(text).toBe("");
		});

		it("should return 302 status code with Location header", async () => {
			const res = await statusCodes.request("/status/302", {}, env);

			expect(res.status).toBe(302);
			expect(res.headers.get("location")).toBe("/redirect/1");
			const text = await res.text();
			expect(text).toBe("");
		});

		it("should return 303 status code with Location header", async () => {
			const res = await statusCodes.request("/status/303", {}, env);

			expect(res.status).toBe(303);
			expect(res.headers.get("location")).toBe("/redirect/1");
			const text = await res.text();
			expect(text).toBe("");
		});

		it("should return 304 status code with empty body", async () => {
			const res = await statusCodes.request("/status/304", {}, env);

			expect(res.status).toBe(304);
			const text = await res.text();
			expect(text).toBe("");
		});

		it("should return 305 status code with Location header", async () => {
			const res = await statusCodes.request("/status/305", {}, env);

			expect(res.status).toBe(305);
			expect(res.headers.get("location")).toBe("/redirect/1");
			const text = await res.text();
			expect(text).toBe("");
		});

		it("should return 307 status code with Location header", async () => {
			const res = await statusCodes.request("/status/307", {}, env);

			expect(res.status).toBe(307);
			expect(res.headers.get("location")).toBe("/redirect/1");
			const text = await res.text();
			expect(text).toBe("");
		});

		it("should return 401 status code with WWW-Authenticate header", async () => {
			const res = await statusCodes.request("/status/401", {}, env);

			expect(res.status).toBe(401);
			expect(res.headers.get("www-authenticate")).toBe(
				'Basic realm="Fake Realm"',
			);
			const text = await res.text();
			expect(text).toBe("");
		});

		it("should return 402 status code with custom message and header", async () => {
			const res = await statusCodes.request("/status/402", {}, env);

			expect(res.status).toBe(402);
			const text = await res.text();
			expect(text).toBe("Fuck you, pay me!");
			expect(res.headers.get("x-more-info")).toBe("http://vimeo.com/22053820");
		});

		it("should return 406 status code with JSON response", async () => {
			const res = await statusCodes.request("/status/406", {}, env);

			expect(res.status).toBe(406);
			expect(res.headers.get("content-type")).toBe("application/json");
			const data = await res.json();
			expect(data).toEqual({
				message: "Client did not request a supported media type.",
				accept: [
					"image/webp",
					"image/svg+xml",
					"image/jpeg",
					"image/png",
					"image/*",
				],
			});
		});

		it("should return 407 status code with Proxy-Authenticate header", async () => {
			const res = await statusCodes.request("/status/407", {}, env);

			expect(res.status).toBe(407);
			expect(res.headers.get("proxy-authenticate")).toBe(
				'Basic realm="Fake Realm"',
			);
			const text = await res.text();
			expect(text).toBe("");
		});

		it("should return 418 status code with ASCII art", async () => {
			const res = await statusCodes.request("/status/418", {}, env);

			expect(res.status).toBe(418);
			const text = await res.text();
			expect(text).toContain("teapot");
			expect(res.headers.get("x-more-info")).toBe(
				"http://tools.ietf.org/html/rfc2324",
			);
		});

		it("should return 500 status code", async () => {
			const res = await statusCodes.request("/status/500", {}, env);

			expect(res.status).toBe(500);
			const text = await res.text();
			expect(text).toBe("");
		});
	});

	describe("Multiple HTTP methods to /status/:codes", () => {
		const methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "TRACE"];

		for (const method of methods) {
			it(`should return 418 status code for ${method} method`, async () => {
				const res = await statusCodes.request("/status/418", { method }, env);

				expect(res.status).toBe(418);
			});
		}
	});

	describe("Invalid status codes", () => {
		it("should return 400 for invalid status code", async () => {
			const res = await statusCodes.request("/status/4!9", {}, env);

			expect(res.status).toBe(400);
			const text = await res.text();
			expect(text).toBe("Invalid status code");
		});

		it("should return 400 for invalid status codes in comma-separated list", async () => {
			const res = await statusCodes.request("/status/200,402,foo", {}, env);

			expect(res.status).toBe(400);
			const text = await res.text();
			expect(text).toBe("Invalid status code");
		});
	});

	describe("Multiple status codes with weighted selection", () => {
		it("should return one of the specified status codes", async () => {
			const res = await statusCodes.request("/status/200,201,202", {}, env);

			expect([200, 201, 202]).toContain(res.status);
		});

		it("should return one of the specified status codes with weights", async () => {
			const res = await statusCodes.request(
				"/status/200:1,201:2,202:3",
				{},
				env,
			);

			expect([200, 201, 202]).toContain(res.status);
		});

		it("should handle weighted selection with decimal weights", async () => {
			const res = await statusCodes.request(
				"/status/200:0.5,201:0.3,202:0.2",
				{},
				env,
			);

			expect([200, 201, 202]).toContain(res.status);
		});
	});
});
