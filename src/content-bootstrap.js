(function () {
    "use strict";

    var host = window.location.hostname.toLowerCase();
    var path = window.location.pathname;
    var isGoogleHost = /(^|\.)google\./.test(host);
    var isGoogleSearchSurface = path === "/search" || path === "/" || path === "/webhp";
    var isBingHost = host === "bing.com" || host === "www.bing.com";
    var isBingSearchSurface = path === "/search" || path === "/" || path === "/copilotsearch";

    if (isBingHost && isBingSearchSurface) {
        if (typeof window.runBingSearchCleaner === "function") {
            window.runBingSearchCleaner();
        }

        return;
    }

    if (!isGoogleHost || !isGoogleSearchSurface) {
        return;
    }

    if (typeof window.runGoogleSearchCleaner === "function") {
        window.runGoogleSearchCleaner();
    }
})();
