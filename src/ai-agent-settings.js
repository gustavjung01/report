import { makeAiSummary } from '../data-model.js';
import { LOCAL_STORES, openLocalDb, getAllLocal, putLocal } from '../local-db.js';

const AGENT_ROW_ID = 'ai-agent-config-selected';
let cfg = { supabaseUrl: '', supabaseKey: '', aiConfigured: false, aiAgentName: '' };
let parsedAgents = [];
let rawJson = null;
let selectedAgentId = '';

const $ = (selector, root = document) => root.querySelector(selector);
const esc = (value = '') => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

function toast(message) {
  const element = $('#toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2400);
}

async function loadConfig() {
  try {
    const response = await fetch('/api/config', { cache: 'no-store' });
    if (!response.ok) return;
    const json = await response.json();
    cfg.supabaseUrl = String(json.supabaseUrl || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
    cfg.supabaseKey = json.supabaseKey || '';
    cfg.aiConfigured = Boolean(json.aiConfigured);
    cfg.aiAgentName = json.aiAgentName || '';
  } catch (error) {
    console.warn('AI config load failed', error);
  }
}

function hasSupabase() {
  return Boolean(cfg.supabaseUrl && cfg.supabaseKey && navigator.onLine);
}

function apiUrl(table) {
  return `${cfg.supabaseUrl}/rest/v1/${table}`;
}

function headers(extra = {}) {
  return {
    apikey: cfg.supabaseKey,
    Authorization: `Bearer ${cfg.supabaseKey}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
    ...extra
  };
}

function addCss() {
  let style = $('style[data-ai-agent-settings]');
  if (!style) {
    style = document.createElement('style');
    style.dataset.aiAgentSettings = '1';
    document.head.appendChild(style);
  }
  style.textContent = `
    [data-page="ai"]{height:100%;min-height:0;overflow:hidden!important;display:none}
    [data-page="ai"].active{display:grid!important;grid-template-rows:auto minmax(0,1fr)!important;gap:10px!important}
    .ai-page-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
    .ai-page-title h1{font-size:21px!important;line-height:1.05!important;margin:0!important}
    .ai-page-title p{margin:4px 0 0!important;color:#63727c!important;font-size:12px!important;line-height:1.25!important}
    .ai-config-btn{border:0!important;border-radius:999px!important;background:#e8f8f3!important;color:#007866!important;min-height:34px!important;padding:0 12px!important;font-size:12px!important;font-weight:950!important;white-space:nowrap!important}
    .ai-page-body{min-height:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;display:grid;gap:10px;padding-right:2px}
    .ai-hero{border:1px solid #bfe9dc;border-radius:20px;background:linear-gradient(135deg,#007866,#00a991);color:#fff;padding:13px;box-shadow:0 13px 28px rgba(0,120,102,.14)}
    .ai-hero b{display:block;font-size:17px;line-height:1.08}.ai-hero small{display:block;margin-top:5px;color:rgba(255,255,255,.84);font-size:12px;line-height:1.25}
    .ai-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
    .ai-metric{background:#fff;border:1px solid #dce8e5;border-radius:15px;padding:9px 6px;text-align:center;box-shadow:0 7px 16px rgba(12,55,50,.045);min-width:0}
    .ai-metric b{display:block;font-size:17px;line-height:1;color:#082337}.ai-metric span{display:block;margin-top:4px;color:#63727c;font-size:10px;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ai-panel{background:#fff;border:1px solid #dce8e5;border-radius:17px;padding:11px;box-shadow:0 9px 20px rgba(12,55,50,.052);display:grid;gap:8px;min-width:0}
    .ai-panel h2{font-size:15px!important;margin:0!important;line-height:1.15}.ai-panel p{margin:0;color:#63727c;font-size:12px;line-height:1.35}
    .ai-agent-pill{display:flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid #dce8e5;background:#fbfffd;border-radius:13px;padding:9px;min-width:0}
    .ai-agent-pill div{min-width:0}.ai-agent-pill b{display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ai-agent-pill small{display:block;color:#63727c;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ai-badge{border-radius:999px;background:#e1f8f1;color:#007866;font-weight:950;font-size:10px;padding:4px 7px;white-space:nowrap}
    .ai-run-btn{border:0;border-radius:13px;background:linear-gradient(135deg,#00957f,#007866);color:#fff;font-weight:950;min-height:40px}
    #modal[data-type="ai-agent"]{width:min(420px,calc(100vw - 18px))!important;max-height:calc(100dvh - 18px)!important;overflow:hidden!important;padding:0!important;border-radius:18px!important}
    #modal[data-type="ai-agent"] .modal{height:min(760px,calc(100dvh - 18px))!important;max-height:calc(100dvh - 18px)!important;overflow:hidden!important;display:grid!important;grid-template-rows:auto minmax(0,1fr)!important;gap:10px!important;padding:14px!important;box-sizing:border-box!important}
    #modal[data-type="ai-agent"] header{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;min-width:0!important}
    #modal[data-type="ai-agent"] header h2{font-size:17px!important;line-height:1.15!important;margin:0!important;min-width:0!important}
    #modal[data-type="ai-agent"] header button{min-height:32px!important;border-radius:999px!important;padding:0 10px!important;white-space:nowrap!important}
    .ai-agent-form{min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;display:grid!important;gap:10px!important;padding-right:2px!important;align-content:start!important}
    .ai-agent-form label{display:grid!important;gap:4px!important;margin:0!important;min-width:0!important}.ai-agent-form span{font-size:11px!important;font-weight:900!important;color:#52616b!important}
    .ai-json-load{display:grid!important;grid-template-columns:1fr!important;gap:8px!important;align-items:stretch!important;min-width:0!important}
    .ai-json-load textarea{width:100%!important;min-height:104px!important;max-height:32dvh!important;resize:vertical!important;border:1px solid #cad7d4!important;border-radius:13px!important;padding:9px!important;font-size:12px!important;line-height:1.35!important;background:#fbfffd!important;box-sizing:border-box!important;overflow:auto!important}
    .ai-load-actions{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important}.ai-load-actions button{min-height:36px!important;border-radius:11px!important;font-size:12px!important;font-weight:900!important;min-width:0!important}
    .ai-agent-list{display:grid!important;gap:7px!important}.ai-agent-option{display:grid!important;grid-template-columns:auto minmax(0,1fr)!important;gap:8px!important;align-items:start!important;border:1px solid #dce8e5!important;border-radius:13px!important;background:#fff!important;padding:9px!important;min-width:0!important}.ai-agent-option b{display:block!important;font-size:13px!important;line-height:1.15!important}.ai-agent-option small{display:block!important;color:#63727c!important;font-size:11px!important;line-height:1.25!important;word-break:break-word!important;overflow-wrap:anywhere!important}
    .ai-agent-empty{border:1px dashed #dce8e5!important;border-radius:13px!important;background:#fbfffd!important;color:#63727c!important;font-size:12px!important;text-align:center!important;padding:12px!important;margin:0!important}
    .ai-save-row{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;position:sticky!important;bottom:0!important;background:#fff!important;padding-top:6px!important}.ai-save-row button{min-height:38px!important}
  `;
}

function firstValue(obj = {}, keys = []) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return value;
  }
  return '';
}

function pickName(obj, fallback) {
  return firstValue(obj, ['displayName', 'display_name', 'name', 'agentName', 'agent_name', 'title', 'resourceName', 'id']) || fallback;
}

function pickId(obj, fallback) {
  return firstValue(obj, ['id', 'agentId', 'agent_id', 'name', 'resourceName', 'resource_name', 'uid']) || fallback;
}

function summarizeAgent(obj) {
  const value = firstValue(obj, ['description', 'instruction', 'instructions', 'systemInstruction', 'system_instruction', 'prompt', 'defaultPrompt', 'goal', 'model', 'type']);
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return value.name || value.model || JSON.stringify(value).slice(0, 180);
  if (obj?.tools && Array.isArray(obj.tools)) return `${obj.tools.length} tool`;
  if (obj?.flow || obj?.playbook || obj?.orchestration) return 'Agent flow / playbook';
  return 'AI Agent config';
}

function normalizeAgent(obj, index) {
  const id = String(pickId(obj, `agent-${index + 1}`));
  const name = String(pickName(obj, id));
  return { id, name, description: String(summarizeAgent(obj)), raw: obj };
}

function looksLikeAgent(obj = {}, parentKey = '') {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const name = pickName(obj, '');
  const keyLooksAgent = /agent|playbook|flow|app|deployment|resource/i.test(parentKey);
  const explicitAgentFields = Boolean(
    obj.agent
    || obj.agentConfig
    || obj.agent_config
    || obj.instruction
    || obj.instructions
    || obj.systemInstruction
    || obj.system_instruction
    || obj.prompt
    || obj.playbook
    || obj.flow
    || obj.model
    || obj.tools
    || obj.orchestration
  );
  return Boolean(explicitAgentFields || (name && keyLooksAgent));
}

function collectAgents(value) {
  const candidates = [];
  const seen = new Set();
  const visited = new WeakSet();
  const preferredArrayKeys = new Set(['agents', 'agentConfigs', 'agent_configs', 'agentEngines', 'agent_engines', 'apps', 'resources', 'playbooks', 'flows', 'deployments']);

  function add(obj) {
    const agent = normalizeAgent(obj, candidates.length);
    const key = `${agent.id}::${agent.name}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(agent);
  }

  function scan(node, depth = 0, parentKey = '') {
    if (!node || depth > 9) return;
    if (Array.isArray(node)) {
      node.forEach((item) => scan(item, depth + 1, parentKey));
      return;
    }
    if (typeof node !== 'object') return;
    if (visited.has(node)) return;
    visited.add(node);

    if (looksLikeAgent(node, parentKey)) add(node);

    for (const [key, child] of Object.entries(node)) {
      if (!child || typeof child !== 'object') continue;
      if (preferredArrayKeys.has(key) || Array.isArray(child) || key === 'data' || key === 'result' || key === 'agent' || key === 'agentConfig' || key === 'agent_config') {
        scan(child, depth + 1, key);
      } else if (depth < 5) {
        scan(child, depth + 1, key);
      }
    }
  }

  scan(value, 0, 'root');
  return candidates;
}

async function getSavedAgent() {
  await openLocalDb();
  const rows = await getAllLocal(LOCAL_STORES.aiSummaries);
  return rows.find((row) => row.id === AGENT_ROW_ID) || rows.find((row) => row.summary_type === 'agent_config') || null;
}

async function upsertSupabaseAgent(row) {
  if (!hasSupabase()) return false;
  const payload = [{
    id: row.id,
    title: row.title,
    summary_type: row.summary_type,
    source_filters: row.source_filters,
    source_refs: row.source_refs,
    result: row.result,
    status: row.status,
    agent_id: row.agent_id,
    agent_name: row.agent_name,
    note: row.note,
    created_at: row.created_at,
    updated_at: row.updated_at
  }];
  const response = await fetch(apiUrl('ai_summaries'), { method: 'POST', headers: headers(), body: JSON.stringify(payload) });
  if (!response.ok) throw new Error(await response.text());
  return true;
}

async function saveSelectedAgent() {
  const selected = $('[name="aiAgentChoice"]:checked');
  if (!selected) return toast('Chưa chọn agent');
  const agent = parsedAgents.find((item) => item.id === selected.value);
  if (!agent) return toast('Không tìm thấy agent đã chọn');
  const row = makeAiSummary({
    id: AGENT_ROW_ID,
    title: `Agent config · ${agent.name}`,
    summary_type: 'agent_config',
    source_filters: { source: rawJson?.source || 'ai_agent_config', agent_count: parsedAgents.length, selected_agent_id: agent.id },
    source_refs: parsedAgents.map((item) => ({ id: item.id, name: item.name, description: item.description })),
    result: { selected_agent: agent, raw_json: rawJson },
    status: 'active',
    agent_id: agent.id,
    agent_name: agent.name,
    note: 'Saved from AI Agent config'
  });
  await putLocal(LOCAL_STORES.aiSummaries, row);
  try {
    const synced = await upsertSupabaseAgent(row);
    toast(synced ? 'Đã lưu agent lên Supabase' : 'Đã lưu agent local');
  } catch (error) {
    console.warn('save AI agent to supabase failed', error);
    toast('Đã lưu local, Supabase lỗi');
  }
  closeModal();
  await renderAiPage();
}

function renderAgentOptions(forceSelectedId = selectedAgentId) {
  const box = $('#aiAgentList');
  const count = $('#aiAgentCount');
  if (count) count.textContent = `${parsedAgents.length} agent`;
  if (!box) return;
  box.innerHTML = parsedAgents.length ? parsedAgents.map((agent, index) => `
    <label class="ai-agent-option">
      <input type="radio" name="aiAgentChoice" value="${esc(agent.id)}" ${(forceSelectedId ? agent.id === forceSelectedId : index === 0) ? 'checked' : ''}>
      <span><b>${esc(agent.name)}</b><small>${esc(agent.id)} · ${esc(agent.description).slice(0, 180)}</small></span>
    </label>
  `).join('') : '<p class="ai-agent-empty">Chưa có agent. Dán JSON, chọn file JSON hoặc bấm “Load server”.</p>';
}

function parseTextareaJson() {
  const text = $('#aiAgentJson')?.value.trim();
  if (!text) return toast('Chưa có JSON');
  try {
    rawJson = JSON.parse(text);
    parsedAgents = collectAgents(rawJson);
    selectedAgentId = parsedAgents[0]?.id || '';
    renderAgentOptions();
    toast(parsedAgents.length ? `Đã load ${parsedAgents.length} agent` : 'Đã đọc JSON nhưng chưa tìm thấy agent');
  } catch (error) {
    toast('JSON không hợp lệ');
  }
}

async function loadRemoteAgent() {
  try {
    const response = await fetch('/api/ai-agent', { cache: 'no-store' });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.ok === false) throw new Error(json.error || `HTTP ${response.status}`);
    rawJson = { source: 'ai_agent_server', ...json };
    parsedAgents = collectAgents(json.data || json.agents || json);
    if (!parsedAgents.length && json.configured) {
      parsedAgents = [normalizeAgent({ id: 'server-agent', name: json.agentName || cfg.aiAgentName || 'AI Agent', description: json.agentUrl || 'AI_AGENT_URL', source: 'ai_agent_server' }, 0)];
    }
    selectedAgentId = parsedAgents[0]?.id || '';
    const input = $('#aiAgentJson');
    if (input) input.value = JSON.stringify(rawJson, null, 2);
    renderAgentOptions();
    toast(parsedAgents.length ? `Đã load ${parsedAgents.length} agent từ server` : 'Server chưa cấu hình agent');
  } catch (error) {
    console.warn('load remote AI agent failed', error);
    toast('Không load được agent server');
  }
}

async function loadJsonFile(file) {
  if (!file) return;
  const text = await file.text();
  const input = $('#aiAgentJson');
  if (input) input.value = text;
  parseTextareaJson();
}

function closeModal() {
  const modal = $('#modal');
  if (modal?.open) modal.close();
  if (modal) modal.dataset.type = '';
}

async function openAgentModal() {
  const modal = $('#modal');
  if (!modal) return;
  modal.dataset.type = 'ai-agent';
  const saved = await getSavedAgent();
  rawJson = saved?.result?.raw_json || null;
  parsedAgents = rawJson ? collectAgents(rawJson) : (saved?.source_refs?.map((item, index) => normalizeAgent(item, index)) || []);
  selectedAgentId = saved?.agent_id || parsedAgents[0]?.id || '';
  modal.innerHTML = `
    <div class="modal">
      <header><h2>Cài đặt AI Agent</h2><button type="button" data-ai-agent-close>Đóng</button></header>
      <div class="ai-agent-form">
        <div class="ai-json-load">
          <label><span>Agent JSON / Server response</span><textarea id="aiAgentJson" placeholder="Dán JSON export hoặc bấm Load server / chọn file .json">${rawJson ? esc(JSON.stringify(rawJson, null, 2)) : ''}</textarea></label>
          <div class="ai-load-actions"><button class="secondary" type="button" data-ai-load-json>Load JSON</button><button class="secondary" type="button" data-ai-load-server>Load server</button></div>
        </div>
        <label><span>Chọn file JSON</span><input id="aiAgentFile" type="file" accept="application/json,.json"></label>
        <div class="ai-agent-pill"><div><b>Agent trong project</b><small>${cfg.aiConfigured ? `Server: ${esc(cfg.aiAgentName || 'đã cấu hình')}` : 'Chưa có AI_AGENT_URL ở server hoặc dùng JSON local'}</small></div><span class="ai-badge" id="aiAgentCount">0 agent</span></div>
        <div class="ai-agent-list" id="aiAgentList"></div>
        <div class="ai-save-row"><button class="secondary" type="button" data-ai-agent-close>Hủy</button><button class="primary" type="button" data-ai-save-agent>Lưu agent</button></div>
      </div>
    </div>`;
  renderAgentOptions(selectedAgentId);
  modal.showModal();
}

async function renderAiPage() {
  const page = $('[data-page="ai"]');
  if (!page) return;
  const saved = await getSavedAgent();
  const agentCount = saved?.source_filters?.agent_count || saved?.source_refs?.length || 0;
  const agentName = saved?.agent_name || 'Chưa chọn agent';
  page.innerHTML = `
    <div class="ai-page-head">
      <div class="ai-page-title"><h1>AI tổng hợp</h1><p>Chọn agent thật từ server hoặc JSON để tổng hợp dữ liệu MCP / Đơn / Test / Báo cáo.</p></div>
      <button class="ai-config-btn" type="button" data-open-ai-agent>⚙ Agent</button>
    </div>
    <div class="ai-page-body">
      <article class="ai-hero"><b>Agent báo cáo công ty</b><small>Agent được lưu local và đồng bộ Supabase qua bảng ai_summaries để không bị trôi cấu hình.</small></article>
      <div class="ai-metrics"><div class="ai-metric"><b>${esc(agentCount)}</b><span>Agent</span></div><div class="ai-metric"><b>${saved ? '1' : '0'}</b><span>Đã chọn</span></div><div class="ai-metric"><b>${cfg.aiConfigured ? 'Agent' : (hasSupabase() ? 'ON' : 'Local')}</b><span>Kết nối</span></div></div>
      <section class="ai-panel"><h2>Agent đang dùng</h2><div class="ai-agent-pill"><div><b>${esc(agentName)}</b><small>${saved ? esc(saved.agent_id || '') : 'Bấm Agent để load server/JSON và lưu agent.'}</small></div><span class="ai-badge">${saved?.status || 'draft'}</span></div><button class="ai-run-btn" type="button" id="aiBtn">Tạo báo cáo AI</button><p>Hiện đã chọn/lưu agent thật. Nút tạo báo cáo đang tạo bản tổng hợp local có thể chỉnh rồi lưu.</p></section>
    </div>`;
}

function wire() {
  document.addEventListener('click', async (event) => {
    if (event.target.closest('[data-open-ai-agent]')) {
      event.preventDefault();
      await openAgentModal();
      return;
    }
    if (event.target.closest('[data-ai-agent-close]')) {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.target.closest('[data-ai-load-json]')) {
      event.preventDefault();
      parseTextareaJson();
      return;
    }
    if (event.target.closest('[data-ai-load-server]')) {
      event.preventDefault();
      await loadRemoteAgent();
      return;
    }
    if (event.target.closest('[data-ai-save-agent]')) {
      event.preventDefault();
      await saveSelectedAgent();
    }
  }, true);
  document.addEventListener('change', async (event) => {
    if (event.target?.id === 'aiAgentFile') await loadJsonFile(event.target.files?.[0]);
    if (event.target?.name === 'aiAgentChoice') selectedAgentId = event.target.value;
  }, true);
}

async function boot() {
  addCss();
  await openLocalDb();
  await loadConfig();
  await renderAiPage();
}

wire();
boot();
window.addEventListener('DOMContentLoaded', boot);
