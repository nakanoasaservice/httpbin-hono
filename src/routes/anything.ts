import { Hono } from "hono";

import { getRequestBodyData } from "../utils/body";
import { getHeaders, getOrigin } from "../utils/headers";
import { getQueryParams } from "../utils/query";

export const anything = new Hono();

// view_anything
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L387
anything.all("/anything/*", async (c) => {
	const method = c.req.method;
	const args = getQueryParams(c);
	const headers = getHeaders(c);
	const origin = getOrigin(c);
	const url = c.req.url;
	const { form, files, data, json } = await getRequestBodyData(c);

	return c.json({
		args,
		data,
		files,
		form,
		headers,
		json,
		method,
		origin,
		url,
	});
});
