export const config = {
  maxDuration: 60
};

function safeJsonParse(value = '') {
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return safeJsonParse(req.body) || {};
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return safeJsonParse(Buffer.concat(chunks).toString('utf8')) || {};
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 55000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function fallbackResult(reason = 'Agent Platform chưa trả kết quả.') {
  return {
    summary: reason,
    market_insights: [],
    product_insights: [],
    customer_actions: [],
    sample_requests: [],
    follow_up_list: [],
    order_opportunities: [],
    risks: [reason],
    next_steps: ['Kiểm tra AI_AGENT_URL trong Vercel Production env và log Cloud Run / Vercel Function.']
  };
}

function normalizeResult(result) {
  if (!result) return fallbackResult('Agent không trả result.');
  if (typeof result === 'string') return fallbackResult(result);
  return {
    summary: String(result?.summary || result?.answer || result?.text || ''),
    market_insights: Array.isArray(result?.market_insights) ? result.market_insights : [],
    product_insights: Array.isArray(result?.product_insights) ? result.product_insights : [],
    customer_actions: Array.isArray(result?.customer_actions) ? result.customer_actions : [],
    sample_requests: Array.isArray(result?.sample_requests) ? result.sample_requests : [],
    follow_up_list: Array.isArray(result?.follow_up_list) ? result.follow_up_list : [],
    order_opportunities: Array.isArray(result?.order_opportunities) ? result.order_opportunities : [],
    risks: Array.isArray(result?.risks) ? result.risks : [],
    next_steps: Array.isArray(result?.next_steps) ? result.next_steps : []
  };
}

function extractResult(payload = {}) {
  if (payload.result) return payload.result;
  if (payload.output) return payload.output;
  if (payload.analysis) return payload.analysis;
  if (payload.response) return payload.response;
  if (payload.answer) return payload.answer;
  if (payload.candidates?.[0]?.content?.parts?.[0]?.text) return safeJsonParse(payload.candidates[0].content.parts[0].text) || { summary: payload.candidates[0].content.parts[0].text };
  if (payload.content) {
    if (typeof payload.content === 'string') return safeJsonParse(payload.content) || { summary: payload.content };
    return payload.content;
  }
  return payload;
}

function buildSelectedInput(body = {}) {
  const snapshot = body.snapshot || body.data || body.input || {};
  const reportType = body.report_type || snapshot.report_type || 'smart_report';
  const selectedItems = Array.isArray(body.selected_items)
    ? body.selected_items
    : (Array.isArray(snapshot.selected_items) ? snapshot.selected_items : []);
  return {
    selected_only: true,
    report_type: reportType,
    selected_items: selectedItems,
    snapshot: {
      ...snapshot,
      report_type: reportType,
      selected_items: selectedItems,
      selected_only: true
    }
  };
}

function buildPrompt(input) {
  return `Bạn là Bépi Report Analyst. Chỉ phân tích dữ liệu người dùng đã chọn trong selected_items/snapshot. Không tự suy luận thêm dữ liệu ngoài phạm vi đã chọn. Chỉ trả JSON hợp lệ với các key: summary, market_insights, product_insights, customer_actions, sample_requests, follow_up_list, order_opportunities, risks, next_steps. Không markdown. Không bịa dữ liệu.\n\nDATA:\n${JSON.stringify(input || {}, null, 2).slice(0, 36000)}`;
}

async function callJson(url, body, apiKey) {
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify(body)
  }, 18000);
  const text = await response.text();
  return { ok: response.ok, status: response.status, text, json: safeJsonParse(text) || { content: text } };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  const body = await readBody(req);
  const selectedInput = buildSelectedInput(body);

  const directUrl = process.env.AI_AGENT_URL || process.env.ADK_AGENT_URL || '';
  if (directUrl) {
    try {
      const token = process.env.AI_AGENT_TOKEN || process.env.ADK_AGENT_TOKEN || '';
      const headers = { 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetchWithTimeout(directUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          input: selectedInput,
          snapshot: selectedInput.snapshot,
          report_type: selectedInput.report_type,
          selected_items: selectedInput.selected_items,
          selected_only: true,
          task: 'selected_report_analysis'
        })
      }, 55000);
      const text = await response.text();
      const json = safeJsonParse(text) || { content: text };
      const result = normalizeResult(extractResult(json));
      res.status(200).json({
        ok: response.ok && json.ok !== false,
        source: 'ai_agent_url',
        status: response.status,
        result,
        raw: json,
        directUrlConfigured: true,
        selectedOnly: true
      });
      return;
    } catch (error) {
      const reason = error?.name === 'AbortError'
        ? 'Proxy Vercel gọi Cloud Run quá lâu hoặc bị timeout.'
        : (error?.message || 'AI_AGENT_URL failed');
      res.status(200).json({
        ok: false,
        source: 'ai_agent_url_exception',
        error: reason,
        directUrlConfigured: true,
        selectedOnly: true,
        result: fallbackResult(reason)
      });
      return;
    }
  }

  const apiKey = process.env.AGENT_BUILDER_API_KEY || process.env.AGENT_PLATFORM_API_KEY || '';
  const projectId = process.env.AGENT_BUILDER_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || '';
  const agentId = process.env.AGENT_BUILDER_AGENT_ID || process.env.AGENT_PLATFORM_AGENT_ID || '';
  if (!apiKey || !projectId || !agentId) {
    res.status(200).json({
      ok: false,
      source: 'missing_agent_platform_env',
      configState: { hasApiKey: Boolean(apiKey), hasProjectId: Boolean(projectId), hasAgentId: Boolean(agentId), hasAiAgentUrl: Boolean(directUrl) },
      selectedOnly: true,
      result: fallbackResult('Thiếu AI_AGENT_URL trong Vercel Production env. Giá trị đúng: https://report-agent-375343885071.asia-southeast1.run.app/analyze')
    });
    return;
  }

  const location = process.env.AGENT_BUILDER_LOCATION || 'global';
  const prompt = buildPrompt(selectedInput);

  const candidates = [
    {
      source: 'agent_platform_agents_run',
      url: `https://agentplatform.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}/agents/${encodeURIComponent(agentId)}:run?key=${encodeURIComponent(apiKey)}`,
      body: { input: { text: prompt } }
    },
    {
      source: 'agent_platform_agents_generate',
      url: `https://agentplatform.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}/agents/${encodeURIComponent(agentId)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      body: { contents: [{ role: 'user', parts: [{ text: prompt }] }] }
    },
    {
      source: 'aiplatform_reasoning_engine_query',
      url: `https://${encodeURIComponent(location)}-aiplatform.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}/reasoningEngines/${encodeURIComponent(agentId)}:query?key=${encodeURIComponent(apiKey)}`,
      body: { input: { text: prompt } }
    }
  ];

  const attempts = [];
  for (const candidate of candidates) {
    try {
      const attempt = await callJson(candidate.url, candidate.body, apiKey);
      attempts.push({ source: candidate.source, status: attempt.status, ok: attempt.ok, raw: attempt.json });
      if (attempt.ok) {
        const result = normalizeResult(extractResult(attempt.json));
        res.status(200).json({ ok: true, source: candidate.source, status: attempt.status, result, raw: attempt.json, attempts, selectedOnly: true });
        return;
      }
    } catch (error) {
      attempts.push({ source: candidate.source, ok: false, error: error?.message || 'request failed' });
    }
  }

  res.status(200).json({
    ok: false,
    source: 'agent_platform_candidates_failed',
    configState: { projectId, agentId, location, hasApiKey: true, hasAiAgentUrl: false },
    attempts,
    selectedOnly: true,
    result: fallbackResult('Chưa có AI_AGENT_URL nên proxy rơi về endpoint Agent Platform cũ và fail. Set AI_AGENT_URL trong Vercel Production env.')
  });
}
