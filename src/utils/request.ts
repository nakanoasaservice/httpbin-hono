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
 * Returns JSON-safe version of data.
 * If data is a Unicode string or valid UTF-8, it is returned unmodified.
 * If data contains raw/binary data, it is Base64-encoded and returned as data URL.
 */
export function jsonSafe(
	data: string | Uint8Array | ArrayBuffer,
	contentType = "application/octet-stream",
): string {
	if (typeof data === "string") {
		// Check if it can be treated as UTF-8 string
		try {
			// Check if it can be encoded as JSON
			JSON.stringify(data);
			return data;
		} catch {
			// Base64 encode if it cannot be encoded as JSON
			const encoder = new TextEncoder();
			const uint8Array = encoder.encode(data);
			return jsonSafe(uint8Array, contentType);
		}
	}

	// For binary data
	let uint8Array: Uint8Array;
	if (data instanceof ArrayBuffer) {
		uint8Array = new Uint8Array(data);
	} else {
		uint8Array = data;
	}

	// Try to decode as UTF-8
	try {
		const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false });
		const decoded = decoder.decode(uint8Array);
		// Check if it can be encoded as JSON
		JSON.stringify(decoded);
		return decoded;
	} catch {
		// Base64 encode if it cannot be decoded as UTF-8
		// Process in chunks to handle large arrays
		let binaryString = "";
		const chunkSize = 8192;
		for (let i = 0; i < uint8Array.length; i += chunkSize) {
			const chunk = uint8Array.slice(i, i + chunkSize);
			binaryString += String.fromCharCode(...chunk);
		}
		const base64 = btoa(binaryString);
		return `data:${contentType};base64,${base64}`;
	}
}

/**
 * Get raw request body as string or Uint8Array from a Request object
 */
async function getRawDataFromContext(c: Context): Promise<string | Uint8Array> {
	try {
		const arrayBuffer = await c.req.arrayBuffer();

		// Try to decode as UTF-8
		try {
			const decoder = new TextDecoder("utf-8", {
				fatal: false,
				ignoreBOM: false,
			});
			return decoder.decode(arrayBuffer);
		} catch {
			return new Uint8Array(arrayBuffer);
		}
	} catch {
		return "";
	}
}

/**
 * Parse form data from raw data string
 */
function parseFormData(
	rawData: string,
	contentType: string,
): Record<string, string | string[]> | null {
	if (contentType.includes("application/x-www-form-urlencoded")) {
		const params = new URLSearchParams(rawData);
		const form: Record<string, string | string[]> = {};
		params.forEach((value, key) => {
			const existing = form[key];
			if (existing) {
				if (Array.isArray(existing)) {
					existing.push(value);
				} else {
					form[key] = [existing, value];
				}
			} else {
				form[key] = value;
			}
		});
		return semiflatten(form);
	}
	return null;
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
	const contentType = c.req.header("content-type") || "";

	// Use parseBody for multipart/form-data
	if (contentType.includes("multipart/form-data")) {
		try {
			// Clone request body to get both form/files and data
			const formData = await c.req.parseBody();
			const form: Record<string, string | string[]> = {};
			const files: Record<string, string | string[]> = {};

			for (const [key, value] of Object.entries(formData)) {
				if (value instanceof File) {
					const arrayBuffer = await value.arrayBuffer();
					const uint8Array = new Uint8Array(arrayBuffer);
					const fileContentType = value.type || "application/octet-stream";
					const jsonSafeValue = jsonSafe(uint8Array, fileContentType);

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

			const rawData = await c.req.arrayBuffer();
			const data = jsonSafe(rawData);
			let json: unknown = null;
			try {
				json = JSON.parse(
					new TextDecoder("utf-8", {
						fatal: true,
						ignoreBOM: false,
					}).decode(rawData),
				);
			} catch {
				// Set to null if cannot parse as JSON
			}

			return {
				form: semiflatten(form),
				files,
				data,
				json,
			};
		} catch {
			return {
				form: null,
				files: {},
				data: "",
				json: null,
			};
		}
	}

	// Use getRawData for other cases
	const rawData = await getRawDataFromContext(c);
	const data = jsonSafe(rawData);

	// Parse form data
	const form =
		typeof rawData === "string" ? parseFormData(rawData, contentType) : null;

	// Parse JSON
	let json: unknown = null;
	if (typeof rawData === "string") {
		try {
			json = JSON.parse(rawData);
		} catch {
			// Set to null if cannot parse as JSON
		}
	}

	return {
		form,
		files: {},
		data,
		json,
	};
}
