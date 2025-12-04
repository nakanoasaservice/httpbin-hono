import { Hono } from "hono";

import { getHeaders, getOrigin } from "../utils/headers";
import { getQueryParams } from "../utils/query";

export const responseInspection = new Hono();

/**
 * Break apart an HTTP header string that is potentially a quoted, comma separated list as used in entity headers in RFC2616.
 * Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/helpers.py#L305
 */
function parseMultiValueHeader(headerStr: string | undefined): string[] {
	const parsedParts: string[] = [];
	if (!headerStr) {
		return parsedParts;
	}

	const parts = headerStr.split(",");
	for (const part of parts) {
		// Match: (W/)? "?([^"]*)"?
		// This handles both weak tags (W/) and quoted/unquoted values
		const match = part.match(/\s*(W\/)?"?([^"]*)"?\s*/);
		if (match && match[2] !== undefined) {
			parsedParts.push(match[2]);
		}
	}
	return parsedParts;
}

// response_headers
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L781
responseInspection.on(["GET", "POST"], "/response-headers", (c) => {
	const params = getQueryParams(c);

	return c.json(params, 200, params);
});

// cache
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L1315
responseInspection.get("/cache", (c) => {
	const ifModifiedSince = c.req.header("if-modified-since");
	const ifNoneMatch = c.req.header("if-none-match");
	const isConditional = ifModifiedSince || ifNoneMatch;

	if (isConditional) {
		return c.body(null, 304);
	}

	// Return same as GET /get with Last-Modified and ETag headers
	return c.json(
		{
			args: getQueryParams(c),
			headers: getHeaders(c),
			origin: getOrigin(c),
			url: c.req.url,
		},
		200,
		{
			"Last-Modified": new Date().toUTCString(),
			ETag: crypto.randomUUID().replaceAll("-", ""),
		},
	);
});

// etag
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L1348
responseInspection.get("/etag/:etag", (c) => {
	const etag = c.req.param("etag");
	const ifNoneMatch = parseMultiValueHeader(c.req.header("if-none-match"));
	const ifMatch = parseMultiValueHeader(c.req.header("if-match"));

	if (ifNoneMatch.length > 0) {
		if (ifNoneMatch.includes(etag) || ifNoneMatch.includes("*")) {
			return c.body(null, 304, { ETag: etag });
		}
	} else if (ifMatch.length > 0) {
		if (!ifMatch.includes(etag) && !ifMatch.includes("*")) {
			return c.body(null, 412);
		}
	}

	// Special cases don't apply, return normal response
	return c.json(
		{
			args: getQueryParams(c),
			headers: getHeaders(c),
			origin: getOrigin(c),
			url: c.req.url,
		},
		200,
		{ ETag: etag },
	);
});

// cache_control
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L1386
responseInspection.get("/cache/:value", (c) => {
	const value = c.req.param("value");

	return c.json(
		{
			args: getQueryParams(c),
			headers: getHeaders(c),
			origin: getOrigin(c),
			url: c.req.url,
		},
		200,
		{ "Cache-Control": `public, max-age=${value}` },
	);
});
