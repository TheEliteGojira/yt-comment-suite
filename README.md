# TubeArchiver

**β 1.3.4** — A self-contained, client-side web app for fetching, browsing, and exporting YouTube comments.
No server. No backend. No cloud storage. Everything runs in your browser and stays on your machine.

---

## Features

### Archiver
- **Full comment fetch** — paginates through every public comment thread and reply for any YouTube video using your own API key
- **Live preview** — comments stream into a preview pane as they are fetched (capped at 100; full archive always available in the Viewer)
- **Quota estimate** — click Estimate before fetching to see the projected unit cost from just the video metadata (1 unit)
- **Sort order** — fetch newest-first (chronological) or top comments (YouTube relevance ranking)
- **Include replies toggle** — disable reply fetching to reduce quota usage on reply-heavy videos
- **Stop** — halt after the current API page; export or open in the Viewer with whatever was captured. There is no mid-session resume — to complete an interrupted archive, re-fetch the video and merge the two exports in the Viewer
- **Export** — save as JSON (nested, re-importable), CSV (flat, spreadsheet-compatible), or TXT (plain text)
- **Open in Viewer** — pass the archive directly to the Viewer in memory with no file download

### Viewer
- **Load from anywhere** — drop a `.json` archive onto the drop zone, open directly from the Archiver, or merge in a second archive without leaving the Viewer
- **Multi-archive merge** — click ⊕ Merge archive to combine a second archive alongside the first:
  - *Fetch from YouTube* — enter a URL or video ID to fetch and merge comments directly (uses your saved API key; includes an Estimate option)
  - *Load from disk* — import a previously exported `.json` file
  - Threads are deduplicated by comment ID; each merged source appears as a removable chip in the source bar
  - The title bar shows a *+N archives* count while sources are active
- **Search** — live keyword filtering with highlighted matches; non-matching replies are dimmed for context; operates on plain text, never on HTML
- **Sort** — newest first, oldest first, or most liked; replies always stay chronological under their parent
- **Filter toggles** — show/hide top-level comments and replies independently; combine with search
- **Date range** — narrow the feed to comments posted between two dates
- **Pin / bookmark** — pin any top-level comment with ☆; use the ★ Pinned filter to view only pinned items (session-only)
- **Word frequency** — collapsible panel showing the top 30 most-used words across all loaded comments, ranked with proportional bars; computed once on first open and cached
- **Export filtered results** — export the current view (all or filtered) as JSON, CSV, or TXT; merged archives export as a single unified file
- **Permalinks** — every comment and reply links directly to that comment on YouTube
- **Copy** — copies plain text of any comment or reply to the clipboard with a ✓ confirmation
- **Timezone** — all timestamps stored as UTC; switch display timezone freely without reloading
- **Author profiles** — click any commenter's name to open a profile panel showing their full activity in the loaded archive (comment count, reply count, total likes, full history, profile picture, channel link)
- **Channel author** — click the channel name in the meta bar to see the video uploader's comments
- **Video meta bar** — thumbnail, linked title, view/like counts, upload date, export date, and a collapsible description panel; all persisted in the JSON
- **Sticky controls** — search, sort, filter, and timezone stay pinned at the top while scrolling
- **Back to top** — button appears after scrolling 400px; smooth-scrolls to the top
- **Dark / light theme** — toggle in the tab bar; persists across sessions

### Discovery
*Requires an archive loaded in the Viewer. The tab button is disabled until one is.*

- **Shared audience** — instantly finds commenters who appear across two or more merged archives (0 units); shows avatar, name, source overlap count, and a link to open their profile
- **What this audience watches** — fetches channel info and recent uploads for the top 10 commenters by comment count (~11 units total via one batched channel lookup + individual playlist calls); results cached for the session
- **Search YouTube** — three modes, all using the YouTube Search API (100 units per query):
  - *By comment terms* — pre-populated from the top 8 most-frequent words in the archive; add/remove chips freely
  - *By video tags* — uses the uploader-set tags from the loaded video; chips are independently editable
  - *By channel uploads* — re-displays the Panel 2 upload results at zero extra cost (served from cache)
- **Related by tags** — searches YouTube using the video's own tags as a query (100 units); chips editable independently from Panel 3
- **Quota overview** — a cost table at the top of the tab shows the unit cost and live status for each panel

---

## Getting a YouTube Data API v3 key

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Create a new project (or use an existing one)
3. Click **Enable APIs & Services** → search for **YouTube Data API v3** → Enable
4. Go to **Credentials** → **Create Credentials** → **API Key**
5. Copy the key (it starts with `AIza`) and paste it into the Archiver tab

Your key is saved in `localStorage` — you only need to enter it once. It is never sent anywhere except directly to Google's API servers. The same key is used automatically when merging archives by URL in the Viewer.

**Free quota:** 10,000 units per day, resetting at midnight Pacific Time.
Each page of 100 top-level comments costs 1 unit. Threads with more than 5 replies each cost an additional unit for the overflow reply page. Use the **Estimate** button before fetching to see a projection.

---

## Running locally

The app must be served over HTTP — opening `index.html` as a `file://` URL will cause CORS errors from the YouTube API.

**Python (no install needed on most systems):**
```bash
cd yt-comment-suite
python3 -m http.server 8080
# Open: http://localhost:8080
```

**Node.js:**
```bash
npx serve yt-comment-suite
```

**VS Code:** Install the **Live Server** extension, right-click `index.html` → **Open with Live Server**.

---

## Deploying

**Netlify Drop — 30 seconds, no account needed:**
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag the `yt-comment-suite/` folder onto the page
3. Get a live URL instantly

**GitHub Pages:**
1. Push the repository to GitHub
2. Go to **Settings → Pages** → Source: `main` branch, `/root`
3. Live at `https://yourusername.github.io/repo-name/`

---

## Usage

### Archiver tab
1. Paste your API key — saved automatically for next time
2. Paste any YouTube URL or video ID (`watch?v=`, `youtu.be/`, `shorts/`, `embed/` all supported)
3. Click **Estimate** to preview the quota cost (optional, costs 1 unit)
4. Choose sort order and whether to include replies
5. Click **Fetch** — comments stream into the live preview in real time
6. When done, click **→ Open in Viewer** to browse immediately, or use the export buttons for a file

### Viewer tab
- **Loading:** drag and drop a `.json` onto the drop zone, or use the Archiver's "Open in Viewer" button
- **Merging:** with an archive already loaded, click **⊕ Merge archive** → choose Fetch from YouTube (enter a URL) or Load from disk; merged sources appear as chips and can be removed individually
- **Browsing:** use Sort, Show, Date, and Search controls to narrow the feed; the controls bar stays visible while scrolling
- **Word frequency:** click the Word Frequency panel above the controls to see the top 30 terms
- **Author deep-dive:** click any commenter's name for their full activity profile; hover for a quick summary
- **Exporting:** use the export row at the bottom of the controls (always visible once loaded); exports reflect current filters

### Discovery tab
1. Load an archive in the Viewer — the **④ Discovery** tab button activates automatically
2. **Panel 1 (Shared Audience)** runs instantly when you open the tab — no button press needed; requires two or more merged archives to show results
3. **Panel 2 (What This Audience Watches)** — click **Fetch audience data** to make ~11 units of API calls; results persist for the session
4. **Panel 3 (Search YouTube)** — pick a mode (Terms / Tags / Uploads), adjust the chips, then click **Search** (100 units); Uploads mode is free (served from Panel 2 cache)
5. **Panel 4 (Related by Tags)** — adjust the tag chips if needed, then click **Search by tags** (100 units)

---

## File structure

```
yt-comment-suite/
├── index.html              Layout only — tabs, inputs, buttons, HTML structure
├── assets/
│   ├── logo.svg            Dark-mode logo
│   ├── logo-light.svg      Light-mode logo
│   └── fire/ porta/ denton — About tab sprites
├── css/
│   └── styles.css          All visual design: colours, spacing, typography,
│                           dark/light themes, mobile breakpoints, modal styles
└── js/
    ├── youtube-api.js      YouTube Data API v3 only — requests and response parsing
    ├── archive-manager.js  Data only — import/export, sort, filter, merge, getUserStats
    ├── ui.js               Presentation only — DOM helpers, rendering, modal, theme
    └── script.js           Orchestration — app init, event listeners, fetch loop,
                            viewer batch rendering, AppState management
```

---

## Performance

Large archives are handled without locking the browser:

| Technique | Detail |
|---|---|
| Infinite-scroll batch rendering | Viewer renders 100 threads at a time via `IntersectionObserver`; remaining batches load on scroll |
| O(n) reply lookup | `buildNestedExport` uses a `Map<parentId, replies[]>` — no nested loops |
| Browser yield during fetch | Yields to the event loop every 10 threads during both archiver and merge-URL fetches |
| Live preview cap | Archiver preview limited to 100 items; full archive always available in Viewer |
| Debounced filter | Search input debounced 80ms to prevent keystroke thrashing on large archives |
| Word frequency cache | Computed once on first open per loaded archive; invalidated on merge or reset |

Tested with archives up to 140,000 comments. Fetch time scales with reply count — approximately 8–9 minutes for a 140k archive on a standard quota. The Viewer remains fully interactive throughout.

---

## Notes on large archives

- The **Stop** button halts after the current API page finishes — export or open in the Viewer with whatever was captured. There is no mid-session resume yet (see [Planned](#planned)); to complete an interrupted archive in the meantime, re-fetch the same video and merge the two exports in the Viewer (duplicates are removed automatically by comment ID)
- JSON exports are nested (replies under their parent thread); CSV exports are flat with a `parentId` column; both include `authorAvatar` URLs
- When multiple archives are merged, export produces a single deduplicated file — `_source` tracking tags are stripped before any export
- Avatar URLs are captured at fetch time from Google's CDN. They may expire if a user changes their profile picture — a grey placeholder is shown on failure. Re-fetching the video captures the current picture
- Archives exported before avatar support (pre-0.20) will show placeholders for all profile pictures

---

## Browser support

All modern browsers (Chrome, Firefox, Safari, Edge). Requires `fetch`, `Intl.DateTimeFormat`, `IntersectionObserver`, `FileReader`, and `localStorage` — all standard since 2018.

---

## Planned

- **Fetch resume** — YouTube's `nextPageToken` is not session-bound, meaning it survives browser restarts and quota resets. A future update will save the token to `localStorage` when a fetch is stopped or hits the quota limit. On the next session, entering the same video ID will offer a **Resume from page N** option — the resumed fetch picks up exactly where it left off and produces a second archive that can be merged with the first in the Viewer. This makes large videos (millions of comments, spanning multiple quota days) practical to archive in chunks.

---

## Architecture & development

Architecture decisions, design rules, and the full task history are documented in [`CLAUDE.md`](CLAUDE.md).
A complete version history is in [`CHANGELOG.md`](CHANGELOG.md).
