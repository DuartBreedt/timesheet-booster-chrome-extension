---
paths:
  - "**/*.js"
  - "**/*.css"
---

# Comments

- Explain why, never what. No comments on self-explanatory code or standard API calls (no `// listen for runtime messages` above `chrome.runtime.onMessage.addListener`).
- Only comment non-obvious workarounds, timesheet DOM quirks and extension timing issues (MV3 service worker lifecycle, injection order, message port closures).
- Keep them under one line, lowercase and conversational.
- No section dividers (`// ===== HELPERS =====`), step markers (`// step 1: ...`), JSDoc that repeats names, changelogs or decision logs.
