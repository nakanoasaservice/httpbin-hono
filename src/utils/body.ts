/**
 * Utility functions for extracting request body data
 */

import type { Context } from "hono";

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
	contentType = "application/octet-stream",
): string {
	return (
		decodeUtf8(buffer) ??
		`data:${contentType};base64,${toBase64(new Uint8Array(buffer))}`
	);
}

/**
 * Decode strict UTF-8, or null if the bytes are not valid UTF-8
 */
function decodeUtf8(buffer: ArrayBuffer): string | null {
	try {
		return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(
			buffer,
		);
	} catch {
		return null;
	}
}

/**
 * Base64-encode bytes in chunks; spreading a large array into
 * String.fromCharCode exceeds the engine's argument limit.
 */
function toBase64(bytes: Uint8Array): string {
	const CHUNK = 0x8000;
	let binary = "";
	for (let i = 0; i < bytes.length; i += CHUNK) {
		binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
	}
	return btoa(binary);
}

/**
 * Parse JSON, returning null if the body is not valid UTF-8 JSON
 */
function parseJson(text: string | null): unknown {
	try {
		return text === null ? null : JSON.parse(text);
	} catch {
		return null;
	}
}

/**
 * Add a value to a multi-value dictionary
 * If the key already exists, the value is appended to the array
 * If the key does not exist, the value is set to the key
 * @param multi - The multi-value dictionary
 * @param key - The key to add the value to
 * @param value - The value to add to the key
 */
function semiflattenAdd(
	multi: Record<string, string | string[]>,
	key: string,
	value: string,
) {
	const existing = multi[key];
	if (existing !== undefined) {
		if (Array.isArray(existing)) {
			existing.push(value);
		} else {
			multi[key] = [existing, value];
		}
	} else {
		multi[key] = value;
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

	const contentType = c.req.header("content-type");
	if (
		// is form data or urlencoded data
		contentType?.includes("multipart/form-data") ||
		contentType?.includes("application/x-www-form-urlencoded")
	)
		try {
			const formData = await c.req.parseBody({ all: true });

			for (const [key, value] of Object.entries(formData)) {
				for (const item of [value].flat()) {
					if (item instanceof File) {
						semiflattenAdd(
							files,
							key,
							jsonSafe(await item.arrayBuffer(), item.type),
						);
					} else {
						semiflattenAdd(form, key, item);
					}
				}
			}
		} catch {
			return {
				data: "",
				files: {},
				form: null,
				json: null,
			};
		}

	const rawData = await c.req.arrayBuffer();
	const text = decodeUtf8(rawData);

	return {
		data: text ?? jsonSafe(rawData),
		files,
		form,
		json: parseJson(text),
	};
}
