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
            createPinButton(entity, () => {
                const isPinned = entity.parentElement.parentElement.style.order != 1
                const order = isPinned ? 1 : index + 2;
                entity.parentElement.parentElement.style.setProperty('order', order, 'important');

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
        })
    }

    function createPinButton(entity, onPin) {
        const elem = document.createElement('button');
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
    }

})();