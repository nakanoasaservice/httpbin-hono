/**
 * Utility functions for extracting query parameters
 */

import type { Context } from "hono";

export function getQueryParams(c: Context): Record<string, string | string[]> {
	const queries: Record<string, string | string[]> = c.req.queries();

	for (const [key, value] of Object.entries(queries)) {
		if (Array.isArray(value)) {
			// biome-ignore lint/style/noNonNullAssertion: value is not null
			queries[key] = value.length === 1 ? value[0]! : value;
		} else {
			queries[key] = value;
		}
	}

	return queries;
}
