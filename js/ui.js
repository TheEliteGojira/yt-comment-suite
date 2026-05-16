/* =============================================================
   ui.js — DOM helpers, rendering, status messages, theme
   No business logic here; just presentation.
   ============================================================= */

const UI = (() => {

  /* ── Escape HTML to prevent XSS ──────────────────────────── */
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Number formatter ─────────────────────────────────────── */
  function fmt(n) { return Number(n || 0).toLocaleString(); }

  /* ── Show / hide an element ───────────────────────────────── */
  function show(id, display = 'block') {
    const el = document.getElementById(id);
    if (el) el.style.display = display;
  }

  function hide(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  /* ── Error box ────────────────────────────────────────────── */
  function showError(id, message) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message;
    el.style.display = 'block';
    /* Scroll into view on mobile */
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideError(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }

  /* ── Progress bar ─────────────────────────────────────────── */
  function setProgress(barId, pct) {
    const el = document.getElementById(barId);
    if (el) el.style.width = Math.min(100, pct) + '%';
  }

  /* ── Append a single comment to the archiver live preview ─── */
  function appendToPreview(listId, comment) {
    const list = document.getElementById(listId);
    if (!list) return;

    const div = document.createElement('div');
    div.className = 'a-comment-item' + (comment.type === 'reply' ? ' reply' : '');

    const date = new Date(comment.publishedAt)
      .toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

    div.innerHTML = `
      <div class="comment-meta">
        <span class="comment-author">${esc(comment.author)}</span>
        <span class="comment-date">${date}</span>
        <span class="comment-likes">♥ ${fmt(comment.likeCount)}</span>
      </div>
      <div class="comment-text">${esc(comment.text)}</div>
    `;

    list.appendChild(div);
    /* Auto-scroll to newest */
    list.scrollTop = list.scrollHeight;
  }

  /* ── Highlight search query matches within escaped text ────── */
  function highlight(text, query) {
    if (!query) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
  }

  /* ── Format a UTC ISO timestamp in a chosen IANA timezone ─── */
  function formatDate(iso, tz) {
    if (!iso) return '—';

    const d = new Date(iso);

    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone:  tz || 'UTC',
        year:      'numeric',
        month:     '2-digit',
        day:       '2-digit',
        hour:      '2-digit',
        minute:    '2-digit',
        second:    '2-digit',
        hour12:    false,
      }).formatToParts(d);

      const get = type => parts.find(p => p.type === type)?.value ?? '00';
      const hh  = get('hour') === '24' ? '00' : get('hour'); /* edge case */

      const tzLabel = getOffsetLabel(d, tz || 'UTC');
      return `${get('year')}-${get('month')}-${get('day')} ${hh}:${get('minute')}:${get('second')} ${tzLabel}`;

    } catch {
      /* Fallback if timezone string is invalid */
      return d.toISOString().replace('T', ' ').replace('Z', ' UTC');
    }
  }

  /* ── Derive a UTC±H label for a given timezone ─────────────── */
  function getOffsetLabel(date, tz) {
    if (tz === 'UTC') return 'UTC';

    try {
      const utcMs = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
      const tzMs  = new Date(date.toLocaleString('en-US', { timeZone: tz }));
      const diff  = (tzMs - utcMs) / 60000; /* minutes */

      if (diff === 0) return 'UTC';

      const sign = diff > 0 ? '+' : '-';
      const abs  = Math.abs(diff);
      const h    = Math.floor(abs / 60);
      const m    = abs % 60;

      return m
        ? `UTC${sign}${h}:${String(m).padStart(2, '0')}`
        : `UTC${sign}${h}`;

    } catch {
      return tz;
    }
  }

  /* ── Populate the timezone <select> ─────────────────────────── */
  function populateTzDropdown(selectId) {
    const sel    = document.getElementById(selectId);
    if (!sel) return;

    const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const groups = {
      'UTC':       ['UTC'],
      'Americas':  ['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Anchorage','Pacific/Honolulu','America/Toronto','America/Vancouver','America/Mexico_City','America/Bogota','America/Lima','America/Santiago','America/Sao_Paulo','America/Buenos_Aires','America/Caracas','America/Halifax','America/St_Johns','America/Phoenix'],
      'Europe':    ['Europe/London','Europe/Dublin','Europe/Lisbon','Europe/Paris','Europe/Berlin','Europe/Amsterdam','Europe/Brussels','Europe/Madrid','Europe/Rome','Europe/Zurich','Europe/Vienna','Europe/Warsaw','Europe/Prague','Europe/Stockholm','Europe/Oslo','Europe/Copenhagen','Europe/Helsinki','Europe/Athens','Europe/Bucharest','Europe/Kiev','Europe/Moscow','Europe/Istanbul'],
      'Africa':    ['Africa/Cairo','Africa/Johannesburg','Africa/Lagos','Africa/Nairobi','Africa/Casablanca','Africa/Accra','Africa/Addis_Ababa'],
      'Asia':      ['Asia/Dubai','Asia/Karachi','Asia/Kolkata','Asia/Colombo','Asia/Dhaka','Asia/Kathmandu','Asia/Yangon','Asia/Bangkok','Asia/Ho_Chi_Minh','Asia/Jakarta','Asia/Singapore','Asia/Kuala_Lumpur','Asia/Manila','Asia/Shanghai','Asia/Hong_Kong','Asia/Taipei','Asia/Seoul','Asia/Tokyo','Asia/Riyadh','Asia/Baghdad','Asia/Tehran','Asia/Baku','Asia/Tashkent','Asia/Almaty','Asia/Yekaterinburg','Asia/Novosibirsk','Asia/Krasnoyarsk','Asia/Irkutsk','Asia/Yakutsk','Asia/Vladivostok'],
      'Pacific':   ['Pacific/Auckland','Pacific/Fiji','Pacific/Guam','Pacific/Port_Moresby','Pacific/Tongatapu','Pacific/Apia','Pacific/Tahiti','Pacific/Midway'],
      'Australia': ['Australia/Perth','Australia/Darwin','Australia/Adelaide','Australia/Brisbane','Australia/Sydney','Australia/Melbourne','Australia/Hobart'],
    };

    let userAdded = false;

    for (const [groupName, zones] of Object.entries(groups)) {
      const og = document.createElement('optgroup');
      og.label = groupName;

      for (const tz of zones) {
        const opt       = document.createElement('option');
        opt.value       = tz;
        opt.textContent = tz.replace(/_/g, ' ');
        if (tz === userTz) { opt.selected = true; userAdded = true; }
        og.appendChild(opt);
      }

      sel.appendChild(og);
    }

    /* If the user's timezone wasn't in the list, prepend it */
    if (!userAdded && userTz) {
      const og        = document.createElement('optgroup');
      og.label        = 'Your Timezone';
      const opt       = document.createElement('option');
      opt.value       = userTz;
      opt.textContent = userTz.replace(/_/g, ' ');
      opt.selected    = true;
      og.appendChild(opt);
      sel.insertBefore(og, sel.firstChild);
    }
  }

  /* ── Render a single viewer comment thread ────────────────── */
  function renderThread(thread, query, showReplies, tz, animDelay) {
    const wrapper       = document.createElement('div');
    wrapper.className   = 'comment-thread';
    wrapper.style.animationDelay = Math.min(animDelay * 20, 300) + 'ms';

    /* Top-level comment card */
    const card        = document.createElement('div');
    card.className    = 'comment-card';
    card.innerHTML    = `
      <div class="comment-header">
        <span class="c-author">${esc(thread.author)}</span>
        <span class="c-date">${formatDate(thread.publishedAt, tz)}</span>
        <span class="c-likes"><span class="heart">♥</span> <span class="c-likes-num">${fmt(thread.likeCount)}</span></span>
      </div>
      <div class="c-text">${highlight(esc(thread.text || ''), query)}</div>
    `;
    wrapper.appendChild(card);

    /* Replies */
    const replies = thread.replies || [];
    if (replies.length > 0 && showReplies) {
      /* Filter replies if there's a search query */
      const visibleReplies = query
        ? replies.filter(r => r.text?.toLowerCase().includes(query.toLowerCase()))
        : replies;

      const toggle       = document.createElement('button');
      toggle.className   = 'replies-toggle';
      toggle.innerHTML   = `
        <em class="toggle-arrow">▶</em>
        ${visibleReplies.length} ${visibleReplies.length === 1 ? 'reply' : 'replies'}
        ${query && visibleReplies.length < replies.length ? ' matching' : ''}
      `;

      const replyContainer     = document.createElement('div');
      replyContainer.className = 'replies-container';

      visibleReplies.forEach(r => {
        const rc       = document.createElement('div');
        rc.className   = 'reply-card';
        rc.innerHTML   = `
          <div class="comment-header">
            <span class="c-author">${esc(r.author)}</span>
            <span class="c-date">${formatDate(r.publishedAt, tz)}</span>
            <span class="c-likes"><span class="heart">♥</span> <span class="c-likes-num">${fmt(r.likeCount)}</span></span>
          </div>
          <div class="c-text">${highlight(esc(r.text || ''), query)}</div>
        `;
        replyContainer.appendChild(rc);
      });

      /* Toggle open/close */
      toggle.addEventListener('click', () => {
        const open = replyContainer.classList.toggle('open');
        toggle.classList.toggle('open', open);
      });

      /* Auto-expand when search matches a reply */
      if (query && visibleReplies.length > 0) {
        replyContainer.classList.add('open');
        toggle.classList.add('open');
      }

      wrapper.appendChild(toggle);
      wrapper.appendChild(replyContainer);
    }

    return wrapper;
  }

  /* ── Theme: dark / light toggle ──────────────────────────── */
  const THEME_KEY = 'yt-suite-theme';

  function initTheme() {
    /* Respect saved preference, then system preference */
    const saved  = localStorage.getItem(THEME_KEY);
    const system = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    applyTheme(saved || system);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    localStorage.setItem(THEME_KEY, theme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  /* ── Public API ───────────────────────────────────────────── */
  return {
    esc,
    fmt,
    show,
    hide,
    setText,
    showError,
    hideError,
    setProgress,
    appendToPreview,
    highlight,
    formatDate,
    populateTzDropdown,
    renderThread,
    initTheme,
    toggleTheme,
  };

})();
