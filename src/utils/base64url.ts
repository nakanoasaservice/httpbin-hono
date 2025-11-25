/**
 * Avoid modifying this file. It's part of
 * https://github.com/supabase-community/base64url-js.  Submit all fixes on
 * that repo!
 */

/**
 * An array of characters that encode 6 bits into a Base64-URL alphabet
 * character.
 */
const TO_BASE64URL =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_".split("");

/**
 * An array of characters that can appear in a Base64-URL encoded string but
 * should be ignored.
 */
const IGNORE_BASE64URL = " \t\n\r=".split("");

/**
 * An array of 128 numbers that map a Base64-URL character to 6 bits, or if -2
 * used to skip the character, or if -1 used to error out.
 */
const FROM_BASE64URL = (() => {
	const charMap: number[] = new Array(128);

	for (let i = 0; i < charMap.length; i += 1) {
		charMap[i] = -1;
	}

	for (const char of IGNORE_BASE64URL) {
		charMap[char.charCodeAt(0)] = -2;
	}

	for (let i = 0; i < TO_BASE64URL.length; i += 1) {
		// biome-ignore lint/style/noNonNullAssertion: for loop is safe
		charMap[TO_BASE64URL[i]!.charCodeAt(0)] = i;
	}

	return charMap;
})();

/**
 * Converts a String char code (extracted using `string.charCodeAt(position)`) to a sequence of Base64-URL characters.
 *
 * @param charCode The char code of the JavaScript string.
 * @param state The Base64 state. Pass an initial value of `{ queue: 0, queuedBits: 0 }`.
 * @param emit A function called with the next byte.
 */
export function byteFromBase64URL(
	charCode: number,
	state: { queue: number; queuedBits: number },
	emit: (byte: number) => void,
) {
	// biome-ignore lint/style/noNonNullAssertion: charCode is within the range of 0-127
	const bits = FROM_BASE64URL[charCode]!;

	if (bits > -1) {
		// valid Base64-URL character
		state.queue = (state.queue << 6) | bits;
		state.queuedBits += 6;

		while (state.queuedBits >= 8) {
			emit((state.queue >> (state.queuedBits - 8)) & 0xff);
			state.queuedBits -= 8;
		}
	} else if (bits === -2) {
		// ignore spaces, tabs, newlines, =
		return;
	} else {
		throw new Error(
			`Invalid Base64-URL character "${String.fromCharCode(charCode)}"`,
		);
	}
}

/**
 * Converts a Base64-URL encoded string into a JavaScript string. It is assumed
 * that the underlying string has been encoded as UTF-8.
 *
 * @param str The Base64-URL encoded string.
 */
export function stringFromBase64URL(str: string) {
	const conv: string[] = [];

	const utf8Emit = (codepoint: number) => {
		conv.push(String.fromCodePoint(codepoint));
	};

	const utf8State = {
		utf8seq: 0,
		codepoint: 0,
	};

	const b64State = { queue: 0, queuedBits: 0 };

	const byteEmit = (byte: number) => {
		stringFromUTF8(byte, utf8State, utf8Emit);
	};

	for (let i = 0; i < str.length; i += 1) {
		byteFromBase64URL(str.charCodeAt(i), b64State, byteEmit);
	}

	return conv.join("");
}

/**
 * Converts a UTF-8 byte to a Unicode codepoint.
 *
 * @param byte  The UTF-8 byte next in the sequence.
 * @param state The shared state between consecutive UTF-8 bytes in the
 *              sequence, an object with the shape `{ utf8seq: 0, codepoint: 0 }`.
 * @param emit  Function which will be called for each codepoint.
 */
export function stringFromUTF8(
	byte: number,
	state: { utf8seq: number; codepoint: number },
	emit: (codepoint: number) => void,
) {
	if (state.utf8seq === 0) {
		if (byte <= 0x7f) {
			emit(byte);
			return;
		}

		// count the number of 1 leading bits until you reach 0
		for (let leadingBit = 1; leadingBit < 6; leadingBit += 1) {
			if (((byte >> (7 - leadingBit)) & 1) === 0) {
				state.utf8seq = leadingBit;
				break;
			}
		}

		if (state.utf8seq === 2) {
			state.codepoint = byte & 31;
		} else if (state.utf8seq === 3) {
			state.codepoint = byte & 15;
		} else if (state.utf8seq === 4) {
			state.codepoint = byte & 7;
		} else {
			throw new Error("Invalid UTF-8 sequence");
		}

		state.utf8seq -= 1;
	} else if (state.utf8seq > 0) {
		if (byte <= 0x7f) {
			throw new Error("Invalid UTF-8 sequence");
		}

		state.codepoint = (state.codepoint << 6) | (byte & 63);
		state.utf8seq -= 1;

		if (state.utf8seq === 0) {
			emit(state.codepoint);
		}
	}
}
