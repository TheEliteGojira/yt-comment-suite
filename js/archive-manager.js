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
  /* meta: { videoTitle, videoPublishedAt, videoChannelTitle, videoChannelId,
             videoThumbnailUrl, videoViewCount, videoLikeCount }             */
  function buildNestedExport(allComments, meta) {
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
      videoId:               meta.videoId            || '',
      videoTitle:            meta.videoTitle         || '',
      videoPublishedAt:      meta.videoPublishedAt   || '',
      videoChannelTitle:     meta.videoChannelTitle  || '',
      videoChannelId:        meta.videoChannelId     || '',
      videoThumbnailUrl:     meta.videoThumbnailUrl  || '',
      videoViewCount:        meta.videoViewCount      || 0,
      videoLikeCount:        meta.videoLikeCount      || 0,
      videoDescription:      meta.videoDescription   || '',
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

  /* ── Aggregate one author's activity within the loaded archive ─
   *
   * authorName — display name shown in the modal header
   * channelId  — optional YouTube channel ID; when provided, comments are
   *              also matched by authorChannelId so that a channel-name
   *              click still works even if the owner has renamed their account.
   */
  function getUserStats(threads, authorName, channelId) {
    const comments = [];
    const replies  = [];
    let totalLikes      = 0;
    let avatarUrl       = '';  /* first profile picture found for this author */
    let authorChannelId = '';  /* used by the modal to link to the YouTube channel */

    for (const thread of threads) {
      const nameMatch    = thread.author === authorName;
      const channelMatch = channelId && thread.authorChannelId === channelId;

      if (nameMatch || channelMatch) {
        comments.push(thread);
        totalLikes += thread.likeCount || 0;
        if (!avatarUrl       && thread.authorAvatar)    avatarUrl       = thread.authorAvatar;
        if (!authorChannelId && thread.authorChannelId) authorChannelId = thread.authorChannelId;
      }

      for (const reply of (thread.replies || [])) {
        const rNameMatch    = reply.author === authorName;
        const rChannelMatch = channelId && reply.authorChannelId === channelId;

        if (rNameMatch || rChannelMatch) {
          /* Attach the parent thread as context for modal rendering */
          replies.push({ ...reply, _parentThread: thread });
          totalLikes += reply.likeCount || 0;
          if (!avatarUrl       && reply.authorAvatar)    avatarUrl       = reply.authorAvatar;
          if (!authorChannelId && reply.authorChannelId) authorChannelId = reply.authorChannelId;
        }
      }
    }

    comments.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    replies.sort((a, b)  => new Date(b.publishedAt) - new Date(a.publishedAt));

    return {
      authorName,
      authorChannelId,
      avatarUrl,
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
      /* Search textOriginal (plain text) to avoid matching HTML tags/attributes */
      const tPlain      = (t.textOriginal || t.text || '').toLowerCase();
      const threadMatch = tPlain.includes(q);
      const replyMatch  = includeReplies && t.replies?.some(r =>
        (r.textOriginal || r.text || '').toLowerCase().includes(q)
      );
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

  /* ── Flatten nested threads back to a mixed flat array ──────── */
  function flattenThreads(threads) {
    const flat = [];
    for (const t of threads) {
      const { replies, ...rest } = t;
      flat.push({ ...rest, type: 'comment', parentId: null });
      for (const r of (replies || [])) {
        flat.push({ ...r, type: 'reply', parentId: t.id });
      }
    }
    return flat;
  }

  /* ── Export filtered (already-nested) threads as JSON ───────── */
  function exportFilteredJSON(threads, meta) {
    const totalReplies = threads.reduce((s, t) => s + (t.replies?.length || 0), 0);
    const payload = {
      exportedAt:            new Date().toISOString(),
      videoId:               meta.videoId            || '',
      videoTitle:            meta.videoTitle         || '',
      videoPublishedAt:      meta.videoPublishedAt   || '',
      videoChannelTitle:     meta.videoChannelTitle  || '',
      videoChannelId:        meta.videoChannelId     || '',
      videoThumbnailUrl:     meta.videoThumbnailUrl  || '',
      videoViewCount:        meta.videoViewCount      || 0,
      videoLikeCount:        meta.videoLikeCount      || 0,
      videoDescription:      meta.videoDescription   || '',
      totalTopLevelComments: threads.length,
      totalReplies,
      totalComments:         threads.length + totalReplies,
      comments:              threads,
    };
    downloadBlob(
      JSON.stringify(payload, null, 2),
      `${safeFilename(meta.videoTitle)}_filtered.json`,
      'application/json'
    );
  }

  /* ── Export as JSON ─────────────────────────────────────────── */
  /* meta: { videoTitle, videoPublishedAt, videoChannelTitle, videoChannelId,
             videoThumbnailUrl, videoViewCount, videoLikeCount }             */
  function exportJSON(allComments, meta) {
    const payload = buildNestedExport(allComments, meta);
    downloadBlob(
      JSON.stringify(payload, null, 2),
      `${safeFilename(meta.videoTitle)}_comments.json`,
      'application/json'
    );
    return payload; /* also return for in-memory pass-through */
  }

  /* ── Export as CSV ──────────────────────────────────────────── */
  function exportCSV(allComments, videoTitle) {
    const headers = ['id','type','author','authorChannelId','authorAvatar','text','likeCount','replyCount','publishedAt','updatedAt','parentId'];
    const rows    = [headers.join(',')];

    for (const c of allComments) {
      rows.push(
        headers.map(h => {
          /* Export plain text, not the HTML textDisplay stored in 'text' */
          const v = h === 'text' ? String(c.textOriginal || c.text || '') : String(c[h] ?? '');
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
      lines.push(`${indent}${c.textOriginal || c.text}`);
      lines.push('');
    }

    downloadBlob(lines.join('\n'), `${safeFilename(videoTitle)}_comments.txt`, 'text/plain');
  }

  /* ── Word frequency counter ─────────────────────────────── */
  /* Returns an array of [word, count] pairs, sorted descending, */
  /* capped at topN. Uses textOriginal to avoid matching HTML.   */
  function getWordFrequency(threads, topN) {
    topN = topN || 30;

    /* Common English stop words plus contraction fragments */
    const STOP = new Set([
      'a','an','the','and','or','but','if','in','on','at','to','for','of',
      'with','by','from','up','as','is','was','are','were','be','been',
      'being','have','has','had','do','does','did','will','would','could',
      'should','may','might','shall','can','not','no','nor','so','yet',
      'both','either','neither','each','few','more','most','other','some',
      'such','than','too','very','just','that','this','these','those',
      'i','you','he','she','it','we','they','me','him','her','us','them',
      'my','your','his','its','our','their','what','which','who','whom',
      'how','when','where','why','all','any','there','then','into','out',
      'about','over','after','back','well','even','still','own','also',
      'only','same','because','through','before','while','get','got',
      'like','know','see','one','two','time','way','day','new','want',
      'make','come','go','said','much','many','here','every','never',
      'always','really','actually','already','now','re','ve','ll','d',
      'm','s','t','dont','cant','wont','didnt','wasnt','isnt','arent',
      'havent','hadnt','shouldnt','wouldnt','couldnt','doesnt',
      'im','ive','ill','id','youre','youve','youll','youd',
      'hes','shes','theyre','theyve','theyll','weve','whos','whats',
      'thats','let','say','think','yeah','yes','okay','ok','lol','omg',
    ]);

    const counts = new Map();

    function tokenize(text) {
      if (!text) return;
      text
        .toLowerCase()
        .replace(/https?:\/\/\S+/g, '')        /* strip URLs */
        .replace(/[^a-z0-9'\-\s]/g, ' ')       /* keep letters, digits, apostrophes, hyphens */
        .split(/\s+/)
        .forEach(w => {
          const clean = w.replace(/^['\-]+|['\-]+$/g, '');  /* trim flanking punctuation */
          if (clean.length < 3 || STOP.has(clean)) return;
          counts.set(clean, (counts.get(clean) || 0) + 1);
        });
    }

    for (const thread of threads) {
      tokenize(thread.textOriginal || thread.text || '');
      for (const r of (thread.replies || [])) {
        tokenize(r.textOriginal || r.text || '');
      }
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN);
  }

  /* ── Merge two thread arrays ─────────────────────────────── */
  /* Deduplicates by thread id — incoming threads whose id already */
  /* exists in the existing set are silently dropped.              */
  function mergeArchives(existingThreads, incomingThreads) {
    const seen = new Set(existingThreads.map(t => t.id));
    const added = incomingThreads.filter(t => !seen.has(t.id));
    return {
      threads:    [...existingThreads, ...added],
      addedCount: added.length,
    };
  }

  /* ── Public API ───────────────────────────────────────────── */
  return {
    parseImport,
    buildNestedExport,
    getUserStats,
    sortThreads,
    filterThreads,
    flattenThreads,
    exportJSON,
    exportCSV,
    exportTXT,
    exportFilteredJSON,
    getWordFrequency,
    mergeArchives,
  };

})();
