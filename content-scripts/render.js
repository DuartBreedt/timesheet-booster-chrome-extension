if (window.__RENDER_SCRIPT_ALREADY_RUN__) {
    console.warn('Render script already loaded, skipping...');
} else {
    window.__RENDER_SCRIPT_ALREADY_RUN__ = true;

    const PROJECT_PARENT_SELECTOR = "[data-bind='foreach: visibleProjects']";
    const CATEGORIES_PARENT_SELECTOR = "[data-bind='foreach: visibleCategories']";
    const ITEM_SELECTOR = ".span2 .timesheetlistitem";

    let activeProject;
    let activeCategory;
    let projects = [];
    let categories = [];
    let keywords = [];

    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            init();
        });
    }

    function init() {
        chrome.storage.sync.get(STORAGE_KEY_KEYWORDS, (data) => {
            keywords = data.keywords || [];
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
                const entry = {
                    project: entity.innerText.trim(),
                    color: color.toHEXA().toString()
                };
                storeEntry(entry);
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
                const entry = {
                    project: activeProject.innerText.trim(),
                    category: {
                        name: entity.innerText.trim(),
                        color: color.toHEXA().toString()
                    }
                };
                storeEntry(entry);
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

    function storeEntry(entry) {
        const existingProject = keywords.find((item) => item.project === entry.project);

        if (existingProject) {
            if (entry.category) {
                if (!existingProject.categories) {
                    existingProject.categories = [];
                }
                const existingCategory = existingProject.categories.find(c => c.name === entry.category.name);
                if (existingCategory) {
                    existingCategory.color = entry.category.color;
                } else {
                    existingProject.categories.push(entry.category);
                }
            } else {
                existingProject.color = entry.color;
            }
        } else {
            keywords.push({
                project: entry.project,
                color: entry.color,
                categories: entry.category ? [entry.category] : []
            });
        }

        chrome.storage.sync.set({
            [STORAGE_KEY_KEYWORDS]: keywords
        });
    }

    function restyleProjectsAndCategories() {
        if (!keywords) return;

        const projectMap = new Map(projects.map(p => [p.innerText.trim(), p]));
        const categoryMap = new Map(categories.map(c => [c.innerText.trim(), c]));

        keywords.forEach((item) => {
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