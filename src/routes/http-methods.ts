import { type Context, Hono } from "hono";

import { requestInfo, requestInfoWithBody } from "../utils/request-info";

export const httpMethods = new Hono();

// view_get
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L367
httpMethods.get("/get", (c) => c.json(requestInfo(c)));

async function handleRequest(c: Context) {
	return c.json(await requestInfoWithBody(c));
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
