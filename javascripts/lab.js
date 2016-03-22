var QuietLab = (function() {
    var fftCanvas;
    var fftCanvasCtx;
    var constellationCanvas;
    var constellationCanvasCtx;
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
    var receiver;
    var startBtn;
    var pausedBlock;
    var instrumentsBlock;
    var warningbox;
    var instruments;
    var instrumentData;

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
            var val = Number(input.getAttribute("value"));
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
        if (receiver !== undefined) {
            receiver.destroy();
            receiver = Quiet.receiver({profile: profile,
                onReceive: onReceive,
                onCreateFail: onReceiverCreateFail,
                onReceiverStatsUpdate: onReceiverStatsUpdate
            });
            initInstrumentData();
            updateInstruments();
            drawConstellation([]);
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
    };

    function updateInstruments() {
        for (var k in instruments) {
            instruments[k].textContent = instrumentData[k];
        }
    };

    function onReceive(recvPayload) {
        instrumentData["packets-received"]++;
        updateInstruments();
    };

    function onReceiverCreateFail(reason) {
        console.log("failed to create quiet receiver: " + reason);
        warningbox.classList.remove("hidden");
        warningbox.textContent = "Sorry, it looks like this example is not supported by your browser. Please give permission to use the microphone or try again in Google Chrome or Microsoft Edge."
    };

    function onReceiverStatsUpdate(stats) {
        if (stats.length > 0) {
            drawConstellation(stats[0].symbols);
            instrumentData.rssi = stats[0].receivedSignalStrengthIndicator;
            instrumentData.evm = stats[0].errorVectorMagnitude;
            updateInstruments();
        }
    };

    function onLabStart() {
        transmitter = Quiet.transmitter({profile: profile, onFinish: onTransmitFinish});
        transmitter.transmit(Quiet.str2ab("foo"));
        receiver = Quiet.receiver({profile: profile,
            onReceive: onReceive,
            onCreateFail: onReceiverCreateFail,
            onReceiverStatsUpdate: onReceiverStatsUpdate
        });

        pausedBlock.classList.add("hidden");
        instrumentsBlock.classList.remove("hidden");
        var gUM = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia);
        gUM.call(navigator, gUMConstraints(), onGUM, onGUMFail);

    };

    function onQuietReady() {
        startBtn.addEventListener('click', onLabStart, false);
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
        fftCanvasCtx.clearRect(0, 0, fftCanvas.width, fftCanvas.height);
        var scale = fftCanvas.height/(analyser.maxDecibels - analyser.minDecibels);
        for (var i = 0; i < analyser.frequencyBinCount; i++) {
            var magnitude = (fftBuffer[i] - analyser.minDecibels) * scale;
            fftCanvasCtx.fillRect(i, fftCanvas.height, 1, -magnitude);
        }
    };

    function drawConstellation(symbols) {
        constellationCanvasCtx.clearRect(0, 0, constellationCanvas.width, constellationCanvas.height);
        var min = -1.5;
        var max = 1.5;
        var yscale = constellationCanvas.height/(max - min);
        var xscale = constellationCanvas.width/(max - min);
        for (var i = 0; i < symbols.length; i++) {
            var x = (symbols[i].real - min) * xscale;
            var y = (symbols[i].imag - min) * yscale;
            constellationCanvasCtx.beginPath();
            constellationCanvasCtx.moveTo(x - 1, y - 1);
            constellationCanvasCtx.lineTo(x + 1, y + 1);
            constellationCanvasCtx.moveTo(x - 1, y + 1);
            constellationCanvasCtx.lineTo(x + 1, y - 1);
            constellationCanvasCtx.stroke();
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

    function initInstrumentData() {
        instrumentData = {
            "packets-received": 0,
            "rssi": 0,
            "evm": 0
        };

    };

    function onDOMLoad() {
        warningbox = document.querySelector("[data-quiet-lab-warning]");

        fftCanvas = document.querySelector("[data-quiet-lab-fft]");
        fftCanvasCtx = fftCanvas.getContext('2d');
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.35;
        analyser.minDecibels = -90;
        analyser.maxDecibels = -10;
        fftBuffer = new Float32Array(analyser.frequencyBinCount);

        constellationCanvas = document.querySelector("[data-quiet-lab-constellation]");
        constellationCanvasCtx = constellationCanvas.getContext('2d');

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

        instruments = {
            "packets-received": document.querySelector("[data-quiet-lab-packets-received]"),
            "rssi": document.querySelector("[data-quiet-lab-rssi]"),
            "evm": document.querySelector("[data-quiet-lab-evm]")
        };

        initInstrumentData();

        startBtn = document.querySelector("[data-quiet-lab-start-button]");

        pausedBlock = document.querySelector("[data-quiet-lab-paused]");
        instrumentsBlock = document.querySelector("[data-quiet-lab-instruments]");

        jsonBlock = document.querySelector("#quiet-profiles-json");
        updateProfileOutput();

        Quiet.addReadyCallback(onQuietReady, onQuietFail);
    };

    document.addEventListener("DOMContentLoaded", onDOMLoad);
})();
