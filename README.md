# TubeArchiver

**α 0.33.3** — A self-contained, client-side web app for fetching, browsing, and exporting YouTube comments.
No server. No backend. No cloud storage. Everything runs in your browser and stays on your machine.

---

## Features

- **Archiver** — fetch every public comment and reply from any YouTube video using your own API key. Streams results into a live preview as it runs.
- **Viewer** — browse, search, sort, and filter the fetched archive. Handles 300,000+ comments without browser stutter via infinite-scroll batch rendering.
- **Author profiles** — click any commenter's name in the Viewer to see their full activity within the loaded archive: comment count, reply count, total likes, and a chronological history with profile picture.
- **Exports** — save the archive as JSON (nested, re-importable), CSV (flat with all fields including avatar URLs), or TXT (plain-text summary).
- **Re-import** — drop a previously exported `.json` file back into the Viewer at any time without re-fetching.
- **Timezone support** — all timestamps displayed in whichever timezone you choose, switchable without reloading.
- **Dark / light theme** — persists across sessions.

---

## Getting a YouTube Data API v3 key

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Create a new project (or use an existing one)
3. Click **Enable APIs & Services** → search for **YouTube Data API v3** → Enable
4. Go to **Credentials** → **Create Credentials** → **API Key**
5. Copy the key (it starts with `AIza`) and paste it into the Archiver tab

Your key is saved in `localStorage` so you only need to enter it once. It is never sent anywhere except directly to Google's API servers.

**Free quota:** 10,000 units per day, resetting at midnight Pacific Time.
Each page of 100 top-level comments costs 1 unit. Reply-heavy threads cost an additional unit per overflow page.

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
2. Paste any YouTube URL or video ID (all formats supported: `watch?v=`, `youtu.be/`, `shorts/`, `embed/`)
3. Choose whether to include replies and sort order
4. Click **Fetch** — comments stream into the live preview in real time
5. Click **→ Open in Viewer** to browse immediately with no download, or use the export buttons for a file

### Viewer tab
- Populated automatically from the Archiver, or by dropping a `.json` export onto the drop zone
- **Sort:** Newest / Oldest / Most Liked
- **Search:** Live keyword filtering with highlighted matches; reply threads auto-expand when a reply matches, with non-matching replies dimmed for context
- **Timezone:** All timestamps convert to whichever timezone you select
- **Filters:** Toggle top-level comments and replies independently
- **Author profiles:** Click any commenter's name to open a profile panel showing their full activity in the archive, including their profile picture
- **Channel author:** Click the channel name in the video info bar to view the video author's comments

---

## File structure

```
yt-comment-suite/
├── index.html              Layout only — tabs, inputs, buttons, HTML structure
├── assets/
│   └── logo.svg            TubeArchiver brand mark
├── css/
│   └── styles.css          All visual design: colours, spacing, typography,
│                           dark/light themes, mobile breakpoints, modal styles
└── js/
    ├── youtube-api.js      YouTube Data API v3 only — requests and response parsing
    ├── archive-manager.js  Data only — import/export, sort, filter, getUserStats
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
| Browser yield during fetch | Yields to the event loop every 10 threads to keep the UI responsive |
| Live preview cap | Archiver preview limited to 100 items; full archive always available in Viewer |
| Debounced filter | Search input debounced 80ms to prevent keystroke thrashing on large archives |

Tested with archives up to 140,000 comments. Fetch time scales with reply count — approximately 8–9 minutes for a 140k archive. The Viewer remains fully interactive throughout.

---

## Notes on large archives

- The **Stop** button halts after the current API page finishes — you can still export or open in the Viewer with whatever was captured up to that point
- JSON exports are nested (replies nested under their parent thread); CSV exports are flat with a `parentId` column; both include `authorAvatar` URLs
- Avatar URLs are captured at fetch time from Google's CDN and stored in the JSON. They may expire if a user later changes their profile picture — a grey placeholder is shown if a URL fails to load
- Archives exported before avatar support was added will display placeholders for all profile pictures

---

## Future: serverless proxy / shared API key

Per-user API keys are the current model — simple, free, and quota stays in your own Google Cloud project. If you ever want to remove that requirement:

- Host a serverless function (Cloudflare Worker, Vercel Edge, AWS Lambda)
- Store the key as a server-side environment variable — never in client code
- The browser calls your function; your function calls YouTube and returns the data
- The key is never exposed to the client

At personal or small-group scale, per-user keys are strongly preferred. A shared key means shared quota, and at scale, YouTube API costs add up quickly.

---

## Browser support

All modern browsers (Chrome, Firefox, Safari, Edge). Requires `fetch`, `Intl.DateTimeFormat`, `IntersectionObserver`, and `localStorage` — all standard since 2018.

---

## Contributing / development

Architecture decisions, design rules, and the full task backlog are documented in [`CLAUDE.md`](CLAUDE.md).
A full version history is in [`CHANGELOG.md`](CHANGELOG.md).
