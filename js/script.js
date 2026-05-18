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
  AppState.videoId           = videoId;

  /* UI: show progress, hide previous results */
  document.getElementById('a-fetch-btn').disabled = true;
  document.getElementById('a-comment-list').innerHTML = '';
  UI.hide('a-results-section');
  UI.hide('a-open-viewer-btn');
  UI.show('a-progress-section');
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
    UI.setText('a-status-line', `Video: "${info.title}"`);

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

  /* Stop the buffering dots */
  UI.hide('a-dot-loader');

  document.getElementById('a-fetch-btn').disabled = false;
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
      videoTitle:        AppState.videoTitle,
      videoPublishedAt:  AppState.videoPublishedAt,
      videoChannelTitle: AppState.videoChannelTitle,
      videoChannelId:    AppState.videoChannelId,
      videoThumbnailUrl: AppState.videoThumbnailUrl,
      videoViewCount:    AppState.videoViewCount,
      videoLikeCount:    AppState.videoLikeCount,
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

  document.getElementById('a-comment-list').innerHTML = '';
  document.getElementById('a-video-url').value        = '';
  UI.hide('a-results-section');
  UI.hide('a-progress-section');
  UI.hide('a-open-viewer-btn');
  UI.hide('a-quota-estimate');
  UI.setText('a-quota-estimate', '');
  UI.hideError('a-error-box');
}

/* ─────────────────────────────────────────────────────────────
   ARCHIVER — exports (delegates to ArchiveManager)
   ───────────────────────────────────────────────────────────── */
function exportJSON() {
  ArchiveManager.exportJSON(AppState.allComments, {
    videoTitle:        AppState.videoTitle,
    videoPublishedAt:  AppState.videoPublishedAt,
    videoChannelTitle: AppState.videoChannelTitle,
    videoChannelId:    AppState.videoChannelId,
    videoThumbnailUrl: AppState.videoThumbnailUrl,
    videoViewCount:    AppState.videoViewCount,
    videoLikeCount:    AppState.videoLikeCount,
  });
}
function exportCSV()  { ArchiveManager.exportCSV(AppState.allComments,  AppState.videoTitle); }
function exportTXT()  { ArchiveManager.exportTXT(AppState.allComments,  AppState.videoTitle); }

function exportFiltered(format) {
  const meta = {
    videoTitle:        AppState.videoTitle,
    videoPublishedAt:  AppState.videoPublishedAt,
    videoChannelTitle: AppState.videoChannelTitle,
    videoChannelId:    AppState.videoChannelId,
    videoThumbnailUrl: AppState.videoThumbnailUrl,
    videoViewCount:    AppState.videoViewCount,
    videoLikeCount:    AppState.videoLikeCount,
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

/* ── Common viewer setup (used by both paths) ─────────────── */
function loadViewerData(meta, threads) {
  /* Populate meta bar */
  UI.setText('v-meta-title',   meta.videoTitle || 'Unknown Video');
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

  const total = threads.reduce((s, t) => s + 1 + (t.replies?.length || 0), 0);
  UI.setText('v-footer-count', `${UI.fmt(total)} comments loaded`);

  /* Show viewer chrome (dots will be hidden by the first render) */
  UI.show('v-meta-bar', 'flex');
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
let _renderTz         = 'UTC';
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
   INIT — runs once DOM is ready
   ───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  UI.initTheme();
  loadSavedApiKey();
  initDropZone();
  UI.populateTzDropdown('v-tz-select');

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
