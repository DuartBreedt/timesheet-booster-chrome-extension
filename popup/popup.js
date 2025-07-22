const CLASS_ACCORDION_ACTIVE = 'active'

const containsTextBox = document.getElementById('containsTextBox')
const wordsTextBox = document.getElementById('wordsTextBox')
const nextButton = document.getElementById('nextButton')
const prevButton = document.getElementById('prevButton')
const currentStepField = document.getElementById('currentStep')
const maxStepField = document.getElementById('maxStep')
const accordions = [...document.getElementsByClassName('accordion')]

let hasConnected = false
let keywordsData = { containsKeywords: [], wordsKeywords: [] }

// Open keyword accordions
for (const accordion of accordions) {
    accordion.addEventListener('click', () => {
        accordion.classList.toggle(CLASS_ACCORDION_ACTIVE)
        var panel = accordion.nextElementSibling
        panel.style.maxHeight = panel.style.maxHeight ? null : `${panel.scrollHeight}px`
    })
}

// Update text input area with currently saved keywords
chrome.storage.sync.get(STORAGE_KEY_KEYWORDS, ({ keywords }) => {

    if (keywords) {
        keywordsData = keywords
    }

    if (keywords?.containsKeywords && keywords.containsKeywords.length > 0) {
        containsTextBox.value = keywords.containsKeywords.join(', ')
    }

    if (keywords?.wordsKeywords && keywords.wordsKeywords.length > 0) {
        wordsTextBox.value = keywords.wordsKeywords.join(', ')
    }
})

// If the user inputs a new contains keyword
containsTextBox.addEventListener('input', () => {
    const containsKeywords = containsTextBox.value.split(/\s*(?:;|,)\s*/).filter(n => n).map(n => n.trim())

    if (containsKeywords) {
        setKeywords(containsKeywords, keywordsData.wordsKeywords)
    } else {
        setKeywords([], keywordsData.wordsKeywords)
    }

    notifyDataChanged()
}, false)

// If the user inputs a new words keyword
wordsTextBox.addEventListener('input', () => {
    const wordsKeywords = wordsTextBox.value.split(/\s*(?:;|,)\s*/).filter(n => n).map(n => n.trim())

    if (wordsKeywords) {
        setKeywords(keywordsData.containsKeywords, wordsKeywords)
    } else {
        setKeywords(keywordsData.containsKeywords, [])
    }

    notifyDataChanged()
}, false)

// On next clicked, send a message to content scripts
nextButton.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: ACTION_NEXT })
    })
})

// On prev clicked, send a message to content scripts
prevButton.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: ACTION_PREV })
    })
})

// If a message is received from a content script with current step and next step in then update the UI to show it
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request?.currentStep && request?.maxStep) {
        sendResponse({ status: 'ok' })

        currentStepField.innerHTML = request.currentStep
        maxStepField.innerHTML = request.maxStep
    }
})

function setKeywords(containsKeywords, wordsKeywords) {
    keywordsData.containsKeywords = containsKeywords
    keywordsData.wordsKeywords = wordsKeywords
    chrome.storage.sync.set({ [STORAGE_KEY_KEYWORDS]: keywordsData })
}

// Connect the popup to be able to detect whether the popup has been dismissed in the background
function notifyDataChanged() {
    if (!hasConnected) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0].url.search(SUPPORTED_TIMESHEETS_URLS) > -1) {
                chrome.runtime.connect({ name: 'popup' })
                hasConnected = true
            }
        })
    }
}