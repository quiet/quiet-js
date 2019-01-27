/**
 * @module Transmitter
 */

import { SAMPLE_BUFFER_SIZE } from './constants';
import { Encoder, Samples } from './libQuiet';

const NUM_EMIT_TIMES = 3;

class Transmitter {
    /**
     * Create a new transmitter configured by the given profile name.
     *
     * @constructor
     * @param {object} options - Transmitter params.
     * @param {boolean} [options.clampFrame] - Prevent frames from overlapping
     * sample blocks.  Web Audio collects sound samples in blocks, and the
     * browser ensures that each block plays out smoothly and atomically.
     * However, it is possible for playback gaps to occur between these blocks
     * due to GC pause or similar conditions. This is especially common on
     * mobile. Enabling this flag ensures that data frames do not overlap these
     * sample blocks so that no playback gaps will occur within a frame, which
     * greatly degrades error performance. Setting this flag to false will
     * increase throughput but can significantly increase error rate. Defaults
     * to false.
     * @param {object} options.profile - An object which contains a single
     * audio profile for encoding and decoding.
     * @param {function} [options.onFinish] - User callback which will notify
     * user when playback of all data in queue is complete. If the user calls
     * transmit multiple times before waiting for onFinish, then onFinish will
     * be called only once after all of the data has been played out.
     * @param {function} [options.onEnqueue] - User callback which will notify
     * user when all data passed to transmit() has been written to the transmit
     * queue and has thus entered the transmit pipeline. For convenience,
     * quiet is designed to hold as much data as you ask it to and write it to
     * the libquiet transmit queue over time. This callback is handy because it
     * informs the user that all data resides in libquiet, which is useful if
     * you would like to stream data to the transmitter. This callback is the
     * appropriate place to stream the next chunk. Doing so will prevent excess
     * memory bloat while maintaining the maximum transmit throughput. If the
     * user calls transmit multiple times before waiting for onEnqueue, then
     * onEnqueue will be called only once after all of the data has been played
     * out.
     */
    constructor(options) {
        const {
            clampFrame,
            onEnqueue,
            onFinish,
            profile
        } = options;
        this._onAudioProcess = this._onAudioProcess.bind(this);
        this._writebuf = this._writebuf.bind(this);
        this._audioCtx
            = new (window.AudioContext || window.webkitAudioContext)();
        this._done = onFinish;
        this._onEnqueue = onEnqueue;

        this._encoder = new Encoder(profile, this._audioCtx.sampleRate);
        this._frameLen = this._encoder.createFrameLength(clampFrame);
        this._samples = new Samples();
        this._sample_view = this._samples.createSampleView();

        this._dummy_osc;

        /**
         * Flag to denote if this transmitter instance has been cleaned up.
         * Prevent races with callbacks on destroyed in-flight objects.
         *
         * @member {boolean}
         * @private
         */
        this._destroyed = false;

        /**
         * Unfortunately, we need to flush out the browser's sound sample buffer
         * ourselves. The way we do this is by writing empty blocks once we're
         * done and *then* we can disconnect.
         *
         * @member {number}
         * @private
         */
        this._emptiesWritten = 0;

        /**
         * Measure some stats about encoding time for user.
         *
         * @member {Array<number>}
         * @private
         */

        this._lastEmitTimes = [];
        /**
         * A list of ArrayBuffers, each one frame or smaller in length.
         *
         * @member {Array<ArrayBuffer>}
         * @private
         */
        this._payload = [];

        /**
         * This flag will prevent us from throwing away a buffer or playing a
         * buffer twice. We are only going to keep one chunk of samples around.
         * Ideally there will be a 1:1 sequence between writebuf and
         * onaudioprocess. Just in case one gets ahead of the other, this flag
         * will prevent us from throwing away a buffer or playing a buffer
         * twice.
         *
         * @member {boolean}
         * @private
         */
        this._played = true;

        /**
         * Flag to denote if the internal emscripten transmitter is available
         * for sending messages. We'll start and stop transmitter as needed. If
         * we have something to send, start it. If we are done talking, stop it.
         *
         * @member {boolean}
         * @private
         */
        this._running = false;

        this._transmitter;
    }

    destroy() {
        if (this._destroyed) {
            return;
        }

        this._samples.destroy();
        this._encoder.destroy();

        if (this._running === true) {
            this.stopTransmitter();
        }

        this._destroyed = true;
    }

    getAverageEncodeTime() {
        if (!this._lastEmitTimes.length) {
            return 0;
        }

        const total = this._lastEmitTimes.reduce(
            (acc, current) => acc + current, 0);

        return total / this._lastEmitTimes.length;
    }

    getFrameLength() {
        return this._frameLen;
    }

    /**
     * Initializes the internal transmitter so messages can be sent.
     *
     * @returns {void}
     */
    startTransmitter() {
        if (this._destroyed) {
            return;
        }

        if (!this._transmitter) {
            // We have to start transmitter here because mobile safari wants it
            // to be in response to a user action.
            const script_processor = this._audioCtx.createScriptProcessor
                || this._audioCtx.createJavaScriptNode;

            // We want a single input because some implementations will not run
            // a node without some kind of source. We want two outputs so that
            // we can explicitly silence the right channel and no mixing will
            // occur.
            this._transmitter = script_processor.call(
                this._audioCtx,
                SAMPLE_BUFFER_SIZE,
                1,
                2
            );

            this._transmitter.onaudioprocess = this._onAudioProcess;

            // Put an input node on the graph. Some browsers require this to run
            // our script processor. This oscillator will not actually be used
            // in any way.
            this._dummy_osc = this._audioCtx.createOscillator();
            this._dummy_osc.type = 'square';
            this._dummy_osc.frequency.value = 420;
        }

        this._dummy_osc.connect(this._transmitter);
        this._transmitter.connect(this._audioCtx.destination);

        this._running = true;
    }

    /**
     * Stops the internal transmitter from being any to send messages until
     * start is called again.
     *
     * @returns {void}
     */
    stopTransmitter() {
        if (this._destroyed) {
            return;
        }

        this._dummy_osc.disconnect();
        this._transmitter.disconnect();

        this._running = false;
    }

    /**
     * Method for user to provide data to a Quiet transmitter
     *
     * @param {ArrayBuffer} buf - Bytes which will be encoded and sent to
     * speaker.
     * @returns {void}
     */
    transmit(buf) {
        if (this._destroyed) {
            return;
        }
    
        // Slice up into frames and push the frames to a list.
        for (let i = 0; i < buf.byteLength; ) {
            const frame = buf.slice(i, i + this._frameLen);
    
            i += frame.byteLength;
            this._payload.push(frame);
        }

        // Now do an update. This may or may not write samples.
        this._writebuf();
    }

    _onAudioProcess(e) {
        const output = e.outputBuffer.getChannelData(0);

        if (this._played === true) {
            // we've already played what's in sample_view, and it hasn't been
            //   rewritten for whatever reason, so just play out silence
            for (let i = 0; i < SAMPLE_BUFFER_SIZE; i++) {
                output[i] = 0;
            }

            return;
        }

        this._played = true;

        output.set(this._sample_view);
        window.setTimeout(this._writebuf, 0);
    }

    /**
     * writebuf calls _send and _emit on the encoder. First we push as much
     * payload as will fit into encoder's tx queue, then we create the next
     * sample block (if this._played === true).
     *
     * @private
     * @returns {void}
     */
    _writebuf() {
        if (this._destroyed) {
            return;
        }

        // Fill as much of quiet's transmit queue as possible.
        let frameAvailable = false;
        let frameWritten = false;

        // eslint-disable-next-line no-constant-condition
        while (true) {
            const frame = this._payload.shift();

            if (frame === undefined) {
                break;
            }

            frameAvailable = true;

            const written = this._encoder.send(frame);

            if (written === -1) {
                this._payload.unshift(frame);
                break;
            }

            frameWritten = true;
        }

        if (frameWritten && !this._payload.length && this._onEnqueue) {
            // We wrote at least one frame and emptied out payload, our local
            // (js) tx queue. This means we have transitioned to having all data 
            // in libquiet. Notify user about this if they like. This is an
            // important transition point because it allows user to control
            // memory utilization without sacrificing throughput as would be the
            // case for waiting for onFinish, which is only called after
            // everything has flushed.
            window.setTimeout(this._onEnqueue, 0);
        }

        if (frameAvailable && !this._running) {
            this.startTransmitter();
        }

        // Now set the sample block.
        if (!this._played) {
            // The existing sample block has yet to be played. We are done.
            return;
        }

        const before = new Date();
        const written = this._encoder.emit(this._samples);
        const after = new Date();

        this._lastEmitTimes.unshift(after - before);
        if (this._lastEmitTimes.length > NUM_EMIT_TIMES) {
            this._lastEmitTimes.pop();
        }

        // libquiet notifies us that the payload is finished by returning
        // written < number of samples we asked for.
        if (!frameAvailable && written === -1) {
            if (this._emptiesWritten < 3) {
                // Flush out browser's sound sample buffer before quitting.
                for (let i = 0; i < SAMPLE_BUFFER_SIZE; i++) {
                    this._sample_view[i] = 0;
                }

                this._emptiesWritten++;
                this._played = false;

                return;
            }

            // Looks like we are done. User callback.
            if (this._done) {
                this._done();
            }

            if (this._running) {
                this.stopTransmitter();
            }

            return;
        }

        this._played = false;
        this._emptiesWritten = 0;

        // In this case, we are sending data, but the whole block isn't full
        // (we're near the end).
        if (written < SAMPLE_BUFFER_SIZE) {
            // Be extra cautious and 0-fill what's left (we want the end of
            // transmission to be silence, not potentially loud noise).
            for (let i = written; i < SAMPLE_BUFFER_SIZE; i++) {
                this._sample_view[i] = 0;
            }
        }
    }
}

export default Transmitter;
