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
        observeSelection();
    })

    onFillChanged.push((entity) => {
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
        });

        const selected = getSelectedItem(PROJECT_PARENT_SELECTOR)
        if (selected) setActiveProject(selected)
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
                    onFillChanged.forEach((fn) => fn(entity))
                }
            });
        });

        const selected = getSelectedItem(CATEGORIES_PARENT_SELECTOR)
        if (selected) setActiveCategory(selected)

        return categories
    }

    // Following knockout's selection covers choices made from the "Other" dropdowns and the header
    // selects too, not only clicks on the items themselves
    function getSelectedItem(parentSelector) {
        const parent = document.querySelector(parentSelector)
        if (!parent) return undefined
        return Array.from(parent.querySelectorAll(LIST_ITEM_SELECTOR)).find(isSelectedListItem)
    }

    function observeSelection() {
        const parents = [PROJECT_PARENT_SELECTOR, CATEGORIES_PARENT_SELECTOR]
            .map((selector) => document.querySelector(selector))
            .filter(Boolean)

        const observer = new MutationObserver((mutations) => {
            // Ignore our own style writes on wrappers (e.g. pin ordering)
            const relevant = mutations.some((m) => m.type === 'childList' || m.target.classList.contains('timesheetlistitem'))
            if (!relevant) return;

            const selectedProject = getSelectedItem(PROJECT_PARENT_SELECTOR)
            if (selectedProject && selectedProject !== activeProject) {
                setActiveProject(selectedProject)
            }
            layoutCategories()
            restyleProjectsAndCategories()
        });

        parents.forEach((parent) => observer.observe(parent, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style']
        }));
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

    function getItemColor(entity) {
        return entity.style.getPropertyValue('--tb-color') || entity.style.borderColor
    }

    // reset (optional): { canReset: () => boolean, onReset: () => void } adds a "Reset" button to the picker
    function createFillButton(entity, onSave, reset) {
        const pickr = createPicker(getItemColor(entity) || '#8A8E93', !!reset);

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
            pickr.setColor(getItemColor(entity), true);
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

    // Colors are exposed as --tb-color and the selection as .tb-active; redesign.css decides how they look.
    // Knockout's own inline styles stay untouched and still hold the timesheet's default colors.
    function restyleProjectsAndCategories() {
        if (!data) return;

        projects.forEach((project) => {
            const stored = getStoredProjectData(project.innerText.trim())
            setItemColor(project, (stored && stored.color) || project.style.borderColor)
        });

        const activeProjectName = activeProject ? activeProject.innerText.trim() : undefined
        const storedProject = activeProjectName && getStoredProjectData(activeProjectName)
        categories.forEach((category) => {
            const stored = activeProjectName && getStoredCategoryData(activeProjectName, category.innerText.trim())
            // Knockout gives categories the project's default color as their border
            const color = (stored && stored.color) || (storedProject && storedProject.color) || category.style.borderColor
            setItemColor(category, color)
        });

        document.querySelectorAll(`${PROJECT_PARENT_SELECTOR} ${LIST_ITEM_SELECTOR}, ${CATEGORIES_PARENT_SELECTOR} ${LIST_ITEM_SELECTOR}`)
            .forEach((item) => item.classList.toggle('tb-active', isSelectedListItem(item)));

        if (activeCategory) {
            setActiveColor(getItemColor(activeCategory))
        }
    }

    function setItemColor(element, color) {
        // Only write on change: these writes are observed by observeSelection
        if (color && element.style.getPropertyValue('--tb-color') !== color) {
            element.style.setProperty('--tb-color', color);
        }
    }
})();
