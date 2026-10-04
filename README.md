# Timesheet Booster

A Chrome extension for the [Entelect timesheet](https://employee.entelect.co.za/Timesheet). It restyles the page and adds shortcuts for capturing time.

![Timesheet Booster overview](docs/screenshots/overview.png)

## Features

### Dark mode

Toggled from the header. The setting is saved and applies to all open timesheet tabs.

![Dark mode](docs/screenshots/dark-mode.png)

### Colours

Set a colour for any project or category from the fill button on its chip. Categories use their project's colour unless given their own. Captured time on the day timelines uses these colours.

![Colour picker](docs/screenshots/colours.png)

### Pinned categories

Pinned categories are listed first. Pins and colours are stored in Chrome sync storage.

![Pinned categories](docs/screenshots/pinning.png)

### Quick Actions

Shown next to the entry form when a day is open:

- **Bulk Edit Day:** set the office or sentiment for every entry on the day, move all its entries to another date, or delete them. Signed-off entries are not changed.
- **Move Entry:** move a saved entry to another day.
- **Copy to Other Days:** create the same entry on other days, with a **Weekdays** shortcut.

![Quick Actions, entry form and Templates](docs/screenshots/entry-form.png)

### Templates

Tick **Save as template** when adding an entry to save it. Templates are applied from the Templates card next to the entry form, and renamed or deleted from **Manage Templates** in the header.

### Default office

Set under **Settings** in the header. It is preselected under "Worked From" on new entries.

![Settings](docs/screenshots/settings.png)


## Installing on Chromium browsers

The extension isn't on the Chrome Web Store, so it is installed from source. This works in Chrome, Edge, Brave, Arc, Opera and Vivaldi.

1. Get the code, either by cloning the repository:
   ```sh
   git clone https://github.com/DuartBreedt/timesheet-booster-chrome-extension.git
   ```
   or by downloading it as a ZIP from GitHub (**Code > Download ZIP**) and unzipping it somewhere permanent.
2. Open your browser's extensions page:

   | Browser | Address |
   | --- | --- |
   | Chrome, Arc | `chrome://extensions` |
   | Edge | `edge://extensions` |
   | Brave | `brave://extensions` |
   | Opera | `opera://extensions` |
   | Vivaldi | `vivaldi://extensions` |

3. Turn on **Developer mode** (a toggle in the top right, or in the left sidebar on Edge).
4. Click **Load unpacked** and select the project folder (the one containing `manifest.json`).
5. Open the [timesheet](https://employee.entelect.co.za/Timesheet).

**Updating:** pull the latest changes (or download the ZIP again into the same folder), then click the reload icon on the Timesheet Booster card in your extensions page and refresh timesheets.

> Don't delete or move the folder after installing. The browser loads the extension from it every time.

## Contributing



### Getting set up

1. Fork the repository and clone your fork.
2. Load it as an unpacked extension (see [Installing](#installing-on-chromium-browsers)).
3. Make your changes, click reload on the extension card, then refresh timesheets to see them.

There is no build step: the extension is plain JavaScript and CSS, loaded straight from the folder.

### How it fits together

| Path | What lives there |
| --- | --- |
| `manifest.json` | Extension config (Manifest V3), including the content script load order |
| `content-scripts/redesign.css`, `violations.css` | The redesign, dark mode and chip styles, loaded before the page paints |
| `content-scripts/theme.js` | Applies dark mode early and keeps tabs in sync |
| `content-scripts/*-render.js` | The UI: chips, colours, pinning, timelines, Quick Actions, templates and settings |
| `content-scripts/*-bridge.js` | Run in the page's own context to drive timesheets' widgets and read entry details |
| `constants.js` | Shared selectors and storage keys |

Most features run in the extension's isolated world. Anything that needs timesheets' own jQuery or widgets goes through a bridge script that runs in the page, and the two talk via `tb:*` DOM events.



### Submitting a change

1. Create a branch: `git checkout -b my-improvement`
2. Commit your changes with a clear message.
3. Push to your fork and open a pull request against `main`, describing what changed and how you tested it.

Bugs and feature requests go in [issues](https://github.com/DuartBreedt/timesheet-booster-chrome-extension/issues).
