import { SAMPLE_BUFFER_SIZE } from '../constants';

import createTranslator from './createTranslator';
import libQuietProvider from './libQuietProvider';

export default class Encoder {
    constructor(profile, sampleRate) {
        this._encoder = createTranslator('encoder', profile, sampleRate);
    }

    createFrameLength(withClamp) {
        const libQuiet = libQuietProvider.get();

        // Enable close_frame which prevents data frames from overlapping
        // multiple sample buffers. This is very convenient if our system is not 
        // fast enough to feed the sound card without any gaps between
        // subsequent buffers due to e.g. gc pause. Inform quiet about our
        // sample buffer size here.
        if (withClamp) {
            return libQuiet.ccall(
                'quiet_encoder_clamp_frame_len',
                'number',
                [ 'pointer', 'number' ],
                [ this._encoder, SAMPLE_BUFFER_SIZE ]
            );
        }

        return libQuiet.ccall(
            'quiet_encoder_get_frame_len',
            'number',
            [ 'pointer' ],
            [ this._encoder ]
        );
    }

    destroy() {
        libQuietProvider.get().ccall(
            'quiet_encoder_destroy',
            null,
            [ 'pointer' ],
            [ this._encoder ]
        );
    }

    emit(samples) {
        return libQuietProvider.get()
            .ccall(
                'quiet_encoder_emit',
                'number',
                [ 'pointer', 'pointer', 'number' ],
                [ this._encoder, samples.getRawSamples(), SAMPLE_BUFFER_SIZE ]
            );
    }

    send(frame) {
        return libQuietProvider.get()
            .ccall(
                'quiet_encoder_send',
                'number',
                [ 'pointer', 'array', 'number' ],
                [ this._encoder, new Uint8Array(frame), frame.byteLength ]
            );
    }
}
