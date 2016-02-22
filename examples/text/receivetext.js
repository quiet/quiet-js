var TextReceiver = (function() {
    Quiet.setProfilesPrefix("/foo");
    Quiet.setMemoryInitializerPrefix("/");
    var target;
    var content = "";

    function onReceive(recvPayload) {
        content += recvPayload;
        if (target.firstChild !== null) {
            target.removeChild(target.firstChild);
        }
        target.appendChild(document.createTextNode(content));
    };

    function onReceiverCreateFail(reason) {
        console.log("failed to create quiet receiver: " + reason);
    };

    function onQuietReady() {
        var profilename = document.querySelector('[data-quiet-profile-name]').getAttribute('data-quiet-profile-name');
        Quiet.receiver(profilename, onReceive, onReceiverCreateFail);
    };

    function onQuietFail(reason) {
        console.log("quiet failed to initialize: " + reason);
    }

    function onDOMLoad() {
        target = document.querySelector('[data-quiet-receive-text-target]');
        Quiet.addReadyCallback(onQuietReady, onQuietFail);
    };

    document.addEventListener("DOMContentLoaded", onDOMLoad);
})();
