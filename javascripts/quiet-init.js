var QuietInitializer = (function() {
    Quiet.setProfilesPrefix("javascripts/");
    Quiet.setMemoryInitializerPrefix("javascripts/");
    Quiet.setLibfecPrefix("javascripts/");

    function onDOMLoad() {
        var host = "quiet.github.io";
        if ((host == window.location.host) && (window.location.protocol != "https:"))
            window.location.protocol = "https";
    };

    document.addEventListener("DOMContentLoaded", onDOMLoad);
})();
