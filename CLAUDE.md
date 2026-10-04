# Timesheet Booster

A Chromium extension used by Entelect employees on the internal timesheet (`https://employee.entelect.co.za/Timesheet`). It restyles the page (redesign, dark mode, custom colours, pinned categories) and adds shortcuts for capturing time (bulk edit, move and copy entries, templates).

Constraints:
- The timesheet is the source of truth. Entries are only created, edited or deleted through the timesheet's own forms and endpoints, the way a user would. Signed-off entries are never changed.
- The site is not ours. Work with its DOM and widgets as they are, and degrade quietly if something isn't found.
- Data stays in the user's browser. No external services, analytics or remote code.

## Tech stack

- Manifest V3, plain JavaScript (classic scripts sharing globals) and CSS. No build step, no dependencies.
- The page runs jQuery, Knockout, Bootstrap 2 and Tooltipster. Use them only from the MAIN world bridge scripts.
- `chrome.storage.sync` for small settings (colours, pins, dark mode, default office). `chrome.storage.local` for templates, which can exceed sync's per-item quota.

Do not use: frameworks (React, Vue, etc.), npm packages or bundlers, TypeScript, ES modules, CDNs or any remotely loaded code, jQuery in isolated-world scripts.

## Architecture

- `manifest.json`: loads the CSS and `theme.js` at `document_start` so styles and dark mode apply before first paint.
- `service-workers/background.js`: injects everything else on tab updates, in two lists: isolated world (`baseSetupFiles`) and MAIN world (`mainWorldSetupFiles`). Order matters.
- `constants.js`: selectors and storage keys.
- `content-scripts/setup.js`: shared state and the `onDataLoaded` / `on*Changed` hook arrays. `main.js` loads stored data and fires the hooks, so it stays last.
- `content-scripts/*-render.js`: isolated-world features. New features go in a new or existing render script, registered in `baseSetupFiles` before `main.js`.
- `content-scripts/*-bridge.js`: MAIN world scripts that drive the timesheet's widgets and endpoints. The isolated world talks to them with `tb:*` CustomEvents carrying JSON strings, and they tag the DOM with `data-tb-*` attributes.
- `content-scripts/redesign.css`, `violations.css`: all styling, including dark mode under `html.tb-dark`.
- `docs/`: README screenshots and plans (for example `docs/firefox-port.md`).

## Conventions

- Wrap each injected script in an IIFE with a `window.__NAME_ALREADY_RUN__` guard, since it can be injected more than once per page.
- Prefix everything we add: `tb-` classes, `data-tb-*` attributes, `--tb-*` CSS variables, `tb:*` events.
- JS sets classes, data attributes and CSS variables. Visual styling lives in the CSS.
- CSS selectors start with `html` and use `!important` where needed: manifest CSS loads before the page's own, and Knockout writes inline styles.
- Comment rules are in `.claude/rules/comments.md`.
- Never use the em dash character in code, comments or docs. Use a comma, colon, parentheses or separate sentences.

## Verifying changes

There are no automated tests or build.

1. `node --check <file>` on changed JS files.
2. Reload the extension at `chrome://extensions`, then refresh the timesheet.
3. Check light and dark mode, and days with signed-off entries.
