import { SAMPLE_BUFFER_SIZE } from '../constants';

import libQuietProvider from './libQuietProvider';

export default class Samples {
    constructor(bufferSize = SAMPLE_BUFFER_SIZE) {
        this._bufferSize = bufferSize;

        this._samples = libQuietProvider.get().ccall(
            'malloc',
            'pointer',
            [ 'number' ],
            [ 4 * SAMPLE_BUFFER_SIZE ]
        );
    }

    createSampleView() {
        return libQuietProvider.get()
            .HEAPF32.subarray(
                this._samples / 4,
                (this._samples / 4) + SAMPLE_BUFFER_SIZE
            );
    }

    destroy() {
        libQuietProvider.get()
            .ccall(
                'free',
                null,
                [ 'pointer' ],
                [ this._samples ]
            );

        this._samples = null;
    }

    getBufferSize() {
        return this._bufferSize;
    }

    getRawSamples() {
        return this._samples;
    }
}
