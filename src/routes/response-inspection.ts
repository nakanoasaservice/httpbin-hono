import { Hono } from "hono";

import { getHeaders, getOrigin } from "../utils/headers";
import { getQueryParams } from "../utils/query";

export const responseInspection = new Hono();

/**
 * Parse a multi-value HTTP header string (e.g., ETag headers)
 * Breaks apart an HTTP header string that is potentially a quoted, comma separated list
 * as used in entity headers in RFC2616.
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

/**
 * Generate HTTP date string (RFC 1123 format)
 */
function httpDate(): string {
	return new Date().toUTCString();
}

// GET /cache
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
			"Last-Modified": httpDate(),
			ETag: crypto.randomUUID().replaceAll("-", ""),
		},
	);
});

// GET /cache/:value
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

// GET /etag/:etag
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

// GET /response-headers
responseInspection.on(["GET", "POST"], "/response-headers", (c) => {
	const params = getQueryParams(c);

	return c.json(params, 200, params);
});
