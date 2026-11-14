import { type Context, Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";

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

/**
 * Check Basic credentials against user/passwd
 * Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/helpers.py#L258
 */
function checkBasicAuth(c: Context, user: string, passwd: string): boolean {
	const authHeader = c.req.header("authorization");
	if (!authHeader?.startsWith("Basic ")) {
		return false;
	}

	let credentials: string;
	try {
		credentials = decodeBase64(authHeader.substring(6));
	} catch {
		return false;
	}
	// Only the first ":" separates user and password (RFC 7617)
	const separator = credentials.indexOf(":");
	return (
		separator !== -1 &&
		credentials.slice(0, separator) === user &&
		credentials.slice(separator + 1) === passwd
	);
}

// basic_auth
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L945
authentication.get("/basic-auth/:user/:passwd", (c) => {
	const user = c.req.param("user");
	if (!checkBasicAuth(c, user, c.req.param("passwd"))) {
		return c.body(null, 401, {
			"WWW-Authenticate": `Basic realm="${REALM}"`,
		});
	}
	return c.json({ authenticated: true, user });
});

// hidden_basic_auth
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L973
authentication.get("/hidden-basic-auth/:user/:passwd", (c) => {
	const user = c.req.param("user");
	if (!checkBasicAuth(c, user, c.req.param("passwd"))) {
		return c.body(null, 404);
	}
	return c.json({ authenticated: true, user });
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
 * Digest challenge (401)
 * Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/helpers.py#L452
 */
function digestChallenge(
	c: Context,
	qop: string,
	algorithm: string,
	stale: boolean,
) {
	const random = () => crypto.randomUUID().replaceAll("-", "");
	let challenge = `Digest realm="${REALM}", nonce="${random()}", opaque="${random()}", qop="${qop}", algorithm=${algorithm}`;
	if (stale) {
		challenge += ", stale=TRUE";
	}
	return c.body(null, 401, { "WWW-Authenticate": challenge });
}

/**
 * Shared handler for the three /digest-auth routes.
 * `algorithm` and `stale_after` are absent on the shorter routes.
 *
 * Like httpbin, state between requests lives in cookies: `stale_after` counts
 * down successful logins until the nonce is reported stale, `last_nonce`
 * makes a reused nonce stale, and `fake` backs `?require-cookie=true`.
 * Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L1092
 */
async function digestAuth(c: Context) {
	const qop = c.req.param("qop") ?? "";
	const user = c.req.param("user") ?? "";
	const passwd = c.req.param("passwd") ?? "";
	const algorithm = c.req.param("algorithm") ?? "MD5";

	// httpbin silently treats an unknown qop as "either" and an unknown
	// algorithm as MD5, which hides typos such as "SHA256". Reject them instead.
	if (qop !== "auth" && qop !== "auth-int") {
		return c.text("Invalid value for qop", 400);
	}
	if (!DIGEST_ALGORITHMS.includes(algorithm)) {
		return c.text("Invalid value for algorithm", 400);
	}
	const staleAfter = c.req.param("stale_after") ?? "never";
	const requireCookie = ["1", "t", "true"].includes(
		c.req.query("require-cookie")?.toLowerCase() ?? "",
	);

	const cookies = getCookie(c);
	const setStateCookie = (name: string, value: string) =>
		setCookie(c, name, value, { path: "/" });

	const authParams = parseDigestAuth(c.req.header("authorization"));
	if (!authParams || (requireCookie && !c.req.header("cookie"))) {
		setStateCookie("stale_after", staleAfter);
		setStateCookie("fake", "fake_value");
		return digestChallenge(c, qop, algorithm, false);
	}

	if (requireCookie && cookies["fake"] !== "fake_value") {
		setStateCookie("fake", "fake_value");
		return c.json({ errors: ["missing cookie set on challenge"] }, 403);
	}

	const nonce = authParams["nonce"] ?? "";
	const staleAfterCookie = cookies["stale_after"];
	if (
		(cookies["last_nonce"] !== undefined && nonce === cookies["last_nonce"]) ||
		staleAfterCookie === "0"
	) {
		setStateCookie("stale_after", staleAfter);
		setStateCookie("last_nonce", nonce);
		setStateCookie("fake", "fake_value");
		return digestChallenge(c, qop, algorithm, true);
	}

	const url = new URL(c.req.url);
	const valid = await checkDigestAuth(
		authParams,
		user,
		passwd,
		c.req.method,
		url.pathname + url.search,
		await c.req.arrayBuffer(),
		algorithm,
	);
	if (!valid) {
		setStateCookie("stale_after", staleAfter);
		setStateCookie("last_nonce", nonce);
		setStateCookie("fake", "fake_value");
		return digestChallenge(c, qop, algorithm, false);
	}

	setStateCookie("fake", "fake_value");
	if (staleAfterCookie) {
		const remaining = Number.parseInt(staleAfterCookie, 10);
		setStateCookie(
			"stale_after",
			Number.isNaN(remaining) ? "never" : String(remaining - 1),
		);
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
