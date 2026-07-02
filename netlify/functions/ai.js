// Netlify serverless function — powers the "Talk to AI" assistant on your own site.
// Set ANTHROPIC_API_KEY in Netlify (Site configuration → Environment variables),
// then trigger a new deploy so the variable loads.
// Get a key at https://console.anthropic.com

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ text: '', error: 'Method not allowed' }) };
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return { statusCode: 200, body: JSON.stringify({ text: '', error: 'ANTHROPIC_API_KEY is not set on the server (add it in Netlify → Environment variables, then redeploy).' }) };
  }

  let system = '', question = '';
  try {
    const body = JSON.parse(event.body || '{}');
    system = body.system || '';
    question = body.question || '';
  } catch (e) {
    return { statusCode: 200, body: JSON.stringify({ text: '', error: 'Bad request body' }) };
  }

  if (typeof fetch !== 'function') {
    return { statusCode: 200, body: JSON.stringify({ text: '', error: 'This Node runtime has no fetch — set Node 18+ in Netlify (Environment variable NODE_VERSION = 18).' }) };
  }

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 400,
        system: system,
        messages: [{ role: 'user', content: question }]
      })
    });

    const data = await resp.json();

    if (!resp.ok) {
      const msg = (data && data.error && data.error.message) || ('Anthropic HTTP ' + resp.status);
      return { statusCode: 200, body: JSON.stringify({ text: '', error: msg }) };
    }

    const text = (data && data.content && data.content[0] && data.content[0].text) || '';
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text })
    };
  } catch (err) {
    return { statusCode: 200, body: JSON.stringify({ text: '', error: String((err && err.message) || err) }) };
  }
};
