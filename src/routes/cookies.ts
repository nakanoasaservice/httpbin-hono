import type { Context } from "hono";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import { getQueryParams } from "../utils/query";

export const cookies = new Hono();

// Environment cookies that should be hidden by default
// Reference: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py
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
 * Reference: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/helpers.py
 */
function secureCookie(c: Context): boolean {
	try {
		const url = new URL(c.req.url);
		return url.protocol === "https:";
	} catch {
		return false;
	}
}

// GET /cookies
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

// GET /cookies/set
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

// GET /cookies/set/:name/:value
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

// GET /cookies/delete
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
