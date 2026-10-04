// runs at document_start so a saved dark mode applies before first paint
chrome.storage.sync.get(STORAGE_KEY_DARK_MODE, (stored) => {
    document.documentElement.classList.toggle('tb-dark', !!stored[STORAGE_KEY_DARK_MODE])
})

// keeps other open timesheets tabs in sync
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes[STORAGE_KEY_DARK_MODE]) {
        document.documentElement.classList.toggle('tb-dark', !!changes[STORAGE_KEY_DARK_MODE].newValue)
    }
})
