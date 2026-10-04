// main world so it can reorder knockout's visibleCategories and hiddenCategories
(function () {
    'use strict';

    if (window.__CATEGORY_OVERFLOW_BRIDGE_ALREADY_RUN__) {
        return;
    }
    window.__CATEGORY_OVERFLOW_BRIDGE_ALREADY_RUN__ = true;

    const CATEGORIES_PARENT_SELECTOR = "[data-bind='foreach: visibleCategories']";
    // the "Other" dropdown's slot in visibleCategories (see setCategories in timesheets' site script)
    const OVERFLOW_ID = -1;

    let viewModel;
    let pinnedByProject = {};
    // timesheets' own split for the selected project, so unpinning can put categories back where they were
    let baseline;
    let applying = false;

    function getViewModel() {
        const parent = document.querySelector(CATEGORIES_PARENT_SELECTOR);
        if (!parent || !window.ko) return undefined;
        const root = window.ko.dataFor(parent);
        return root && window.ko.isObservable(root.hiddenCategories) && window.ko.isObservable(root.visibleCategories)
            ? root : undefined;
    }

    function byName(a, b) {
        return String(a.Name).localeCompare(String(b.Name));
    }

    function apply() {
        if (!viewModel || !baseline) return;
        const project = viewModel.selectedProject();
        const pinned = new Set(pinnedByProject[String(project && project.Name).trim()] || []);
        const isPinned = (category) => pinned.has(String(category.Name).trim());

        const visible = baseline.visible.slice();
        const hidden = baseline.hidden.filter((category) => !isPinned(category));
        const promoted = baseline.hidden.filter(isPinned);

        // each promoted category takes the place of the rightmost visible one that isn't pinned
        promoted.forEach(() => {
            for (let i = visible.length - 1; i >= 0; i--) {
                if (!isPinned(visible[i])) {
                    hidden.push(visible.splice(i, 1)[0]);
                    return;
                }
            }
        });

        const nextVisible = promoted.concat(visible);
        if (hidden.length) nextVisible.push(baseline.overflow || { Id: OVERFLOW_ID });

        applying = true;
        try {
            viewModel.visibleCategories(nextVisible);
            viewModel.hiddenCategories(hidden.sort(byName));
        } finally {
            applying = false;
        }
    }

    // setCategories writes visibleCategories then hiddenCategories, so the second write means a fresh split
    function onHiddenCategoriesChanged() {
        if (applying) return;
        const visible = viewModel.visibleCategories();
        baseline = {
            visible: visible.filter((category) => category.Id !== OVERFLOW_ID),
            hidden: viewModel.hiddenCategories().slice(),
            overflow: visible.find((category) => category.Id === OVERFLOW_ID)
        };
        apply();
    }

    function init() {
        viewModel = getViewModel();
        if (!viewModel) return false;
        viewModel.hiddenCategories.subscribe(onHiddenCategoriesChanged);
        onHiddenCategoriesChanged();
        return true;
    }

    document.addEventListener('tb:pinned-categories', (event) => {
        try {
            pinnedByProject = JSON.parse(event.detail) || {};
        } catch (e) {
            return;
        }
        apply();
    });

    // knockout may bind after document_idle, so wait for the categories list if it isn't bound yet
    if (!init()) {
        const observer = new MutationObserver(() => {
            if (init()) observer.disconnect();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // the isolated world may have loaded its pins before this script ran
    document.dispatchEvent(new CustomEvent('tb:pinned-categories-request'));
})();
