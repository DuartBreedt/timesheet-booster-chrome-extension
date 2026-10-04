(function () {
    'use strict';

    if (window.__ENTRY_RENDER_SCRIPT_ALREADY_RUN__) {
        return;
    }
    window.__ENTRY_RENDER_SCRIPT_ALREADY_RUN__ = true;

    const TIME_ENTRY_SELECTOR = ".timeEntry-quaterhour";
    const ENTIRE_ENTRY_SELECTOR = ".timeEntry-entry";
    // tagged by entry-metadata-bridge.js
    const CAPTURED_TIME_SELECTOR = ".timeEntry-capturedTime[data-tb-category]";

    onDataLoaded.push(() => {
        styleAllCapturedEntries()
        setupEventListeners()
    })

    onFillChanged.push((entity) => {
        styleAllCapturedEntries()
    })

    function handleTimeEntryMouseOver(event) {
        if (!activeCategory) return;

        const timeEntry = event.target.closest(TIME_ENTRY_SELECTOR)
        if (!timeEntry) return;

        const entireEntry = timeEntry.parentElement

        // an open .timeEntry-container means the entry is being captured
        if (entireEntry.parentElement.querySelector('.timeEntry-container')) return;

        const timeEntries = entireEntry.querySelectorAll(TIME_ENTRY_SELECTOR);
        const currentItemNumber = parseInt(timeEntry.getAttribute('item-number'), 10);

        timeEntries.forEach(entry => {
            const itemNumber = parseInt(entry.getAttribute('item-number'), 10);
            if (itemNumber <= currentItemNumber) {
                entry.classList.add('active-background')
            } else {
                entry.classList.remove('active-background')
            }
        });
    }

    function handleEntryMouseOut(event) {
        const entireEntry = event.target.closest(ENTIRE_ENTRY_SELECTOR)
        // mouseleave semantics on a delegated mouseout
        if (!entireEntry || entireEntry.contains(event.relatedTarget)) return;
        restoreAllOriginalColors(entireEntry)
    }

    function restoreAllOriginalColors(entireEntry) {
        // keep the highlight while the entry is being captured
        if (!entireEntry.parentElement.querySelector('.timeEntry-container')) {
            entireEntry.querySelectorAll(TIME_ENTRY_SELECTOR).forEach(timeEntries => {
                timeEntries.classList.remove('active-background')
            });
        }
    }

    function handleEntryClicked(event) {
        const entireEntry = event.target.closest(ENTIRE_ENTRY_SELECTOR)
        if (!entireEntry) return;
        const banner = entireEntry.parentElement.querySelector(".timeEntry-container .timeEntry-banner")
        if (banner) banner.classList.add('active-background')
    }

    function setupEventListeners() {
        // delegated so entries rendered later (week nav, added/removed entries) are covered
        document.addEventListener('mouseover', handleTimeEntryMouseOver);
        document.addEventListener('mouseout', handleEntryMouseOut);
        document.addEventListener('click', handleEntryClicked);

        // the bridge tags captured times after timesheets re-render them
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => styleCapturedEntry(mutation.target))
        });

        observer.observe(document.body, {
            subtree: true,
            attributes: true,
            attributeFilter: ['data-tb-category']
        });
    }

    function styleAllCapturedEntries() {
        document.querySelectorAll(CAPTURED_TIME_SELECTOR).forEach(styleCapturedEntry)
    }

    function styleCapturedEntry(capturedTime) {
        const project = capturedTime.dataset.tbProject
        const category = capturedTime.dataset.tbCategory
        if (project === undefined || category === undefined) return;

        // birthdays get their own look in redesign.css instead of the category colour
        if (isBirthdayEntry(project, category)) {
            if (capturedTime.dataset.tbSpecial === 'birthday') return;
            capturedTime.dataset.tbSpecial = 'birthday'
            const day = capturedTime.closest('.timeEntry')
            document.dispatchEvent(new CustomEvent('tb:birthday-shown', {
                detail: JSON.stringify({ date: (day && day.dataset.tbDate) || '' })
            }))
            return;
        }

        // remember timesheets' own color so it can be restored later
        if (capturedTime.dataset.tbOriginalColor === undefined) {
            capturedTime.dataset.tbOriginalColor = capturedTime.style.backgroundColor
        }

        const bg = getColorFromData(project, category)
        if (bg) {
            capturedTime.style.setProperty('background-color', bg, 'important');
        } else {
            capturedTime.style.removeProperty('background-color');
            capturedTime.style.backgroundColor = capturedTime.dataset.tbOriginalColor;
        }
    }

})();
