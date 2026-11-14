import type { Context, MiddlewareHandler } from "hono";

declare module "hono" {
	interface ContextVariableMap {
		skipPrettyJSON: boolean;
	}
}

/**
 * Exclude this request's response from pretty-printing, e.g. a stream or an
 * already-compressed body that must not be read and re-serialized.
 *
 * A context flag rather than a mark on the Response: Hono rebuilds the
 * handler's Response when middleware (such as CORS) set headers beforehand.
 */
export function skipPrettyJSON(c: Context, response: Response): Response {
	c.set("skipPrettyJSON", true);
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
		!c.get("skipPrettyJSON") &&
		c.res.headers.get("Content-Type")?.startsWith("application/json")
	) {
		const obj = await c.res.json();
		c.res = new Response(formatJSON(obj), c.res);
	}
};
