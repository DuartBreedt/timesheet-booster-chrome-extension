
if (window.__RENDER_SCRIPT_ALREADY_RUN__) {
    console.warn('Render script already loaded, skipping...');
} else {
    const PROJECT_PARENT_SELECTOR = "[data-bind='foreach: visibleProjects']"
    const CATEGORIES_PARENT_SELECTOR = "[data-bind='foreach: visibleCategories']"
    const ITEM_SELECTOR = ".span2 .timesheetlistitem"

    let activeProject
    let activeCategory

    window.addEventListener('load', () => {

        window.__RENDER_SCRIPT_ALREADY_RUN__ = true;

        restyleProjectsAndCategories()

        const projects = layoutProjects()
        activeProject = Array.from(projects).filter(el => getComputedStyle(el).color === 'rgb(255, 255, 255)')[0];
        const categories = layoutCategories()
        activeCategory = Array.from(categories).filter(el => getComputedStyle(el).color === 'rgb(255, 255, 255)')[0];
    })

    function layoutProjects() {
        const projects = getAllProjects()
        Array.from(projects).forEach((entity) => {
            const button = createFillButton(entity, (color) => {
                const entry = {
                    project: entity.innerText.trim(),
                    color: color.toHEXA().toString()
                }

                storeEntry(entry)

                // Set background color of currently selected project and its unstyled categories.
                //  TODO handle unstyled categories too...
                styleElement(entity, color.toHEXA().toString(), color.toHEXA().toString(), "#FFFFFF")
            })

            entity.addEventListener('click', () => {
                activeProject = entity

                const categories = layoutCategories()
                activeCategory = Array.from(categories).filter(el => getComputedStyle(el).color === 'rgb(255, 255, 255)')[0];

                restyleProjectsAndCategories()
            });
        })
        return projects
    }

    function layoutCategories() {
        const categories = getAllCategories()
        Array.from(categories).forEach((entity) => {
            const button = createFillButton(entity, (color) => {
                const entry = {
                    project: activeProject.innerText.trim(),
                    category: {
                        name: entity.innerText.trim(),
                        color: color.toHEXA().toString()
                    }
                }

                storeEntry(entry)

                // Set background color of currently selected category
                styleElement(entity, color.toHEXA().toString(), color.toHEXA().toString(), "#FFFFFF")
            })

            entity.addEventListener('click', () => {
                activeCategory = entity

                restyleProjectsAndCategories()
            });
        })
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
        const def = getComputedStyle(entity).borderColor
        const pickr = createPicker(def)

        const elem = document.createElement('button');
        elem.className = 'color-picker';

        const img = document.createElement('img');
        img.src = chrome.runtime.getURL("icons/paint-bucket.svg");
        img.style.width = '16px';
        img.style.height = '16px';

        elem.appendChild(img);

        entity.appendChild(elem);

        elem.addEventListener('click', () => {
            pickr.show();
        });

        pickr.on('save', (color) => {
            onSave(color)
            pickr.hide()
        });
    }

    function storeEntry(entry) {

        chrome.storage.sync.get(STORAGE_KEY_KEYWORDS, async ({ keywords }) => {

            let toStore = []
            if (keywords && keywords.length > 0) {
                toStore = [...keywords]
            }

            const existingProject = toStore.find((item) => item.project == entry.project)

            if (existingProject) {
                if (entry.category) {
                    existingProject.categories = existingProject.categories.filter((item) => item.name != entry.category.name);
                    existingProject.categories.push(entry.category)
                }
                existingProject.color = entry.color ? entry.color : existingProject.color;
            } else {
                toStore.push({ project: entry.project, color: entry.color, categories: entry.category ? [entry.category] : [] })
            }

            chrome.storage.sync.set({ [STORAGE_KEY_KEYWORDS]: toStore })
        })
    }

    function restyleProjectsAndCategories() {
        chrome.storage.sync.get(STORAGE_KEY_KEYWORDS, async ({ keywords }) => {
            if (keywords) {
                const projects = getAllProjects()
                const categories = getAllCategories()

                keywords.forEach((item) => {

                    const project = projects.find((p) => p.innerText.trim() == item.project)
                    if (project) {
                        styleElement(project, project == activeProject ? item.color : '#FFFFFF', item.color, project == activeProject ? '#FFFFFF' : item.color)

                        if (project == activeProject) {

                            // Set all project's categories to the project's color if it has one
                            if (item.color) categories.forEach((cat) => styleElement(cat, '#FFFFFF', item.color, item.color))
                            if (item.color) styleElement(activeCategory, item.color, item.color, '#FFFFFF')

                            item.categories.forEach((cat) => {
                                const category = categories.find((p) => p.innerText.trim() == cat.name)
                                if (category) {
                                    styleElement(category, category == activeCategory ? cat.color : '#FFFFFF', cat.color, category == activeCategory ? '#FFFFFF' : cat.color)
                                }
                            })
                        }
                    }

                })
            }
        })
    }

    function getAllProjects() {
        const parent = document.querySelector(PROJECT_PARENT_SELECTOR)
        return Array.from(parent.querySelectorAll(ITEM_SELECTOR))
    }

    function getAllCategories() {
        const parent = document.querySelector(CATEGORIES_PARENT_SELECTOR)
        return Array.from(parent.querySelectorAll(ITEM_SELECTOR))
    }

    function styleElement(element, bg, bc, c) {
        if (bg) element.style.setProperty('background-color', bg, 'important');
        if (bc) element.style.setProperty('border-color', bc, 'important');
        if (c) element.style.setProperty('color', c, 'important');
    }
}