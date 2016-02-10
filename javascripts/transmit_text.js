var TextTransmitter = (function() {
    Transmitter.setProfilesPath("javascripts/profiles.json");
    var btn;

    function onTransmitFinish() {
        btn.blur();
        btn.addEventListener('click', onClick, false);
    };

    function onClick(e) {
        e.target.removeEventListener(e.type, arguments.callee);
        var payload = document.querySelector('[data-quiet-text-input]').value;
        if (payload === "") {
            return
        }
        transmit(payload, onTransmitFinish);
    };

    function onTransmitterReady() {
        var profilename = document.querySelector('[data-quiet-profile-name]').getAttribute('data-quiet-profile-name');
        var transmit = Transmitter.transmitter(profilename);
        btn.addEventListener('click', onClick, false);
    };

    function onDOMLoad() {
        btn = document.querySelector('[data-quiet-send-button]');
        Transmitter.setReadyCallback(onTransmitterReady);
    };

    document.addEventListener("DOMContentLoaded", onDOMLoad);
})();
