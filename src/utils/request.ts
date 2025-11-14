/**
 * Utility functions for extracting request information
 */

import type { Context } from "hono";

/**
 * Get the origin client IP address from request headers.
 * Priority order based on Cloudflare documentation:
 * 1. CF-Connecting-IP (most reliable, single IP address)
 * 2. True-Client-IP (Enterprise plan, equivalent to CF-Connecting-IP)
 * 3. X-Forwarded-For (only if CF-Connecting-IP is not present)
 * 4. X-Real-IP (fallback)
 *
 * Reference: https://developers.cloudflare.com/fundamentals/reference/http-headers/
 */
export function getOrigin(c: Context): string {
	// CF-Connecting-IP is the most reliable source for client IP
	// It contains only one IP address and is set by Cloudflare
	const cfConnectingIp = c.req.header("cf-connecting-ip");
	if (cfConnectingIp) {
		return cfConnectingIp;
	}

	// True-Client-IP is equivalent to CF-Connecting-IP (Enterprise plan only)
	const trueClientIp = c.req.header("true-client-ip");
	if (trueClientIp) {
		return trueClientIp;
	}

	// X-Forwarded-For: If CF-Connecting-IP is not present, X-Forwarded-For
	// should have the same value. However, if X-Forwarded-For already existed,
	// Cloudflare appends proxy IPs, so we take the first value.
	const forwardedFor = c.req.header("x-forwarded-for");
	if (forwardedFor) {
		return forwardedFor.split(",")[0]?.trim() || "unknown";
	}

	// X-Real-IP: Fallback option (mainly for Worker subrequests)
	const realIp = c.req.header("x-real-ip");
	if (realIp) {
		return realIp;
	}

	return "unknown";
}

// Environment headers that should be hidden by default
// Reference: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/helpers.py
// Cloudflare headers reference: https://developers.cloudflare.com/fundamentals/reference/http-headers/
const ENV_HEADERS = [
	// Original httpbin environment headers
	"X-Varnish",
	"X-Request-Start",
	"X-Heroku-Queue-Depth",
	"X-Real-Ip",
	"X-Forwarded-Proto",
	"X-Forwarded-Protocol",
	"X-Forwarded-Ssl",
	"X-Heroku-Queue-Wait-Time",
	"X-Forwarded-For",
	"X-Heroku-Dynos-In-Use",
	"X-Forwarded-Port",
	"X-Request-Id",
	"Via",
	"Total-Route-Time",
	"Connect-Time",
	// Cloudflare-specific headers (infrastructure/proxy information)
	"CF-Connecting-IP",
	"CF-IPCountry",
	"CF-Ray",
	"CF-Request-ID",
	"CF-Visitor",
	"CF-EW-Via",
	"True-Client-IP",
	"CF-Worker",
];

export function getHeaders(c: Context, hideEnv = true): Record<string, string> {
	const headers = c.req.header();

	// Hide environment headers by default (unless show_env query param is present)
	if (hideEnv && !c.req.query("show_env")) {
		for (const envHeader of ENV_HEADERS) {
			delete headers[envHeader.toLowerCase()];
		}
	}

	return headers;
}

/**
 * Convert a MultiDict-like structure into a regular dict.
 * If there are more than one value for a key, the result will have a list of values.
 * Otherwise it will have the plain value.
 */
function semiflatten(
	multi: Record<string, string | string[]>,
): Record<string, string | string[]> {
	if (!multi || Object.keys(multi).length === 0) {
		return multi;
	}

	const result: Record<string, string | string[]> = {};
	for (const [key, value] of Object.entries(multi)) {
		if (Array.isArray(value)) {
			// biome-ignore lint/style/noNonNullAssertion: value is not null
			result[key] = value.length === 1 ? value[0]! : value;
		} else {
			result[key] = value;
		}
	}
	return result;
}

export function getQueryParams(c: Context): Record<string, string | string[]> {
	return semiflatten(c.req.queries());
}

/**
 * Returns JSON-safe version of `string`.
 * If `buf` is a Unicode string or a valid UTF-8, it is returned unmodified,
 * as it can safely be encoded to JSON string.
 * If `buf` contains raw/binary data, it is Base64-encoded, formatted and
 * returned according to "data" URL scheme (RFC2397). Since JSON is not
 * suitable for binary data, some additional encoding was necessary; "data"
 * URL scheme was chosen for its simplicity.
 *
 * @see https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/helpers.py#L85
 */
function jsonSafe(
	buffer: ArrayBuffer,
	content_type = "application/octet-stream",
): string {
	try {
		const str = new TextDecoder("utf-8", {
			fatal: true,
			ignoreBOM: false,
		}).decode(buffer);
		JSON.stringify(str);
		return str;
	} catch {
		return `data:${content_type};base64,${btoa(String.fromCharCode(...new Uint8Array(buffer)))}`;
	}
}

/**
 * Parse JSON from ArrayBuffer, returning null if parsing fails
 */
function parseJson(rawData: ArrayBuffer): unknown {
	try {
		return JSON.parse(
			new TextDecoder("utf-8", {
				fatal: true,
				ignoreBOM: false,
			}).decode(rawData),
		);
	} catch {
		return null;
	}
}

/**
 * Get all request body data (form, files, data, json) efficiently
 * This function handles the request body reading once and returns all needed data
 */
export async function getRequestBodyData(c: Context): Promise<{
	form: Record<string, string | string[]> | null;
	files: Record<string, string | string[]>;
	data: string;
	json: unknown;
}> {
	const form: Record<string, string | string[]> = {};
	const files: Record<string, string | string[]> = {};

	const contentType = c.req.header("content-type") || "";
	if (
		// is form data or urlencoded data
		contentType.includes("multipart/form-data") ||
		contentType.includes("application/x-www-form-urlencoded")
	)
		try {
			const formData = await c.req.parseBody();

			for (const [key, value] of Object.entries(formData)) {
				if (value instanceof File) {
					const arrayBuffer = await value.arrayBuffer();
					const jsonSafeValue = jsonSafe(arrayBuffer, value.type);

					const existing = files[key];
					if (existing) {
						if (Array.isArray(existing)) {
							existing.push(jsonSafeValue);
						} else {
							files[key] = [existing, jsonSafeValue];
						}
					} else {
						files[key] = jsonSafeValue;
					}
				} else {
					form[key] = value as string;
				}
			}
		} catch {
			return {
				data: "",
				form: null,
				files: {},
				json: null,
			};
		}

	const rawData = await c.req.arrayBuffer();

	return {
		data: jsonSafe(rawData),
		files,
		form: semiflatten(form),
		json: parseJson(rawData),
	};
}
