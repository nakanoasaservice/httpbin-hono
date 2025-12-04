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

async function serveImage(
	c: Context<{ Bindings: Env }>,
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

export const images = new Hono<{ Bindings: Env }>();

// image
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L1628
images.get("/image", async (c) => {
	const accept = c.req.header("accept")?.toLowerCase() || "";

	// If no Accept header, default to PNG
	if (!accept) {
		return await serveImage(c, "png");
	}

	// Check Accept header in priority order
	if (accept.includes("image/webp")) {
		return await serveImage(c, "webp");
	} else if (accept.includes("image/svg+xml")) {
		return await serveImage(c, "svg");
	} else if (accept.includes("image/jpeg")) {
		return await serveImage(c, "jpeg");
	} else if (accept.includes("image/png") || accept.includes("image/*")) {
		return await serveImage(c, "png");
	} else {
		// Unsupported media type
		return c.text("Unsupported media type", 406);
	}
});

// image_png
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L1663
images.get("/image/png", async (c) => {
	return await serveImage(c, "png");
});

// image_jpeg
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L1679
images.get("/image/jpeg", async (c) => {
	return await serveImage(c, "jpeg");
});

// image_webp
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L1695
images.get("/image/webp", async (c) => {
	return await serveImage(c, "webp");
});

// image_svg
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L1711
images.get("/image/svg", async (c) => {
	return await serveImage(c, "svg");
});
