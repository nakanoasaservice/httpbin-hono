import { Hono } from "hono";

import { getHeaders, getOrigin } from "../utils/request";

export const requestInspection = new Hono();

// GET /headers
requestInspection.get("/headers", (c) => {
	const headers = getHeaders(c);

	return c.json({
		headers,
	});
});

// GET /ip
// Returns the requester's IP Address.
// Original implementation: request.headers.get("X-Forwarded-For", request.remote_addr)
requestInspection.get("/ip", (c) => {
	// Match original httpbin behavior: X-Forwarded-For first, then fallback
	const xForwardedFor = c.req.header("x-forwarded-for");
	const origin = xForwardedFor
		? xForwardedFor.split(",")[0]?.trim() || "unknown"
		: getOrigin(c);

	return c.json({
		origin,
	});
});

// GET /user-agent
// Return the incoming requests's User-Agent header.
// Original implementation uses get_headers() which returns CaseInsensitiveDict
requestInspection.get("/user-agent", (c) => {
	const headers = getHeaders(c);
	// Case-insensitive lookup (matching original CaseInsensitiveDict behavior)
	// Find user-agent header regardless of case
	const userAgentKey = Object.keys(headers).find(
		(key) => key.toLowerCase() === "user-agent",
	);
	const userAgent = userAgentKey ? headers[userAgentKey] : "";

	return c.json({
		"user-agent": userAgent,
	});
});
