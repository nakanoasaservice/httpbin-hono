import { type Context, Hono } from "hono";
import {
	getHeaders,
	getOrigin,
	getQueryParams,
	getRequestBodyData,
} from "../utils/request";

export const dynamicData = new Hono();

// GET /uuid
dynamicData.get("/uuid", (c) => {
	const uuid = crypto.randomUUID();

	return c.json({
		uuid: uuid,
	});
});

/**
 * Decode URL-safe Base64 string
 * URL-safe Base64 uses '-' and '_' instead of '+' and '/'
 */
function decodeUrlSafeBase64(value: string): string {
	// Convert URL-safe Base64 to standard Base64
	const standardBase64 = value.replace(/-/g, "+").replace(/_/g, "/");

	// Add padding if necessary
	const padding = standardBase64.length % 4;
	const paddedBase64 = padding
		? standardBase64 + "=".repeat(4 - padding)
		: standardBase64;

	return atob(paddedBase64);
}

// GET /base64/:value
dynamicData.get("/base64/:value", (c) => {
	const value = c.req.param("value");

	try {
		const decoded = decodeUrlSafeBase64(value);
		return c.text(decoded);
	} catch {
		return c.text("Incorrect Base64 data try: SFRUUEJJTiBpcyBhd2Vzb21l");
	}
});

// GET /bytes/:n
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
			c.header("Content-Type", "application/octet-stream");
			return c.body(bytes);
		}
	}

	// Use crypto.getRandomValues if seed is not specified
	const bytes = new Uint8Array(limitedN);
	crypto.getRandomValues(bytes);

	c.header("Content-Type", "application/octet-stream");
	return c.body(bytes);
});

// GET /delay/:delay, POST /delay/:delay, PUT /delay/:delay, DELETE /delay/:delay, PATCH /delay/:delay, TRACE /delay/:delay
const delayHandler = async (c: Context) => {
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

	const bodyData = await getRequestBodyData(c);

	return c.json({
		args: getQueryParams(c),
		form: bodyData.form,
		data: bodyData.data,
		files: bodyData.files,
		headers: getHeaders(c),
		origin: getOrigin(c),
		url: c.req.url,
	});
};

dynamicData.get("/delay/:delay", delayHandler);
dynamicData.post("/delay/:delay", delayHandler);
dynamicData.put("/delay/:delay", delayHandler);
dynamicData.delete("/delay/:delay", delayHandler);
dynamicData.patch("/delay/:delay", delayHandler);
dynamicData.on("TRACE", "/delay/:delay", delayHandler);
