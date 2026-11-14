import type { Context } from "hono";

/**
 * Serve a file from the static assets binding with the given Content-Type
 */
export async function serveAsset(
	c: Context<{ Bindings: Env }>,
	path: string,
	contentType: string,
): Promise<Response> {
	// A plain GET: forwarding the client's request would pass along headers
	// like If-None-Match, and a 304 from the binding has no body to serve.
	let response = await c.env.ASSETS.fetch(new URL(path, c.req.url));

	// Workers Assets' default html_handling redirects "/x.html" to "/x"
	const location = response.headers.get("Location");
	if (response.status >= 300 && response.status < 400 && location) {
		response = await c.env.ASSETS.fetch(new URL(location, c.req.url));
	}

	if (!response.ok) {
		return c.text("Not found", 404);
	}

	return new Response(response.body, {
		headers: { "Content-Type": contentType },
	});
}
