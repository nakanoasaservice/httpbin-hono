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
	if (existing) {
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
				if (Array.isArray(value)) {
					for (const item of value) {
						if (item instanceof File) {
							const arrayBuffer = await item.arrayBuffer();
							const jsonSafeValue = jsonSafe(arrayBuffer, item.type);

							semiflattenAdd(files, key, jsonSafeValue);
						} else {
							semiflattenAdd(form, key, item);
						}
					}
				} else if (value instanceof File) {
					const arrayBuffer = await value.arrayBuffer();
					const jsonSafeValue = jsonSafe(arrayBuffer, value.type);

					files[key] = jsonSafeValue;
				} else {
					form[key] = value;
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

	return {
		data: jsonSafe(rawData),
		files,
		form,
		json: parseJson(rawData),
	};
}
