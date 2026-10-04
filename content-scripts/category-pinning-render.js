(function () {
    'use strict';

    if (window.__PINNING_RENDER_SCRIPT_ALREADY_RUN__) {
        return;
    }
    window.__PINNING_RENDER_SCRIPT_ALREADY_RUN__ = true;

    const OVERFLOW_ITEM_SELECTOR = `${CATEGORIES_PARENT_SELECTOR} .dropdown-menu li a`

    onDataLoaded.push(() => {
        sendPinnedCategories()
        observeCategories()
    })

    onActiveProjectChanged.push(() => {
        layoutPins()
    })

    document.addEventListener('tb:pinned-categories-request', sendPinnedCategories)

    // category-overflow-bridge.js swaps pinned categories out of the "Other" dropdown
    function sendPinnedCategories() {
        const pinned = {}
        data.forEach((projectData) => {
            const names = (projectData.categories || []).filter((c) => c.isPinned).map((c) => c.name)
            if (names.length) pinned[projectData.project] = names
        })
        document.dispatchEvent(new CustomEvent('tb:pinned-categories', { detail: JSON.stringify(pinned) }))
    }

    // promoting or demoting a category re-renders its node, which then needs its pin again
    function observeCategories() {
        const parent = document.querySelector(CATEGORIES_PARENT_SELECTOR)
        if (!parent) return;
        let scheduled = false
        new MutationObserver(() => {
            if (scheduled) return;
            scheduled = true
            requestAnimationFrame(() => {
                scheduled = false
                layoutPins()
            })
        }).observe(parent, { childList: true, subtree: true })
    }

    function layoutPins() {
        if (!activeProject) return;
        layoutOverflowPins()
        const categoryNodes = getAllCategories();
        categories = Array.from(categoryNodes);
        categories.forEach((entity, index) => {
            const categoryData = getStoredCategoryData(activeProject.innerText.trim(), entity.innerText.trim())
            const isPinned = categoryData && categoryData.isPinned
            const orderData = isPinned ? 1 : index + 2;

            entity.parentElement.parentElement.style.setProperty('order', orderData, 'important');

            // re-selecting the same project makes knockout reuse the category nodes, which already have a pin
            const existingPin = entity.querySelector(':scope > .pin')
            if (existingPin) {
                setPinnedState(existingPin, isPinned)
                return
            }

            const pin = createPinButton(entity, () => {
                const isPinned = entity.parentElement.parentElement.style.order != 1
                const order = isPinned ? 1 : index + 2;
                entity.parentElement.parentElement.style.setProperty('order', order, 'important');
                setPinnedState(pin, isPinned)

                const data = {
                    project: activeProject.innerText.trim(),
                    category: {
                        name: entity.innerText.trim(),
                        isPinned: isPinned
                    }
                }
                storeData(data);
                sendPinnedCategories()
            });
            setPinnedState(pin, isPinned)
        })
    }

    function layoutOverflowPins() {
        document.querySelectorAll(OVERFLOW_ITEM_SELECTOR).forEach((link) => {
            const name = link.textContent.trim()
            const categoryData = getStoredCategoryData(activeProject.innerText.trim(), name)
            const isPinned = !!(categoryData && categoryData.isPinned)

            const existingPin = link.querySelector(':scope > .pin')
            if (existingPin) {
                setPinnedState(existingPin, isPinned)
                return
            }

            const pin = createPinButton(link, () => {
                // bootstrap only closes the menu on a click that reaches the document, which the pin stops
                const dropdown = link.closest('.dropdown')
                if (dropdown) dropdown.classList.remove('open')
                storeData({
                    project: activeProject.innerText.trim(),
                    category: { name: name, isPinned: !pin.classList.contains('is-pinned') }
                })
                sendPinnedCategories()
            })
            setPinnedState(pin, isPinned)
        })
    }

    function setPinnedState(pin, isPinned) {
        pin.classList.toggle('is-pinned', !!isPinned);
        pin.setAttribute('aria-pressed', isPinned ? 'true' : 'false');
        pin.title = isPinned ? 'Unpin category' : 'Pin category';
        pin.setAttribute('aria-label', pin.title);
        pin.firstElementChild.src = chrome.runtime.getURL(isPinned ? "icons/pin-fill.svg" : "icons/pin.svg");
    }

    function createPinButton(entity, onPin) {
        const elem = document.createElement('button');
        elem.type = 'button';
        elem.className = 'pin';

        const img = document.createElement('img');
        img.src = chrome.runtime.getURL("icons/pin.svg");
        img.style.width = '16px';
        img.style.height = '16px';

        elem.appendChild(img);
        entity.appendChild(elem);

        elem.addEventListener('click', (e) => {
            // links in the "Other" dropdown would otherwise follow their href
            e.preventDefault();
            e.stopPropagation();
            onPin()
        });

        return elem
    }

})();