// Netlify serverless function — powers the "Talk to AI" assistant on your own site.
// Set ANTHROPIC_API_KEY in Netlify (Site configuration → Environment variables).
// Get a key at https://console.anthropic.com

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return { statusCode: 200, body: JSON.stringify({ text: '' }) }; // triggers graceful fallback in the UI
  }

  let system = '', question = '';
  try {
    const body = JSON.parse(event.body || '{}');
    system = body.system || '';
    question = body.question || '';
  } catch (e) {
    return { statusCode: 400, body: 'Bad request' };
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
        model: 'claude-3-5-haiku-latest',
        max_tokens: 400,
        system: system,
        messages: [{ role: 'user', content: question }]
      })
    });

    const data = await resp.json();
    const text = (data && data.content && data.content[0] && data.content[0].text) || '';
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text })
    };
  } catch (err) {
    return { statusCode: 200, body: JSON.stringify({ text: '' }) };
  }
};
