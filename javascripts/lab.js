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

    function updateLabel(input) {
        if (input.type === "range") {
            document.querySelector("label[for=" + input.id +"]").querySelector("span").textContent = input.value;
        }
    };

    function onInputChange(e) {
        updateLabel(e.target);
    };

    function drawFFT() {
        drawVisual = requestAnimationFrame(drawFFT);
        analyser.getFloatFrequencyData(fftBuffer);
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        var scale = canvas.height/(analyser.maxDecibels - analyser.minDecibels);
        for (var i = 0; i < analyser.frequencyBinCount; i++) {
            var magnitude = (fftBuffer[i] - analyser.minDecibels) * scale;
            canvasCtx.fillRect(i * 4, canvas.height, 3, -magnitude);
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
        analyser.fftSize = 256;
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
                input.addEventListener('input', onInputChange, false);
                updateLabel(input);
            } else {
                for (var nestedK in input) {
                    var nestedInput = input[nestedK];
                    nestedInput.addEventListener('input', onInputChange, false);
                    updateLabel(nestedInput);
                }
            }
        }
    };

    document.addEventListener("DOMContentLoaded", onDOMLoad);
})();
