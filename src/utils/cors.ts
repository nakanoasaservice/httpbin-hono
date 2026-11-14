import type { MiddlewareHandler } from "hono";

/**
 * CORS headers on every response, and an empty 200 for any OPTIONS request
 * Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L214
 */
export const cors: MiddlewareHandler = async (c, next) => {
	if (c.req.method === "OPTIONS") {
		// Flask answers OPTIONS for every route automatically
		c.res = c.body(null, 200);
	} else {
		await next();
	}

	c.res.headers.set(
		"Access-Control-Allow-Origin",
		c.req.header("origin") ?? "*",
	);
	c.res.headers.set("Access-Control-Allow-Credentials", "true");

	if (c.req.method === "OPTIONS") {
		c.res.headers.set(
			"Access-Control-Allow-Methods",
			"GET, POST, PUT, DELETE, PATCH, OPTIONS",
		);
		c.res.headers.set("Access-Control-Max-Age", "3600");
		const requestHeaders = c.req.header("access-control-request-headers");
		if (requestHeaders !== undefined) {
			c.res.headers.set("Access-Control-Allow-Headers", requestHeaders);
		}
	}
};
