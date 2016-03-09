var TextTransmitter = (function() {
    var btns;
    var textbox;
    var warningbox;

    function onTransmitFinish(btn) {
        textbox.focus();
        btn.disabled = false;
        var originalText = btn.innerText;
        btn.innerText = btn.getAttribute('data-quiet-sending-text');
        btn.setAttribute('data-quiet-sending-text', originalText);
    };

    function onClick(e, transmit, onFinish) {
        e.target.disabled = true;
        var originalText = e.target.innerText;
        e.target.innerText = e.target.getAttribute('data-quiet-sending-text');
        e.target.setAttribute('data-quiet-sending-text', originalText);
        var payload = textbox.value;
        if (payload === "") {
            onFinish();
            return;
        }
        transmit(Quiet.str2ab(payload), onFinish);
    };

    function setupButton(btn) {
        var profilename = btn.getAttribute('data-quiet-profile-name');
        var transmit = Quiet.transmitter(profilename);
        var onFinish = function() { return onTransmitFinish(btn); };
        var onBtnClick = function(e) { return onClick(e, transmit, onFinish); };
        btn.addEventListener('click', onBtnClick, false);
    };

    function onQuietReady() {
        for (var i = 0; i < btns.length; i++) {
            setupButton(btns[i]);
        }
    };

    function onQuietFail(reason) {
        console.log("quiet failed to initialize: " + reason);
        warningbox.classList.remove("hidden");
        warningbox.textContent = "Sorry, it looks like there was a problem with this example (" + reason + ")";
    };

    function onDOMLoad() {
        btns = document.querySelectorAll('[data-quiet-send-button]');
        textbox = document.querySelector('[data-quiet-text-input]');
        warningbox = document.querySelector('[data-quiet-send-text-warning]');
        Quiet.addReadyCallback(onQuietReady, onQuietFail);
    };

    document.addEventListener("DOMContentLoaded", onDOMLoad);
})();
