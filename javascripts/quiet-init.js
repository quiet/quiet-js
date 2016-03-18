var QuietInitializer = (function() {
    Quiet.init({
        profilesPrefix: "javascripts/",
        memoryInitializerPrefix: "javascripts/",
        libfecPrefix: "javascripts/"
    });

    function onDOMLoad() {
        var host = "quiet.github.io";
        if ((host == window.location.host) && (window.location.protocol != "https:"))
            window.location.protocol = "https";
    };

    document.addEventListener("DOMContentLoaded", onDOMLoad);
})();
