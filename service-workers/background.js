const baseSetupFiles = [
    "constants.js",
    "content-scripts/setup.js",
    "content-scripts/jscolor.min.js",
    "content-scripts/projects-and-categories-render.js",
    "content-scripts/entry-render.js"
]

let loaded = false
if (!chrome.tabs.onUpdated.hasListeners() && !loaded) {
    loaded = true
    chrome.tabs.onUpdated.addListener(onHistoryStateUpdatedCallback)
}

const dyanmicFetchUrls = [
    'https://employee.entelect.co.za/Timesheet/GetEmployeeProjectVisibility'
]

// Violation count for badge indicator from render.js
async function onMessageCallback(request, sender, sendResponse) {
    if (request?.badge == 0 || request?.badge) {
        sendResponse({ status: 'ok' })
        chrome.action.setBadgeText({ tabId: sender.tab.id, text: `${request.badge}` })
    }
}

async function onHistoryStateUpdatedCallback(details) {
    setupPage(details)
}

async function setupPage(details) {
    refreshPage(baseSetupFiles, details.tabId)
}

// Refresh UI with markup
async function refreshPage(files, tabId = undefined) {
    if (!tabId) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

        if (tab) {
            tabId = tab.id
        }
    }

    if (tabId) {
        chrome.scripting.executeScript({
            target: { tabId },
            files
        })
    }
}