(function () {
    'use strict';

    if (window.__ENTRY_RENDER_SCRIPT_ALREADY_RUN__) {
        return;
    }
    window.__ENTRY_RENDER_SCRIPT_ALREADY_RUN__ = true;

    const TIME_ENTRY_SELECTOR = ".timeEntry-quaterhour";

    let entireEntries

    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    }

    function handleTimeEntryMouseEnter(event) {
        if (!activeCategory) return;

        const entireEntry = event.currentTarget.parentElement

        // If an entry is being captured don't handle mouseover
        if (entireEntry.parentElement.querySelector('.timeEntry-container')) return;

        const timeEntries = entireEntry.querySelectorAll(TIME_ENTRY_SELECTOR);
        const currentItemNumber = parseInt(event.currentTarget.getAttribute('item-number'), 10);

        timeEntries.forEach(entry => {
            const itemNumber = parseInt(entry.getAttribute('item-number'), 10);
            if (itemNumber <= currentItemNumber) {
                entry.classList.add('active-background')
            } else {
                entry.classList.remove('active-background')
            }
        });
    }

    function restoreAllOriginalColors(entireEntry) {
        // If an entry is being captured don't restore colors on mouseleave
        if (!entireEntry.parentElement.querySelector('.timeEntry-container')) {
            entireEntry.querySelectorAll(TIME_ENTRY_SELECTOR).forEach(timeEntries => {
                timeEntries.classList.remove('active-background')
            });
        }
    }

    function onEntryClicked(entry) {
        entry.parentElement.querySelector(".timeEntry-container .timeEntry-banner").classList.add('active-background')
    }

    function setupEventListeners() {
        entireEntries.forEach(entry => {
            setupEntryListeners(entry)

            const observer = new MutationObserver((mutations, obs) => {
                setupEntryListeners(entry)
                styleCapturedEntries(entry)
            });

            observer.observe(entry, {
                childList: true,
                subtree: true
            });
        })
    }

    function setupEntryListeners(entry) {

        entry.addEventListener('mouseleave', () => restoreAllOriginalColors(entry));
        entry.addEventListener('click', () => onEntryClicked(entry));

        entry.querySelectorAll(TIME_ENTRY_SELECTOR).forEach(entry => {
            entry.addEventListener('mouseenter', handleTimeEntryMouseEnter);
        });
    }

    function init() {
        entireEntries = document.querySelectorAll(".timeEntry-entry");
        // Run this function as soon as the data is loaded from local storage
        onDataLoaded.push(() => entireEntries.forEach((entry) => styleCapturedEntries(entry)))
        setupEventListeners()
    }

    function styleCapturedEntries(entry) {
        entry.querySelectorAll('.timeEntry-capturedTime').forEach(capturedTime => {
            capturedTime.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
            const toolTipContainer = document.getElementsByClassName('timeEntry-tooltip')[0]
            const tooltipContent = toolTipContainer.firstElementChild.firstElementChild
            const project = tooltipContent.firstElementChild.querySelector('span').innerText
            const category = tooltipContent.children[1].querySelector('span').innerText
            toolTipContainer.remove()
            const bg = getColorFromData(project, category)
            if (bg) {
                capturedTime.style.setProperty('background-color', bg, 'important');
            }
        })
    }

})();