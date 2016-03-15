var QuietLab = (function() {
    var canvas;
    var canvasCtx;
    var audioCtx;
    var analyser;
    var source;
    var drawVisual;
    var fftBuffer;

    function drawFFT() {
        drawVisual = requestAnimationFrame(drawFFT);
        analyser.getFloatFrequencyData(fftBuffer);
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        var scale = canvas.height/(analyser.maxDecibels - analyser.minDecibels);
        for (var i = 0; i < analyser.frequencyBinCount; i++) {
            var magnitude = (fftBuffer[i] - analyser.minDecibels) * scale;
            canvasCtx.fillRect(i * 4, canvas.height, 3, magnitude);
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
    };

    document.addEventListener("DOMContentLoaded", onDOMLoad);
})();
