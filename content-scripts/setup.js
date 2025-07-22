let activeProject;
let activeCategory;
let projects = [];
let categories = [];
let data = [];
let onDataLoaded = []

function getColorFromData(project, category) {
    const projectData = data.find((dataItem) => dataItem.project == project)
    if (!projectData) return undefined
    const categoryData = projectData.categories.find((c) => c.name == category)
    if (categoryData) return categoryData.color
    return projectData.color
}