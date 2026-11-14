/**
 * The request summary that many httpbin endpoints echo back
 */

import type { Context } from "hono";

import { getRequestBodyData } from "./body";
import { getHeaders, getOrigin } from "./headers";
import { getQueryParams } from "./query";

/**
 * Same shape as GET /get
 */
export function requestInfo(c: Context) {
	return {
		args: getQueryParams(c),
		headers: getHeaders(c),
		origin: getOrigin(c),
		url: c.req.url,
	};
}

/**
 * Same shape as POST /post (request info plus the parsed body)
 */
export async function requestInfoWithBody(c: Context) {
	const { args, headers, origin, url } = requestInfo(c);
	const { data, files, form, json } = await getRequestBodyData(c);

	return { args, data, files, form, headers, json, origin, url };
}
