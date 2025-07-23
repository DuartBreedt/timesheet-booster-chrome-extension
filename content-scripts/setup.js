let activeProject;
let activeCategory;
let projects = [];
let categories = [];
let data = [];
let onDataLoaded = []
let onActiveProjectChanged = []
let onActiveCategoryChanged = []
let onFillChanged = []

function getColorFromData(project, category) {
    const projectData = data.find((dataItem) => dataItem.project == project)
    if (!projectData) return undefined
    const categoryData = projectData.categories.find((c) => c.name == category)
    if (categoryData) return categoryData.color
    return projectData.color
}

function setActiveColor(color) {
    document.documentElement.style.setProperty('--active-color', color);
}

function getAllProjects() {
    const parent = document.querySelector(PROJECT_PARENT_SELECTOR);
    return parent ? parent.querySelectorAll(ITEM_SELECTOR) : [];
}

function getAllCategories() {
    const parent = document.querySelector(CATEGORIES_PARENT_SELECTOR);
    return parent ? parent.querySelectorAll(ITEM_SELECTOR) : [];
}

function getStoredProjectData(project) {
    return data.find((item) => item.project == project)
}

function getStoredCategoryData(project, category) {
    const projectData = getStoredProjectData(project)
    if (!projectData) {
       return undefined
    }
     return projectData.categories.find((item) => item.name == category)
}

function syncData() {
    chrome.storage.sync.set({
        [STORAGE_KEY_PROJECTS]: data
    });
}

function storeData(dataItem) {
    const existingProject = data.find((item) => item.project === dataItem.project);

    if (existingProject) {

        if (!existingProject.categories) {
            existingProject.categories = [];
        }

        if (dataItem.category) {
            const existingCategory = existingProject.categories.find(c => c.name === dataItem.category.name);
            if (existingCategory) {
                if (dataItem.category.color) {
                    existingCategory.color = dataItem.category.color
                }
                const newPinned = dataItem.category.isPinned != undefined ? dataItem.category.isPinned : existingCategory.isPinned
                existingCategory.isPinned = newPinned ? true: false;
            } else {
                existingProject.categories.push(dataItem.category);
            }
        }

        if (dataItem.color) {
            existingProject.color = dataItem.color;
        }
    } else {
        data.push({
            project: dataItem.project,
            color: dataItem.color,
            categories: dataItem.category ? [dataItem.category] : []
        });
    }

    syncData()
}