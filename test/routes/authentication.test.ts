import { env } from "cloudflare:workers";
import { describe, expect, it } from "vite-plus/test";

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

	describe("GET /hidden-basic-auth/:user/:passwd", () => {
		it("should return 200 with correct credentials", async () => {
			const res = await authentication.request(
				"/hidden-basic-auth/foo/bar",
				{ headers: { Authorization: `Basic ${btoa("foo:bar")}` } },
				env,
			);

			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ authenticated: true, user: "foo" });
		});

		it.each([
			["wrong credentials", { Authorization: `Basic ${btoa("foo:nope")}` }],
			["no credentials", {}],
		])("should return 404 without a challenge for %s", async (_, headers) => {
			const res = await authentication.request(
				"/hidden-basic-auth/foo/bar",
				{ headers },
				env,
			);

			expect(res.status).toBe(404);
			expect(res.headers.get("www-authenticate")).toBeNull();
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

		it("should return 400 for an unknown qop", async () => {
			const res = await authentication.request(
				"/digest-auth/invalid/foo/bar",
				{},
				env,
			);

			expect(res.status).toBe(400);
			expect(await res.text()).toBe("Invalid value for qop");
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

		it("should return 400 for an unknown algorithm instead of falling back to MD5", async () => {
			// A typo such as "SHA256" must not silently become MD5
			const res = await authentication.request(
				"/digest-auth/auth/foo/bar/SHA256",
				{},
				env,
			);

			expect(res.status).toBe(400);
			expect(await res.text()).toBe("Invalid value for algorithm");
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

		it("should set the stale_after cookie on the first challenge", async () => {
			const res = await authentication.request(
				"/digest-auth/auth/foo/bar/MD5/0",
				{},
				env,
			);

			expect(res.status).toBe(401);
			expect(res.headers.get("www-authenticate")).not.toMatch(/stale=true/i);
			expect(res.headers.getSetCookie()).toContainEqual(
				expect.stringContaining("stale_after=0"),
			);
		});

		it("should not return stale when stale_after is never", async () => {
			const res = await authentication.request(
				"/digest-auth/auth/foo/bar/MD5/never",
				{},
				env,
			);

			expect(res.status).toBe(401);
			const wwwAuth = res.headers.get("www-authenticate");
			expect(wwwAuth).not.toMatch(/stale=true/i);
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

	describe("Digest auth edge cases", () => {
		const nonce = "fixednonce";

		async function digestRequest(
			path: string,
			options: {
				user?: string;
				password?: string;
				algorithm?: string | null;
				qop?: string | null;
				cnonce?: string | null;
				nc?: string | null;
				cookie?: string;
			} = {},
		) {
			const header = await makeDigestAuthHeader(
				options.user ?? "foo",
				options.password ?? "bar",
				"GET",
				path,
				nonce,
				"Fake Realm",
				options.algorithm ?? null,
				options.qop === undefined ? "auth" : options.qop,
				options.cnonce === undefined ? "0a4f113b" : options.cnonce,
				options.nc === undefined ? "00000001" : options.nc,
			);
			const headers: Record<string, string> = { Authorization: header };
			if (options.cookie) {
				headers["Cookie"] = options.cookie;
			}
			return authentication.request(path, { headers }, env);
		}

		it("should accept SHA-512", async () => {
			const res = await digestRequest("/digest-auth/auth/foo/bar/SHA-512", {
				algorithm: "SHA-512",
			});

			expect(res.status).toBe(200);
		});

		it("should accept MD5 when named explicitly", async () => {
			const res = await digestRequest("/digest-auth/auth/foo/bar/MD5", {
				algorithm: "MD5",
			});

			expect(res.status).toBe(200);
		});

		it("should reject a response hashed with a different algorithm", async () => {
			const res = await digestRequest("/digest-auth/auth/foo/bar/SHA-256", {
				algorithm: "MD5",
			});

			expect(res.status).toBe(401);
		});

		it("should accept RFC 2069 requests without qop", async () => {
			const res = await digestRequest("/digest-auth/auth/foo/bar", {
				qop: null,
				cnonce: null,
				nc: null,
			});

			expect(res.status).toBe(200);
		});

		it("should reject qop=auth without nc and cnonce", async () => {
			const res = await digestRequest("/digest-auth/auth/foo/bar", {
				cnonce: null,
				nc: null,
			});

			expect(res.status).toBe(401);
		});

		it("should reject a wrong username", async () => {
			const res = await digestRequest("/digest-auth/auth/foo/bar", {
				user: "other",
			});

			expect(res.status).toBe(401);
		});

		it("should accept valid credentials on the stale_after route", async () => {
			const res = await digestRequest("/digest-auth/auth/foo/bar/MD5/never", {
				algorithm: "MD5",
			});

			expect(res.status).toBe(200);
		});

		it("should advertise MD5 in the challenge of the short route", async () => {
			const res = await authentication.request(
				"/digest-auth/auth/foo/bar",
				{},
				env,
			);

			expect(res.headers.get("www-authenticate")).toContain("algorithm=MD5");
		});

		it("should report a stale nonce once stale_after reaches 0", async () => {
			const path = "/digest-auth/auth/foo/bar/MD5/1";

			// stale_after=1: one successful login, which counts the cookie down to 0
			const first = await digestRequest(path, {
				algorithm: "MD5",
				cookie: "stale_after=1",
			});
			expect(first.status).toBe(200);
			expect(first.headers.getSetCookie()).toContainEqual(
				expect.stringContaining("stale_after=0"),
			);

			// stale_after=0: valid credentials, but the nonce is now stale
			const second = await digestRequest(path, {
				algorithm: "MD5",
				cookie: "stale_after=0",
			});
			expect(second.status).toBe(401);
			expect(second.headers.get("www-authenticate")).toContain("stale=TRUE");
		});

		it("should report a reused nonce as stale", async () => {
			const res = await digestRequest("/digest-auth/auth/foo/bar", {
				cookie: `last_nonce=${nonce}`,
			});

			expect(res.status).toBe(401);
			expect(res.headers.get("www-authenticate")).toContain("stale=TRUE");
		});

		it("should remember the nonce of a failed attempt", async () => {
			const res = await digestRequest("/digest-auth/auth/foo/bar", {
				password: "wrong",
			});

			expect(res.status).toBe(401);
			expect(res.headers.getSetCookie()).toContainEqual(
				expect.stringContaining(`last_nonce=${nonce}`),
			);
		});

		describe("?require-cookie=true", () => {
			const path = "/digest-auth/auth/foo/bar?require-cookie=true";

			it("should challenge when no cookies are sent", async () => {
				const res = await digestRequest(path);

				expect(res.status).toBe(401);
				expect(res.headers.getSetCookie()).toContainEqual(
					expect.stringContaining("fake=fake_value"),
				);
			});

			it("should return 403 when the challenge cookie is missing", async () => {
				const res = await digestRequest(path, { cookie: "other=1" });

				expect(res.status).toBe(403);
				expect(await res.json()).toEqual({
					errors: ["missing cookie set on challenge"],
				});
			});

			it("should authenticate with the challenge cookie", async () => {
				const res = await digestRequest(path, { cookie: "fake=fake_value" });

				expect(res.status).toBe(200);
			});
		});
	});
});
