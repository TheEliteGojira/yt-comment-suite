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
  function renderThread(thread, query, showReplies, tz, animDelay, videoId) {
    const wrapper       = document.createElement('div');
    wrapper.className   = 'comment-thread';
    wrapper.style.animationDelay = Math.min(animDelay * 20, 300) + 'ms';

    /* Strips highlight marks and dimming from the whole thread on click */
    function clearSearchEffects() {
      wrapper.querySelectorAll('mark').forEach(m => m.replaceWith(document.createTextNode(m.textContent)));
      wrapper.querySelectorAll('.reply-dimmed').forEach(el => el.classList.remove('reply-dimmed'));
    }

    const threadLink = videoId
      ? `<a href="https://www.youtube.com/watch?v=${videoId}&lc=${thread.id}" class="c-permalink" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">↗</a>`
      : '';

    /* Top-level comment card */
    const card        = document.createElement('div');
    card.className    = 'comment-card';
    card.innerHTML    = `
      <div class="comment-header">
        <span class="c-author">${esc(thread.author)}</span>
        <span class="c-date">${formatDate(thread.publishedAt, tz)}</span>
        ${threadLink}
        <span class="c-likes"><span class="heart">♥</span> <span class="c-likes-num">${fmt(thread.likeCount)}</span></span>
      </div>
      <div class="c-text">${highlight(esc(thread.text || ''), query)}</div>
    `;
    if (query) card.addEventListener('click', clearSearchEffects);
    wrapper.appendChild(card);

    /* Replies */
    const replies = thread.replies || [];
    if (replies.length > 0 && showReplies) {
      const q = query ? query.toLowerCase() : '';

      /*
       * When searching: show ALL replies in the thread so the full
       * conversation is visible. Matching replies get highlighted;
       * non-matching replies are dimmed so context is clear.
       * When not searching: show all replies normally.
       */
      const matchingCount = q
        ? replies.filter(r => r.text?.toLowerCase().includes(q)).length
        : replies.length;

      const toggle       = document.createElement('button');
      toggle.className   = 'replies-toggle';
      toggle.innerHTML   = `
        <em class="toggle-arrow">▶</em>
        ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}
        ${q && matchingCount < replies.length ? ` · ${matchingCount} matching` : ''}
      `;

      const replyContainer     = document.createElement('div');
      replyContainer.className = 'replies-container';

      replies.forEach(r => {
        const isMatch  = q ? r.text?.toLowerCase().includes(q) : true;
        const rc       = document.createElement('div');
        /* Dim non-matching replies so the matching ones stand out */
        const replyLink = videoId
          ? `<a href="https://www.youtube.com/watch?v=${videoId}&lc=${r.id}" class="c-permalink" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">↗</a>`
          : '';
        rc.className   = 'reply-card' + (!isMatch && q ? ' reply-dimmed' : '');
        rc.innerHTML   = `
          <div class="comment-header">
            <span class="c-author">${esc(r.author)}</span>
            <span class="c-date">${formatDate(r.publishedAt, tz)}</span>
            ${replyLink}
            <span class="c-likes"><span class="heart">♥</span> <span class="c-likes-num">${fmt(r.likeCount)}</span></span>
          </div>
          <div class="c-text">${highlight(esc(r.text || ''), query)}</div>
        `;
        if (q) rc.addEventListener('click', clearSearchEffects);
        replyContainer.appendChild(rc);
      });

      /* Toggle open/close */
      toggle.addEventListener('click', () => {
        const open = replyContainer.classList.toggle('open');
        toggle.classList.toggle('open', open);
      });

      /* Auto-expand when search matches a reply */
      if (q && matchingCount > 0) {
        replyContainer.classList.add('open');
        toggle.classList.add('open');
      }

      wrapper.appendChild(toggle);
      wrapper.appendChild(replyContainer);
    }

    return wrapper;
  }

  /* ── User profile modal ──────────────────────────────────── */

  /* Named so it can be removed cleanly from the document listener */
  function _onModalKeydown(e) {
    if (e.key === 'Escape') closeModal();
  }

  function closeModal() {
    const el = document.getElementById('user-modal-overlay');
    if (el) el.remove();
    document.removeEventListener('keydown', _onModalKeydown);
    document.body.style.overflow = '';
  }

  /*
   * Builds and mounts the author activity modal.
   * stats comes from ArchiveManager.getUserStats().
   * Reads the current timezone from the viewer dropdown so timestamps match.
   */
  function renderUserModal(stats) {
    closeModal(); /* dismiss any already-open modal first */

    const tz = document.getElementById('v-tz-select')?.value || 'UTC';

    /* ── Overlay ─────────────────────────────────────────────── */
    const overlay     = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id        = 'user-modal-overlay';

    /* ── Panel ───────────────────────────────────────────────── */
    const panel     = document.createElement('div');
    panel.className = 'modal-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');

    /* ── Header ──────────────────────────────────────────────── */
    const header     = document.createElement('div');
    header.className = 'modal-header';

    /* Avatar — shown if the archive contains the URL; hidden gracefully if absent
       (older archives pre-dating the authorAvatar field won't have it) */
    const avatarHtml = stats.avatarUrl
      ? `<img src="${esc(stats.avatarUrl)}" class="modal-avatar" alt=""
             onerror="this.outerHTML='<div class=\\'modal-avatar modal-avatar--placeholder\\'></div>'">`
      : `<div class="modal-avatar modal-avatar--placeholder"></div>`;

    /* Channel link — only shown when authorChannelId is present in the archive.
     * Opens the author's YouTube channel page in a new tab. */
    const channelLinkHtml = stats.authorChannelId
      ? `<a href="https://www.youtube.com/channel/${esc(stats.authorChannelId)}"
            class="modal-channel-link" target="_blank" rel="noopener noreferrer">View channel ↗</a>`
      : '';

    header.innerHTML = `
      <div class="modal-header-left">
        ${avatarHtml}
        <div>
          <div class="modal-eyebrow">Author Activity</div>
          <div class="modal-author-name">${esc(stats.authorName)}</div>
          <div class="modal-disclaimer">activity in this video only · display names are not unique on YouTube</div>
          ${channelLinkHtml}
        </div>
      </div>
      <button class="modal-close" aria-label="Close modal">✕</button>
    `;

    /* ── Stats bar ───────────────────────────────────────────── */
    const statsBar     = document.createElement('div');
    statsBar.className = 'modal-stats';
    statsBar.innerHTML = `
      <div class="modal-stat">
        <span class="modal-stat-num">${fmt(stats.commentCount)}</span>
        <div class="modal-stat-label">Comments</div>
      </div>
      <div class="modal-stat">
        <span class="modal-stat-num">${fmt(stats.replyCount)}</span>
        <div class="modal-stat-label">Replies</div>
      </div>
      <div class="modal-stat">
        <span class="modal-stat-num">${fmt(stats.totalLikes)}</span>
        <div class="modal-stat-label">Likes Received</div>
      </div>
    `;

    /* ── Scrollable body ─────────────────────────────────────── */
    const body     = document.createElement('div');
    body.className = 'modal-body';

    if (stats.commentCount === 0 && stats.replyCount === 0) {
      const empty     = document.createElement('div');
      empty.className = 'modal-empty';
      empty.textContent = 'No comments or replies found in this archive.';
      body.appendChild(empty);
    } else {

    /* Comments section */
    const commentsHeading     = document.createElement('div');
    commentsHeading.className = 'modal-section-label';
    commentsHeading.textContent = `Comments (${fmt(stats.commentCount)})`;
    body.appendChild(commentsHeading);

    if (stats.comments.length === 0) {
      const empty     = document.createElement('div');
      empty.className = 'modal-empty';
      empty.textContent = 'No top-level comments in this archive.';
      body.appendChild(empty);
    } else {
      for (const c of stats.comments) {
        const card     = document.createElement('div');
        card.className = 'modal-comment-card';
        card.innerHTML = `
          <div class="comment-header">
            <span class="c-date">${formatDate(c.publishedAt, tz)}</span>
            <span class="c-likes"><span class="heart">♥</span> <span class="c-likes-num">${fmt(c.likeCount)}</span></span>
          </div>
          <div class="c-text">${esc(c.text || '')}</div>
        `;
        body.appendChild(card);
      }
    }

    /* Replies section */
    const repliesHeading     = document.createElement('div');
    repliesHeading.className = 'modal-section-label';
    repliesHeading.textContent = `Replies (${fmt(stats.replyCount)})`;
    body.appendChild(repliesHeading);

    if (stats.replies.length === 0) {
      const empty     = document.createElement('div');
      empty.className = 'modal-empty';
      empty.textContent = 'No replies in this archive.';
      body.appendChild(empty);
    } else {
      for (const r of stats.replies) {
        const parent = r._parentThread;

        /* Dimmed parent comment for context */
        const context     = document.createElement('div');
        context.className = 'modal-parent-context';
        const parentSnippet = (parent.text || '').length > 140
          ? esc(parent.text.substring(0, 140)) + '…'
          : esc(parent.text || '');
        context.innerHTML = `
          <div class="comment-header">
            <span class="c-author">${esc(parent.author)}</span>
            <span class="c-date">${formatDate(parent.publishedAt, tz)}</span>
          </div>
          <div class="c-text">${parentSnippet}</div>
        `;
        body.appendChild(context);

        /* The reply itself */
        const replyCard     = document.createElement('div');
        replyCard.className = 'modal-reply-card';
        replyCard.innerHTML = `
          <div class="comment-header">
            <span class="c-date">${formatDate(r.publishedAt, tz)}</span>
            <span class="c-likes"><span class="heart">♥</span> <span class="c-likes-num">${fmt(r.likeCount)}</span></span>
          </div>
          <div class="c-text">${esc(r.text || '')}</div>
        `;
        body.appendChild(replyCard);
      }
    }

    } /* end has-activity else */

    /* ── Assemble ────────────────────────────────────────────── */
    panel.appendChild(header);
    panel.appendChild(statsBar);
    panel.appendChild(body);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    /* ── Close handlers ──────────────────────────────────────── */
    header.querySelector('.modal-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', _onModalKeydown);

    /* Prevent page scroll while modal is open */
    document.body.style.overflow = 'hidden';
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
    renderUserModal,
    closeModal,
    initTheme,
    toggleTheme,
  };

})();
