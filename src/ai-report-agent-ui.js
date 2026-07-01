import { makeAiSummary, todayIsoDate } from '../data-model.js';
import { LOCAL_STORES, openLocalDb, getAllLocal, putLocal } from '../local-db.js';

const $ = (selector, root = document) => root.querySelector(selector);
const esc = (value = '') => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const clean = (value = '') => String(value ?? '').replace(/\s+/g, ' ').trim();

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

async function runReportAgent() {
  toast('Đang gọi AI agent...');
  const data = await snapshot();
  const response = await fetch('/api/report-agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ snapshot: data })
  });
  const json = await response.json().catch(() => ({}));
  return { snapshot: data, result: json.result || {}, ok: Boolean(json.ok), source: json.source || '', error: json.error || '', status: json.status || '', attempts: json.attempts || [], configState: json.configState || null, raw: json.raw || null };
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
}

function debugText(payload) {
  if (payload.ok) return '';
  const debug = {
    source: payload.source,
    status: payload.status,
    error: payload.error,
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
  const debug = debugText(payload);
  modal.innerHTML = `<div class="modal">
    <header><h2>Báo cáo AI Agent</h2><button type="button" data-agent-close>Đóng</button></header>
    <div class="ai-summary-form">
      <label><span>Tiêu đề</span><input data-agent-title value="Báo cáo AI ${esc(payload.snapshot.today)}"></label>
      <label><span>Kết quả phân tích</span><textarea data-agent-content>${esc(text)}</textarea></label>
      <small>${payload.ok ? 'AI agent đã trả kết quả.' : `Fallback/lỗi: ${esc(payload.error || payload.source || 'không rõ')}`}</small>
      ${debug ? `<label><span>Debug Agent Platform - copy phần này gửi lại</span><textarea readonly style="min-height:180px">${esc(debug)}</textarea></label>` : ''}
      <div class="ai-summary-modal-actions"><button type="button" class="secondary" data-agent-close>Hủy</button><button type="button" class="primary" data-agent-save>Lưu báo cáo</button></div>
    </div>
  </div>`;
  modal.showModal();
  modal.__agentPayload = payload;
}

async function handleRun(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  try {
    const payload = await runReportAgent();
    showResultModal(payload);
    toast(payload.ok ? 'AI agent đã phân tích xong' : 'AI trả fallback, copy debug gửi lại');
  } catch (error) {
    toast(error?.message || 'Không gọi được AI agent');
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
