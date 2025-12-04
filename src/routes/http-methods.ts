import { type Context, Hono } from "hono";

import { getRequestBodyData } from "../utils/body";
import { getHeaders, getOrigin } from "../utils/headers";
import { getQueryParams } from "../utils/query";

export const httpMethods = new Hono();

// view_get
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L367
httpMethods.get("/get", async (c) => {
	const args = getQueryParams(c);
	const headers = getHeaders(c);
	const origin = getOrigin(c);
	const url = c.req.url;

	return c.json({
		args,
		headers,
		origin,
		url,
	});
});

async function handleRequest(c: Context) {
	const args = getQueryParams(c);
	const { form, files, data, json } = await getRequestBodyData(c);
	const origin = getOrigin(c);
	const headers = getHeaders(c);
	const url = c.req.url;

	return c.json({
		args,
		data,
		files,
		form,
		headers,
		json,
		origin,
		url,
	});
}

// view_post
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L415
httpMethods.post("/post", handleRequest);

// view_put
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L433
httpMethods.put("/put", handleRequest);

// view_patch
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L451
httpMethods.patch("/patch", handleRequest);

// view_delete
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L469
httpMethods.delete("/delete", handleRequest);
