(function () {
    'use strict';

    if (window.__ENTRY_RENDER_SCRIPT_ALREADY_RUN__) {
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
            });

            entity.addEventListener('click', () => {
                setActiveCategory(entity)
                // TODO: Restyle categories only
                restyleProjectsAndCategories();
            });

            if (entity.style.color == 'white') {
                setActiveCategory(entity)
            }
        });

        return categories
    }

    function createPicker(defaultColor) {
        const pickrContainer = document.createElement('div');
        document.body.appendChild(pickrContainer);

        return Pickr.create({
            el: pickrContainer,
            theme: 'classic',
            inline: false,
            default: defaultColor,
            components: {
                preview: true,
                hue: true,
                interaction: {
                    input: true,
                    save: true
                }
            }
        });
    }

    function createFillButton(entity, onSave) {
        const pickr = createPicker(getComputedStyle(entity).borderColor);

        const elem = document.createElement('button');
        elem.className = 'color-picker';

        const img = document.createElement('img');
        img.src = chrome.runtime.getURL("icons/paint-bucket.svg");
        img.style.width = '16px';
        img.style.height = '16px';

        elem.appendChild(img);
        entity.appendChild(elem);

        elem.addEventListener('click', (e) => {
            e.stopPropagation();
            pickr.show();
        });

        pickr.on('save', (color) => {
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
                            if (category) {
                                const isCategoryActive = category === activeCategory;
                                styleElement(category, isCategoryActive ? cat.color : '#FFFFFF', cat.color, isCategoryActive ? '#FFFFFF' : cat.color);
                            }
                        });
                    }
                }
            }
        });

        setActiveColor(getComputedStyle(activeCategory).borderColor)
    }

    function styleElement(element, bg, bc, c) {
        if (!element) return;
        if (bg) element.style.setProperty('background-color', bg, 'important');
        if (bc) element.style.setProperty('border-color', bc, 'important');
        if (c) element.style.setProperty('color', c, 'important');
    }
})();