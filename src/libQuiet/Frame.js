import { FRAME_BUFFER_SIZE } from '../constants';

import libQuietProvider from './libQuietProvider';

export default class Frame  {
    constructor() {
        this._frame =  libQuietProvider.get().ccall(
            'malloc',
            'pointer',
            [ 'number' ],
            [ FRAME_BUFFER_SIZE ]
        );
    }

    createFrameArray(read) {
        return libQuietProvider.get()
            .HEAP8.slice(
                this._frame,
                this._frame + read
            );
    }

    destroy() {
        libQuietProvider.get()
            .ccall(
                'free',
                null,
                [ 'pointer' ],
                [ this._frame ]
            );
    }

    getRawFrame() {
        return this._frame;
    }
}
