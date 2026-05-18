# CLAUDE.md — TubeArchiver
> Read this at the start of every session. It is the authoritative reference for
> architecture, design rules, and planned work. The TO-DO section at the bottom
> tracks all outstanding tasks — mark items complete there after finishing them.

---

## What this project is

**TubeArchiver** is a self-contained, client-side web app for fetching, browsing, and
exporting YouTube comments. It runs entirely in the browser with no server, backend,
or cloud storage. All data stays on the user's machine.

It is a portfolio project. Code quality, comments, and consistency matter as much as
functionality. Never sacrifice clarity for cleverness.

---

## File structure

```
yt-comment-suite/
├── index.html              Layout only — tabs, inputs, buttons, HTML structure.
│                           No logic. No inline styles except occasional width overrides.
├── assets/
│   └── logo.svg            TubeArchiver SVG logo. Always use as an <img> tag.
│                           Never replace with text, emoji, or inline SVG.
├── css/
│   └── styles.css          All visual design: colours, spacing, typography,
│                           dark/light themes, mobile breakpoints, modal styles.
└── js/
    ├── youtube-api.js      YouTube Data API v3 only. URL building, fetch calls,
    │                       error classification, response parsing.
    │                       No DOM access. No UI side effects.
    ├── archive-manager.js  Data only. Import/export JSON/CSV/TXT, sort, filter,
    │                       getUserStats. No DOM access. No API calls.
    ├── ui.js               Presentation only. DOM helpers, comment rendering,
    │                       modal, theme toggle, timezone dropdown.
    │                       No API calls. No business logic.
    └── script.js           Orchestration. App init, event listeners, tab switching,
                            fetch loop, viewer batch rendering, AppState management.
```

**The module separation is strict.** Before adding anything, decide which file owns it:
- Talking to YouTube → `youtube-api.js`
- Transforming data → `archive-manager.js`
- Touching the DOM → `ui.js`
- Wiring it together → `script.js`

---

## Logo

Two SVG files provide theme-adaptive logo rendering:

- `assets/logo.svg` — dark-mode variant. Chevrons and TUBE pill in `#ff233d`; "Archiver" wordmark in `#f0f0f0` (light grey).
- `assets/logo-light.svg` — light-mode variant. Identical except "Archiver" wordmark is `#111111` (near-black).

In `index.html`:

```html
<div class="suite-logo">
  <img src="assets/logo.svg" alt="TubeArchiver" class="suite-logo-img suite-logo-img--dark">
  <img src="assets/logo-light.svg" alt="TubeArchiver" class="suite-logo-img suite-logo-img--light">
</div>
```

CSS swaps visibility based on `[data-theme]` (set on `<body>`):

```css
.suite-logo-img--light { display: none; }
[data-theme="light"] .suite-logo-img--dark  { display: none; }
[data-theme="light"] .suite-logo-img--light { display: block; }
```

`.suite-logo-img` renders at `height: 42px` on desktop. Do not filter, recolour, or replace the SVGs.
Do not consolidate back to a single file — the two-file approach is intentional.

---

## Design system

### Colour tokens — `css/styles.css :root`

| Token              | Dark        | Light       | Purpose                                  |
|--------------------|-------------|-------------|------------------------------------------|
| `--bg`             | `#0a0a0a`   | `#f5f5f0`   | Page background                          |
| `--panel`          | `#111111`   | `#ffffff`   | Cards, panels, modal                     |
| `--panel-hover`    | `#161616`   | `#f9f9f4`   | Panel hover                              |
| `--border`         | `#222222`   | `#dddddd`   | All borders                              |
| `--accent`         | `#ff233d`   | `#ff233d`   | Primary — buttons, active states, authors|
| `--accent-dim`     | `#df1846`   | `#df1846`   | Primary button hover                     |
| `--accent2`        | `#f5702d`   | `#f5702d`   | Secondary — danger, hearts, close button |
| `--blu`            | `#096cbc`   | `#096cbc`   | Reply author names, code text in About   |
| `--text`           | `#f0f0f0`   | `#111111`   | Primary text                             |
| `--text-muted`     | `#555555`   | `#888888`   | Labels, hints, secondary text            |
| `--highlight-bg`   | `#df1846`   | `#df1846`   | Search match background                  |
| `--highlight-text` | `#e8ff4e`   | `#e8ff4e`   | Search match text                        |
| `--reply-bg`       | `#0d0d0d`   | `#f0f0ea`   | Reply card background                    |
| `--reply-border`   | `#1e1e1e`   | `#e0e0d8`   | Reply card border                        |
| `--progress-track` | `#1a1a1a`   | `#e0e0e0`   | Progress bar track                       |

**Never hardcode colour values in HTML or JS.** Always use the CSS custom properties.
New colours must be added to `:root` first before use anywhere else.

> Note: the token previously named `--green` was renamed `--blu` by an earlier session.
> Always use `--blu` for reply author colour and `about-code` text colour.

### Typography
- **Body / UI / code:** `Space Mono` (monospace)
- **Headings / titles / stats:** `Syne` (sans-serif, weight 800)
- Both loaded from Google Fonts in `styles.css`. Do not add other fonts.

### Shape and spacing
- Flat aesthetic — no border-radius (`--radius: 0px`)
- Panel padding: `24px 28px`
- Page wrap: `40px 24px 80px` desktop → `24px 16px 60px` mobile
- Tab bar height: `52px`
- Max content width: `860px` (archiver), `820px` (viewer), `740px` (about)

---

## JavaScript rules

1. **Always syntax-check every JS file before finishing.**
   ```bash
   for f in js/*.js; do node --check "$f" && echo "$f OK"; done
   ```
   A single syntax error kills the entire app silently. This is non-negotiable.

2. **No `var`.** Use `const` and `let` only.

3. **No inline event handlers added from JavaScript.** Event listeners belong in
   `script.js` via `addEventListener`. The `onclick=` attributes already in
   `index.html` (tabs, sort, filter toggles) are the only exceptions — leave them.

4. **ID namespacing:** archiver elements → `a-` prefix, viewer elements → `v-`.

5. **`AppState` is the single source of truth** for all runtime data (`script.js`):
   ```js
   {
     allComments:       [],   // flat array used by archiver
     threads:           [],   // nested array used by viewer
     videoTitle:        '',
     videoId:           '',
     videoPublishedAt:  '',
     videoChannelTitle: '',
     videoChannelId:    '',   // used for authorChannelId fallback in getUserStats
     isFetching:        false,
     stopRequested:     false,
     currentSort:       'newest',
     showComments:      true,
     showReplies:       true,
     previewCount:      0,    // live preview item count (capped at 100)
   }
   ```

6. **`localStorage` keys in use:**
   - `yt-suite-api-key` — YouTube Data API v3 key
   - `yt-suite-theme` — `'dark'` or `'light'`
   Document any new keys here before adding them.

---

## Performance patterns — do not revert

These exist deliberately and have measurable impact on large archives.

**Archiver preview cap (100 items)**
The live preview shows a maximum of 100 comments (`previewCount` in `AppState`).
A `.preview-limit-note` is appended at the cap. The full archive is always in the Viewer.

**Viewer — infinite scroll batching**
Comments render in batches of 100 (`BATCH_SIZE` in `script.js`).
An `IntersectionObserver` sentinel at the bottom of the feed fires `_renderBatch()`
when the user scrolls within 400px of it. `.sentinel-dots` are shown between batches.
Always call `_teardownSentinel()` before starting a new render.

**Viewer — debounced filter**
`applyViewerFilters()` debounces 80ms before calling `_renderViewer()`. Loading dots
are shown immediately. Do not remove the debounce — it prevents thrashing on keystrokes.

**Archive manager — O(1) reply lookup**
`buildNestedExport()` builds a `Map<parentId, replies[]>` before iterating threads.
Do not revert to the O(n²) `filter()` approach.

**Fetch — browser yield**
The archiver yields to the browser every 10 threads during fetching:
```js
if (threadNum % 10 === 0) await new Promise(r => setTimeout(r, 0));
```
This keeps the UI responsive on large videos. Keep it.

---

## Author data and avatars

The YouTube API returns `authorProfileImageUrl` in every comment snippet. It is stored
on every comment and reply object as `authorAvatar`. Display it as a plain `<img>` tag —
this works cross-origin without any proxy. Do not attempt to fetch or process the URL
in JavaScript (canvas, blob) as Google's CDN blocks CORS for that use case.

Avatar URLs stored in exported JSON archives may expire or become outdated over time
as users change their profile pictures. This is a known limitation — no workaround exists
without re-fetching.

For archives exported before `authorAvatar` was added, the field will be absent.
Always use a fallback:
```js
const avatarHtml = stats.avatarUrl
  ? `<img src="${esc(stats.avatarUrl)}" class="modal-avatar" alt=""
       onerror="this.style.display='none'">`
  : `<div class="modal-avatar modal-avatar--placeholder"></div>`;
```

---

## API quota reference

**10,000 units/day free.** Resets at midnight Pacific Time.

| Operation                      | Cost    | Notes                                         |
|--------------------------------|---------|-----------------------------------------------|
| Fetch video metadata           | 1 unit  | Once per session                              |
| One page of comment threads    | 1 unit  | Up to 100 top-level comments per page         |
| One page of replies (overflow) | 1 unit  | Only when a thread has more than 5 replies    |
| Threads with ≤5 replies        | 0 extra | Bundled free inside the thread response       |

**Error messages in `youtube-api.js` must be specific:**
- `403 quotaExceeded` → explain daily limit and midnight Pacific reset
- `400 keyInvalid` → tell user to check they copied the key correctly
- `403 forbidden` → tell user to enable YouTube Data API v3 in their project
- `404` → video not found, private, or deleted
- All others → show HTTP code + raw message

---

## User profile modal

Clicking any `.c-author` element in the Viewer opens a modal showing that author's
activity within the currently loaded archive. Fully implemented.

**Data flow:**
1. Event delegation on `#v-comment-feed` in `script.js` catches `.c-author` clicks
2. `ArchiveManager.getUserStats(threads, authorName)` aggregates the data
3. `UI.renderUserModal(stats)` builds and mounts the modal

**`getUserStats(threads, authorName, channelId?)` returns:**
```js
{
  authorName,
  authorChannelId,  // first authorChannelId found across their comments/replies, or ''
  avatarUrl,        // first authorAvatar found across their comments/replies, or ''
  commentCount,
  replyCount,
  totalLikes,
  comments,         // sorted newest first
  replies,          // sorted newest first, each with ._parentThread for context
}
```

The optional `channelId` parameter enables `authorChannelId` matching as a fallback.
This is used for the meta-bar channel name click so it still works if the channel
owner has renamed their account since commenting. Pass `AppState.videoChannelId`.

**Channel link:**
A "View channel ↗" anchor is shown below the disclaimer when `stats.authorChannelId`
is non-empty. It links to `https://www.youtube.com/channel/{authorChannelId}` and
opens in a new tab (`target="_blank" rel="noopener noreferrer"`). Archives exported
before `authorChannelId` was stored will not show the link — no fallback is needed.

**Constraints — do not change these:**
- YouTube display names are not unique. The modal is explicitly scoped to
  "activity in this video only." Do not claim identity across videos.
- Do not use `authorChannelId` for cross-video lookups at this stage.
- Modal closes on ✕ click, outside click, or Escape key.
- Body scroll is locked (`overflow: hidden`) while the modal is open.

---

## Commit conventions

```
add:      new feature or file
fix:      bug fix — describe what broke and what fixed it
style:    CSS/visual only, no logic change
refactor: restructure without behaviour change
docs:     README, CLAUDE.md, code comments only
```

---

## Architectural decisions — do not revisit without discussion

- **No bundler, no build step.** Plain `<script src="">` loading. Zero toolchain.
- **No external JS libraries** in this project (no jQuery, lodash, chart libs).
- **No server-side proxy.** Direct browser → YouTube API. CORS is handled at the
  `<img>` tag level for avatars; all other data is JSON with proper CORS headers.
- **Per-user API keys.** Users supply their own key. No built-in shared key.
  Changing this requires a serverless proxy — see README for architecture notes.
- **`yt-channel-suite/` is a separate future project.** Do not add channel-level
  features (subscriber counts, video lists, upload history) to this codebase.

---

## TO-DO

> **Instructions for the Code instance:**
> Work through items in order unless directed otherwise.
> After completing a task, change `[ ]` to `[x]` and append a short completion note
> on the same line describing what was done and which files changed.
> Do not delete completed items — the history is useful.
> Move any completed items from the "Short Term" section to the "Completed" section.
> Run the full syntax check and the testing checklist after every task.

---

### ✅ Completed

- [x] **Avatar in user profile modal** — store `authorProfileImageUrl` as `authorAvatar`
      on every comment and reply; pass `avatarUrl` through `getUserStats`; render as
      `<img>` in the modal header with a grey placeholder fallback for pre-avatar archives.
      *(youtube-api.js, archive-manager.js, ui.js, styles.css)*

- [x] **CSV export: add `authorAvatar` column** — added `'authorAvatar'` to the
      `headers` array in `archive-manager.js` `exportCSV()`. *(archive-manager.js)*

- [x] **Viewer: `.c-author` clickable styling** — `cursor: pointer` and hover underline
      were already present in `styles.css`; no code change needed. *(styles.css)*

- [x] **About tab: document the profile modal** — added two list items under
      "Workflow Tips": one explaining the author profile panel, one explaining avatar
      expiry and the placeholder fallback. *(index.html)*

- [x] **Profile picture bug** — root cause: `getUserStats` was not extracting
      `avatarUrl` from matched comments/replies, and the channel-owner click had no
      fallback when `videoChannelTitle` mismatched `authorDisplayName`. Fixed:
      `getUserStats` now accepts an optional `channelId` param and does
      `authorChannelId` fallback matching; `avatarUrl` is populated from the first
      matching comment or reply. `getVideoInfo` now returns `channelId`;
      `AppState.videoChannelId` threads it through to the meta-bar click handler and
      to exported JSON. *(youtube-api.js, archive-manager.js, script.js, CLAUDE.md)*

- [x] **Viewer Tab panel reshuffle** — swapped Uploaded and Exported divs in the
      meta bar so order is: Total, Top-Level, Replies, Uploaded, Exported, Channel.
      *(index.html)*

- [x] **Add a version title to the bottom left of screen** — fixed `#version-badge`
      div added before `</body>`; displays `α 0.13.0`. CSS: `position: fixed`,
      `bottom: 14px`, `left: 16px`, `var(--text-muted)`, `pointer-events: none`.
      *(index.html, styles.css)*

- [x] **Dark/light: logo adaptation for light mode** — two SVG files: `logo.svg`
      ("Archiver" text `#f0f0f0` for dark) and `logo-light.svg` ("Archiver" text
      `#111111` for light). CSS swaps visibility via `[data-theme]` attribute.
      `index.html` updated to two `<img>` tags with `--dark`/`--light` classes.
      *(assets/logo.svg, assets/logo-light.svg, index.html, css/styles.css)*

- [x] **Channel author avatar bug (re-fix)** — `.c-author` feed click was missing
      `AppState.videoChannelId` argument to `getUserStats`; now matches the meta-bar
      click pattern so `authorChannelId` fallback fires for renamed channel owners.
      `renderUserModal` `onerror` now swaps the broken `<img>` for the placeholder div
      rather than hiding it, so expired avatar URLs degrade gracefully.
      *(js/script.js, js/ui.js)*

---

### 🔧 Short term

- [x] **User profile modal: channel link** — `getUserStats` now returns
      `authorChannelId` (first found across matched comments/replies). `renderUserModal`
      renders a "View channel ↗" anchor below the disclaimer when `authorChannelId` is
      present; opens `https://www.youtube.com/channel/{id}` in a new tab.
      `.modal-channel-link` CSS added. Pre-authorChannelId archives show nothing.
      *(js/archive-manager.js, js/ui.js, css/styles.css)*

- [x] **Archiver: estimated quota cost** — `getVideoInfo` now requests `statistics`
      alongside `snippet` (no extra quota cost). Returns `commentCount` (integer).
      After a successful metadata fetch, `script.js` shows `#a-quota-estimate` below
      the options row: "~N units estimated (X comments · replies will add more)".
      Hidden and cleared in `resetArchiver`. Hidden when comments are disabled (count 0).
      *(js/youtube-api.js, js/script.js, index.html, css/styles.css)*

- [x] **Viewer: comment permalink** — `renderThread` accepts a 6th `videoId` param.
      Each top-level card and reply card renders a `.c-permalink` anchor (`↗`) between
      the date and likes, linking to `youtube.com/watch?v={videoId}&lc={commentId}`.
      Opens in new tab; `stopPropagation` prevents triggering `clearSearchEffects`.
      Link omitted when `videoId` is absent. *(js/ui.js, js/script.js, css/styles.css)*

- [x] **Viewer: export filtered results** — `archive-manager.js` gains `flattenThreads`
      (nested → flat array) and `exportFilteredJSON` (wraps already-nested threads in
      the standard metadata envelope). `#v-filtered-export-row` appears inside
      `v-controls` when a search query is active or either toggle is off; shows JSON,
      CSV, TXT buttons and a "Filtered (N):" label. Hidden on reset.
      *(js/archive-manager.js, js/script.js, index.html)*

#### Low effort

- [ ] **Sticky controls bar** — pin `#v-controls` to the top of the viewport while
      scrolling the comment feed so sort, search, and filter remain accessible without
      scrolling back up. CSS `position: sticky` with appropriate `top` offset.
      *(css/styles.css)*

- [ ] **Copy comment text** — small clipboard icon button on each comment and reply
      card. Clicking it writes the comment text to the clipboard via `navigator.clipboard.writeText`.
      Should give brief visual feedback (e.g. icon swap or brief colour change) and
      revert after ~1.5 s. No library needed. *(js/ui.js, css/styles.css)*

- [ ] **Escape key closes modal** — add a `keydown` listener in `script.js` that calls
      `UI.closeModal()` when `event.key === 'Escape'` and a modal is currently open.
      *(js/script.js)*

- [ ] **Back to top button** — appears (fade in) after the user scrolls the Viewer feed
      past a threshold (e.g. 400px). Clicking it scrolls the page smoothly back to the
      top. Disappears again once near the top. *(index.html, js/script.js, css/styles.css)*

#### Medium effort

- [ ] **Author name hover tooltip** — show a small tooltip (e.g. "X comments · Y replies")
      when hovering a `.c-author` in the feed, giving a quick stats preview before
      opening the full modal. Pure CSS `[title]` attribute approach or a lightweight
      custom tooltip. *(js/ui.js, css/styles.css)*

- [ ] **Highlight active author in feed** — when the author profile modal is open, dim
      all comment threads whose author does not match the viewed user, so their activity
      stands out visually in the background feed. Remove highlight on modal close.
      *(js/ui.js, js/script.js, css/styles.css)*

- [ ] **Date range filter** — two date inputs (`from` / `to`) in the Viewer controls bar.
      When set, only threads containing at least one comment or reply within the range
      are shown. Integrates with the existing `applyViewerFilters` / `_renderViewer`
      pipeline. Clears with the existing reset flow. *(index.html, js/script.js, css/styles.css)*

- [ ] **Pin / bookmark comments** — a pin icon on each card toggles a `pinned` flag on
      the comment object in `AppState.threads`. A "Pinned" sort/filter mode shows only
      pinned items. Pinned set can be exported via the filtered export row. Pins are
      session-only (not persisted to localStorage). *(js/ui.js, js/script.js, js/archive-manager.js, css/styles.css)*

#### Higher effort

- [ ] **Word frequency panel** — scan the loaded archive and surface the N most-used
      words or phrases (excluding stop words). Display as a ranked list in the About or
      Viewer tab. No external libraries — implement client-side with a plain word-count
      `Map`. *(js/archive-manager.js, js/ui.js, index.html, css/styles.css)*

- [ ] **Sentiment distribution** — lightweight client-side classifier (positive / neutral /
      negative) using a small keyword lexicon. Display a simple three-bar breakdown
      below the Viewer meta bar or in a new panel. No external API or library.
      *(js/archive-manager.js, js/ui.js, index.html, css/styles.css)*

- [ ] **Multi-archive merge** — allow dropping a second `.json` export onto the Viewer
      while one is already loaded. Merge the thread arrays, deduplicate by comment ID,
      and re-render. Useful for comparing comment sections across related videos.
      *(js/archive-manager.js, js/script.js, js/ui.js)*

---

### 🗺 Long term
