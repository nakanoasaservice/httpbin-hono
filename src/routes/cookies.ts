import type { Context } from "hono";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import { getQueryParams } from "../utils/query";

export const cookies = new Hono();

// Environment cookies that should be hidden by default
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L60
const ENV_COOKIES = [
	"_gauges_unique",
	"_gauges_unique_year",
	"_gauges_unique_month",
	"_gauges_unique_day",
	"_gauges_unique_hour",
	"__utmz",
	"__utma",
	"__utmb",
];

/**
 * Return true if cookie should have secure attribute
 * Reference: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/helpers.py#L372
 */
function secureCookie(c: Context): boolean {
	try {
		const url = new URL(c.req.url);
		return url.protocol === "https:";
	} catch {
		return false;
	}
}

// view_cookies
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L825
cookies.get("/cookies", (c) => {
	const cookies = getCookie(c);

	// Hide environment cookies by default (unless show_env query param is present)
	const hideEnv = !c.req.query("show_env");
	if (hideEnv) {
		for (const envCookie of ENV_COOKIES) {
			delete cookies[envCookie];
		}
	}

	return c.json({
		cookies,
	});
});

// set_cookie
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L857
cookies.get("/cookies/set/:name/:value", (c) => {
	const name = c.req.param("name");
	const value = c.req.param("value");

	setCookie(c, name, value, {
		path: "/",
		httpOnly: false,
		secure: secureCookie(c),
		sameSite: "Lax",
	});

	return c.redirect("/cookies");
});

// set_cookies
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L883
cookies.get("/cookies/set", (c) => {
	const params = c.req.queries();

	Object.entries(params).forEach(([name, value]) => {
		// biome-ignore lint/style/noNonNullAssertion: value is not empty
		setCookie(c, name, value[0]!, {
			path: "/",
			httpOnly: false,
			secure: secureCookie(c),
			sameSite: "Lax",
		});
	});

	return c.redirect("/cookies");
});

// delete_cookies
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L914
cookies.get("/cookies/delete", (c) => {
	const params = getQueryParams(c);

	Object.keys(params).forEach((name) => {
		deleteCookie(c, name, {
			path: "/",
			httpOnly: false,
			secure: secureCookie(c),
			sameSite: "Lax",
		});
	});

	return c.redirect("/cookies");
});
