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