import type { Context } from "hono";
import { Hono } from "hono";

type ImageFormat = "png" | "jpeg" | "webp" | "svg";

const IMAGE_CONFIG: Record<ImageFormat, { path: string; contentType: string }> =
	{
		png: {
			path: "/images/pig_icon.png",
			contentType: "image/png",
		},
		jpeg: {
			path: "/images/jackal.jpg",
			contentType: "image/jpeg",
		},
		webp: {
			path: "/images/wolf_1.webp",
			contentType: "image/webp",
		},
		svg: {
			path: "/images/svg_logo.svg",
			contentType: "image/svg+xml",
		},
	};

export const images = new Hono<{ Bindings: Cloudflare.Env }>();

// GET /image
images.get("/image", async (c) => {
	const accept = c.req.header("accept")?.toLowerCase() || "";

	// If no Accept header, default to PNG
	if (!accept) {
		return serveImage(c, "png");
	}

	// Check Accept header in priority order
	if (accept.includes("image/webp")) {
		return serveImage(c, "webp");
	} else if (accept.includes("image/svg+xml")) {
		return serveImage(c, "svg");
	} else if (accept.includes("image/jpeg")) {
		return serveImage(c, "jpeg");
	} else if (accept.includes("image/png") || accept.includes("image/*")) {
		return serveImage(c, "png");
	} else {
		// Unsupported media type
		return c.text("Unsupported media type", 406);
	}
});

// GET /image/png
images.get("/image/png", async (c) => {
	return serveImage(c, "png");
});

// GET /image/jpeg
images.get("/image/jpeg", async (c) => {
	return serveImage(c, "jpeg");
});

// GET /image/webp
images.get("/image/webp", async (c) => {
	return serveImage(c, "webp");
});

// GET /image/svg
images.get("/image/svg", async (c) => {
	return serveImage(c, "svg");
});

async function serveImage(
	c: Context<{ Bindings: Cloudflare.Env }>,
	format: ImageFormat,
): Promise<Response> {
	const config = IMAGE_CONFIG[format];
	const url = new URL(c.req.url);
	url.pathname = config.path;

	const request = new Request(url.toString(), c.req.raw);
	const response = await c.env.ASSETS.fetch(request);

	if (response.status === 404) {
		return c.text("Image not found", 404);
	}

	return new Response(response.body, {
		headers: {
			"Content-Type": config.contentType,
		},
	});
}
