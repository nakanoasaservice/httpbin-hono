import { type Context, Hono } from "hono";
import type { RedirectStatusCode } from "hono/utils/http-status";

export const redirects = new Hono();

/**
 * Case-insensitive dictionary for parameters
 */
class CaseInsensitiveDict {
	private data: Map<string, string> = new Map();

	set(key: string, value: string): void {
		const lowerKey = key.toLowerCase();
		this.data.set(lowerKey, value);
	}

	get(key: string): string | undefined {
		const lowerKey = key.toLowerCase();
		return this.data.get(lowerKey);
	}

	has(key: string): boolean {
		const lowerKey = key.toLowerCase();
		return this.data.has(lowerKey);
	}
}

/**
 * Get all parameters from query string and form data (case-insensitive)
 */
async function getAllParams(c: Context): Promise<CaseInsensitiveDict> {
	const params = new CaseInsensitiveDict();

	// Get query parameters
	const queryParams = c.req.query();
	for (const [key, value] of Object.entries(queryParams)) {
		if (value !== undefined && value !== null) {
			params.set(key, String(value));
		}
	}

	// Get form data if Content-Type is application/x-www-form-urlencoded
	const contentType = c.req.header("content-type") || "";
	if (
		contentType.includes("application/x-www-form-urlencoded") ||
		contentType.includes("multipart/form-data")
	) {
		try {
			const formData = await c.req.parseBody();
			for (const [key, value] of Object.entries(formData)) {
				if (!(value instanceof File) && value !== undefined) {
					const strValue = String(value);
					// Form data takes precedence over query params
					params.set(key, strValue);
				}
			}
		} catch {
			// Ignore parsing errors
		}
	}

	return params;
}

/**
 * Build absolute URL from path
 */
function buildAbsoluteUrl(c: Context, path: string): string {
	const url = new URL(c.req.url);
	return `${url.protocol}//${url.host}${path}`;
}

// GET /redirect/:n
redirects.get("/redirect/:n", (c) => {
	const n = parseInt(c.req.param("n"), 10);

	if (Number.isNaN(n) || n < 1) {
		return c.json({ error: "Invalid redirect count" }, 400);
	}

	const absolute = c.req.query("absolute")?.toLowerCase() === "true";

	if (n === 1) {
		const targetPath = "/get";
		if (absolute) {
			return c.redirect(buildAbsoluteUrl(c, targetPath), 302);
		}
		return c.redirect(targetPath, 302);
	}

	if (absolute) {
		return c.redirect(buildAbsoluteUrl(c, `/absolute-redirect/${n - 1}`), 302);
	} else {
		return c.redirect(`/relative-redirect/${n - 1}`, 302);
	}
});

// GET /relative-redirect/:n
redirects.get("/relative-redirect/:n", (c) => {
	const n = parseInt(c.req.param("n"), 10);

	if (Number.isNaN(n) || n < 1) {
		return c.json({ error: "Invalid redirect count" }, 400);
	}

	if (n === 1) {
		return c.redirect("/get", 302);
	}

	return c.redirect(`/relative-redirect/${n - 1}`, 302);
});

// GET /absolute-redirect/:n
redirects.get("/absolute-redirect/:n", (c) => {
	const n = parseInt(c.req.param("n"), 10);

	if (Number.isNaN(n) || n < 1) {
		return c.json({ error: "Invalid redirect count" }, 400);
	}

	if (n === 1) {
		return c.redirect(buildAbsoluteUrl(c, "/get"), 302);
	}

	return c.redirect(buildAbsoluteUrl(c, `/absolute-redirect/${n - 1}`), 302);
});

/**
 * Handle /redirect-to for all supported methods
 */
async function handleRedirectTo(c: Context) {
	const args = await getAllParams(c);
	const url = args.get("url");

	if (!url) {
		return c.json({ error: "Missing url parameter" }, 400);
	}

	let statusCode = 302;
	if (args.has("status_code")) {
		const statusCodeStr = args.get("status_code");
		if (statusCodeStr) {
			const parsed = parseInt(statusCodeStr, 10);
			if (parsed >= 300 && parsed < 400) {
				statusCode = parsed;
			}
		}
	}

	// Build response manually to set Location header
	// This prevents the framework from "fixing" the URL
	// The URL is set as-is (UTF-8 encoding is handled by the HTTP layer)
	const response = c.newResponse("", {
		status: statusCode as RedirectStatusCode,
		headers: {
			Location: url,
		},
	});

	return response;
}

// GET /redirect-to
redirects.get("/redirect-to", handleRedirectTo);

// POST /redirect-to
redirects.post("/redirect-to", handleRedirectTo);

// PUT /redirect-to
redirects.put("/redirect-to", handleRedirectTo);

// DELETE /redirect-to
redirects.delete("/redirect-to", handleRedirectTo);

// PATCH /redirect-to
redirects.patch("/redirect-to", handleRedirectTo);

// TRACE /redirect-to
redirects.on("TRACE", "/redirect-to", handleRedirectTo);
