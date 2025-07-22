if (window.__RENDER_SCRIPT_ALREADY_RUN__) {
    console.warn('Render script already loaded, skipping...');
} else {
    window.__RENDER_SCRIPT_ALREADY_RUN__ = true;

    const PROJECT_PARENT_SELECTOR = "[data-bind='foreach: visibleProjects']";
    const CATEGORIES_PARENT_SELECTOR = "[data-bind='foreach: visibleCategories']";
    const ITEM_SELECTOR = ".span2 .timesheetlistitem";

    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            init();
        });
    }

    function init() {
        chrome.storage.sync.get(STORAGE_KEY_PROJECTS, (data) => {
            data = data.projects || [];
            layoutProjects();
            layoutCategories();
            restyleProjectsAndCategories();
        });
    }

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
                styleElement(entity, color.toHEXA().toString(), color.toHEXA().toString(), "#FFFFFF");
            });

            entity.addEventListener('click', () => {
                activeProject = entity
                layoutCategories()
                restyleProjectsAndCategories()
            });
            
            if (entity.style.color == 'white') {
                activeProject = entity
            }
        });
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
                styleElement(entity, color.toHEXA().toString(), color.toHEXA().toString(), "#FFFFFF");
            });

            entity.addEventListener('click', () => {
                activeCategory = entity;
                // TODO: Restyle categories only
                restyleProjectsAndCategories();
            });

            if (entity.style.color == 'white') {
                activeCategory = entity
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

    function storeData(dataItem) {
        const existingProject = data.find((item) => item.project === dataItem.project);

        if (existingProject) {
            if (dataItem.category) {
                if (!existingProject.categories) {
                    existingProject.categories = [];
                }
                const existingCategory = existingProject.categories.find(c => c.name === dataItem.category.name);
                if (existingCategory) {
                    existingCategory.color = dataItem.category.color;
                } else {
                    existingProject.categories.push(dataItem.category);
                }
            } else {
                existingProject.color = dataItem.color;
            }
        } else {
            data.push({
                project: dataItem.project,
                color: dataItem.color,
                categories: dataItem.category ? [dataItem.category] : []
            });
        }

        chrome.storage.sync.set({
            [STORAGE_KEY_PROJECTS]: data
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
    }

    function getAllProjects() {
        const parent = document.querySelector(PROJECT_PARENT_SELECTOR);
        return parent ? parent.querySelectorAll(ITEM_SELECTOR) : [];
    }

    function getAllCategories() {
        const parent = document.querySelector(CATEGORIES_PARENT_SELECTOR);
        return parent ? parent.querySelectorAll(ITEM_SELECTOR) : [];
    }

    function styleElement(element, bg, bc, c) {
        if (!element) return;
        if (bg) element.style.setProperty('background-color', bg, 'important');
        if (bc) element.style.setProperty('border-color', bc, 'important');
        if (c) element.style.setProperty('color', c, 'important');
    }
}