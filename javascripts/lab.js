var QuietLab = (function() {
    var canvas;
    var canvasCtx;
    var audioCtx;
    var analyser;
    var source;
    var drawVisual;
    var fftBuffer;
    var mode;
    var inputs;
    var inputsIndex = {};
    var profile = {};
    var jsonBlock;
    var presets;
    var presetsObj;

    function disableInput(input) {
        input.setAttribute("disabled", "disabled");
    };

    function enableInput(input) {
        input.removeAttribute("disabled");
    };

    function onModeChange(e) {
        var newMode = e.target.value;
        if (newMode === "OFDMMode") {
            for (var prop in inputs.ofdm) {
                enableInput(inputs.ofdm[prop]);
            }
            enableInput(inputs.mod_scheme);
        } else if (newMode === "ModemMode") {
            for (var prop in inputs.ofdm) {
                disableInput(inputs.ofdm[prop]);
            }
            enableInput(inputs.mod_scheme);
        } else {
            for (var prop in inputs.ofdm) {
                disableInput(inputs.ofdm[prop]);
            }
            disableInput(inputs.mod_scheme);
        }
    };

    function updateProfileOutput() {
        jsonBlock.textContent = JSON.stringify(profile, null, 4);
    };

    function onInputChange(e) {
        var index = inputsIndex[e.target.id].split(".");
        var val = e.target.value;
        if (e.target.type === "number") {
            val = Number(val);
            max = Number(e.target.max);
            min = Number(e.target.min);
            if (val > max) {
                e.target.value = max;
                val = max;
            }
            if (val < min) {
                e.target.value = min;
                val = min;
            }
        }
        if (index.length === 2) {
            profile[index[0]][index[1]] = val;
        } else {
            profile[index[0]] = val;
        }
        updateProfileOutput();
    };

    function loadPreset(preset) {
        profile = profilesObj[preset];
        for (var k in profile) {
            var input = inputs[k];
            if (input instanceof Node) {
                input.value = profile[k];
            } else {
                for (var nestedK in input) {
                    var nestedInput = input[nestedK];
                    nestedInput.value = profile[k][nestedK];
                }
            }
        }
        updateProfileOutput();
    };

    function onLoadPreset(e) {
        loadPreset(presets.value);
    };

    function onProfilesFetch(resp) {
        profilesObj = JSON.parse(resp);

        for (var k in profilesObj) {
            var opt = document.createElement("option");
            opt.textContent = k;
            opt.value = k;
            presets.appendChild(opt);
        }

        presets.value = "audible";
        loadPreset("audible");
    };

    function drawFFT() {
        drawVisual = requestAnimationFrame(drawFFT);
        analyser.getFloatFrequencyData(fftBuffer);
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        var scale = canvas.height/(analyser.maxDecibels - analyser.minDecibels);
        for (var i = 0; i < analyser.frequencyBinCount; i++) {
            var magnitude = (fftBuffer[i] - analyser.minDecibels) * scale;
            canvasCtx.fillRect(i * 2, canvas.height, 1, -magnitude);
        }
    };

    function onGUMFail() {
        console.log("failed to create media stream source");
    };

    function onGUM(stream) {
        source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        drawFFT();
    };

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

    function onDOMLoad() {
        canvas = document.querySelector("[data-quiet-lab-canvas]");
        canvasCtx = canvas.getContext('2d');
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        fftBuffer = new Float32Array(analyser.frequencyBinCount);

        var gUM = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia);
        gUM.call(navigator, gUMConstraints(), onGUM, onGUMFail);

        mode = document.querySelectorAll("input[name=mode]");
        for (var i = 0; i < mode.length; i++) {
            mode[i].addEventListener('change', onModeChange, false);
        }

        inputs = {
            ofdm: {
                num_subcarriers: document.querySelector("#numSubcarriers"),
                cyclic_prefix_length: document.querySelector("#cyclicPrefixLength"),
                taper_length: document.querySelector("#taperLength"),
                left_band: document.querySelector("#leftBand"),
                right_band: document.querySelector("#rightBand")
            },
            mod_scheme: document.querySelector("#modScheme"),
            checksum_cheme: document.querySelector("#checksumScheme"),
            inner_fec_scheme: document.querySelector("#innerFecScheme"),
            outer_fec_scheme: document.querySelector("#outerFecScheme"),
            frame_length: document.querySelector("#frameLength"),
            modulation: {
                center_frequency: document.querySelector("#centerFrequency"),
                gain: document.querySelector("#gain")
            },
            interpolation: {
                samples_per_symbol: document.querySelector("#interpolationSamplesPerSymbol"),
                symbol_delay: document.querySelector("#interpolationSymbolDelay"),
                excess_bandwidth: document.querySelector("#interpolationExcessBandwidth")
            },
            encoder_filters: {
                dc_filter_alpha: document.querySelector("#dcFilterAlpha")
            },
            resampler: {
                delay: document.querySelector("#resamplerDelay"),
                bandwidth: document.querySelector("#resamplerBandwidth"),
                attenuation: document.querySelector("#resamplerAttenuation"),
                filter_bank_size: document.querySelector("#resamplerFilterBankSize")
            }
        };

        for (var k in inputs) {
            var input = inputs[k];
            if (input instanceof Node) {
                if (input.type === "number") {
                    profile[k] = Number(input.value);
                } else {
                    profile[k] = input.value;
                }
                input.addEventListener('change', onInputChange, false);
                inputsIndex[input.id] = k;
            } else {
                profile[k] = {};
                for (var nestedK in input) {
                    var nestedInput = input[nestedK];
                    if (nestedInput.type === "number") {
                        profile[k][nestedK] = Number(nestedInput.value);
                    } else {
                        profile[k][nestedK] = nestedInput.value;
                    }
                    nestedInput.addEventListener('change', onInputChange, false);
                    inputsIndex[nestedInput.id] = k + "." + nestedK;
                }
            }
        }

        presets = document.querySelector("#presets");

        var fetch = new Promise(function(resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.overrideMimeType("application/json");
            xhr.open("GET", "javascripts/quiet-profiles.json", true);
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
            console.log("fetch of quiet-profiles.json failed: " + err);
        });

        var loadPresetBtn = document.querySelector("#loadPreset");
        loadPresetBtn.addEventListener('click', onLoadPreset, false);

        jsonBlock = document.querySelector("#quiet-profiles-json");
        updateProfileOutput();
    };

    document.addEventListener("DOMContentLoaded", onDOMLoad);
})();
