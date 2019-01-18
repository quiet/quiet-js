import { SAMPLE_BUFFER_SIZE } from './constants';
import { Decoder, Frame, Samples } from './libQuiet';

const NUM_CONSUME_TIMES = 3;

/**
 * @typedef Receiver
 * @type object
 * @property {function} destroy - Immediately stop sampling microphone and
 * release all resources.
 * @property {function} getAverageDecodeTime - Returns average time in ms spent
 * decoding data from sound samples over the last 3 runs.
 */
export default class Receiver {
    /**
     * Callback used by receiver to notify user of data received via
     * microphone/line-in.
     *
     * @callback onReceive
     * @param {ArrayBuffer} payload - chunk of data received
     */

    /**
     * Callback used by receiver to notify user that a frame was received but
     * failed checksum. Frames that fail checksum are not sent to onReceive.
     *
     * @callback onReceiveFail
     * @param {number} The total number of frames failed across lifetime of
     * receiver.
     */

    /**
     * Callback used by receiver to notify user that new decoder stats were
     * generated. These stats provide instrumentation into the decoding process.
     *
     * @callback onReceiverStatsUpdate
     * @param {ReceiverStats} stats - Array of stats objects, one per frame
     * detected by decoder.
     */

    /**
     * @typedef ReceiverStats
     * @type object
     * @property {Array<Complex>} symbols - Received complex symbols.
     * @property {Number} receivedSignalStrengthIndicator - Strength of received
     * signal in dB.
     * @property {Number} errorVectorMagnitude - Magnitude of error vector
     * between received symbols and reference symbols in dB.
     */

    /**
     * @typedef Complex
     * @type object
     * @property {Number} real - Real valued component.
     * @property {Number} imag - Imaginary valued component
     */

    /**
     * Create a new receiver with the profile specified by profile (should match
     * profile of transmitter).
     *
     * @param {Object} options - Receiver params.
     * @param {Object} options.profile - An object which contains a complete
     * audio profile.
     * @param {onReceive} options.onReceive - Callback which receiver will call
     * to send user received data.
     * @param {onReceiveFail} [options.onReceiveFail] - Callback to notify user
     * that receiver received corrupted data.
     * @param {onReceiverStatsUpdate} [options.onReceiverStatsUpdate] - Callback
     * to notify user with new decode stats.
     */
    constructor(options) {
        const {
            audioStream,
            onReceive,
            onReceiveFail,
            onReceiverStatsUpdate,
            profile,
        } = options;

        this._onReceive = onReceive;
        this._onReceiveFail = onReceiveFail;
        this._onReceiverStatsUpdate = onReceiverStatsUpdate;
        this._onAudioProcess = this._onAudioProcess.bind(this);
        this._consume = this._consume.bind(this);
        this._readBuffer = this._readBuffer.bind(this);

        this._destroyed = false;
        this._lastChecksumFailCount = 0;
        this._lastConsumeTimes = [];

        this._audioCtx
            = new (window.AudioContext || window.webkitAudioContext)();

        this._audioInput = this._audioCtx.createMediaStreamSource(audioStream);
        this._scriptProcessor
            = this._audioCtx.createScriptProcessor(SAMPLE_BUFFER_SIZE, 2, 1);
        this._audioInput.connect(this._scriptProcessor);

        this._decoder = new Decoder(
            profile,
            this._audioCtx.sampleRate,
            !!onReceiverStatsUpdate
        );

        this._samples = new Samples();
        this._frame = new Frame();

        this._scriptProcessor.onaudioprocess = this._onAudioProcess;

        // more unused nodes in the graph that some browsers insist on having
        this._fakeGain = this._audioCtx.createGain();
        this._fakeGain.value = 0;
        this._scriptProcessor.connect(this._fakeGain);
        this._fakeGain.connect(this._audioCtx.destination);
    }

    changeAudioStream(audioStream) {
        this._audioInput.disconnect();

        this._audioInput = this._audioCtx.createMediaStreamSource(audioStream);
        this._audioInput.connect(this._scriptProcessor);
    }

    destroy() {
        if (this._destroyed) {
            return;
        }

        this._audioInput.disconnect();
        this._fakeGain.disconnect();
        this._scriptProcessor.disconnect();

        this._samples.destroy();
        this._frame.destroy();

        this._decoder.destroy;
        this._decoder = null;

        this._destroyed = true;
    }

    getAverageDecodeTime() {
        if (!this._lastConsumeTimes.length) {
            return 0;
        }

        const total = this._lastConsumeTimes.reduce(
            (acc, current) => acc + current, 0);

        return total / this._lastConsumeTimes.length;
    }

    _consume() {
        if (this._destroyed) {
            return;
        }

        const before = new Date();
        this._decoder.consume(this._samples);
        const after = new Date();

        this._lastConsumeTimes.unshift(after - before);

        if (this._lastConsumeTimes.length > NUM_CONSUME_TIMES) {
            this._lastConsumeTimes.pop();
        }

        window.setTimeout(this._readBuffer, 0);

        // Check for failures
        const currentChecksumFailCount = this._decoder.getChecksumFails();

        if (this._onReceiveFail
            && (currentChecksumFailCount > this._lastChecksumFailCount)) {
            window.setTimeout(() =>
                this._onReceiveFail(currentChecksumFailCount), 0);
        }
    
        this._lastChecksumFailCount = currentChecksumFailCount;

        // Process stats
        if (this._onReceiverStatsUpdate) {
            const stats = this._decode.getReceiverStats();

            this._onReceiverStatsUpdate(stats);
        }
    }

    _onAudioProcess(e) {
        if (this._destroyed) {
            return;
        }

        const input = e.inputBuffer.getChannelData(0);
        const sample_view = this._samples.createSampleView();
        sample_view.set(input);

        window.setTimeout(() => this._consume(), 0);
    }

    _readBuffer() {
        if (this._destroyed) {
            return;
        }

        // eslint-disable-next-line no-constant-condition
        while (true) {
            const read = this._decoder.readFrame(this._frame);

            if (read === -1) {
                break;
            }

            // Convert from emscripten bytes to js string. More pointer
            // arithmetic.
            const frameArray = this._frame.createFrameArray(read);

            this._onReceive(frameArray.buffer);
        }
    }
}
