var TextTransmitter = (function() {
    Transmitter.setProfilesPath("javascripts/profiles.json");
    var profilename = document.querySelector('[data-quiet-profile-name]').getAttribute('data-quiet-profile-name');
    var transmit = Transmitter.transmitter(profilename);

    document.querySelector('[data-quiet-send-button]').addEventListener('click',
        onClick: function(e) {
            var payload = document.querySelector('[data-quiet-text-input]').value;
            if (payload === "") {
                return
            }
            transmit(payload);
    }, false);
}();
