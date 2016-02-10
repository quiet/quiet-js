var Transmitter = (function() {
    var bufferSize = 16384;
    var emscriptenInitialized = false;
    var profilesFetched = false;
    var profiles;
    var audio_ctx;
    var readyCallback;

    function isReady() {
        return emscriptenInitialized && profilesFetched;
    }

    function start() {
        audio_ctx = new (window.AudioContext || window.webkitAudioContext)();
        console.log(audio_ctx.sampleRate);
        if (readyCallback !== undefined) {
            readyCallback();
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
        c
        var encoder = Module.ccall('create_encoder', 'pointer', ['pointer'], [opt]);

        return function(payloadStr, done) {
            var payload = allocate(Module.intArrayFromString(payloadStr), 'i8', ALLOC_NORMAL);
            Module.ccall('encoder_set_payload', 'number', ['pointer', 'pointer', 'number'], [encoder, payload, payload.length]);

            var sample_len = bufferSize;
            var samples = Module.ccall('malloc', 'pointer', ['number'], [4 * sample_len]);
            var sample_view = Module.HEAPF32.subarray((samples/4), (samples/4) + sample_len);

            var script_processor = (audio_ctx.createScriptProcessor || audio_ctx.createJavaScriptNode);
            var transmitter = script_processor.call(audio_ctx, sample_len, 1, 2);
            transmitter.onaudioprocess = function(e) {
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
                }
            };
            var dummy_osc = audio_ctx.createOscillator();
            dummy_osc.type = 'square';
            dummy_osc.frequency.value = 420;
            dummy_osc.connect(transmitter);
            transmitter.connect(audio_ctx.destination);
        };
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

    function setReadyCallback(c) {
        if (isReady()) {
            c();
            return
        }
        readyCallback = c;
    }

    return {
        emscriptenInitialized: onEmscriptenInitialized,
        setProfilesPath: setProfilesPath,
        setReadyCallback: setReadyCallback,
        transmitter: newTransmitter
    };
})();

// extend emscripten Module
var Module = {
    onRuntimeInitialized: Transmitter.emscriptenInitialized
};
