import { FRAME_BUFFER_SIZE, SAMPLE_BUFFER_SIZE } from '../constants';

import createTranslator from './createTranslator';
import libQuietProvider from './libQuietProvider';

export default class Decoder {
    constructor(profile, sampleRate, enableStats) {
        this._decoder = createTranslator('decoder', profile, sampleRate);

        if (enableStats) {
            libQuietProvider.get()
                .ccall(
                    'quiet_decoder_enable_stats',
                    null,
                    [ 'pointer' ],
                    [ this._decoder ]
                );
        }
    }

    consume(samples) {
        libQuietProvider.get()
            .ccall(
                'quiet_decoder_consume',
                'number',
                [ 'pointer', 'pointer', 'number' ],
                [ this._decoder, samples.getRawSamples(), SAMPLE_BUFFER_SIZE ]
            );
    }

    destroy() {
        libQuietProvider.get()
            .ccall(
                'quiet_decoder_destroy',
                null,
                [ 'pointer' ],
                [ this._decoder ]
            );

        this._decoder = null;
    }

    getChecksumFails() {
        return libQuietProvider.get()
            .ccall(
                'quiet_decoder_checksum_fails',
                'number', 
                [ 'pointer' ],
                [ this._decoder ]
            );
    }

    getReceiverStats() {
        const libQuiet = libQuietProvider.get();
        const numFramesPtr = libQuiet.ccall(
            'malloc',
            'pointer',
            [ 'number' ],
            [ 4 ]
        );
        const frames = libQuiet.ccall(
            'quiet_decoder_consume_stats',
            'pointer',
            [ 'pointer', 'pointer' ],
            [ this._decoder, numFramesPtr ]
        );

        // time for some more pointer arithmetic
        const numFrame = libQuiet.HEAPU32[numFramesPtr / 4];

        libQuiet.ccall(
            'free',
            null,
            [ 'pointer' ],
            [ numFramesPtr ]
        );

        // Why these numbers?
        const framesize = 4 + 4 + 4 + 4 + 4;
        const stats = [];

        for (let i = 0; i < numFrame; i++) {
            const frame = (frames + i * framesize) / 4;
            const symbols = libQuiet.HEAPU32[frame];
            const numSymbols = libQuiet.HEAPU32[frame + 1];

            const frameStats = {
                errorVectorMagnitude : libQuiet.HEAPF32[frame + 2],
                receivedSignalStrengthIndicator: libQuiet.HEAPF32[frame + 3],
                symbols: []
            };

            for (let j = 0; j < numSymbols; j++) {
                const symbol = (symbols + 8 * j) / 4;

                frameStats.symbols.push({
                    real: libQuiet.HEAPF32[symbol],
                    imag: libQuiet.HEAPF32[symbol + 1]
                });
            }

            stats.push(frameStats);
        }

        libQuiet.ccall(
            'free',
            null,
            [ 'pointer' ],
            [ numFrame ]
        );

        return stats;
    }

    readFrame(frame) {
        return libQuietProvider.get()
            .ccall(
                'quiet_decoder_recv',
                'number',
                [ 'pointer', 'pointer', 'number' ],
                [ this._decoder, frame.getRawFrame(), FRAME_BUFFER_SIZE ]
            );
    }
}
