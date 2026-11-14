import { type Context, Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { decodeBase64 } from "../utils/base64";
import { skipPrettyJSON } from "../utils/pretty-json";
import { getQueryParamsCaseInsensitive } from "../utils/query";
import { requestInfo, requestInfoWithBody } from "../utils/request-info";

export const dynamicData = new Hono();

const MAX_BYTES = 100 * 1024;

const sleep = (seconds: number) =>
	new Promise((resolve) => setTimeout(resolve, seconds * 1000));

/**
 * Parse a non-negative integer path/query value, or null
 */
function parseCount(value: string | undefined): number | null {
	return value !== undefined && /^\d+$/.test(value) ? Number(value) : null;
}

/**
 * Returns a function that fills a buffer with random bytes. With a seed the
 * sequence is deterministic (a linear congruential generator), so /bytes and
 * /stream-bytes return the same bytes for the same seed. Not byte-compatible
 * with httpbin, which uses Python's random.seed/randint.
 */
function randomByteSource(seed: number | undefined) {
	if (seed === undefined) {
		// crypto.getRandomValues() only accepts up to 65536 bytes per call
		return (buffer: Uint8Array) => {
			for (let offset = 0; offset < buffer.length; offset += 65536) {
				crypto.getRandomValues(buffer.subarray(offset, offset + 65536));
			}
		};
	}

	let state = seed;
	return (buffer: Uint8Array) => {
		for (let i = 0; i < buffer.length; i++) {
			state = (state * 1103515245 + 12345) & 0x7fffffff;
			buffer[i] = state % 256;
		}
	};
}

/**
 * Read the optional `seed` query param; a non-integer seed is an error
 */
function parseSeed(c: Context): number | undefined | Response {
	const seed = getQueryParamsCaseInsensitive(c)["seed"];
	if (!seed) {
		return undefined;
	}
	const seedNum = Number(seed);
	if (!Number.isInteger(seedNum)) {
		return c.json({ error: "Invalid seed. Must be an integer" }, 400);
	}
	return seedNum;
}

/**
 * A stream of `total` bytes in chunks of `chunkSize`, each chunk produced by
 * `fill(chunk, offset)` after waiting `pauseSeconds(chunkLength)`.
 */
function chunkedStream(
	total: number,
	chunkSize: number,
	fill: (chunk: Uint8Array, offset: number) => void,
	pauseSeconds: (chunkLength: number) => number = () => 0,
): ReadableStream<Uint8Array> {
	let offset = 0;
	return new ReadableStream({
		async pull(controller) {
			if (offset >= total) {
				controller.close();
				return;
			}
			const chunk = new Uint8Array(Math.min(chunkSize, total - offset));
			const pause = pauseSeconds(chunk.length);
			if (pause > 0) {
				await sleep(pause);
			}
			fill(chunk, offset);
			offset += chunk.length;
			controller.enqueue(chunk);
		},
	});
}

/**
 * Status codes a Workers Response with a body can use
 */
function isContentfulStatus(code: number): boolean {
	return (
		Number.isInteger(code) &&
		code >= 200 &&
		code <= 599 &&
		![204, 205, 304].includes(code)
	);
}

// view_uuid
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L317
dynamicData.get("/uuid", (c) => {
	const uuid = crypto.randomUUID();

	return c.json({ uuid });
});

// delay_response
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L1196
dynamicData.all("/delay/:delay", async (c) => {
	const delayParam = c.req.param("delay");
	const delay = parseFloat(delayParam);

	if (Number.isNaN(delay) || delay < 0) {
		return c.json(
			{ error: "Invalid delay. Must be a non-negative number" },
			400,
		);
	}

	// Original implementation limits to 10 seconds if delay exceeds 10 (does not return error)
	await sleep(Math.min(delay, 10));

	return c.json(await requestInfoWithBody(c));
});

// drip
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L1221
dynamicData.get("/drip", async (c) => {
	const args = getQueryParamsCaseInsensitive(c);
	const duration = Number(args["duration"] ?? 2);
	const delay = Number(args["delay"] ?? 0);
	const requestedBytes = Number(args["numbytes"] ?? 10);
	const code = Number(args["code"] ?? 200);

	if (!Number.isFinite(duration) || duration < 0) {
		return c.text("duration must be a non-negative number", 400);
	}
	if (!Number.isFinite(delay) || delay < 0) {
		return c.text("delay must be a non-negative number", 400);
	}
	if (!Number.isInteger(requestedBytes) || requestedBytes <= 0) {
		return c.text("number of bytes must be positive", 400);
	}
	if (!isContentfulStatus(code)) {
		return c.text("Invalid status code", 400);
	}

	// Original implementation limits to 10MB
	const numbytes = Math.min(requestedBytes, 10 * 1024 * 1024);

	if (delay > 0) {
		await sleep(delay);
	}

	// httpbin sleeps duration/numbytes after every byte. Timers that short are
	// wasteful, so bytes are batched into ticks of at least 50ms.
	const pause = duration / numbytes;
	const bytesPerTick =
		pause > 0 ? Math.max(1, Math.ceil(0.05 / pause)) : numbytes;
	let sent = 0;
	const stream = chunkedStream(
		numbytes,
		bytesPerTick,
		(chunk) => chunk.fill(0x2a), // "*"
		(chunkLength) => {
			// The first chunk goes out immediately; each later one waits for the
			// time the previous chunk represents
			const wait = sent === 0 ? 0 : pause * bytesPerTick;
			sent += chunkLength;
			return wait;
		},
	);

	return c.body(
		stream.pipeThrough(new FixedLengthStream(numbytes)),
		code as ContentfulStatusCode,
		{ "Content-Type": "application/octet-stream" },
	);
});

// decode_base64
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L1291
dynamicData.get("/base64/:value", (c) => {
	const value = c.req.param("value");

	try {
		const decoded = decodeBase64(value);
		return c.text(decoded);
	} catch {
		return c.text("Incorrect Base64 data try: SFRUUEJJTiBpcyBhd2Vzb21l"); // cspell:disable-line
	}
});

// random_bytes
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L1423
dynamicData.get("/bytes/:n", (c) => {
	const n = parseCount(c.req.param("n"));
	if (n === null) {
		return c.json(
			{ error: "Invalid byte count. Must be a non-negative integer" },
			400,
		);
	}

	const seed = parseSeed(c);
	if (seed instanceof Response) {
		return seed;
	}

	// Original implementation limits to 100KB
	const bytes = new Uint8Array(Math.min(n, MAX_BYTES));
	randomByteSource(seed)(bytes);

	return c.body(bytes, 200, { "Content-Type": "application/octet-stream" });
});

// stream_random_bytes
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L1454
dynamicData.get("/stream-bytes/:n", (c) => {
	const n = parseCount(c.req.param("n"));
	if (n === null) {
		return c.json(
			{ error: "Invalid byte count. Must be a non-negative integer" },
			400,
		);
	}

	const seed = parseSeed(c);
	if (seed instanceof Response) {
		return seed;
	}

	const chunkSizeParam = getQueryParamsCaseInsensitive(c)["chunk_size"];
	const chunkSize =
		chunkSizeParam === undefined ? 10 * 1024 : parseCount(chunkSizeParam);
	if (chunkSize === null) {
		return c.json(
			{ error: "Invalid chunk_size. Must be a non-negative integer" },
			400,
		);
	}

	const fill = randomByteSource(seed);
	return c.body(
		chunkedStream(Math.min(n, MAX_BYTES), Math.max(1, chunkSize), fill),
		200,
		{ "Content-Type": "application/octet-stream" },
	);
});

// stream_n_messages
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L703
dynamicData.get("/stream/:n", (c) => {
	const n = parseCount(c.req.param("n"));
	if (n === null) {
		return c.json(
			{ error: "Invalid message count. Must be a non-negative integer" },
			400,
		);
	}

	// One JSON object per line, at most 100 lines
	const info = requestInfo(c);
	const encoder = new TextEncoder();
	const total = Math.min(n, 100);
	let id = 0;
	const stream = new ReadableStream<Uint8Array>({
		pull(controller) {
			if (id >= total) {
				controller.close();
				return;
			}
			controller.enqueue(
				encoder.encode(`${JSON.stringify({ ...info, id })}\n`),
			);
			id++;
		},
	});

	return skipPrettyJSON(
		c,
		c.body(stream, 200, { "Content-Type": "application/json" }),
	);
});

/**
 * Parse a Range header the way httpbin does: "bytes=first-last", where
 * either side may be omitted
 * Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/helpers.py#L376
 */
function parseRange(
	header: string | undefined,
	size: number,
): [first: number, last: number] {
	let first: number | null = null;
	let last: number | null = null;
	const text = header?.trim();
	if (text?.startsWith("bytes")) {
		const components = text.split("=");
		if (components.length === 2) {
			const [left = "", right = ""] = (components[1] ?? "").split("-");
			const toInt = (s: string) => (/^\s*-?\d+\s*$/.test(s) ? Number(s) : null);
			first = toInt(left);
			last = toInt(right);
		}
	}

	if (first === null && last === null) {
		return [0, size - 1];
	}
	if (first === null) {
		// The last `last` bytes
		return [Math.max(0, size - (last ?? 0)), size - 1];
	}
	return [first, last ?? size - 1];
}

// range_request
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L1498
dynamicData.get("/range/:numbytes", (c) => {
	const numbytes = parseCount(c.req.param("numbytes"));
	const commonHeaders = {
		ETag: `range${numbytes ?? c.req.param("numbytes")}`,
		"Accept-Ranges": "bytes",
	};

	if (numbytes === null || numbytes <= 0 || numbytes > MAX_BYTES) {
		return c.text(
			"number of bytes must be in the range (0, 102400]",
			404,
			commonHeaders,
		);
	}

	const args = getQueryParamsCaseInsensitive(c);
	const chunkSize =
		args["chunk_size"] === undefined
			? 10 * 1024
			: parseCount(args["chunk_size"]);
	const duration = Number(args["duration"] ?? 0);
	if (chunkSize === null || !Number.isFinite(duration) || duration < 0) {
		return c.text("Invalid chunk_size or duration", 400);
	}

	const [first, last] = parseRange(c.req.header("range"), numbytes);
	if (first > last || first < 0 || last >= numbytes) {
		return c.body(null, 416, {
			...commonHeaders,
			"Content-Range": `bytes */${numbytes}`,
			"Content-Length": "0",
		});
	}

	// Predictable content so the resource doesn't change across requests
	const length = last + 1 - first;
	const pausePerByte = duration / numbytes;
	const stream = chunkedStream(
		length,
		Math.max(1, chunkSize),
		(chunk, offset) => {
			for (let i = 0; i < chunk.length; i++) {
				chunk[i] = 0x61 + ((first + offset + i) % 26); // "a" + i % 26
			}
		},
		(chunkLength) => pausePerByte * chunkLength,
	);

	return c.body(
		stream.pipeThrough(new FixedLengthStream(length)),
		first === 0 && last === numbytes - 1 ? 200 : 206,
		{
			...commonHeaders,
			"Content-Type": "application/octet-stream",
			"Content-Range": `bytes ${first}-${last}/${numbytes}`,
		},
	);
});

// link_page
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L1588
dynamicData.get("/links/:n/:offset", (c) => {
	const requested = parseCount(c.req.param("n"));
	const offset = parseCount(c.req.param("offset"));
	if (requested === null || offset === null) {
		return c.json({ error: "Invalid link count or offset" }, 400);
	}

	// Between 1 and 200 links
	const n = Math.min(Math.max(1, requested), 200);
	const links = Array.from({ length: n }, (_, i) =>
		i === offset ? `${i} ` : `<a href='/links/${n}/${i}'>${i}</a> `,
	);

	return c.html(
		`<html><head><title>Links</title></head><body>${links.join("")}</body></html>`,
	);
});

// links
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L1622
dynamicData.get("/links/:n", (c) => {
	const n = parseCount(c.req.param("n"));
	if (n === null) {
		return c.json({ error: "Invalid link count" }, 400);
	}
	return c.redirect(`/links/${n}/0`, 302);
});
