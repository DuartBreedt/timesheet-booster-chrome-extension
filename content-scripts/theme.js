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

// by the computer's date rather than the week being viewed
const TB_SEASONS = [
    { className: 'tb-halloween', month: 9, day: 31, daysBefore: 7, daysAfter: 0 },
    { className: 'tb-festive', month: 11, day: 25, daysBefore: 7, daysAfter: 7 }
]

// checks last, this and next year's date so the week around new year counts
function isInSeason(now, { month, day, daysBefore, daysAfter }) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return [-1, 0, 1].some((offset) => {
        const daysFromHoliday = Math.round((today - new Date(now.getFullYear() + offset, month, day)) / 86400000)
        return daysFromHoliday >= -daysBefore && daysFromHoliday <= daysAfter
    })
}

TB_SEASONS.forEach((season) => {
    document.documentElement.classList.toggle(season.className, isInSeason(new Date(), season))
})
