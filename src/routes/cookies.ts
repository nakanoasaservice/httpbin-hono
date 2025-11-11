import type { Context } from "hono";
import { Hono } from "hono";

import { getQueryParams } from "../utils/request";

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
	// Check X-Forwarded-Proto header first (common in proxy environments)
	const forwardedProto = c.req.header("x-forwarded-proto");
	if (forwardedProto === "https") {
		return true;
	}

	// Check CF-Visitor header (Cloudflare specific)
	const cfVisitor = c.req.header("cf-visitor");
	if (cfVisitor) {
		try {
			const visitor = JSON.parse(cfVisitor);
			if (visitor.scheme === "https") {
				return true;
			}
		} catch {
			// Ignore JSON parse errors
		}
	}

	// Check URL protocol as fallback
	try {
		const url = new URL(c.req.url);
		return url.protocol === "https:";
	} catch {
		return false;
	}
}

function setCookie(
	c: Context,
	name: string,
	value: string,
	options: {
		path?: string;
		httpOnly?: boolean;
		secure?: boolean;
		sameSite?: "Strict" | "Lax" | "None";
		maxAge?: number;
	} = {},
) {
	const parts = [`${name}=${encodeURIComponent(value)}`];

	if (options.path) {
		parts.push(`Path=${options.path}`);
	}

	if (options.maxAge !== undefined) {
		parts.push(`Max-Age=${options.maxAge}`);
	}

	if (options.httpOnly) {
		parts.push("HttpOnly");
	}

	if (options.secure) {
		parts.push("Secure");
	}

	if (options.sameSite) {
		parts.push(`SameSite=${options.sameSite}`);
	}

	const cookieString = parts.join("; ");
	// Use append to support multiple Set-Cookie headers
	c.res.headers.append("Set-Cookie", cookieString);
}

// GET /cookies
cookies.get("/cookies", (c) => {
	const cookieHeader = c.req.header("cookie") || "";
	const cookies: Record<string, string> = {};

	if (cookieHeader) {
		cookieHeader.split(";").forEach((cookie) => {
			const [name, value] = cookie.trim().split("=");
			if (name && value) {
				cookies[name] = decodeURIComponent(value);
			}
		});
	}

	// Hide environment cookies by default (unless show_env query param is present)
	const hideEnv = !c.req.query("show_env");
	if (hideEnv) {
		for (const envCookie of ENV_COOKIES) {
			delete cookies[envCookie];
		}
	}

	return c.json({
		cookies: cookies,
	});
});

// GET /cookies/set
cookies.get("/cookies/set", (c) => {
	const params = getQueryParams(c);
	const cookieValues: Record<string, string> = {};

	Object.entries(params).forEach(([name, value]) => {
		// Handle both string and string[] (use first value if array)
		const cookieValue = Array.isArray(value) ? value[0] : value;
		setCookie(c, name, cookieValue, {
			path: "/",
			httpOnly: false,
			secure: secureCookie(c),
			sameSite: "Lax",
		});
		cookieValues[name] = cookieValue;
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
		setCookie(c, name, "", {
			path: "/",
			httpOnly: false,
			secure: secureCookie(c),
			sameSite: "Lax",
			maxAge: 0,
		});
	});

	return c.redirect("/cookies");
});
