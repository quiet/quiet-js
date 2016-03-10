var ImageReceiver = (function() {
    var btn;
    var target;
    var content = new ArrayBuffer(0);

    function onReceive(recvPayload) {
        content = Quiet.mergeab(content, recvPayload);
        var blob = new Blob([content]);
        target.innerHTML = "<img src='" + URL.createObjectURL(blob) + "'>";
        warningbox.classList.add("hidden");
    };

    function onReceiverCreateFail(reason) {
        console.log("failed to create quiet receiver: " + reason);
        warningbox.classList.remove("hidden");
        warningbox.textContent = "Sorry, it looks like this example is not supported by your browser. Please give permission to use the microphone or try again in Google Chrome or Microsoft Edge."
    };

    function onReceiveFail(num_fails) {
        warningbox.classList.remove("hidden");
        warningbox.textContent = "We didn't quite get that. It looks like you tried to transmit something. You may need to move the transmitter closer to the receiver and set the volume to 50%."
    };

    function onClick(e, startReceiver) {
        e.target.removeEventListener(e.type, arguments.callee);
        e.target.disabled = true;
        var originalText = e.target.innerText;
        e.target.innerText = e.target.getAttribute('data-quiet-receiving-text');
        e.target.setAttribute('data-quiet-receiving-text', originalText);
        startReceiver();
    }

    function onQuietReady() {
        var profilename = btn.getAttribute('data-quiet-profile-name');
        var startReceiver = function() { Quiet.receiver(profilename, onReceive, onReceiverCreateFail, onReceiveFail); };
        var onBtnClick = function(e) { return onClick(e, startReceiver); };
        btn.addEventListener('click', onBtnClick, false);
    };

    function onQuietFail(reason) {
        console.log("quiet failed to initialize: " + reason);
        warningbox.classList.remove("hidden");
        warningbox.textContent = "Sorry, it looks like there was a problem with this example (" + reason + ")";
    };

    function onDOMLoad() {
        btn = document.querySelector('[data-quiet-receive-image-button]');
        target = document.querySelector('[data-quiet-receive-image-target]');
        warningbox = document.querySelector('[data-quiet-receive-image-warning]');
        Quiet.addReadyCallback(onQuietReady, onQuietFail);
    };

    document.addEventListener("DOMContentLoaded", onDOMLoad);
})();
