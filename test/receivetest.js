var TextReceiver = (function() {
    Quiet.init({
        profilesPrefix: "/quiet-js/test/",
        memoryInitializerPrefix: "/quiet-js/javascripts/",
        libfecPrefix: "/quiet-js/javascripts/"
    });
    var target;
    var content = new ArrayBuffer(0);
    var statusbox;
    var stats = {
        firstFrameReceived: null,
        lastFrameReceived: null,
        framesReceived: 0,
        framesFailed: 0,
        bytesReceived: 0,
        rssi: null,
        evm: null
    };
    var statsBoxes = {
        firstFrameReceived: document.createElement('div'),
        lastFrameReceived: document.createElement('div'),
        framesReceived: document.createElement('div'),
        framesFailed: document.createElement('div'),
        bytesReceived: document.createElement('div'),
        bitrate: document.createElement('div'),
        rssi: document.createElement('div'),
        evm: document.createElement('div')
    };

    function updateStats() {
        var bitrate;
        if (stats.firstFrameReceived != null && stats.lastFrameReceived != null && stats.firstFrameReceived != stats.lastFrameReceived) {
            var recvDuration = stats.lastFrameReceived - stats.firstFrameReceived;
            bitrate = (stats.bytesReceived * 8) / (recvDuration / 1000);
        } else {
            bitrate = 0;
        }

        if (stats.firstFrameReceived == null) {
            statsBoxes.firstFrameReceived.innerText = "First Frame Received: ---";
        } else {
            statsBoxes.firstFrameReceived.innerText = "First Frame Received: " + stats.firstFrameReceived.toLocaleTimeString();
        }

        if (stats.lastFrameReceived == null) {
            statsBoxes.lastFrameReceived.innerText = "Last Frame Received: ---";
        } else {
            statsBoxes.lastFrameReceived.innerText = "Last Frame Received: " + stats.lastFrameReceived.toLocaleTimeString();
        }

        statsBoxes.framesReceived.innerText = "Frames successfully received: " + stats.framesReceived;

        statsBoxes.framesFailed.innerText = "Frames received but failed checksum: " + stats.framesFailed;

        statsBoxes.bytesReceived.innerText = "Total bytes received: " + stats.bytesReceived;

        statsBoxes.bitrate.innerText = "Transmission bitrate: " + bitrate.toFixed(0) + " bps";

        if (stats.rssi == null) {
            statsBoxes.rssi.innerText = "RSSI: ---";
        } else {
            statsBoxes.rssi.innerText = "RSSI: " + stats.rssi + " dB";
        }

        if (stats.evm == null) {
            statsBoxes.evm.innerText = "EVM: ---";
        } else {
            statsBoxes.evm.innerText = "EVM: " + stats.evm + " dB";
        }
    };

    function onReceive(recvPayload) {
        stats.bytesReceived += recvPayload.byteLength;
        stats.framesReceived++;
        stats.lastFrameReceived = new Date();
        if (stats.firstFrameReceived == null) {
            stats.firstFrameReceived = stats.lastFrameReceived;
        }
        updateStats();
    };

    function onReceiveFail(num_fails) {
        stats.framesFailed++;
        stats.lastFrameReceived = new Date();
        if (stats.firstFrameReceived == null) {
            stats.firstFrameReceived = stats.lastFrameReceived;
        }
        updateStats();
    };

    function onReceiverCreate() {
        var statusHeader = document.createElement('h3');
        statusHeader.innerText = 'Receiver Started';
        statusbox.appendChild(statusHeader);
        var statusDesc = document.createElement('div');
        statusDesc.innerText = 'The receiver is operational and will update statistics as frames are received.';
        statusbox.appendChild(statusDesc);
        updateStats();
    };

    function onReceiverCreateFail(reason) {
        console.log("failed to create quiet receiver: " + reason);
        var statusHeader = document.createElement('h3');
        statusHeader.innerText = 'Receiver Failed to Start';
        statusbox.appendChild(statusHeader);
        var statusDesc = document.createElement('div');
        statusDesc.innerText = 'The receiver could not start in this browser. It could be that permission to use the microphone was not granted or that this browser is not compatible with Quiet Modem.';
        statusbox.appendChild(statusDesc);
    };

    function onReceiverStatsUpdate(update) {
        if (update.length > 0) {
            stats.rssi = update[0].receivedSignalStrengthIndicator.toFixed(2);
            var evm = update[0].errorVectorMagnitude;
            if (evm != 0) {
                stats.evm = evm.toFixed(2);
            }
            updateStats();
        }
    };

    function onQuietReady() {
        var profilename = document.querySelector('[data-quiet-profile-name]').getAttribute('data-quiet-profile-name');
        Quiet.receiver({profile: profilename,
             onReceive: onReceive,
             onCreate: onReceiverCreate,
             onCreateFail: onReceiverCreateFail,
             onReceiveFail: onReceiveFail,
             onReceiverStatsUpdate: onReceiverStatsUpdate
        });
    };

    function onQuietFail(reason) {
        console.log("quiet failed to initialize: " + reason);
        statusbox.textContent = "Sorry, it looks like there was a problem with this example (" + reason + ")";
    };

    function onDOMLoad() {
        target = document.querySelector('[data-quiet-receive-test-target]');
        target.appendChild(statsBoxes.firstFrameReceived);
        target.appendChild(statsBoxes.lastFrameReceived);
        target.appendChild(statsBoxes.framesReceived);
        target.appendChild(statsBoxes.framesFailed);
        target.appendChild(statsBoxes.bytesReceived);
        target.appendChild(statsBoxes.bitrate);
        target.appendChild(statsBoxes.rssi);
        target.appendChild(statsBoxes.evm);
        statusbox = document.querySelector('[data-quiet-status]');
        Quiet.addReadyCallback(onQuietReady, onQuietFail);
    };

    document.addEventListener("DOMContentLoaded", onDOMLoad);
})();
