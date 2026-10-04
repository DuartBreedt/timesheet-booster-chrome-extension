// main world so it can read the tooltipster instance on each captured time
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

            // tooltip content is <strong>Label</strong><span>Value</span> pairs: project, category, time, ...
            const values = $($capturedTime.tooltipster('content')).find('span');
            if (values.length < 2) return;

            // category goes last since the isolated world treats it as the ready signal
            capturedTime.dataset.tbProject = values.eq(0).text();
            capturedTime.dataset.tbCategory = values.eq(1).text();
        });
    }

    // captured times are rebuilt on week change and entry add/edit/remove
    new MutationObserver(tagCapturedTimes).observe(document.body, { childList: true, subtree: true });
    tagCapturedTimes();
})();
