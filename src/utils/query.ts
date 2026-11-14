/**
 * Utility functions for extracting query parameters
 */

import type { Context } from "hono";

/**
 * Query params with lowercased keys (first value wins), like httpbin's
 * CaseInsensitiveDict(request.args.items())
 */
export function getQueryParamsCaseInsensitive(
	c: Context,
): Record<string, string> {
	const params: Record<string, string> = {};
	for (const [key, value] of Object.entries(c.req.query())) {
		params[key.toLowerCase()] ??= value;
	}
	return params;
}

/**
 * Query params with single values unwrapped, like httpbin's `args`
 */
export function getQueryParams(c: Context): Record<string, string | string[]> {
	return Object.fromEntries(
		Object.entries(c.req.queries()).map(([key, values]) => [
			key,
			values.length === 1 ? (values[0] as string) : values,
		]),
	);
}
