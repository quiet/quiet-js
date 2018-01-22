var TextTransmitter = (function() {
    Quiet.init({
        profilesPrefix: "/quiet-js/test/",
        memoryInitializerPrefix: "/quiet-js/javascripts/",
        libfecPrefix: "/quiet-js/javascripts/"
    });
    var btn;
    var statusbox;
    var transmitter;

    function calcTxQueueFrames() {
        var totalQueueSize = 1 << 16;
        return Math.ceil(totalQueueSize/(transmitter.frameLength + 4));
    };

    function buildFrame() {
        var frame = new ArrayBuffer(transmitter.frameLength);
        var byteView = new Uint8Array(frame);
        for (var i = 4; i < byteView.length; i++) {
            byteView[i] = Math.floor(Math.random() * 256);
        }

        return frame;
    };

    function initTxQueue() {
        var numFrames = calcTxQueueFrames();
        var frames = new ArrayBuffer(0);
        for (var i = 0; i < numFrames; i++) {
            frames = Quiet.mergeab(frames, buildFrame());
        }
        transmitter.transmit(frames);
    };

    function onClick(e) {
        e.target.remove();
        initTxQueue();

        statusbox.innerText = '';
        var statusHeader = document.createElement('h3');
        statusHeader.innerText = 'Transmitter Started';
        statusbox.appendChild(statusHeader);
        var statusDesc = document.createElement('div');
        statusDesc.innerText = 'The transmitter is now continuously sending. To stop transmission, close this page.';
        statusbox.appendChild(statusDesc);
        var profile = transmitter.getProfile();
        var modDesc = document.createElement('div');
        modDesc.innerText = 'Modulation: ' + profile.mod_scheme;
        statusbox.appendChild(modDesc);
        var interpDesc = document.createElement('div');
        interpDesc.innerText = 'Interpolation factor: ' + profile.interpolation.samples_per_symbol;
        statusbox.appendChild(interpDesc);
        var freqDesc = document.createElement('div');
        freqDesc.innerText = 'Center frequency: ' + profile.modulation.center_frequency + ' Hz';
        statusbox.appendChild(freqDesc);
        var checkDesc = document.createElement('div');
        checkDesc.innerText = 'Checksum scheme: ' + profile.checksum_scheme;
        statusbox.appendChild(checkDesc);
        var lengthDesc = document.createElement('div');
        lengthDesc.innerText = 'Frame length: ' + profile.frame_length + ' bytes';
        statusbox.appendChild(lengthDesc);
        var outerFecDesc = document.createElement('div');
        outerFecDesc.innerText = 'Outer FEC scheme: ' + 'Conv. code r=1/2 k=9';  // XXX dynamic
        statusbox.appendChild(outerFecDesc);
        var innerFecDesc = document.createElement('div');
        innerFecDesc.innerText = 'Inner FEC scheme: ' + 'none';  // XXX dynamic
        statusbox.appendChild(innerFecDesc);
    };

    function onTransmitEnqueue() {
        window.setTimeout(function() {
            if (transmitter !== undefined) {
                transmitter.transmit(buildFrame());
            }
        }, 0);
    };

    function onQuietReady() {
        var profilename = document.querySelector('[data-quiet-profile-name]').getAttribute('data-quiet-profile-name');
        transmitter = Quiet.transmitter({
            profile: profilename,
            clampFrame: false,
            onEnqueue: onTransmitEnqueue,
        });
        btn.addEventListener('click', onClick, false);
    };

    function onQuietFail(reason) {
        console.log("quiet failed to initialize: " + reason);
        statusbox.classList.remove("hidden");
        statusbox.textContent = "Sorry, it looks like there was a problem with this example (" + reason + ")";
    };

    function onDOMLoad() {
        btn = document.querySelector('[data-quiet-send-button]');
        textbox = document.querySelector('[data-quiet-text-input]');
        statusbox = document.querySelector('[data-quiet-status]');
        Quiet.addReadyCallback(onQuietReady, onQuietFail);
    };

    document.addEventListener("DOMContentLoaded", onDOMLoad);
})();
