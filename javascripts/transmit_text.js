var TextTransmitter = (function() {
    Transmitter.setProfilesPath("javascripts/profiles.json");
    var btn;
    var textbox;
    var transmit;

    function onTransmitFinish() {
        textbox.focus();
        btn.addEventListener('click', onClick, false);
        btn.disabled = false;
        var originalText = btn.innerText;
        btn.innerText = btn.getAttribute('data-quiet-sending-text');
        btn.setAttribute('data-quiet-sending-text', originalText);
    };

    function onClick(e) {
        e.target.removeEventListener(e.type, arguments.callee);
        e.target.disabled = true;
        var originalText = e.target.innerText;
        e.target.innerText = e.target.getAttribute('data-quiet-sending-text');
        e.target.setAttribute('data-quiet-sending-text', originalText);
        var payload = textbox.value;
        if (payload === "") {
            onTransmitFinish();
            return;
        }
        transmit(payload, onTransmitFinish);
    };

    function onTransmitterReady() {
        var profilename = document.querySelector('[data-quiet-profile-name]').getAttribute('data-quiet-profile-name');
        transmit = Transmitter.transmitter(profilename);
        btn.addEventListener('click', onClick, false);
    };

    function onDOMLoad() {
        btn = document.querySelector('[data-quiet-send-button]');
        textbox = document.querySelector('[data-quiet-text-input]');
        Transmitter.setReadyCallback(onTransmitterReady);
    };

    document.addEventListener("DOMContentLoaded", onDOMLoad);
})();
