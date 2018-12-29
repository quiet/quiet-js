/* Copyright 2016, Brian Armstrong
 * quiet.js includes compiled portions from other sources
 *  - liquid DSP, Copyright (c) 2007-2016 Joseph Gaeddert
 *  - libjansson, Copyright (c) 2009-2016 Petri Lehtinen
 *  - emscripten, Copyright (c) 2010-2016 Emscripten authors
 */

/** @namespace */
var Quiet = (function() {
    // sampleBufferSize is the number of audio samples we'll write per onaudioprocess call
    // must be a power of two. we choose the absolute largest permissible value
    // we implicitly assume that the browser will play back a written buffer without any gaps
    var sampleBufferSize = 16384;

    // initialization flags
    var emscriptenInitialized = false;
    var profilesFetched = false;

    // profiles is the string content of quiet-profiles.json
    var profiles;

    // our local instance of window.AudioContext
    var audioCtx;

    // consumer callbacks. these fire once quiet is ready to create transmitter/receiver
    var readyCallbacks = [];
    var readyErrbacks = [];
    var failReason = "";

    // these are used for receiver only
    var gUM;
    var audioInput;
    var audioInputFailedReason = "";
    var audioInputReadyCallbacks = [];
    var audioInputFailedCallbacks = [];
    var frameBufferSize = Math.pow(2, 14);

    // anti-gc
    var receivers = {};
    var receivers_idx = 0;

    // isReady tells us if we can start creating transmitters and receivers
    // we need the emscripten portion to be running and we need our
    // async fetch of the profiles to be completed
    function isReady() {
        return emscriptenInitialized && profilesFetched;
    };

    function isFailed() {
        return failReason !== "";
    };

    // start gets our AudioContext and notifies consumers that quiet can be used
    function start() {
        var len = readyCallbacks.length;
        for (var i = 0; i < len; i++) {
            readyCallbacks[i]();
        }
    };

    function initAudioContext() {
        if (audioCtx === undefined) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            console.log(audioCtx.sampleRate);
        }
    };
    
    function resumeAudioContext() {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    };

    function fail(reason) {
        failReason = reason;
        var len = readyErrbacks.length;
        for (var i = 0; i < len; i++) {
            readyErrbacks[i](reason);
        }
    };

    function checkInitState() {
        if (isReady()) {
            start();
        }
    };

    function onProfilesFetch(p) {
        profiles = p;
        profilesFetched = true;
        checkInitState();
    };

    // this is intended to be called only by emscripten
    function onEmscriptenInitialized() {
        emscriptenInitialized = true;
        checkInitState();
    };

    function setProfilesPrefix(prefix) {
        if (profilesFetched) {
            return;
        }
        if (!prefix.endsWith("/")) {
            prefix += "/";
        }
        var profilesPath = prefix + "quiet-profiles.json";

        var fetch = new Promise(function(resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.overrideMimeType("application/json");
            xhr.open("GET", profilesPath, true);
            xhr.onload = function() {
                if (this.status >= 200 && this.status < 300) {
                    resolve(this.responseText);
                } else {
                    reject(this.statusText);
                }
            };
            xhr.onerror = function() {
                reject(this.statusText);
            };
            xhr.send();
        });

        fetch.then(function(body) {
            onProfilesFetch(body);
        }, function(err) {
            fail("fetch of quiet-profiles.json failed: " + err);
        });
    };

    function setMemoryInitializerPrefix(prefix) {
        Module.memoryInitializerPrefixURL = prefix;
    };

    function setLibfecPrefix(prefix) {
        Module.dynamicLibraries = Module.dynamicLibraries || [];
        Module.dynamicLibraries.push(prefix + "libfec.js");
    };

    /**
     * Callback to notify user that quiet.js failed to initialize
     *
     * @callback onError
     * @memberof Quiet
     * @param {string} reason - error message related to failure
     */

    /**
     * Add a callback to be called when Quiet is ready for use, e.g. when transmitters and receivers can be created.
     * @function addReadyCallback
     * @memberof Quiet
     * @param {function} c - The user function which will be called
     * @param {onError} [onError] - User errback function
     * @example
     * addReadyCallback(function() { console.log("ready!"); });
     */
    function addReadyCallback(c, errback) {
        if (isReady()) {
            c();
            return;
        }
        readyCallbacks.push(c);
        if (errback !== undefined) {
            if (isFailed()) {
                errback(failReason);
                return;
            }
            readyErrbacks.push(errback);
        }
    };

    /**
     * Callback to notify user that quiet.js failed to initialize
     *
     * @callback onError
     * @memberof Quiet
     * @param {string} reason - error message related to failure
     */

    /**
     * Initialize Quiet and set up a callback to be called when Quiet is ready
     * @function init
     * @memberof Quiet
     * @param {object} opts - configuration options
     * @param {string} opts.profilesPrefix - path prefix to quiet-profiles.json
     *   this file configures transmitter and receiver parameters
     * @param {string} opts.memoryInitializerPrefix - path prefix to quiet-emscripten.js.mem
     * @param {string} [opts.libfecPrefix] - path prefix to libfec.js
     * @param {function} [opts.onReady] - Quiet ready callback
     * @param {onError} [opts.onError] - User errback function
     * @example
     * Quiet.init({
     *   profilesPrefix: "/",  // fetches /quiet-profiles.json
     *   memoryInitializerPrefix: "/",  // fetches /quiet-emscripten.js.mem
     *   libfecPrefix: "/",  // fetches /libfec.js
     *   onReady: function() { console.log("quiet is ready"); },
     *   onError: function(reason) { console.log("quiet failed to start: " + reason); }
     * });
     */
    function init(opts) {
        if (opts.profilesPrefix !== undefined) {
            setProfilesPrefix(opts.profilesPrefix);
        }

        if (opts.memoryInitializerPrefix !== undefined) {
            setMemoryInitializerPrefix(opts.memoryInitializerPrefix);
        }

        if (opts.libfecPrefix !== undefined) {
            setLibfecPrefix(opts.libfecPrefix);
        }

        if (opts.onReady !== undefined) {
            if (opts.onError !== undefined) {
                addReadyCallback(opts.onReady, opts.onError);
            } else {
                addReadyCallback(opts.onReady);
            }
        }
    };



    /**
     * Callback for user to provide data to a Quiet transmitter
     * @callback transmit
     * @memberof Quiet
     * @param {ArrayBuffer} payload - bytes which will be encoded and sent to speaker
     * @example
     * transmit(Quiet.str2ab("Hello, World!"));
     */

    /**
     * @typedef Transmitter
     * @type object
     * @property {transmit} transmit - queue up array buffer and begin transmitting
     * @property {function} destroy - immediately stop playback and release all resources
     * @property {Number} frameLength - length in bytes of each underlying transmit frame.
     * calls to transmit() will automatically slice passed arraybuffer into frames of
     * this length or shorter
     * @property {function} getAverageEncodeTime - returns average time in ms spent encoding data
     * into sound samples over the last 3 runs
     * @property {function} getProfile - get the profile object used to create this transmitter
     */

    /**
     * Create a new transmitter configured by the given profile name.
     * @function transmitter
     * @memberof Quiet
     * @param {object} opts - transmitter params
     * @param {string|object} opts.profile - name of profile to use, must be a key in quiet-profiles.json OR an object which contains a single profile
     * @param {function} [opts.onFinish] - user callback which will notify user when playback of all data in queue is complete
     *    if the user calls transmit multiple times before waiting for onFinish, then onFinish will be called only once after
     *    all of the data has been played out
     * @param {function} [opts.onEnqueue] - user callback which will notify user when all data passed
     *   to transmit() has been written to the transmit queue and has thus entered the transmit
     *   pipeline. for convenience, quiet.js is designed to hold as much data as you ask it to and
     *   write it to the libquiet transmit queue over time. this callback is handy because it
     *   informs the user that all data resides in libquiet, which is useful if you would like
     *   to stream data to the transmitter. this callback is the appropriate place to stream the
     *   next chunk. doing so will prevent excess memory bloat while maintaining the maximum
     *   transmit throughput. if the user calls transmit multiple times before waiting for
     *   onEnqueue, then onEnqueue will be called only once after all of the data has been
     *   played out
     * @param {boolean} [clampFrame] - Prevent frames from overlapping sample blocks.
     *   Web Audio collects sound samples in blocks, and the browser ensures that each
     *   block plays out smoothly and atomically. However, it is possible for playback
     *   gaps to occur between these blocks due to GC pause or similar conditions.
     *   This is especially common on mobile. Enabling this flag ensures that data frames do
     *   not overlap these sample blocks so that no playback gaps will occur within a frame,
     *   which greatly degrades error performance. Setting this flag to false will increase
     *   throughput but can significantly increase error rate. Defaults to true.
     * @returns {Transmitter} - Transmitter object
     * @example
     * var tx = transmitter({profile: "robust", onFinish: function () { console.log("transmission complete"); }});
     * tx.transmit(Quiet.str2ab("Hello, World!"));
     */
    function transmitter(opts) {
        var profile = opts.profile;
        var c_profiles, c_profile;
        var profileObj;
        if (typeof profile === 'object') {
            profileObj = profile;
            c_profiles = Module.intArrayFromString(JSON.stringify({"profile": profileObj}));
            c_profile = Module.intArrayFromString("profile");
        } else {
            // get an encoder_options object for our quiet-profiles.json and profile key
            profileObj = JSON.parse(profiles)[profile];
            c_profiles = Module.intArrayFromString(profiles);
            c_profile = Module.intArrayFromString(profile);
        }

        initAudioContext();
        var done = opts.onFinish;

        var opt = Module.ccall('quiet_encoder_profile_str', 'pointer', ['array', 'array'], [c_profiles, c_profile]);

        // libquiet internally works at 44.1kHz but the local sound card
        // may be a different rate. we inform quiet about that here
        var encoder = Module.ccall('quiet_encoder_create', 'pointer', ['pointer', 'number'], [opt, audioCtx.sampleRate]);

        Module.ccall('free', null, ['pointer'], [opt]);

        if (opts.clampFrame === undefined) {
            opts.clampFrame = true;
        }

        var frame_len;
        if (opts.clampFrame) {
            // enable close_frame which prevents data frames from overlapping multiple
            // sample buffers. this is very convenient if our system is not fast enough
            // to feed the sound card without any gaps between subsequent buffers due
            // to e.g. gc pause. inform quiet about our sample buffer size here
            frame_len = Module.ccall('quiet_encoder_clamp_frame_len', 'number', ['pointer', 'number'], [encoder, sampleBufferSize]);
        } else {
            frame_len = Module.ccall('quiet_encoder_get_frame_len', 'number', ['pointer'], [encoder]);
        }
        var samples = Module.ccall('malloc', 'pointer', ['number'], [4 * sampleBufferSize]);

        // yes, this is pointer arithmetic, in javascript :)
        var sample_view = Module.HEAPF32.subarray((samples/4), (samples/4) + sampleBufferSize);

        var dummy_osc;

        // we'll start and stop transmitter as needed
        //   if we have something to send, start it
        //   if we are done talking, stop it
        var running = false;
        var transmitter;

        // prevent races with callbacks on destroyed in-flight objects
        var destroyed = false;

        var onaudioprocess = function(e) {
            var output_l = e.outputBuffer.getChannelData(0);

            if (played === true) {
                // we've already played what's in sample_view, and it hasn't been
                //   rewritten for whatever reason, so just play out silence
                for (var i = 0; i < sampleBufferSize; i++) {
                    output_l[i] = 0;
                }
                return;
            }

            played = true;

            output_l.set(sample_view);
            window.setTimeout(writebuf, 0);
        };

        var startTransmitter = function () {
            resumeAudioContext();
            if (destroyed) {
                return;
            }
            if (transmitter === undefined) {
                // we have to start transmitter here because mobile safari wants it to be in response to a
                // user action
                var script_processor = (audioCtx.createScriptProcessor || audioCtx.createJavaScriptNode);
                // we want a single input because some implementations will not run a node without some kind of source
                // we want two outputs so that we can explicitly silence the right channel and no mixing will occur
                transmitter = script_processor.call(audioCtx, sampleBufferSize, 1, 2);
                transmitter.onaudioprocess = onaudioprocess;
                // put an input node on the graph. some browsers require this to run our script processor
                // this oscillator will not actually be used in any way
                dummy_osc = audioCtx.createOscillator();
                dummy_osc.type = 'square';
                dummy_osc.frequency.value = 420;

            }
            dummy_osc.connect(transmitter);
            transmitter.connect(audioCtx.destination);
            running = true;
        };

        var stopTransmitter = function () {
            if (destroyed) {
                return;
            }
            dummy_osc.disconnect();
            transmitter.disconnect();
            running = false;
        };

        // we are only going to keep one chunk of samples around
        // ideally there will be a 1:1 sequence between writebuf and onaudioprocess
        // but just in case one gets ahead of the other, this flag will prevent us
        // from throwing away a buffer or playing a buffer twice
        var played = true;

        // payload is a list of ArrayBuffers, each one frame or smaller in length
        var payload = [];
        var payloadView = new Uint8Array(payload);

        // unfortunately, we need to flush out the browser's sound sample buffer ourselves
        // the way we do this is by writing empty blocks once we're done and *then* we can disconnect
        var empties_written = 0;

        // measure some stats about encoding time for user
        var last_emit_times = [];
        var num_emit_times = 3;

        // writebuf calls _send and _emit on the encoder
        // first we push as much payload as will fit into encoder's tx queue
        // then we create the next sample block (if played = true)
        var writebuf = function() {
            if (destroyed) {
                return;
            }
            // fill as much of quiet's transmit queue as possible
            var frame_available = false;
            var frame_written = false;
            while(true) {
                var frame = payload.shift();
                if (frame === undefined) {
                    break;
                }
                frame_available = true;
                var written = Module.ccall('quiet_encoder_send', 'number', ['pointer', 'array', 'number'], [encoder, new Uint8Array(frame), frame.byteLength]);
                if (written === -1) {
                    payload.unshift(frame);
                    break;
                }
                frame_written = true;
            }

            if (payload.length === 0 && frame_written === true) {
                // we wrote at least one frame and emptied out payload, our local (js) tx queue
                // this means we have transitioned to having all data in libquiet
                // notify user about this if they like
                // this is an important transition point because it allows user to control
                // memory util without sacrificing throughput as would be the case for waiting
                // for onFinish, which is only called after everything has flushed
                if (opts.onEnqueue !== undefined) {
                    window.setTimeout(opts.onEnqueue, 0);
                }
            }

            if (frame_available === true && running === false) {
                startTransmitter();
            }

            // now set the sample block
            if (played === false) {
                // the existing sample block has yet to be played
                // we are done
                return;
            }

            var before = new Date();
            var written = Module.ccall('quiet_encoder_emit', 'number', ['pointer', 'pointer', 'number'], [encoder, samples, sampleBufferSize]);
            var after = new Date();

            last_emit_times.unshift(after - before);
            if (last_emit_times.length > num_emit_times) {
                last_emit_times.pop();
            }

            // libquiet notifies us that the payload is finished by
            // returning written < number of samples we asked for
            if (frame_available === false && written === -1) {
                if (empties_written < 3) {
                    // flush out browser's sound sample buffer before quitting
                    for (var i = 0; i < sampleBufferSize; i++) {
                        sample_view[i] = 0;
                    }
                    empties_written++;
                    played = false;
                    return;
                }
                // looks like we are done
                // user callback
                if (done !== undefined) {
                        done();
                }
                if (running === true) {
                    stopTransmitter();
                }
                return;
            }

            played = false;
            empties_written = 0;

            // in this case, we are sending data, but the whole block isn't full (we're near the end)
            if (written < sampleBufferSize) {
                // be extra cautious and 0-fill what's left
                //   (we want the end of transmission to be silence, not potentially loud noise)
                for (var i = written; i < sampleBufferSize; i++) {
                    sample_view[i] = 0;
                }
            }

        };

        var transmit = function(buf) {
            if (destroyed) {
                return;
            }
            // slice up into frames and push the frames to a list
            for (var i = 0; i < buf.byteLength; ) {
                var frame = buf.slice(i, i + frame_len);
                i += frame.byteLength;
                payload.push(frame);
            }
            // now do an update. this may or may not write samples
            writebuf();
        };

        var destroy = function() {
            if (destroyed) {
                return;
            }
            Module.ccall('free', null, ['pointer'], [samples]);
            Module.ccall('quiet_encoder_destroy', null, ['pointer'], [encoder]);
            if (running === true) {
                stopTransmitter();
            }
            destroyed = true;
        };

        var getAverageEncodeTime = function() {
            if (last_emit_times.length === 0) {
                return 0;
            }
            var total = 0;
            for (var i = 0; i < last_emit_times.length; i++) {
                total += last_emit_times[i];
            }
            return total/(last_emit_times.length);
        };

        var getProfile = function() {
            return Object.assign({}, profileObj);
        };

        return {
            transmit: transmit,
            destroy: destroy,
            frameLength: frame_len,
            getAverageEncodeTime: getAverageEncodeTime,
            getProfile: getProfile
        };
    };

    // receiver functions

    function audioInputReady() {
        var len = audioInputReadyCallbacks.length;
        for (var i = 0; i < len; i++) {
            audioInputReadyCallbacks[i]();
        }
    };

    function audioInputFailed(reason) {
        audioInputFailedReason = reason;
        var len = audioInputFailedCallbacks.length;
        for (var i = 0; i < len; i++) {
            audioInputFailedCallbacks[i](audioInputFailedReason);
        }
    };

    function addAudioInputReadyCallback(c, errback) {
        if (errback !== undefined) {
            if (audioInputFailedReason !== "") {
                errback(audioInputFailedReason);
                return
            }
            audioInputFailedCallbacks.push(errback);
        }
        if (audioInput instanceof MediaStreamAudioSourceNode) {
            c();
            return
        }
        audioInputReadyCallbacks.push(c);
    }

    function gUMConstraints() {
        if (navigator.webkitGetUserMedia !== undefined) {
            return {
                audio: {
                    optional: [
                      {googAutoGainControl: false},
                      {googAutoGainControl2: false},
                      {echoCancellation: false},
                      {googEchoCancellation: false},
                      {googEchoCancellation2: false},
                      {googDAEchoCancellation: false},
                      {googNoiseSuppression: false},
                      {googNoiseSuppression2: false},
                      {googHighpassFilter: false},
                      {googTypingNoiseDetection: false},
                      {googAudioMirroring: false}
                    ]
                }
            };
        }
        if (navigator.mozGetUserMedia !== undefined) {
            return {
                audio: {
                    echoCancellation: false,
                    mozAutoGainControl: false,
                    mozNoiseSuppression: false
                }
            };

        }
        return {
            audio: {
                echoCancellation: false
            }
        };
    };


    function createAudioInput() {
        audioInput = 0; // prevent others from trying to create
        window.setTimeout(function() {
            gUM.call(navigator, gUMConstraints(),
                function(e) {
                    audioInput = audioCtx.createMediaStreamSource(e);

                    // stash a very permanent reference so this isn't collected
                    window.quiet_receiver_anti_gc = audioInput;

                    audioInputReady();
                }, function(reason) {
                    audioInputFailed(reason.name);
                });
        }, 0);
    };

    /**
     * @typedef Receiver
     * @type object
     * @property {function} destroy - immediately stop sampling microphone and release all resources
     * @property {function} getAverageDecodeTime - returns average time in ms spent decoding data
     * from sound samples over the last 3 runs
     */

    /**
     * @typedef Complex
     * @type object
     * @property {Number} real - real valued component
     * @property {Number} imag - imaginary valued component
     */

    /**
     * @typedef ReceiverStats
     * @type object
     * @property [Array] symbols - received complex symbols
     * @property {Number} receivedSignalStrengthIndicator - strength of received signal, in dB
     * @property {Number} errorVectorMagnitude - magnitude of error vector between received symbols
     *   and reference symbols, in dB
     */

    /**
     * Callback used by receiver to notify user that new decoder stats were
     * generated. These stats provide instrumentation into the decoding process.
     *
     * @callback onReceiverStatsUpdate
     * @memberof Quiet
     * @param {Array} stats - Array of stats objects, one per frame detected by decoder
     */

    /**
     * Callback used by receiver to notify user that a frame was received but
     * failed checksum. Frames that fail checksum are not sent to onReceive.
     *
     * @callback onReceiveFail
     * @memberof Quiet
     * @param {number} total - total number of frames failed across lifetime of receiver
     */

    /**
     * Callback used by receiver to notify user of errors in creating receiver.
     * This is a callback because frequently this will result when the user denies
     * permission to use the mic, which happens long after the call to create
     * the receiver.
     *
     * @callback onReceiverCreateFail
     * @memberof Quiet
     * @param {string} reason - error message related to create fail
     */

    /**
     * Callback used by receiver to notify user of data received via microphone/line-in.
     *
     * @callback onReceive
     * @memberof Quiet
     * @param {ArrayBuffer} payload - chunk of data received
     */

    /**
     * Create a new receiver with the profile specified by profile (should match profile of transmitter).
     * @function receiver
     * @memberof Quiet
     * @param {object} opts - receiver params
     * @param {string|object} opts.profile - name of profile to use, must be a key in quiet-profiles.json OR an object which contains a complete profile
     * @param {onReceive} opts.onReceive - callback which receiver will call to send user received data
     * @param {function} [opts.onCreate] - callback to notify user that receiver has been created and is ready to receive. if the user needs to grant permission to use the microphone, this callback fires after that permission is granted.
     * @param {onReceiverCreateFail} [opts.onCreateFail] - callback to notify user that receiver could not be created
     * @param {onReceiveFail} [opts.onReceiveFail] - callback to notify user that receiver received corrupted data
     * @param {onReceiverStatsUpdate} [opts.onReceiverStatsUpdate] - callback to notify user with new decode stats
     * @returns {Receiver} - Receiver object
     * @example
     * receiver({profile: "robust", onReceive: function(payload) { console.log("received chunk of data: " + Quiet.ab2str(payload)); }});
     */
    function receiver(opts) {
        var profile = opts.profile;
        var c_profiles, c_profile;
        if (typeof profile === 'object') {
            c_profiles = Module.intArrayFromString(JSON.stringify({"profile": profile}));
            c_profile = Module.intArrayFromString("profile");
        } else {
            c_profiles = Module.intArrayFromString(profiles);
            c_profile = Module.intArrayFromString(profile);
        }
        var opt = Module.ccall('quiet_decoder_profile_str', 'pointer', ['array', 'array'], [c_profiles, c_profile]);

        initAudioContext();
        resumeAudioContext();
        // quiet does not create an audio input when it starts
        // getting microphone access requires a permission dialog so only ask for it if we need it
        if (gUM === undefined) {
            gUM = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia);
        }

        if (gUM === undefined) {
            // we couldn't find a suitable getUserMedia, so fail fast
            if (opts.onCreateFail !== undefined) {
                opts.onCreateFail("getUserMedia undefined (mic not supported by browser)");
            }
            return;
        }

        if (audioInput === undefined) {
            createAudioInput()
        }

        // TODO investigate if this still needs to be placed on window.
        // seems this was done to keep it from being collected
        var scriptProcessor = audioCtx.createScriptProcessor(16384, 2, 1);
        var idx = receivers_idx;
        receivers[idx] = scriptProcessor;
        receivers_idx++;

        // inform quiet about our local sound card's sample rate so that it can resample to its internal sample rate
        var decoder = Module.ccall('quiet_decoder_create', 'pointer', ['pointer', 'number'], [opt, audioCtx.sampleRate]);

        Module.ccall('free', null, ['pointer'], [opt]);

        var samples = Module.ccall('malloc', 'pointer', ['number'], [4 * sampleBufferSize]);

        var frame = Module.ccall('malloc', 'pointer', ['number'], [frameBufferSize]);

        if (opts.onReceiverStatsUpdate !== undefined) {
            Module.ccall('quiet_decoder_enable_stats', null, ['pointer'], [decoder]);
        }

        var destroyed = false;

        var readbuf = function() {
            if (destroyed) {
                return;
            }
            while (true) {
                var read = Module.ccall('quiet_decoder_recv', 'number', ['pointer', 'pointer', 'number'], [decoder, frame, frameBufferSize]);
                if (read === -1) {
                    break;
                }
                // convert from emscripten bytes to js string. more pointer arithmetic.
                var frameArray = Module.HEAP8.slice(frame, frame + read);
                opts.onReceive(frameArray.buffer);
            }
        };

        var lastChecksumFailCount = 0;
        var last_consume_times = [];
        var num_consume_times = 3;
        var consume = function() {
            if (destroyed) {
                return;
            }
            var before = new Date();
            Module.ccall('quiet_decoder_consume', 'number', ['pointer', 'pointer', 'number'], [decoder, samples, sampleBufferSize]);
            var after = new Date();

            last_consume_times.unshift(after - before);
            if (last_consume_times.length > num_consume_times) {
                last_consume_times.pop();
            }

            window.setTimeout(readbuf, 0);

            var currentChecksumFailCount = Module.ccall('quiet_decoder_checksum_fails', 'number', ['pointer'], [decoder]);
            if ((opts.onReceiveFail !== undefined) && (currentChecksumFailCount > lastChecksumFailCount)) {
                window.setTimeout(function() { opts.onReceiveFail(currentChecksumFailCount); }, 0);
            }
            lastChecksumFailCount = currentChecksumFailCount;

            if (opts.onReceiverStatsUpdate !== undefined) {
                var num_frames_ptr = Module.ccall('malloc', 'pointer', ['number'], [4]);
                var frames = Module.ccall('quiet_decoder_consume_stats', 'pointer', ['pointer', 'pointer'], [decoder, num_frames_ptr]);
                // time for some more pointer arithmetic
                var num_frames = Module.HEAPU32[num_frames_ptr/4];
                Module.ccall('free', null, ['pointer'], [num_frames_ptr]);

                var framesize = 4 + 4 + 4 + 4 + 4;
                var stats = [];

                for (var i = 0; i < num_frames; i++) {
                    var frameStats = {};
                    var frame = (frames + i*framesize)/4;
                    var symbols = Module.HEAPU32[frame];
                    var num_symbols = Module.HEAPU32[frame + 1];
                    frameStats.errorVectorMagnitude = Module.HEAPF32[frame + 2];
                    frameStats.receivedSignalStrengthIndicator = Module.HEAPF32[frame + 3];

                    frameStats.symbols = [];
                    for (var j = 0; j < num_symbols; j++) {
                        var symbol = (symbols + 8*j)/4;
                        frameStats.symbols.push({
                            real: Module.HEAPF32[symbol],
                            imag: Module.HEAPF32[symbol + 1]
                        });
                    }
                    stats.push(frameStats);
                }
                opts.onReceiverStatsUpdate(stats);
            }
        }

        scriptProcessor.onaudioprocess = function(e) {
            if (destroyed) {
                return;
            }
            var input = e.inputBuffer.getChannelData(0);
            var sample_view = Module.HEAPF32.subarray(samples/4, samples/4 + sampleBufferSize);
            sample_view.set(input);

            window.setTimeout(consume, 0);
        }

        // if this is the first receiver object created, wait for our input node to be created
        addAudioInputReadyCallback(function() {
            audioInput.connect(scriptProcessor);
            if (opts.onCreate !== undefined) {
                window.setTimeout(opts.onCreate, 0);
            }
        }, opts.onCreateFail);

        // more unused nodes in the graph that some browsers insist on having
        var fakeGain = audioCtx.createGain();
        fakeGain.value = 0;
        scriptProcessor.connect(fakeGain);
        fakeGain.connect(audioCtx.destination);

        var destroy = function() {
            if (destroyed) {
                return;
            }
            fakeGain.disconnect();
            scriptProcessor.disconnect();
            Module.ccall('free', null, ['pointer'], [samples]);
            Module.ccall('free', null, ['pointer'], [frame]);
            Module.ccall('quiet_decoder_destroy', null, ['pointer'], [decoder]);
            delete receivers[idx];
            destroyed = true;
        };

        var getAverageDecodeTime = function() {
            if (last_consume_times.length === 0) {
                return 0;
            }
            var total = 0;
            for (var i = 0; i < last_consume_times.length; i++) {
                total += last_consume_times[i];
            }
            return total/(last_consume_times.length);
        };

        return {
            destroy: destroy,
            getAverageDecodeTime: getAverageDecodeTime
        }
    };

    /**
     * Convert a string to array buffer in UTF8
     * @function str2ab
     * @memberof Quiet
     * @param {string} s - string to be converted
     * @returns {ArrayBuffer} buf - converted arraybuffer
     */
    function str2ab(s) {
        var s_utf8 = unescape(encodeURIComponent(s));
        var buf = new ArrayBuffer(s_utf8.length);
        var bufView = new Uint8Array(buf);
        for (var i = 0; i < s_utf8.length; i++) {
            bufView[i] = s_utf8.charCodeAt(i);
        }
        return buf;
    };

    /**
     * Convert an array buffer in UTF8 to string
     * @function ab2str
     * @memberof Quiet
     * @param {ArrayBuffer} ab - array buffer to be converted
     * @returns {string} s - converted string
     */
    function ab2str(ab) {
        return decodeURIComponent(escape(String.fromCharCode.apply(null, new Uint8Array(ab))));
    };

    /**
     * Merge 2 ArrayBuffers
     * This is a convenience function to assist user receiver functions that
     * want to aggregate multiple payloads.
     * @function mergeab
     * @memberof Quiet
     * @param {ArrayBuffer} ab1 - beginning ArrayBuffer
     * @param {ArrayBuffer} ab2 - ending ArrayBuffer
     * @returns {ArrayBuffer} buf - ab1 merged with ab2
     */
    function mergeab(ab1, ab2) {
        var tmp = new Uint8Array(ab1.byteLength + ab2.byteLength);
        tmp.set(new Uint8Array(ab1), 0);
        tmp.set(new Uint8Array(ab2), ab1.byteLength);
        return tmp.buffer;
    };

    /**
     * Disconnect quiet.js from its microphone source
     * This will disconnect quiet.js's microphone fully from all receivers
     * This is useful to cause the browser to stop displaying the microphone icon
     * Browser support is limited for disconnecting a single destination, so this
     * call will disconnect all receivers.
     * It is highly recommended to call this only after destroying any receivers.
     * @function disconnect
     */
    function disconnect() {
        if (audioInput !== undefined) {
            audioInput.disconnect();
            audioInput = undefined;
            delete window.quiet_receiver_anti_gc;
        }
    };

    return {
        emscriptenInitialized: onEmscriptenInitialized,
        addReadyCallback: addReadyCallback,
        init: init,
        transmitter: transmitter,
        receiver: receiver,
        str2ab: str2ab,
        ab2str: ab2str,
        mergeab: mergeab,
        disconnect: disconnect
    };
})();

// extend emscripten Module
var Module = {
    onRuntimeInitialized: Quiet.emscriptenInitialized,
    memoryInitializerPrefixURL: ""
};
