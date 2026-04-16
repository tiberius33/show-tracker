const https = require('https');

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
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          reject(new Error('Failed to parse Anthropic response'));
        }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function buildShowHistoryContext(userShows, artistName) {
  if (!userShows || userShows.length === 0) {
    return `The user has not seen ${artistName} live yet.`;
  }

  const sorted = [...userShows].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const lines = [`The user has seen ${artistName} ${userShows.length} time(s) live:`];

  for (const show of sorted) {
    const venue = show.venue || 'Unknown venue';
    const city = show.city ? `, ${show.city}` : '';
    lines.push(`- ${show.date || 'Unknown date'}: ${venue}${city}`);
    if (show.setlist && show.setlist.length > 0) {
      const songs = show.setlist.map(s => (typeof s === 'string' ? s : s.name)).filter(Boolean);
      if (songs.length > 0) lines.push(`  Setlist: ${songs.join(', ')}`);
    }
  }

  // Aggregate songs the user has seen
  const songCounts = {};
  for (const show of userShows) {
    for (const song of (show.setlist || [])) {
      const name = typeof song === 'string' ? song : song.name;
      if (name) songCounts[name] = (songCounts[name] || 0) + 1;
    }
  }
  const topSongs = Object.entries(songCounts).sort((a, b) => b[1] - a[1]).slice(0, 25);
  if (topSongs.length > 0) {
    lines.push(`\nSongs the user has personally seen performed (with frequency):`);
    for (const [name, count] of topSongs) {
      lines.push(`- "${name}": ${count} time(s)`);
    }
  }

  return lines.join('\n');
}

// Tool: check if user has seen a specific song
function checkUserHistory(userShows, songName) {
  if (!userShows || userShows.length === 0) {
    return { seen: false, times: 0, message: "User has no show history for this artist." };
  }
  const lower = songName.toLowerCase();
  const occurrences = [];
  for (const show of userShows) {
    for (const song of (show.setlist || [])) {
      const name = typeof song === 'string' ? song : song.name;
      if (name && name.toLowerCase().includes(lower)) {
        occurrences.push({ date: show.date, venue: show.venue, city: show.city || '', songName: name });
      }
    }
  }
  if (occurrences.length === 0) {
    return { seen: false, times: 0, message: `No record of "${songName}" in the user's show history.` };
  }
  return {
    seen: true,
    times: occurrences.length,
    occurrences: occurrences.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  };
}

// Tool: get songs user has seen most
function getUserTopSongs(userShows) {
  if (!userShows || userShows.length === 0) {
    return { songs: [], totalShows: 0 };
  }
  const songCounts = {};
  for (const show of userShows) {
    for (const song of (show.setlist || [])) {
      const name = typeof song === 'string' ? song : song.name;
      if (name) songCounts[name] = (songCounts[name] || 0) + 1;
    }
  }
  const songs = Object.entries(songCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, count]) => ({ name, count }));
  return { songs, totalShows: userShows.length };
}

const TOOLS = [
  {
    name: 'check_user_history',
    description: 'Check whether the user has personally seen a specific song performed live. Returns dates, venues, and how many times they saw it.',
    input_schema: {
      type: 'object',
      properties: {
        song_name: { type: 'string', description: 'Name of the song to look up' }
      },
      required: ['song_name']
    }
  },
  {
    name: 'get_user_top_songs',
    description: "Get the songs the user has seen most often across all their shows with this artist.",
    input_schema: { type: 'object', properties: {}, required: [] }
  }
];

exports.handler = async function(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured.' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { artistName, userQuestion, conversationHistory = [], userShows = [] } = body;

  if (!artistName || !userQuestion) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'artistName and userQuestion are required' }) };
  }

  const showContext = buildShowHistoryContext(userShows, artistName);

  const systemPrompt = `You are an enthusiastic music assistant specializing in ${artistName}. You help fans explore the artist's concert history and their own personal show experiences.

${showContext}

GUIDELINES:
- Be conversational, warm, and concise (2-4 sentences)
- Use the user's personal show history when answering questions about what they've seen
- For questions about the artist's overall history or statistics, draw on your training knowledge
- Reference specific dates, venues, and songs when you have the data
- If you lack specific data, say so honestly rather than guessing numbers
- Use tools to look up the user's show history when relevant`;

  // Keep last 8 messages for context
  const messages = [
    ...conversationHistory.slice(-8),
    { role: 'user', content: userQuestion }
  ];

  try {
    // Initial API call
    let response = await makeAnthropicRequest(apiKey, {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: systemPrompt,
      tools: TOOLS,
      messages
    });

    if (response.statusCode !== 200) {
      return { statusCode: response.statusCode, headers, body: JSON.stringify({ error: 'AI service error', details: response.body }) };
    }

    let apiResponse = response.body;

    // Handle tool use (one round)
    if (apiResponse.stop_reason === 'tool_use') {
      const toolUseBlocks = apiResponse.content.filter(c => c.type === 'tool_use');
      const toolResults = toolUseBlocks.map(toolUse => {
        let result;
        if (toolUse.name === 'check_user_history') {
          result = checkUserHistory(userShows, toolUse.input.song_name);
        } else if (toolUse.name === 'get_user_top_songs') {
          result = getUserTopSongs(userShows);
        } else {
          result = { error: 'Unknown tool' };
        }
        return { type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(result) };
      });

      const followUpMessages = [
        ...messages,
        { role: 'assistant', content: apiResponse.content },
        { role: 'user', content: toolResults }
      ];

      response = await makeAnthropicRequest(apiKey, {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: systemPrompt,
        tools: TOOLS,
        messages: followUpMessages
      });

      if (response.statusCode !== 200) {
        return { statusCode: response.statusCode, headers, body: JSON.stringify({ error: 'AI service error', details: response.body }) };
      }

      apiResponse = response.body;
    }

    const answer = apiResponse.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('');

    return { statusCode: 200, headers, body: JSON.stringify({ answer }) };

  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Request failed', details: error.message }) };
  }
};
