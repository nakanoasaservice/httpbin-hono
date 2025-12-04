import { type Context, Hono } from "hono";
import type { RedirectStatusCode } from "hono/utils/http-status";

export const redirects = new Hono();

/**
 * Convert all keys to lowercase
 */
function toLowerKeys(q: Record<string, string>): Record<string, string> {
	return Object.fromEntries(
		Object.entries(q).map(([key, value]) => [key.toLowerCase(), value]),
	);
}

/**
 * Build absolute URL from path
 */
function buildAbsoluteUrl(c: Context, path: string): string {
	const url = new URL(c.req.url);
	return `${url.protocol}//${url.host}${path}`;
}

// redirect_n_times
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L538
redirects.get("/redirect/:n", (c) => {
	const n = parseInt(c.req.param("n"), 10);

	if (Number.isNaN(n) || n < 1) {
		return c.json({ error: "Invalid redirect count" }, 400);
	}

	const absolute = c.req.query("absolute")?.toLowerCase() === "true";

	if (n === 1) {
		const targetPath = "/get";
		if (absolute) {
			return c.redirect(buildAbsoluteUrl(c, targetPath), 302);
		}
		return c.redirect(targetPath, 302);
	}

	if (absolute) {
		return c.redirect(buildAbsoluteUrl(c, `/absolute-redirect/${n - 1}`), 302);
	} else {
		return c.redirect(`/relative-redirect/${n - 1}`, 302);
	}
});

// redirect_to
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L573
redirects.on(
	["GET", "POST", "PUT", "DELETE", "PATCH", "TRACE"],
	"/redirect-to",
	(c) => {
		const args = toLowerKeys(c.req.query());
		const url = args["url"];

		if (!url) {
			return c.json({ error: "Missing url parameter" }, 400);
		}

		let statusCode = 302;
		const statusCodeStr = args["status_code"];
		if (statusCodeStr) {
			const parsed = parseInt(statusCodeStr, 10);
			if (parsed >= 300 && parsed < 400) {
				statusCode = parsed;
			}
		}

		return c.redirect(url, statusCode as RedirectStatusCode);
	},
);

// relative_redirect_n_times
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L648
redirects.get("/relative-redirect/:n", (c) => {
	const n = parseInt(c.req.param("n"), 10);

	if (Number.isNaN(n) || n < 1) {
		return c.json({ error: "Invalid redirect count" }, 400);
	}

	if (n === 1) {
		return c.redirect("/get", 302);
	}

	return c.redirect(`/relative-redirect/${n - 1}`, 302);
});

// absolute_redirect_n_times
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L678
redirects.get("/absolute-redirect/:n", (c) => {
	const n = parseInt(c.req.param("n"), 10);

	if (Number.isNaN(n) || n < 1) {
		return c.json({ error: "Invalid redirect count" }, 400);
	}

	if (n === 1) {
		return c.redirect(buildAbsoluteUrl(c, "/get"), 302);
	}

	return c.redirect(buildAbsoluteUrl(c, `/absolute-redirect/${n - 1}`), 302);
});
