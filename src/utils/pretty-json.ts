import type { MiddlewareHandler } from "hono";

const rawResponses = new WeakSet<Response>();

/**
 * Exclude a response from pretty-printing, e.g. a stream or an
 * already-compressed body that must not be read and re-serialized.
 */
export function skipPrettyJSON(response: Response): Response {
	rawResponses.add(response);
	return response;
}

/**
 * JSON.stringify replacer that emits object keys in sorted order
 */
function sortKeys(_key: string, value: unknown): unknown {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		return value;
	}
	return Object.fromEntries(
		Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
	);
}

/**
 * Format JSON like httpbin's jsonify: 2-space indent, sorted keys, trailing newline
 * Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L72
 */
export function formatJSON(value: unknown): string {
	return `${JSON.stringify(value, sortKeys, 2)}\n`;
}

export const prettyJSON: MiddlewareHandler = async (c, next) => {
	await next();
	if (
		!rawResponses.has(c.res) &&
		c.res.headers.get("Content-Type")?.startsWith("application/json")
	) {
		const obj = await c.res.json();
		c.res = new Response(formatJSON(obj), c.res);
	}
};
