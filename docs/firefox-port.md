# Firefox port

Plan for making Timesheet Booster run on Firefox. Safari is out of scope.

The work is in two parts. The refactor is worth doing on its own because it simplifies the Chrome extension. The Firefox work builds on it.

| Part | Effort |
| --- | --- |
| 1. Refactor script loading (Chrome and Firefox) | About half a day |
| 2. Firefox support | Half a day to a day, plus signing |

## 1. Refactor script loading

### Why

All JavaScript except `theme.js` is injected by `service-workers/background.js`. It listens to `chrome.tabs.onUpdated` and calls `chrome.scripting.executeScript` on every update of every tab. That has a few problems:

- It runs several times per page load (loading, complete, title and favicon updates), which is why every script has a `window.__X_ALREADY_RUN__` guard.
- It tries to inject into tabs on other sites, where it fails.
- It needs the `tabs` and `scripting` permissions and a background worker, neither of which Firefox handles the same way. Firefox does not run MV3 `background.service_worker` at all.

Declaring the scripts in `manifest.json` removes the background worker entirely.

### Changes

**Declare every script in the manifest.** All content scripts of an extension share one isolated world per page, so globals from `constants.js` and `setup.js` stay visible to the later files. Keep the current load order.

```json
"content_scripts": [
    {
        "matches": ["https://employee.entelect.co.za/Timesheet*"],
        "css": [
            "content-scripts/violations.css",
            "content-scripts/redesign.css"
        ],
        "js": [
            "constants.js",
            "content-scripts/theme.js"
        ],
        "run_at": "document_start"
    },
    {
        "matches": ["https://employee.entelect.co.za/Timesheet*"],
        "js": [
            "content-scripts/setup.js",
            "content-scripts/icons.js",
            "content-scripts/palette.js",
            "content-scripts/projects-and-categories-render.js",
            "content-scripts/entry-render.js",
            "content-scripts/category-pinning-render.js",
            "content-scripts/redesign-render.js",
            "content-scripts/quick-actions-render.js",
            "content-scripts/main.js"
        ],
        "run_at": "document_idle"
    },
    {
        "matches": ["https://employee.entelect.co.za/Timesheet*"],
        "js": [
            "content-scripts/entry-metadata-bridge.js",
            "content-scripts/day-actions-bridge.js"
        ],
        "run_at": "document_idle",
        "world": "MAIN"
    }
]
```

Notes:

- `constants.js` is only listed once. The second entry reuses its globals.
- The bridges run at `document_idle` so the page's jQuery and timesheet widgets exist. Both already retry from a `MutationObserver`, so the order between the isolated and MAIN entries doesn't matter.
- `main.js` already handles `document.readyState`, so `document_idle` needs no changes there.

**Remove the background worker.** Delete `service-workers/background.js` and the `background` key from the manifest. The file also holds unused code (`onMessageCallback`, `dyanmicFetchUrls`).

**Trim permissions.** Keep only `storage`. Remove `tabs`, `scripting`, `webRequest` and `webNavigation`.

**Fix host access.** The current `host_permissions` entry, `https://employee.entelect.co.za/Timesheet`, matches that exact URL only. The `content_scripts` matches grant the access the extension needs, so remove `host_permissions` and use the same pattern everywhere: `https://employee.entelect.co.za/Timesheet*`. The current `https://*.employee.entelect.co.za/...` also matches subdomains, which isn't needed.

**Narrow `web_accessible_resources`.** The SVG icons are loaded into the page with `chrome.runtime.getURL`, so they must stay accessible, but only to the timesheet origin. Change `"matches": ["<all_urls>"]` to `["https://employee.entelect.co.za/*"]`.

**Optional cleanups.**

- The `__X_ALREADY_RUN__` guards are no longer needed. They are harmless and can be removed later.
- `popup/` isn't referenced by the manifest and `popup.js` uses an undefined `STORAGE_KEY_KEYWORDS`. Delete it unless there are plans for it.

### Minimum Chrome version

`"world": "MAIN"` in `content_scripts` needs Chrome 111. Add `"minimum_chrome_version": "111"`.

### Checking the refactor on Chrome

Reload the extension and confirm, on the live timesheet:

- [ ] Dark mode applies with no light flash on load.
- [ ] Chips show colours, initials and pins, and the colour popover works.
- [ ] Captured entries on the day timelines use project and category colours, including after changing week.
- [ ] Quick Actions, templates, bulk edit, move and copy all work. These depend on the MAIN-world bridges.
- [ ] The time field drags in 15 minute steps.
- [ ] No errors in the page console or on the extension's error page.

## 2. Firefox support

Requires Firefox 128 or later, the first version with `"world": "MAIN"` for content scripts.

### Manifest

Firefox needs an add-on ID. `storage.sync` also doesn't work without one.

```json
"browser_specific_settings": {
    "gecko": {
        "id": "timesheet-booster@<your-domain>",
        "strict_min_version": "128.0"
    }
}
```

Chrome ignores this key, so one manifest can serve both browsers.

### Site access

Firefox MV3 does not grant host access at install. Until the user allows it, no content scripts run and the extension appears to do nothing.

Either:

- Document it in the README: click the extensions button in the toolbar, then allow Timesheet Booster on `employee.entelect.co.za`. It can also be set in `about:addons`, under the extension's Permissions tab.
- Or add an options page with a "Grant access" button that calls `browser.permissions.request({ origins: ["https://employee.entelect.co.za/Timesheet*"] })`. The request has to come from a user click, so it can't happen automatically on install.

Start with the README. Add the options page if people get stuck.

### APIs

No code changes are expected:

- Firefox supports the `chrome.*` namespace with callbacks, which is what the extension uses (`chrome.storage`, `chrome.runtime.getURL`).
- The MAIN-world bridges don't use extension APIs.
- The isolated scripts and bridges talk through `CustomEvent`s carrying JSON strings. Passing strings avoids Firefox's restrictions on sharing objects between the page and content scripts.

### CSS

Everything used is supported in Firefox 128: `:has()`, `color-mix()`, `mask`, `<dialog>` and `::backdrop`. Things to check by eye:

- The date inputs (Move Entry, Copy to Other Days and Bulk Edit Day) use Firefox's own picker and look different.
- Select chevrons and `appearance: none`.
- Content-script CSS against the page's own CSS. Every selector in `redesign.css` starts with `html` so it wins ties against the timesheet's rules. Confirm nothing regresses.

### Developing and testing

Use Mozilla's [`web-ext`](https://github.com/mozilla/web-ext) tool:

```sh
npx web-ext lint      # manifest and API checks
npx web-ext run       # launches Firefox with the extension loaded
```

Or load it temporarily from `about:debugging#/runtime/this-firefox` (**Load Temporary Add-on**, then pick `manifest.json`). Temporary add-ons are removed when Firefox restarts.

Run the same checklist as for Chrome, plus:

- [ ] Granting site access makes the extension start working without a reinstall.
- [ ] Settings (dark mode, colours, pins, default office) persist across restarts.

### Distribution

Firefox only installs signed add-ons permanently. Sign through addons.mozilla.org as **unlisted**, which is free and doesn't publish the add-on:

```sh
npx web-ext sign --channel=unlisted --api-key=<key> --api-secret=<secret>
```

API keys come from the AMO developer hub. Unlisted signing is automated and usually takes minutes. The signed `.xpi` can be shared directly, and the README needs a Firefox install section.

## Open questions

- **Server CSP.** The snapshot has no Content-Security-Policy meta tag, but the server may send one as a header. MAIN-world content scripts are not blocked by page CSP in Firefox, so this shouldn't matter. Confirm on the live site.
- **Sync across browsers.** Chrome and Firefox sync storage separately, so colours, templates and settings won't carry over between browsers. Templates are stored locally in either case.
