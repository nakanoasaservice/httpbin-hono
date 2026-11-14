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
 * Format JSON like httpbin's jsonify: 2-space indent and a trailing newline.
 * Unlike Flask, keys are not sorted, so echoed request data keeps its order.
 * Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L72
 */
export function formatJSON(value: unknown): string {
	return `${JSON.stringify(value, null, 2)}\n`;
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
