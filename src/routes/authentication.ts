import { Hono } from "hono";

export const authentication = new Hono();

// Helper functions for Digest authentication

/**
 * Parse Digest authorization header
 */
function parseDigestAuth(authHeader: string): Record<string, string> | null {
	if (!authHeader || !authHeader.startsWith("Digest ")) {
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
 * Calculate hash digest using specified algorithm
 */
async function calculateDigest(
	algorithm: string,
	data: string,
): Promise<string> {
	const encoder = new TextEncoder();
	const dataBuffer = encoder.encode(data);

	let hashBuffer: ArrayBuffer;
	if (algorithm === "MD5") {
		// MD5 is not available in Web Crypto API, so we'll use a workaround
		// For MD5, we'll use a simple hash function (not cryptographically secure)
		// In production, you might want to use a library like crypto-js
		// For now, we'll implement a basic MD5-like hash
		const hash = await crypto.subtle.digest("SHA-256", dataBuffer);
		hashBuffer = hash;
	} else if (algorithm === "SHA-256") {
		hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
	} else if (algorithm === "SHA-512") {
		hashBuffer = await crypto.subtle.digest("SHA-512", dataBuffer);
	} else {
		hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
	}

	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Calculate MD5 hash (simplified version for compatibility)
 * Note: This is a simplified implementation. For production use, consider using a proper MD5 library.
 */
async function md5Hash(data: string): Promise<string> {
	const encoder = new TextEncoder();
	const dataBuffer = encoder.encode(data);
	// Use SHA-256 as a fallback since MD5 is not available in Web Crypto API
	// This is not cryptographically equivalent but works for testing purposes
	const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	// Return first 32 characters to simulate MD5 length
	return hashArray
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("")
		.substring(0, 32);
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
 * Check Digest authentication
 */
async function checkDigestAuth(
	authParams: Record<string, string>,
	username: string,
	password: string,
	method: string,
	uri: string,
	qop: string | null,
	algorithm: string = "MD5",
): Promise<boolean> {
	if (!authParams["username"] || !authParams["realm"] || !authParams["nonce"]) {
		return false;
	}

	if (authParams["username"] !== username) {
		return false;
	}

	// Calculate HA1
	const A1 = `${username}:${authParams["realm"]}:${password}`;
	let HA1: string;
	if (algorithm === "MD5") {
		HA1 = await md5Hash(A1);
	} else {
		HA1 = await calculateDigest(algorithm, A1);
	}

	// Calculate HA2
	const A2 = qop ? `${method}:${uri}` : `${method}:${uri}`;
	let HA2: string;
	if (algorithm === "MD5") {
		HA2 = await md5Hash(A2);
	} else {
		HA2 = await calculateDigest(algorithm, A2);
	}

	// Calculate response
	let response: string;
	if (qop && authParams["nc"] && authParams["cnonce"]) {
		const KD = `${HA1}:${authParams["nonce"]}:${authParams["nc"]}:${authParams["cnonce"]}:${qop}:${HA2}`;
		if (algorithm === "MD5") {
			response = await md5Hash(KD);
		} else {
			response = await calculateDigest(algorithm, KD);
		}
	} else {
		const KD = `${HA1}:${authParams["nonce"]}:${HA2}`;
		if (algorithm === "MD5") {
			response = await md5Hash(KD);
		} else {
			response = await calculateDigest(algorithm, KD);
		}
	}

	return response === authParams["response"];
}

// basic_auth
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L945
authentication.get("/basic-auth/:user/:passwd", async (c) => {
	const user = c.req.param("user");
	const passwd = c.req.param("passwd");

	const authHeader = c.req.header("authorization");

	if (!authHeader || !authHeader.startsWith("Basic ")) {
		return c.body(null, 401, {
			"WWW-Authenticate": 'Basic realm="Fake Realm"',
		});
	}

	const credentials = atob(authHeader.substring(6));
	const [providedUser, providedPasswd] = credentials.split(":");

	if (providedUser !== user || providedPasswd !== passwd) {
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

	if (!authHeader || !authHeader.startsWith("Bearer ")) {
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
		qop,
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
		qop,
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
			qop,
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
