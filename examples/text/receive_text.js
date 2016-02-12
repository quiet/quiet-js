var TextReceiver = (function() {
    Quiet.setProfilesPath("javascripts/profiles.json");
    var target;
    var content = "";

    function onReceive(recvPayload) {
        content += recvPayload;
        if (target.firstChild !== null) {
            target.removeChild(target.firstChild);
        }
        target.appendChild(document.createTextNode(content));
    };

    function onQuietReady() {
        var profilename = document.querySelector('[data-quiet-profile-name]').getAttribute('data-quiet-profile-name');
        Quiet.receiver(profilename, onReceive);
    };

    function onDOMLoad() {
        target = document.querySelector('[data-quiet-receive-text-target]');
        Quiet.addReadyCallback(onQuietReady);
    };

    document.addEventListener("DOMContentLoaded", onDOMLoad);
})();
