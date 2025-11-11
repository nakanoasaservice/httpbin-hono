import type { MiddlewareHandler } from "hono";

export const prettyJSON: MiddlewareHandler = async (c, next) => {
	await next();
	if (c.res.headers.get("Content-Type")?.startsWith("application/json")) {
		const obj = await c.res.json();
		c.res = new Response(JSON.stringify(obj, null, 2), c.res);
	}
};
