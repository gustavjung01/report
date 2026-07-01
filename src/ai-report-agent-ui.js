import { makeAiSummary, todayIsoDate } from '../data-model.js';
import { LOCAL_STORES, openLocalDb, getAllLocal, putLocal } from '../local-db.js';

const $ = (selector, root = document) => root.querySelector(selector);
const esc = (value = '') => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const clean = (value = '') => String(value ?? '').replace(/\s+/g, ' ').trim();
const safeJsonParse = (value = '') => {
  try { return JSON.parse(value); } catch (_error) { return null; }
};

function addCss() {
  let style = $('style[data-ai-report-agent-ui]');
  if (!style) {
    style = document.createElement('style');
    style.dataset.aiReportAgentUi = '1';
    document.head.appendChild(style);
  }
  style.textContent = `
    .ai-result-panel{display:grid!important;gap:10px!important;align-content:start!important}
    .ai-run-state{border:1px solid #bfe9dc!important;border-radius:15px!important;background:#f0fbf7!important;padding:10px!important;color:#075f52!important;display:grid!important;gap:4px!important}
    .ai-run-state b{font-size:14px!important;line-height:1.2!important}.ai-run-state small{font-size:11px!important;color:#63727c!important;line-height:1.25!important}
    .ai-result-card{border:1px solid #dce8e5!important;border-radius:15px!important;background:#fff!important;padding:10px!important;display:grid!important;gap:7px!important;box-shadow:0 7px 16px rgba(12,55,50,.045)!important}
    .ai-result-card h3{margin:0!important;font-size:14px!important;line-height:1.18!important;color:#082337!important}.ai-result-card p{margin:0!important;color:#41545d!important;font-size:12px!important;line-height:1.4!important;white-space:pre-wrap!important}
    .ai-result-list{display:grid!important;gap:6px!important;margin:0!important;padding:0!important;list-style:none!important}.ai-result-list li{border:1px dashed #dce8e5!important;border-radius:12px!important;background:#fbfffd!important;padding:8px!important;font-size:12px!important;line-height:1.35!important;color:#17343d!important}
    .ai-debug-box{width:100%!important;min-height:120px!important;border:1px solid #f2c4bd!important;border-radius:12px!important;background:#fff7f5!important;color:#5f2a24!important;padding:8px!important;font:12px/1.35 ui-monospace,SFMono-Regular,Consolas,monospace!important;white-space:pre-wrap!important;overflow:auto!important}
    #modal[data-type="ai-summary"]{width:min(560px,calc(100vw - 12px))!important;max-height:calc(100dvh - 12px)!important;overflow:hidden!important;padding:0!important;border-radius:20px!important}
    #modal[data-type="ai-summary"]::backdrop{background:rgba(8,35,55,.38)!important}
    #modal[data-type="ai-summary"] .modal{height:min(820px,calc(100dvh - 12px))!important;max-height:calc(100dvh - 12px)!important;display:grid!important;grid-template-rows:auto minmax(0,1fr)!important;gap:10px!important;padding:14px!important;overflow:hidden!important;box-sizing:border-box!important;background:#fbfffd!important}
    #modal[data-type="ai-summary"] header{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;min-width:0!important}
    #modal[data-type="ai-summary"] header h2{margin:0!important;font-size:18px!important;line-height:1.15!important;color:#082337!important}
    #modal[data-type="ai-summary"] header button{border:1px solid #dce8e5!important;background:#fff!important;color:#007866!important;border-radius:999px!important;min-height:34px!important;padding:0 12px!important;font-weight:900!important}
    .ai-summary-form{min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;display:grid!important;gap:10px!important;align-content:start!important;padding-right:2px!important}
    .ai-summary-form label{display:grid!important;gap:5px!important;margin:0!important;min-width:0!important}.ai-summary-form label span{font-size:12px!important;font-weight:950!important;color:#425863!important}
    .ai-summary-form input{width:100%!important;border:1px solid #cad7d4!important;border-radius:12px!important;min-height:40px!important;padding:0 10px!important;background:#fff!important;color:#082337!important;box-sizing:border-box!important}
    .ai-summary-form textarea{width:100%!important;min-height:48dvh!important;max-height:none!important;border:1px solid #cad7d4!important;border-radius:14px!important;padding:10px!important;background:#fff!important;color:#082337!important;box-sizing:border-box!important;font-size:14px!important;line-height:1.45!important;resize:vertical!important;white-space:pre-wrap!important}
    .ai-summary-form small{display:block!important;color:#63727c!important;font-size:12px!important;line-height:1.35!important;background:#eefbf6!important;border:1px solid #dce8e5!important;border-radius:12px!important;padding:8px!important}
    .ai-summary-modal-actions{position:sticky!important;bottom:0!important;background:#fbfffd!important;display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;padding-top:6px!important}.ai-summary-modal-actions button{min-height:42px!important;border-radius:12px!important;font-weight:950!important}
  `;
}

function toast(message) {
  const element = $('#toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2600);
}

function closeModal() {
  const modal = $('#modal');
  if (modal?.open) modal.close();
  if (modal) modal.dataset.type = '';
}

function activeRow(row = {}) {
  return row.status !== 'deleted' && !row.deleted_at && !row.raw_payload?.deleted_at;
}

async function snapshot() {
  await openLocalDb();
  const [orders, orderItems, tests, reports, mcpSessions] = await Promise.all([
    getAllLocal(LOCAL_STORES.orders),
    getAllLocal(LOCAL_STORES.orderItems),
    getAllLocal(LOCAL_STORES.onaTests),
    getAllLocal(LOCAL_STORES.marketReports),
    getAllLocal(LOCAL_STORES.mcpRouteSessions)
  ]);
  const today = todayIsoDate();
  return {
    today,
    orders: orders.filter(activeRow).slice(-80),
    order_items: orderItems.filter(activeRow).slice(-160),
    tests: tests.filter(activeRow).slice(-120),
    market_reports: reports.filter(activeRow).slice(-160),
    mcp_sessions: mcpSessions.filter(activeRow).slice(-80),
    metrics: {
      orders: orders.filter(activeRow).length,
      order_items: orderItems.filter(activeRow).length,
      tests: tests.filter(activeRow).length,
      market_reports: reports.filter(activeRow).length,
      mcp_sessions: mcpSessions.filter(activeRow).length
    }
  };
}

function ensureAiResultPanel() {
  let panel = $('#aiResult');
  if (panel) return panel;
  const body = $('[data-page="ai"] .ai-page-body') || $('[data-page="ai"]');
  if (!body) return null;
  panel = document.createElement('section');
  panel.id = 'aiResult';
  panel.className = 'ai-panel ai-result-panel';
  panel.innerHTML = '<h2>Kết quả AI</h2><p>Chưa có kết quả. Bấm “Tạo báo cáo AI” để phân tích dữ liệu local.</p>';
  body.appendChild(panel);
  return panel;
}

function setRunButtonBusy(busy) {
  document.querySelectorAll('#aiBtn,[data-ai-summary-create]').forEach((button) => {
    button.disabled = busy;
    button.dataset.aiBusy = busy ? '1' : '0';
    if (busy) {
      button.dataset.oldText = button.textContent;
      button.textContent = 'Đang phân tích...';
    } else if (button.dataset.oldText) {
      button.textContent = button.dataset.oldText;
      delete button.dataset.oldText;
    }
  });
}

function resultToText(result = {}) {
  const lines = [];
  if (result.summary) lines.push('TÓM TẮT', result.summary, '');
  if (Array.isArray(result.market_insights) && result.market_insights.length) lines.push('NHẬN ĐỊNH THỊ TRƯỜNG', ...result.market_insights.map((x) => `- ${x}`), '');
  if (Array.isArray(result.product_insights) && result.product_insights.length) lines.push('SẢN PHẨM', ...result.product_insights.map((x) => `- ${x.product || 'Sản phẩm'} [${x.status || 'unknown'}]: ${x.insight || ''}`), '');
  if (Array.isArray(result.customer_actions) && result.customer_actions.length) lines.push('HÀNH ĐỘNG KHÁCH HÀNG', ...result.customer_actions.map((x) => `- [${x.priority || 'medium'}] ${x.customer || 'Khách'}: ${x.action || ''}${x.reason ? ` (${x.reason})` : ''}`), '');
  if (Array.isArray(result.sample_requests) && result.sample_requests.length) lines.push('YÊU CẦU MẪU', ...result.sample_requests.map((x) => `- ${x.customer || 'Khách'}: ${(x.products || []).join(', ')}${x.note ? ` — ${x.note}` : ''}`), '');
  if (Array.isArray(result.follow_up_list) && result.follow_up_list.length) lines.push('FOLLOW-UP', ...result.follow_up_list.map((x) => `- ${x.customer || 'Khách'}${x.date ? ` (${x.date})` : ''}: ${x.note || ''}`), '');
  if (Array.isArray(result.order_opportunities) && result.order_opportunities.length) lines.push('CƠ HỘI ĐƠN HÀNG', ...result.order_opportunities.map((x) => `- [${x.confidence || 'medium'}] ${x.customer || 'Khách'}: ${(x.products || []).join(', ')}${x.reason ? ` — ${x.reason}` : ''}`), '');
  if (Array.isArray(result.risks) && result.risks.length) lines.push('RỦI RO', ...result.risks.map((x) => `- ${x}`), '');
  if (Array.isArray(result.next_steps) && result.next_steps.length) lines.push('VIỆC TIẾP THEO', ...result.next_steps.map((x) => `- ${x}`));
  return lines.join('\n').trim() || 'Chưa có kết quả AI.';
}

function listHtml(items = [], mapper = (x) => x) {
  if (!Array.isArray(items) || !items.length) return '';
  return `<ul class="ai-result-list">${items.map((item) => `<li>${esc(mapper(item))}</li>`).join('')}</ul>`;
}

function renderResultPanel(payload) {
  const panel = ensureAiResultPanel();
  if (!panel) return;
  const result = payload?.result || {};
  const html = [
    `<h2>Kết quả AI</h2>`,
    `<div class="ai-run-state"><b>${payload.ok ? 'AI agent đã phân tích xong' : 'AI chưa trả kết quả chuẩn'}</b><small>source: ${esc(payload.source || 'unknown')}${payload.status ? ` · HTTP ${esc(payload.status)}` : ''}</small></div>`,
    `<article class="ai-result-card"><h3>Tóm tắt</h3><p>${esc(result.summary || 'Chưa có tóm tắt.')}</p></article>`,
    result.market_insights?.length ? `<article class="ai-result-card"><h3>Nhận định thị trường</h3>${listHtml(result.market_insights)}</article>` : '',
    result.product_insights?.length ? `<article class="ai-result-card"><h3>Sản phẩm</h3>${listHtml(result.product_insights, (x) => `${x.product || 'Sản phẩm'} [${x.status || 'unknown'}]: ${x.insight || ''}`)}</article>` : '',
    result.customer_actions?.length ? `<article class="ai-result-card"><h3>Hành động khách hàng</h3>${listHtml(result.customer_actions, (x) => `[${x.priority || 'medium'}] ${x.customer || 'Khách'}: ${x.action || ''}${x.reason ? ` (${x.reason})` : ''}`)}</article>` : '',
    result.order_opportunities?.length ? `<article class="ai-result-card"><h3>Cơ hội đơn hàng</h3>${listHtml(result.order_opportunities, (x) => `[${x.confidence || 'medium'}] ${x.customer || 'Khách'}: ${(x.products || []).join(', ')}${x.reason ? ` — ${x.reason}` : ''}`)}</article>` : '',
    result.next_steps?.length ? `<article class="ai-result-card"><h3>Việc tiếp theo</h3>${listHtml(result.next_steps)}</article>` : '',
    !payload.ok ? `<article class="ai-result-card"><h3>Debug</h3><pre class="ai-debug-box">${esc(debugText(payload))}</pre></article>` : ''
  ].join('');
  panel.innerHTML = html;
}

function renderRunningPanel(data) {
  const panel = ensureAiResultPanel();
  if (!panel) return;
  panel.innerHTML = `<h2>Kết quả AI</h2><div class="ai-run-state"><b>Đang gọi AI agent thật...</b><small>Dữ liệu gửi: ${data.metrics.orders} đơn, ${data.metrics.tests} test, ${data.metrics.market_reports} báo cáo, ${data.metrics.mcp_sessions} MCP. Đợi backend Cloud Run trả về, không phải thanh toast nhỏ nữa.</small></div>`;
}

async function runReportAgent() {
  const data = await snapshot();
  renderRunningPanel(data);
  toast('Đang gọi AI agent...');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  try {
    const response = await fetch('/api/report-agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json' },
      body: JSON.stringify({ snapshot: data }),
      signal: controller.signal,
      cache: 'no-store'
    });
    const text = await response.text();
    const json = safeJsonParse(text) || { content: text };
    const ok = response.ok && Boolean(json.ok);
    return {
      snapshot: data,
      result: json.result || {},
      ok,
      source: json.source || '',
      error: json.error || (!response.ok ? `HTTP ${response.status}: ${text.slice(0, 300)}` : ''),
      status: json.status || response.status,
      attempts: json.attempts || [],
      configState: json.configState || null,
      raw: json.raw || json,
      httpOk: response.ok
    };
  } catch (error) {
    const reason = error?.name === 'AbortError' ? 'UI đợi quá lâu khi gọi /api/report-agent.' : (error?.message || 'Không gọi được AI agent');
    return {
      snapshot: data,
      result: {
        summary: reason,
        market_insights: [],
        product_insights: [],
        customer_actions: [],
        sample_requests: [],
        follow_up_list: [],
        order_opportunities: [],
        risks: [reason],
        next_steps: ['Kiểm tra Vercel env AI_AGENT_URL, Vercel Function Logs và Cloud Run Logs.']
      },
      ok: false,
      source: 'ui_fetch_exception',
      error: reason,
      status: '',
      attempts: [],
      configState: null,
      raw: null,
      httpOk: false
    };
  } finally {
    clearTimeout(timer);
  }
}

async function saveAiResult(payload) {
  const title = clean($('[data-agent-title]')?.value) || `Báo cáo AI ${payload.snapshot.today}`;
  const content = clean($('[data-agent-content]')?.value) || resultToText(payload.result);
  const row = makeAiSummary({
    title,
    summary_type: 'company_report',
    date_from: payload.snapshot.today,
    date_to: payload.snapshot.today,
    source_filters: { source: payload.source || 'agent_platform', metrics: payload.snapshot.metrics, ok: payload.ok },
    source_refs: [
      { type: 'orders', count: payload.snapshot.metrics.orders },
      { type: 'tests', count: payload.snapshot.metrics.tests },
      { type: 'market_reports', count: payload.snapshot.metrics.market_reports },
      { type: 'mcp_sessions', count: payload.snapshot.metrics.mcp_sessions }
    ],
    result: { text: content, json: payload.result, generated_at: new Date().toISOString() },
    status: 'saved',
    note: payload.ok ? 'Generated by AI agent' : `AI fallback: ${payload.error || payload.source}`
  });
  await putLocal(LOCAL_STORES.aiSummaries, row);
  closeModal();
  toast('Đã lưu báo cáo AI');
  renderResultPanel(payload);
}

function debugText(payload) {
  const debug = {
    source: payload.source,
    status: payload.status,
    error: payload.error,
    httpOk: payload.httpOk,
    configState: payload.configState,
    attempts: payload.attempts,
    raw: payload.raw
  };
  return JSON.stringify(debug, null, 2);
}

function showResultModal(payload) {
  const modal = $('#modal');
  if (!modal) return;
  modal.dataset.type = 'ai-summary';
  const text = resultToText(payload.result);
  const debug = payload.ok ? '' : debugText(payload);
  modal.innerHTML = `<div class="modal">
    <header><h2>Báo cáo AI Agent</h2><button type="button" data-agent-close>Đóng</button></header>
    <div class="ai-summary-form">
      <label><span>Tiêu đề</span><input data-agent-title value="Báo cáo AI ${esc(payload.snapshot.today)}"></label>
      <label><span>Kết quả phân tích — có thể sửa trước khi lưu</span><textarea data-agent-content rows="22">${esc(text)}</textarea></label>
      <small>${payload.ok ? 'AI agent đã trả kết quả từ Cloud Run / ADK.' : `Lỗi/fallback: ${esc(payload.error || payload.source || 'không rõ')}`}</small>
      ${debug ? `<label><span>Debug — copy phần này gửi lại nếu còn lỗi</span><textarea readonly rows="12" style="min-height:180px!important">${esc(debug)}</textarea></label>` : ''}
      <div class="ai-summary-modal-actions"><button type="button" class="secondary" data-agent-close>Hủy</button><button type="button" class="primary" data-agent-save>Lưu báo cáo</button></div>
    </div>
  </div>`;
  modal.showModal();
  modal.__agentPayload = payload;
}

async function handleRun(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  setRunButtonBusy(true);
  try {
    const payload = await runReportAgent();
    renderResultPanel(payload);
    showResultModal(payload);
    toast(payload.ok ? 'AI agent đã phân tích xong' : 'AI lỗi/fallback, xem debug trong panel');
  } finally {
    setRunButtonBusy(false);
  }
}

document.addEventListener('click', async (event) => {
  const runButton = event.target.closest('#aiBtn,[data-ai-summary-create]');
  if (runButton && $('[data-page="ai"]')?.contains(runButton)) {
    await handleRun(event);
    return;
  }
  if (event.target.closest('[data-agent-close]')) {
    event.preventDefault();
    closeModal();
    return;
  }
  if (event.target.closest('[data-agent-save]')) {
    event.preventDefault();
    const payload = $('#modal')?.__agentPayload;
    if (payload) await saveAiResult(payload);
  }
}, true);

addCss();
window.addEventListener('DOMContentLoaded', () => {
  addCss();
  ensureAiResultPanel();
});
setTimeout(ensureAiResultPanel, 500);
setTimeout(ensureAiResultPanel, 1500);
