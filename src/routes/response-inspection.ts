import { Hono } from "hono";

import { getHeaders, getOrigin, getQueryParams } from "../utils/request";

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

/**
 * Generate a random ETag (hex string)
 */
function generateETag(): string {
	return Array.from(crypto.getRandomValues(new Uint8Array(16)))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
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
	const response = c.json({
		args: getQueryParams(c),
		headers: getHeaders(c),
		origin: getOrigin(c),
		url: c.req.url,
	});
	response.headers.set("Last-Modified", httpDate());
	response.headers.set("ETag", generateETag());
	return response;
});

// GET /cache/:value
responseInspection.get("/cache/:value", (c) => {
	const value = c.req.param("value");
	c.header("Cache-Control", `public, max-age=${value}`);

	return c.json({
		args: getQueryParams(c),
		headers: getHeaders(c),
		origin: getOrigin(c),
		url: c.req.url,
	});
});

// GET /etag/:etag
responseInspection.get("/etag/:etag", (c) => {
	const etag = c.req.param("etag");
	const ifNoneMatch = parseMultiValueHeader(c.req.header("if-none-match"));
	const ifMatch = parseMultiValueHeader(c.req.header("if-match"));

	if (ifNoneMatch.length > 0) {
		if (ifNoneMatch.includes(etag) || ifNoneMatch.includes("*")) {
			const response = c.body(null, 304);
			response.headers.set("ETag", `"${etag}"`);
			return response;
		}
	} else if (ifMatch.length > 0) {
		if (!ifMatch.includes(etag) && !ifMatch.includes("*")) {
			return c.body(null, 412);
		}
	}

	// Special cases don't apply, return normal response
	const response = c.json({
		args: getQueryParams(c),
		headers: getHeaders(c),
		origin: getOrigin(c),
		url: c.req.url,
	});
	response.headers.set("ETag", `"${etag}"`);
	return response;
});

// GET /response-headers
responseInspection.get("/response-headers", (c) => {
	const params = getQueryParams(c);

	// Convert params to handle multiple values (similar to MultiDict)
	const headersToSet: Record<string, string | string[]> = {};
	for (const [key, value] of Object.entries(params)) {
		headersToSet[key] = value;
	}

	// Build response headers object that includes the headers we're setting
	// The Python implementation includes response headers in the JSON, which creates
	// a convergence loop. In Hono, we simulate this by including the headers we set.
	const buildResponseHeaders = (): Record<string, string | string[]> => {
		const result: Record<string, string | string[]> = {};

		// Add the headers we're setting (these will be in the response)
		for (const [key, value] of Object.entries(headersToSet)) {
			if (Array.isArray(value)) {
				result[key] = value.length === 1 ? value[0] : value;
			} else {
				result[key] = value;
			}
		}

		return result;
	};

	// Mimic Python's convergence loop: keep adding headers until stable
	let previousData = "";
	let iterations = 0;
	const maxIterations = 10;
	let responseHeaders = buildResponseHeaders();

	while (iterations < maxIterations) {
		const currentData = JSON.stringify(responseHeaders);

		if (currentData === previousData) {
			// Converged - create final response
			const response = c.json(responseHeaders);

			// Set headers on response
			for (const [key, value] of Object.entries(headersToSet)) {
				if (Array.isArray(value)) {
					for (const v of value) {
						response.headers.append(key, String(v));
					}
				} else {
					response.headers.set(key, String(value));
				}
			}

			return response;
		}

		previousData = currentData;
		// Rebuild with current headers (in Python, this would include response headers)
		responseHeaders = buildResponseHeaders();
		iterations++;
	}

	// Fallback if loop doesn't converge
	const response = c.json(responseHeaders);

	for (const [key, value] of Object.entries(headersToSet)) {
		if (Array.isArray(value)) {
			for (const v of value) {
				response.headers.append(key, String(v));
			}
		} else {
			response.headers.set(key, String(value));
		}
	}

	return response;
});

// POST /response-headers
responseInspection.post("/response-headers", async (c) => {
	const params = getQueryParams(c);
	const body = await c.req.json().catch(() => ({}));

	// Merge query params and body
	const allParams: Record<string, string | string[]> = { ...params, ...body };

	// Convert to handle multiple values
	const headersToSet: Record<string, string | string[]> = {};
	for (const [key, value] of Object.entries(allParams)) {
		headersToSet[key] = value;
	}

	// Build response headers object
	const buildResponseHeaders = (): Record<string, string | string[]> => {
		const result: Record<string, string | string[]> = {};

		for (const [key, value] of Object.entries(headersToSet)) {
			if (Array.isArray(value)) {
				result[key] = value.length === 1 ? value[0] : value;
			} else {
				result[key] = String(value);
			}
		}

		return result;
	};

	// Mimic Python's convergence loop
	let previousData = "";
	let iterations = 0;
	const maxIterations = 10;
	let responseHeaders = buildResponseHeaders();

	while (iterations < maxIterations) {
		const currentData = JSON.stringify(responseHeaders);

		if (currentData === previousData) {
			const response = c.json(responseHeaders);

			// Set headers on response
			for (const [key, value] of Object.entries(headersToSet)) {
				if (Array.isArray(value)) {
					for (const v of value) {
						response.headers.append(key, String(v));
					}
				} else {
					response.headers.set(key, String(value));
				}
			}

			return response;
		}

		previousData = currentData;
		responseHeaders = buildResponseHeaders();
		iterations++;
	}

	// Fallback
	const response = c.json(responseHeaders);

	for (const [key, value] of Object.entries(headersToSet)) {
		if (Array.isArray(value)) {
			for (const v of value) {
				response.headers.append(key, String(v));
			}
		} else {
			response.headers.set(key, String(value));
		}
	}

	return response;
});
