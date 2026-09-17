(function () {
    "use strict";

    var COPILOT_PATH_GUARD_KEY = "__chrome_remove_ai_bing_copilot_guard";
    var COPILOT_GUARD_WINDOW_MS = 5000;
    var COPILOT_GUARD_MAX_ATTEMPTS = 2;

    // Determines if the Bing search URL can be normalized to remove the copilot path.
    function canAttemptPathNormalization() {
        try {
            var rawValue = window.sessionStorage.getItem(COPILOT_PATH_GUARD_KEY);
            var previous = rawValue ? JSON.parse(rawValue) : null;
            var now = Date.now();
            var nextState = {
                ts: now,
                count: 1
            };

            if (previous && now - previous.ts < COPILOT_GUARD_WINDOW_MS) {
                nextState.count = previous.count + 1;
            }

            window.sessionStorage.setItem(COPILOT_PATH_GUARD_KEY, JSON.stringify(nextState));
            return nextState.count <= COPILOT_GUARD_MAX_ATTEMPTS;
        } catch (error) {
            return true;
        }
    }

    // Normalizes the Bing search URL by removing the copilot path if present. 
    // Returns true if the URL was normalized and the page was redirected, false otherwise.
    function normalizeBingSearchUrl() {
        var url;

        try {
            url = new URL(window.location.href);
        } catch (error) {
            return false;
        }

        if (url.pathname !== "/copilotsearch") {
            return false;
        }

        if (!canAttemptPathNormalization()) {
            return false;
        }

        url.pathname = "/search";

        var nextUrl = url.toString();
        if (nextUrl === window.location.href) {
            return false;
        }

        window.location.replace(nextUrl);
        return true;
    }

    // Removes the copilot scope list items from the given root element.
    // This is suggestion on the search page, that points to the copilot search feature.
    function removeCopilotScopeListItem(root) {
        if (!root || typeof root.querySelectorAll !== "function") {
            return 0;
        }

        var removedCount = 0;
        var items = root.querySelectorAll("li#b-scopeListItem-copilotsearch, li#b-scopeListItem-conv");

        for (var i = 0; i < items.length; i += 1) {
            if (!items[i].isConnected) {
                continue;
            }

            items[i].remove();
            removedCount += 1;
        }

        return removedCount;
    }

    // Removes the copilot bottom UI elements from page
    function removeCopilotBottomUi(root) {
        if (!root || typeof root.querySelectorAll !== "function") {
            return 0;
        }

        var removedCount = 0;
        // the selectors for the copilot bottom UI elements, this can be extended if new elements are added in the future.
        // THIS LIST MAY NEED TO BE UPDATED IF MICROSOFT change the design.
        var selectors = [
            "#b_copilot_search_container",
            "#b_copilot_search",
            "#copans_container",
            "a#b_bop_cs_inst[href*='/copilotsearch']",
            ".suggestion_wrapper a.suggestion_chip[href*='/copilotsearch']"
        ];

        for (var i = 0; i < selectors.length; i += 1) {
            var items = root.querySelectorAll(selectors[i]);
            for (var j = 0; j < items.length; j += 1) {
                if (!items[j].isConnected) {
                    continue;
                }

                items[j].remove();
                removedCount += 1;
            }
        }

        var composerInputs = root.querySelectorAll("textarea.b_copilot_composer");
        for (var k = 0; k < composerInputs.length; k += 1) {
            if (!composerInputs[k].isConnected) {
                continue;
            }

            var placeholder = (composerInputs[k].getAttribute("placeholder") || "").toLowerCase();
            if (placeholder.indexOf("oppf") === -1 && placeholder.indexOf("follow") === -1) {
                continue;
            }

            var removable = composerInputs[k].closest("#b_copilot_search, #b_copilot_search_container, .b_bop_cs_sb") || composerInputs[k];
            if (removable && removable.isConnected) {
                removable.remove();
                removedCount += 1;
            }
        }

        return removedCount;
    }

    function startBingCleaner() {
        if (normalizeBingSearchUrl()) {
            return;
        }

        if (!document.documentElement) {
            return;
        }

        var queued = false;
        var scheduleSweep = function () {
            if (queued) {
                return;
            }

            queued = true;
            window.requestAnimationFrame(function () {
                queued = false;
                removeCopilotScopeListItem(document);
                removeCopilotBottomUi(document);
            });
        };

        removeCopilotScopeListItem(document);
        removeCopilotBottomUi(document);

        var observeWhenReady = function () {
            if (!document.body) {
                scheduleSweep();
                window.requestAnimationFrame(observeWhenReady);
                return;
            }

            var observer = new MutationObserver(function (mutations) {
                for (var i = 0; i < mutations.length; i += 1) {
                    if (mutations[i].addedNodes && mutations[i].addedNodes.length > 0) {
                        scheduleSweep();
                        return;
                    }
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        };

        observeWhenReady();
    }

    window.runBingSearchCleaner = startBingCleaner;
})();
