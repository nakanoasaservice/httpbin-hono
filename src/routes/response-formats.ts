import { type Context, Hono } from "hono";

import { serveAsset } from "../utils/assets";
import { getHeaders, getOrigin } from "../utils/headers";
import { formatJSON, skipPrettyJSON } from "../utils/pretty-json";

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

/**
 * JSON response for /gzip, /deflate and /brotli, actually encoded with that
 * Content-Encoding (httpbin compresses regardless of Accept-Encoding)
 * Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/filters.py
 */
async function encodedJSON(
	c: Context,
	flag: "gzipped" | "deflated" | "brotli",
	encoding: "gzip" | "deflate" | "br",
): Promise<Response> {
	const json = formatJSON({
		[flag]: true,
		headers: getHeaders(c),
		method: c.req.method,
		origin: getOrigin(c),
	});
	const headers = {
		"Content-Type": "application/json",
		"Content-Encoding": encoding,
	};

	if (encoding === "br") {
		// workerd's CompressionStream has no brotli. With the default
		// encodeBody: "automatic", the runtime brotli-compresses the body on send
		// (brotli_content_encoding is on by default since 2024-04-29).
		return skipPrettyJSON(c, new Response(json, { headers }));
	}

	const compressed = await new Response(
		new Blob([json]).stream().pipeThrough(new CompressionStream(encoding)),
	).arrayBuffer();
	return skipPrettyJSON(
		c,
		new Response(compressed, { headers, encodeBody: "manual" }),
	);
}

// view_html_page
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L247
responseFormats.get("/html", async (c) => {
	return serveAsset(c, "/templates/moby.html", "text/html");
});

// view_forms_post
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L850
responseFormats.get("/forms/post", (c) => {
	return serveAsset(
		c,
		"/templates/forms-post.html",
		"text/html; charset=utf-8",
	);
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
	return encodedJSON(c, "gzipped", "gzip");
});

// view_deflate_encoded_content
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L505
responseFormats.get("/deflate", (c) => {
	return encodedJSON(c, "deflated", "deflate");
});

// view_brotli_encoded_content
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L522
responseFormats.get("/brotli", (c) => {
	return encodedJSON(c, "brotli", "br");
});

// encoding
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L1407
responseFormats.get("/encoding/utf8", async (c) => {
	return serveAsset(c, "/templates/UTF-8-demo.txt", "text/html; charset=utf-8");
});

// xml
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L1733
responseFormats.get("/xml", async (c) => {
	return serveAsset(c, "/templates/sample.xml", "application/xml");
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
