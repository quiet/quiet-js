var TextTransmitter = (function() {
    Transmitter.setProfilesPath("javascripts/profiles.json");
    var btn;
    var transmit;

    function onTransmitFinish() {
        btn.blur();
        btn.addEventListener('click', onClick, false);
        btn.disabled = false;
        var originalText = e.target.innerText;
        e.target.innerText = e.target.getAttribute('data-quiet-sending-text');
        e.target.setAttribute('data-quiet-sending-text', originalText);
    };

    function onClick(e) {
        e.target.removeEventListener(e.type, arguments.callee);
        e.target.disabled = true;
        var originalText = e.target.innerText;
        e.target.innerText = e.target.getAttribute('data-quiet-sending-text');
        e.target.setAttribute('data-quiet-sending-text', originalText);
        var payload = document.querySelector('[data-quiet-text-input]').value;
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
        Transmitter.setReadyCallback(onTransmitterReady);
    };

    document.addEventListener("DOMContentLoaded", onDOMLoad);
})();
