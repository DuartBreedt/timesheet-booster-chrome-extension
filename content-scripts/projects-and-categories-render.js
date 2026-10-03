(function () {
    'use strict';

    if (window.__RENDER_SCRIPT_ALREADY_RUN__) {
        return;
    }
    window.__RENDER_SCRIPT_ALREADY_RUN__ = true;

    // Run this function as soon as the data is loaded from local storage
    onDataLoaded.push(() => {
        layoutProjects();
        layoutCategories();
        restyleProjectsAndCategories();
    })

    onFillChanged.push((entity) => {
        // styleElement(entity, color.toHEXA().toString(), color.toHEXA().toString(), "#FFFFFF");
        // TODO: If it's a project, restyle this project and its categories only. If it is a category, just restyle it
        restyleProjectsAndCategories()
    })

    function layoutProjects() {
        const projectNodes = getAllProjects();
        projects = Array.from(projectNodes);
        projects.forEach((entity) => {
            createFillButton(entity, (color) => {
                const data = {
                    project: entity.innerText.trim(),
                    color: color.toHEXA().toString()
                };
                storeData(data);
                onFillChanged.forEach((fn) => fn(entity))
            });

            entity.addEventListener('click', () => {
                setActiveProject(entity)
                layoutCategories()
                restyleProjectsAndCategories()
            });

            if (entity.style.color == 'white') {
                setActiveProject(entity)
            }
        });
    }

    function setActiveProject(project) {
        activeProject = project
        onActiveProjectChanged.forEach((fn) => fn())
    }

    function setActiveCategory(category) {
        activeCategory = category
        onActiveCategoryChanged.forEach((fn) => fn())
    }

    function layoutCategories() {
        const categoryNodes = getAllCategories();
        categories = Array.from(categoryNodes);
        categories.forEach((entity) => {
            if (entity.style.color == 'white') {
                setActiveCategory(entity)
            }

            // Re-selecting the same project makes knockout reuse the category nodes
            if (entity.dataset.tbBound) return;
            entity.dataset.tbBound = 'true';

            createFillButton(entity, (color) => {
                const data = {
                    project: activeProject.innerText.trim(),
                    category: {
                        name: entity.innerText.trim(),
                        color: color.toHEXA().toString()
                    }
                };
                storeData(data);
                onFillChanged.forEach((fn) => fn(entity))
            }, {
                canReset: () => {
                    const categoryData = getStoredCategoryData(activeProject.innerText.trim(), entity.innerText.trim())
                    return !!(categoryData && categoryData.color)
                },
                onReset: () => {
                    clearCategoryColor(activeProject.innerText.trim(), entity.innerText.trim())

                    // Go back to the project's color, whether that is a stored one or the timesheet's own
                    const projectColor = getComputedStyle(activeProject).borderColor
                    const isActive = entity === activeCategory
                    styleElement(entity, isActive ? projectColor : '#FFFFFF', projectColor, isActive ? '#FFFFFF' : projectColor)
                    onFillChanged.forEach((fn) => fn(entity))
                }
            });

            entity.addEventListener('click', () => {
                setActiveCategory(entity)
                // TODO: Restyle categories only
                restyleProjectsAndCategories();
            });
        });

        return categories
    }

    function createPicker(defaultColor, withReset) {
        const pickrContainer = document.createElement('div');
        document.body.appendChild(pickrContainer);

        return Pickr.create({
            el: pickrContainer,
            theme: 'classic',
            inline: false,
            default: defaultColor,
            i18n: {
                'btn:clear': 'Reset',
                'aria:btn:clear': 'Reset to project color'
            },
            components: {
                preview: true,
                hue: true,
                interaction: {
                    input: true,
                    clear: withReset,
                    save: true
                }
            }
        });
    }

    // reset (optional): { canReset: () => boolean, onReset: () => void } adds a "Reset" button to the picker
    function createFillButton(entity, onSave, reset) {
        const pickr = createPicker(getComputedStyle(entity).borderColor, !!reset);

        const elem = document.createElement('button');
        elem.type = 'button';
        elem.className = 'color-picker';
        elem.title = 'Change color';
        elem.setAttribute('aria-label', 'Change color');
        elem.setAttribute('aria-expanded', 'false');

        const img = document.createElement('img');
        img.src = chrome.runtime.getURL("icons/paint-bucket.svg");
        img.style.width = '16px';
        img.style.height = '16px';

        elem.appendChild(img);
        entity.appendChild(elem);

        elem.addEventListener('click', (e) => {
            e.stopPropagation();
            // Open on the color the item currently has rather than the one it had at page load
            pickr.setColor(getComputedStyle(entity).borderColor, true);
            pickr.show();
        });

        pickr.on('show', () => {
            if (reset) {
                // Only offer a reset when there is a custom color to remove
                pickr.getRoot().interaction.clear.style.display = reset.canReset() ? '' : 'none';
            }
            elem.classList.add('is-open');
            elem.setAttribute('aria-expanded', 'true');
        });

        pickr.on('hide', () => {
            elem.classList.remove('is-open');
            elem.setAttribute('aria-expanded', 'false');
        });

        pickr.on('save', (color) => {
            // Pickr's clear button saves a null color
            if (!color) {
                if (reset) reset.onReset();
                pickr.hide();
                return;
            }
            onSave(color);
            pickr.hide();
        });
    }

    function restyleProjectsAndCategories() {
        if (!data) return;

        const projectMap = new Map(projects.map(p => [p.innerText.trim(), p]));
        const categoryMap = new Map(categories.map(c => [c.innerText.trim(), c]));

        data.forEach((item) => {
            const project = projectMap.get(item.project);
            if (project) {
                const isProjectActive = project === activeProject;
                styleElement(project, isProjectActive ? item.color : '#FFFFFF', item.color, isProjectActive ? '#FFFFFF' : item.color);

                if (isProjectActive) {
                    // Style all categories with the project color first
                    if (item.color) {
                        categories.forEach((cat) => styleElement(cat, '#FFFFFF', item.color, item.color));
                    }
                    if (item.color && activeCategory) {
                        styleElement(activeCategory, item.color, item.color, '#FFFFFF');
                    }

                    if (item.categories) {
                        item.categories.forEach((cat) => {
                            const category = categoryMap.get(cat.name);
                            // Categories that were only pinned have no color of their own
                            if (category && cat.color) {
                                const isCategoryActive = category === activeCategory;
                                styleElement(category, isCategoryActive ? cat.color : '#FFFFFF', cat.color, isCategoryActive ? '#FFFFFF' : cat.color);
                            }
                        });
                    }
                }
            }
        });

        // Lets the pin/fill buttons pick up their item's color for hover, focus and selected states
        [...projects, ...categories].forEach((entity) => {
            entity.style.setProperty('--tb-color', getComputedStyle(entity).borderColor);
        });

        if (activeCategory) {
            setActiveColor(getComputedStyle(activeCategory).borderColor)
        }
    }

    function styleElement(element, bg, bc, c) {
        if (!element) return;
        if (bg) element.style.setProperty('background-color', bg, 'important');
        if (bc) element.style.setProperty('border-color', bc, 'important');
        if (c) element.style.setProperty('color', c, 'important');
    }
})();