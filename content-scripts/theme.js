// runs at document_start so a saved dark mode and turned off features apply before first paint
chrome.storage.sync.get([STORAGE_KEY_DARK_MODE, ...Object.keys(FEATURE_OFF_CLASSES)], (stored) => {
    document.documentElement.classList.toggle('tb-dark', !!stored[STORAGE_KEY_DARK_MODE])
    Object.entries(FEATURE_OFF_CLASSES).forEach(([key, className]) => {
        document.documentElement.classList.toggle(className, stored[key] === false)
    })
})

// keeps other open timesheets tabs in sync
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (changes[STORAGE_KEY_DARK_MODE]) {
        document.documentElement.classList.toggle('tb-dark', !!changes[STORAGE_KEY_DARK_MODE].newValue)
    }
    Object.entries(FEATURE_OFF_CLASSES).forEach(([key, className]) => {
        if (changes[key]) document.documentElement.classList.toggle(className, changes[key].newValue === false)
    })
})

// a week either side of christmas by the computer's date, not the week being viewed
function isFestiveSeason(now) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const christmasYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
    const daysFromChristmas = Math.round((today - new Date(christmasYear, 11, 25)) / 86400000)
    return Math.abs(daysFromChristmas) <= 7
}

document.documentElement.classList.toggle('tb-festive', isFestiveSeason(new Date()))
