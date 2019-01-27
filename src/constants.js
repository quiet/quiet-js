/**
 * @module constants
 * @private
 */

export const FRAME_BUFFER_SIZE = Math.pow(2, 14);

/**
 * The number of audio samples we'll write per onaudioprocess call. Must be a
 * power of two. We choose the absolute largest permissible value. We implicitly
 * assume that the browser will play back a written buffer without any gaps.
 */
export const SAMPLE_BUFFER_SIZE = 16384;
