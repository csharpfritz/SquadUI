### 2026-02-16: Canvas charts must only render on visible tabs

**By:** Rusty
**What:** Dashboard canvas charts (velocity and burndown) are now deferred until their tab becomes visible, rather than rendering on page load when they're hidden.
**Why:** Canvas elements inside `display: none` containers return `offsetWidth === 0`, causing `canvas.width = 0` and producing blank charts. The burndown milestone selector also had a duplicate event listener bug — each tab switch added another `change` handler. Both issues are fixed in `htmlTemplate.ts`.
