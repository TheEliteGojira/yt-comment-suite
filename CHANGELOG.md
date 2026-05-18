# CHANGELOG — TubeArchiver

All commits and version changes are recorded here in reverse chronological order.

---

## COMMIT #23 / α 0.23.0
Comment permalinks and filtered export. Each comment and reply card now shows a small ↗ anchor between the date and likes, linking to `youtube.com/watch?v={videoId}&lc={commentId}` in a new tab; omitted when videoId is unavailable. `renderThread` accepts `videoId` as a 6th parameter. `archive-manager.js` gains `flattenThreads` (nested→flat) and `exportFilteredJSON` (wraps already-nested threads in the standard envelope). When a search query is active or either Show toggle is off, a `#v-filtered-export-row` appears inside `v-controls` with JSON/CSV/TXT buttons and a live count label. Row hides on viewer reset. Version badge and README updated to α 0.23.0.
*(js/ui.js, js/script.js, js/archive-manager.js, css/styles.css, index.html, README.md, CHANGELOG.md, CLAUDE.md)*

---

## COMMIT #22 / α 0.22.0
Two modal fixes for channel owners with no comments. (1) Meta-bar click now injects `AppState.videoChannelId` as `stats.authorChannelId` when `getUserStats` returns no matches, so the "View channel ↗" link always appears for the channel owner regardless of comment activity. (2) Modal body renders a single "No comments or replies found in this archive." message when both counts are zero, replacing the two empty sections that previously made the modal appear broken. Version badge and README updated to α 0.22.0.
*(js/script.js, js/ui.js, index.html, README.md, CHANGELOG.md)*

---

## COMMIT #21 / α 0.21.0
Two new features. (1) **Quota estimate:** `getVideoInfo` now requests `snippet,statistics` (same quota cost). The returned `commentCount` is used to show `#a-quota-estimate` below the options row immediately after the metadata fetch — "~N units estimated (X comments · replies will add more)". Hidden and cleared on reset; hidden when comments are disabled. (2) **Channel link in author modal:** `getUserStats` now returns `authorChannelId` (first found across matched comments/replies). `renderUserModal` renders a "View channel ↗" anchor beneath the disclaimer when the field is present, linking to `youtube.com/channel/{id}` in a new tab. CLAUDE.md updated with both features. Version badge and README updated to α 0.21.0.
*(js/youtube-api.js, js/archive-manager.js, js/script.js, js/ui.js, css/styles.css, index.html, README.md, CHANGELOG.md, CLAUDE.md)*

---

## COMMIT #20 / α 0.20.0
Two-part avatar bug fix. (1) `.c-author` comment feed click now passes `AppState.videoChannelId` to `getUserStats`, matching the existing meta-bar click — this restores the `authorChannelId` fallback for channel owners who have renamed their account. (2) `renderUserModal` `onerror` handler now replaces the broken `<img>` with the placeholder div rather than simply hiding it, so expired or unavailable avatar URLs degrade gracefully. Version badge and README updated to α 0.20.0.
*(js/script.js, js/ui.js, index.html, README.md, CHANGELOG.md)*

---

## COMMIT #19 / α 0.19.0
Theme-adaptive logo: "Archiver" wordmark now renders white in dark mode and black in light mode. `logo.svg` path5 fill changed from `#ff233d` to `#f0f0f0`; `logo-light.svg` created as a sibling with path5 fill `#111111`. `index.html` updated to two `<img>` tags (`.suite-logo-img--dark` / `.suite-logo-img--light`); CSS show/hide rules added to `styles.css` keyed on `[data-theme="light"]`. CLAUDE.md logo section rewritten to document two-file system; long-term items 1–4 moved to short term. Version badge and README updated to α 0.19.0.
*(assets/logo.svg, assets/logo-light.svg, index.html, css/styles.css, CLAUDE.md, README.md, CHANGELOG.md)*

---

## COMMIT #18 / α 0.18.0
Reverted heading font from Jost back to Syne following comparison test (commits 17b/17c). Google Fonts import and all font-family declarations restored to Syne. Version badge and README updated to α 0.18.0.
*(css/styles.css, index.html, README.md, CHANGELOG.md)*

---

## COMMIT #17c / α 0.17.0c
Replaced heading font Exo 2 with Jost for comparison against Exo 2 (commit 17b). Google Fonts import updated; all nine `font-family` declarations replaced with `'Jost'`. Version badge and README updated to α 0.17.0c.
*(css/styles.css, index.html, README.md)*

---

## COMMIT #17b / α 0.17.0b
Replaced heading font Syne with Exo 2 for comparison against Jost (commit 17c). Google Fonts import updated; all nine `font-family: 'Syne'` declarations replaced with `'Exo 2'`. Version badge and README updated to α 0.17.0b.
*(css/styles.css, index.html, README.md)*

---

## COMMIT #17 / α 0.17.0
Complete rewrite of README.md to reflect the current state of the project: updated project name (TubeArchiver), current version badge, full feature list including author profiles and avatars, updated Viewer usage section, performance optimisation table, accurate large-archive notes, and links to CLAUDE.md and CHANGELOG.md. Version badge updated to α 0.17.0 in `index.html` and `README.md`.
*(README.md, index.html)*

---

## COMMIT #16b / α 0.16.0
Updated version badge from α 0.15.0 to α 0.16.0 to correct the async between commit number and alpha title introduced in commit 16.
*(index.html)*

---

## COMMIT #16 / α 0.15.0
Created CHANGELOG.md.
*(CHANGELOG.md)*

---

## COMMIT #15b / α 0.15.0
Updated version badge from α 0.13.0 to α 0.15.0 to correct the async between commit number and alpha title introduced in commit 15.
*(index.html)*

---

## COMMIT #15 / α 0.13.0
Updated logo.svg with revised artwork.
*(assets/logo.svg)*

---

## COMMIT #14 / α 0.13.0
CLAUDE.md housekeeping — moved all completed short-term tasks into the ✅ Completed section; short-term section left clean for new entries.
*(CLAUDE.md)*

---

## COMMIT #13 / α 0.13.0
Introduced version badge (`#version-badge`) fixed to the bottom-left of the screen across all tabs. Displays the current alpha version so it is easy to confirm which build is live. Initial value set to α 0.13.0.
*(index.html, css/styles.css, CLAUDE.md)*

---

## COMMIT #12 / —
Avatar display fix, channel-owner profile lookup, CSV column addition, and Viewer meta bar order correction.
- `getUserStats` now extracts `avatarUrl` from the first matching comment or reply.
- `getUserStats` accepts an optional `channelId` parameter enabling `authorChannelId` fallback matching — fixes the channel owner's profile picture not loading when `videoChannelTitle` mismatches `authorDisplayName` (e.g. after a channel rename).
- `getVideoInfo` now returns `channelId`; `AppState.videoChannelId` threads it through `startFetch`, `resetArchiver`, `openInViewer`, `exportJSON`, `loadViewerData`, and the meta-bar click handler, and is persisted in exported JSON.
- `exportCSV`: added `authorAvatar` column.
- Viewer meta bar: swapped Uploaded / Exported to the correct order (Total, Top-Level, Replies, Uploaded, Exported, Channel).
- About tab: added two Workflow Tips entries covering the author profile panel and avatar expiry behaviour.
- `styles.css`: added `.modal-header-text` flex-column wrapper rule.
- CLAUDE.md: all five short-term tasks marked complete; `AppState` and `getUserStats` docs updated.
*(CLAUDE.md, css/styles.css, index.html, js/archive-manager.js, js/script.js, js/youtube-api.js)*

---

## COMMIT #11 / —
Restructured and expanded CLAUDE.md into its current authoritative format with full TO-DO tracking instructions. Implemented avatar support: `authorProfileImageUrl` stored as `authorAvatar` on every comment and reply object; `getUserStats` returns `avatarUrl`; `renderUserModal` renders the avatar as an `<img>` with an `onerror` fallback and a grey placeholder div for pre-avatar archives. Added `.modal-avatar` and `.modal-avatar--placeholder` CSS. Minor additions to `archive-manager.js` and `youtube-api.js`.
*(CLAUDE.md, css/styles.css, js/archive-manager.js, js/ui.js, js/youtube-api.js)*

---

## COMMIT #10 / —
Author profile modal, Viewer meta bar upload date and channel name, infinite-scroll batch rendering, and O(n) export rewrite.
- Viewer meta bar now shows video upload date (`videoPublishedAt`) and channel name (`videoChannelTitle`); channel name is clickable and opens the author activity modal scoped to the loaded archive.
- Author profile modal: clicking any `.c-author` in the Viewer shows that author's comment count, reply count, total likes, and full activity list with dimmed parent context shown above each reply.
- Infinite-scroll batch rendering (`BATCH_SIZE = 100`) with `IntersectionObserver` sentinel replaces full-list render; handles 300k+ comments without browser stutter.
- `buildNestedExport` rewritten from O(n²) to O(n) using a `Map<parentId, replies[]>`.
- Archiver live preview capped at 100 items; full archive available in Viewer.
- Browser yields to the event loop every 10 threads during fetch to keep the UI responsive.
- `getVideoInfo` now returns `publishedAt` and `channelTitle` from the API snippet.
- `getUserStats` added to `ArchiveManager` for per-author activity aggregation.
- CLAUDE.md updated with completed features and Web Workers future note.
*(CLAUDE.md, css/styles.css, index.html, js/archive-manager.js, js/script.js, js/youtube-api.js)*

---

## COMMIT #9 / —
User profile modal CSS and JS. Major `styles.css` additions: `.modal-overlay`, `.modal-panel`, `.modal-header`, `.modal-avatar`, `.modal-stats`, `.modal-body`, `.modal-section-label`, `.modal-comment-card`, `.modal-parent-context`, `.modal-reply-card`, `.modal-empty`. Added `renderUserModal` and `closeModal` to `ui.js`. Wired delegated click listeners for `.c-author` in `script.js`. CLAUDE.md updated with modal implementation notes.
*(CLAUDE.md, css/styles.css, js/archive-manager.js, js/script.js, js/ui.js)*

---

## COMMIT #8 / —
Added CLAUDE.md as the authoritative architecture and design reference for the project. Added `assets/logo.svg` (three stacked red chevrons + TUBE pill badge + Archiver wordmark). CSS colour token updates and minor HTML adjustments.
*(CLAUDE.md, assets/logo.svg, css/styles.css, index.html)*

---

## COMMIT #7 / —
Performance improvements: `buildNestedExport` in `archive-manager.js` rewritten to use a `Map` for O(n) reply lookup (previously O(n²)). Infinite-scroll batch rendering foundation added to `script.js`. Minor CSS additions.
*(css/styles.css, js/archive-manager.js, js/script.js)*

---

## COMMIT #6 / —
Fetch chunking and UI responsiveness improvements. Script rewritten to yield to the browser event loop every 10 threads during fetch. Archiver live preview capped at 100 items with `.preview-limit-note`. Dot loader behaviour and progress section updates. CSS and HTML additions to support new UI states.
*(css/styles.css, index.html, js/script.js)*

---

## COMMIT #5 / —
CSS and HTML layout refinements. Spacing, typography, and structural adjustments across the Archiver and Viewer tabs.
*(css/styles.css, index.html)*

---

## COMMIT #4 / —
Added dot-loader buffering animation (`#a-dot-loader`, `#v-loading`). CSS additions for `.dot-loader`, `@keyframes dotGlow`. Minor `ui.js` additions for show/hide helpers.
*(css/styles.css, index.html, js/ui.js)*

---

## COMMIT #3 / —
Added `.gitignore` to exclude `.claude/worktrees/` from version control. Minor HTML correction.
*(.gitignore, index.html)*

---

## COMMIT — Third commit / Tube Archiver v1
Minor `ui.js` fix (one-line correction).
*(js/ui.js)*

---

## COMMIT — Second commit / Tube Archiver v1
Major build-out of the app shell: CSS design system established (colour tokens, typography, layout, tab bar, panels, buttons, archiver and viewer components). HTML structure expanded with all tab panels, inputs, progress section, results section, drop zone, meta bar, and comment feed. `ui.js` updated with rendering helpers.
*(css/styles.css, index.html, js/ui.js)*

---

## COMMIT — Initial commits / Tube Archiver v1
Initial file upload. Project scaffolded with `index.html`, `css/styles.css`, `js/youtube-api.js`, `js/archive-manager.js`, `js/ui.js`, `js/script.js`.
