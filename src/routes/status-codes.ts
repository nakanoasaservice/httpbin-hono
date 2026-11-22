import { type Context, Hono } from "hono";
import type { ContentfulStatusCode, StatusCode } from "hono/utils/http-status";

export const statusCodes = new Hono();

const REDIRECT = { headers: { Location: "/redirect/1" } };
const ACCEPTED_MEDIA_TYPES = [
	"image/webp",
	"image/svg+xml",
	"image/jpeg",
	"image/png",
	"image/*",
];
const ASCII_ART = `
    -=[ teapot ]=-

       _...._
     .'  _ _ \`.
    | ."\` ^ \`". _,
    \\_;\`"---"\`|//
      |       ;/
      \\_     _/
        \`"""\`
`;

/**
 * Special bodies and headers for some status codes
 * Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/helpers.py#L207
 */
const SPECIAL_RESPONSES: Record<
	number,
	{ body?: string; headers?: Record<string, string> }
> = {
	301: REDIRECT,
	302: REDIRECT,
	303: REDIRECT,
	305: REDIRECT,
	307: REDIRECT,
	401: { headers: { "WWW-Authenticate": 'Basic realm="Fake Realm"' } },
	402: {
		body: "Fuck you, pay me!",
		headers: { "x-more-info": "http://vimeo.com/22053820" },
	},
	406: {
		body: JSON.stringify({
			message: "Client did not request a supported media type.",
			accept: ACCEPTED_MEDIA_TYPES,
		}),
		headers: { "Content-Type": "application/json" },
	},
	407: { headers: { "Proxy-Authenticate": 'Basic realm="Fake Realm"' } },
	418: {
		body: ASCII_ART,
		headers: { "x-more-info": "http://tools.ietf.org/html/rfc2324" },
	},
};

/**
 * Parse "200" or "200:1,201:2,..." into [code, weight] pairs, or null if invalid.
 * The Workers Response constructor only accepts 200-599 (1xx are not sendable).
 */
function parseCodes(codes: string): Array<[number, number]> | null {
	const choices: Array<[number, number]> = [];
	for (const choice of codes.split(",")) {
		const [codeStr = "", weightStr] = choice.split(":");
		const code = Number.parseInt(codeStr.trim(), 10);
		if (code.toString() !== codeStr.trim() || code < 200 || code > 599) {
			return null;
		}
		choices.push([
			code,
			weightStr === undefined ? 1 : Number.parseFloat(weightStr),
		]);
	}
	return choices;
}

/**
 * Pick a code by weighted random selection
 */
function weightedChoice(choices: Array<[number, number]>): number {
	const total = choices.reduce((sum, [, weight]) => sum + weight, 0);
	let x = Math.random() * total;
	for (const [code, weight] of choices) {
		x -= weight;
		if (x <= 0) {
			return code;
		}
	}
	// parseCodes never returns an empty array.
	return choices.at(-1)![0];
}

/**
 * Response for a status code, with httpbin's special body/headers if any.
 * Also used by other routes that answer with httpbin's status_code().
 */
export function statusCodeResponse(c: Context, code: number): Response {
	const { body, headers } = SPECIAL_RESPONSES[code] ?? {};

	return body === undefined
		? c.body(null, code as StatusCode, headers)
		: c.text(body, code as ContentfulStatusCode, headers);
}

// view_status_code
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L732
statusCodes.all("/status/:codes", (c) => {
	const choices = parseCodes(c.req.param("codes"));
	if (!choices) {
		return c.text("Invalid status code", 400);
	}

	return statusCodeResponse(c, weightedChoice(choices));
});
