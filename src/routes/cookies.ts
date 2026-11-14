import { type Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { CookieOptions } from "hono/utils/cookie";

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
 * Cookie attributes used by set/delete; secure only over HTTPS
 * Reference: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/helpers.py#L372
 */
function cookieOptions(c: Context): CookieOptions {
	return {
		path: "/",
		httpOnly: false,
		secure: new URL(c.req.url).protocol === "https:",
		sameSite: "Lax",
	};
}

// view_cookies
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L825
cookies.get("/cookies", (c) => {
	const cookies = getCookie(c);

	// Hide environment cookies by default (unless show_env query param is present)
	if (!c.req.query("show_env")) {
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

	setCookie(c, name, value, cookieOptions(c));

	return c.redirect("/cookies");
});

// set_cookies
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L883
cookies.get("/cookies/set", (c) => {
	for (const [name, [value = ""]] of Object.entries(c.req.queries())) {
		setCookie(c, name, value, cookieOptions(c));
	}

	return c.redirect("/cookies");
});

// delete_cookies
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L914
cookies.get("/cookies/delete", (c) => {
	for (const name of Object.keys(c.req.queries())) {
		deleteCookie(c, name, cookieOptions(c));
	}

	return c.redirect("/cookies");
});
