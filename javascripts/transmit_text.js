var TextTransmitter = (function() {
    Transmitter.setProfilesPath("javascripts/profiles.json");
    document.addEventListener("DOMContentLoaded", function() {
        var profilename = document.querySelector('[data-quiet-profile-name]').getAttribute('data-quiet-profile-name');
        Transmitter.setReadyCallback(function() {
            var transmit = Transmitter.transmitter(profilename);

            document.querySelector('[data-quiet-send-button]').addEventListener('click',
                function(e) {
                    var payload = document.querySelector('[data-quiet-text-input]').value;
                    if (payload === "") {
                        return
                    }
                    transmit(payload);
            }, false);
        });
    });
})();
