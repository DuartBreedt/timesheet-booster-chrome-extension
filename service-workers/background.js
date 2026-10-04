const baseSetupFiles = [
    "constants.js",
    "content-scripts/setup.js",
    "content-scripts/icons.js",
    "content-scripts/palette.js",
    "content-scripts/projects-and-categories-render.js",
    "content-scripts/entry-render.js",
    "content-scripts/category-pinning-render.js",
    "content-scripts/redesign-render.js",
    "content-scripts/quick-actions-render.js",
    "content-scripts/stats-render.js",
    "content-scripts/main.js"
]

// these need the page's own jquery, tooltipster and timesheet widgets
const mainWorldSetupFiles = [
    "content-scripts/entry-metadata-bridge.js",
    "content-scripts/day-actions-bridge.js"
]

let loaded = false
if (!chrome.tabs.onUpdated.hasListeners() && !loaded) {
    loaded = true
    chrome.tabs.onUpdated.addListener(onHistoryStateUpdatedCallback)
}

const dyanmicFetchUrls = [
    'https://employee.entelect.co.za/Timesheet/GetEmployeeProjectVisibility'
]

async function onMessageCallback(request, sender, sendResponse) {
    if (request?.badge == 0 || request?.badge) {
        sendResponse({ status: 'ok' })
        chrome.action.setBadgeText({ tabId: sender.tab.id, text: `${request.badge}` })
    }
}

async function onHistoryStateUpdatedCallback(tabId) {
    setupPage(tabId)
}

async function setupPage(tabId) {
    refreshPage(baseSetupFiles, tabId)
    refreshPage(mainWorldSetupFiles, tabId, 'MAIN')
}

async function refreshPage(files, tabId = undefined, world = 'ISOLATED') {
    if (!tabId) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

        if (tab) {
            tabId = tab.id
        }
    }

    if (tabId) {
        chrome.scripting.executeScript({
            target: { tabId },
            files,
            world
        })
    }
}