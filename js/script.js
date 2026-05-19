/* =============================================================
   script.js — App init, event listeners, tab switching,
               archiver orchestration, viewer orchestration.

   Depends on: YouTubeAPI, ArchiveManager, UI  (loaded before this)
   ============================================================= */

/* ─────────────────────────────────────────────────────────────
   SHARED STATE
   In-memory archive passed from Archiver → Viewer without disk.
   ───────────────────────────────────────────────────────────── */
const AppState = {
  /* Flat array of all fetched comment objects (archiver) */
  allComments:   [],

  /* Nested threads array for the viewer */
  threads:       [],

  /* Video metadata */
  videoTitle:        '',
  videoId:           '',
  videoPublishedAt:  '',
  videoChannelTitle: '',
  videoChannelId:    '',
  videoThumbnailUrl: '',
  videoViewCount:    0,
  videoLikeCount:    0,
  videoDescription:  '',

  /* Fetch control */
  isFetching:    false,
  stopRequested: false,

  /* Viewer UI state */
  currentSort:    'newest',
  showComments:   true,
  showReplies:    true,
  showPinnedOnly: false,

  /* Session-only set of pinned comment IDs */
  pinnedIds: new Set(),

  /* Number of items currently shown in the archiver live preview */
  previewCount:  0,

  /* Merged archive sources — array of { label, count } for the source list */
  sources: [],
};

/* ─────────────────────────────────────────────────────────────
   HELPERS — video ID extraction
   ───────────────────────────────────────────────────────────── */
function extractVideoId(input) {
  input = input.trim();

  /* Plain 11-character ID */
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;

  /* All common YouTube URL formats (desktop, mobile, short, embed, shorts) */
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /embed\/([a-zA-Z0-9_-]{11})/,
    /shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const p of patterns) {
    const m = input.match(p);
    if (m) return m[1];
  }

  return null;
}

/* ─────────────────────────────────────────────────────────────
   API KEY — persisted in localStorage
   ───────────────────────────────────────────────────────────── */
const API_KEY_STORAGE = 'yt-suite-api-key';

function loadSavedApiKey() {
  const saved = localStorage.getItem(API_KEY_STORAGE);
  if (saved) {
    const input = document.getElementById('a-api-key');
    if (input) input.value = saved;
  }
}

function saveApiKey(key) {
  if (key) localStorage.setItem(API_KEY_STORAGE, key);
}

/* ─────────────────────────────────────────────────────────────
   TAB SWITCHER
   ───────────────────────────────────────────────────────────── */
function switchTab(name, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b  => b.classList.remove('active'));

  document.getElementById('tab-' + name).classList.add('active');
  btn.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  /* Dismiss any open author modal when navigating away */
  UI.closeModal();
}

/* ─────────────────────────────────────────────────────────────
   ARCHIVER — quota estimate (1 unit, no side effects on AppState)
   ───────────────────────────────────────────────────────────── */
async function estimateCost() {
  if (AppState.isFetching) return;

  const apiKey     = document.getElementById('a-api-key').value.trim();
  const videoInput = document.getElementById('a-video-url').value.trim();

  UI.hideError('a-error-box');

  if (!apiKey) {
    UI.showError('a-error-box', 'Please enter your YouTube Data API v3 key.');
    return;
  }
  if (!videoInput) {
    UI.showError('a-error-box', 'Please enter a YouTube URL or video ID.');
    return;
  }

  const videoId = extractVideoId(videoInput);
  if (!videoId) {
    UI.showError('a-error-box', 'Could not find a valid YouTube video ID in that URL. Supported formats: youtube.com/watch?v=..., youtu.be/..., shorts/...');
    return;
  }

  const btn = document.getElementById('a-estimate-btn');
  btn.disabled    = true;
  btn.textContent = 'Estimating…';
  UI.hide('a-quota-estimate');
  UI.setText('a-quota-estimate', '');

  try {
    const info = await YouTubeAPI.getVideoInfo(videoId, apiKey);
    if (info.commentCount > 0) {
      const minUnits = Math.ceil(info.commentCount / 100);
      UI.setText('a-quota-estimate',
        `"${info.title}" — ~${minUnits.toLocaleString()} unit${minUnits === 1 ? '' : 's'} estimated ` +
        `(${info.commentCount.toLocaleString()} comments · replies will add more)`
      );
    } else {
      UI.setText('a-quota-estimate', `"${info.title}" — Comments are disabled on this video.`);
    }
    UI.show('a-quota-estimate');
  } catch (e) {
    UI.showError('a-error-box', `Could not fetch estimate: ${e.message}`);
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Estimate';
  }
}

/* ─────────────────────────────────────────────────────────────
   ARCHIVER — fetch orchestration
   ───────────────────────────────────────────────────────────── */
async function startFetch() {
  if (AppState.isFetching) return;

  /* Read inputs */
  const apiKey      = document.getElementById('a-api-key').value.trim();
  const videoInput  = document.getElementById('a-video-url').value.trim();
  const inclReplies = document.getElementById('a-opt-replies').checked;
  const sortByTop   = document.getElementById('a-opt-sort').checked;

  /* Validate */
  UI.hideError('a-error-box');

  if (!apiKey) {
    UI.showError('a-error-box', 'Please enter your YouTube Data API v3 key.');
    return;
  }

  if (!videoInput) {
    UI.showError('a-error-box', 'Please enter a YouTube URL or video ID.');
    return;
  }

  const videoId = extractVideoId(videoInput);
  if (!videoId) {
    UI.showError('a-error-box', 'Could not find a valid YouTube video ID in that URL. Supported formats: youtube.com/watch?v=..., youtu.be/..., shorts/...');
    return;
  }

  /* Persist API key */
  saveApiKey(apiKey);

  /* Reset state */
  AppState.allComments   = [];
  AppState.previewCount  = 0;
  AppState.stopRequested     = false;
  AppState.isFetching        = true;
  AppState.videoTitle        = '';
  AppState.videoPublishedAt  = '';
  AppState.videoChannelTitle = '';
  AppState.videoChannelId    = '';
  AppState.videoThumbnailUrl = '';
  AppState.videoViewCount    = 0;
  AppState.videoLikeCount    = 0;
  AppState.videoDescription  = '';
  AppState.videoId           = videoId;

  /* UI: show progress, hide previous results */
  document.getElementById('a-fetch-btn').disabled    = true;
  document.getElementById('a-estimate-btn').disabled = true;
  document.getElementById('a-comment-list').innerHTML = '';
  UI.hide('a-results-section');
  UI.hide('a-open-viewer-btn');
  UI.show('a-progress-section');
  UI.show('a-stop-wrap');
  UI.setProgress('a-progress-bar', 0);
  document.getElementById('a-progress-label').textContent = 'Fetching comments…';
  document.getElementById('a-progress-label').classList.add('pulsing');

  /* Step 1: get video metadata (title, channel, comment count) */
  try {
    const info                 = await YouTubeAPI.getVideoInfo(videoId, apiKey);
    AppState.videoTitle        = info.title;
    AppState.videoPublishedAt  = info.publishedAt;
    AppState.videoChannelTitle = info.channelTitle;
    AppState.videoChannelId    = info.channelId;
    AppState.videoThumbnailUrl = info.thumbnailUrl;
    AppState.videoViewCount    = info.viewCount;
    AppState.videoLikeCount    = info.likeCount;
    AppState.videoDescription  = info.description;
    /* Show video info bar (thumbnail + linked title) in the progress section */
    const thumbHtml = info.thumbnailUrl
      ? `<img id="a-video-thumb" src="${UI.esc(info.thumbnailUrl)}" alt="">`
      : '';
    const videoUrl  = `https://www.youtube.com/watch?v=${UI.esc(videoId)}`;
    document.getElementById('a-video-info-bar').innerHTML =
      `${thumbHtml}<a class="a-video-title-link" href="${videoUrl}" target="_blank" rel="noopener noreferrer">${UI.esc(info.title)}</a>`;
    UI.show('a-video-info-bar', 'flex');
    UI.setText('a-status-line', info.channelTitle ? `Channel: ${info.channelTitle}` : '');

    /* Show a quota estimate so the user knows what they're committing to.
     * Each page of 100 top-level comments = 1 unit; replies add more but are
     * unknowable upfront. commentCount is 0 when comments are disabled. */
    if (info.commentCount > 0) {
      const minUnits = Math.ceil(info.commentCount / 100);
      UI.setText('a-quota-estimate',
        `~${minUnits.toLocaleString()} unit${minUnits === 1 ? '' : 's'} estimated ` +
        `(${info.commentCount.toLocaleString()} comments · replies will add more)`
      );
      UI.show('a-quota-estimate');
    }
  } catch (e) {
    AppState.videoTitle        = videoId;
    AppState.videoPublishedAt  = '';
    AppState.videoChannelTitle = '';
    UI.setText('a-status-line', `⚠ Could not fetch video title: ${e.message}`);
  }

  /* Helper: append to the live preview, capped at 100 items */
  function previewAppend(comment) {
    if (AppState.previewCount >= 100) return;
    UI.appendToPreview('a-comment-list', comment);
    AppState.previewCount++;
    if (AppState.previewCount === 100) {
      const note = document.createElement('div');
      note.className   = 'preview-limit-note';
      note.textContent = 'Preview capped at 100 — full archive available in Viewer.';
      document.getElementById('a-comment-list').appendChild(note);
    }
  }

  /* Step 2: paginate through comment threads */
  const order = sortByTop ? 'relevance' : 'time';
  let pageToken = '';
  let page      = 0;

  try {
    do {
      if (AppState.stopRequested) break;

      const data = await YouTubeAPI.getCommentThreadPage(videoId, apiKey, order, pageToken);

      let threadNum = 0;

      for (const thread of (data.items || [])) {
        if (AppState.stopRequested) break;

        /* Parse top-level comment */
        const topComment = YouTubeAPI.parseThread(thread);
        AppState.allComments.push(topComment);
        previewAppend(topComment);

        /* Handle replies */
        if (inclReplies) {
          if (topComment._totalReplies <= 5 && topComment._inlineReplies.length > 0) {
            const inlineReplies = YouTubeAPI.parseInlineReplies(topComment._inlineReplies, topComment.id);
            inlineReplies.forEach(r => {
              AppState.allComments.push(r);
              previewAppend(r);
            });

          } else if (topComment._totalReplies > 5) {
            await YouTubeAPI.getAllReplies(
              topComment.id,
              apiKey,
              (reply) => {
                AppState.allComments.push(reply);
                previewAppend(reply);
              },
              () => AppState.stopRequested
            );
          }
        }

        /* Yield to the browser every 10 threads to keep the UI responsive */
        threadNum++;
        if (threadNum % 10 === 0) {
          await new Promise(r => setTimeout(r, 0));
        }
      }

      page++;
      const count = AppState.allComments.length;
      UI.setText('a-prog-count', `${count.toLocaleString()} comments`);
      UI.setText('a-prog-pages', `page ${page}`);
      UI.setProgress('a-progress-bar', Math.min(95, (page / (page + 2)) * 100));

      pageToken = data.nextPageToken || '';

    } while (pageToken && !AppState.stopRequested);

    finishFetch(AppState.stopRequested ? 'stopped' : 'complete');

  } catch (e) {
    UI.showError('a-error-box', e.message);
    finishFetch('error');
  }
}

function finishFetch(reason) {
  AppState.isFetching    = false;
  AppState.stopRequested = false;

  /* Stop the buffering dots and hide the stop button */
  UI.hide('a-dot-loader');
  UI.hide('a-stop-wrap');

  document.getElementById('a-fetch-btn').disabled    = false;
  document.getElementById('a-estimate-btn').disabled = false;
  document.getElementById('a-progress-label').classList.remove('pulsing');

  if (reason === 'complete') {
    UI.setProgress('a-progress-bar', 100);
    document.getElementById('a-progress-label').textContent = '✓ Done!';
  } else if (reason === 'stopped') {
    document.getElementById('a-progress-label').textContent = '⏹ Stopped by user';
  } else {
    document.getElementById('a-progress-label').textContent = '✕ Error';
  }

  if (reason !== 'error' && AppState.allComments.length > 0) {
    const threads = AppState.allComments.filter(c => c.type === 'comment').length;
    const replies = AppState.allComments.filter(c => c.type === 'reply').length;

    UI.setText('a-stat-total',   UI.fmt(AppState.allComments.length));
    UI.setText('a-stat-threads', UI.fmt(threads));
    UI.setText('a-stat-replies', UI.fmt(replies));

    UI.show('a-results-section');
    UI.show('a-open-viewer-btn');
  }
}

function stopFetch() {
  AppState.stopRequested = true;
  UI.setText('a-status-line', 'Stopping after current page…');
}

/* Triggered by the "→ Open in Viewer" button */
function openInViewer() {
  const viewerBtn = document.querySelector('.tab-btn[onclick*="viewer"]');
  switchTab('viewer', viewerBtn);

  /* Show loading dots while the nested export is built (can be slow for large sets) */
  UI.hide('v-drop-zone');
  UI.show('v-loading');

  setTimeout(() => {
    const videoMeta   = {
      videoId:           AppState.videoId,
      videoTitle:        AppState.videoTitle,
      videoPublishedAt:  AppState.videoPublishedAt,
      videoChannelTitle: AppState.videoChannelTitle,
      videoChannelId:    AppState.videoChannelId,
      videoThumbnailUrl: AppState.videoThumbnailUrl,
      videoViewCount:    AppState.videoViewCount,
      videoLikeCount:    AppState.videoLikeCount,
      videoDescription:  AppState.videoDescription,
    };
    const exportData  = ArchiveManager.buildNestedExport(AppState.allComments, videoMeta);
    const { threads } = ArchiveManager.parseImport(exportData);
    AppState.threads  = threads;
    loadViewerData(exportData, threads);
  }, 0);
}

function resetArchiver() {
  AppState.allComments  = [];
  AppState.previewCount = 0;
  AppState.videoTitle        = '';
  AppState.videoId           = '';
  AppState.videoPublishedAt  = '';
  AppState.videoChannelTitle = '';
  AppState.videoChannelId    = '';
  AppState.videoThumbnailUrl = '';
  AppState.videoViewCount    = 0;
  AppState.videoLikeCount    = 0;
  AppState.videoDescription  = '';

  document.getElementById('a-comment-list').innerHTML    = '';
  document.getElementById('a-video-url').value           = '';
  document.getElementById('a-video-info-bar').innerHTML  = '';
  UI.hide('a-video-info-bar');
  UI.hide('a-results-section');
  UI.hide('a-progress-section');
  UI.hide('a-open-viewer-btn');
  UI.hide('a-quota-estimate');
  UI.setText('a-quota-estimate', '');
  UI.hideError('a-error-box');

  /* Also clear any archive loaded in the Viewer */
  resetViewer();
}

/* ─────────────────────────────────────────────────────────────
   ARCHIVER — exports (delegates to ArchiveManager)
   ───────────────────────────────────────────────────────────── */
function exportJSON() {
  ArchiveManager.exportJSON(AppState.allComments, {
    videoId:           AppState.videoId,
    videoTitle:        AppState.videoTitle,
    videoPublishedAt:  AppState.videoPublishedAt,
    videoChannelTitle: AppState.videoChannelTitle,
    videoChannelId:    AppState.videoChannelId,
    videoThumbnailUrl: AppState.videoThumbnailUrl,
    videoViewCount:    AppState.videoViewCount,
    videoLikeCount:    AppState.videoLikeCount,
    videoDescription:  AppState.videoDescription,
  });
}
function exportCSV()  { ArchiveManager.exportCSV(AppState.allComments,  AppState.videoTitle); }
function exportTXT()  { ArchiveManager.exportTXT(AppState.allComments,  AppState.videoTitle); }

function exportFiltered(format) {
  const meta = {
    videoId:           AppState.videoId,
    videoTitle:        AppState.videoTitle,
    videoPublishedAt:  AppState.videoPublishedAt,
    videoChannelTitle: AppState.videoChannelTitle,
    videoChannelId:    AppState.videoChannelId,
    videoThumbnailUrl: AppState.videoThumbnailUrl,
    videoViewCount:    AppState.videoViewCount,
    videoLikeCount:    AppState.videoLikeCount,
    videoDescription:  AppState.videoDescription,
  };
  if (format === 'json') ArchiveManager.exportFilteredJSON(_renderedThreads, meta);
  if (format === 'csv')  ArchiveManager.exportCSV(ArchiveManager.flattenThreads(_renderedThreads), AppState.videoTitle);
  if (format === 'txt')  ArchiveManager.exportTXT(ArchiveManager.flattenThreads(_renderedThreads), AppState.videoTitle);
}

/* ─────────────────────────────────────────────────────────────
   VIEWER — file loading (manual JSON upload path)
   ───────────────────────────────────────────────────────────── */
function initDropZone() {
  const zone  = document.getElementById('v-drop-zone');
  const input = document.getElementById('v-file-input');

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', ()  => zone.classList.remove('drag-over'));

  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) readJsonFile(file);
  });

  input.addEventListener('change', () => {
    if (input.files[0]) readJsonFile(input.files[0]);
  });
}

function readJsonFile(file) {
  const reader = new FileReader();

  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);

      /* Show loading dots before the parse + render (can be slow for large files) */
      UI.hide('v-drop-zone');
      UI.show('v-loading');

      setTimeout(() => {
        try {
          const { threads } = ArchiveManager.parseImport(data);
          AppState.threads  = threads;
          loadViewerData(data, threads);
        } catch (err) {
          UI.hide('v-loading');
          UI.show('v-drop-zone');
          alert(`Could not load file: ${err.message}`);
        }
      }, 0);

    } catch (err) {
      alert(`Could not load file: ${err.message}`);
    }
  };

  reader.readAsText(file);
}

/* ── Word frequency toggle ────────────────────────────────── */
function toggleWordFreq() {
  const content = document.getElementById('v-word-freq-content');
  const arrow   = document.getElementById('v-word-freq-arrow');
  const isOpen  = content.style.display !== 'none';

  if (isOpen) {
    UI.hide('v-word-freq-content');
    arrow.classList.remove('open');
  } else {
    /* Compute on first open; reuse cache on subsequent opens */
    if (!_wordFreqCache) {
      _wordFreqCache = ArchiveManager.getWordFrequency(AppState.threads);
    }
    UI.renderWordFrequency(_wordFreqCache);
    UI.show('v-word-freq-content');
    arrow.classList.add('open');
  }
}

/* ── Common viewer setup (used by both paths) ─────────────── */
function loadViewerData(meta, threads) {
  /* Clear word frequency cache and collapse panel for the new archive */
  _wordFreqCache = null;
  UI.hide('v-word-freq-content');
  const wfArrow = document.getElementById('v-word-freq-arrow');
  if (wfArrow) wfArrow.classList.remove('open');

  /* Restore videoId and title so _updateMetaTitle can read them */
  AppState.videoId    = meta.videoId    || '';
  AppState.videoTitle = meta.videoTitle || '';

  /* Populate meta bar — title is a link when videoId is known */
  _updateMetaTitle();

  UI.setText('v-meta-total',   UI.fmt(meta.totalComments || threads.length));
  UI.setText('v-meta-threads', UI.fmt(meta.totalTopLevelComments || threads.length));
  UI.setText('v-meta-replies', UI.fmt(meta.totalReplies || threads.reduce((s, t) => s + (t.replies?.length || 0), 0)));
  UI.setText('v-meta-date',    meta.exportedAt
    ? new Date(meta.exportedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—'
  );
  UI.setText('v-meta-uploaded', meta.videoPublishedAt
    ? new Date(meta.videoPublishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—'
  );
  const channelEl = document.getElementById('v-meta-channel');
  UI.setText('v-meta-channel', meta.videoChannelTitle || '—');
  channelEl.classList.toggle('meta-link', !!meta.videoChannelTitle);

  /* Persist channel ID so the meta-bar click can match by authorChannelId */
  AppState.videoChannelId = meta.videoChannelId || '';

  /* Thumbnail — hide the wrap when URL is absent (older archives) */
  const thumbImg  = document.getElementById('v-meta-thumb');
  const thumbWrap = document.getElementById('v-meta-thumb-wrap');
  if (meta.videoThumbnailUrl) {
    thumbImg.src          = meta.videoThumbnailUrl;
    thumbImg.style.display = '';
    thumbWrap.style.display = '';
  } else {
    thumbWrap.style.display = 'none';
  }

  /* View / like counts — hide the row for archives that predate this feature */
  if (meta.videoViewCount || meta.videoLikeCount) {
    UI.setText('v-meta-video-stats',
      `${UI.fmtCount(meta.videoViewCount)} views · ${UI.fmtCount(meta.videoLikeCount)} likes`
    );
    UI.show('v-meta-video-stats');
  } else {
    UI.hide('v-meta-video-stats');
  }

  /* Description toggle — hidden for archives that predate this feature */
  const descToggle = document.getElementById('v-desc-toggle');
  const descPanel  = document.getElementById('v-meta-description');
  const rawDesc    = meta.videoDescription || '';
  if (rawDesc) {
    const SHORT  = 500;
    const isLong = rawDesc.length > SHORT;
    const short  = UI.esc(rawDesc.substring(0, SHORT));
    const full   = UI.esc(rawDesc);
    descPanel.innerHTML = isLong
      ? `${short}<span id="v-desc-ellipsis">… <button class="meta-desc-more" onclick="
          document.getElementById('v-desc-ellipsis').style.display='none';
          document.getElementById('v-desc-full').style.display='';
        ">Show more</button></span><span id="v-desc-full" style="display:none">${full.substring(short.length)}</span>`
      : full;
    descPanel.style.display = 'none';
    descToggle.textContent  = 'Show description ▾';
    descToggle.onclick = () => {
      const open = descPanel.style.display !== 'none';
      descPanel.style.display   = open ? 'none' : 'block';
      descToggle.textContent    = open ? 'Show description ▾' : 'Hide description ▴';
    };
    UI.show('v-desc-toggle');
  } else {
    UI.hide('v-desc-toggle');
    UI.hide('v-meta-description');
  }

  const total = threads.reduce((s, t) => s + 1 + (t.replies?.length || 0), 0);
  UI.setText('v-footer-count', `${UI.fmt(total)} comments loaded`);

  /* Show viewer chrome (dots will be hidden by the first render) */
  UI.show('v-meta-bar', 'flex');
  UI.show('v-word-freq-panel');
  UI.show('v-controls', 'flex');
  UI.show('v-result-count');
  UI.show('v-filtered-export-row', 'flex');

  applyViewerFilters();
}

/* ─────────────────────────────────────────────────────────────
   VIEWER — sort / filter / render
   ───────────────────────────────────────────────────────────── */
function setSort(mode) {
  AppState.currentSort = mode;
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('v-sort-' + mode).classList.add('active');
  applyViewerFilters();
}

function toggleFilter(type) {
  if (type === 'comments') {
    AppState.showComments = !AppState.showComments;
    document.getElementById('v-filter-comments').classList.toggle('active', AppState.showComments);
  } else {
    AppState.showReplies = !AppState.showReplies;
    document.getElementById('v-filter-replies').classList.toggle('active', AppState.showReplies);
  }
  applyViewerFilters();
}

function togglePinnedFilter() {
  AppState.showPinnedOnly = !AppState.showPinnedOnly;
  document.getElementById('v-filter-pinned').classList.toggle('active', AppState.showPinnedOnly);
  applyViewerFilters();
}

function clearDateFilter() {
  document.getElementById('v-date-from').value = '';
  document.getElementById('v-date-to').value   = '';
  applyViewerFilters();
}

/* ─────────────────────────────────────────────────────────────
   VIEWER — batch / infinite-scroll rendering state
   Rendering all threads at once locks the browser for large archives.
   Instead we paint the first BATCH_SIZE threads immediately, then
   append the next batch each time the user scrolls near the bottom.
   ───────────────────────────────────────────────────────────── */
const BATCH_SIZE = 100;

let _filterTimer      = null;
let _renderedThreads  = [];   /* current filtered+sorted list */
let _renderOffset     = 0;    /* how many threads have been painted so far */
let _renderQuery      = '';   /* captured at render time for batch callbacks */
let _wordFreqCache    = null; /* computed once per loaded archive, cleared on reset */
let _renderTz         = 'UTC';
let _mergeFetchStopped = false; /* signals the URL-merge fetch loop to stop */
let _scrollObserver   = null; /* IntersectionObserver watching the sentinel */

/* Debounced entry point — shows loading dots immediately, defers heavy render */
function applyViewerFilters() {
  clearTimeout(_filterTimer);

  if (AppState.threads.length > 0) {
    UI.show('v-loading');
    UI.hide('v-comment-feed');
    UI.hide('v-no-results');
  }

  _filterTimer = setTimeout(_renderViewer, 80);
}

function _renderViewer() {
  const feed = document.getElementById('v-comment-feed');

  /* Tear down any in-progress batch scroll from a previous render */
  _teardownSentinel();
  feed.innerHTML = '';

  _renderQuery = document.getElementById('v-search-input').value.trim().toLowerCase();
  _renderTz    = document.getElementById('v-tz-select').value || 'UTC';

  UI.hide('v-loading');

  /* Filter */
  let filtered = AppState.showComments
    ? ArchiveManager.filterThreads(AppState.threads, _renderQuery, AppState.showReplies)
    : [];

  /* Sort */
  filtered = ArchiveManager.sortThreads(filtered, AppState.currentSort);

  /* Date range filter */
  const dateFrom = document.getElementById('v-date-from').value || '';
  const dateTo   = document.getElementById('v-date-to').value   || '';
  if (dateFrom || dateTo) {
    filtered = filtered.filter(t => {
      const d = (t.publishedAt || '').slice(0, 10);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo   && d > dateTo)   return false;
      return true;
    });
  }

  /* Pinned-only filter */
  if (AppState.showPinnedOnly) {
    filtered = filtered.filter(t => AppState.pinnedIds.has(t.id));
  }

  _renderedThreads = filtered;
  _renderOffset    = 0;

  /* No results */
  if (filtered.length === 0) {
    UI.show('v-no-results');
    UI.setText('v-result-count', 'No comments match your search.');
    _updateFilteredExportRow();
    return;
  }

  UI.hide('v-no-results');
  UI.show('v-comment-feed');

  /* Update count label (always shows total, not just what's painted) */
  const replyCount = filtered.reduce((s, t) => s + (t.replies?.length || 0), 0);
  UI.setText(
    'v-result-count',
    _renderQuery
      ? `${UI.fmt(filtered.length)} thread${filtered.length !== 1 ? 's' : ''} matching "${_renderQuery}"`
      : `${UI.fmt(filtered.length)} comment${filtered.length !== 1 ? 's' : ''}${AppState.showReplies ? ` · ${UI.fmt(replyCount)} replies` : ''}`
  );

  _updateFilteredExportRow();

  /* Paint first batch; the sentinel handles every subsequent batch */
  _renderBatch(feed);
}

function _updateFilteredExportRow() {
  if (_renderedThreads.length > 0) {
    const dateFrom   = document.getElementById('v-date-from').value || '';
    const dateTo     = document.getElementById('v-date-to').value   || '';
    const isFiltered = _renderQuery !== '' || !AppState.showComments || !AppState.showReplies
                       || dateFrom || dateTo || AppState.showPinnedOnly;
    const label = isFiltered ? 'Filtered' : 'All';
    UI.setText('v-filtered-export-label', `${label} (${UI.fmt(_renderedThreads.length)}):`);
    UI.show('v-filtered-export-content', 'flex');
  } else {
    UI.hide('v-filtered-export-content');
  }
}

/* Appends the next BATCH_SIZE threads and attaches a new sentinel if more remain */
function _renderBatch(feed) {
  const end  = Math.min(_renderOffset + BATCH_SIZE, _renderedThreads.length);
  const frag = document.createDocumentFragment();

  for (let i = _renderOffset; i < end; i++) {
    frag.appendChild(
      UI.renderThread(_renderedThreads[i], _renderQuery, AppState.showReplies, _renderTz, i, AppState.videoId, AppState.pinnedIds)
    );
  }

  feed.appendChild(frag);
  _renderOffset = end;

  if (_renderOffset < _renderedThreads.length) {
    _attachSentinel(feed);
  }
}

/*
 * Inserts a 1px sentinel element at the bottom of the feed.
 * The IntersectionObserver fires when the user scrolls within
 * 400px of it, triggering the next batch — then removes itself.
 */
function _attachSentinel(feed) {
  const sentinel       = document.createElement('div');
  sentinel.id          = 'v-scroll-sentinel';
  sentinel.innerHTML   = '<div class="dot-loader sentinel-dots"><span></span><span></span><span></span></div>';
  feed.appendChild(sentinel);

  _scrollObserver = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    _teardownSentinel();
    _renderBatch(feed);
  }, { rootMargin: '400px' });

  _scrollObserver.observe(sentinel);
}

function _teardownSentinel() {
  if (_scrollObserver) { _scrollObserver.disconnect(); _scrollObserver = null; }
  const el = document.getElementById('v-scroll-sentinel');
  if (el) el.remove();
}

function resetViewer() {
  clearTimeout(_filterTimer);
  _teardownSentinel();
  _renderedThreads = [];
  _renderOffset    = 0;

  AppState.currentSort    = 'newest';
  AppState.showComments   = true;
  AppState.showReplies    = true;
  AppState.showPinnedOnly = false;
  AppState.pinnedIds.clear();

  /* Reset description toggle */
  UI.hide('v-desc-toggle');
  UI.hide('v-meta-description');
  AppState.videoId          = '';
  AppState.videoDescription = '';

  /* Reset word frequency panel */
  _wordFreqCache = null;
  UI.hide('v-word-freq-content');
  UI.hide('v-word-freq-panel');

  /* Reset merged sources */
  AppState.sources = [];
  const sourceList = document.getElementById('v-source-list');
  if (sourceList) { sourceList.innerHTML = ''; sourceList.style.display = 'none'; }

  /* Cancel any in-progress URL merge and close the menu */
  _mergeFetchStopped = true;
  document.getElementById('v-merge-menu').style.display = 'none';
  UI.hide('v-merge-url-row');
  document.getElementById('v-merge-url-input').value       = '';
  document.getElementById('v-merge-fetch-status').textContent   = '';
  document.getElementById('v-merge-fetch-btn').disabled         = false;
  document.getElementById('v-merge-estimate-btn').disabled      = false;
  UI.hide('v-merge-stop-btn');
  const wfArrow = document.getElementById('v-word-freq-arrow');
  if (wfArrow) wfArrow.classList.remove('open');

  UI.show('v-drop-zone');
  UI.hide('v-loading');
  UI.hide('v-meta-bar');
  UI.hide('v-controls');
  UI.hide('v-result-count');
  UI.hide('v-comment-feed');
  UI.hide('v-no-results');
  UI.hide('v-filtered-export-row');

  document.getElementById('v-comment-feed').innerHTML = '';
  document.getElementById('v-search-input').value     = '';
  document.getElementById('v-file-input').value       = '';
  UI.setText('v-footer-count', '');

  /* Reset sort buttons */
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('v-sort-newest').classList.add('active');

  /* Reset filter buttons — comments/replies default active, pinned default inactive */
  document.querySelectorAll('.toggle-btn').forEach(b => b.classList.add('active'));
  document.getElementById('v-filter-pinned').classList.remove('active');

  /* Reset date inputs */
  document.getElementById('v-date-from').value = '';
  document.getElementById('v-date-to').value   = '';
}

/* ─────────────────────────────────────────────────────────────
   VIEWER — merge a second JSON archive into the loaded one
   ───────────────────────────────────────────────────────────── */
function mergeJsonFile(file) {
  if (!file || !AppState.threads.length) return;

  const reader = new FileReader();
  reader.onload = e => {
    let data;
    try {
      data = JSON.parse(e.target.result);
    } catch (_) {
      alert('Could not parse the selected file as JSON.');
      return;
    }

    let parsed;
    try {
      parsed = ArchiveManager.parseImport(data);
    } catch (err) {
      alert(err.message);
      return;
    }

    const sourceLabel = file.name;
    const { threads: merged, addedCount } = ArchiveManager.mergeArchives(
      AppState.threads,
      parsed.threads,
      sourceLabel
    );

    if (addedCount === 0) {
      applyViewerFilters();
      setTimeout(() => {
        const rc = document.getElementById('v-result-count');
        if (rc) rc.textContent = '⊕ No new threads found — all duplicates.';
        setTimeout(() => applyViewerFilters(), 2500);
      }, 180);
      return;
    }

    AppState.threads = merged;
    AppState.sources.push({ label: sourceLabel, count: addedCount });
    _wordFreqCache   = null;

    /* Recompute meta bar counts from the merged thread set */
    _updateMergedMetaBar();
    _renderSourceList();

    /* Apply filters first (80ms debounce), then briefly show merge count */
    applyViewerFilters();
    setTimeout(() => {
      const rc = document.getElementById('v-result-count');
      if (rc) rc.textContent = `⊕ Merged ${addedCount} new thread${addedCount !== 1 ? 's' : ''} from "${sourceLabel}"`;
      setTimeout(() => applyViewerFilters(), 2500);
    }, 180);
  };

  reader.readAsText(file);
  /* Reset input so the same file can be selected again */
  document.getElementById('v-merge-input').value = '';
}

/* ── Update meta bar title with optional merged-archive suffix ─ */
function _updateMetaTitle() {
  const titleEl   = document.getElementById('v-meta-title');
  if (!titleEl) return;

  const titleText = AppState.videoTitle || 'Unknown Video';
  const n         = AppState.sources.length;
  const suffix    = n > 0 ? ` <span class="v-meta-title-suffix">+ ${n} archive${n !== 1 ? 's' : ''}</span>` : '';

  if (AppState.videoId) {
    titleEl.innerHTML =
      `<a class="meta-title-link" href="https://www.youtube.com/watch?v=${UI.esc(AppState.videoId)}" target="_blank" rel="noopener noreferrer">${UI.esc(titleText)}</a>${suffix}`;
  } else {
    titleEl.innerHTML = UI.esc(titleText) + suffix;
  }
}

/* ── Merge archive menu toggle ───────────────────────────── */
function toggleMergeMenu() {
  const menu = document.getElementById('v-merge-menu');
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

/* ── Show URL input row (called by menu option click) ────── */
function showMergeUrlInput() {
  document.getElementById('v-merge-menu').style.display = 'none';
  UI.show('v-merge-url-row', 'flex');
  document.getElementById('v-merge-url-input').focus();
}

/* ── Hide URL input row and reset its state ─────────────── */
function cancelMergeUrl() {
  _mergeFetchStopped = true;
  UI.hide('v-merge-url-row');
  document.getElementById('v-merge-url-input').value      = '';
  document.getElementById('v-merge-fetch-status').textContent   = '';
  document.getElementById('v-merge-fetch-btn').disabled         = false;
  document.getElementById('v-merge-estimate-btn').disabled      = false;
  UI.hide('v-merge-stop-btn');
}

/* ── Signal the fetch loop to stop ─────────────────────── */
function stopMergeFetch() {
  _mergeFetchStopped = true;
  document.getElementById('v-merge-fetch-status').textContent = 'Stopping…';
}

/* ── Estimate quota cost for a merge URL (1 API unit) ─────── */
async function estimateMergeCost() {
  const videoId  = extractVideoId(document.getElementById('v-merge-url-input').value.trim());
  const statusEl = document.getElementById('v-merge-fetch-status');
  const btn      = document.getElementById('v-merge-estimate-btn');

  if (!videoId) { statusEl.textContent = '⚠ Invalid URL or video ID.'; return; }

  const apiKey = localStorage.getItem(API_KEY_STORAGE) || '';
  if (!apiKey) { statusEl.textContent = '⚠ No API key saved — enter one in the Archiver tab first.'; return; }

  btn.disabled = true;
  statusEl.textContent = 'Estimating…';

  try {
    const info = await YouTubeAPI.getVideoInfo(videoId, apiKey);
    if (info.commentCount > 0) {
      const minUnits = Math.ceil(info.commentCount / 100);
      statusEl.textContent =
        `~${minUnits.toLocaleString()} units estimated` +
        ` (${info.commentCount.toLocaleString()} comments · replies will add more)`;
    } else {
      statusEl.textContent = 'Comments appear to be disabled for this video.';
    }
  } catch (e) {
    statusEl.textContent = `⚠ ${e.message}`;
  } finally {
    btn.disabled = false;
  }
}

/* ── Fetch comments from a YouTube URL and merge them in ── */
async function startMergeFetch() {
  const urlInput = document.getElementById('v-merge-url-input');
  const videoId  = extractVideoId(urlInput.value.trim());
  const statusEl = document.getElementById('v-merge-fetch-status');

  if (!videoId) {
    statusEl.textContent = '⚠ Invalid URL or video ID.';
    return;
  }

  const apiKey = localStorage.getItem(API_KEY_STORAGE) || '';
  if (!apiKey) {
    statusEl.textContent = '⚠ No API key saved — enter one in the Archiver tab first.';
    return;
  }

  _mergeFetchStopped = false;
  document.getElementById('v-merge-fetch-btn').disabled    = true;
  document.getElementById('v-merge-estimate-btn').disabled = true;
  UI.show('v-merge-stop-btn');
  statusEl.textContent = 'Fetching video info…';

  const allComments = [];
  let meta          = { videoId };
  let videoTitle    = videoId;

  /* Step 1: video metadata */
  try {
    const info = await YouTubeAPI.getVideoInfo(videoId, apiKey);
    videoTitle = info.title;
    meta = {
      videoId,
      videoTitle:        info.title,
      videoPublishedAt:  info.publishedAt,
      videoChannelTitle: info.channelTitle,
      videoChannelId:    info.channelId,
      videoThumbnailUrl: info.thumbnailUrl,
      videoViewCount:    info.viewCount,
      videoLikeCount:    info.likeCount,
      videoDescription:  info.description,
    };
    statusEl.textContent = `"${info.title}" — fetching comments…`;
  } catch (e) {
    statusEl.textContent = `⚠ ${e.message}`;
    document.getElementById('v-merge-fetch-btn').disabled    = false;
    document.getElementById('v-merge-estimate-btn').disabled = false;
    UI.hide('v-merge-stop-btn');
    return;
  }

  /* Step 2: paginate through threads + replies */
  let pageToken = '';
  let page      = 0;

  try {
    do {
      if (_mergeFetchStopped) break;

      const data = await YouTubeAPI.getCommentThreadPage(videoId, apiKey, 'time', pageToken);

      for (const thread of (data.items || [])) {
        if (_mergeFetchStopped) break;

        const top = YouTubeAPI.parseThread(thread);
        allComments.push(top);

        if (top._totalReplies <= 5 && top._inlineReplies.length > 0) {
          YouTubeAPI.parseInlineReplies(top._inlineReplies, top.id)
            .forEach(r => allComments.push(r));
        } else if (top._totalReplies > 5) {
          await YouTubeAPI.getAllReplies(
            top.id, apiKey,
            reply => allComments.push(reply),
            ()    => _mergeFetchStopped
          );
        }
      }

      page++;
      statusEl.textContent =
        `Fetching… ${allComments.length.toLocaleString()} comments (page ${page})`;

      pageToken = data.nextPageToken || '';
      await new Promise(r => setTimeout(r, 0)); /* yield to browser */

    } while (pageToken && !_mergeFetchStopped);

    /* Step 3: build nested threads and merge */
    const payload     = ArchiveManager.buildNestedExport(allComments, meta);
    const sourceLabel = videoTitle;
    const { threads: merged, addedCount } = ArchiveManager.mergeArchives(
      AppState.threads, payload.comments, sourceLabel
    );

    if (addedCount === 0) {
      statusEl.textContent = '⊕ No new threads found — all duplicates.';
      document.getElementById('v-merge-fetch-btn').disabled    = false;
    document.getElementById('v-merge-estimate-btn').disabled = false;
      UI.hide('v-merge-stop-btn');
      return;
    }

    AppState.threads = merged;
    AppState.sources.push({ label: sourceLabel, count: addedCount });
    _wordFreqCache   = null;

    _updateMergedMetaBar();
    _renderSourceList();
    applyViewerFilters();
    setTimeout(() => {
      const rc = document.getElementById('v-result-count');
      if (rc) rc.textContent =
        `⊕ Merged ${addedCount} new thread${addedCount !== 1 ? 's' : ''} from "${sourceLabel}"`;
      setTimeout(() => applyViewerFilters(), 2500);
    }, 180);

    cancelMergeUrl();

  } catch (e) {
    statusEl.textContent = `⚠ ${e.message}`;
    document.getElementById('v-merge-fetch-btn').disabled    = false;
    document.getElementById('v-merge-estimate-btn').disabled = false;
    UI.hide('v-merge-stop-btn');
  }
}

/* ── Shared meta bar count update after any merge/removal ─── */
function _updateMergedMetaBar() {
  const totalReplies  = AppState.threads.reduce((s, t) => s + (t.replies?.length || 0), 0);
  const totalComments = AppState.threads.length + totalReplies;
  UI.setText('v-meta-total',   UI.fmt(totalComments));
  UI.setText('v-meta-threads', UI.fmt(AppState.threads.length));
  UI.setText('v-meta-replies', UI.fmt(totalReplies));
}

/* ── Render the merged-sources chip list ─────────────────── */
function _renderSourceList() {
  const container = document.getElementById('v-source-list');
  if (!container) return;

  if (!AppState.sources.length) {
    container.style.display = 'none';
    _updateMetaTitle();
    return;
  }

  _updateMetaTitle();

  container.style.display = 'flex';
  container.innerHTML =
    '<span class="v-source-label">Merged:</span>' +
    AppState.sources.map(s =>
      `<span class="v-source-chip" data-source="${UI.esc(s.label)}">` +
        `<span class="v-source-chip-name" title="${UI.esc(s.label)}">${UI.esc(s.label)}</span>` +
        `<button class="v-source-chip-remove" title="Remove this archive">×</button>` +
      `</span>`
    ).join('');
}

/* ── Remove a merged source and its threads from the viewer ─ */
function removeSource(label) {
  AppState.threads = ArchiveManager.removeSource(AppState.threads, label);
  AppState.sources = AppState.sources.filter(s => s.label !== label);
  _wordFreqCache   = null;

  _updateMergedMetaBar();
  _renderSourceList();
  applyViewerFilters();
}

/* ─────────────────────────────────────────────────────────────
   INIT — runs once DOM is ready
   ───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  UI.initTheme();
  loadSavedApiKey();
  initDropZone();
  UI.populateTzDropdown('v-tz-select');

  /* Merge file input — triggers mergeJsonFile when a file is chosen */
  document.getElementById('v-merge-input').addEventListener('change', e => {
    if (e.target.files[0]) mergeJsonFile(e.target.files[0]);
  });

  /* Merge menu options */
  document.getElementById('v-merge-url-opt').addEventListener('click', showMergeUrlInput);
  document.getElementById('v-merge-file-opt').addEventListener('click', () => {
    document.getElementById('v-merge-menu').style.display = 'none';
    document.getElementById('v-merge-input').click();
  });

  /* Close merge menu on click outside */
  document.addEventListener('click', e => {
    const menu = document.getElementById('v-merge-menu');
    if (menu.style.display === 'none') return;
    if (!e.target.closest('.v-merge-wrap')) menu.style.display = 'none';
  });

  /* Enter key submits the merge URL input */
  document.getElementById('v-merge-url-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') startMergeFetch();
  });

  /* Source chip remove — delegated click on the source list container */
  document.getElementById('v-source-list').addEventListener('click', e => {
    const btn = e.target.closest('.v-source-chip-remove');
    if (!btn) return;
    const chip = btn.closest('.v-source-chip');
    if (chip?.dataset.source) removeSource(chip.dataset.source);
  });

  /* Back to top — show after 400px of scroll, smooth-scroll to top on click */
  const backToTopBtn = document.getElementById('v-back-to-top');
  window.addEventListener('scroll', () => {
    backToTopBtn.classList.toggle('visible', window.scrollY > 400);
  });
  backToTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /*
   * Channel name in the meta bar — click to show the uploader's comments.
   * Single listener set up once; reads text content at click time.
   */
  document.getElementById('v-meta-bar').addEventListener('click', async e => {
    const el = e.target.closest('#v-meta-channel');
    if (!el || !el.classList.contains('meta-link') || !AppState.threads.length) return;

    const stats = ArchiveManager.getUserStats(AppState.threads, el.textContent.trim(), AppState.videoChannelId);
    if (!stats.authorChannelId && AppState.videoChannelId) stats.authorChannelId = AppState.videoChannelId;

    let cannotRender = false;
    if (!stats.avatarUrl && AppState.videoChannelId) {
      const apiKey = localStorage.getItem(API_KEY_STORAGE) || '';
      if (apiKey) {
        try {
          stats.avatarUrl = await YouTubeAPI.getChannelThumbnail(AppState.videoChannelId, apiKey);
        } catch (_) {
          cannotRender = true;
        }
      } else {
        cannotRender = true;
      }
    }

    UI.renderUserModal(stats, cannotRender);
    UI.highlightFeedAuthor(stats.authorName);
  });

  /*
   * Feed click delegation — handles pin toggles and author modal opens.
   * Pin clicks are checked first so they don't bubble to the author handler.
   */
  document.getElementById('v-comment-feed').addEventListener('click', e => {
    /* Pin toggle */
    const pinBtn = e.target.closest('.c-pin');
    if (pinBtn) {
      e.stopPropagation();
      const id = pinBtn.dataset.commentId;
      if (AppState.pinnedIds.has(id)) {
        AppState.pinnedIds.delete(id);
        pinBtn.textContent = '☆';
        pinBtn.classList.remove('c-pin--active');
      } else {
        AppState.pinnedIds.add(id);
        pinBtn.textContent = '★';
        pinBtn.classList.add('c-pin--active');
      }
      _updateFilteredExportRow();
      return;
    }

    /* Author profile modal */
    const authorEl = e.target.closest('.c-author');
    if (!authorEl || !AppState.threads.length) return;
    const stats = ArchiveManager.getUserStats(AppState.threads, authorEl.textContent.trim());
    UI.renderUserModal(stats);
    UI.highlightFeedAuthor(stats.authorName);
  });

  /*
   * Author name hover tooltip — computed lazily on first hover and cached
   * in the element's title attribute so getUserStats only runs once per author.
   */
  document.getElementById('v-comment-feed').addEventListener('mouseover', e => {
    const authorEl = e.target.closest('.c-author');
    if (!authorEl || authorEl.title || !AppState.threads.length) return;
    const stats = ArchiveManager.getUserStats(AppState.threads, authorEl.textContent.trim());
    const c = stats.commentCount;
    const r = stats.replyCount;
    authorEl.title = `${c} comment${c !== 1 ? 's' : ''} · ${r} ${r !== 1 ? 'replies' : 'reply'}`;
  });
});

/* ─────────────────────────────────────────────────────────────
   FIRE SPRITE — frame cycling via setInterval (8fps)
   Runs at script load time (scripts are deferred to end of body
   so the DOM is fully parsed). Queries element each tick so a
   null fireEl can never silently break the loop.
   ───────────────────────────────────────────────────────────── */
(function () {
  const paths = [
    'assets/fire/1.png',
    'assets/fire/2.png',
    'assets/fire/3.png',
    'assets/fire/4.png',
  ];

  /* Preload all frames so swaps are instant */
  paths.forEach(src => { const img = new Image(); img.src = src; });

  let frame = 0;
  setInterval(() => {
    const el = document.getElementById('fire-sprite');
    if (!el) return;
    frame = (frame + 1) % paths.length;
    el.src = paths[frame];
  }, 125);
}());
