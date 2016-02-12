var Quiet = (function() {
    var bufferSize = 16384;
    var emscriptenInitialized = false;
    var profilesFetched = false;
    var profiles;
    var audio_ctx;
    var readyCallbacks = [];

    var gUM;
    var audioInput;
    var audioInputReadyCallbacks = [];

    function isReady() {
        return emscriptenInitialized && profilesFetched;
    }

    function start() {
        audio_ctx = new (window.AudioContext || window.webkitAudioContext)();
        console.log(audio_ctx.sampleRate);
        var len = readyCallbacks.length;
        for (var i = 0; i < len; i++) {
            readyCallbacks[i]();
        }
    };

    function checkInitState() {
        if (isReady()) {
            start();
        }
    };

    function newTransmitter(profilename) {
        var c_profiles = Module.intArrayFromString(profiles);
        var c_profilename = Module.intArrayFromString(profilename);
        var opt = Module.ccall('get_encoder_profile_str', 'pointer', ['array', 'array'], [c_profiles, c_profilename]);
        Module.ccall('encoder_opt_set_sample_rate', 'number', ['pointer', 'number'], [opt, audio_ctx.sampleRate]);
        var encoder = Module.ccall('create_encoder', 'pointer', ['pointer'], [opt]);

        return function(payloadStr, done) {
            var payload = allocate(Module.intArrayFromString(payloadStr), 'i8', ALLOC_NORMAL);
            Module.ccall('encoder_set_payload', 'number', ['pointer', 'pointer', 'number'], [encoder, payload, payloadStr.length]);

            var sample_len = bufferSize;
            var samples = Module.ccall('malloc', 'pointer', ['number'], [4 * sample_len]);
            var sample_view = Module.HEAPF32.subarray((samples/4), (samples/4) + sample_len);

            var script_processor = (audio_ctx.createScriptProcessor || audio_ctx.createJavaScriptNode);
            var transmitter = script_processor.call(audio_ctx, sample_len, 1, 2);
            var finished = false;
            transmitter.onaudioprocess = function(e) {
                if (finished) {
                    transmitter.disconnect();
                    return;
                }
                var output_offset = 0;
                var output_l = e.outputBuffer.getChannelData(0);
                var written = Module.ccall('encode', 'number', ['pointer', 'pointer', 'number'], [encoder, samples, sample_len]);
                output_l.set(sample_view);
                if (written < sample_len) {
                    for (var i = written; i < sample_len; i++) {
                        output_l[i] = 0;
                    }
                    if (done !== undefined) {
                            done();
                    }
                    finished = true;
                }
            };
            var dummy_osc = audio_ctx.createOscillator();
            dummy_osc.type = 'square';
            dummy_osc.frequency.value = 420;
            dummy_osc.connect(transmitter);
            transmitter.connect(audio_ctx.destination);
        };
    };

    function audioInputReady() {
        var len = audioInputReadyCallbacks.length;
        for (var i = 0; i < len; i++) {
            audioInputReadyCallbacks[i]();
        }
    };

    function addAudioInputReadyCallback(c) {
        if (audioInput instanceof MediaStreamAudioSourceNode) {
            c();
            return
        }
        audioInputReadyCallbacks.push(c);
    }

    function createAudioInput() {
        audioInput = 0; // prevent others from trying to create
        gUM.call(navigator, {
                audio: {
                    optional: [
                      {googAutoGainControl: false},
                      {googAutoGainControl2: false},
                      {googEchoCancellation: false},
                      {googEchoCancellation2: false},
                      {googNoiseSuppression: false},
                      {googNoiseSuppression2: false},
                      {googHighpassFilter: false},
                      {googTypingNoiseDetection: false},
                      {googAudioMirroring: false}
                    ]
                }
            }, function(e) {
                audioInput = audio_ctx.createMediaStreamSource(e);
                window.anti_gc = audioInput;
                audioInputReady();
            }, function() {
                console.log("failed to create an audio source");
        });
    };

    function newReceiver(profileName, onReceive) {
        var c_profiles = Module.intArrayFromString(profiles);
        var c_profilename = Module.intArrayFromString(profileName);
        var opt = Module.ccall('get_decoder_profile_str', 'pointer', ['array', 'array'], [c_profiles, c_profilename]);
        if (gUM === undefined) {
            gUM = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia);
        }
        if (audioInput === undefined) {
            createAudioInput()
        }
        // TODO investigate if this still needs to be placed on window.
        // seems this was done to keep it from being collected
        window.recorder = audio_ctx.createScriptProcessor(16384, 2, 1);

        Module.ccall('decoder_opt_set_sample_rate', 'number', ['pointer', 'number'], [opt, audio_ctx.sampleRate]);
        var decoder = Module.ccall('create_decoder', 'pointer', ['pointer'], [opt]);
        var sample_buffer_size = 16384;
        var sample_buffer = Module.ccall('malloc', 'pointer', ['number'], [4 * sample_buffer_size]);
        var data_buffer_size = Math.pow(2, 16);
        var data_buffer = Module.ccall('malloc', 'pointer', ['number'], [data_buffer_size]);
        window.recorder.onaudioprocess = function(e) {
            var input = e.inputBuffer.getChannelData(0);
            var sample_view = Module.HEAPF32.subarray(sample_buffer/4, sample_buffer/4 + sample_buffer_size);
            sample_view.set(input);
            var data_buffered = Module.ccall('decode', 'number', ['pointer', 'pointer', 'number'], [decoder, sample_buffer, sample_buffer_size]);

            if (data_buffered > data_buffer_size) {
                data_buffer = Module.ccall('realloc', 'pointer', ['pointer', 'number'], [data_buffer, data_buffered]);
                data_buffer_size = data_buffered;
            }

            if (data_buffered > 0) {
                Module.ccall('decoder_readbuf', 'number', ['pointer', 'pointer', 'number'], [decoder, data_buffer, data_buffered]);
                var result = Module.HEAP8.subarray(data_buffer, data_buffer + data_buffered)
                var result_str = String.fromCharCode.apply(null, new Uint8Array(result));
                onReceive(result_str);
            }
        }

        addAudioInputReadyCallback(function() {
            audioInput.connect(window.recorder);
        });

        var fakeGain = audio_ctx.createGain();
        fakeGain.value = 0;
        window.recorder.connect(fakeGain);
        fakeGain.connect(audio_ctx.destination);
    };

    function onProfilesFetch(p) {
        profiles = p;
        profilesFetched = true;
        checkInitState();
    };

    function onEmscriptenInitialized() {
        emscriptenInitialized = true;
        checkInitState();
    };

    function setProfilesPath(profilesPath) {
        if (profilesFetched) {
            return;
        }

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
            console.log(err);
        });
    };

    function addReadyCallback(c) {
        if (isReady()) {
            c();
            return
        }
        readyCallbacks.push(c);
    }

    return {
        emscriptenInitialized: onEmscriptenInitialized,
        setProfilesPath: setProfilesPath,
        addReadyCallback: addReadyCallback,
        transmitter: newTransmitter,
        receiver: newReceiver
    };
})();

// extend emscripten Module
var Module = {
    onRuntimeInitialized: Quiet.emscriptenInitialized
};
