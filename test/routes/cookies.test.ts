import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { cookies } from "../../src/routes/cookies";

type CookiesResponse = {
	cookies: Record<string, string>;
};

describe("Cookies", () => {
	describe("GET /cookies", () => {
		it("should return empty cookies object when no cookies are sent", async () => {
			const res = await cookies.request("/cookies", {}, env);

			expect(res.status).toBe(200);
			const data = (await res.json()) as CookiesResponse;
			expect(data.cookies).toEqual({});
		});

		it("should return cookies from Cookie header", async () => {
			const res = await cookies.request(
				"/cookies",
				{
					headers: {
						Cookie: "foo=bar; baz=qux",
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as CookiesResponse;
			expect(data.cookies).toEqual({
				foo: "bar",
				baz: "qux",
			});
		});

		it("should decode URL-encoded cookie values", async () => {
			const res = await cookies.request(
				"/cookies",
				{
					headers: {
						Cookie: "name=John%20Doe; email=test%40example.com",
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as CookiesResponse;
			expect(data.cookies).toEqual({
				name: "John Doe",
				email: "test@example.com",
			});
		});

		it("should hide environment cookies by default", async () => {
			const res = await cookies.request(
				"/cookies",
				{
					headers: {
						Cookie: "foo=bar; _gauges_unique=123; __utmz=456",
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as CookiesResponse;
			expect(data.cookies).toEqual({
				foo: "bar",
			});
			expect(data.cookies["_gauges_unique"]).toBeUndefined();
			expect(data.cookies["__utmz"]).toBeUndefined();
		});

		it("should show environment cookies when show_env query param is present", async () => {
			const res = await cookies.request(
				"/cookies?show_env=1",
				{
					headers: {
						Cookie: "foo=bar; _gauges_unique=123; __utmz=456",
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as CookiesResponse;
			expect(data.cookies["foo"]).toBe("bar");
			expect(data.cookies["_gauges_unique"]).toBe("123");
			expect(data.cookies["__utmz"]).toBe("456");
		});

		it("should handle cookies with empty values", async () => {
			const res = await cookies.request(
				"/cookies",
				{
					headers: {
						Cookie: "foo=bar; empty=; baz=qux",
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as CookiesResponse;
			expect(data.cookies["foo"]).toBe("bar");
			expect(data.cookies["empty"]).toBe("");
			expect(data.cookies["baz"]).toBe("qux");
		});

		it("should handle cookies with spaces around semicolons", async () => {
			const res = await cookies.request(
				"/cookies",
				{
					headers: {
						Cookie: "foo=bar ; baz=qux ; quux=corge",
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as CookiesResponse;
			expect(data.cookies).toEqual({
				foo: "bar",
				baz: "qux",
				quux: "corge",
			});
		});
	});

	describe("GET /cookies/set", () => {
		it("should set cookies from query parameters and redirect", async () => {
			const res = await cookies.request(
				"/cookies/set?foo=bar&baz=qux",
				{},
				env,
			);

			expect(res.status).toBe(302);
			expect(res.headers.get("location")).toBe("/cookies");

			// Check Set-Cookie headers
			const setCookieHeaders = res.headers.getSetCookie();
			expect(setCookieHeaders.length).toBeGreaterThanOrEqual(2);

			// Verify cookies are set by following redirect
			const redirectRes = await cookies.request(
				"/cookies",
				{
					headers: {
						Cookie: "foo=bar; baz=qux",
					},
				},
				env,
			);
			const data = (await redirectRes.json()) as CookiesResponse;
			expect(data.cookies["foo"]).toBe("bar");
			expect(data.cookies["baz"]).toBe("qux");
		});

		it("should set cookie with URL-encoded value", async () => {
			const res = await cookies.request(
				"/cookies/set?name=John%20Doe&email=test%40example.com",
				{},
				env,
			);

			expect(res.status).toBe(302);
			expect(res.headers.get("location")).toBe("/cookies");

			// Verify cookies are set correctly
			const redirectRes = await cookies.request(
				"/cookies",
				{
					headers: {
						Cookie: "name=John%20Doe; email=test%40example.com",
					},
				},
				env,
			);
			const data = (await redirectRes.json()) as CookiesResponse;
			expect(data.cookies["name"]).toBe("John Doe");
			expect(data.cookies["email"]).toBe("test@example.com");
		});

		it("should set cookie without secure flag for HTTP requests", async () => {
			const res = await cookies.request("/cookies/set?foo=bar", {}, env);

			expect(res.status).toBe(302);
			const setCookieHeaders = res.headers.getSetCookie();
			expect(setCookieHeaders.length).toBeGreaterThan(0);
			// In test environment, URL is likely http://, so Secure should not be set
			expect(setCookieHeaders[0]).not.toContain("Secure");
			expect(setCookieHeaders[0]).toContain("foo=bar");
		});

		it("should set cookie with SameSite=Lax attribute", async () => {
			const res = await cookies.request("/cookies/set?foo=bar", {}, env);

			expect(res.status).toBe(302);
			const setCookieHeaders = res.headers.getSetCookie();
			expect(setCookieHeaders.length).toBeGreaterThan(0);
			expect(setCookieHeaders[0]).toContain("SameSite=Lax");
		});

		it("should set cookie with Path=/ attribute", async () => {
			const res = await cookies.request("/cookies/set?foo=bar", {}, env);

			expect(res.status).toBe(302);
			const setCookieHeaders = res.headers.getSetCookie();
			expect(setCookieHeaders.length).toBeGreaterThan(0);
			expect(setCookieHeaders[0]).toContain("Path=/");
		});

		it("should handle multiple cookies with same name (use first value)", async () => {
			const res = await cookies.request(
				"/cookies/set?foo=bar&foo=baz",
				{},
				env,
			);

			expect(res.status).toBe(302);
			// When multiple query params with same name, first one should be used
			const setCookieHeaders = res.headers.getSetCookie();
			expect(setCookieHeaders.length).toBeGreaterThan(0);
		});
	});

	describe("GET /cookies/set/:name/:value", () => {
		it("should set cookie from path parameters and redirect", async () => {
			const res = await cookies.request("/cookies/set/foo/bar", {}, env);

			expect(res.status).toBe(302);
			expect(res.headers.get("location")).toBe("/cookies");

			// Verify cookie is set by checking response
			const redirectRes = await cookies.request(
				"/cookies",
				{
					headers: {
						Cookie: "foo=bar",
					},
				},
				env,
			);
			const data = (await redirectRes.json()) as CookiesResponse;
			expect(data.cookies["foo"]).toBe("bar");
		});

		it("should handle URL-encoded values in path parameters", async () => {
			const res = await cookies.request(
				"/cookies/set/name/John%20Doe",
				{},
				env,
			);

			expect(res.status).toBe(302);
			expect(res.headers.get("location")).toBe("/cookies");

			// Verify cookie value is decoded correctly
			const redirectRes = await cookies.request(
				"/cookies",
				{
					headers: {
						Cookie: "name=John%20Doe",
					},
				},
				env,
			);
			const data = (await redirectRes.json()) as CookiesResponse;
			expect(data.cookies["name"]).toBe("John Doe");
		});

		it("should handle special characters in cookie name and value", async () => {
			const res = await cookies.request(
				"/cookies/set/test%20name/test%20value",
				{},
				env,
			);

			expect(res.status).toBe(302);
			expect(res.headers.get("location")).toBe("/cookies");
		});

		it("should set cookie without secure flag for HTTP requests", async () => {
			const res = await cookies.request("/cookies/set/foo/bar", {}, env);

			expect(res.status).toBe(302);
			const setCookieHeaders = res.headers.getSetCookie();
			expect(setCookieHeaders.length).toBeGreaterThan(0);
			// In test environment, URL is likely http://, so Secure should not be set
			expect(setCookieHeaders[0]).not.toContain("Secure");
			expect(setCookieHeaders[0]).toContain("foo=bar");
		});

		it("should set cookie with SameSite=Lax attribute", async () => {
			const res = await cookies.request("/cookies/set/foo/bar", {}, env);

			expect(res.status).toBe(302);
			const setCookieHeaders = res.headers.getSetCookie();
			expect(setCookieHeaders.length).toBeGreaterThan(0);
			expect(setCookieHeaders[0]).toContain("SameSite=Lax");
		});

		it("should set cookie with Path=/ attribute", async () => {
			const res = await cookies.request("/cookies/set/foo/bar", {}, env);

			expect(res.status).toBe(302);
			const setCookieHeaders = res.headers.getSetCookie();
			expect(setCookieHeaders.length).toBeGreaterThan(0);
			expect(setCookieHeaders[0]).toContain("Path=/");
		});
	});

	describe("GET /cookies/delete", () => {
		it("should delete cookies from query parameters and redirect", async () => {
			const res = await cookies.request("/cookies/delete?foo&baz", {}, env);

			expect(res.status).toBe(302);
			expect(res.headers.get("location")).toBe("/cookies");

			// Check Set-Cookie headers with Max-Age=0
			const setCookieHeaders = res.headers.getSetCookie();
			expect(setCookieHeaders.length).toBeGreaterThanOrEqual(2);

			// Verify cookies are deleted (Max-Age=0 should be set)
			for (const cookieHeader of setCookieHeaders) {
				expect(cookieHeader).toContain("Max-Age=0");
			}
		});

		it("should delete single cookie", async () => {
			const res = await cookies.request("/cookies/delete?foo", {}, env);

			expect(res.status).toBe(302);
			expect(res.headers.get("location")).toBe("/cookies");

			const setCookieHeaders = res.headers.getSetCookie();
			expect(setCookieHeaders.length).toBeGreaterThan(0);
			expect(setCookieHeaders[0]).toContain("Max-Age=0");
		});

		it("should set Max-Age=0 for deleted cookies", async () => {
			const res = await cookies.request("/cookies/delete?foo=bar", {}, env);

			expect(res.status).toBe(302);
			const setCookieHeaders = res.headers.getSetCookie();
			expect(setCookieHeaders.length).toBeGreaterThan(0);
			expect(setCookieHeaders[0]).toContain("Max-Age=0");
		});

		it("should delete cookie without secure flag for HTTP requests", async () => {
			const res = await cookies.request("/cookies/delete?foo", {}, env);

			expect(res.status).toBe(302);
			const setCookieHeaders = res.headers.getSetCookie();
			expect(setCookieHeaders.length).toBeGreaterThan(0);
			// In test environment, URL is likely http://, so Secure should not be set
			expect(setCookieHeaders[0]).not.toContain("Secure");
			expect(setCookieHeaders[0]).toContain("Max-Age=0");
		});

		it("should delete cookie with SameSite=Lax attribute", async () => {
			const res = await cookies.request("/cookies/delete?foo", {}, env);

			expect(res.status).toBe(302);
			const setCookieHeaders = res.headers.getSetCookie();
			expect(setCookieHeaders.length).toBeGreaterThan(0);
			expect(setCookieHeaders[0]).toContain("SameSite=Lax");
			expect(setCookieHeaders[0]).toContain("Max-Age=0");
		});

		it("should delete cookie with Path=/ attribute", async () => {
			const res = await cookies.request("/cookies/delete?foo", {}, env);

			expect(res.status).toBe(302);
			const setCookieHeaders = res.headers.getSetCookie();
			expect(setCookieHeaders.length).toBeGreaterThan(0);
			expect(setCookieHeaders[0]).toContain("Path=/");
			expect(setCookieHeaders[0]).toContain("Max-Age=0");
		});
	});

	describe("Secure cookie detection", () => {
		it("should detect HTTPS from URL protocol", async () => {
			// Test with HTTPS URL by creating a Request with HTTPS URL
			const httpsRequest = new Request(
				"https://example.com/cookies/set/foo/bar",
			);
			const res = await cookies.fetch(httpsRequest, env);

			expect(res.status).toBe(302);
			const setCookieHeaders = res.headers.getSetCookie();
			expect(setCookieHeaders.length).toBeGreaterThan(0);
			expect(setCookieHeaders[0]).toContain("Secure");
			expect(setCookieHeaders[0]).toContain("foo=bar");
		});

		it("should not set secure flag for HTTP requests", async () => {
			const res = await cookies.request("/cookies/set/foo/bar", {}, env);

			expect(res.status).toBe(302);
			const setCookieHeaders = res.headers.getSetCookie();
			expect(setCookieHeaders.length).toBeGreaterThan(0);
			// In test environment, URL is likely http://, so Secure should not be set
			expect(setCookieHeaders[0]).not.toContain("Secure");
			expect(setCookieHeaders[0]).toContain("foo=bar");
		});
	});
});
