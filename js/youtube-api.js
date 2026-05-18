/* =============================================================
   youtube-api.js — All communication with the YouTube Data API v3
   Exports: YouTubeAPI object
   ============================================================= */

const YouTubeAPI = (() => {

  /* ── Base URL ─────────────────────────────────────────────── */
  const BASE = 'https://www.googleapis.com/youtube/v3';

  /* ── Build a URL with params ──────────────────────────────── */
  function buildUrl(endpoint, params) {
    const url = new URL(`${BASE}/${endpoint}`);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') url.searchParams.set(k, v);
    });
    return url.toString();
  }

  /* ── Generic fetch with error unwrapping ──────────────────── */
  async function apiFetch(url) {
    const res = await fetch(url);
    const data = await res.json();

    /* Surface quota / auth errors with clear messages */
    if (data.error) {
      const code    = data.error.code;
      const reason  = data.error.errors?.[0]?.reason || '';
      const message = data.error.message || 'Unknown API error';

      if (code === 403 && reason === 'quotaExceeded')
        throw new Error('YouTube API quota exceeded. Your free daily quota (10,000 units) has been used up. Try again after midnight Pacific Time, or use a different API key.');

      if (code === 400 && reason === 'keyInvalid')
        throw new Error('Invalid API key. Please check that you copied it correctly from Google Cloud Console.');

      if (code === 403 && reason === 'forbidden')
        throw new Error('API key is not authorised for the YouTube Data API v3. Make sure you have enabled it in your Google Cloud project.');

      if (code === 404)
        throw new Error('Video not found. It may be private, deleted, or the ID is incorrect.');

      throw new Error(`API error ${code}: ${message}`);
    }

    return data;
  }

  /* ── Fetch video metadata (title, channel, comment count) ─── */
  async function getVideoInfo(videoId, apiKey) {
    /* Request both snippet and statistics — same cost (1 unit), no extra quota */
    const url  = buildUrl('videos', { part: 'snippet,statistics', id: videoId, key: apiKey });
    const data = await apiFetch(url);

    if (!data.items || data.items.length === 0)
      throw new Error('No video found with that ID. It may be private or deleted.');

    const item = data.items[0];
    return {
      id:           videoId,
      title:        item.snippet.title,
      publishedAt:  item.snippet.publishedAt  || '',
      channelTitle: item.snippet.channelTitle || '',
      channelId:    item.snippet.channelId    || '',
      /* commentCount is a string in the API response; 0 means disabled or unavailable */
      commentCount: parseInt(item.statistics?.commentCount || '0', 10),
    };
  }

  /* ── Fetch a channel's profile thumbnail ─────────────────── */
  async function getChannelThumbnail(channelId, apiKey) {
    const url  = buildUrl('channels', { part: 'snippet', id: channelId, key: apiKey });
    const data = await apiFetch(url);
    const thumbnails = data.items?.[0]?.snippet?.thumbnails;
    return thumbnails?.medium?.url || thumbnails?.default?.url || '';
  }

  /* ── Fetch one page of top-level comment threads ──────────── */
  async function getCommentThreadPage(videoId, apiKey, order, pageToken) {
    const url = buildUrl('commentThreads', {
      part:       'snippet,replies',
      videoId,
      maxResults: 100,
      order,      /* 'time' | 'relevance' */
      key:        apiKey,
      pageToken,
    });
    return apiFetch(url);
  }

  /* ── Fetch all replies for a single parent comment ────────── */
  async function getAllReplies(parentId, apiKey, onReply, stopCheck) {
    let pageToken = '';

    do {
      if (stopCheck()) break;

      const url  = buildUrl('comments', {
        part:       'snippet',
        parentId,
        maxResults: 100,
        key:        apiKey,
        pageToken,
      });

      const data = await apiFetch(url);

      for (const item of (data.items || [])) {
        if (stopCheck()) break;
        onReply(parseReply(item, parentId));
      }

      pageToken = data.nextPageToken || '';
    } while (pageToken && !stopCheck());
  }

  /* ── Parse a raw API thread into a clean comment object ───── */
  function parseThread(thread) {
    const s = thread.snippet.topLevelComment.snippet;
    return {
      id:              thread.snippet.topLevelComment.id,
      type:            'comment',
      author:          s.authorDisplayName,
      authorChannelId: s.authorChannelId?.value || '',
      authorAvatar:    s.authorProfileImageUrl  || '',
      text:            s.textOriginal || s.textDisplay || '',
      likeCount:       s.likeCount   || 0,
      publishedAt:     s.publishedAt,
      updatedAt:       s.updatedAt,
      replyCount:      thread.snippet.totalReplyCount || 0,
      parentId:        null,
      /* Inline replies (up to 5) come with the thread */
      _inlineReplies:  thread.replies?.comments || [],
      _totalReplies:   thread.snippet.totalReplyCount || 0,
    };
  }

  /* ── Parse a raw API reply ────────────────────────────────── */
  function parseReply(item, parentId) {
    const s = item.snippet;
    return {
      id:              item.id,
      type:            'reply',
      author:          s.authorDisplayName,
      authorChannelId: s.authorChannelId?.value || '',
      authorAvatar:    s.authorProfileImageUrl  || '',
      text:            s.textOriginal || s.textDisplay || '',
      likeCount:       s.likeCount   || 0,
      publishedAt:     s.publishedAt,
      updatedAt:       s.updatedAt,
      replyCount:      0,
      parentId,
    };
  }

  /* ── Parse inline replies from a thread (up to 5) ─────────── */
  function parseInlineReplies(rawReplies, parentId) {
    return rawReplies
      .map(r => parseReply(r, parentId))
      .sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt));
  }

  /* ── Public API ───────────────────────────────────────────── */
  return {
    getVideoInfo,
    getChannelThumbnail,
    getCommentThreadPage,
    getAllReplies,
    parseThread,
    parseInlineReplies,
    parseReply,
  };

})();
