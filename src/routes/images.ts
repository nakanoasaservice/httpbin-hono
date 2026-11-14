import { Hono } from "hono";

import { serveAsset } from "../utils/assets";

const IMAGES = {
	png: { path: "/images/pig_icon.png", contentType: "image/png" },
	jpeg: { path: "/images/jackal.jpg", contentType: "image/jpeg" },
	webp: { path: "/images/wolf_1.webp", contentType: "image/webp" },
	svg: { path: "/images/svg_logo.svg", contentType: "image/svg+xml" },
} as const;

type ImageFormat = keyof typeof IMAGES;

export const images = new Hono<{ Bindings: Env }>();

/**
 * Pick an image format from the Accept header, in httpbin's priority order
 */
function formatFromAccept(accept: string): ImageFormat | null {
	if (!accept) return "png";
	if (accept.includes("image/webp")) return "webp";
	if (accept.includes("image/svg+xml")) return "svg";
	if (accept.includes("image/jpeg")) return "jpeg";
	if (accept.includes("image/png") || accept.includes("image/*")) return "png";
	return null;
}

// image
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L1628
images.get("/image", (c) => {
	const format = formatFromAccept(c.req.header("accept")?.toLowerCase() ?? "");
	if (!format) {
		return c.text("Unsupported media type", 406);
	}
	const { path, contentType } = IMAGES[format];
	return serveAsset(c, path, contentType);
});

// image_png, image_jpeg, image_webp, image_svg
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L1663-L1711
for (const [format, { path, contentType }] of Object.entries(IMAGES)) {
	images.get(`/image/${format}`, (c) => serveAsset(c, path, contentType));
}
