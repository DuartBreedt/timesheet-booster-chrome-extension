# Firefox port

Plan for making Timesheet Booster run on Firefox. Safari is out of scope.

The extension declares all its scripts in `manifest.json` and has no background worker, so it is ready for Firefox. Effort: half a day to a day, plus signing.

## Firefox support

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
- Content-script CSS against the page's own CSS. Every selector in `redesign.css` starts with `html` so it wins ties against timesheets' rules. Confirm nothing regresses.

### Developing and testing

Use Mozilla's [`web-ext`](https://github.com/mozilla/web-ext) tool:

```sh
npx web-ext lint      # manifest and API checks
npx web-ext run       # launches Firefox with the extension loaded
```

Or load it temporarily from `about:debugging#/runtime/this-firefox` (**Load Temporary Add-on**, then pick `manifest.json`). Temporary add-ons are removed when Firefox restarts.

Reload the extension and confirm, on the live timesheets:

- [ ] Dark mode applies with no light flash on load.
- [ ] Chips show colours, initials and pins, and the colour popover works.
- [ ] Captured entries on the day timelines use project and category colours, including after changing week.
- [ ] Quick Actions, templates, bulk edit, move and copy all work. These depend on the MAIN-world bridges.
- [ ] The time field drags in 15 minute steps.
- [ ] No errors in the page console or on the extension's error page.
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
