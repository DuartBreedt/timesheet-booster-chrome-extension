// Runs at document_start (see manifest.json) so a saved dark mode applies before the page first paints
chrome.storage.sync.get(STORAGE_KEY_DARK_MODE, (stored) => {
    document.documentElement.classList.toggle('tb-dark', !!stored[STORAGE_KEY_DARK_MODE])
})

// Keeps other open timesheet tabs in step with the toggle
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes[STORAGE_KEY_DARK_MODE]) {
        document.documentElement.classList.toggle('tb-dark', !!changes[STORAGE_KEY_DARK_MODE].newValue)
    }
})
