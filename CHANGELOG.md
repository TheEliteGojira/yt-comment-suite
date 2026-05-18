# CHANGELOG — TubeArchiver

All commits and version changes are recorded here in reverse chronological order.

---

## COMMIT #36 / α 0.36.0
Three zero-extra-quota Short Term features completed in one pass.

**Video description toggle** — `getVideoInfo` now returns `description` from the already-fetched `snippet`. Stored in `AppState.videoDescription` and persisted in exported JSON. Viewer meta bar: `#v-desc-toggle` button + `#v-meta-description` panel added to `#v-meta-info`. Toggle label cycles "Show description ▾ / Hide description ▴". Content truncated at 500 chars with an inline "Show more" button for longer descriptions. `UI.esc()` used throughout (plain text only — no raw API HTML).

**Archiver info bar + title links** — After a successful metadata fetch the Archiver tab now shows `#a-video-info-bar`: thumbnail image on the left, linked video title (`<a class="a-video-title-link">`) on the right pointing to `youtube.com/watch?v=…`. Shown as `display: flex`; cleared and hidden by `resetArchiver`. In the Viewer, the title in `#v-meta-bar` is rendered as `<a class="meta-title-link">` when `meta.videoId` is present, plain text otherwise.

**Clickable links in comment text (`textDisplay` rendering)** — `parseThread` and `parseReply` now store both `text` (`textDisplay` HTML, for rendering) and `textOriginal` (plain text, for exports/search). `sanitiseDisplay(html)` added to `ui.js`: DOMParser-based allowlist (`<a>`, `<b>`, `<br>`, `<em>`, `<strong>`); forces `target="_blank" rel="noopener noreferrer"` on all anchors; only allows `https?://` hrefs; unwraps disallowed tags (keeps their text children). `applyHighlight(el, query)` added: TreeWalker-based text-node highlighter — never mutates attribute values, safe for sanitised HTML content. All comment cards render via `sanitiseDisplay`; search filter and all export formats continue using `textOriginal`. `filterThreads` updated to search `textOriginal` (avoids false matches inside HTML tag names/attributes).

*(js/youtube-api.js, js/ui.js, js/archive-manager.js, js/script.js, index.html, css/styles.css, CLAUDE.md, CHANGELOG.md)*

---

## COMMIT #35a / α 0.35.1
Hotfix: Viewer export buttons only appeared when a filter was active, making it impossible to export an unfiltered archive from the Viewer. Removed the `isFiltered` gate from `_updateFilteredExportRow` — the export content now shows whenever `_renderedThreads.length > 0`. Label updates dynamically: "All (N):" when no filter is active, "Filtered (N):" when one is. *(js/script.js, index.html, CHANGELOG.md)*

---

## COMMIT #35 / α 0.35.0
Video thumbnail, view count, and like count added to the Viewer meta bar. `getVideoInfo` now extracts `thumbnailUrl` (highest-res available from `snippet.thumbnails`), `viewCount`, and `likeCount` from the already-fetched `snippet,statistics` response — no extra API quota. All three fields are stored in `AppState`, threaded through `buildNestedExport` / `exportJSON` / `exportFilteredJSON` (meta object refactor — positional params replaced with a single `meta` object), and persisted in exported JSON so re-imported archives retain them. In the Viewer, `#v-meta-bar` restructured as a flex row: `#v-meta-thumb-wrap` + `#v-meta-info` (title, comment stats, new video stats row). Thumbnail rendered at `107×60px` with `object-fit: cover`; thumb wrap hidden for archives that predate this feature. View/like counts formatted with new `UI.fmtCount` (K/M/B abbreviation) and shown as a second `.meta-stats` row; hidden for older archives. `UI.show('v-meta-bar', 'flex')` updated from `'block'`.
*(js/youtube-api.js, js/ui.js, js/archive-manager.js, js/script.js, index.html, css/styles.css, CHANGELOG.md)*

---

## COMMIT #34a / α 0.34.1
Hotfix: filtered export buttons not appearing when a filter was active. Root cause: `#v-filtered-export-content` was a `<span>` with `align-items` and `gap` baked into its inline `style` alongside `display:none`, creating a fragile cascade when JS toggled `display` to `flex`. Fixed by changing the element to a `<div>` and moving layout properties (`display: flex; align-items: center; gap: 8px; flex-shrink: 0`) into a dedicated CSS rule. Inline style now only carries `display:none` as the initial hidden state. No JS changes.
*(index.html, css/styles.css, CHANGELOG.md)*

---

## COMMIT #30 / α 0.29.0
Removed tuan sprite from the About tab (file kept in assets for future use). Upscaled denton by 1.5× via `transform: scale(1.5); transform-origin: bottom right` — preserves pixel-art crispness and anchors the scale to the bottom-right position.
*(index.html, css/styles.css, CHANGELOG.md)*

---

## COMMIT #33b / α 0.33.1
Two viewer controls fixes. (1) **Reset button relocated** — "✕ Load a different file" moved from below the comment feed into the sticky controls bar as its own `#v-reset-row` filter-row, right-aligned via `margin-left: auto`. `script.js` updated to show/hide `v-reset-row` instead of `v-reset-btn` directly; `display: none` removed from `#v-reset-btn` CSS since visibility is now inherited from the parent row. (2) **Date input dark mode** — `color-scheme: dark` added to `.v-date-input`; overridden to `color-scheme: light` for `[data-theme="light"]`. This instructs the browser to render the native date chrome (placeholder digits, calendar icon) using the system dark/light palette, matching the surrounding UI without requiring pseudo-element hacks.
*(index.html, js/script.js, css/styles.css, CHANGELOG.md)*

---

## COMMIT #34 / α 0.34.0
Merged "Load a different file" and the filtered export row into a single bar line. `#v-reset-row` removed; `#v-reset-btn` moved inside `#v-filtered-export-row` so both sit on the same row at all times. The export label/buttons wrapped in `#v-filtered-export-content` (inner span) which shows/hides based on filter state, while the outer row remains visible whenever the viewer is loaded. `_updateFilteredExportRow` updated to toggle `v-filtered-export-content` instead of the whole row; `loadViewerData` shows the outer row directly; `resetViewer` hides it. Duplicate `UI.hide` call removed.
*(index.html, js/script.js, CHANGELOG.md)*

---

## COMMIT #33e / α 0.33.4
Moved denton below the About tab footer. `#about-sprite-wrap` swapped with `<footer>` in `index.html` so the "Tube Archiver / Built with the YouTube Data API v3" line returns to its natural position and denton sits underneath it. `min-height` reduced from 200px to 160px since the footer no longer needs to clear the wrapper.
*(index.html, css/styles.css, CHANGELOG.md)*

---

## COMMIT #33d / α 0.33.3
Denton sprite positioning simplified. All centering and offset modifiers (`top: 50%`, `translateY`) removed — they were conflicting with the scale transform and causing panel clipping across multiple attempts. Reverted to `bottom: 0; transform: scale(2); transform-origin: bottom right`, which floor-anchors the sprite inside the `min-height: 200px` wrapper (128px scaled height leaves 72px clear above, no clipping).
*(css/styles.css, CHANGELOG.md)*

---

## COMMIT #33c / α 0.33.2
Denton sprite vertical alignment rework. Previous `top: 0; bottom: 0; margin: auto 0` centering conflicted with the `scale(2)` transform, causing the sprite to sit too high. Replaced with `top: 50%; transform: translateY(calc(-50% + 36px)) scale(2)` — `-50%` re-centres on the midpoint, `+36px` applies the requested downward shift. `#about-sprite-wrap` `min-height` raised from 160px to 200px to give the scaled sprite room without clipping.
*(css/styles.css, CHANGELOG.md)*

---

## COMMIT #34 / α 0.33.0
Denton sprite clipping fix. `#about-sprite-wrap` was collapsing to zero height because denton is the only child and is absolutely positioned — `bottom: 0` therefore resolved to the top of the box, pushing denton into the panel above. Fixed by adding `min-height: 160px` to the wrapper and reanchoring denton with `top: 0; bottom: 0; margin: auto 0` (standard absolute vertical-centre) and `transform-origin: right center` so the 2× scale expands leftward from the right edge while staying vertically centred in the space.
*(css/styles.css, CHANGELOG.md)*

---

## COMMIT #33 / α 0.33.0
Denton sprite upscaled from 1.5× to 2×. Four medium-effort QoL features. (1) **Author hover tooltip** — mouseover on any `.c-author` in the feed lazily calls `getUserStats` once and caches the result in a `title` attribute ("X comments · Y replies"); subsequent hovers are instant. (2) **Author highlight** — opening any profile modal dims all non-matching threads to `opacity: 0.15` via `highlightFeedAuthor`; closing the modal (✕, outside click, or Escape) removes all `.thread--dimmed` classes via `clearFeedAuthor` now wired into `closeModal`. (3) **Date range filter** — two date inputs ("Date: → ✕ Clear") added to the sticky controls bar; filters threads by `publishedAt`; integrates with the filtered export row. (4) **Pin / bookmark** — `☆/★` button on every top-level card; clicks toggle `AppState.pinnedIds` (session-only `Set`); "★ Pinned" toggle in the filter row shows only pinned threads; pins clear on viewer reset. Fixed copy button regression from commit 32: `e.currentTarget` was captured inside the async `.then()` callback where it is always `null`; moved capture to synchronous scope. Version badge corrected from α 0.29.0 (mismatch introduced in commit 32) to α 0.33.0.
*(css/styles.css, js/ui.js, js/script.js, index.html, README.md, CHANGELOG.md)*

---

## COMMIT #32 / α 0.29.0
Four low-effort QoL features. (1) **Sticky controls bar** — `#v-controls` now uses `position: sticky; top: 52px` so search, sort, filter, and timezone stay pinned below the tab bar while scrolling the comment feed. (2) **Copy comment text** — a `.c-copy` button (`⧉`) added to every top-level and reply card header; clicks write the comment text to the clipboard and swap the icon to `✓` for 1.5 s before reverting. (3) **Escape key closes modal** — already implemented in `ui.js` via `_onModalKeydown`; confirmed and documented, no code change required. (4) **Back to top button** — `#v-back-to-top` fixed to bottom-right, hidden by default, fades in past 400 px of scroll and smooth-scrolls to top on click.
*(js/ui.js, js/script.js, css/styles.css, index.html, CLAUDE.md, CHANGELOG.md)*

---

## COMMIT #29b / α 0.29.0
Updated version badge from α 0.28.0 to α 0.29.0 to correct the mismatch introduced in commit 29.
*(index.html, README.md, CHANGELOG.md)*

---

## COMMIT #29 / α 0.28.0
Two sprite layout fixes. (1) Added `align-items: flex-end` to `#about-sprite-wrap` — default `stretch` was forcing tuan to fill the tallest sibling's height, distorting its aspect ratio and causing the horizontal-squish appearance. (2) Repositioned denton to the far-right edge of the content area via `position: absolute; right: 0; bottom: 0` on `.denton-sprite`, with `position: relative` added to `#about-sprite-wrap`. tuan remains centred; denton now sits independently at the right margin.
*(css/styles.css, CHANGELOG.md)*

---

## COMMIT #28 / α 0.28.0
Added denton sprite to the right of tuan in the About tab sprite row. Two image files: `denton.png` (dark mode) and `denton_light.png` (light mode), swapped via CSS `[data-theme="light"]` on `.denton-sprite--dark` / `.denton-sprite--light`, matching the logo theming pattern. `image-rendering: pixelated` applied. Version badge and README updated to α 0.28.0.
*(index.html, css/styles.css, assets/denton.png, assets/denton_light.png, README.md, CHANGELOG.md)*

---

## COMMIT #27 / α 0.27.0
Added `tuan.PNG` sprite to the bottom of the About tab inside `#about-sprite-wrap`. `image-rendering: pixelated` applied so the image stays crisp at any scale. Centred horizontally with `margin-top: 48px` above the footer. To replace with an animated GIF later, update the `src` attribute on `#about-sprite`. Version badge and README updated to α 0.27.0.
*(index.html, css/styles.css, assets/tuan.PNG, README.md, CHANGELOG.md)*

---

## COMMIT #26 / α 0.26.0
Moved "✕ Load a different file" button from below the comment feed to above it so it is visible without scrolling. Color changed from orange (`--accent2`) to `--border`/`--text-muted` so it blends with surrounding UI; hover fills with `--border` and text shifts to `--text`. `margin-top` replaced with `margin-bottom`. Version badge and README updated to α 0.26.0.
*(index.html, css/styles.css, README.md, CHANGELOG.md)*

---

## COMMIT #25 / α 0.25.0
Channel owner avatar fetch and cannot-render state. `getChannelThumbnail(channelId, apiKey)` added to `youtube-api.js` — calls `channels?part=snippet` (1 unit) and returns the medium or default thumbnail URL. Meta-bar click handler made async: if the owner has no comments and no avatarUrl was found, attempts to fetch via `getChannelThumbnail` using the stored API key. If no key is available (e.g. JSON-only session) or the fetch fails, `cannotRender = true` is passed to `renderUserModal`. `renderUserModal` accepts a second `cannotRender` param (default false): renders a `modal-avatar--cannot-render` div with "CAN'T RENDER" text and a `modal-avatar-note` explaining that an API key is required to load channel thumbnails from a saved archive. Version badge and README updated to α 0.25.0.
*(js/youtube-api.js, js/script.js, js/ui.js, css/styles.css, index.html, README.md, CHANGELOG.md)*

---

## COMMIT #24 / α 0.24.0
Removed `AppState.videoChannelId` from the `.c-author` feed click's `getUserStats` call. Passing it caused `channelMatch` to fire on all uploader threads regardless of which author was clicked, contaminating every user's avatar and stats with the uploader's data. The feed click uses the stored `author` display name which is always an exact match; the channelId fallback is only needed on the meta-bar click. Version badge and README updated to α 0.24.0.
*(js/script.js, index.html, README.md, CHANGELOG.md)*

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
