import { SAMPLE_BUFFER_SIZE } from './constants';
import { Encoder, Samples } from './libQuiet';

const NUM_EMIT_TIMES = 3;

/**
 * @typedef Transmitter
 * @property {transmit} transmit - Queue up array buffer and begin transmitting.
 * @property {function} destroy - Immediately stop playback and release all
 * resources.
 * @property {number} frameLength - Length in bytes of each underlying transmit
 * frame. Calls to transmit() will automatically slice passed ArrayBuffer into
 * frames of this length or shorter
 * @property {function} getAverageEncodeTime - Returns average time in ms spent
 * encoding data into sound samples over the last 3 runs.
 */

/**
 * Method for user to provide data to a Quiet transmitter
 *
 * @callback transmit
 * @memberof Transmitter
 * @param {ArrayBuffer} payload - Bytes which will be encoded and sent to
 * speaker.
 */

export default class Transmitter {
    /**
     * Create a new transmitter configured by the given profile name.
     *
     * @param {object} options - Transmitter params.
     * @param {string|object} opts.profile - An object which contains a single
     * profile.
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
     * out
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

        // We'll start and stop transmitter as needed
        //   if we have something to send, start it
        //   if we are done talking, stop it
        this._running = false;
        this._transmitter;

        // prevent races with callbacks on destroyed in-flight objects
        this._destroyed = false;

        // We are only going to keep one chunk of samples around ideally there
        // will be a 1:1 sequence between writebuf and onaudioprocess but just
        // in case one gets ahead of the other, this flag will prevent us from
        // throwing away a buffer or playing a buffer twice.
        this._played = true;

        // Payload is a list of ArrayBuffers, each one frame or smaller in
        // length.
        this._payload = [];

        // Unfortunately, we need to flush out the browser's sound sample buffer
        // ourselves. The way we do this is by writing empty blocks once we're
        // done and *then* we can disconnect.
        this._emptiesWritten = 0;

        // Measure some stats about encoding time for user.
        this._lastEmitTimes = [];
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
            // our script processor this oscillator will not actually be used in
            // any way.
            this._dummy_osc = this._audioCtx.createOscillator();
            this._dummy_osc.type = 'square';
            this._dummy_osc.frequency.value = 420;
        }

        this._dummy_osc.connect(this._transmitter);
        this._transmitter.connect(this._audioCtx.destination);

        this._running = true;
    }

    stopTransmitter() {
        if (this._destroyed) {
            return;
        }

        this._dummy_osc.disconnect();
        this._transmitter.disconnect();

        this._running = false;
    }

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

    // writebuf calls _send and _emit on the encoder. First we push as much
    // payload as will fit into encoder's tx queue, then we create the next
    // sample block (if played = true).
    _writebuf() {
        if (this._destroyed) {
            return;
        }

        // fill as much of quiet's transmit queue as possible
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
