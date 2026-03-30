import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { anything } from "../../src/routes/anything";

type AnythingResponse = {
	args: Record<string, string | string[]>;
	data: string;
	files: Record<string, string | string[]>;
	form: Record<string, string | string[]> | null;
	headers: Record<string, string>;
	json: unknown;
	method: string;
	origin: string;
	url: string;
};

describe("Anything", () => {
	describe("GET /anything", () => {
		it("should return 200 response with request information", async () => {
			const res = await anything.request("/anything", {}, env);

			expect(res.status).toBe(200);
			const data = (await res.json()) as AnythingResponse;
			expect(data.args).toEqual({});
			expect(data.method).toBe("GET");
			expect(data.url).toContain("/anything");
			expect(data.headers).toBeDefined();
			expect(data.origin).toBeDefined();
			expect(data.data).toBe("");
			expect(data.files).toEqual({});
			expect(data.form).toEqual({});
			expect(data.json).toBeNull();
		});

		it("should return query parameters in args", async () => {
			const res = await anything.request("/anything?foo=bar&baz=qux", {}, env);

			expect(res.status).toBe(200);
			const data = (await res.json()) as AnythingResponse;
			expect(data.args).toEqual({
				foo: "bar",
				baz: "qux",
			});
		});

		it("should return multiple values for same query parameter", async () => {
			const res = await anything.request("/anything?foo=bar&foo=baz", {}, env);

			expect(res.status).toBe(200);
			const data = (await res.json()) as AnythingResponse;
			expect(data.args).toEqual({
				foo: ["bar", "baz"],
			});
		});

		it("should return request headers", async () => {
			const res = await anything.request(
				"/anything",
				{
					headers: {
						"User-Agent": "test-agent",
						Accept: "application/json",
						"Custom-Header": "custom-value",
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as AnythingResponse;
			// HTTP headers are normalized to lowercase
			expect(data.headers["user-agent"]).toBe("test-agent");
			expect(data.headers["accept"]).toBe("application/json");
			expect(data.headers["custom-header"]).toBe("custom-value");
		});
	});

	describe("GET /anything/:anything", () => {
		it("should return 200 response with request information", async () => {
			const res = await anything.request("/anything/foo/bar", {}, env);

			expect(res.status).toBe(200);
			const data = (await res.json()) as AnythingResponse;
			expect(data.args).toEqual({});
			expect(data.method).toBe("GET");
			expect(data.url).toContain("/anything/foo/bar");
			expect(data.headers).toBeDefined();
			expect(data.origin).toBeDefined();
			expect(data.data).toBe("");
			expect(data.files).toEqual({});
			expect(data.form).toEqual({});
			expect(data.json).toBeNull();
		});

		it("should return query parameters in args", async () => {
			const res = await anything.request(
				"/anything/foo/bar?test=value",
				{},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as AnythingResponse;
			expect(data.args).toEqual({
				test: "value",
			});
		});
	});

	describe("POST /anything", () => {
		it("should handle text body", async () => {
			const textData = "Hello, world!";
			const res = await anything.request(
				"/anything",
				{
					method: "POST",
					body: textData,
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as AnythingResponse;
			expect(data.method).toBe("POST");
			expect(data.data).toBe(textData);
		});

		it("should handle JSON body", async () => {
			const bodyData = JSON.stringify({ animal: "dog" });
			const res = await anything.request(
				"/anything",
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
			const data = (await res.json()) as AnythingResponse;
			expect(data.method).toBe("POST");
			expect(data.json).toEqual({ animal: "dog" });
			expect(data.data).toBe(bodyData);
		});

		it("should handle form-urlencoded body", async () => {
			const formData = "foo=bar&baz=qux";
			const res = await anything.request(
				"/anything",
				{
					method: "POST",
					body: formData,
					headers: {
						"Content-Type": "application/x-www-form-urlencoded",
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as AnythingResponse;
			expect(data.method).toBe("POST");
			expect(data.form).toEqual({
				foo: "bar",
				baz: "qux",
			});
		});

		it("should handle binary data", async () => {
			const binaryData = new Uint8Array([0x01, 0x02, 0x03, 0x81, 0x82, 0x83]);
			const res = await anything.request(
				"/anything",
				{
					method: "POST",
					body: binaryData,
					headers: {
						"Content-Type": "application/octet-stream",
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as AnythingResponse;
			expect(data.method).toBe("POST");
			expect(data.data).toBeDefined();
		});

		it("should handle multipart/form-data with files", async () => {
			const binaryData = new Uint8Array([0x01, 0x02, 0x03]);
			const formData = new FormData();
			const blob = new Blob([binaryData], { type: "application/octet-stream" });
			formData.append("file", blob, "test.bin");

			const res = await anything.request(
				"/anything",
				{
					method: "POST",
					body: formData,
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as AnythingResponse;
			expect(data.method).toBe("POST");
			expect(data.files).toBeDefined();
			expect(Object.keys(data.files).length).toBeGreaterThan(0);
		});

		it("should handle unicode body", async () => {
			const unicodeData = "оживлённым";
			const res = await anything.request(
				"/anything",
				{
					method: "POST",
					body: unicodeData,
					headers: {
						"Content-Type": "text/plain; charset=utf-8",
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as AnythingResponse;
			expect(data.method).toBe("POST");
			expect(data.data).toBe(unicodeData);
		});
	});

	describe("PUT /anything", () => {
		it("should handle PUT request with body", async () => {
			const bodyData = JSON.stringify({ animal: "cat" });
			const res = await anything.request(
				"/anything",
				{
					method: "PUT",
					body: bodyData,
					headers: {
						"Content-Type": "application/json",
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as AnythingResponse;
			expect(data.method).toBe("PUT");
			expect(data.json).toEqual({ animal: "cat" });
		});
	});

	describe("PATCH /anything", () => {
		it("should handle PATCH request with body", async () => {
			const bodyData = JSON.stringify({ animal: "bird" });
			const res = await anything.request(
				"/anything",
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
			const data = (await res.json()) as AnythingResponse;
			expect(data.method).toBe("PATCH");
			expect(data.json).toEqual({ animal: "bird" });
		});
	});

	describe("DELETE /anything", () => {
		it("should handle DELETE request", async () => {
			const res = await anything.request(
				"/anything",
				{
					method: "DELETE",
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as AnythingResponse;
			expect(data.method).toBe("DELETE");
		});

		it("should handle DELETE request with body", async () => {
			const bodyData = JSON.stringify({ animal: "fish" });
			const res = await anything.request(
				"/anything",
				{
					method: "DELETE",
					body: bodyData,
					headers: {
						"Content-Type": "application/json",
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as AnythingResponse;
			expect(data.method).toBe("DELETE");
			expect(data.json).toEqual({ animal: "fish" });
		});
	});

	describe("POST /anything/:anything", () => {
		it("should handle POST request with path parameter", async () => {
			const bodyData = JSON.stringify({ test: "value" });
			const res = await anything.request(
				"/anything/foo/bar",
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
			const data = (await res.json()) as AnythingResponse;
			expect(data.method).toBe("POST");
			expect(data.url).toContain("/anything/foo/bar");
			expect(data.json).toEqual({ test: "value" });
		});
	});
});
