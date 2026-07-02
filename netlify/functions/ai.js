// Netlify serverless function — powers the "Talk to AI" assistant on your own site.
// Set ANTHROPIC_API_KEY in Netlify (Site configuration → Environment variables),
// then trigger a new deploy so the variable loads. Get a key at https://console.anthropic.com
//
// This version auto-discovers a model your account can use (prefers Haiku),
// so you don't have to hard-code a model name. To force a specific one, set
// an env var ANTHROPIC_MODEL (e.g. claude-sonnet-4-5) in Netlify.

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ text: '', error: 'Method not allowed' }) };
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return { statusCode: 200, body: JSON.stringify({ text: '', error: 'ANTHROPIC_API_KEY is not set on the server (add it in Netlify → Environment variables, then redeploy).' }) };
  }
  if (typeof fetch !== 'function') {
    return { statusCode: 200, body: JSON.stringify({ text: '', error: 'This Node runtime has no fetch — set NODE_VERSION = 18 in Netlify.' }) };
  }

  let system = '', question = '';
  try {
    const body = JSON.parse(event.body || '{}');
    system = body.system || '';
    question = body.question || '';
  } catch (e) {
    return { statusCode: 200, body: JSON.stringify({ text: '', error: 'Bad request body' }) };
  }

  const AV = { 'x-api-key': key, 'anthropic-version': '2023-06-01' };

  // 1) Pick a model: env override, else discover from the account (prefer Haiku).
  let model = process.env.ANTHROPIC_MODEL || '';
  if (!model) {
    try {
      const mr = await fetch('https://api.anthropic.com/v1/models?limit=100', { headers: AV });
      const md = await mr.json();
      if (!mr.ok) {
        const msg = (md && md.error && md.error.message) || ('models list HTTP ' + mr.status);
        return { statusCode: 200, body: JSON.stringify({ text: '', error: 'Could not list models: ' + msg }) };
      }
      const ids = ((md && md.data) || []).map(m => m.id);
      model = ids.find(id => /haiku/i.test(id)) ||
              ids.find(id => /sonnet/i.test(id)) ||
              ids[0] || '';
      if (!model) {
        return { statusCode: 200, body: JSON.stringify({ text: '', error: 'Your account returned no available models.' }) };
      }
    } catch (err) {
      return { statusCode: 200, body: JSON.stringify({ text: '', error: 'Model discovery failed: ' + String((err && err.message) || err) }) };
    }
  }

  // 2) Ask the model.
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: Object.assign({ 'content-type': 'application/json' }, AV),
      body: JSON.stringify({
        model: model,
        max_tokens: 400,
        system: system,
        messages: [{ role: 'user', content: question }]
      })
    });
    const data = await resp.json();
    if (!resp.ok) {
      const msg = (data && data.error && data.error.message) || ('Anthropic HTTP ' + resp.status);
      return { statusCode: 200, body: JSON.stringify({ text: '', error: msg + ' (model tried: ' + model + ')' }) };
    }
    const text = (data && data.content && data.content[0] && data.content[0].text) || '';
    return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: text, model: model }) };
  } catch (err) {
    return { statusCode: 200, body: JSON.stringify({ text: '', error: String((err && err.message) || err) }) };
  }
};
