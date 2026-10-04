# Contract tests

The extension depends on timesheets' markup, its Knockout bindings, its jQuery widgets and the requests it sends. None of that is a public API, so an update to timesheets can break the extension without warning. These tests check those assumptions against the live site with [Playwright](https://playwright.dev).

## Suites

| File | Extension loaded | Writes to timesheets | Checks |
| --- | --- | --- | --- |
| `tests/contract/page-contract.spec.js` | No | No | Timesheets still have what the extension relies on: list and day markup, page globals, the day widget's options and methods, entry fields, tooltip order, sentiment ids, office values, the entry form and its view model, and the save, response and delete shapes. |
| `tests/contract/extension.spec.js` | Yes | No | Every read-only feature: header, chips, colour popover, captured time tagging, stats, entry form layout, Quick Actions views, time dragging, dark mode and the dialogs. |
| `tests/contract/writes.spec.js` | Yes | Yes, opt-in | Creates an entry on an empty day, then bulk edits, copies, moves and deletes it through the extension. |

Some checks read from the extension's own source so they can't drift from it. Selectors come from `constants.js`, and the save request fields come from `toRequest` in `day-actions-bridge.js`.

A page contract failure means timesheets changed. An extension failure on its own, with the page contract passing, points at the extension.

## Setup

```sh
npm install
npx playwright install chromium
npm run test:login
```

`test:login` opens a browser. Sign in, and it closes once timesheets load. The session is saved to `.auth/state.json`, which is gitignored and holds your login cookies, so don't share it. Run it again whenever tests fail with a redirect or "No saved login" error.

## Running

```sh
npm run test:contract                 # page contract and extension suites
HEADED=1 npm run test:contract        # watch it run
npx playwright show-report            # details and traces of failures
```

### Write tests

```sh
npm run test:contract:writes
```

These write to your real timesheet. They pick two days in view with no entries, weekends first, and delete everything on those days afterwards, even when a step fails. The entry description is "Timesheet Booster contract test, safe to delete", so leftovers are easy to spot if a run is killed part way. They are skipped unless `TB_ALLOW_WRITES=1` is set, which the script does for you.

## Other settings

- `TB_TIMESHEET_URL` points the tests at another URL, for example a staging copy of timesheets.
- Tests run one at a time because they share one live account.

## When a test fails

1. Open the report (`npx playwright show-report`). Failures keep a trace and screenshot.
2. For a page contract failure, find what changed in timesheets and update the matching part of the extension: the selector in `constants.js`, the bridge in `day-actions-bridge.js`, or the CSS in `redesign.css`.
3. Update the test only once the extension handles the new behaviour.
