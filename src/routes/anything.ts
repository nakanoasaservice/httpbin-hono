import { Hono } from "hono";

import { requestInfoWithBody } from "../utils/request-info";

export const anything = new Hono();

// view_anything
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L387
anything.all("/anything/*", async (c) => {
	const { args, data, files, form, headers, json, origin, url } =
		await requestInfoWithBody(c);

	return c.json({
		args,
		data,
		files,
		form,
		headers,
		json,
		method: c.req.method,
		origin,
		url,
	});
});
