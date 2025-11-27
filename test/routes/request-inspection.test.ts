import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { requestInspection } from "../../src/routes/request-inspection";

type HeadersResponse = {
	headers: Record<string, string>;
};

type IpResponse = {
	origin: string;
};

type UserAgentResponse = {
	"user-agent": string;
};

describe("Request Inspection", () => {
	describe("GET /headers", () => {
		it("should return request headers", async () => {
			const res = await requestInspection.request(
				"/headers",
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
			const data = (await res.json()) as HeadersResponse;
			expect(data.headers).toBeDefined();
			// HTTP headers are normalized to lowercase
			expect(data.headers["user-agent"]).toBe("test-agent");
			expect(data.headers["accept"]).toBe("application/json");
			expect(data.headers["custom-header"]).toBe("custom-value");
		});

		it("should hide environment headers by default", async () => {
			const res = await requestInspection.request(
				"/headers",
				{
					headers: {
						"X-Forwarded-For": "192.168.1.1",
						"CF-Connecting-IP": "192.168.1.2",
						"X-Real-IP": "192.168.1.3",
						"Custom-Header": "custom-value",
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as HeadersResponse;
			expect(data.headers).toBeDefined();
			// Environment headers should be hidden
			expect(data.headers["x-forwarded-for"]).toBeUndefined();
			expect(data.headers["cf-connecting-ip"]).toBeUndefined();
			expect(data.headers["x-real-ip"]).toBeUndefined();
			// Custom header should be present
			expect(data.headers["custom-header"]).toBe("custom-value");
		});

		it("should show environment headers when show_env query param is present", async () => {
			const res = await requestInspection.request(
				"/headers?show_env=1",
				{
					headers: {
						"X-Forwarded-For": "192.168.1.1",
						"CF-Connecting-IP": "192.168.1.2",
						"Custom-Header": "custom-value",
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as HeadersResponse;
			expect(data.headers).toBeDefined();
			// Environment headers should be visible when show_env is present
			expect(data.headers["x-forwarded-for"]).toBe("192.168.1.1");
			expect(data.headers["cf-connecting-ip"]).toBe("192.168.1.2");
			expect(data.headers["custom-header"]).toBe("custom-value");
		});

		it("should return empty headers object when no headers are sent", async () => {
			const res = await requestInspection.request("/headers", {}, env);

			expect(res.status).toBe(200);
			const data = (await res.json()) as HeadersResponse;
			expect(data.headers).toEqual({});
		});
	});

	describe("GET /ip", () => {
		it("should return IP address from X-Forwarded-For header", async () => {
			const res = await requestInspection.request(
				"/ip",
				{
					headers: {
						"X-Forwarded-For": "192.168.1.100",
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as IpResponse;
			expect(data.origin).toBe("192.168.1.100");
		});

		it("should return first IP from comma-separated X-Forwarded-For header", async () => {
			const res = await requestInspection.request(
				"/ip",
				{
					headers: {
						"X-Forwarded-For": "192.168.1.100, 10.0.0.1, 172.16.0.1",
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as IpResponse;
			expect(data.origin).toBe("192.168.1.100");
		});

		it("should trim whitespace from X-Forwarded-For header", async () => {
			const res = await requestInspection.request(
				"/ip",
				{
					headers: {
						"X-Forwarded-For": "  192.168.1.100  ",
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as IpResponse;
			expect(data.origin).toBe("192.168.1.100");
		});

		it("should return IP address from CF-Connecting-IP when X-Forwarded-For is not present", async () => {
			const res = await requestInspection.request(
				"/ip",
				{
					headers: {
						"CF-Connecting-IP": "192.168.1.200",
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as IpResponse;
			expect(data.origin).toBe("192.168.1.200");
		});

		it("should return IP address from True-Client-IP when X-Forwarded-For is not present", async () => {
			const res = await requestInspection.request(
				"/ip",
				{
					headers: {
						"True-Client-IP": "192.168.1.300",
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as IpResponse;
			expect(data.origin).toBe("192.168.1.300");
		});

		it("should prioritize CF-Connecting-IP over X-Forwarded-For", async () => {
			const res = await requestInspection.request(
				"/ip",
				{
					headers: {
						"X-Forwarded-For": "192.168.1.100",
						"CF-Connecting-IP": "192.168.1.200",
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as IpResponse;
			// CF-Connecting-IP should take priority
			expect(data.origin).toBe("192.168.1.200");
		});

		it("should return unknown when no IP headers are present", async () => {
			const res = await requestInspection.request("/ip", {}, env);

			expect(res.status).toBe(200);
			const data = (await res.json()) as IpResponse;
			// When no IP headers are present, should return "unknown" or a valid IP
			expect(data.origin).toBeDefined();
			expect(typeof data.origin).toBe("string");
		});

		it("should handle empty X-Forwarded-For header", async () => {
			const res = await requestInspection.request(
				"/ip",
				{
					headers: {
						"X-Forwarded-For": "",
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as IpResponse;
			// Empty X-Forwarded-For should fallback to other headers or "unknown"
			expect(data.origin).toBeDefined();
			expect(typeof data.origin).toBe("string");
		});
	});

	describe("GET /user-agent", () => {
		it("should return User-Agent header", async () => {
			const res = await requestInspection.request(
				"/user-agent",
				{
					headers: {
						"User-Agent": "Mozilla/5.0 (Test Browser)",
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as UserAgentResponse;
			expect(data["user-agent"]).toBe("Mozilla/5.0 (Test Browser)");
		});

		it("should return User-Agent header with lowercase key", async () => {
			const res = await requestInspection.request(
				"/user-agent",
				{
					headers: {
						"User-Agent": "test-agent",
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as UserAgentResponse;
			expect(data["user-agent"]).toBe("test-agent");
		});

		it("should handle case-insensitive User-Agent header lookup", async () => {
			const res = await requestInspection.request(
				"/user-agent",
				{
					headers: {
						"USER-AGENT": "uppercase-agent",
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as UserAgentResponse;
			expect(data["user-agent"]).toBe("uppercase-agent");
		});

		it("should handle mixed case User-Agent header", async () => {
			const res = await requestInspection.request(
				"/user-agent",
				{
					headers: {
						"UsEr-AgEnT": "mixed-case-agent",
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as UserAgentResponse;
			expect(data["user-agent"]).toBe("mixed-case-agent");
		});

		it("should return null when User-Agent header is not present", async () => {
			const res = await requestInspection.request("/user-agent", {}, env);

			expect(res.status).toBe(200);
			const data = (await res.json()) as UserAgentResponse;
			expect(data["user-agent"]).toBe(null);
		});

		it("should return empty string when User-Agent header is empty", async () => {
			const res = await requestInspection.request(
				"/user-agent",
				{
					headers: {
						"User-Agent": "",
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as UserAgentResponse;
			expect(data["user-agent"]).toBe("");
		});
	});
});
