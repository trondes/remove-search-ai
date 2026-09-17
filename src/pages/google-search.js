(function () {
    "use strict";

    var UDM_GUARD_KEY = "__chrome_remove_ai_udm50_guard";
    var UDM_GUARD_WINDOW_MS = 5000;
    var UDM_GUARD_MAX_ATTEMPTS = 2;

    // Patterns to identify AI-related content in the search results, in various languages.
    // Do we nned any other?
    var AI_OVERVIEW_PATTERNS = [
        /\bai\s*overview\b/i,
        /\boverview\b[^\n]{0,20}\bai\b/i,
        /\bai\b[^\n]{0,20}\boverview\b/i,
        /\bapercu\b[^\n]{0,20}\bai\b/i,
        /\baperçu\b[^\n]{0,20}\bai\b/i,
        /\bresumen\b[^\n]{0,20}\bia\b/i,
        /\bresumo\b[^\n]{0,20}\bia\b/i,
        /\boversikt\b[^\n]{0,20}\bai\b/i,
        /\bübersicht\b[^\n]{0,20}\bai\b/i,
        /\bpanoramica\b[^\n]{0,20}\bai\b/i,
        /\bpanoramique\b[^\n]{0,20}\bai\b/i,
        /\bvis[aã]o\s+geral\b[^\n]{0,20}\bia\b/i,
        /\bgenel\s+bak[ıi]ş\b[^\n]{0,20}\bai\b/i,
        /\boverzicht\b[^\n]{0,20}\bai\b/i,
        /\bобзор\b[^\n]{0,20}\bии\b/i,
        /\b개요\b[^\n]{0,20}\bai\b/i,
        /\b概要\b[^\n]{0,20}\bai\b/i,
        /\b概览\b[^\n]{0,20}\bai\b/i,
        /\bshow\s+more\b[^\n]{0,30}\bai\b/i,
        /\bvis\s+mer\b[^\n]{0,30}\bai\b/i
    ];

    var AI_MODE_PATTERNS = [
        /\bai\s*mode\b/i,
        /\bmode\s*ia\b/i,
        /\bmodo\s*ia\b/i,
        /\bmodus\s*ai\b/i,
        /\bрежим\s*ии\b/i,
        /\bai\s*모드\b/i,
        /\baiモード\b/i,
        /\bai模式\b/i,
        /\bask\s+google\b/i
    ];

    function matchesAnyPattern(text, patterns) {
        if (!text) {
            return false;
        }

        for (var i = 0; i < patterns.length; i += 1) {
            if (patterns[i].test(text)) {
                return true;
            }
        }

        return false;
    }

    function isAiRoute(href) {
        if (!href) {
            return false;
        }

        var normalizedHref = href.toLowerCase();
        return /[?&]udm=50(?:[&#]|$)/i.test(normalizedHref) || /[?&]tbm=aim(?:[&#]|$)/i.test(normalizedHref);
    }

    function canAttemptUrlNormalization() {
        try {
            var rawValue = window.sessionStorage.getItem(UDM_GUARD_KEY);
            var previous = rawValue ? JSON.parse(rawValue) : null;
            var now = Date.now();
            var nextState = {
                ts: now,
                count: 1
            };

            if (previous && now - previous.ts < UDM_GUARD_WINDOW_MS) {
                nextState.count = previous.count + 1;
            }

            window.sessionStorage.setItem(UDM_GUARD_KEY, JSON.stringify(nextState));
            return nextState.count <= UDM_GUARD_MAX_ATTEMPTS;
        } catch (error) {
            return true;
        }
    }

    // look for AI-related query parameters in the Google search URL. Remove if found.
    function normalizeGoogleSearchUrl() {
        var url;

        try {
            url = new URL(window.location.href);
        } catch (error) {
            return false;
        }

        // this is the option that indicates the AI mode is enabled. 
        // This can be changed if Google updates the page
        var shouldRemoveUdm = url.searchParams.get("udm") === "50";
        var shouldRemoveAtvm = url.searchParams.get("atvm") === "2";

        if (!shouldRemoveUdm && !shouldRemoveAtvm) {
            return false;
        }

        if (!canAttemptUrlNormalization()) {
            return false;
        }

        if (shouldRemoveUdm) {
            url.searchParams.delete("udm");
        }

        if (shouldRemoveAtvm) {
            url.searchParams.delete("atvm");
        }

        var nextUrl = url.toString();
        if (nextUrl === window.location.href) {
            return false;
        }

        window.location.replace(nextUrl);
        return true;
    }

    function getSignalText(element) {
        var textParts = [];

        if (element.textContent) {
            textParts.push(element.textContent.trim());
        }

        var ariaLabel = element.getAttribute("aria-label");
        if (ariaLabel) {
            textParts.push(ariaLabel);
        }

        var title = element.getAttribute("title");
        if (title) {
            textParts.push(title);
        }

        var dataTooltip = element.getAttribute("data-tooltip");
        if (dataTooltip) {
            textParts.push(dataTooltip);
        }

        return textParts.join(" ").trim();
    }

    function elementMatchesAiSignals(element) {
        if (!(element instanceof Element)) {
            return false;
        }

        if (element.matches('[data-aim="1"], [data-async-type="folsrch"]')) {
            return true;
        }

        if (element.matches('[jsname="cUzNTd"][role="heading"], [jsname="rPRdsc"], #m-x-content')) {
            return true;
        }

        if (element.matches('[data-subtree="aimc"], [data-vt-mb*="aimc"]')) {
            return true;
        }

        var href = element.getAttribute("href");
        if (isAiRoute(href)) {
            return true;
        }

        var signalText = getSignalText(element);
        if (!signalText) {
            return false;
        }

        if (matchesAnyPattern(signalText, AI_OVERVIEW_PATTERNS)) {
            return true;
        }

        if (matchesAnyPattern(signalText, AI_MODE_PATTERNS)) {
            return true;
        }

        return false;
    }

    function isAiOverviewHeading(element) {
        if (!element || !(element instanceof Element)) {
            return false;
        }

        if (element.getAttribute("jsname") === "cUzNTd" && element.getAttribute("role") === "heading") {
            return true;
        }

        return matchesAnyPattern(getSignalText(element), AI_OVERVIEW_PATTERNS);
    }

    function findNearestAncestorContainingAimc(element) {
        var current = element;

        for (var depth = 0; current && depth < 12; depth += 1) {
            if (current.matches("html, body, #main, [role='main']")) {
                return null;
            }

            if (current.querySelector('[data-subtree="aimc"], [data-vt-mb*="aimc"]')) {
                return current;
            }

            current = current.parentElement;
        }

        return null;
    }

    function findSafeRemovableContainer(element) {
        if (!element || !(element instanceof Element)) {
            return null;
        }

        if (element.matches('[data-aim="1"], [data-async-type="folsrch"]')) {
            // Remove the whole AI module wrapper to prevent empty reserved space.
            var aiLoadingContainer = element.closest('[data-mcpr], .YzCcne, .hICk5e, [data-subtree="mfc"]');
            return aiLoadingContainer || element;
        }

        var directAimc = element.closest('[data-subtree="aimc"], [data-vt-mb*="aimc"]');
        if (directAimc) {
            var moduleContainer = directAimc.closest('[data-subtree="mfc"], .hICk5e, .XTvndd, .Pqkn2e');
            return moduleContainer || directAimc;
        }

        if (isAiOverviewHeading(element) || element.matches('[aria-label*="AI Overview" i]')) {
            var headingContainer = findNearestAncestorContainingAimc(element);
            if (headingContainer) {
                var overviewModule = headingContainer.closest('[data-subtree="mfc"], .hICk5e, .XTvndd, .Pqkn2e');
                return overviewModule || headingContainer;
            }
        }

        if (element.matches("a, [role='tab'], [role='button'], button") || element.closest("a, [role='tab'], [role='button'], button")) {
            return element.closest("[role='listitem'], [role='tab'], [role='button'], button, a") || element;
        }

        return element;
    }

    // Removes AI-related modules and nodes from the given root element. This includes both structured AI modules and individual AI-related nodes.
    // This can change if Google updates the structure of AI-related modules.
    function removeAiModulesByStructure(root) {
        var removedCount = 0;
        var modules = root.querySelectorAll('[data-subtree="mfc"], .hICk5e');

        for (var i = 0; i < modules.length; i += 1) {
            var module = modules[i];
            if (!module.isConnected) {
                continue;
            }

            var hasAiSignals = module.querySelector(
                '[data-subtree="aimc"], [data-vt-mb*="aimc"], [jsname="cUzNTd"][role="heading"], [jsname="rPRdsc"], #m-x-content, [data-aim="1"], [data-async-type="folsrch"]'
            );

            if (!hasAiSignals) {
                continue;
            }

            var removable = module.closest('.hICk5e, [data-subtree="mfc"]') || module;
            if (removable && removable.isConnected) {
                removable.remove();
                removedCount += 1;
            }
        }

        return removedCount;
    }

    function removeAiNodesInRoot(root) {
        var removedCount = removeAiModulesByStructure(root);

        var selectors = [
            '[data-subtree="aimc"]',
            '[data-vt-mb*="aimc"]',
            '[data-aim="1"]',
            '[data-async-type="folsrch"]',
            '[aria-label*="AI Overview"]',
            '[aria-label*="AI overview"]',
            '[aria-label*="AI Mode"]',
            '[aria-label*="AI mode"]',
            '[jsname="cUzNTd"][role="heading"]',
            '[jsname="rPRdsc"]',
            'a[href*="udm=50"]',
            'a[href*="tbm=aim"]',
            'button',
            '[role="button"]',
            '[role="tab"]',
            '[role="listitem"]',
            'a[href]'
        ];

        var candidates = new Set();

        for (var i = 0; i < selectors.length; i += 1) {
            var nodeList = root.querySelectorAll(selectors[i]);
            for (var j = 0; j < nodeList.length; j += 1) {
                candidates.add(nodeList[j]);
            }
        }

        candidates.forEach(function (candidate) {
            if (!candidate.isConnected) {
                return;
            }

            if (!elementMatchesAiSignals(candidate)) {
                return;
            }

            var removableNode = findSafeRemovableContainer(candidate);
            if (removableNode && removableNode.isConnected) {
                removableNode.remove();
                removedCount += 1;
            }
        });

        return removedCount;
    }

    // Remove info, but keep the title of the "People Also Ask" section.
    function disablePeopleAlsoAskInRoot(root) {
        var paaRows = root.querySelectorAll(".related-question-pair");

        for (var i = 0; i < paaRows.length; i += 1) {
            var row = paaRows[i];

            if (!row || !row.isConnected) {
                continue;
            }

            var trigger = row.querySelector('[jsname="tJHJj"][role="button"], [jsname="tJHJj"]');
            if (trigger) {
                trigger.setAttribute("aria-expanded", "false");
                trigger.style.cursor = "default";
                trigger.removeAttribute("jsaction");

                if (!trigger.hasAttribute("data-crai-paa-disabled")) {
                    var blockHandler = function (event) {
                        event.preventDefault();
                        event.stopPropagation();
                        event.stopImmediatePropagation();
                    };

                    trigger.addEventListener("click", blockHandler, true);
                    trigger.addEventListener("mousedown", blockHandler, true);
                    trigger.addEventListener("pointerdown", blockHandler, true);
                    trigger.addEventListener("touchstart", blockHandler, true);
                    trigger.addEventListener("keydown", function (event) {
                        var key = event.key;
                        if (key === "Enter" || key === " " || key === "Spacebar") {
                            event.preventDefault();
                            event.stopPropagation();
                            event.stopImmediatePropagation();
                        }
                    }, true);

                    trigger.setAttribute("data-crai-paa-disabled", "1");
                }
            }

            var arrowContainer = row.querySelector('[jsname="Q8Kwad"], [jsname="wgPSWd"], .p8Jhnd');
            if (arrowContainer && arrowContainer.isConnected) {
                arrowContainer.remove();
            }

            var expandedAnswer = row.querySelector('[jsname="NRdf4c"], .bCOlv');
            if (expandedAnswer && expandedAnswer.isConnected) {
                expandedAnswer.remove();
            }
        }
    }

    // this will only work on google.com it will not in new tabs. But if the user click on it, 
    // page will be redirected to google and AI will be removed
    function removeInputBoxAiModeButton(root) {
        var aiButtons = root.querySelectorAll('[jsname="B6rgad"], button.plR5qb, form[role="search"] button, form[action="/search"] button, form[role="search"] [role="button"], form[action="/search"] [role="button"], form[role="search"] a[href], form[action="/search"] a[href]');

        for (var i = 0; i < aiButtons.length; i += 1) {
            var button = aiButtons[i];
            if (!button || !button.isConnected) {
                continue;
            }

            var searchForm = button.closest('form[role="search"], form[action="/search"]');
            if (!searchForm) {
                continue;
            }

            var signalText = getSignalText(button);
            var ariaLabel = button.getAttribute("aria-label") || "";
            var href = button.getAttribute("href") || "";
            var className = button.className || "";

            var hasAiSignal =
                !!button.querySelector('[jsname="IVmF1e"], [jsname="HQj0A"], .lTxWLe') ||
                matchesAnyPattern(signalText, AI_MODE_PATTERNS) ||
                matchesAnyPattern(ariaLabel, AI_MODE_PATTERNS) ||
                isAiRoute(href) ||
                /\bplr5qb\b/i.test(className);

            if (!hasAiSignal) {
                continue;
            }

            var slotContainer = button.closest('.WMDtKb, .CcxW7b, .BznTFe, [jsname="IVmF1e"], [jsname="HQj0A"]');
            if (slotContainer && slotContainer.isConnected && slotContainer !== button) {
                if (slotContainer.matches('.WMDtKb')) {
                    slotContainer.remove();
                    continue;
                }
            }

            var compactContainer = button.closest('.plR5qb, .CcxW7b, .BznTFe');
            if (compactContainer && compactContainer !== searchForm && compactContainer.isConnected) {
                compactContainer.remove();
                continue;
            }

            button.remove();
        }
    }

    function startGoogleCleaner() {
        if (normalizeGoogleSearchUrl()) {
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
                removeAiNodesInRoot(document);
                disablePeopleAlsoAskInRoot(document);
                removeInputBoxAiModeButton(document);
            });
        };

        removeAiNodesInRoot(document);
        disablePeopleAlsoAskInRoot(document);
        removeInputBoxAiModeButton(document);

        var observer = new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i += 1) {
                if (mutations[i].addedNodes && mutations[i].addedNodes.length > 0) {
                    scheduleSweep();
                    return;
                }
            }
        });

        var observeWhenReady = function () {
            if (!document.body) {
                window.setTimeout(observeWhenReady, 25);
                return;
            }

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            scheduleSweep();
        };

        observeWhenReady();
    }

    window.runGoogleSearchCleaner = startGoogleCleaner;
})();
