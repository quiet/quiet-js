var ImageTransmitter = (function() {
    Quiet.setProfilesPrefix("javascripts/");
    Quiet.setMemoryInitializerPrefix("javascripts/");
    Quiet.setLibfecPrefix("javascripts/");
    var btn;
    var fileinput;
    var transmit;
    var payload = "";

    function onTransmitFinish() {
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
        if (payload === "") {
            onTransmitFinish();
            return;
        }
        transmit(payload, onTransmitFinish);
    };

    function onFileRead(e) {
        payload = e.target.result;
    };

    function onFileSelect(e) {
        var reader = new FileReader()
        reader.onload = onFileRead;
        reader.readAsDataURL(e.target.files[0]);
    };

    function onQuietReady() {
        var profilename = document.querySelector('[data-quiet-profile-name]').getAttribute('data-quiet-profile-name');
        transmit = Quiet.transmitter(profilename);
        btn.addEventListener('click', onClick, false);
        fileinput.addEventListener('change', onFileSelect, false);
    };

    function onDOMLoad() {
        var host = "brian-armstrong.github.io";
        if ((host == window.location.host) && (window.location.protocol != "https:"))
            window.location.protocol = "https";

        btn = document.querySelector('[data-quiet-send-button]');
        fileinput = document.querySelector('[data-quiet-file-input]');

        Quiet.addReadyCallback(onQuietReady);
    };

    document.addEventListener("DOMContentLoaded", onDOMLoad);
})();
