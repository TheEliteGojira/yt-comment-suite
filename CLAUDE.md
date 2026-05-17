# CLAUDE.md — TubeArchiver (YT Comment Suite)
> Read this file at the start of every session. It is the single source of truth
> for architecture decisions, design rules, and planned features.
> When in doubt, follow what is written here rather than inferring from the code.

---

## Project overview

**TubeArchiver** (internally `yt-comment-suite`) is a self-contained, client-side web app
for fetching, browsing, and exporting YouTube comments. It runs entirely in the browser —
no server, no backend, no cloud storage. All data stays on the user's machine.

It is a **portfolio project** and should be treated as such: code quality, comments,
and consistency matter as much as functionality.

---

## File structure and responsibilities

```
yt-comment-suite/
├── index.html              Layout only — tabs, inputs, buttons, structural HTML.
│                           No logic. No inline styles beyond occasional width overrides.
├── assets/
│   └── logo.svg            The TubeArchiver logo. Always use as <img src="assets/logo.svg">.
│                           Never replace with text or emoji.
├── css/
│   └── styles.css          All visual design: colours, spacing, typography,
│                           dark/light theme, mobile breakpoints.
└── js/
    ├── youtube-api.js      All YouTube Data API v3 communication. URL building,
    │                       fetch calls, error classification, response parsing.
    │                       No DOM access. No UI side effects.
    ├── archive-manager.js  Import/export JSON/CSV/TXT. Sort and filter logic.
    │                       No DOM access. No API calls. Pure data manipulation.
    ├── ui.js               DOM helpers, comment rendering, theme toggle,
    │                       timezone dropdown. No API calls. No business logic.
    └── script.js           App init, event listeners, tab switching,
                            fetch orchestration, viewer state + batch rendering.
                            Coordinates the other three modules.
```

**The separation is strict.** If you are adding a feature:
- API communication → `youtube-api.js`
- Data transformation → `archive-manager.js`
- DOM rendering → `ui.js`
- Wiring it together → `script.js`

---

## Logo usage

The logo lives at `assets/logo.svg`. Three stacked red chevrons + TUBE pill badge +
"Archiver" wordmark, all in `#ff233d`.

**In the tab bar (`index.html`):**
```html
<div class="suite-logo">
  <img src="assets/logo.svg" alt="TubeArchiver" class="suite-logo-img">
</div>
```

The `.suite-logo` div has `padding: 0 20px` and a right border — do not change these.
`.suite-logo-img` renders at `height: 42px` desktop, `33px` mobile. Do not filter or
recolour the SVG — it is already the correct brand red.

---

## Design system

### Colour tokens (defined in `css/styles.css` `:root`)

| Token            | Dark value  | Light value | Usage                                   |
|------------------|-------------|-------------|-----------------------------------------|
| `--bg`           | `#0a0a0a`   | `#f5f5f0`   | Page background                         |
| `--panel`        | `#111111`   | `#ffffff`   | Cards, panels                           |
| `--panel-hover`  | `#161616`   | `#f9f9f4`   | Panel hover state                       |
| `--border`       | `#222222`   | `#dddddd`   | All borders                             |
| `--accent`       | `#ff233d`   | `#ff233d`   | Primary — buttons, authors, active tabs |
| `--accent-dim`   | `#df1846`   | `#df1846`   | Hover state for primary buttons         |
| `--accent2`      | `#f5702d`   | `#f5702d`   | Secondary — danger buttons, hearts      |
| `--blu`          | `#096cbc`   | `#096cbc`   | Reply author names                      |
| `--text`         | `#f0f0f0`   | `#111111`   | Primary text                            |
| `--text-muted`   | `#555555`   | `#888888`   | Labels, hints, secondary info           |
| `--highlight-bg` | `#df1846`   | `#df1846`   | Search match background                 |
| `--highlight-text`| `#e8ff4e` | `#e8ff4e`   | Search match text                       |

**Never hardcode colour values in HTML or JS.** Always use CSS custom properties.
New colours must be added to `:root` in `styles.css` before use.

**Note:** The token formerly called `--green` was renamed `--blu` by an earlier session.
Always use `--blu` for reply author name colour and code block text in the About tab.

### Typography

- **Body / UI:** `Space Mono` (monospace) — all general text, inputs, buttons, labels
- **Headings / titles:** `Syne` (sans-serif, weight 800) — page titles, stat numbers
- Both loaded from Google Fonts in `styles.css`. Do not add other fonts.

### Spacing and shape

- No border-radius (flat aesthetic — `--radius: 0px`)
- Panel padding: `24px 28px`
- Page wrap padding: `40px 24px 80px` desktop, `24px 16px 60px` mobile
- Tab bar height: `52px` (`--tab-height`)
- Max content width: `860px` (`--max-width`), `820px` for the viewer tab

---

## JavaScript architecture rules

1. **Always run `node --check js/<filename>.js` before finishing any JS edit.**
   A syntax error kills the entire app silently. Run all four files:
   ```
   for f in js/*.js; do node --check "$f" && echo "$f OK"; done
   ```

2. **No `var`.** Use `const` and `let` only.

3. **No inline event handlers added from JS.** Event listeners go in `script.js`
   via `addEventListener`. The `onclick=` attributes in `index.html` for tab buttons,
   sort controls, and filter toggles are the only exceptions — leave those as-is.

4. **Namespace all IDs.** Archiver elements: `a-` prefix. Viewer elements: `v-` prefix.

5. **`AppState` is the single source of truth for runtime data** (`script.js`).
   Never store runtime state in the DOM or in module-level variables in other files.
   Current `AppState` shape:
   ```js
   {
     allComments:   [],   // flat array (archiver)
     threads:       [],   // nested array (viewer)
     videoTitle:    '',
     videoId:       '',
     isFetching:    false,
     stopRequested: false,
     currentSort:   'newest',
     showComments:  true,
     showReplies:   true,
     previewCount:  0,    // archiver live preview item count
   }
   ```

6. **`localStorage` keys in use:**
   - `yt-suite-api-key` — the user's YouTube API key
   - `yt-suite-theme` — `'dark'` or `'light'`
   Do not add new keys without documenting them here.

---

## Performance patterns (do not revert these)

These were added deliberately to handle large archives without locking the browser:

### Archiver — live preview cap
The live preview is capped at **100 items** (`previewCount` in `AppState`).
Beyond 100 a `.preview-limit-note` element is appended. The full archive is always
available in the Viewer — the cap is display-only.

### Viewer — infinite scroll batch rendering
The viewer renders comments in batches of **100** (`BATCH_SIZE` in `script.js`).
- `_renderViewer()` paints the first batch immediately
- An `IntersectionObserver` sentinel at the bottom of the feed triggers `_renderBatch()`
  when the user scrolls within 400px of the bottom
- Sentinel dots (`.sentinel-dots`) are shown while the next batch loads
- `_teardownSentinel()` is always called before a new render to clean up observers

### Viewer — debounced filter rendering
`applyViewerFilters()` is debounced by **80ms** (`_filterTimer`). It shows the
loading dots (`#v-loading`) immediately and defers the expensive sort/filter/render
to `_renderViewer()`. Do not remove this debounce.

### Archive manager — O(1) reply lookup
`buildNestedExport()` uses a `Map<parentId, replies[]>` rather than filtering
`allComments` per thread. Do not revert to the O(n²) approach.

### Viewer — browser yield during fetch
The archiver yields to the browser every 10 threads during fetch:
```js
if (threadNum % 10 === 0) await new Promise(r => setTimeout(r, 0));
```
Keep this to prevent UI freezing on large videos.

---

## API quota reference

YouTube Data API v3 — **10,000 units/day free**, resets midnight Pacific Time.

| Operation                        | Cost    | Notes                                        |
|----------------------------------|---------|----------------------------------------------|
| Fetch video metadata             | 1 unit  | Once per fetch session                       |
| One page of comment threads      | 1 unit  | Up to 100 top-level comments per page        |
| One page of replies (overflow)   | 1 unit  | Only when a thread has more than 5 replies   |
| Threads with ≤5 replies          | 0 extra | Bundled free inside the thread response      |

**Error handling requirements in `youtube-api.js`:**
- `403 quotaExceeded` → clear message explaining daily limit and reset time
- `400 keyInvalid` → tell user to check their key
- `403 forbidden` → tell user to enable YouTube Data API v3 in their project
- `404` → video not found / private / deleted
- All other errors → show code + message

---

## Feature: user profile on username click

**Status: planned, not yet implemented**

When a user clicks any `.c-author` element in the Viewer, a modal appears showing
that author's activity within the currently loaded archive.

### Data (computed from `AppState.threads` — no API call needed)
- Total top-level comments by this author
- Total replies by this author
- Total likes received across all their content
- List of their comments (newest first)
- List of their replies (newest first), each showing the parent comment dimmed above

### Implementation split
- Data aggregation → `ArchiveManager.getUserStats(threads, authorName)`
- Modal rendering → `UI.renderUserModal(authorName, stats)`
- Click wiring → `script.js` (delegate from `#v-comment-feed` via event delegation
  on `.c-author` — do not add individual listeners per comment)

### Important constraints
- Author display names are **not unique** on YouTube. Label the modal clearly as
  "activity in this video" — make no identity claims across videos
- Do not use `authorChannelId` for cross-video lookup at this stage
- Modal must respect dark/light theme
- Close on outside click or Escape key
- Style consistently with existing panels (same border, background, font)

---

## Feature: viewer meta bar — upload date and channel name

**Status: complete**

The meta bar in the Viewer tab now shows two additional fields:

- **Uploaded** — the video's original publish date from YouTube (`snippet.publishedAt`),
  formatted as `MMM DD, YYYY`. Falls back to `—` for archives exported before this feature.
- **Channel** — the uploading channel's display name (`snippet.channelTitle`). Rendered as
  a `.meta-link` (accent colour, underline on hover) and clicking it opens the author
  profile modal showing that channel's comments in the loaded archive.

### Data flow
- `youtube-api.js` `getVideoInfo()` returns `publishedAt` and `channelTitle` (both were
  already in the `snippet` response; just not previously returned)
- `AppState` carries `videoPublishedAt` and `videoChannelTitle`
- `archive-manager.js` `buildNestedExport()` and `exportJSON()` accept and persist both
  fields so they survive a JSON round-trip
- `script.js` `loadViewerData()` populates `#v-meta-uploaded` and `#v-meta-channel`;
  the channel span gets the `.meta-link` class added/removed based on whether data exists
- A delegated click listener on `#v-meta-bar` (set up in `DOMContentLoaded`) handles
  the channel name click — calls `ArchiveManager.getUserStats` + `UI.renderUserModal`

### Backwards compatibility
Old JSON exports without `videoPublishedAt` / `videoChannelTitle` display `—` for those
fields. No errors thrown.

---

## Feature: Web Workers for off-main-thread processing

**Status: future consideration — implement after user profile modal**

Move the CPU-heavy operations in `archive-manager.js` off the main thread so the UI
stays fully responsive during large-archive operations.

### Motivation
After the O(n²) fix and infinite-scroll rendering, the remaining main-thread bottleneck
is `filterThreads` / `sortThreads` on large archives (300k+ comments). At that scale,
each search keystroke (even debounced) can cause brief stutter on slower devices.
`buildNestedExport` is also still a synchronous main-thread operation.

### Scope
- New `js/worker.js` — imports `archive-manager.js` logic via `importScripts()`,
  handles `filter`, `sort`, and `export` message types
- `script.js` — instantiate one worker on page load; post messages instead of calling
  `_renderViewer` directly; cancel in-flight jobs when a new search arrives
- `archive-manager.js` — no changes needed; logic is already DOM-free

### Data transfer
Use structured clone (not `SharedArrayBuffer`). Transfer `AppState.threads` to the
worker once on load; the worker holds its own copy. Simpler than shared memory and
avoids the `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` header
requirements that `SharedArrayBuffer` demands.

### Constraints
- Worker file must be a real file path (`new Worker('js/worker.js')`) — no inline blobs.
  This matches the existing constraint that the app must be served over HTTP anyway.
- No bundler, so use `importScripts()` inside the worker rather than ES module imports.
- Do not implement until the user profile modal is complete — the worker message
  interface should not need to keep changing as features are added.

---

## Testing checklist before every commit

- [ ] `node --check` passes on all four JS files
- [ ] App loads without console errors on `http://localhost:8080`
- [ ] All three tabs switch correctly
- [ ] Dark/light toggle works and persists on refresh
- [ ] API key persists on refresh
- [ ] Logo SVG renders in tab bar (not broken image)
- [ ] Fetch completes on a small public video (< 500 comments)
- [ ] Preview caps at 100 with the limit note visible
- [ ] "→ Open in Viewer" passes data without a download
- [ ] Infinite scroll loads next batch on scroll
- [ ] Search highlights matches; full reply thread shown with non-matches dimmed
- [ ] Clicking a comment/reply during search clears highlights
- [ ] JSON export loads correctly when dropped back into Viewer
- [ ] No layout breakage at 375px viewport width

---

## Known decisions (do not revisit without good reason)

- **No bundler / no build step.** Plain `<script src="">` loading. Zero toolchain friction.
- **No external JS libraries.** No jQuery, no lodash, no chart libraries in this project.
- **Flat file serving only.** Direct browser → YouTube API calls. No proxy.
- **Per-user API keys.** Users supply their own. No built-in key.
  If this changes, it requires a serverless proxy — see README for architecture notes.
- **`yt-channel-suite/` is a separate future project**, not new tabs in this app.
  Do not add channel-level features here.

---

## Commit message conventions

```
add: short description of new feature
fix: what was broken and what fixed it
style: visual/CSS-only change
refactor: restructuring without behaviour change
docs: README, CLAUDE.md, or code comment updates
```