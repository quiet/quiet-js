var Module = {
    onClick: function(e) {
        if (Module.payload === "") {
            return
        }
        var payload = allocate(intArrayFromString(Module.payload), 'i8', ALLOC_NORMAL);
        ccall('encoder_set_payload', 'number', ['pointer', 'pointer', 'number'], [Module.encoder, payload, Module.payload.length]);

        var sample_len = 16384;
        var samples = ccall('malloc', 'pointer', ['number'], [4 * sample_len]);
        var sample_view = HEAPF32.subarray((samples/4), (samples/4) + sample_len);

        var script_processor = Module.audio_ctx.createScriptProcessor || Module.audio_ctx.createJavaScriptNode
        var transmitter = script_processor.call(Module.audio_ctx, sample_len, 1, 2);
        transmitter.onaudioprocess = function(e) {
            var output_offset = 0;
            var output_l = e.outputBuffer.getChannelData(0);
            var written = ccall('encode', 'number', ['pointer', 'pointer', 'number'], [Module.encoder, samples, sample_len]);
            output_l.set(sample_view);
            if (written < sample_len) {
                for (var i = written; i < sample_len; i++) {
                    output_l[i] = 0;
                }
            }
        };
        var dummy_osc = Module.audio_ctx.createOscillator();
        dummy_osc.type = 'square';
        dummy_osc.frequency.value = 420;
        dummy_osc.connect(transmitter);
        transmitter.connect(Module.audio_ctx.destination);
    },
    onTextChange: function(e) {
        Module.payload = e.target.value;
    },
    onFileRead: function(e) {
        Module.payload = e.target.result;
    },
    onFileSelect: function(e) {
        var reader = new FileReader()
        reader.onload = Module.onFileRead;
        reader.readAsDataURL(e.target.files[0]);
    },
    onProfilesFetch: function(profiles) {
        Module.audio_ctx = new (window.AudioContext || window.webkitAudioContext)();
        console.log(Module.audio_ctx.sampleRate);

        var profilename = document.querySelector('[data-quiet-profile-name]').textContent;

        var c_profiles = intArrayFromString(profiles);
        var c_profilename = intArrayFromString(profilename);
        var opt = ccall('get_encoder_profile_str', 'pointer', ['array', 'array'], [c_profiles, c_profilename]);
        ccall('encoder_opt_set_sample_rate', 'number', ['pointer', 'number'], [opt, Module.audio_ctx.sampleRate]);
        Module.encoder = ccall('create_encoder', 'pointer', ['pointer'], [opt]);

        Module.payload = "";

        var file_input = document.querySelector('[data-quiet-file-input]');
        if (file_input !== null) {
            file_input.addEventListener('change', Module.onFileSelect, false);
        }

        var text_input = document.querySelector('[data-quiet-text-input]');
        if (text_input !== null) {
            text_input.addEventListener('change', Module.onTextChange, false);
        }
        document.querySelector('[data-quiet-send-button]').addEventListener('click', Module.onClick, false);


        //ccall('destroy_encoder', null, ['pointer'], [encoder]);

    },
    onRuntimeInitialized: function() {
        var xhr = new XMLHttpRequest();
        xhr.overrideMimeType("application/json");
        xhr.open("GET", "javascripts/profiles.json", true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4 && xhr.status == "200") {
                Module.onProfilesFetch(xhr.responseText);
            }
        };
        xhr.send(null);
    }
};
