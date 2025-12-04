import type { Context } from "hono";
import { Hono } from "hono";

import { getHeaders, getOrigin } from "../utils/headers";

const DENY_ASCII_ART = `
          .-''''''-.
        .' _      _ '.
       /   O      O   \\
      :                :
      |                |
      :       __       :
       \\  .-"\`  \`"-.  /
        '.          .'
          '-......-'
     YOU SHOULDN'T BE HERE
`;

export const responseFormats = new Hono<{ Bindings: Env }>();

async function serveTemplate(
	c: Context<{ Bindings: Env }>,
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

// view_html_page
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L247
responseFormats.get("/html", async (c) => {
	return serveTemplate(c, "/templates/moby.html", "text/html");
});

// view_robots_page
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L263
responseFormats.get("/robots.txt", (c) => {
	return c.text(
		`User-agent: *
Disallow: /deny
`,
		200,
		{
			"Content-Type": "text/plain",
		},
	);
});

// view_deny_page
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L282
responseFormats.get("/deny", (c) => {
	return c.text(DENY_ASCII_ART, 200, {
		"Content-Type": "text/plain",
	});
});

// view_gzip_encoded_content
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L488
responseFormats.get("/gzip", (c) => {
	const headers = getHeaders(c);
	const origin = getOrigin(c);

	return c.json({
		gzipped: true,
		headers,
		method: c.req.method,
		origin,
	});
});

// view_deflate_encoded_content
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L505
responseFormats.get("/deflate", (c) => {
	const headers = getHeaders(c);
	const origin = getOrigin(c);

	return c.json({
		deflated: true,
		headers,
		method: c.req.method,
		origin,
	});
});

// view_brotli_encoded_content
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L522
responseFormats.get("/brotli", (c) => {
	const headers = getHeaders(c);
	const origin = getOrigin(c);

	return c.json({
		brotli: true,
		headers,
		method: c.req.method,
		origin,
	});
});

// encoding
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L1407
responseFormats.get("/encoding/utf8", async (c) => {
	return serveTemplate(
		c,
		"/templates/UTF-8-demo.txt",
		"text/html; charset=utf-8",
	);
});

// xml
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L1733
responseFormats.get("/xml", async (c) => {
	return serveTemplate(c, "/templates/sample.xml", "application/xml");
});

// a_json_endpoint
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L1750
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
