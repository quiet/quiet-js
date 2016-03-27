var QuietLab = (function() {
    var fftAxes;
    var fftCanvas;
    var fftContainer;
    var spectrumBtn;
    var waveformAxes;
    var waveformCanvas;
    var waveformContainer;
    var waveformBtn;
    var constellationAxes;
    var constellationCanvas;
    var constellationContainer;
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
    var shortBlock;
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
    var lastReceived = [];
    var frameIndex = 345345;
    var lastTransmitted = [];
    var clampFrame = true;

    var shortener = function() {
        var ablen = 42;
        var b64len = 58;
        function ab2b64(ab) {
            var data = "";
            var u8 = new Uint8Array(ab);
            for (var i = 0; i < u8.length; i++) {
                data += String.fromCharCode(u8[i]);
            }
            return window.btoa(data);
        };

        function b642ab(b64) {
            var data = window.atob(b64);
            var ab = new ArrayBuffer(ablen);
            var u8 = new Uint8Array(ab);
            for (var i = 0; i < data.length; i++) {
                u8[i] = String.charCodeAt(data[i]);
            }
            return ab;
        };

        function shorten() {
            var ab = new ArrayBuffer(ablen);
            var f32 = new Float32Array(ab, 0, 6);
            f32[0] = inputs['modulation']['center_frequency'].value;
            f32[1] = inputs['modulation']['gain'].value;
            f32[2] = inputs['encoder_filters']['dc_filter_alpha'].value;
            f32[3] = inputs['interpolation']['excess_bandwidth'].value;
            f32[4] = inputs['resampler']['bandwidth'].value;
            f32[5] = inputs['resampler']['attenuation'].value;

            var u16 = new Uint16Array(ab, 24, 1);
            u16[0] = inputs['frame_length'].value;

            var u8 = new Uint8Array(ab, 26, 11);
            u8[0] = inputs['interpolation']['samples_per_symbol'].value;
            u8[1] = inputs['interpolation']['symbol_delay'].value;
            u8[2] = inputs['ofdm']['num_subcarriers'].value;
            u8[3] = inputs['ofdm']['cyclic_prefix_length'].value;
            u8[4] = inputs['ofdm']['taper_length'].value;
            u8[5] = inputs['ofdm']['left_band'].value;
            u8[6] = inputs['ofdm']['right_band'].value;
            u8[7] = inputs['resampler']['delay'].value;
            u8[8] = inputs['resampler']['filter_bank_size'].value;
            u8[9] = clampFrame;

            for (var i = 0; i < mode.length; i++) {
                if (mode[i].checked === true) {
                    u8[10] = i;
                }
            }

            var i8 = new Int8Array(ab, 37, 5);
            i8[0] = inputs['mod_scheme'].selectedIndex;
            i8[1] = inputs['checksum_scheme'].selectedIndex;
            i8[2] = inputs['inner_fec_scheme'].selectedIndex;
            i8[3] = inputs['outer_fec_scheme'].selectedIndex;
            i8[4] = inputs['interpolation']['shape'].selectedIndex;

            return "Q0" + ab2b64(ab);
        };

        function expand(b64) {
            if (b64[0] !== "Q") {
                return;
            }

            if (b64[1] !== "0") {
                return;
            }

            if (b64.length !== b64len) {
                return;
            }

            var ab = b642ab(b64);
        };

        return {
            shorten: shorten,
            expand: expand
        };
    }();

    function canvasWrapper(canvas) {
        var initHeight = canvas.height;
        var initWidth = canvas.width;
        var ctx = canvas.getContext('2d');
        ctx.mozImageSmoothingEnabled = false;
        ctx.webkitImageSmoothingEnabled = false;
        ctx.msImageSmoothingEnabled = false;
        ctx.imageSmoothingEnabled = false;

        function rescale() {
            // our canvas has a CSS width and height and a canvas property width and height
            // the css will lock us to the right size no matter how large we make the canvas
            // we need to be aware of a few things
            // a) are we zoomed? this will change the bounding box dimensions
            //    because of the css styles, we otherwise will not see the bounding box grow
            //    in this case we upscale to ceil() of zoom ratio
            // b) are on a high dpi screen? this will change devicePixelRatio
            //    if we are in this case, we will upscale the canvas by the ratio
            // a and b can apply separately or together
            var rect = canvas.getBoundingClientRect();
            var horizZoom =(rect.right - rect.left)/initWidth;
            var vertZoom = (rect.bottom - rect.top)/initHeight;
            var dpr = window.devicePixelRatio;

            canvas.width = Math.ceil(dpr * horizZoom);
            canvas.height = Math.ceil(dpr * vertZoom);
        };

        return {
            ctx: ctx,
            height: initHeight,
            width: initWidth,
            rescale: rescale
        };
    };

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
            if (input.selectedIndex === -1) {
                input.selectedIndex = input.querySelector("option[selected]").index;
            }
            return input.value;
        } else if (input.type === "number") {
            if (input.value === "") {
                var val = Number(input.getAttribute("value"));
                input.value = val;
                return val;
            }
            return input.value;
        }
    };

    function onModeChange(newMode) {
        if (newMode === "OFDMMode") {
            profile['ofdm'] = {};
            for (var prop in inputs.ofdm) {
                profile.ofdm[prop] = enableInput(inputs.ofdm[prop]);
            }
            profile['mod_scheme'] = enableInput(inputs.mod_scheme);
            constellationContainer.parentNode.classList.remove('hidden');
            fftContainer.parentNode.classList.remove('col-sm-12');
            fftContainer.parentNode.classList.add('col-sm-6');
        } else if (newMode === "ModemMode") {
            for (var prop in inputs.ofdm) {
                disableInput(inputs.ofdm[prop]);
            }
            delete profile['ofdm'];
            profile['mod_scheme'] = enableInput(inputs.mod_scheme);
            constellationContainer.parentNode.classList.remove('hidden');
            fftContainer.parentNode.classList.remove('col-sm-12');
            fftContainer.parentNode.classList.add('col-sm-6');
        } else {
            for (var prop in inputs.ofdm) {
                disableInput(inputs.ofdm[prop]);
            }
            delete profile['ofdm'];
            disableInput(inputs.mod_scheme);
            profile['mod_scheme'] = 'gmsk';
            constellationContainer.parentNode.classList.add('hidden');
            fftContainer.parentNode.classList.remove('col-sm-6');
            fftContainer.parentNode.classList.add('col-sm-12');
        }
    };

    function onModeRadioChange(e) {
        onModeChange(e.target.value);
        updateProfileOutput();
    };

    function onClampFrameChange(e) {
        if (e.target.value === "clamp") {
            clampFrame = true;
        } else {
            clampFrame = false;
        }
        updateProfileOutput();
    };

    function updateProfileOutput() {
        if (transmitter !== undefined) {
            transmitter.destroy();
            frameIndex = 345345;
            lastTransmitted = [];
            transmitter = Quiet.transmitter({profile: profile,
                onEnqueue: onTransmitEnqueue,
                clampFrame: clampFrame
            });
            transmitter.transmit(buildFrame());
        }
        if (receiver !== undefined) {
            receiver.destroy();
            lastReceived = [];
            receiver = Quiet.receiver({profile: profile,
                onReceive: onReceive,
                onCreateFail: onReceiverCreateFail,
                onReceiverStatsUpdate: onReceiverStatsUpdate
            });
            initInstrumentData();
            updateInstruments();
            drawConstellation([]);
        }
        jsonBlock.value = JSON.stringify(profile, null, 2);
        shortBlock.value = shortener.shorten();
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
        var warning = e.target.parentNode.parentNode.querySelector(".alert");
        try {
            updateProfileOutput();
            warning.classList.add('hidden');
        } catch (exc) {
            warning.classList.remove('hidden');
        }
    };

    function nextLFSR(x) {
        return ((((x >>> 31) ^ (x >>> 6) ^ (x >>> 4) ^ (x >>> 2) ^ (x >>> 1) ^ x) & 0x0000001) << 31) | (x >>> 1);
    };

    function bitDistance(a, b) {
        var d = 0;
        var c = a ^ b;
        while (c !== 0) {
            d += c & 1;
            c >>>= 1;
        }
        return d;
    };

    function buildFrame() {
        var frame = new ArrayBuffer(transmitter.frameLength);

        // tag each frame with 4 bytes of lfsr output
        // this will let us find it on rx so that we can compute ber
        var intView = new Uint32Array(frame, 0, 1);
        intView[0] = frameIndex;
        frameIndex = nextLFSR(frameIndex);

        var byteView = new Uint8Array(frame);
        for (var i = 4; i < byteView.length; i++) {
            byteView[i] = Math.floor(Math.random() * 256);
        }

        lastTransmitted.unshift(frame);

        var totalQueueSize = 1 << 16; // TODO: don't "know" this about libquiet
        // we need to keep enough frames around that we can search for this one by
        // the time it's been decoded, after going through all the queues
        // we'll also add a small safety margin
        var keepFrames = Math.ceil((totalQueueSize/transmitter.frameLength) + 15);
        if (lastTransmitted.length > keepFrames) {
            // count packets as lost here. this introduces a little delay before
            // we can display it, but if the packet hasn't been found by the
            // receiver, it's gone
            lastTransmitted.pop();
            instrumentData["packets-lost"]++;
        }

        return frame;
    };

    function onTransmitEnqueue() {
        window.setTimeout(function() {
            if (transmitter !== undefined) {
                transmitter.transmit(buildFrame());
            }
        }, 0);
    };

    function updateInstruments() {
        for (var k in instruments) {
            instruments[k].textContent = instrumentData[k];
        }
    };

    function onReceive(recvPayload) {
        instrumentData["packets-received"]++;
        var info = {};
        info.time = new Date();
        info.size = 8*recvPayload.byteLength;

        // find it in the frames we have sent
        var leastDistance = 33;
        var thresh = 3;
        var closest;
        var rxView = new Uint32Array(recvPayload, 0, 1);
        // go oldest to newest -- try to find our frame
        for (var i = lastTransmitted.length - 1; i >= 0; i--) {
            var txView = new Uint32Array(lastTransmitted[i], 0, 1);
            var dist = bitDistance(rxView[0], txView[0]);
            if (dist > thresh) {
                continue;
            }
            if (dist < leastDistance) {
                leastDistance = dist;
                closest = i;
            }
        }
        if (closest === undefined) {
            // couldn't find it, so just toss it out
            // this will keep this mystery packet from affecting stats
            // if it was supposed to be counted, it will eventually increase
            // packet loss
            return;
        } else {
            var totalDist = 0;
            var rxView = new Uint8Array(recvPayload);
            var txView = new Uint8Array(lastTransmitted[closest]);
            for (var i = 0; i < rxView.length; i++) {
                totalDist += bitDistance(rxView[i], txView[i]);
            }
            info.bitErrors = totalDist;
            lastTransmitted.splice(closest, 1);
        }

        lastReceived.unshift(info);
        if (lastReceived.length > 5) {
            lastReceived.pop();
        }
        var oldest = info;
        var totalsize = 0;
        var totalerrors = 0;
        for (var i = 0; i < lastReceived.length; i++) {
            if (lastReceived[i].time < oldest.time) {
                oldest = lastReceived[i];
            }
            totalsize += info.size;
            totalerrors += info.bitErrors;
        }
        instrumentData["bit-error-ratio"] = (100 * (totalerrors/totalsize)).toFixed(4);

        if (oldest.time === info.time) {
            instrumentData["transfer-rate"] = "---";
        } else {
            totalsize -= oldest.size;
            instrumentData["transfer-rate"] = (1000*(totalsize/(info.time - oldest.time))).toFixed(0);
        }
        updateInstruments();
    };

    function onReceiverCreateFail(reason) {
        console.log("failed to create quiet receiver: " + reason);
        warningbox.classList.remove("hidden");
        warningbox.textContent = "Sorry, it looks like this example is not supported by your browser. Please give permission to use the microphone or try again in Google Chrome or Microsoft Edge."
    };

    function onReceiverStatsUpdate(stats) {
        if (receiver === undefined) {
            return;
        }
        if (stats.length > 0) {
            drawConstellation(stats[0].symbols);
            instrumentData.rssi = stats[0].receivedSignalStrengthIndicator.toFixed(2);
            var evm = stats[0].errorVectorMagnitude;
            if (evm === 0) {
                instrumentData.evm = "---";
            } else {
                instrumentData.evm = evm.toFixed(2);
            }
        }
        instrumentData.avgEncodeTime = (transmitter.getAverageEncodeTime()).toFixed(2);
        instrumentData.avgDecodeTime = (receiver.getAverageDecodeTime()).toFixed(2);
        updateInstruments();
    };

    function onShowWaveform() {
        fftContainer.classList.add("hidden");
        waveformContainer.classList.remove("hidden");
        waveformBtn.classList.add("hidden");
        spectrumBtn.classList.remove("hidden");
    };

    function onShowSpectrum() {
        waveformContainer.classList.add("hidden");
        fftContainer.classList.remove("hidden");
        spectrumBtn.classList.add("hidden");
        waveformBtn.classList.remove("hidden");
    };

    function onLabStart() {
        transmitter = Quiet.transmitter({
            profile: profile,
            onEnqueue: onTransmitEnqueue,
            clampFrame: clampFrame
        });
        transmitter.transmit(buildFrame());
        receiver = Quiet.receiver({profile: profile,
            onReceive: onReceive,
            onCreateFail: onReceiverCreateFail,
            onReceiverStatsUpdate: onReceiverStatsUpdate
        });

        pausedBlock.classList.add("hidden");
        instrumentsBlock.classList.remove("hidden");
        drawAxes();

        if (source === undefined) {
            var gUM = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia);
            gUM.call(navigator, gUMConstraints(), onGUM, onGUMFail);
        } else {
            source.connect(analyser);
            drawFFT();
        }
    };

    function onLabStop() {
        if (transmitter !== undefined) {
            transmitter.destroy();
            transmitter = undefined;
        }
        if (receiver !== undefined) {
            receiver.destroy();
            receiver = undefined;
        }
        if (source !== undefined) {
            source.disconnect();
        }
        instrumentsBlock.classList.add("hidden");
        pausedBlock.classList.remove("hidden");
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

        presets.value = "audible-psk";
        loadPreset("audible-psk");
    };

    function drawAxes() {
        fftAxes.rescale();
        fftAxes.ctx.beginPath();
        var xmargin = fftAxes.width - fftCanvas.width;
        var ymargin = fftAxes.height - fftCanvas.height;
        fftAxes.ctx.moveTo(xmargin, 0);
        fftAxes.ctx.lineTo(xmargin, fftAxes.height - ymargin);
        fftAxes.ctx.lineTo(fftAxes.width, fftAxes.height - ymargin);
        fftAxes.ctx.font = "12px monospace";
        var yscale = fftCanvas.height/(analyser.maxDecibels - analyser.minDecibels);
        for (var i = analyser.minDecibels; i <= analyser.maxDecibels; i += 10) {
            fftAxes.ctx.moveTo(xmargin, fftCanvas.height - ((i - analyser.minDecibels) * yscale));
            fftAxes.ctx.lineTo(xmargin + 4, fftCanvas.height - ((i - analyser.minDecibels) * yscale));
            fftAxes.ctx.strokeText(i, 0, fftCanvas.height - ((i - analyser.minDecibels) * yscale) + 9);
        }
        fftAxes.ctx.strokeText("dB", xmargin + 5, 10);
        var maxFreq = audioCtx.sampleRate/2;
        var xscale = fftCanvas.width/maxFreq;
        for (var i = 0; i < maxFreq; i += 2000) {
            fftAxes.ctx.moveTo(xmargin + (i * xscale), fftCanvas.height - 4);
            fftAxes.ctx.lineTo(xmargin + (i * xscale), fftCanvas.height);
            fftAxes.ctx.strokeText((i/1000).toFixed(0), xmargin + (i * xscale), fftAxes.height - 5);
        }
        fftAxes.ctx.strokeText("kHz", fftAxes.width - 25, fftAxes.height - 25);
        fftAxes.ctx.stroke();

        waveformAxes.rescale();
        waveformAxes.ctx.beginPath();
        var xmargin = waveformAxes.width - waveformCanvas.width;
        var ymargin = waveformAxes.height - waveformCanvas.height;
        waveformAxes.ctx.moveTo(xmargin, 0);
        waveformAxes.ctx.lineTo(xmargin, waveformAxes.height - ymargin);
        waveformAxes.ctx.lineTo(waveformAxes.width, waveformAxes.height - ymargin);
        waveformAxes.ctx.font = "12px monospace";
        var maxTime = analyser.frequencyBinCount/audioCtx.sampleRate * 1000;
        var xscale = waveformCanvas.width/maxTime;
        for (var i = 0; i < maxTime; i += 1) {
            waveformAxes.ctx.moveTo(xmargin + (i * xscale), waveformCanvas.height - 4);
            waveformAxes.ctx.lineTo(xmargin + (i * xscale), waveformCanvas.height);
            waveformAxes.ctx.strokeText(i.toFixed(0), xmargin + (i * xscale), waveformAxes.height - 5);
        }
        waveformAxes.ctx.strokeText("ms", waveformAxes.width - 15, waveformAxes.height - 25);
        waveformAxes.ctx.stroke();

        constellationAxes.rescale();
        constellationAxes.ctx.beginPath();
        constellationAxes.ctx.moveTo(0, constellationAxes.height/2);
        constellationAxes.ctx.lineTo(constellationAxes.width, constellationAxes.height/2);
        constellationAxes.ctx.moveTo(constellationAxes.width/2, 0);
        constellationAxes.ctx.lineTo(constellationAxes.width/2, constellationAxes.height);

        constellationAxes.ctx.moveTo(constellationAxes.width/6, constellationAxes.height/2 - 2);
        constellationAxes.ctx.lineTo(constellationAxes.width/6, constellationAxes.height/2 + 2);
        constellationAxes.ctx.moveTo(constellationAxes.width/3, constellationAxes.height/2 - 2);
        constellationAxes.ctx.lineTo(constellationAxes.width/3, constellationAxes.height/2 + 2);
        constellationAxes.ctx.moveTo(2*constellationAxes.width/3, constellationAxes.height/2 - 2);
        constellationAxes.ctx.lineTo(2*constellationAxes.width/3, constellationAxes.height/2 + 2);
        constellationAxes.ctx.moveTo(5*constellationAxes.width/6, constellationAxes.height/2 - 2);
        constellationAxes.ctx.lineTo(5*constellationAxes.width/6, constellationAxes.height/2 + 2);

        constellationAxes.ctx.moveTo(constellationAxes.width/2 - 2, constellationAxes.height/6);
        constellationAxes.ctx.lineTo(constellationAxes.width/2 + 2, constellationAxes.height/6);
        constellationAxes.ctx.moveTo(constellationAxes.width/2 - 2, constellationAxes.height/3);
        constellationAxes.ctx.lineTo(constellationAxes.width/2 + 2, constellationAxes.height/3);
        constellationAxes.ctx.moveTo(constellationAxes.width/2 - 2, 2*constellationAxes.height/3);
        constellationAxes.ctx.lineTo(constellationAxes.width/2 + 2, 2*constellationAxes.height/3);
        constellationAxes.ctx.moveTo(constellationAxes.width/2 - 2, 5*constellationAxes.height/6);
        constellationAxes.ctx.lineTo(constellationAxes.width/2 + 2, 5*constellationAxes.height/6);

        constellationAxes.ctx.stroke();

        constellationAxes.ctx.font = "12px monospace";
        constellationAxes.ctx.strokeText("-1", constellationAxes.width/6, constellationAxes.height/2 - 4);
        constellationAxes.ctx.strokeText("1", 5*constellationAxes.width/6, constellationAxes.height/2 - 4);
        constellationAxes.ctx.strokeText("-1", constellationAxes.width/2 + 4, constellationAxes.height/6);
        constellationAxes.ctx.strokeText("1", constellationAxes.width/2 + 4, 5*constellationAxes.height/6);
        constellationAxes.ctx.strokeText("I", constellationAxes.width - 8, constellationAxes.height/2 - 4);
        constellationAxes.ctx.strokeText("Q", constellationAxes.width/2 + 4, 8);

    };

    function drawFFT() {
        fftCanvas.rescale();
        drawVisual = requestAnimationFrame(drawFFT);
        analyser.getFloatFrequencyData(fftBuffer);
        fftCanvas.ctx.clearRect(0, 0, fftCanvas.width, fftCanvas.height);
        var scale = fftCanvas.height/(analyser.maxDecibels - analyser.minDecibels);
        for (var i = 0; i < analyser.frequencyBinCount; i++) {
            var magnitude = (fftBuffer[i] - analyser.minDecibels) * scale;
            fftCanvas.ctx.fillRect(i, fftCanvas.height, 1, -magnitude);
        }

        waveformCanvas.rescale();
        analyser.getFloatTimeDomainData(fftBuffer);
        waveformCanvas.ctx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
        var min = -0.2;
        var max = 0.2;
        var scale = waveformCanvas.height/(max - min);
        waveformCanvas.ctx.beginPath();
        waveformCanvas.ctx.moveTo(0, waveformCanvas.height/2);
        for (var i = 0; i < analyser.frequencyBinCount; i++) {
            var magnitude = (max - fftBuffer[i]) * scale;
            waveformCanvas.ctx.lineTo(i, magnitude);
        }
        waveformCanvas.ctx.stroke();
    };

    function drawConstellation(symbols) {
        constellationCanvas.rescale();
        constellationCanvas.ctx.clearRect(0, 0, constellationCanvas.width, constellationCanvas.height);
        var min = -1.5;
        var max = 1.5;
        var yscale = constellationCanvas.height/(max - min);
        var xscale = constellationCanvas.width/(max - min);
        for (var i = 0; i < symbols.length; i++) {
            var x = (symbols[i].real - min) * xscale;
            var y = (max- symbols[i].imag) * yscale;
            constellationCanvas.ctx.beginPath();
            constellationCanvas.ctx.moveTo(x - 2, y - 2);
            constellationCanvas.ctx.lineTo(x + 2, y + 2);
            constellationCanvas.ctx.moveTo(x - 2, y + 2);
            constellationCanvas.ctx.lineTo(x + 2, y - 2);
            constellationCanvas.ctx.stroke();
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
            "packets-lost": 0,
            "rssi": "---",
            "evm": "---",
            "avgEncodeTime": "---",
            "avgDecodeTime": "---",
            "transfer-rate": "---",
            "bit-error-ratio": "---"
        };

    };

    function onDOMLoad() {
        warningbox = document.querySelector("[data-quiet-lab-warning]");

        fftAxes = canvasWrapper(document.querySelector("[data-quiet-lab-fft-axes]"));
        fftCanvas = canvasWrapper(document.querySelector("[data-quiet-lab-fft]"));
        fftContainer = document.querySelector("[data-quiet-lab-fft-container]");
        waveformAxes = canvasWrapper(document.querySelector("[data-quiet-lab-waveform-axes]"));
        waveformCanvas = canvasWrapper(document.querySelector("[data-quiet-lab-waveform]"));
        waveformContainer = document.querySelector("[data-quiet-lab-waveform-container]");
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.35;
        analyser.minDecibels = -90;
        analyser.maxDecibels = -10;
        fftBuffer = new Float32Array(analyser.frequencyBinCount);

        constelletionAxes = canvasWrapper(document.querySelector("[data-quiet-lab-constellation-axes]"));
        constellationCanvas = canvasWrapper(document.querySelector("[data-quiet-lab-constellation]"));
        constellationContainer = document.querySelector("[data-quiet-lab-constellation-container]");

        var modelist = document.querySelectorAll("input[name=mode]");
        for (var i = 0; i < modelist.length; i++) {
            modelist[i].addEventListener('change', onModeRadioChange, false);
            mode[modelist[i].value] = modelist[i];
        }

        var clampFrame = document.querySelector("#clampFrame");
        clampFrame.addEventListener('change', onClampFrameChange, false);

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
                shape: document.querySelector("#interpolationShape"),
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
            "packets-lost": document.querySelector("[data-quiet-lab-packets-lost]"),
            "rssi": document.querySelector("[data-quiet-lab-rssi]"),
            "evm": document.querySelector("[data-quiet-lab-evm]"),
            "avgEncodeTime": document.querySelector("[data-quiet-lab-avg-encode-time]"),
            "avgDecodeTime": document.querySelector("[data-quiet-lab-avg-decode-time]"),
            "transfer-rate": document.querySelector("[data-quiet-lab-transfer-rate]"),
            "bit-error-ratio": document.querySelector("[data-quiet-lab-bit-error-ratio]")
        };

        initInstrumentData();

        startBtn = document.querySelector("[data-quiet-lab-start-button]");

        var stopBtn = document.querySelector("[data-quiet-lab-stop-button]");
        stopBtn.addEventListener('click', onLabStop, false);

        pausedBlock = document.querySelector("[data-quiet-lab-paused]");
        instrumentsBlock = document.querySelector("[data-quiet-lab-instruments]");

        waveformBtn = document.querySelector("[data-quiet-lab-show-waveform]");
        waveformBtn.addEventListener('click', onShowWaveform, false);

        spectrumBtn = document.querySelector("[data-quiet-lab-show-spectrum]");
        spectrumBtn.addEventListener('click', onShowSpectrum, false);

        jsonBlock = document.querySelector("#quiet-profiles-json");
        shortBlock = document.querySelector("#quiet-short-profile");
        updateProfileOutput();

        Quiet.addReadyCallback(onQuietReady, onQuietFail);
    };

    document.addEventListener("DOMContentLoaded", onDOMLoad);
})();
