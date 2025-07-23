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
            entity.parentElement.parentElement.style.setProperty('order', index + 2, 'important');
            createPinButton(entity, () => {
                if (entity.parentElement.parentElement.style.order != 1) {
                    entity.parentElement.parentElement.style.setProperty('order', 1, 'important');
                } else {
                    entity.parentElement.parentElement.style.setProperty('order', index + 2, 'important');
                }
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