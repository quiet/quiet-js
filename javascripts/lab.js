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
    var stopGraphsBtn;
    var runGraphsBtn;
    var audioCtx;
    var analyser;
    var source;
    var drawVisual;
    var fftBuffer;
    var timeBuffer;
    var mode = {};
    var inputs;
    var inputsIndex = {};
    var profile = {};
    var jsonBlock;
    var loadJSONBtn;
    var shortBlockLink;
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
    var clampFrame = false;
    var stopped = false;

    var shortener = function() {
        var ablen = 42;
        var b64len = 58;
        function ab2b64(ab) {
            var data = "";
            var u8 = new Uint8Array(ab);
            for (var i = 0; i < u8.length; i++) {
                data += String.fromCharCode(u8[i]);
            }
            return "Q0" + window.btoa(data);
        };

        function b642ab(b64) {
            if (b64[0] !== "Q") {
                return undefined;
            }

            if (b64[1] !== "0") {
                return undefined;
            }

            if (b64.length !== b64len) {
                return undefined;
            }

            var b64payload = b64.slice(2);
            var data = window.atob(b64payload);
            var ab = new ArrayBuffer(ablen);
            var u8 = new Uint8Array(ab);
            for (var i = 0; i < data.length; i++) {
                u8[i] = data.charCodeAt(i);
            }
            return ab;
        };

        function serializeFloat(f) {
            return f * 10000;
        };

        function deserializeFloat(f) {
            return f / 10000;
        };

        function updateAllInputs() {
            for (var k in inputs) {
                var input = inputs[k];
                if (input instanceof Node) {
                    if (input.getAttribute("disabled") !== "disabled") {
                        updateInput(input);
                    }
                } else {
                    for (var nestedK in input) {
                        if (input[nestedK].getAttribute("disabled") !== "disabled") {
                            updateInput(input[nestedK]);
                        }
                    }
                }
            }
        };

        function shorten() {
            var ab = new ArrayBuffer(ablen);
            var f32 = new Float32Array(ab, 0, 6);
            f32[0] = serializeFloat(inputs['modulation']['center_frequency'].value);
            f32[1] = serializeFloat(inputs['modulation']['gain'].value);
            f32[2] = serializeFloat(inputs['encoder_filters']['dc_filter_alpha'].value);
            f32[3] = serializeFloat(inputs['interpolation']['excess_bandwidth'].value);
            f32[4] = serializeFloat(inputs['resampler']['bandwidth'].value);
            f32[5] = serializeFloat(inputs['resampler']['attenuation'].value);

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

            var mode_nodes = document.querySelectorAll('input[name=mode]');
            for (var i = 0; i < mode_nodes.length; i++) {
                if (mode_nodes[i].checked === true) {
                    u8[10] = i;
                }
            }

            var i8 = new Int8Array(ab, 37, 5);
            i8[0] = inputs['mod_scheme'].selectedIndex;
            i8[1] = inputs['checksum_scheme'].selectedIndex;
            i8[2] = inputs['inner_fec_scheme'].selectedIndex;
            i8[3] = inputs['outer_fec_scheme'].selectedIndex;
            i8[4] = inputs['interpolation']['shape'].selectedIndex;

            return ab2b64(ab);
        };

        function expand(b64) {
            var ab = b642ab(b64);

            if (ab === undefined) {
                return false;
            }

            var f32 = new Float32Array(ab, 0, 6);
            var u16 = new Uint16Array(ab, 24, 1);
            var u8 = new Uint8Array(ab, 26, 11);
            var i8 = new Int8Array(ab, 37, 5);

            var backup = backupInputs();

            // first handle the mode since it reshapes profile
            var mode_index = u8[10];
            var mode_val = document.querySelectorAll('input[name=mode]')[mode_index].value;
            mode[mode_val].checked = true;
            onModeChange(mode_val);

            setInputValue(inputs['modulation']['center_frequency'], deserializeFloat(f32[0]));
            setInputValue(inputs['modulation']['gain'], deserializeFloat(f32[1]));
            setInputValue(inputs['encoder_filters']['dc_filter_alpha'], deserializeFloat(f32[2]));
            setInputValue(inputs['interpolation']['excess_bandwidth'], deserializeFloat(f32[3]));
            setInputValue(inputs['resampler']['bandwidth'], deserializeFloat(f32[4]));
            setInputValue(inputs['resampler']['attenuation'], deserializeFloat(f32[5]));

            setInputValue(inputs['frame_length'], u16[0]);

            setInputValue(inputs['interpolation']['samples_per_symbol'], u8[0]);
            setInputValue(inputs['interpolation']['symbol_delay'], u8[1]);
            setInputValue(inputs['ofdm']['num_subcarriers'], u8[2]);
            setInputValue(inputs['ofdm']['cyclic_prefix_length'], u8[3]);
            setInputValue(inputs['ofdm']['taper_length'], u8[4]);
            setInputValue(inputs['ofdm']['left_band'], u8[5]);
            setInputValue(inputs['ofdm']['right_band'], u8[6]);
            setInputValue(inputs['resampler']['delay'], u8[7]);
            setInputValue(inputs['resampler']['filter_bank_size'], u8[8]);
            clampFrame = Boolean(u8[9]);
            document.querySelector("#clampFrame").selectedIndex = clampFrame ? 0 : 1;

            setInputValue(inputs['mod_scheme'], i8[0]);
            setInputValue(inputs['checksum_scheme'], i8[1]);
            setInputValue(inputs['inner_fec_scheme'], i8[2]);
            setInputValue(inputs['outer_fec_scheme'], i8[3]);
            setInputValue(inputs['interpolation']['shape'], i8[4]);

            updateAllInputs();
            try {
                updateProfileOutput();
                return true;
            } catch (e) {
                restoreBackup(backup);
                updateProfileOutput();
                return false;
            }

        };

        function peekGain(b64) {
            var ab = b642ab(b64);

            if (ab === undefined) {
                return false;
            }

            var f32 = new Float32Array(ab, 0, 6);
            return deserializeFloat(f32[1]);
        };

        return {
            shorten: shorten,
            expand: expand,
            peekGain: peekGain
        };
    }();

    function canvasWrapper(canvas, sizes) {
        var initHeight = parseInt(canvas.getAttribute('height'), 10);
        var initWidth = parseInt(canvas.getAttribute('width'), 10);
        var height = initHeight;
        var width = initWidth;
        var initHeightBox = parseInt(canvas.style.getPropertyValue('height'), 10);
        var initWidthBox = parseInt(canvas.style.getPropertyValue('width'), 10);
        var ctx = canvas.getContext('2d');
        ctx.mozImageSmoothingEnabled = false;
        ctx.webkitImageSmoothingEnabled = false;
        ctx.msImageSmoothingEnabled = false;
        ctx.imageSmoothingEnabled = false;
        if (sizes === undefined) {
            sizes = [[initWidth, initHeight]];
        }

        function rescale() {
            // our canvas has a CSS width and height and a canvas property width and height
            // the css will lock us to the right size no matter how large we make the canvas
            // we need to be aware of a few things
            // a) are we zoomed? this will change the bounding box dimensions
            //    because of the css styles, we otherwise will not see the bounding box grow
            //    in this case we upscale to ceil() of zoom ratio
            // b) are on a high dpi screen? this will change devicePixelRatio
            //    if we are in this case, we will upscale the canvas by the ratio
            // c) have media queries changed CSS box size? in some cases we may make the
            //    canvas shaped differently, if e.g. there's enough width
            // a and b and c can apply separately or together
            var rect = canvas.getBoundingClientRect();
            var dpr = window.devicePixelRatio;
            var visWidth = Math.ceil(dpr*(rect.right - rect.left));
            var visHeight = Math.ceil(dpr*(rect.bottom - rect.top));
            if (visWidth === 0 || visHeight === 0) {
                return;
            }
            var aspect = visWidth/visHeight;

            // figure out which size we'll report
            // we want one that's very near (~0) our aspect
            // choose the largest with the right aspect but is less than size
            var chosenW = 0;
            var chosenH = 0;

            for (var i = 0; i < sizes.length; i++) {
                var w = sizes[i][0];
                var h = sizes[i][1];
                var a = w/h;
                if (Math.abs(aspect - a) > 0.01) {
                    // not the same aspect
                    continue;
                }
                // now that we have the same aspect, just measure on width
                if (w > visWidth) {
                    // too big
                    continue;
                }
                if (w > chosenW) {
                    // winner
                    chosenW = w;
                    chosenH = h;
                }
            }

            width = chosenW;
            height = chosenH;
            var horizZoom = visWidth/chosenW;
            var vertZoom = visHeight/chosenH;
            var horizScale = Math.ceil(horizZoom);
            var vertScale = Math.ceil(vertZoom);
            var newWidth = horizScale * chosenW;
            var newHeight = vertScale * chosenH;


            if (canvas.width != newWidth || canvas.height != newHeight) {
                canvas.width = newWidth;
                canvas.height = newHeight;

                ctx.scale(horizScale, vertScale);
            }
        };

        return {
            ctx: ctx,
            height: height,
            width: width,
            rescale: rescale
        };
    };

    function getInputValue(input) {
        if (input.type === "select-one") {
            return input.selectedIndex;
        } else if (input.type === "number") {
            return input.value;
        }
    };

    function setInputValue(input, val) {
        if (input.getAttribute("disabled") === "disabled") {
            return;
        }
        if (input.type === "select-one") {
            input.selectedIndex = val;
        } else if (input.type === "number") {
            input.value = val;
        }
    };

    function backupInputs() {
        var backup_mode;
        for (var i = 0; i < mode.length; i++) {
            if (mode[i].checked === true) {
                backup_mode = mode[i].value;
                break;
            }
        }

        var backup = {};
        for (var k in inputs) {
            var input = inputs[k];
            if (input instanceof Node) {
                backup[k] = getInputValue(inputs[k]);
            } else {
                backup[k] = {};
                for (var nestedK in input) {
                    backup[k][nestedK] = getInputValue(input[nestedK]);
                }
            }
        }

        backup.mode = backup_mode;
        return backup;
    };

    function restoreBackup(backup) {
        var mode_val = backup.backup_mode;
        mode[mode_val].checked = true;
        onModeChange(mode_val);
        delete backup.backup_mode;
        for (k in inputs) {
            var input = inputs[k];
            if (input instanceof Node) {
                inputs[k] = backup[k];
                updateInput(inputs[k]);
            } else {
                for (var nestedK in input) {
                    inputs[k][nestedK] = backup[k][nestedK];
                    updateInput(inputs[k][nestedK]);
                }
            }
        }
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
        initInstrumentData();
        updateInstruments();
        drawConstellation([]);
        if (transmitter !== undefined) {
            transmitter.destroy();
            frameIndex = 345345;
            lastTransmitted = [];
            transmitter = Quiet.transmitter({profile: profile,
                onEnqueue: onTransmitEnqueue,
                clampFrame: clampFrame
            });
            if (transmitter.frameLength < 4) {
                throw "Frame too short";
            }
            instrumentData['frame-length'] = transmitter.frameLength;
            initTxQueue();
        }
        if (receiver !== undefined) {
            receiver.destroy();
            lastReceived = [];
            receiver = Quiet.receiver({profile: profile,
                onReceive: onReceive,
                onCreateFail: onReceiverCreateFail,
                onReceiverStatsUpdate: onReceiverStatsUpdate
            });
        }
        jsonBlock.value = JSON.stringify(profile, null, 2);
        onJSONProfileUpdate();
        var shortened = shortener.shorten();
        var link = "https://quiet.github.io/quiet-js/lab.html?profile=" + shortened;
        shortBlockLink.href = link;
        shortBlockLink.textContent = link;
    };

    function updateInput(input) {
        var val = input.value;
        if (input.type === "number") {
            val = Number(val);
            max = Number(input.max);
            min = Number(input.min);
            if (val > max) {
                input.value = max;
                val = max;
            }
            if (val < min) {
                input.value = min;
                val = min;
            }
        }
        var index = inputsIndex[input.id].split(".");
        if (index.length === 2) {
            profile[index[0]][index[1]] = val;
        } else {
            profile[index[0]] = val;
        }
        return val;
    };

    function onInputChange(e) {
        updateInput(e.target);
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

    function calcTxQueueFrames() {
        var totalQueueSize = 1 << 16; // TODO: don't "know" this about libquiet
        // we need to keep enough frames around that we can search for this one by
        // the time it's been decoded, after going through all the queues
        // also, each frame occupies 4 bytes additional in the ring buffer
        return Math.ceil(totalQueueSize/(transmitter.frameLength + 4));
    };

    // warm up transmitter queue so that it starts full
    // this prevents little underflows at the start
    // this is necessary only to have a smooth throughput all the way
    function initTxQueue() {
        var numFrames = calcTxQueueFrames();
        var frames = new ArrayBuffer(0);
        for (var i = 0; i < numFrames; i++) {
            frames = Quiet.mergeab(frames, buildFrame());
        }
        transmitter.transmit(frames);
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

        lastTransmitted.unshift({frame: frame, sent: new Date()});

        var keepFrames = calcTxQueueFrames() + 30;
        if (lastTransmitted.length > keepFrames) {
            // count frames as lost here. this introduces a little delay before
            // we can display it, but if the frame hasn't been found by the
            // receiver, it's gone
            lastTransmitted.pop();
            instrumentData["frames-lost"]++;
            instrumentData["bit-fail"] += 8 * transmitter.frameLength;
            instrumentData["total-received"] = (instrumentData["bit-success"]/8).toFixed(0)
            instrumentData["total-loss"] = (100 * instrumentData["bit-fail"]/(instrumentData["bit-success"] + instrumentData["bit-fail"])).toFixed(4)
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
        instrumentData["frames-received"]++;
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
            var txView = new Uint32Array(lastTransmitted[i].frame, 0, 1);
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
            // this will keep this mystery frame from affecting stats
            // if it was supposed to be counted, it will eventually increase
            // frame loss
            return;
        } else {
            var totalDist = 0;
            var rxView = new Uint8Array(recvPayload);
            var txView = new Uint8Array(lastTransmitted[closest].frame);
            for (var i = 0; i < rxView.length; i++) {
                totalDist += bitDistance(rxView[i], txView[i]);
            }
            info.bitErrors = totalDist;
            lastTransmitted.splice(closest, 1);
        }

        instrumentData["bit-success"] += info.size - info.bitErrors;
        instrumentData["bit-fail"] += info.bitErrors;
        lastReceived.unshift(info);
        if (lastReceived.length > 10) {
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
        instrumentData["total-received"] = (instrumentData["bit-success"]/8).toFixed(0)
        instrumentData["total-loss"] = (100 * instrumentData["bit-fail"]/(instrumentData["bit-success"] + instrumentData["bit-fail"])).toFixed(4)
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
        drawFFT();
    };

    function onShowSpectrum() {
        waveformContainer.classList.add("hidden");
        fftContainer.classList.remove("hidden");
        spectrumBtn.classList.add("hidden");
        waveformBtn.classList.remove("hidden");
        drawFFT();
    };

    function onStopGraphs() {
        stopped = true;
        stopGraphsBtn.classList.add("hidden");
        runGraphsBtn.classList.remove("hidden");
    };

    function onRunGraphs() {
        stopped = false;
        runGraphsBtn.classList.add("hidden");
        stopGraphsBtn.classList.remove("hidden");
        drawFFT();
    };

    function onLabStart() {
        stopped = false;
        pausedBlock.classList.add("hidden");
        instrumentsBlock.classList.remove("hidden");
        warningbox.classList.add("hidden");

        drawAxes();

        initInstrumentData();
        updateInstruments();
        drawConstellation([]);

        try {
            lastTransmitted = [];
            transmitter = Quiet.transmitter({
                profile: profile,
                onEnqueue: onTransmitEnqueue,
                clampFrame: clampFrame
            });
            if (transmitter.frameLength < 4) {
                throw "Frame too short";
            }
            instrumentData['frame-length'] = transmitter.frameLength;
            initTxQueue();
            receiver = Quiet.receiver({profile: profile,
                onReceive: onReceive,
                onCreate: function() {
                    if (source === undefined) {
                        var gUM = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia);
                        gUM.call(navigator, gUMConstraints(), onGUM, onGUMFail);
                    } else {
                        source.connect(analyser);
                        drawFFT();
                    }
                },
                onCreateFail: onReceiverCreateFail,
                onReceiverStatsUpdate: onReceiverStatsUpdate
            });
        } catch (exc) {
            warningbox.classList.remove("hidden");
            warningbox.textContent = "Sorry, it looks like there was a problem with this profile. Revert to your last working settings or load a preset, and then try again.";
            onLabStop();
            return;
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
            source = undefined;
        }
        instrumentsBlock.classList.add("hidden");
        pausedBlock.classList.remove("hidden");
        Quiet.disconnect();
        stopped = true;
    };

    function onQuietReady() {
        startBtn.addEventListener('click', onLabStart, false);
    };

    function onQuietFail(reason) {
        console.log("quiet failed to initialize: " + reason);
        warningbox.classList.remove("hidden");
        warningbox.textContent = "Sorry, it looks like there was a problem with this example (" + reason + ")";
    };

    function loadProfileObj(p) {
        if (p.ofdm !== undefined) {
            mode["OFDMMode"].checked = true;
            onModeChange("OFDMMode");
        } else if (p.mod_scheme === "gmsk") {
            mode["GMSKMode"].checked = true;
            onModeChange("GMSKMode");
        } else {
            mode["ModemMode"].checked = true;
            onModeChange("ModemMode");
        }
        var backup = backupInputs();
        for (var k in profile) {
            var input = inputs[k];
            if (input instanceof Node) {
                profile[k] = p[k];  // copy so that we can reload pristine later
                input.value = profile[k];
            } else {
                for (var nestedK in input) {
                    var nestedInput = input[nestedK];
                    if (typeof p[k] === "object") {
                        profile[k][nestedK] = p[k][nestedK];
                        nestedInput.value = profile[k][nestedK];
                    }
                }
            }
        }
        try {
            updateProfileOutput();
            return true;
        } catch (exc) {
            restoreBackup(backup);
            updateProfileOutput();
            return false;
        }
    };

    function onLoadPreset(e) {
        loadProfileObj(profilesObj[presets.value]);
    };

    function onProfilesFetch(resp) {
        profilesObj = JSON.parse(resp);

        for (var k in profilesObj) {
            var opt = document.createElement("option");
            opt.textContent = k;
            opt.value = k;
            presets.appendChild(opt);
        }

        presets.value = "hello-world";
        var qs = document.location.search.replace("?", "").split("&");
        var linkProfile;
        for (var i = 0; i < qs.length; i++) {
            var name_param = qs[i].split("=");
            if (name_param[0] === "profile") {
                linkProfile = name_param[1];
                break;
            }
        }
        var loadedLink = false;
        if (linkProfile !== undefined) {
            loadedLink = shortener.expand(linkProfile);
        }
        if (loadedLink === false) {
            loadProfileObj(profilesObj["hello-world"]);
        }
    };

    function onJSONProfileUpdate() {
        var p = {};
        try {
            p = JSON.parse(jsonBlock.value);
        } catch (exc) {
        }
        var gain;
        if (typeof p.modulation === "object") {
            gain = p.modulation.gain;
        }
        if (gain === undefined) {
            loadJSONBtn.textContent = "Load Profile";
        } else {
            loadJSONBtn.textContent = "Load Profile [gain=" + gain + "]";
        }

    };

    function onJSONProfileChange(e) {
        onJSONProfileUpdate();
    };

    function onLoadJSONProfile(e) {
        var p = {};
        try {
            p = JSON.parse(jsonBlock.value);
        } catch (exc) {
        }
        var succeeded = loadProfileObj(p);
        var warningbox = jsonBlock.parentNode.querySelector(".alert");
        if (succeeded === false) {
            warningbox.classList.remove('hidden');
        } else {
            warningbox.classList.add('hidden');
        }
    };

    function amp2dB(a) {
        return 10 * Math.log10(Math.abs(a));
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
        for (var i = analyser.minDecibels; i <= analyser.maxDecibels - 10; i += 10) {
            if (i !== analyser.minDecibles) {
                fftAxes.ctx.moveTo(xmargin, fftCanvas.height - ((i - analyser.minDecibels) * yscale));
                fftAxes.ctx.lineTo(xmargin + 4, fftCanvas.height - ((i - analyser.minDecibels) * yscale));
            }
            fftAxes.ctx.fillText(i, 0, fftCanvas.height - ((i - analyser.minDecibels) * yscale) + 9);
        }
        fftAxes.ctx.fillText("dB", xmargin + 5, 10);
        var maxFreq = audioCtx.sampleRate/2;
        var xscale = fftCanvas.width/maxFreq;
        for (var i = 0; i < maxFreq - 2000; i += 2000) {
            if (i !== 0) {
                fftAxes.ctx.moveTo(xmargin + (i * xscale), fftCanvas.height - 4);
                fftAxes.ctx.lineTo(xmargin + (i * xscale), fftCanvas.height);
            }
            fftAxes.ctx.fillText((i/1000).toFixed(0), xmargin + (i * xscale), fftAxes.height - 5);
        }
        fftAxes.ctx.fillText("kHz", fftAxes.width - 25, fftAxes.height - 25);
        fftAxes.ctx.stroke();

        waveformAxes.rescale();
        waveformAxes.ctx.beginPath();
        var xmargin = waveformAxes.width - waveformCanvas.width;
        var ymargin = waveformAxes.height - waveformCanvas.height;
        waveformAxes.ctx.moveTo(xmargin, 0);
        waveformAxes.ctx.lineTo(xmargin, waveformAxes.height - ymargin);
        waveformAxes.ctx.lineTo(waveformAxes.width, waveformAxes.height - ymargin);
        waveformAxes.ctx.font = "12px monospace";
        var max = 0.2;
        var min = -0.2;
        var step = 0.05;
        var yscale = waveformCanvas.height/(max - min);
        for (var i = min + step; i < max - step; i += step) {
            if (Math.abs(i) < 0.001) {
                continue;
            }
            waveformAxes.ctx.moveTo(xmargin, (max - i) * yscale);
            waveformAxes.ctx.lineTo(xmargin + 4, (max - i) * yscale);
            waveformAxes.ctx.fillText(amp2dB(i).toFixed(0), 0, (max - i) * yscale + 9);
        }
        waveformAxes.ctx.fillText("dB", xmargin + 5, 10);
        var maxTime = analyser.frequencyBinCount/audioCtx.sampleRate * 1000;
        var xscale = waveformCanvas.width/maxTime;
        for (var i = 0; i < maxTime; i += 1) {
            if (i !== 0) {
                waveformAxes.ctx.moveTo(xmargin + (i * xscale), waveformCanvas.height - 4);
                waveformAxes.ctx.lineTo(xmargin + (i * xscale), waveformCanvas.height);
            }
            waveformAxes.ctx.fillText(i.toFixed(0), xmargin + (i * xscale), waveformAxes.height - 5);
        }
        waveformAxes.ctx.fillText("ms", waveformAxes.width - 15, waveformAxes.height - 25);
        waveformAxes.ctx.stroke();

        constellationAxes.rescale();
        constellationAxes.ctx.beginPath();
        constellationAxes.ctx.moveTo(0, constellationAxes.height/2);
        constellationAxes.ctx.lineTo(constellationAxes.width, constellationAxes.height/2);
        constellationAxes.ctx.moveTo(constellationAxes.width/2, 0);
        constellationAxes.ctx.lineTo(constellationAxes.width/2, constellationAxes.height);

        var min = -2;
        var max = 2;
        var step = 0.5;
        for (var i = min + step; i < max; i += step) {
            var pos = (i - min)/(max - min);
            constellationAxes.ctx.moveTo(pos * constellationAxes.width, constellationAxes.height/2 - 2);
            constellationAxes.ctx.lineTo(pos * constellationAxes.width, constellationAxes.height/2 + 2);
            constellationAxes.ctx.moveTo(constellationAxes.width/2 - 2, pos * constellationAxes.height);
            constellationAxes.ctx.lineTo(constellationAxes.width/2 + 2, pos * constellationAxes.height);
        }
        constellationAxes.ctx.stroke();

        constellationAxes.ctx.font = "12px monospace";
        constellationAxes.ctx.fillText("-1", constellationAxes.width/4, constellationAxes.height/2 - 4);
        constellationAxes.ctx.fillText("1", 3*constellationAxes.width/4, constellationAxes.height/2 - 4);
        constellationAxes.ctx.fillText("1", constellationAxes.width/2 + 4, constellationAxes.height/4);
        constellationAxes.ctx.fillText("-1", constellationAxes.width/2 + 4, 3*constellationAxes.height/4);
        constellationAxes.ctx.fillText("I", constellationAxes.width - 8, constellationAxes.height/2 - 4);
        constellationAxes.ctx.fillText("Q", constellationAxes.width/2 + 4, 8);

        instrumentData['sample-rate'] = audioCtx.sampleRate;
        instrumentData['sample-block-samples'] = 16384;
        instrumentData['sample-block-ms'] = (16384/audioCtx.sampleRate * 1000).toFixed(0);
    };

    function drawFFT() {
        drawAxes();
        fftCanvas.rescale();
        if (stopped === false) {
            drawVisual = requestAnimationFrame(drawFFT);
            analyser.getFloatFrequencyData(fftBuffer);
        }
        fftCanvas.ctx.clearRect(0, 0, fftCanvas.width, fftCanvas.height);
        var scale = fftCanvas.height/(analyser.maxDecibels - analyser.minDecibels);
        for (var i = 0; i < analyser.frequencyBinCount; i += 2) {
            var avg = (fftBuffer[i] + fftBuffer[i + 1])/2;
            var magnitude = (avg - analyser.minDecibels) * scale;
            fftCanvas.ctx.fillRect(i/2, fftCanvas.height, 1, -magnitude);
        }

        waveformCanvas.rescale();
        if (stopped === false) {
            analyser.getFloatTimeDomainData(timeBuffer);
        }
        waveformCanvas.ctx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
        var min = -0.2;
        var max = 0.2;
        var scale = waveformCanvas.height/(max - min);
        waveformCanvas.ctx.beginPath();
        for (var i = 0; i < analyser.frequencyBinCount; i += 2) {
            var avg = (timeBuffer[i] + timeBuffer[i + 1])/2;
            var magnitude = (max - avg) * scale;
            waveformCanvas.ctx.moveTo(i/2, waveformCanvas.height/2);
            waveformCanvas.ctx.lineTo(i/2, magnitude);
        }
        waveformCanvas.ctx.stroke();
    };

    function drawConstellation(symbols) {
        if (stopped === true) {
            return;
        }
        constellationCanvas.rescale();
        constellationCanvas.ctx.clearRect(0, 0, constellationCanvas.width, constellationCanvas.height);
        var min = -2;
        var max = 2;
        var yscale = constellationCanvas.height/(max - min);
        var xscale = constellationCanvas.width/(max - min);
        constellationCanvas.ctx.beginPath();
        for (var i = 0; i < symbols.length; i++) {
            var x = (symbols[i].real - min) * xscale;
            var y = (max- symbols[i].imag) * yscale;
            constellationCanvas.ctx.moveTo(x - 2, y - 2);
            constellationCanvas.ctx.lineTo(x + 2, y + 2);
            constellationCanvas.ctx.moveTo(x - 2, y + 2);
            constellationCanvas.ctx.lineTo(x + 2, y - 2);
        }
        constellationCanvas.ctx.stroke();
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
            "frames-received": 0,
            "frames-lost": 0,
            "rssi": "---",
            "evm": "---",
            "avgEncodeTime": "---",
            "avgDecodeTime": "---",
            "transfer-rate": "---",
            "bit-error-ratio": "---",
            "sample-rate": "---",
            "frame-length": "---",
            "sample-block-samples": "---",
            "sample-block-ms": "---",
            "total-received": "---",
            "total-loss": "---",
            "bit-success": 0,
            "bit-fail": 0,
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
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.35;
        analyser.minDecibels = -90;
        analyser.maxDecibels = -10;
        fftBuffer = new Float32Array(analyser.frequencyBinCount);
        timeBuffer = new Float32Array(analyser.frequencyBinCount);

        constellationAxes = canvasWrapper(document.querySelector("[data-quiet-lab-constellation-axes]"));
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
            "frames-received": document.querySelector("[data-quiet-lab-frames-received]"),
            "frames-lost": document.querySelector("[data-quiet-lab-frames-lost]"),
            "rssi": document.querySelector("[data-quiet-lab-rssi]"),
            "evm": document.querySelector("[data-quiet-lab-evm]"),
            "avgEncodeTime": document.querySelector("[data-quiet-lab-avg-encode-time]"),
            "avgDecodeTime": document.querySelector("[data-quiet-lab-avg-decode-time]"),
            "transfer-rate": document.querySelector("[data-quiet-lab-transfer-rate]"),
            "bit-error-ratio": document.querySelector("[data-quiet-lab-bit-error-ratio]"),
            "sample-rate": document.querySelector("[data-quiet-lab-sample-rate]"),
            "frame-length": document.querySelector("[data-quiet-lab-frame-length]"),
            "sample-block-samples": document.querySelector("[data-quiet-lab-sample-block-samples]"),
            "sample-block-ms": document.querySelector("[data-quiet-lab-sample-block-ms]"),
            "total-received": document.querySelector("[data-quiet-lab-total-received]"),
            "total-loss": document.querySelector("[data-quiet-lab-total-loss]")
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

        stopGraphsBtn = document.querySelector("[data-quiet-lab-stop-graphs]");
        stopGraphsBtn.addEventListener('click', onStopGraphs, false);

        runGraphsBtn = document.querySelector("[data-quiet-lab-run-graphs]");
        runGraphsBtn.addEventListener('click', onRunGraphs, false);

        jsonBlock = document.querySelector("#quiet-profiles-json");
        jsonBlock.addEventListener('input', onJSONProfileChange, false);
        loadJSONBtn = document.querySelector('#loadJSONProfile');
        loadJSONBtn.addEventListener('click', onLoadJSONProfile, false);
        shortBlockLink = document.querySelector("#quiet-short-profile-link");
        updateProfileOutput();

        Quiet.addReadyCallback(onQuietReady, onQuietFail);
    };

    document.addEventListener("DOMContentLoaded", onDOMLoad);
})();
