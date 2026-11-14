/**
 * Utility functions for extracting request headers and IP address
 */

import type { Context } from "hono";

/**
 * Get the origin client IP address from request headers.
 * Priority order based on Cloudflare documentation:
 * 1. CF-Connecting-IP (most reliable, single IP address)
 * 2. True-Client-IP (Enterprise plan, equivalent to CF-Connecting-IP)
 * 3. X-Forwarded-For (only if CF-Connecting-IP is not present)
 * 4. X-Real-IP (fallback)
 *
 * Reference: https://developers.cloudflare.com/fundamentals/reference/http-headers/
 */
export function getOrigin(c: Context): string {
	// CF-Connecting-IP is the most reliable source for client IP
	// It contains only one IP address and is set by Cloudflare
	const cfConnectingIp = c.req.header("cf-connecting-ip");
	if (cfConnectingIp) {
		return cfConnectingIp;
	}

	// True-Client-IP is equivalent to CF-Connecting-IP (Enterprise plan only)
	const trueClientIp = c.req.header("true-client-ip");
	if (trueClientIp) {
		return trueClientIp;
	}

	// X-Forwarded-For: If CF-Connecting-IP is not present, X-Forwarded-For
	// should have the same value. However, if X-Forwarded-For already existed,
	// Cloudflare appends proxy IPs, so we take the first value.
	const forwardedFor = c.req.header("x-forwarded-for");
	if (forwardedFor) {
		return forwardedFor.split(",")[0]?.trim() || "unknown";
	}

	// X-Real-IP: Fallback option (mainly for Worker subrequests)
	const realIp = c.req.header("x-real-ip");
	if (realIp) {
		return realIp;
	}

	return "unknown";
}

// Environment headers that should be hidden by default
// Reference: https://github.com/postmanlabs/httpbin/blob/f8ec666b4d1b654e4ff6aedd356f510dcac09f83/httpbin/helpers.py
// Cloudflare headers reference: https://developers.cloudflare.com/fundamentals/reference/http-headers/
const ENV_HEADERS = [
	// Original httpbin environment headers
	"X-Varnish",
	"X-Request-Start",
	"X-Heroku-Queue-Depth",
	"X-Real-Ip",
	"X-Forwarded-Proto",
	"X-Forwarded-Protocol",
	"X-Forwarded-Ssl",
	"X-Heroku-Queue-Wait-Time",
	"X-Forwarded-For",
	"X-Heroku-Dynos-In-Use",
	"X-Forwarded-Port",
	"X-Request-Id",
	"Via",
	"Total-Route-Time",
	"Connect-Time",
	// Cloudflare-specific headers (infrastructure/proxy information)
	"CF-Connecting-IP",
	"CF-IPCountry",
	"CF-Ray",
	"CF-Request-ID",
	"CF-Visitor",
	"CF-EW-Via",
	"True-Client-IP",
	"CF-Worker",
];

export function getHeaders(c: Context): Record<string, string> {
	const headers = c.req.header();

	// Hide environment headers by default (unless show_env query param is present)
	if (!c.req.query("show_env")) {
		for (const envHeader of ENV_HEADERS) {
			delete headers[envHeader.toLowerCase()];
		}
	}

	return headers;
}
