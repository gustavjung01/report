import { LOCAL_STORES, getAllLocal, getLocal, putLocal, putManyLocal } from '../local-db.js';
import { isActiveBusinessRow, isActiveTestRow, makeSoftDeleted } from './soft-delete.js';

const guardedStores = [
  LOCAL_STORES.orders,
  LOCAL_STORES.orderItems,
  LOCAL_STORES.onaTests,
  LOCAL_STORES.onaTestItems,
  LOCAL_STORES.marketReports,
  LOCAL_STORES.marketReportProducts,
  LOCAL_STORES.marketReportCompetitors,
  LOCAL_STORES.mcpRouteSessions,
  LOCAL_STORES.mcpVisits,
  LOCAL_STORES.aiSummaries
].filter(Boolean);

let index = new Map();
let running = false;

function toast(message) {
  const el = document.querySelector('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2400);
}

function isActive(row = {}) {
  if (!row) return false;
  if (row.raw_payload?.kind === 'test_file' || row.raw_payload?.kind === 'test_customer' || row.test_id) return isActiveTestRow(row);
  return isActiveBusinessRow(row, { includeCancelled: true });
}

function removeCardBySelector(selector) {
  document.querySelectorAll(selector).forEach((node) => {
    const card = node.closest('.data-shell-card,.record,.mini,article,.line');
    if (card) card.remove();
  });
}

async function rebuildIndex() {
  const next = new Map();
  for (const store of guardedStores) {
    const rows = await getAllLocal(store).catch(() => []);
    next.set(store, new Map(rows.map((row) => [row.id, row])));
  }
  index = next;
  return next;
}

function row(store, id) {
  return index.get(store)?.get(id) || null;
}

function hideDeletedDom() {
  document.querySelectorAll('[data-order-id]').forEach((card) => {
    const order = row(LOCAL_STORES.orders, card.dataset.orderId);
    if (order && !isActive(order)) card.remove();
  });
  document.querySelectorAll('[data-report-id],[data-delete-report],[data-export-report-one]').forEach((node) => {
    const id = node.dataset.reportId || node.dataset.deleteReport || node.dataset.exportReportOne;
    const report = row(LOCAL_STORES.marketReports, id);
    if (report && !isActive(report)) node.closest('.data-shell-card,.record,article')?.remove();
  });
  document.querySelectorAll('[data-test-file-id],[data-delete-test-file],[data-detail],[data-add-customer],[data-export-test]').forEach((node) => {
    const id = node.dataset.testFileId || node.dataset.deleteTestFile || node.dataset.detail || node.dataset.addCustomer || node.dataset.exportTest;
    const file = row(LOCAL_STORES.onaTests, id);
    if (file && !isActive(file)) node.closest('.record,.mini,.data-shell-card,article')?.remove();
  });
  document.querySelectorAll('[data-mcp-session-id]').forEach((card) => {
    const session = row(LOCAL_STORES.mcpRouteSessions, card.dataset.mcpSessionId);
    if (session && !isActive(session)) card.remove();
  });
}

function addOrderDeleteButtons() {
  document.querySelectorAll('[data-order-id]').forEach((card) => {
    if (card.dataset.softDeleteReady) return;
    const order = row(LOCAL_STORES.orders, card.dataset.orderId);
    if (!order || !isActive(order)) return;
    card.dataset.softDeleteReady = '1';
    const actions = card.querySelector('.shell-actions') || card.appendChild(document.createElement('div'));
    actions.classList.add('shell-actions');
    if (!actions.querySelector('[data-order-soft-delete]')) {
      actions.insertAdjacentHTML('beforeend', `<button type="button" class="soft-delete-danger" data-order-soft-delete="${order.id}">Xoá</button>`);
    }
  });
}

function addMcpDeleteButtons() {
  document.querySelectorAll('[data-mcp-session-id]').forEach((card) => {
    if (card.dataset.mcpSoftDeleteReady) return;
    const session = row(LOCAL_STORES.mcpRouteSessions, card.dataset.mcpSessionId);
    if (!session || !isActive(session)) return;
    card.dataset.mcpSoftDeleteReady = '1';
    const actions = card.querySelector('.shell-actions') || card.appendChild(document.createElement('div'));
    actions.classList.add('shell-actions');
    if (!actions.querySelector('[data-mcp-session-soft-delete]')) {
      actions.insertAdjacentHTML('beforeend', `<button type="button" class="soft-delete-danger" data-mcp-session-soft-delete="${session.id}">Xoá phiên</button>`);
    }
  });
}

function css() {
  if (document.querySelector('style[data-soft-delete-persist-guard]')) return;
  const style = document.createElement('style');
  style.dataset.softDeletePersistGuard = '1';
  style.textContent = `.soft-delete-danger{border:1px solid #fecaca!important;background:#fff7f7!important;color:#b91c1c!important;border-radius:10px!important;min-height:32px!important;padding:6px 10px!important;font-weight:900!important}`;
  document.head.appendChild(style);
}

async function refreshGuard() {
  if (running) return;
  running = true;
  try {
    await rebuildIndex();
    hideDeletedDom();
    addOrderDeleteButtons();
    addMcpDeleteButtons();
  } catch (error) {
    console.warn('soft delete guard failed', error);
  } finally {
    running = false;
  }
}

async function softDeleteOrder(orderId = '') {
  const order = await getLocal(LOCAL_STORES.orders, orderId);
  if (!order) return toast('Không tìm thấy đơn.');
  if (!isActive(order)) return toast('Đơn này đã xoá rồi.');
  const ok = window.confirm(`Xoá mềm đơn của ${order.customer_name || 'khách này'}?\nĐơn sẽ ẩn khỏi danh sách và không hiện lại sau reload/sync.`);
  if (!ok) return;
  const items = (await getAllLocal(LOCAL_STORES.orderItems)).filter((item) => item.order_id === orderId);
  await putLocal(LOCAL_STORES.orders, makeSoftDeleted(order, 'delete_order'));
  if (items.length) await putManyLocal(LOCAL_STORES.orderItems, items.map((item) => makeSoftDeleted(item, 'delete_order')));
  removeCardBySelector(`[data-order-id="${CSS.escape(orderId)}"]`);
  window.dispatchEvent(new CustomEvent('order:changed'));
  await refreshGuard();
  toast('Đã xoá mềm đơn.');
}

async function softDeleteMcpSession(sessionId = '') {
  const session = await getLocal(LOCAL_STORES.mcpRouteSessions, sessionId);
  if (!session) return toast('Không tìm thấy phiên MCP.');
  if (!isActive(session)) return toast('Phiên này đã xoá rồi.');
  const ok = window.confirm(`Xoá mềm phiên MCP "${session.route_name || session.session_date || 'này'}"?\nCác lượt ghé trong phiên cũng sẽ ẩn.`);
  if (!ok) return;
  const visits = (await getAllLocal(LOCAL_STORES.mcpVisits)).filter((visit) => visit.session_id === sessionId);
  await putLocal(LOCAL_STORES.mcpRouteSessions, makeSoftDeleted(session, 'delete_mcp_session'));
  if (visits.length) await putManyLocal(LOCAL_STORES.mcpVisits, visits.map((visit) => makeSoftDeleted(visit, 'delete_mcp_session')));
  removeCardBySelector(`[data-mcp-session-id="${CSS.escape(sessionId)}"]`);
  window.dispatchEvent(new CustomEvent('mcp:session-changed'));
  await refreshGuard();
  toast('Đã xoá mềm phiên MCP.');
}

document.addEventListener('click', (event) => {
  const order = event.target.closest('[data-order-soft-delete]');
  if (order) { event.preventDefault(); event.stopImmediatePropagation(); softDeleteOrder(order.dataset.orderSoftDelete); return; }
  const session = event.target.closest('[data-mcp-session-soft-delete]');
  if (session) { event.preventDefault(); event.stopImmediatePropagation(); softDeleteMcpSession(session.dataset.mcpSessionSoftDelete); }
}, true);

css();
window.addEventListener('DOMContentLoaded', refreshGuard);
window.addEventListener('order:changed', () => setTimeout(refreshGuard, 80));
window.addEventListener('test:changed', () => setTimeout(refreshGuard, 80));
window.addEventListener('report:changed', () => setTimeout(refreshGuard, 80));
window.addEventListener('mcp:session-changed', () => setTimeout(refreshGuard, 80));
window.addEventListener('sync:delete-guard-restored', () => setTimeout(refreshGuard, 80));
setInterval(refreshGuard, 1200);
refreshGuard();