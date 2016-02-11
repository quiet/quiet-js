var TextReceiver = (function() {
    Transmitter.setProfilesPath("javascripts/profiles.json");
    var target;
    var content = "";

    function onReceive(recvPayload) {
        content += recvPayload;
        if (target.firstChild !== null) {
            target.removeChild(target.firstChild);
        }
        target.appendChild(document.createTextNode(content);
    };

    function onTransmitterReady() {
        var profilename = document.querySelector('[data-quiet-profile-name]').getAttribute('data-quiet-profile-name');
        Transmitter.receiver(profilename, onReceive);
    };

    function onDOMLoad() {
        target = document.querySelector('[data-quiet-receive-text-target]');
        Transmitter.addReadyCallback(onTransmitterReady);
    };

    document.addEventListener("DOMContentLoaded", onDOMLoad);
})();
