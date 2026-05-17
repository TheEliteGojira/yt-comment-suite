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

`assets/logo.svg` — three stacked red chevrons + TUBE pill badge + Archiver wordmark,
all in `#ff233d`. In `index.html`:

```html
<div class="suite-logo">
  <img src="assets/logo.svg" alt="TubeArchiver" class="suite-logo-img">
</div>
```

`.suite-logo-img` renders at `height: 28px` on desktop, `22px` on mobile.
Do not filter, recolour, or replace the SVG.

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

---

### 🔧 Short term

---

### 🗺 Long term

- [ ] **User profile modal: channel link** — if `authorChannelId` is present on a
      comment, add a "View channel →" anchor pointing to
      `https://youtube.com/channel/{authorChannelId}` that opens in a new tab.
      The field is already stored; this is a UI addition in `ui.js renderUserModal`
      and a one-line CSS rule. Add a note in the modal that this opens YouTube externally.

- [ ] **Viewer: comment permalink** — add a small external-link icon to each comment
      card that opens `https://youtube.com/watch?v={videoId}&lc={commentId}` in a new
      tab. `videoId` is in `AppState`; `commentId` is the `id` field on each comment.
      Icon renders in `.comment-header` alongside the date and likes.

- [ ] **Archiver: estimated quota cost before fetch** — the `statistics` part of the
      videos endpoint (bundled into the existing metadata fetch at no extra quota cost)
      returns `commentCount`. Use it to estimate units needed and display it below the
      video URL input before the user clicks Fetch. Add to `youtube-api.js getVideoInfo`
      return value and wire display in `script.js`.

- [ ] **Viewer: export filtered results** — when a search query or filter is active,
      show an "Export filtered (N)" button in the controls bar. It should export only
      the currently visible threads (`_renderedThreads` in `script.js`) rather than the
      full archive. Add to `archive-manager.js` and wire in `script.js`.

- [ ] **Dark/light: logo adaptation for light mode** — in light mode the red logo on
      a near-white tab bar has lower contrast than ideal. Explore a CSS `filter` or a
      separate light-mode logo variant. Coordinate with the designer (owner of this repo)
      before implementing — do not change the logo unilaterally.
