/* =============================================================
   archive-manager.js — Import / export JSON, sort, filter
   Exports: ArchiveManager object
   ============================================================= */

const ArchiveManager = (() => {

  /* ── Flatten a raw flat comments array into nested threads ── */
  function buildThreadsFromFlat(comments) {
    const topLevel = comments.filter(c => c.type === 'comment' || !c.parentId);
    const byId     = {};

    topLevel.forEach(c => { byId[c.id] = { ...c, replies: [] }; });

    comments
      .filter(c => c.type === 'reply' || c.parentId)
      .forEach(r => {
        if (byId[r.parentId]) byId[r.parentId].replies.push(r);
      });

    /* Sort inline replies chronologically */
    Object.values(byId).forEach(t => {
      t.replies.sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt));
    });

    return Object.values(byId);
  }

  /* ── Convert current allComments flat array to nested JSON ── */
  function buildNestedExport(allComments, videoTitle) {
    /*
     * Old approach filtered allComments once per top-level comment → O(n²).
     * For 200k threads × 300k total that was ~60 billion iterations.
     * Build a parentId → replies Map first so each lookup is O(1).
     */
    const replyMap = new Map();
    let totalReplies = 0;

    for (const c of allComments) {
      if (c.type === 'reply' && c.parentId) {
        if (!replyMap.has(c.parentId)) replyMap.set(c.parentId, []);
        replyMap.get(c.parentId).push(c);
        totalReplies++;
      }
    }

    /* Sort each reply bucket once — O(r log r) total across all buckets */
    replyMap.forEach(replies =>
      replies.sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt))
    );

    const threads = allComments
      .filter(c => c.type === 'comment')
      .map(c => {
        const { type, parentId, ...rest } = c;
        return {
          ...rest,
          replies: (replyMap.get(c.id) || []).map(r => {
            const { type, parentId, ...rRest } = r;
            return rRest;
          }),
        };
      });

    return {
      exportedAt:            new Date().toISOString(),
      videoTitle:            videoTitle || '',
      totalTopLevelComments: threads.length,
      totalReplies,
      totalComments:         allComments.length,
      comments:              threads,
    };
  }

  /* ── Parse an imported JSON object into a threads array ────── */
  function parseImport(data) {
    if (!data || !Array.isArray(data.comments)) {
      throw new Error('Unrecognised JSON format. Expected a file exported by YT Comment Suite.');
    }

    /* Already nested (new format) */
    if (data.comments.length === 0 || data.comments[0]?.replies !== undefined) {
      return { threads: data.comments, meta: data };
    }

    /* Flat (old format) — reconstruct nesting */
    return { threads: buildThreadsFromFlat(data.comments), meta: data };
  }

  /* ── Aggregate one author's activity within the loaded archive ─ */
  function getUserStats(threads, authorName) {
    const comments = [];
    const replies  = [];
    let totalLikes = 0;

    for (const thread of threads) {
      if (thread.author === authorName) {
        comments.push(thread);
        totalLikes += thread.likeCount || 0;
      }
      for (const reply of (thread.replies || [])) {
        if (reply.author === authorName) {
          /* Attach the parent thread as context for modal rendering */
          replies.push({ ...reply, _parentThread: thread });
          totalLikes += reply.likeCount || 0;
        }
      }
    }

    comments.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    replies.sort((a, b)  => new Date(b.publishedAt) - new Date(a.publishedAt));

    return {
      authorName,
      commentCount: comments.length,
      replyCount:   replies.length,
      totalLikes,
      comments,
      replies,
    };
  }

  /* ── Sort a threads array (returns a new array) ────────────── */
  function sortThreads(threads, mode) {
    const copy = [...threads];

    if (mode === 'likes') {
      return copy.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
    }
    if (mode === 'oldest') {
      return copy.sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt));
    }
    /* Default: newest first */
    return copy.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  }

  /* ── Filter threads by a search query ─────────────────────── */
  function filterThreads(threads, query, includeReplies) {
    if (!query) return threads;

    const q = query.toLowerCase();
    return threads.filter(t => {
      const threadMatch = t.text?.toLowerCase().includes(q);
      const replyMatch  = includeReplies && t.replies?.some(r => r.text?.toLowerCase().includes(q));
      return threadMatch || replyMatch;
    });
  }

  /* ── Download helper ────────────────────────────────────────── */
  function downloadBlob(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    /* Clean up object URL after a short delay */
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  /* ── Safe filename prefix from video title ────────────────── */
  function safeFilename(videoTitle) {
    return (videoTitle || 'comments')
      .replace(/[^a-z0-9]/gi, '_')
      .substring(0, 40);
  }

  /* ── Export as JSON ─────────────────────────────────────────── */
  function exportJSON(allComments, videoTitle) {
    const payload = buildNestedExport(allComments, videoTitle);
    downloadBlob(
      JSON.stringify(payload, null, 2),
      `${safeFilename(videoTitle)}_comments.json`,
      'application/json'
    );
    return payload; /* also return for in-memory pass-through */
  }

  /* ── Export as CSV ──────────────────────────────────────────── */
  function exportCSV(allComments, videoTitle) {
    const headers = ['id','type','author','authorChannelId','text','likeCount','replyCount','publishedAt','updatedAt','parentId'];
    const rows    = [headers.join(',')];

    for (const c of allComments) {
      rows.push(
        headers.map(h => {
          const v = String(c[h] ?? '');
          return '"' + v.replace(/"/g, '""').replace(/\n/g, '\\n') + '"';
        }).join(',')
      );
    }

    downloadBlob(rows.join('\n'), `${safeFilename(videoTitle)}_comments.csv`, 'text/csv');
  }

  /* ── Export as plain text ─────────────────────────────────── */
  function exportTXT(allComments, videoTitle) {
    const lines = [
      'YouTube Comment Archive',
      `Video: ${videoTitle || ''}`,
      `Exported: ${new Date().toISOString()}`,
      `Total: ${allComments.length} comments`,
      '',
      '='.repeat(60),
      '',
    ];

    for (const c of allComments) {
      const indent = c.type === 'reply' ? '    ↳ ' : '';
      const date   = new Date(c.publishedAt).toLocaleString();
      lines.push(`${indent}[${c.author}] ${date} | ♥ ${c.likeCount}`);
      lines.push(`${indent}${c.text}`);
      lines.push('');
    }

    downloadBlob(lines.join('\n'), `${safeFilename(videoTitle)}_comments.txt`, 'text/plain');
  }

  /* ── Public API ───────────────────────────────────────────── */
  return {
    parseImport,
    buildNestedExport,
    getUserStats,
    sortThreads,
    filterThreads,
    exportJSON,
    exportCSV,
    exportTXT,
  };

})();
