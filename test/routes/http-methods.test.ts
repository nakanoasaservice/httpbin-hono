import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { httpMethods } from "../../src/routes/http-methods";

type GetResponse = {
	args: Record<string, string | string[]>;
	headers: Record<string, string>;
	origin: string;
	url: string;
};

type PostResponse = {
	url: string;
	args: Record<string, string | string[]>;
	form: Record<string, string | string[]> | null;
	data: string;
	origin: string;
	headers: Record<string, string>;
	files: Record<string, string | string[]>;
	json: unknown;
};

describe("HTTP Methods", () => {
	describe("GET /get", () => {
		it("should return 200 response with request information", async () => {
			const res = await httpMethods.request(
				"/get",
				{
					headers: { "User-Agent": "test" },
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as GetResponse;
			expect(data.args).toEqual({});
			// HTTP headers are normalized to lowercase
			expect(data.headers["user-agent"]).toBe("test");
			expect(data.url).toContain("/get");
		});
	});

	describe("POST /post", () => {
		it("should handle binary data", async () => {
			const binaryData = new Uint8Array([0x01, 0x02, 0x03, 0x81, 0x82, 0x83]);
			const res = await httpMethods.request(
				"/post",
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
		});

		it("should handle text body", async () => {
			const textData = "Hello, world!";
			const res = await httpMethods.request(
				"/post",
				{
					method: "POST",
					body: textData,
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as PostResponse;
			expect(data.data).toBe(textData);
		});

		it("should handle binary file data", async () => {
			const binaryData = new Uint8Array([0x01, 0x02, 0x03, 0x81, 0x82, 0x83]);
			const formData = new FormData();
			const blob = new Blob([binaryData], { type: "application/octet-stream" });
			formData.append("file", blob, "test.bin");

			const res = await httpMethods.request(
				"/post",
				{
					method: "POST",
					body: formData,
				},
				env,
			);

			expect(res.status).toBe(200);
		});

		it("should handle unicode body", async () => {
			const unicodeData = "оживлённым";
			const res = await httpMethods.request(
				"/post",
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
			const data = (await res.json()) as PostResponse;
			expect(data.data).toBe(unicodeData);
		});

		it("should handle file with missing content-type header", async () => {
			// Build multipart form data manually
			const boundary = "bound";
			const data = `--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="test.bin"\r\n\r\n\xa5\xc6\n--${boundary}--\r\n`;

			const res = await httpMethods.request(
				"/post",
				{
					method: "POST",
					body: data,
					headers: {
						"Content-Type": `multipart/form-data; boundary=${boundary}`,
					},
				},
				env,
			);

			expect(res.status).toBe(200);
		});
	});

	describe("PUT /put", () => {
		it("should handle PUT request with body", async () => {
			const bodyData = JSON.stringify({ animal: "dog" });
			const res = await httpMethods.request(
				"/put",
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
			const data = (await res.json()) as PostResponse;
			expect(data.json).toEqual({ animal: "dog" });
		});
	});

	describe("PATCH /patch", () => {
		it("should handle PATCH request with body", async () => {
			const bodyData = JSON.stringify({ animal: "cat" });
			const res = await httpMethods.request(
				"/patch",
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
			const data = (await res.json()) as PostResponse;
			expect(data.json).toEqual({ animal: "cat" });
		});
	});

	describe("DELETE /delete", () => {
		it("should handle DELETE request with body", async () => {
			const bodyData = JSON.stringify({ animal: "bird" });
			const res = await httpMethods.request(
				"/delete",
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
			const data = (await res.json()) as PostResponse;
			expect(data.json).toEqual({ animal: "bird" });
		});
	});
});
