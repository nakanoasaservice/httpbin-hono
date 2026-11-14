import { type Context, Hono } from "hono";

import { decodeBase64 } from "../utils/base64";

export const authentication = new Hono();

const REALM = "Fake Realm";
const DIGEST_ALGORITHMS = ["MD5", "SHA-256", "SHA-512"];

/**
 * Parse the key="value" pairs of a Digest authorization header
 */
function parseDigestAuth(
	authHeader: string | undefined,
): Record<string, string> | null {
	if (!authHeader?.startsWith("Digest ")) {
		return null;
	}

	const params: Record<string, string> = {};
	for (const [, key, quoted, bare] of authHeader
		.substring(7)
		.matchAll(/(\w+)=(?:"([^"]*)"|([^,]*))/g)) {
		if (key) {
			params[key] = quoted || bare || "";
		}
	}
	return params;
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
 * Check Digest authentication (RFC 2617 / RFC 7616)
 * Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/helpers.py#L311 (response) and #L355 (check_digest_auth)
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
			"WWW-Authenticate": `Basic realm="${REALM}"`,
		});
	}

	let credentials: string;
	try {
		credentials = decodeBase64(authHeader.substring(6));
	} catch {
		credentials = "";
	}
	// Only the first ":" separates user and password (RFC 7617)
	const separator = credentials.indexOf(":");
	const providedUser = credentials.slice(0, separator);
	const providedPasswd = credentials.slice(separator + 1);

	if (separator === -1 || providedUser !== user || providedPasswd !== passwd) {
		return c.body(null, 401, {
			"WWW-Authenticate": `Basic realm="${REALM}"`,
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

/**
 * Shared handler for the three /digest-auth routes.
 * `algorithm` and `stale_after` are absent on the shorter routes.
 */
async function digestAuth(c: Context) {
	const qop = c.req.param("qop");
	const user = c.req.param("user") ?? "";
	const passwd = c.req.param("passwd") ?? "";
	const algorithmParam = c.req.param("algorithm");
	const staleAfter = c.req.param("stale_after");

	if (qop !== "auth" && qop !== "auth-int") {
		return c.body("Invalid value for qop", 400);
	}
	if (
		algorithmParam !== undefined &&
		!DIGEST_ALGORITHMS.includes(algorithmParam)
	) {
		return c.body("Invalid value for algorithm", 400);
	}

	const algorithm = algorithmParam ?? "MD5";
	const staleAfterNum = Number.parseInt(staleAfter ?? "", 10);
	const stale = staleAfter !== "never" && staleAfterNum <= 0;

	const authParams = parseDigestAuth(c.req.header("authorization"));
	const url = new URL(c.req.url);

	if (
		!authParams ||
		!(await checkDigestAuth(
			authParams,
			user,
			passwd,
			c.req.method,
			url.pathname + url.search,
			await c.req.arrayBuffer(),
			algorithm,
		))
	) {
		let challenge = `Digest realm="${REALM}", nonce="${crypto.randomUUID().replaceAll("-", "")}", qop="${qop}"`;
		if (algorithmParam) {
			challenge += `, algorithm=${algorithmParam}`;
		}
		if (stale) {
			challenge += ", stale=true";
		}
		return c.body(null, 401, { "WWW-Authenticate": challenge });
	}

	return c.json({ authenticated: true, user });
}

// digest_auth_md5
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L1031
authentication.get("/digest-auth/:qop/:user/:passwd", digestAuth);

// digest_auth_nostale
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L1059
authentication.get("/digest-auth/:qop/:user/:passwd/:algorithm", digestAuth);

// digest_auth
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L1092
authentication.get(
	"/digest-auth/:qop/:user/:passwd/:algorithm/:stale_after",
	digestAuth,
);
