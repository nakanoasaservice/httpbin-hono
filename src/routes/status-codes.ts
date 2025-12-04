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
	for (const [j, weight] of cumWeights.entries()) {
		if (x <= weight) {
			i = j;
			break;
		}
	}

	// biome-ignore lint/style/noNonNullAssertion: i is not null
	return values[i]!;
}

/**
 * Returns response object of given status code with special handling
 * Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/helpers.py#L207
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

	const m = codeMap[code];
	if (m) {
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
			const parts = choice.split(":") as [string, string];
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

// view_status_code
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L732
statusCodes.all("/status/:codes", (c) => {
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
});
