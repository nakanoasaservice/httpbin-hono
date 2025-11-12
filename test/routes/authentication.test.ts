import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { authentication } from "../../src/routes/authentication";

type BasicAuthResponse = {
	authenticated: boolean;
	user: string;
};

type BearerAuthResponse = {
	authenticated: boolean;
	token: string;
};

describe("Authentication", () => {
	describe("GET /basic-auth/:user/:passwd", () => {
		it("should return 401 without authorization header", async () => {
			const res = await authentication.request("/basic-auth/foo/bar", {}, env);

			expect(res.status).toBe(401);
			expect(res.headers.get("www-authenticate")).toBe(
				'Basic realm="Fake Realm"',
			);
		});

		it("should return 401 with wrong credentials", async () => {
			const credentials = btoa("wrong:password");
			const res = await authentication.request(
				"/basic-auth/foo/bar",
				{
					headers: {
						Authorization: `Basic ${credentials}`,
					},
				},
				env,
			);

			expect(res.status).toBe(401);
			expect(res.headers.get("www-authenticate")).toBe(
				'Basic realm="Fake Realm"',
			);
		});

		it("should return 200 with correct credentials", async () => {
			const credentials = btoa("foo:bar");
			const res = await authentication.request(
				"/basic-auth/foo/bar",
				{
					headers: {
						Authorization: `Basic ${credentials}`,
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as BasicAuthResponse;
			expect(data.authenticated).toBe(true);
			expect(data.user).toBe("foo");
		});

		it("should return 401 with non-Basic authorization header", async () => {
			const res = await authentication.request(
				"/basic-auth/foo/bar",
				{
					headers: {
						Authorization: "Bearer token123",
					},
				},
				env,
			);

			expect(res.status).toBe(401);
			expect(res.headers.get("www-authenticate")).toBe(
				'Basic realm="Fake Realm"',
			);
		});
	});

	describe("GET /bearer", () => {
		it("should return 200 with valid bearer token", async () => {
			const token = "abcd1234";
			const res = await authentication.request(
				"/bearer",
				{
					headers: {
						Authorization: `Bearer ${token}`,
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as BearerAuthResponse;
			expect(data.authenticated).toBe(true);
			expect(data.token).toBe(token);
		});

		it("should return 401 without authorization header", async () => {
			const res = await authentication.request("/bearer", {}, env);

			expect(res.status).toBe(401);
			expect(res.headers.get("www-authenticate")).toBe("Bearer");
		});

		it("should return 401 with non-Bearer authorization header", async () => {
			const authHeaders = [
				{ Authorization: "Basic 1234abcd" },
				{ Authorization: "" },
			];

			for (const headers of authHeaders) {
				const res = await authentication.request("/bearer", { headers }, env);

				expect(res.status).toBe(401);
				expect(res.headers.get("www-authenticate")).toBe("Bearer");
			}
		});

		it("should return 401 with missing token", async () => {
			const res = await authentication.request(
				"/bearer",
				{
					headers: {
						Authorization: "Bearer",
					},
				},
				env,
			);

			expect(res.status).toBe(401);
			expect(res.headers.get("www-authenticate")).toBe("Bearer");
		});
	});
});
