/**
 * Decode Base64 or Base64URL (padding optional) into a UTF-8 string.
 * Throws on invalid Base64 or invalid UTF-8.
 */
export function decodeBase64(value: string): string {
	const base64 = value
		.replace(/[\s=]/g, "")
		.replace(/-/g, "+")
		.replace(/_/g, "/");
	const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));

	return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(
		bytes,
	);
}
