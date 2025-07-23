(function () {
    'use strict';

    if (window.__SETUP_SCRIPT_ALREADY_RUN__) {
        return;
    }
    window.__SETUP_SCRIPT_ALREADY_RUN__ = true;


    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    }

    function init() {
        chrome.storage.sync.get(STORAGE_KEY_PROJECTS, (storeData) => {
            data = storeData.projects || [];
            onDataLoaded.forEach((fn) => fn())
        });
    }
})();