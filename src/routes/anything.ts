import { Hono } from "hono";

import { requestInfoWithBody } from "../utils/request-info";

export const anything = new Hono();

// view_anything
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L387
anything.all("/anything/*", async (c) => {
	return c.json({ ...(await requestInfoWithBody(c)), method: c.req.method });
});
