// netlify/functions/find-show-poster-deep.js
//
// Steps 2 and 3 of the poster-art waterfall: the band's official website,
// then Reddit setlist threads. Both involve a web fetch plus a Claude
// judgment call, so unlike find-show-poster.js (step 1, cheap + automatic)
// this function is only ever invoked from an explicit user action — never
// automatically on page render. Called at most once per show unless the
// user explicitly retries.

const https = require('https');
const { URL } = require('url');

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
const MB_USER_AGENT = 'MySetlistsApp/1.0 (show-tracker; contact@mysetlists.net)';
const REDDIT_USER_AGENT = 'MySetlistsApp/1.0 (show-tracker poster lookup; contact@mysetlists.net)';
const PAGE_FETCH_TIMEOUT_MS = 8000;
const MAX_PAGE_BYTES = 500 * 1024;
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
const POSTER_LOOKBACK_YEARS = 5;

// Artist name (lowercase) → dedicated subreddit slug.
const ARTIST_SUBREDDITS = {
  'goose': 'GoosetheBand',
  'phish': 'phish',
  'grateful dead': 'gratefuldead',
  'dead & company': 'deadandcompany',
  'dead and company': 'deadandcompany',
  'widespread panic': 'widespreadpanic',
  'billy strings': 'billystrings',
};

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// Accepts DD-MM-YYYY or YYYY-MM-DD, always returns YYYY-MM-DD.
function normalizeDate(date) {
  if (!date) return date;
  const ddmmyyyy = date.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
  return date;
}

// Returns false for shows older than POSTER_LOOKBACK_YEARS — poster art is
// almost never findable for distant-past shows, so skip them cheaply.
function isRecentEnough(date) {
  if (!date) return false;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - POSTER_LOOKBACK_YEARS);
  return new Date(date) >= cutoff;
}

function httpsGetJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { Accept: 'application/json', ...headers } }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve({ statusCode: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

// Fetches raw text (HTML) with a timeout and a byte cap so a slow or huge
// page can't stall the function or blow the response size.
function httpsGetText(url, headers = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (val) => { if (!settled) { settled = true; resolve(val); } };
    try {
      const req = https.get(url, {
        headers: { 'User-Agent': MB_USER_AGENT, Accept: 'text/html,*/*', ...headers },
        timeout: PAGE_FETCH_TIMEOUT_MS,
      }, (res) => {
        if (res.statusCode >= 400) { res.resume(); return finish(null); }
        let data = '';
        let bytes = 0;
        res.on('data', (chunk) => {
          bytes += chunk.length;
          if (bytes > MAX_PAGE_BYTES) { req.destroy(); return finish(data); }
          data += chunk;
        });
        res.on('end', () => finish(data));
      });
      req.on('timeout', () => { req.destroy(); finish(null); });
      req.on('error', () => finish(null));
    } catch {
      finish(null);
    }
  });
}

function makeAnthropicRequest(apiKey, requestBody) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(requestBody);
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve({ statusCode: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { reject(new Error('Failed to parse Anthropic response')); }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

// --- robots.txt (best-effort, fail-open) ------------------------------------

async function isPathAllowed(pageUrl) {
  try {
    const u = new URL(pageUrl);
    const robotsUrl = `${u.protocol}//${u.host}/robots.txt`;
    const text = await httpsGetText(robotsUrl, { 'User-Agent': MB_USER_AGENT });
    if (!text) return true; // unreachable/missing robots.txt — fail open

    const lines = text.split('\n').map((l) => l.trim());
    let applies = false;
    const disallows = [];
    for (const line of lines) {
      const [rawKey, ...rest] = line.split(':');
      if (!rawKey) continue;
      const key = rawKey.trim().toLowerCase();
      const value = rest.join(':').trim();
      if (key === 'user-agent') {
        applies = value === '*';
      } else if (applies && key === 'disallow' && value) {
        disallows.push(value);
      }
    }
    return !disallows.some((d) => u.pathname.startsWith(d));
  } catch {
    return true;
  }
}

// --- HTML extraction (regex-based — no DOM parser dependency) --------------

function resolveUrl(maybeRelative, baseUrl) {
  try { return new URL(maybeRelative, baseUrl).href; } catch { return null; }
}

function extractCandidateImages(html, baseUrl) {
  const candidates = [];
  const imgRegex = /<img\b[^>]*>/gi;
  const matches = html.match(imgRegex) || [];
  for (const tag of matches) {
    const srcMatch = tag.match(/\bsrc=["']([^"']+)["']/i) || tag.match(/\bdata-src=["']([^"']+)["']/i);
    if (!srcMatch) continue;
    const src = resolveUrl(srcMatch[1], baseUrl);
    if (!src || !/^https?:\/\//i.test(src)) continue;
    // Skip obvious non-poster assets
    if (/\.(svg)(\?|$)/i.test(src)) continue;
    if (/icon|sprite|logo-small|favicon|pixel\.gif|spacer\./i.test(src)) continue;

    const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
    candidates.push({ src, alt: altMatch ? altMatch[1] : '' });
    if (candidates.length >= 15) break;
  }
  // De-dupe by src
  const seen = new Set();
  return candidates.filter((c) => (seen.has(c.src) ? false : (seen.add(c.src), true)));
}

function extractVisibleTextSnippet(html, maxLen = 1500) {
  const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const text = withoutScripts.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.slice(0, maxLen);
}

function findRelevantSubpageLink(html, baseUrl) {
  const linkRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  const base = new URL(baseUrl);
  while ((m = linkRegex.exec(html)) !== null) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, ' ').trim();
    if (/tour|shows|dates|live|events/i.test(href) || /tour|shows|dates|live dates|events/i.test(text)) {
      const resolved = resolveUrl(href, baseUrl);
      if (!resolved) continue;
      try {
        const u = new URL(resolved);
        if (u.host === base.host) return resolved; // stay on the same site
      } catch { /* skip */ }
    }
  }
  return null;
}

// --- Step 2: band's official website ----------------------------------------

async function getArtistHomepage(artist) {
  try {
    const searchUrl = `https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(artist)}&limit=5&fmt=json`;
    const searchRes = await httpsGetJson(searchUrl, { 'User-Agent': MB_USER_AGENT });
    const artists = searchRes.body?.artists || [];
    if (!artists.length) return null;
    const normalized = artist.trim().toLowerCase();
    const match = artists.find((a) => a.name.toLowerCase() === normalized) || artists[0];

    await sleep(1100); // MusicBrainz rate limit: ~1 req/sec

    const lookupUrl = `https://musicbrainz.org/ws/2/artist/${match.id}?inc=url-rels&fmt=json`;
    const lookupRes = await httpsGetJson(lookupUrl, { 'User-Agent': MB_USER_AGENT });
    const relations = lookupRes.body?.relations || [];
    const homepage = relations.find((r) => r.type === 'official homepage' && r.url?.resource);
    return homepage?.url?.resource || null;
  } catch {
    return null;
  }
}

async function searchBandWebsite(show) {
  const homepage = await getArtistHomepage(show.artist);
  if (!homepage) return null;
  if (!(await isPathAllowed(homepage))) return null;

  const html = await httpsGetText(homepage);
  if (!html) return null;

  let candidates = extractCandidateImages(html, homepage);
  let text = extractVisibleTextSnippet(html);

  // Follow one hop to a tour/shows subpage if it exists — poster art is more
  // often there than on the homepage itself.
  const subLink = findRelevantSubpageLink(html, homepage);
  if (subLink && (await isPathAllowed(subLink))) {
    const subHtml = await httpsGetText(subLink);
    if (subHtml) {
      candidates = [...candidates, ...extractCandidateImages(subHtml, subLink)].slice(0, 20);
      text = `${text}\n${extractVisibleTextSnippet(subHtml)}`.slice(0, 3000);
    }
  }

  if (!candidates.length) return null;

  const posterUrl = await judgeCandidatesWithClaude({ show, candidates, contextText: text, sourceLabel: "the band's official website" });
  if (!posterUrl) return null;

  return { posterUrl, posterSourceUrl: homepage, posterSource: 'bandsite' };
}

// --- Step 3: Reddit setlist threads ------------------------------------------

function extractRedditImageCandidates(post) {
  const candidates = [];
  const data = post.data || {};

  if (data.url_overridden_by_dest && /\.(jpg|jpeg|png|webp)(\?|$)/i.test(data.url_overridden_by_dest)) {
    candidates.push({ src: data.url_overridden_by_dest, alt: data.title || '' });
  }
  const previewImgs = data.preview?.images || [];
  for (const img of previewImgs) {
    const src = img.source?.url;
    if (src) candidates.push({ src: src.replace(/&amp;/g, '&'), alt: data.title || '' });
  }
  if (data.is_gallery && data.media_metadata) {
    for (const key of Object.keys(data.media_metadata)) {
      const item = data.media_metadata[key];
      const src = item?.s?.u || item?.s?.gif;
      if (src) candidates.push({ src: src.replace(/&amp;/g, '&'), alt: data.title || '' });
    }
  }
  return candidates;
}

async function searchReddit(show) {
  const normalizedArtist = show.artist.trim().toLowerCase();
  const subreddit = ARTIST_SUBREDDITS[normalizedArtist];
  const query = subreddit
    ? `${show.venue || ''} setlist ${show.date || ''}`.trim()
    : `${show.artist} ${show.venue || ''} setlist`.trim();
  const url = subreddit
    ? `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&sort=relevance&limit=10&restrict_sr=1`
    : `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=relevance&limit=10`;

  let body;
  try {
    const res = await httpsGetJson(url, { 'User-Agent': REDDIT_USER_AGENT });
    body = res.body;
  } catch {
    return null;
  }

  const posts = body?.data?.children || [];
  // For subreddit-scoped searches every post is already about the right artist;
  // for global searches filter by artist name in the title.
  const relevant = (subreddit
    ? posts
    : posts.filter((p) => (p.data?.title || '').toLowerCase().includes(normalizedArtist))
  ).slice(0, 6);
  if (!relevant.length) return null;

  const candidates = [];
  const threadContext = [];
  for (const post of relevant) {
    const imgs = extractRedditImageCandidates(post);
    candidates.push(...imgs);
    threadContext.push(`Title: "${post.data.title}" (r/${post.data.subreddit}) — ${post.data.selftext ? post.data.selftext.slice(0, 300) : '(no text body)'}`);
  }
  if (!candidates.length) return null;

  const dedupedCandidates = candidates.filter((c, i, arr) => arr.findIndex((x) => x.src === c.src) === i).slice(0, 15);

  const posterUrl = await judgeCandidatesWithClaude({
    show,
    candidates: dedupedCandidates,
    contextText: threadContext.join('\n'),
    sourceLabel: 'a Reddit setlist thread',
  });
  if (!posterUrl) return null;

  const matchingPost = relevant.find((p) => extractRedditImageCandidates(p).some((c) => c.src === posterUrl));
  const posterSourceUrl = matchingPost ? `https://www.reddit.com${matchingPost.data.permalink}` : null;

  return { posterUrl, posterSourceUrl, posterSource: 'reddit' };
}

// --- Claude judgment (shared by both sources) --------------------------------

async function judgeCandidatesWithClaude({ show, candidates, contextText, sourceLabel }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !candidates.length) return null;

  const candidateList = candidates
    .map((c, i) => `${i + 1}. ${c.src}${c.alt ? ` (alt text: "${c.alt}")` : ''}`)
    .join('\n');

  const prompt = `I'm trying to find concert poster or tour artwork for a specific show, using ${sourceLabel}.

Show details:
- Artist: ${show.artist}
- Venue: ${show.venue || 'unknown'}
- Date: ${show.date}
${show.tour ? `- Tour: ${show.tour}` : ''}

Page/thread context:
${contextText.slice(0, 2000)}

Candidate images found on the page:
${candidateList}

Which candidate (if any) is most likely to be actual concert poster or tour artwork for THIS specific show or tour — not a band logo, a fan photo, a crowd shot, a ticket stub, an unrelated banner ad, or an icon? Only pick one if you're reasonably confident based on the URL, alt text, and surrounding context. It's fine and expected to find nothing.

Respond with ONLY a JSON object, no other text: {"posterUrl": "<the exact URL from the list, or null>"}`;

  try {
    const res = await makeAnthropicRequest(apiKey, {
      model: CLAUDE_MODEL,
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });
    const textOut = res.body?.content?.[0]?.text || '';
    const jsonMatch = textOut.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed?.posterUrl && candidates.some((c) => c.src === parsed.posterUrl)) {
      return parsed.posterUrl;
    }
    return null;
  } catch {
    return null;
  }
}

// --- Handler -----------------------------------------------------------------

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
      body: '',
    };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { artist, venue, tour } = event.queryStringParameters || {};
  const date = normalizeDate(event.queryStringParameters?.date);
  if (!artist || !date) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'artist and date are required' }) };
  }
  if (!isRecentEnough(date)) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ found: false }) };
  }

  const show = { artist, venue, date, tour };

  try {
    let result = await searchBandWebsite(show);
    if (!result) result = await searchReddit(show);

    if (!result) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ found: false }) };
    }
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ found: true, ...result }) };
  } catch (err) {
    console.error('find-show-poster-deep error:', err);
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ found: false }) };
  }
};
