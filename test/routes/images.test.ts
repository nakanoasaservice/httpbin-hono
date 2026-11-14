import { env } from "cloudflare:workers";
import { describe, expect, it } from "vite-plus/test";

import { images } from "../../src/routes/images";

describe("Images", () => {
	describe.each([
		["png", "image/png"],
		["jpeg", "image/jpeg"],
		["webp", "image/webp"],
		["svg", "image/svg+xml"],
	])("GET /image/%s", (format, contentType) => {
		it(`should return a ${contentType} image`, async () => {
			const res = await images.request(`/image/${format}`, {}, env);

			expect(res.status).toBe(200);
			expect(res.headers.get("content-type")).toBe(contentType);
			expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(0);
		});
	});

	describe("GET /image", () => {
		it("should default to PNG without an Accept header", async () => {
			const res = await images.request("/image", {}, env);

			expect(res.status).toBe(200);
			expect(res.headers.get("content-type")).toBe("image/png");
		});

		it.each([
			["image/webp", "image/webp"],
			["image/svg+xml", "image/svg+xml"],
			["image/jpeg", "image/jpeg"],
			["image/png", "image/png"],
			["image/*", "image/png"],
			// webp wins when several types are accepted
			["image/png,image/webp", "image/webp"],
			["IMAGE/JPEG", "image/jpeg"],
		])("should serve %s as %s", async (accept, contentType) => {
			const res = await images.request(
				"/image",
				{ headers: { Accept: accept } },
				env,
			);

			expect(res.status).toBe(200);
			expect(res.headers.get("content-type")).toBe(contentType);
		});

		it("should return 406 for an unsupported Accept header", async () => {
			const res = await images.request(
				"/image",
				{ headers: { Accept: "text/plain" } },
				env,
			);

			expect(res.status).toBe(406);
			expect(await res.json()).toEqual({
				message: "Client did not request a supported media type.",
				accept: [
					"image/webp",
					"image/svg+xml",
					"image/jpeg",
					"image/png",
					"image/*",
				],
			});
		});
	});
});
