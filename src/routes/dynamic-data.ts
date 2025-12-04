import { Hono } from "hono";

import { stringFromBase64URL } from "../utils/base64url";
import { getRequestBodyData } from "../utils/body";
import { getHeaders, getOrigin } from "../utils/headers";
import { getQueryParams } from "../utils/query";

export const dynamicData = new Hono();

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
	const limitedDelay = Math.min(delay, 10);

	await new Promise((resolve) => setTimeout(resolve, limitedDelay * 1000));

	const { data, files, form, json } = await getRequestBodyData(c);

	return c.json({
		args: getQueryParams(c),
		data,
		files,
		form,
		headers: getHeaders(c),
		json,
		origin: getOrigin(c),
		url: c.req.url,
	});
});

// decode_base64
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L1291
dynamicData.get("/base64/:value", (c) => {
	const value = c.req.param("value");

	try {
		const decoded = stringFromBase64URL(value);
		return c.text(decoded);
	} catch {
		return c.text("Incorrect Base64 data try: SFRUUEJJTiBpcyBhd2Vzb21l"); // cspell:disable-line
	}
});

// random_bytes
// Original: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/core.py#L1423
dynamicData.get("/bytes/:n", (c) => {
	const n = parseInt(c.req.param("n"), 10);

	// Original implementation limits to 100KB (100 * 1024 = 102400)
	const maxBytes = 100 * 1024;
	const limitedN = Math.min(n, maxBytes);

	if (Number.isNaN(n) || n < 0) {
		return c.json(
			{ error: "Invalid byte count. Must be a positive integer" },
			400,
		);
	}

	// Support for seed parameter
	const seed = c.req.query("seed");
	if (seed) {
		// Use seed-based random generation if seed is specified
		// Use simple linear congruential generator (similar to original implementation's random.randint)
		const seedNum = parseInt(seed, 10);
		if (!Number.isNaN(seedNum)) {
			// Set seed (simple implementation)
			let randomSeed = seedNum;
			const bytes = new Uint8Array(limitedN);
			for (let i = 0; i < limitedN; i++) {
				// Generate pseudo-random number using linear congruential generator
				randomSeed = (randomSeed * 1103515245 + 12345) & 0x7fffffff;
				bytes[i] = randomSeed % 256;
			}
			return c.body(bytes, 200, { "Content-Type": "application/octet-stream" });
		}
	}

	// Use crypto.getRandomValues if seed is not specified
	// crypto.getRandomValues() only accepts buffers up to 64KB (65536 bytes)
	// For larger buffers, we need to fill in chunks
	const bytes = new Uint8Array(limitedN);
	const maxChunkSize = 65536; // 64KB
	for (let offset = 0; offset < limitedN; offset += maxChunkSize) {
		const chunkSize = Math.min(maxChunkSize, limitedN - offset);
		const chunk = bytes.subarray(offset, offset + chunkSize);
		crypto.getRandomValues(chunk);
	}

	return c.body(bytes, 200, { "Content-Type": "application/octet-stream" });
});
