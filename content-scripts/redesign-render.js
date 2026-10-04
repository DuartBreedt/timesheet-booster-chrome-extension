(function () {
    'use strict';

    if (window.__REDESIGN_RENDER_SCRIPT_ALREADY_RUN__) {
        return;
    }
    window.__REDESIGN_RENDER_SCRIPT_ALREADY_RUN__ = true;

    const LIST_SELECTORS = [PROJECT_PARENT_SELECTOR, CATEGORIES_PARENT_SELECTOR];

    onDataLoaded.push(() => {
        renderHeader()
        syncListDecorations()
        observeLists()
    })

    function renderHeader() {
        const projectsParent = document.querySelector(PROJECT_PARENT_SELECTOR)
        const column = projectsParent && projectsParent.closest('.span9')
        if (!column || column.querySelector('.tb-header')) return;

        const header = document.createElement('div')
        header.className = 'tb-header'
        header.innerHTML = `<h1 class="tb-title">${tbIcon('clock')}<span>Timesheet Capture</span></h1>`
        column.prepend(header)
    }

    function getInitials(name) {
        const words = name.replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean)
        return words.slice(0, 2).map((w) => w[0].toUpperCase()).join('')
    }

    function syncListDecorations() {
        LIST_SELECTORS.forEach((selector) => {
            document.querySelectorAll(`${selector} ${LIST_ITEM_SELECTOR}`).forEach((item) => {
                const name = item.textContent.trim()
                const initial = item.classList.contains('dropdown-toggle') ? '···' : getInitials(name)
                if (item.dataset.tbInitial !== initial) item.dataset.tbInitial = initial
                // chips truncate long names
                if (item.title !== name) item.title = name
            })
        })
    }

    function observeLists() {
        let scheduled = false
        const observer = new MutationObserver(() => {
            if (scheduled) return;
            scheduled = true
            requestAnimationFrame(() => {
                scheduled = false
                syncListDecorations()
            })
        })

        LIST_SELECTORS.forEach((selector) => {
            const parent = document.querySelector(selector)
            if (parent) observer.observe(parent, { childList: true, subtree: true })
        })
    }
})();
