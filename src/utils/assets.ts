import type { Context } from "hono";

/**
 * Serve a file from the static assets binding with the given Content-Type
 */
export async function serveAsset(
	c: Context<{ Bindings: Env }>,
	path: string,
	contentType: string,
): Promise<Response> {
	const url = new URL(path, c.req.url);
	const response = await c.env.ASSETS.fetch(new Request(url, c.req.raw));

	if (response.status === 404) {
		return c.text("Not found", 404);
	}

	return new Response(response.body, {
		headers: { "Content-Type": contentType },
	});
}
