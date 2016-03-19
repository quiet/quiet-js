var QuietLab = (function() {
    var canvas;
    var canvasCtx;
    var audioCtx;
    var analyser;
    var source;
    var drawVisual;
    var fftBuffer;
    var mode = {};
    var inputs;
    var inputsIndex = {};
    var profile = {};
    var jsonBlock;
    var presets;
    var presetsObj;
    var transmitter;

    function disableInput(input) {
        input.setAttribute("disabled", "disabled");
        if (input.type === "select-one") {
            input.selectedIndex = -1;
        } else if (input.type === "number") {
            input.value = "";
        }
    };

    function enableInput(input) {
        input.removeAttribute("disabled");
        if (input.type === "select-one") {
            input.selectedIndex = input.querySelector("option[selected]").index;
            return input.value;
        } else if (input.type === "number") {
            var val = Number(input.getattribute("value"));
            input.value = val;
            return val;
        }
    };

    function onModeChange(newMode) {
        if (newMode === "OFDMMode") {
            profile['ofdm'] = {};
            for (var prop in inputs.ofdm) {
                profile.ofdm[prop] = enableInput(inputs.ofdm[prop]);
            }
            profile['mod_scheme'] = enableInput(inputs.mod_scheme);
        } else if (newMode === "ModemMode") {
            for (var prop in inputs.ofdm) {
                disableInput(inputs.ofdm[prop]);
            }
            delete profile['ofdm'];
            profile['mod_scheme'] = enableInput(inputs.mod_scheme);
        } else {
            for (var prop in inputs.ofdm) {
                disableInput(inputs.ofdm[prop]);
            }
            delete profile['ofdm'];
            disableInput(inputs.mod_scheme);
            profile['mod_scheme'] = 'gmsk';
        }
    };

    function onModeRadioChange(e) {
        onModeChange(e.target.value);
        updateProfileOutput();
    };

    function updateProfileOutput() {
        jsonBlock.textContent = JSON.stringify(profile, null, 4);
        if (transmitter !== undefined) {
            transmitter.destroy();
            transmitter = Quiet.transmitter({profile: profile, onFinish: onTransmitFinish});
            transmitter.transmit(Quiet.str2ab("foo"));
        }
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

    function onTransmitFinish() {
        window.setTimeout(function() { transmitter.transmit(Quiet.str2ab("foo")); }, 0);
    }

    function onQuietReady() {
        transmitter = Quiet.transmitter({profile: profile, onFinish: onTransmitFinish});
        transmitter.transmit(Quiet.str2ab("foo"));
    };

    function onQuietFail(reason) {
        console.log("quiet failed to initialize: " + reason);
        warningbox.classList.remove("hidden");
        warningbox.textContent = "Sorry, it looks like there was a problem with this example (" + reason + ")";
    };

    function loadPreset(presetname) {
        var preset = profilesObj[presetname];
        if (preset.ofdm !== undefined) {
            mode["OFDMMode"].checked = true;
            onModeChange("OFDMMode");
        } else if (preset.mod_scheme === "gmsk") {
            mode["GMSKMode"].checked = true;
            onModeChange("GMSKMode");
        } else {
            mode["ModemMode"].checked = true;
            onModeChange("ModemMode");
        }
        for (var k in profile) {
            var input = inputs[k];
            if (input instanceof Node) {
                profile[k] = preset[k];  // copy so that we can reload pristine later
                input.value = profile[k];
            } else {
                for (var nestedK in input) {
                    var nestedInput = input[nestedK];
                    profile[k][nestedK] = preset[k][nestedK];
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
            canvasCtx.fillRect(i * 2, canvas.height, 2, -magnitude);
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
        analyser.smoothingTimeConstant = 0.35;
        analyser.minDecibels = -90;
        analyser.maxDecibels = -10;
        fftBuffer = new Float32Array(analyser.frequencyBinCount);

        var gUM = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia);
        gUM.call(navigator, gUMConstraints(), onGUM, onGUMFail);

        var modelist = document.querySelectorAll("input[name=mode]");
        for (var i = 0; i < modelist.length; i++) {
            modelist[i].addEventListener('change', onModeRadioChange, false);
            mode[modelist[i].value] = modelist[i];
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
            checksum_scheme: document.querySelector("#checksumScheme"),
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

        Quiet.addReadyCallback(onQuietReady, onQuietFail);
    };

    document.addEventListener("DOMContentLoaded", onDOMLoad);
})();
