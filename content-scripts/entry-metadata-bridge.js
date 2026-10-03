// Runs in the page's MAIN world (not the extension's isolated world) so it can reach the
// tooltipster instance the timesheet attaches to every captured time. It copies the project
// and category out of that tooltip into data attributes, which the isolated content scripts
// can then read straight from the DOM without simulating hovers.
(function () {
    'use strict';

    if (window.__ENTRY_METADATA_BRIDGE_ALREADY_RUN__) {
        return;
    }
    window.__ENTRY_METADATA_BRIDGE_ALREADY_RUN__ = true;

    const UNTAGGED_CAPTURED_TIME_SELECTOR = ".timeEntry-capturedTime:not([data-tb-category])";

    function tagCapturedTimes() {
        const $ = window.jQuery;
        if (!$ || !$.fn.tooltipster) return;

        document.querySelectorAll(UNTAGGED_CAPTURED_TIME_SELECTOR).forEach((capturedTime) => {
            const $capturedTime = $(capturedTime);
            if (!$capturedTime.data('tooltipster-ns')) return;

            // Tooltip content is: Project, Category, Time, ... each as <strong>Label</strong><span>Value</span>
            const values = $($capturedTime.tooltipster('content')).find('span');
            if (values.length < 2) return;

            // Category is set last because the isolated world observes it as the "ready" signal
            capturedTime.dataset.tbProject = values.eq(0).text();
            capturedTime.dataset.tbCategory = values.eq(1).text();
        });
    }

    // Captured times are rebuilt whenever the week changes or an entry is added/edited/removed
    new MutationObserver(tagCapturedTimes).observe(document.body, { childList: true, subtree: true });
    tagCapturedTimes();
})();
