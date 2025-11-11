import type { Context } from "hono";
import { Hono } from "hono";

type CloudflareEnv = {
	ASSETS: Fetcher;
};

export const responseFormats = new Hono<{ Bindings: CloudflareEnv }>();

async function serveTemplate(
	c: Context<{ Bindings: CloudflareEnv }>,
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
