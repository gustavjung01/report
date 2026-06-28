function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (error) { reject(error); }
    });
    req.on('error', reject);
  });
}

function fallbackText(value) {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, message: 'Method not allowed' });
    return;
  }

  try {
    const body = await readBody(req);
    const payload = {
      app: 'Bếp Sỉ Báo Cáo',
      instruction: 'Phân tích dữ liệu sales/thị trường tiếng Việt. Trả về báo cáo ngắn, có tóm tắt điều hành, cơ hội, rủi ro, khách cần xử lý và bước tiếp theo.',
      data: body.data || body
    };

    if (process.env.AI_AGENT_URL) {
      const response = await fetch(process.env.AI_AGENT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.AI_AGENT_TOKEN ? { Authorization: `Bearer ${process.env.AI_AGENT_TOKEN}` } : {})
        },
        body: JSON.stringify(payload)
      });
      const text = await response.text();
      if (!response.ok) throw new Error(text || `AI agent error ${response.status}`);
      try { res.status(200).json({ ok: true, source: 'agent', result: JSON.parse(text) }); }
      catch { res.status(200).json({ ok: true, source: 'agent', result: { report: text } }); }
      return;
    }

    if (process.env.OPENAI_API_KEY) {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL || 'gpt-4.1-mini',
          input: [
            { role: 'system', content: payload.instruction },
            { role: 'user', content: fallbackText(payload.data) }
          ],
          text: { format: { type: 'text' } }
        })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message || `AI error ${response.status}`);
      const report = json.output_text || json.output?.map((item) => item.content?.map((c) => c.text).join('\n')).join('\n') || '';
      res.status(200).json({ ok: true, source: 'openai', result: { report } });
      return;
    }

    res.status(503).json({ ok: false, message: 'AI chưa cấu hình trên Vercel. Cần AI_AGENT_URL hoặc OPENAI_API_KEY.' });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message || 'AI report failed' });
  }
}
