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
    // a category can be stored without a color (e.g. only pinned), so fall back to the project's
    if (categoryData && categoryData.color) return categoryData.color
    return projectData.color
}

function setActiveColor(color) {
    document.documentElement.style.setProperty('--active-color', color);
}

// knockout styles the selected project/category with `color: white`
function isSelectedListItem(item) {
    return item.style.color == 'white' || item.style.color == 'rgb(255, 255, 255)'
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

function clearCategoryColor(project, category) {
    const projectData = getStoredProjectData(project)
    if (!projectData || !projectData.categories) return

    const index = projectData.categories.findIndex((item) => item.name == category)
    if (index === -1) return

    const categoryData = projectData.categories[index]
    delete categoryData.color
    // nothing else worth keeping for this category
    if (!categoryData.isPinned) {
        projectData.categories.splice(index, 1)
    }

    syncData()
}

// requests to the MAIN-world bridges, answered with a tb:result event carrying the same id
const bridgeRequests = new Map()
const bridgeProgress = new Map()

document.addEventListener('tb:result', (event) => {
    const result = JSON.parse(event.detail)
    const resolve = bridgeRequests.get(result.id)
    if (!resolve) return
    bridgeRequests.delete(result.id)
    bridgeProgress.delete(result.id)
    resolve(result)
})

// commands that work through entries one at a time report each step with a tb:progress event
document.addEventListener('tb:progress', (event) => {
    const progress = JSON.parse(event.detail)
    const onProgress = bridgeProgress.get(progress.id)
    if (onProgress) onProgress(progress)
})

function sendBridgeCommand(command, onProgress) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    return new Promise((resolve) => {
        bridgeRequests.set(id, resolve)
        if (onProgress) bridgeProgress.set(id, onProgress)
        document.dispatchEvent(new CustomEvent('tb:command', { detail: JSON.stringify(Object.assign({ id }, command)) }))
    })
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

// Reloading or updating the extension cuts off the scripts already running in open tabs, and their next
// chrome.* call throws "Extension context invalidated". Only a page refresh brings the new scripts in.
function isExtensionContextValid() {
    try {
        return !!chrome.runtime.id
    } catch (e) {
        return false
    }
}

function showReloadNotice() {
    if (document.querySelector('.tb-reload-notice')) return
    const notice = document.createElement('div')
    notice.className = 'tb-toast tb-reload-notice'
    notice.setAttribute('role', 'alert')
    const text = document.createElement('span')
    text.textContent = 'Timesheet Booster was updated. Refresh the page to keep using it.'
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = 'Refresh'
    button.addEventListener('click', () => location.reload())
    notice.append(text, button)
    // a modal dialog would keep the notice under its backdrop, out of reach
    document.querySelectorAll('dialog.tb-dialog[open]').forEach((dialog) => dialog.close())
    document.body.append(notice)
    button.focus()
}

const EXTENSION_UI_SELECTOR = '.pin, .color-picker, [class^="tb-"], [class*=" tb-"]'

// capture phase runs before our controls' own handlers, so they never get to throw
;['click', 'change', 'keydown'].forEach((type) => {
    document.addEventListener(type, (event) => {
        if (isExtensionContextValid()) return
        const target = event.target
        if (!(target instanceof Element) || !target.closest(EXTENSION_UI_SELECTOR) || target.closest('.tb-reload-notice')) return
        event.preventDefault()
        event.stopImmediatePropagation()
        showReloadNotice()
    }, true)
})

// observers and timers can still reach chrome.* after the cut off
window.addEventListener('error', (event) => {
    if (!isExtensionContextValid() && /Extension context invalidated/.test(event.message)) {
        event.preventDefault()
        showReloadNotice()
    }
})
window.addEventListener('unhandledrejection', (event) => {
    if (!isExtensionContextValid() && /Extension context invalidated/.test(String(event.reason && event.reason.message))) {
        event.preventDefault()
        showReloadNotice()
    }
})
