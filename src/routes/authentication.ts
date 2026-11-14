import { Hono } from "hono";

export const authentication = new Hono();

// Helper functions for Digest authentication

/**
 * Parse Digest authorization header
 */
function parseDigestAuth(authHeader: string): Record<string, string> | null {
	if (!authHeader?.startsWith("Digest ")) {
		return null;
	}

	const digestString = authHeader.substring(7);
	const params: Record<string, string> = {};

	// Parse key="value" pairs
	const regex = /(\w+)=(?:"([^"]*)"|([^,]*))/g;
	let match: RegExpExecArray | null = regex.exec(digestString);
	while (match !== null) {
		const key = match[1];
		if (key) {
			const value = match[2] || match[3] || "";
			params[key] = value;
		}
		match = regex.exec(digestString);
	}

	return params;
}

/**
 * Generate nonce for Digest authentication
 */
function generateNonce(): string {
	const randomBytes = new Uint8Array(16);
	crypto.getRandomValues(randomBytes);
	return btoa(String.fromCharCode(...randomBytes))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=/g, "");
}

/**
 * Hex digest of data. Workers' Web Crypto supports MD5 in addition to SHA-*.
 */
async function hexDigest(
	algorithm: string,
	data: string | ArrayBuffer,
): Promise<string> {
	const buffer =
		typeof data === "string" ? new TextEncoder().encode(data) : data;
	const hash = await crypto.subtle.digest(algorithm, buffer);
	return Array.from(new Uint8Array(hash), (b) =>
		b.toString(16).padStart(2, "0"),
	).join("");
}

/**
 * Generate Digest challenge response header
 */
function generateDigestChallenge(
	realm: string,
	qop: string | null,
	algorithm: string | null,
	stale: boolean = false,
): string {
	const nonce = generateNonce();
	let challenge = `Digest realm="${realm}", nonce="${nonce}"`;

	if (qop) {
		challenge += `, qop="${qop}"`;
	}

	if (algorithm) {
		challenge += `, algorithm=${algorithm}`;
	}

	if (stale) {
		challenge += ", stale=true";
	}

	return challenge;
}

/**
 * Check Digest authentication (RFC 2617 / RFC 7616)
 * Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/helpers.py#L300
 */
async function checkDigestAuth(
	authParams: Record<string, string>,
	username: string,
	password: string,
	method: string,
	uri: string,
	body: ArrayBuffer,
	algorithm: string,
): Promise<boolean> {
	const { realm, nonce, nc, cnonce, qop, response } = authParams;
	if (authParams["username"] !== username || !realm || !nonce || !response) {
		return false;
	}

	const HA1 = await hexDigest(algorithm, `${username}:${realm}:${password}`);

	const A2 =
		qop === "auth-int"
			? `${method}:${uri}:${await hexDigest(algorithm, body)}`
			: `${method}:${uri}`;
	const HA2 = await hexDigest(algorithm, A2);

	let KD: string;
	if (qop === "auth" || qop === "auth-int") {
		if (!nc || !cnonce) {
			return false;
		}
		KD = `${HA1}:${nonce}:${nc}:${cnonce}:${qop}:${HA2}`;
	} else if (qop === undefined) {
		// RFC 2069 compatibility
		KD = `${HA1}:${nonce}:${HA2}`;
	} else {
		return false;
	}

	return (await hexDigest(algorithm, KD)) === response;
}

// basic_auth
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L945
authentication.get("/basic-auth/:user/:passwd", async (c) => {
	const user = c.req.param("user");
	const passwd = c.req.param("passwd");

	const authHeader = c.req.header("authorization");

	if (!authHeader?.startsWith("Basic ")) {
		return c.body(null, 401, {
			"WWW-Authenticate": 'Basic realm="Fake Realm"',
		});
	}

	let credentials: string;
	try {
		const binary = atob(authHeader.substring(6));
		credentials = new TextDecoder().decode(
			Uint8Array.from(binary, (ch) => ch.charCodeAt(0)),
		);
	} catch {
		credentials = "";
	}
	// Only the first ":" separates user and password (RFC 7617)
	const separator = credentials.indexOf(":");
	const providedUser = credentials.slice(0, separator);
	const providedPasswd = credentials.slice(separator + 1);

	if (separator === -1 || providedUser !== user || providedPasswd !== passwd) {
		return c.body(null, 401, {
			"WWW-Authenticate": 'Basic realm="Fake Realm"',
		});
	}

	return c.json({
		authenticated: true,
		user: user,
	});
});

// bearer_auth
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L1000
authentication.get("/bearer", (c) => {
	const authHeader = c.req.header("authorization");

	if (!authHeader?.startsWith("Bearer ")) {
		return c.body(null, 401, { "WWW-Authenticate": "Bearer" });
	}

	const token = authHeader.substring(7);

	return c.json({
		authenticated: true,
		token: token,
	});
});

// digest_auth_md5
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L1031
authentication.get("/digest-auth/:qop/:user/:passwd", async (c) => {
	const qop = c.req.param("qop");
	const user = c.req.param("user");
	const passwd = c.req.param("passwd");

	// Validate qop parameter
	if (qop !== "auth" && qop !== "auth-int") {
		return c.body("Invalid value for qop", 400);
	}

	const authHeader = c.req.header("authorization");
	const realm = "Fake Realm";

	// If no authorization header, send challenge
	if (!authHeader) {
		const challenge = generateDigestChallenge(realm, qop, null, false);
		return c.body(null, 401, { "WWW-Authenticate": challenge });
	}

	// Parse Digest authorization header
	const authParams = parseDigestAuth(authHeader);
	if (!authParams) {
		const challenge = generateDigestChallenge(realm, qop, null, false);
		return c.body(null, 401, { "WWW-Authenticate": challenge });
	}

	// Get request URI
	const url = new URL(c.req.url);
	const uri = url.pathname + url.search;

	// Check authentication
	const isValid = await checkDigestAuth(
		authParams,
		user,
		passwd,
		c.req.method,
		uri,
		await c.req.arrayBuffer(),
		"MD5",
	);

	if (!isValid) {
		const challenge = generateDigestChallenge(realm, qop, null, false);
		return c.body(null, 401, { "WWW-Authenticate": challenge });
	}

	return c.json({
		authenticated: true,
		user: user,
	});
});

// digest_auth_nostale
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L1059
authentication.get("/digest-auth/:qop/:user/:passwd/:algorithm", async (c) => {
	const qop = c.req.param("qop");
	const user = c.req.param("user");
	const passwd = c.req.param("passwd");
	const algorithm = c.req.param("algorithm");

	// Validate qop parameter
	if (qop !== "auth" && qop !== "auth-int") {
		return c.body("Invalid value for qop", 400);
	}

	// Validate algorithm parameter
	if (
		algorithm !== "MD5" &&
		algorithm !== "SHA-256" &&
		algorithm !== "SHA-512"
	) {
		return c.body("Invalid value for algorithm", 400);
	}

	const authHeader = c.req.header("authorization");
	const realm = "Fake Realm";

	// If no authorization header, send challenge
	if (!authHeader) {
		const challenge = generateDigestChallenge(realm, qop, algorithm, false);
		return c.body(null, 401, { "WWW-Authenticate": challenge });
	}

	// Parse Digest authorization header
	const authParams = parseDigestAuth(authHeader);
	if (!authParams) {
		const challenge = generateDigestChallenge(realm, qop, algorithm, false);
		return c.body(null, 401, { "WWW-Authenticate": challenge });
	}

	// Get request URI
	const url = new URL(c.req.url);
	const uri = url.pathname + url.search;

	// Check authentication
	const isValid = await checkDigestAuth(
		authParams,
		user,
		passwd,
		c.req.method,
		uri,
		await c.req.arrayBuffer(),
		algorithm,
	);

	if (!isValid) {
		const challenge = generateDigestChallenge(realm, qop, algorithm, false);
		return c.body(null, 401, { "WWW-Authenticate": challenge });
	}

	return c.json({
		authenticated: true,
		user: user,
	});
});

// digest_auth
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L1092
authentication.get(
	"/digest-auth/:qop/:user/:passwd/:algorithm/:stale_after",
	async (c) => {
		const qop = c.req.param("qop");
		const user = c.req.param("user");
		const passwd = c.req.param("passwd");
		const algorithm = c.req.param("algorithm");
		const staleAfter = c.req.param("stale_after");

		// Validate qop parameter
		if (qop !== "auth" && qop !== "auth-int") {
			return c.body("Invalid value for qop", 400);
		}

		// Validate algorithm parameter
		if (
			algorithm !== "MD5" &&
			algorithm !== "SHA-256" &&
			algorithm !== "SHA-512"
		) {
			return c.body("Invalid value for algorithm", 400);
		}

		const authHeader = c.req.header("authorization");
		const realm = "Fake Realm";

		// Calculate if nonce should be stale
		const shouldBeStale =
			staleAfter !== "never" &&
			!Number.isNaN(parseInt(staleAfter, 10)) &&
			parseInt(staleAfter, 10) <= 0;

		// If no authorization header, send challenge
		if (!authHeader) {
			const challenge = generateDigestChallenge(
				realm,
				qop,
				algorithm,
				shouldBeStale,
			);
			return c.body(null, 401, { "WWW-Authenticate": challenge });
		}

		// Parse Digest authorization header
		const authParams = parseDigestAuth(authHeader);
		if (!authParams) {
			const challenge = generateDigestChallenge(
				realm,
				qop,
				algorithm,
				shouldBeStale,
			);
			return c.body(null, 401, { "WWW-Authenticate": challenge });
		}

		// Get request URI
		const url = new URL(c.req.url);
		const uri = url.pathname + url.search;

		// Check authentication
		const isValid = await checkDigestAuth(
			authParams,
			user,
			passwd,
			c.req.method,
			uri,
			await c.req.arrayBuffer(),
			algorithm,
		);

		if (!isValid) {
			const challenge = generateDigestChallenge(
				realm,
				qop,
				algorithm,
				shouldBeStale,
			);
			return c.body(null, 401, { "WWW-Authenticate": challenge });
		}

		return c.json({
			authenticated: true,
			user: user,
		});
	},
);
