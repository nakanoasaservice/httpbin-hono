import { Hono } from "hono";

import { getHeaders, getOrigin } from "../utils/headers";

export const requestInspection = new Hono();

// view_origin
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L303
requestInspection.get("/ip", (c) => {
	const origin = getOrigin(c);

	return c.json({
		origin,
	});
});

// view_headers
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L333
requestInspection.get("/headers", (c) => {
	const headers = getHeaders(c);

	return c.json({
		headers,
	});
});

// view_user_agent
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L349
requestInspection.get("/user-agent", (c) => {
	const userAgent = c.req.header("user-agent");

	return c.json({
		"user-agent": userAgent ?? null,
	});
});
