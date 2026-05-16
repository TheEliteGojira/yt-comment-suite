# YT Comment Suite

A self-contained, client-side web app for fetching, browsing, and exporting YouTube comments.
No server required. No cloud storage. Your data stays on your machine.

---

## File structure

```
yt-comment-suite/
├── index.html            # Layout only — tabs, inputs, buttons
├── css/
│   └── styles.css        # All visual design, colours, mobile layout
└── js/
    ├── youtube-api.js    # YouTube Data API v3 requests and response parsing
    ├── archive-manager.js# Import/export JSON/CSV/TXT, sort and filter logic
    ├── ui.js             # DOM helpers, rendering, theme, timezone dropdown
    └── script.js         # App init, event listeners, tab switching, orchestration
```

---

## Getting a YouTube Data API v3 key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use an existing one)
3. Click **Enable APIs & Services** → search for **YouTube Data API v3** → Enable
4. Go to **Credentials** → **Create Credentials** → **API Key**
5. Copy the key — it starts with `AIza`

**Optional (recommended for shared deployments):** Restrict the key to HTTP referrers
matching your domain so it can't be used from other sites.

**Free quota:** 10,000 units per day. Each page of 100 top-level comments costs 1 unit.
Full reply fetches cost an additional unit per page of replies.
Quota resets at midnight Pacific Time.

Your API key is saved in your browser's `localStorage` so you only need to enter it once.

---

## Running locally

Because the app makes requests to the YouTube API, it needs to be served over HTTP —
opening `index.html` directly as a `file://` URL will cause CORS errors.

### Option 1 — Python (no install needed on macOS/Linux)
```bash
cd yt-comment-suite
python3 -m http.server 8080
# Then open: http://localhost:8080
```

### Option 2 — Node.js
```bash
npx serve yt-comment-suite
# Opens automatically, or visit the URL shown
```

### Option 3 — VS Code Live Server
Install the **Live Server** extension, right-click `index.html` → **Open with Live Server**.

---

## Deploying to a shareable URL (free, no account needed)

### Netlify Drop — fastest (30 seconds)
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag the entire `yt-comment-suite/` folder onto the page
3. Netlify gives you a live URL like `https://random-name.netlify.app`

### GitHub Pages
1. Push the `yt-comment-suite/` folder to a GitHub repository
2. Go to **Settings → Pages** → Source: `main` branch, `/root` folder
3. Your URL will be `https://yourusername.github.io/repo-name/`

---

## Usage

### Archiver tab
1. Paste your API key (saved automatically for next time)
2. Paste any YouTube URL or video ID
3. Choose options (include replies, sort order)
4. Click **Fetch** — comments stream in live
5. When done, click **→ Open in Viewer** to browse immediately (no download needed)
   — or use the export buttons to save a JSON/CSV/TXT file

### Viewer tab
- Loads automatically when you click "Open in Viewer" from the Archiver
- Or drag and drop a previously saved `.json` file onto the drop zone
- **Sort:** Newest / Oldest / Most Liked
- **Search:** Live keyword filter with highlighted matches; reply threads auto-expand when a reply matches
- **Timezone:** All timestamps shown in your chosen timezone
- **Filters:** Toggle comments/replies visibility independently

---

## Notes on large archives

- Videos with 100k+ comments take several minutes to fetch — the Stop button halts after the current page and still lets you export what was captured
- The viewer renders all comments in memory; very large archives (500k+ comments) may cause slowness on older devices
- JSON exports are nested (replies under their parent comment); CSV exports are flat with a `parentId` column

---

## Future: built-in API keys

If you ever want to remove the need for users to supply their own key, the approach would be:
- Host a lightweight serverless function (e.g. Cloudflare Worker, Vercel Edge Function, or AWS Lambda)
- Store the API key as a server-side environment variable — never in client code
- The function acts as a proxy: the browser calls your function, your function calls YouTube, returns the data
- This hides the key from users while letting them fetch without their own quota
- Downside: you pay for quota — at scale, YouTube's API costs can add up

For a personal or small-group tool, per-user keys are simpler and free.

---

## Browser support

Works in all modern browsers (Chrome, Firefox, Safari, Edge).
Requires: `fetch`, `Intl.DateTimeFormat`, `localStorage` — all standard since 2018.
