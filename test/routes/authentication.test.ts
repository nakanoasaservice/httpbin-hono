import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { authentication } from "../../src/routes/authentication";

async function hexDigest(algorithm: string, data: string): Promise<string> {
	const hash = await crypto.subtle.digest(
		algorithm,
		new TextEncoder().encode(data),
	);
	return Array.from(new Uint8Array(hash), (b) =>
		b.toString(16).padStart(2, "0"),
	).join("");
}

// Helper function to create Digest auth header (similar to _make_digest_auth_header in test_httpbin.py)
async function makeDigestAuthHeader(
	username: string,
	password: string,
	method: string,
	uri: string,
	nonce: string,
	realm: string | null = null,
	algorithm: string | null = null,
	qop: string | null = null,
	cnonce: string | null = null,
	nc: string | null = null,
	body = "",
): Promise<string> {
	const alg = algorithm ?? "MD5";
	const ha1 = await hexDigest(alg, `${username}:${realm || ""}:${password}`);
	const a2 =
		qop === "auth-int"
			? `${method}:${uri}:${await hexDigest(alg, body)}`
			: `${method}:${uri}`;
	const ha2 = await hexDigest(alg, a2);
	const a3 =
		qop && cnonce && nc
			? `${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`
			: `${ha1}:${nonce}:${ha2}`;
	const authResponse = await hexDigest(alg, a3);

	// Build auth header
	let authHeader = `Digest username="${username}", response="${authResponse}", uri="${uri}", nonce="${nonce}"`;

	if (realm !== null) {
		authHeader += `, realm="${realm}"`;
	}
	if (algorithm) {
		authHeader += `, algorithm="${algorithm}"`;
	}
	if (cnonce) {
		authHeader += `, cnonce="${cnonce}"`;
	}
	if (nc) {
		authHeader += `, nc=${nc}`;
	}
	if (qop) {
		authHeader += `, qop=${qop}`;
	}

	return authHeader;
}

// Helper function to parse WWW-Authenticate header
function parseWWWAuthenticate(wwwAuth: string): Record<string, string> {
	const params: Record<string, string> = {};
	const regex = /(\w+)=(?:"([^"]*)"|([^,]*))/g;
	let match: RegExpExecArray | null = regex.exec(wwwAuth);
	while (match !== null) {
		const key = match[1];
		if (key) {
			const value = match[2] || match[3] || "";
			params[key] = value;
		}
		match = regex.exec(wwwAuth);
	}
	return params;
}

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
		it("should return 401 (not 500) with malformed base64 credentials", async () => {
			const res = await authentication.request(
				"/basic-auth/foo/bar",
				{ headers: { Authorization: "Basic !!!" } },
				env,
			);

			expect(res.status).toBe(401);
		});

		it("should accept a password containing a colon", async () => {
			const res = await authentication.request(
				"/basic-auth/foo/b:a:r",
				{ headers: { Authorization: `Basic ${btoa("foo:b:a:r")}` } },
				env,
			);

			expect(res.status).toBe(200);
		});

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

	describe("GET /digest-auth/:qop/:user/:passwd", () => {
		it("should accept a real MD5 digest response (as sent by curl --digest)", async () => {
			// Expected value computed independently with Python's hashlib.md5
			const res = await authentication.request(
				"/digest-auth/auth/foo/bar",
				{
					headers: {
						Authorization:
							'Digest username="foo", realm="Fake Realm", nonce="abc123", uri="/digest-auth/auth/foo/bar", qop=auth, nc=00000001, cnonce="0a4f113b", response="36df33a40d487ac5020fcd920d80d011"',
					},
				},
				env,
			);

			expect(res.status).toBe(200);
		});

		it("should return 401 without authorization header", async () => {
			const res = await authentication.request(
				"/digest-auth/auth/foo/bar",
				{},
				env,
			);

			expect(res.status).toBe(401);
			const wwwAuth = res.headers.get("www-authenticate");
			expect(wwwAuth).toContain('Digest realm="Fake Realm"');
			expect(wwwAuth).toContain("nonce=");
			expect(wwwAuth).toContain('qop="auth"');
		});

		it("should return 401 with invalid qop", async () => {
			const res = await authentication.request(
				"/digest-auth/invalid/foo/bar",
				{},
				env,
			);

			expect(res.status).toBe(400);
		});

		it("should return 401 with non-Digest authorization header", async () => {
			const res = await authentication.request(
				"/digest-auth/auth/foo/bar",
				{
					headers: {
						Authorization: "Basic dXNlcjpwYXNz",
					},
				},
				env,
			);

			expect(res.status).toBe(401);
			const wwwAuth = res.headers.get("www-authenticate");
			expect(wwwAuth).toContain('Digest realm="Fake Realm"');
		});

		it("should return 401 with invalid Digest authorization header", async () => {
			const res = await authentication.request(
				"/digest-auth/auth/foo/bar",
				{
					headers: {
						Authorization: "Digest invalid",
					},
				},
				env,
			);

			expect(res.status).toBe(401);
		});

		it("should return 200 with correct Digest auth credentials", async () => {
			// First request to get challenge
			const challengeRes = await authentication.request(
				"/digest-auth/auth/foo/bar",
				{},
				env,
			);

			expect(challengeRes.status).toBe(401);
			const wwwAuth = challengeRes.headers.get("www-authenticate");
			expect(wwwAuth).toBeTruthy();

			const params = parseWWWAuthenticate(wwwAuth || "");
			const nonce = params["nonce"];
			const realm = params["realm"] || "Fake Realm";
			expect(nonce).toBeTruthy();
			if (!nonce) {
				throw new Error("nonce is missing");
			}

			// Generate client nonce
			const randomBytes = new Uint8Array(8);
			crypto.getRandomValues(randomBytes);
			const cnonce = btoa(String.fromCharCode(...randomBytes))
				.replace(/\+/g, "-")
				.replace(/\//g, "_")
				.replace(/=/g, "");

			// Create Digest auth header
			const uri = "/digest-auth/auth/foo/bar";
			const authHeader = await makeDigestAuthHeader(
				"foo",
				"bar",
				"GET",
				uri,
				nonce,
				realm,
				null, // algorithm (MD5 default)
				"auth",
				cnonce,
				"00000001",
			);

			// Second request with auth header
			const res = await authentication.request(
				"/digest-auth/auth/foo/bar",
				{
					headers: {
						Authorization: authHeader,
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as {
				authenticated: boolean;
				user: string;
			};
			expect(data.authenticated).toBe(true);
			expect(data.user).toBe("foo");
		});

		it("should return 401 with wrong password", async () => {
			// First request to get challenge
			const challengeRes = await authentication.request(
				"/digest-auth/auth/foo/bar",
				{},
				env,
			);

			expect(challengeRes.status).toBe(401);
			const wwwAuth = challengeRes.headers.get("www-authenticate");
			expect(wwwAuth).toBeTruthy();

			const params = parseWWWAuthenticate(wwwAuth || "");
			const nonce = params["nonce"];
			const realm = params["realm"] || "Fake Realm";
			expect(nonce).toBeTruthy();
			if (!nonce) {
				throw new Error("nonce is missing");
			}

			// Generate client nonce
			const randomBytes = new Uint8Array(8);
			crypto.getRandomValues(randomBytes);
			const cnonce = btoa(String.fromCharCode(...randomBytes))
				.replace(/\+/g, "-")
				.replace(/\//g, "_")
				.replace(/=/g, "");

			// Create Digest auth header with wrong password
			const uri = "/digest-auth/auth/foo/bar";
			const authHeader = await makeDigestAuthHeader(
				"foo",
				"wrongpassword",
				"GET",
				uri,
				nonce,
				realm,
				null,
				"auth",
				cnonce,
				"00000001",
			);

			// Second request with auth header
			const res = await authentication.request(
				"/digest-auth/auth/foo/bar",
				{
					headers: {
						Authorization: authHeader,
					},
				},
				env,
			);

			expect(res.status).toBe(401);
		});
	});

	describe("GET /digest-auth/:qop/:user/:passwd/:algorithm", () => {
		it("should return 401 without authorization header", async () => {
			const res = await authentication.request(
				"/digest-auth/auth/foo/bar/MD5",
				{},
				env,
			);

			expect(res.status).toBe(401);
			const wwwAuth = res.headers.get("www-authenticate");
			expect(wwwAuth).toContain('Digest realm="Fake Realm"');
			expect(wwwAuth).toContain("nonce=");
			expect(wwwAuth).toContain('qop="auth"');
			expect(wwwAuth).toContain("algorithm=MD5");
		});

		it("should return 400 with invalid algorithm", async () => {
			const res = await authentication.request(
				"/digest-auth/auth/foo/bar/INVALID",
				{},
				env,
			);

			expect(res.status).toBe(400);
		});

		it("should support SHA-256 algorithm", async () => {
			const res = await authentication.request(
				"/digest-auth/auth/foo/bar/SHA-256",
				{},
				env,
			);

			expect(res.status).toBe(401);
			const wwwAuth = res.headers.get("www-authenticate");
			expect(wwwAuth).toContain("algorithm=SHA-256");
		});

		it("should support SHA-512 algorithm", async () => {
			const res = await authentication.request(
				"/digest-auth/auth/foo/bar/SHA-512",
				{},
				env,
			);

			expect(res.status).toBe(401);
			const wwwAuth = res.headers.get("www-authenticate");
			expect(wwwAuth).toContain("algorithm=SHA-512");
		});

		it("should return 200 with correct SHA-256 Digest auth", async () => {
			// First request to get challenge
			const challengeRes = await authentication.request(
				"/digest-auth/auth/foo/bar/SHA-256",
				{},
				env,
			);

			expect(challengeRes.status).toBe(401);
			const wwwAuth = challengeRes.headers.get("www-authenticate");
			expect(wwwAuth).toBeTruthy();

			const params = parseWWWAuthenticate(wwwAuth || "");
			const nonce = params["nonce"];
			const realm = params["realm"] || "Fake Realm";
			expect(nonce).toBeTruthy();
			if (!nonce) {
				throw new Error("nonce is missing");
			}

			// Generate client nonce
			const randomBytes = new Uint8Array(8);
			crypto.getRandomValues(randomBytes);
			const cnonce = btoa(String.fromCharCode(...randomBytes))
				.replace(/\+/g, "-")
				.replace(/\//g, "_")
				.replace(/=/g, "");

			// Create Digest auth header with SHA-256
			const uri = "/digest-auth/auth/foo/bar/SHA-256";
			const authHeader = await makeDigestAuthHeader(
				"foo",
				"bar",
				"GET",
				uri,
				nonce,
				realm,
				"SHA-256",
				"auth",
				cnonce,
				"00000001",
			);

			// Second request with auth header
			const res = await authentication.request(
				"/digest-auth/auth/foo/bar/SHA-256",
				{
					headers: {
						Authorization: authHeader,
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as {
				authenticated: boolean;
				user: string;
			};
			expect(data.authenticated).toBe(true);
			expect(data.user).toBe("foo");
		});
	});

	describe("GET /digest-auth/:qop/:user/:passwd/:algorithm/:stale_after", () => {
		it("should return 401 without authorization header", async () => {
			const res = await authentication.request(
				"/digest-auth/auth/foo/bar/MD5/never",
				{},
				env,
			);

			expect(res.status).toBe(401);
			const wwwAuth = res.headers.get("www-authenticate");
			expect(wwwAuth).toContain('Digest realm="Fake Realm"');
			expect(wwwAuth).toContain("nonce=");
			expect(wwwAuth).toContain('qop="auth"');
			expect(wwwAuth).toContain("algorithm=MD5");
		});

		it("should return stale=true when stale_after is 0", async () => {
			const res = await authentication.request(
				"/digest-auth/auth/foo/bar/MD5/0",
				{},
				env,
			);

			expect(res.status).toBe(401);
			const wwwAuth = res.headers.get("www-authenticate");
			expect(wwwAuth).toContain("stale=true");
		});

		it("should not return stale when stale_after is never", async () => {
			const res = await authentication.request(
				"/digest-auth/auth/foo/bar/MD5/never",
				{},
				env,
			);

			expect(res.status).toBe(401);
			const wwwAuth = res.headers.get("www-authenticate");
			expect(wwwAuth).not.toContain("stale=true");
		});

		it("should support auth-int qop", async () => {
			// First request to get challenge
			const challengeRes = await authentication.request(
				"/digest-auth/auth-int/foo/bar",
				{},
				env,
			);

			expect(challengeRes.status).toBe(401);
			const wwwAuth = challengeRes.headers.get("www-authenticate");
			expect(wwwAuth).toBeTruthy();
			expect(wwwAuth).toContain('qop="auth-int"');

			const params = parseWWWAuthenticate(wwwAuth || "");
			const nonce = params["nonce"];
			const realm = params["realm"] || "Fake Realm";
			expect(nonce).toBeTruthy();
			if (!nonce) {
				throw new Error("nonce is missing");
			}

			// Generate client nonce
			const randomBytes = new Uint8Array(8);
			crypto.getRandomValues(randomBytes);
			const cnonce = btoa(String.fromCharCode(...randomBytes))
				.replace(/\+/g, "-")
				.replace(/\//g, "_")
				.replace(/=/g, "");

			// Create Digest auth header with auth-int
			const uri = "/digest-auth/auth-int/foo/bar";
			const authHeader = await makeDigestAuthHeader(
				"foo",
				"bar",
				"GET",
				uri,
				nonce,
				realm,
				null,
				"auth-int",
				cnonce,
				"00000001",
			);

			// Second request with auth header
			const res = await authentication.request(
				"/digest-auth/auth-int/foo/bar",
				{
					headers: {
						Authorization: authHeader,
					},
				},
				env,
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as {
				authenticated: boolean;
				user: string;
			};
			expect(data.authenticated).toBe(true);
			expect(data.user).toBe("foo");
		});
	});
});
