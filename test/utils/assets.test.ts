import { describe, expect, it } from "vitest";

import { responseFormats } from "../../src/routes/response-formats";

/**
 * A stand-in for the ASSETS binding that behaves like deployed Workers Assets:
 * "/x.html" redirects to "/x" (html_handling: auto-trailing-slash), and
 * conditional requests get a bodiless 304.
 */
function fakeAssets(files: Record<string, string>) {
	const requests: Request[] = [];
	const binding = {
		async fetch(input: RequestInfo | URL): Promise<Response> {
			const request = new Request(input);
			requests.push(request);
			const { pathname } = new URL(request.url);

			if (pathname.endsWith(".html")) {
				return new Response(null, {
					status: 307,
					headers: { Location: pathname.slice(0, -".html".length) },
				});
			}
			if (request.headers.has("if-none-match")) {
				return new Response(null, { status: 304 });
			}
			const file = files[pathname];
			return file === undefined
				? new Response("not found", { status: 404 })
				: new Response(file);
		},
	};
	return { env: { ASSETS: binding } as unknown as Env, requests };
}

describe("serveAsset", () => {
	it("should follow the .html redirect of deployed Workers Assets", async () => {
		const { env } = fakeAssets({ "/templates/forms-post": "<form>" });

		const res = await responseFormats.request("/forms/post", {}, env);

		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
		expect(await res.text()).toBe("<form>");
	});

	it("should not forward the client's conditional headers", async () => {
		const { env, requests } = fakeAssets({ "/templates/moby": "<html>" });

		const res = await responseFormats.request(
			"/html",
			{ headers: { "If-None-Match": '"abc"' } },
			env,
		);

		expect(await res.text()).toBe("<html>");
		expect(requests.every((r) => !r.headers.has("if-none-match"))).toBe(true);
	});

	it("should return 404 instead of an empty 200 when the asset is missing", async () => {
		const { env } = fakeAssets({});

		const res = await responseFormats.request("/xml", {}, env);

		expect(res.status).toBe(404);
	});
});
