/**
 * @module bufferUtils
 */

/**
 * Convert an array buffer in UTF8 to string.
 *
 * @param {ArrayBuffer} arrayBuffer - ArrayBuffer to be converted.
 * @returns {string} The converted string.
 */
export function ab2str(arrayBuffer) {
    const stringified
        = String.fromCharCode.apply(null, new Uint8Array(arrayBuffer));
    const escapedString = escape(stringified);

    return decodeURIComponent(escapedString);
}

/**
 * Merge two ArrayBuffers together. This is a convenience function to assist
 * user receiver functions that want to aggregate multiple payloads.
 *
 * @param {ArrayBuffer} ab1 - Beginning ArrayBuffer.
 * @param {ArrayBuffer} ab2 - Ending ArrayBuffer.
 * @returns {ArrayBuffer} ab1 merged with ab2.
 */
export function mergeab(ab1, ab2) {
    const temp = new Uint8Array(ab1.byteLength + ab2.byteLength);

    temp.set(new Uint8Array(ab1), 0);
    temp.set(new Uint8Array(ab2), ab1.byteLength);

    return temp.buffer;
}

/**
 * Convert a string to array buffer in UTF8.
 *
 * @param {string} s - The string to be converted.
 * @returns {ArrayBuffer} The string convert to an ArrayBuffer.
 */
export function str2ab(s) {
    const utf8String = unescape(encodeURIComponent(s));
    const buf = new ArrayBuffer(utf8String.length);
    const bufView = new Uint8Array(buf);

    for (let i = 0; i < utf8String.length; i++) {
        bufView[i] = utf8String.charCodeAt(i);
    }

    return buf;
}
