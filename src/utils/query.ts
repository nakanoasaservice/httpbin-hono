/**
 * Utility functions for extracting query parameters
 */

import type { Context } from "hono";

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
