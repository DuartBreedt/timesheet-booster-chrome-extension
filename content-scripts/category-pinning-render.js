(function () {
    'use strict';

    if (window.__PINNING_RENDER_SCRIPT_ALREADY_RUN__) {
        return;
    }
    window.__PINNING_RENDER_SCRIPT_ALREADY_RUN__ = true;

    onActiveProjectChanged.push(() => {
        layoutPins()
    })

    function layoutPins() {
        const categoryNodes = getAllCategories();
        categories = Array.from(categoryNodes);
        categories.forEach((entity, index) => {
            const categoryData = getStoredCategoryData(activeProject.innerText.trim(), entity.innerText.trim())
            const isPinned = categoryData && categoryData.isPinned
            const orderData = isPinned ? 1 : index + 2;

            entity.parentElement.parentElement.style.setProperty('order', orderData, 'important');

            // Re-selecting the same project makes knockout reuse the category nodes, which already have a pin
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

                // Update data
                const data = {
                    project: activeProject.innerText.trim(),
                    category: {
                        name: entity.innerText.trim(),
                        isPinned: isPinned
                    }
                }
                storeData(data);
            });
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
            e.stopPropagation();
            onPin()
        });

        return elem
    }

})();