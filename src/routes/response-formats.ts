import type { Context } from "hono";
import { Hono } from "hono";

import { getHeaders, getOrigin } from "../utils/request";

export const responseFormats = new Hono<{ Bindings: Cloudflare.Env }>();

async function serveTemplate(
	c: Context<{ Bindings: Cloudflare.Env }>,
	path: string,
	contentType: string,
): Promise<Response> {
	const url = new URL(c.req.url);
	url.pathname = path;

	const request = new Request(url.toString(), c.req.raw);
	const response = await c.env.ASSETS.fetch(request);

	if (response.status === 404) {
		return c.text("Template not found", 404);
	}

	return new Response(response.body, {
		headers: {
			"Content-Type": contentType,
		},
	});
}

// GET /json
responseFormats.get("/json", (c) => {
	return c.json({
		slideshow: {
			title: "Sample Slide Show",
			date: "date of publication",
			author: "Yours Truly",
			slides: [
				{
					type: "all",
					title: "Wake up to WonderWidgets!",
				},
				{
					type: "all",
					title: "Overview",
					items: [
						"Why <em>WonderWidgets</em> are great",
						"Who <em>buys</em> WonderWidgets",
					],
				},
			],
		},
	});
});

// GET /xml
responseFormats.get("/xml", async (c) => {
	return serveTemplate(c, "/templates/sample.xml", "application/xml");
});

// GET /html
responseFormats.get("/html", async (c) => {
	return serveTemplate(c, "/templates/moby.html", "text/html");
});

// GET /robots.txt
responseFormats.get("/robots.txt", (c) => {
	c.header("Content-Type", "text/plain");
	return c.text(`User-agent: *
Disallow: /deny
`);
});

// GET /deny
responseFormats.get("/deny", (c) => {
	c.header("Content-Type", "text/plain");
	return c.text(`          .-''''''-.
        .' _      _ '.
       /   O      O   \\\\
      :                :
      |                |
      :       __       :
       \\\\  .-"\\\`  \\\`"-.  /
        '.          .'
          '-......-'
     YOU SHOULDN'T BE HERE
`);
});

// GET /encoding/utf8
responseFormats.get("/encoding/utf8", async (c) => {
	return serveTemplate(
		c,
		"/templates/UTF-8-demo.txt",
		"text/html; charset=utf-8",
	);
});

// GET /brotli
// Returns Brotli-encoded data.
// Cloudflare automatically handles brotli compression when Accept-Encoding: br is present
responseFormats.get("/brotli", (c) => {
	const headers = getHeaders(c);
	const origin = getOrigin(c);

	return c.json({
		method: c.req.method,
		headers,
		origin,
		brotli: true,
	});
});

// GET /deflate
// Returns Deflate-encoded data.
// Cloudflare automatically handles deflate compression when Accept-Encoding: deflate is present
responseFormats.get("/deflate", (c) => {
	const headers = getHeaders(c);
	const origin = getOrigin(c);

	return c.json({
		method: c.req.method,
		headers,
		origin,
		deflated: true,
	});
});

// GET /gzip
// Returns GZip-encoded data.
// Cloudflare automatically handles gzip compression when Accept-Encoding: gzip is present
responseFormats.get("/gzip", (c) => {
	const headers = getHeaders(c);
	const origin = getOrigin(c);

	return c.json({
		method: c.req.method,
		headers,
		origin,
		gzipped: true,
	});
});
