import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { redirects } from "../../src/routes/redirects";

describe("Redirects", () => {
	describe("GET /redirect/:n", () => {
		it("should redirect to /get when n equals 1", async () => {
			const res = await redirects.request("/redirect/1", {}, env);

			expect(res.status).toBe(302);
			expect(res.headers.get("location")).toBe("/get");
		});

		it("should redirect to /relative-redirect/:n-1 when n is higher than 1", async () => {
			const res = await redirects.request("/redirect/5", {}, env);

			expect(res.status).toBe(302);
			expect(res.headers.get("location")).toBe("/relative-redirect/4");
		});

		it("should redirect to absolute URL when absolute=true and n equals 1", async () => {
			const res = await redirects.request("/redirect/1?absolute=true", {}, env);

			expect(res.status).toBe(302);
			const location = res.headers.get("location");
			expect(location).toMatch(/^https?:\/\/.+\/get$/);
		});

		it("should redirect to absolute URL when absolute=true and n is higher than 1", async () => {
			const res = await redirects.request("/redirect/5?absolute=true", {}, env);

			expect(res.status).toBe(302);
			const location = res.headers.get("location");
			expect(location).toMatch(/^https?:\/\/.+\/absolute-redirect\/4$/);
		});

		it("should return 400 for invalid redirect count (n < 1)", async () => {
			const res = await redirects.request("/redirect/0", {}, env);

			expect(res.status).toBe(400);
			const data = (await res.json()) as { error: string };
			expect(data.error).toBe("Invalid redirect count");
		});

		it("should return 400 for invalid redirect count (non-numeric)", async () => {
			const res = await redirects.request("/redirect/abc", {}, env);

			expect(res.status).toBe(400);
			const data = (await res.json()) as { error: string };
			expect(data.error).toBe("Invalid redirect count");
		});
	});

	describe("GET /relative-redirect/:n", () => {
		it("should redirect to /get when n equals 1", async () => {
			const res = await redirects.request("/relative-redirect/1", {}, env);

			expect(res.status).toBe(302);
			expect(res.headers.get("location")).toBe("/get");
		});

		it("should redirect to /relative-redirect/:n-1 when n is higher than 1", async () => {
			const res = await redirects.request("/relative-redirect/7", {}, env);

			expect(res.status).toBe(302);
			expect(res.headers.get("location")).toBe("/relative-redirect/6");
		});

		it("should return 400 for invalid redirect count (n < 1)", async () => {
			const res = await redirects.request("/relative-redirect/0", {}, env);

			expect(res.status).toBe(400);
			const data = (await res.json()) as { error: string };
			expect(data.error).toBe("Invalid redirect count");
		});

		it("should return 400 for invalid redirect count (non-numeric)", async () => {
			const res = await redirects.request("/relative-redirect/abc", {}, env);

			expect(res.status).toBe(400);
			const data = (await res.json()) as { error: string };
			expect(data.error).toBe("Invalid redirect count");
		});
	});

	describe("GET /absolute-redirect/:n", () => {
		it("should redirect to absolute URL /get when n equals 1", async () => {
			const res = await redirects.request("/absolute-redirect/1", {}, env);

			expect(res.status).toBe(302);
			const location = res.headers.get("location");
			expect(location).toMatch(/^https?:\/\/.+\/get$/);
		});

		it("should redirect to absolute URL /absolute-redirect/:n-1 when n is higher than 1", async () => {
			const res = await redirects.request("/absolute-redirect/5", {}, env);

			expect(res.status).toBe(302);
			const location = res.headers.get("location");
			expect(location).toMatch(/^https?:\/\/.+\/absolute-redirect\/4$/);
		});

		it("should return 400 for invalid redirect count (n < 1)", async () => {
			const res = await redirects.request("/absolute-redirect/0", {}, env);

			expect(res.status).toBe(400);
			const data = (await res.json()) as { error: string };
			expect(data.error).toBe("Invalid redirect count");
		});

		it("should return 400 for invalid redirect count (non-numeric)", async () => {
			const res = await redirects.request("/absolute-redirect/abc", {}, env);

			expect(res.status).toBe(400);
			const data = (await res.json()) as { error: string };
			expect(data.error).toBe("Invalid redirect count");
		});
	});

	describe("GET /redirect-to", () => {
		it("should redirect to specified URL with default status code 302", async () => {
			const res = await redirects.request("/redirect-to?url=/get", {}, env);

			expect(res.status).toBe(302);
			expect(res.headers.get("location")).toBe("/get");
		});

		it("should redirect to specified URL with custom status code 301", async () => {
			const res = await redirects.request(
				"/redirect-to?url=/get&status_code=301",
				{},
				env,
			);

			expect(res.status).toBe(301);
			expect(res.headers.get("location")).toBe("/get");
		});

		it("should redirect to specified URL with custom status code 303", async () => {
			const res = await redirects.request(
				"/redirect-to?url=/get&status_code=303",
				{},
				env,
			);

			expect(res.status).toBe(303);
			expect(res.headers.get("location")).toBe("/get");
		});

		it("should redirect to specified URL with custom status code 307", async () => {
			const res = await redirects.request(
				"/redirect-to?url=/get&status_code=307",
				{},
				env,
			);

			expect(res.status).toBe(307);
			expect(res.headers.get("location")).toBe("/get");
		});

		it("should redirect to specified URL with custom status code 308", async () => {
			const res = await redirects.request(
				"/redirect-to?url=/get&status_code=308",
				{},
				env,
			);

			expect(res.status).toBe(308);
			expect(res.headers.get("location")).toBe("/get");
		});

		it("should ignore invalid status code and use default 302", async () => {
			const res = await redirects.request(
				"/redirect-to?url=/get&status_code=200",
				{},
				env,
			);

			expect(res.status).toBe(302);
			expect(res.headers.get("location")).toBe("/get");
		});

		it("should return 400 when url parameter is missing", async () => {
			const res = await redirects.request("/redirect-to", {}, env);

			expect(res.status).toBe(400);
			const data = (await res.json()) as { error: string };
			expect(data.error).toBe("Missing url parameter");
		});

		it("should handle case-insensitive status_code parameter", async () => {
			const res = await redirects.request(
				"/redirect-to?url=/get&STATUS_CODE=307",
				{},
				env,
			);

			expect(res.status).toBe(307);
			expect(res.headers.get("location")).toBe("/get");
		});
	});

	describe("POST /redirect-to", () => {
		it("should redirect to specified URL from query parameter", async () => {
			const res = await redirects.request(
				"/redirect-to?url=/post&status_code=307",
				{
					method: "POST",
					body: new Uint8Array([0x01, 0x02, 0x03, 0x81, 0x82, 0x83]),
					headers: {
						"Content-Type": "application/octet-stream",
					},
				},
				env,
			);

			expect(res.status).toBe(307);
			expect(res.headers.get("location")).toBe("/post");
		});

		it("should redirect to specified URL from form data", async () => {
			const formData = new FormData();
			formData.append("url", "/post");
			formData.append("status_code", "307");

			const res = await redirects.request(
				"/redirect-to",
				{
					method: "POST",
					body: formData,
				},
				env,
			);

			expect(res.status).toBe(307);
			expect(res.headers.get("location")).toBe("/post");
		});

		it("should prioritize form data over query parameters", async () => {
			const formData = new FormData();
			formData.append("url", "/put");
			formData.append("status_code", "301");

			const res = await redirects.request(
				"/redirect-to?url=/post&status_code=307",
				{
					method: "POST",
					body: formData,
				},
				env,
			);

			expect(res.status).toBe(301);
			expect(res.headers.get("location")).toBe("/put");
		});

		it("should handle case-insensitive parameters", async () => {
			const formData = new FormData();
			formData.append("URL", "/post");
			formData.append("STATUS_CODE", "307");

			const res = await redirects.request(
				"/redirect-to",
				{
					method: "POST",
					body: formData,
				},
				env,
			);

			expect(res.status).toBe(307);
			expect(res.headers.get("location")).toBe("/post");
		});
	});

	describe("PUT /redirect-to", () => {
		it("should redirect to specified URL from query parameter", async () => {
			const res = await redirects.request(
				"/redirect-to?url=/put&status_code=307",
				{
					method: "PUT",
				},
				env,
			);

			expect(res.status).toBe(307);
			expect(res.headers.get("location")).toBe("/put");
		});

		it("should redirect to specified URL from form data", async () => {
			const formData = new FormData();
			formData.append("url", "/put");
			formData.append("status_code", "301");

			const res = await redirects.request(
				"/redirect-to",
				{
					method: "PUT",
					body: formData,
				},
				env,
			);

			expect(res.status).toBe(301);
			expect(res.headers.get("location")).toBe("/put");
		});
	});

	describe("DELETE /redirect-to", () => {
		it("should redirect to specified URL from query parameter", async () => {
			const res = await redirects.request(
				"/redirect-to?url=/delete&status_code=307",
				{
					method: "DELETE",
				},
				env,
			);

			expect(res.status).toBe(307);
			expect(res.headers.get("location")).toBe("/delete");
		});

		it("should redirect to specified URL from form data", async () => {
			const formData = new FormData();
			formData.append("url", "/delete");
			formData.append("status_code", "301");

			const res = await redirects.request(
				"/redirect-to",
				{
					method: "DELETE",
					body: formData,
				},
				env,
			);

			expect(res.status).toBe(301);
			expect(res.headers.get("location")).toBe("/delete");
		});
	});

	describe("PATCH /redirect-to", () => {
		it("should redirect to specified URL from query parameter", async () => {
			const res = await redirects.request(
				"/redirect-to?url=/patch&status_code=307",
				{
					method: "PATCH",
				},
				env,
			);

			expect(res.status).toBe(307);
			expect(res.headers.get("location")).toBe("/patch");
		});

		it("should redirect to specified URL from form data", async () => {
			const formData = new FormData();
			formData.append("url", "/patch");
			formData.append("status_code", "301");

			const res = await redirects.request(
				"/redirect-to",
				{
					method: "PATCH",
					body: formData,
				},
				env,
			);

			expect(res.status).toBe(301);
			expect(res.headers.get("location")).toBe("/patch");
		});
	});

	describe("TRACE /redirect-to", () => {
		it("should redirect to specified URL from query parameter", async () => {
			const res = await redirects.request(
				"/redirect-to?url=/get&status_code=307",
				{
					method: "TRACE",
				},
				env,
			);

			expect(res.status).toBe(307);
			expect(res.headers.get("location")).toBe("/get");
		});

		it("should redirect to specified URL from form data", async () => {
			const formData = new FormData();
			formData.append("url", "/get");
			formData.append("status_code", "301");

			const res = await redirects.request(
				"/redirect-to",
				{
					method: "TRACE",
					body: formData,
				},
				env,
			);

			expect(res.status).toBe(301);
			expect(res.headers.get("location")).toBe("/get");
		});
	});
});
