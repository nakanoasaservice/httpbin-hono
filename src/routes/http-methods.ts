import { Hono } from "hono";
import {
	getHeaders,
	getOrigin,
	getQueryParams,
	getRequestBodyData,
} from "../utils/request";

export const httpMethods = new Hono();

// GET /get
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

// POST /post
httpMethods.post("/post", async (c) => {
	const args = getQueryParams(c);
	const { form, files, data, json } = await getRequestBodyData(c);
	const origin = getOrigin(c);
	const headers = getHeaders(c);
	const url = c.req.url;

	return c.json({
		url,
		args,
		form,
		data,
		origin,
		headers,
		files,
		json,
	});
});

// PUT /put
httpMethods.put("/put", async (c) => {
	const args = getQueryParams(c);
	const { form, files, data, json } = await getRequestBodyData(c);
	const origin = getOrigin(c);
	const headers = getHeaders(c);
	const url = c.req.url;

	return c.json({
		url,
		args,
		form,
		data,
		origin,
		headers,
		files,
		json,
	});
});

// PATCH /patch
httpMethods.patch("/patch", async (c) => {
	const args = getQueryParams(c);
	const { form, files, data, json } = await getRequestBodyData(c);
	const origin = getOrigin(c);
	const headers = getHeaders(c);
	const url = c.req.url;

	return c.json({
		url,
		args,
		form,
		data,
		origin,
		headers,
		files,
		json,
	});
});

// DELETE /delete
httpMethods.delete("/delete", async (c) => {
	const args = getQueryParams(c);
	const { form, files, data, json } = await getRequestBodyData(c);
	const origin = getOrigin(c);
	const headers = getHeaders(c);
	const url = c.req.url;

	return c.json({
		url,
		args,
		form,
		data,
		origin,
		headers,
		files,
		json,
	});
});
