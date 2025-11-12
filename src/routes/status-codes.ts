import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export const statusCodes = new Hono();

// Constants
const REDIRECT_LOCATION = "/redirect/1";
const ACCEPTED_MEDIA_TYPES = [
	"image/webp",
	"image/svg+xml",
	"image/jpeg",
	"image/png",
	"image/*",
];
const ASCII_ART = `    -=[ teapot ]=-

       _...._
     .'  _ _ \`.
    | ."\` ^ \`". _,
    \\_;"\`---"\`|//
      |       ;/
      \\_     _/
        \`"\\"\\"\\"\``;

/**
 * Returns a value from choices chosen by weighted random selection
 * choices should be a list of [value, weight] tuples.
 */
function weightedChoice(choices: Array<[number, number]>): number {
	const values: number[] = [];
	const weights: number[] = [];
	for (const [value, weight] of choices) {
		values.push(value);
		weights.push(weight);
	}

	let total = 0;
	const cumWeights: number[] = [];
	for (const w of weights) {
		total += w;
		cumWeights.push(total);
	}

	const x = Math.random() * total;
	let i = 0;
	for (let j = 0; j < cumWeights.length; j++) {
		if (x <= cumWeights[j]) {
			i = j;
			break;
		}
	}

	return values[i];
}

/**
 * Returns response object of given status code with special handling
 */
function createStatusCodeResponse(code: number): {
	status: ContentfulStatusCode;
	body?: string;
	headers?: Record<string, string>;
} {
	const redirect = {
		headers: { Location: REDIRECT_LOCATION },
	};

	const codeMap: Record<
		number,
		{ data?: string; headers?: Record<string, string> }
	> = {
		301: redirect,
		302: redirect,
		303: redirect,
		304: { data: "" },
		305: redirect,
		307: redirect,
		401: {
			headers: { "WWW-Authenticate": 'Basic realm="Fake Realm"' },
		},
		402: {
			data: "Fuck you, pay me!",
			headers: {
				"x-more-info": "http://vimeo.com/22053820",
			},
		},
		406: {
			data: JSON.stringify({
				message: "Client did not request a supported media type.",
				accept: ACCEPTED_MEDIA_TYPES,
			}),
			headers: {
				"Content-Type": "application/json",
			},
		},
		407: {
			headers: { "Proxy-Authenticate": 'Basic realm="Fake Realm"' },
		},
		418: {
			data: ASCII_ART,
			headers: {
				"x-more-info": "http://tools.ietf.org/html/rfc2324",
			},
		},
	};

	const response: {
		status: ContentfulStatusCode;
		body?: string;
		headers?: Record<string, string>;
	} = {
		status: code as ContentfulStatusCode,
	};

	if (code in codeMap) {
		const m = codeMap[code];
		if (m.data !== undefined) {
			response.body = m.data;
		}
		if (m.headers) {
			response.headers = m.headers;
		}
	}

	return response;
}

/**
 * Return status code or random status code if more than one are given
 */
function handleStatusCodes(codes: string) {
	// Single status code
	if (!codes.includes(",")) {
		const code = parseInt(codes, 10);
		// Check if the entire string is a valid number
		if (Number.isNaN(code) || code.toString() !== codes.trim()) {
			return { error: "Invalid status code", status: 400 };
		}
		return createStatusCodeResponse(code);
	}

	// Multiple status codes with optional weights
	const choices: Array<[number, number]> = [];
	for (const choice of codes.split(",")) {
		let codeStr: string;
		let weight = 1;

		if (choice.includes(":")) {
			const parts = choice.split(":");
			codeStr = parts[0];
			weight = parseFloat(parts[1]);
		} else {
			codeStr = choice;
		}

		const trimmedCodeStr = codeStr.trim();
		const code = parseInt(trimmedCodeStr, 10);
		// Check if the entire string is a valid number
		if (Number.isNaN(code) || code.toString() !== trimmedCodeStr) {
			return { error: "Invalid status code", status: 400 };
		}

		choices.push([code, weight]);
	}

	const selectedCode = weightedChoice(choices);
	return createStatusCodeResponse(selectedCode);
}

/**
 * Common handler for all HTTP methods
 */
function statusCodeHandler(c: {
	req: { param: (key: string) => string };
	text: (
		body: string,
		status?: ContentfulStatusCode,
		headers?: Record<string, string>,
	) => Response;
}) {
	const codes = c.req.param("codes");
	const result = handleStatusCodes(codes);

	if ("error" in result) {
		return c.text(result.error, 400 as ContentfulStatusCode);
	}

	if (result.body !== undefined) {
		if (result.headers) {
			return c.text(result.body, result.status, result.headers);
		}
		return c.text(result.body, result.status);
	}

	if (result.headers) {
		return c.text("", result.status, result.headers);
	}

	return c.text("", result.status);
}

// GET /status/:codes
statusCodes.get("/status/:codes", statusCodeHandler);

// POST /status/:codes
statusCodes.post("/status/:codes", statusCodeHandler);

// PUT /status/:codes
statusCodes.put("/status/:codes", statusCodeHandler);

// DELETE /status/:codes
statusCodes.delete("/status/:codes", statusCodeHandler);

// PATCH /status/:codes
statusCodes.patch("/status/:codes", statusCodeHandler);

// TRACE /status/:codes
statusCodes.on("TRACE", "/status/:codes", statusCodeHandler);
