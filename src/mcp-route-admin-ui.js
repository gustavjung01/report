import { nowIso } from '../data-model.js';
import { LOCAL_STORES, getAllLocal, putLocal } from '../local-db.js';
import { getActiveMcpRouteSessionId, getMcpSession, recalcMcpRouteSession } from './mcp-core.js';

const weekdayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
let scheduled = null;

function esc(value = '') {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function norm(value = '') {
  return String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ');
}

function toast(message) {
  const element = document.querySelector('#toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2300);
}

function activeRoute(route = {}) {
  return route.active !== false && route.status !== 'deleted' && !route.deleted_at && !route.raw_payload?.deleted_at;
}

function activeCustomer(customer = {}) {
  return customer.active !== false && customer.status !== 'deleted' && !customer.deleted_at && !customer.raw_payload?.deleted_at;
}

function routeLabel(route = {}) {
  const weekday = weekdayNames[Number(route.weekday)] || '';
  return [route.route_name || 'Tuyến', weekday, route.area].filter(Boolean).join(' · ');
}

function duplicateKey(customer = {}) {
  const phone = norm(customer.phone || customer.customer_phone || '');
  const name = norm(customer.customer_name || customer.name || '');
  return phone || name;
}

function installStyle() {
  let style = document.querySelector('style[data-mcp-route-admin]');
  if (!style) {
    style = document.createElement('style');
    style.dataset.mcpRouteAdmin = '1';
    document.head.appendChild(style);
  }
  style.textContent = `
    section.page[data-page="mcp"] [data-mcp-route-admin]{background:#f2fbff!important;border-color:#bde8ff!important;color:#0369a1!important}
    .mcp-route-admin-row{display:grid!important;grid-template-columns:1fr!important;gap:6px!important;margin:0 0 8px!important;position:relative!important;z-index:1!important}
    .mcp-route-admin-row button{min-height:34px!important;border-radius:11px!important;font-size:11px!important;font-weight:900!important;width:100%!important}
    #modal[data-type="mcp-route-admin"],#modal[data-type="mcp-import"]{width:min(420px,calc(100vw - 20px))!important;max-height:calc(100dvh - 20px)!important;overflow:hidden!important;padding:0!important}
    #modal[data-type="mcp-route-admin"] .modal,#modal[data-type="mcp-import"] .modal{height:min(760px,calc(100dvh - 20px))!important;max-height:calc(100dvh - 20px)!important;overflow:hidden!important;display:grid!important;grid-template-rows:auto minmax(0,1fr)!important;gap:10px!important}
    #modal[data-type="mcp-import"] .form{min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;display:grid!important;gap:10px!important;padding-right:2px!important}
    .mcp-route-admin-body{min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;display:grid!important;gap:9px!important;padding-right:2px!important}
    .mcp-route-admin-tools{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;position:sticky!important;top:0!important;z-index:2!important;background:#fff!important;padding-bottom:4px!important}
    .mcp-route-admin-tools input,.mcp-route-admin-tools select{width:100%!important;min-width:0!important;min-height:38px!important;border:1px solid #cad7d4!important;border-radius:12px!important;background:#fff!important;padding:8px 10px!important;font:inherit!important;font-size:13px!important;box-sizing:border-box!important}
    .mcp-route-admin-card{border:1px solid #dce8e5!important;border-radius:14px!important;background:#fbfffd!important;padding:10px!important;display:grid!important;gap:7px!important;min-width:0!important;position:relative!important;z-index:1!important}
    .mcp-route-admin-card h3{margin:0!important;font-size:14px!important;line-height:1.15!important;word-break:break-word!important}
    .mcp-route-admin-card small{display:block!important;color:#63727c!important;font-size:11px!important;line-height:1.3!important}
    .mcp-route-customer-list{display:grid!important;gap:7px!important;min-width:0!important}
    .mcp-route-customer-row{border:1px solid #e6efec!important;border-radius:12px!important;background:#fff!important;padding:8px!important;display:grid!important;gap:7px!important;min-width:0!important;position:relative!important;z-index:1!important}
    .mcp-route-customer-row.is-inactive{opacity:.58!important;background:#f8fafc!important}
    .mcp-route-customer-head{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:8px!important;align-items:start!important;min-width:0!important}
    .mcp-route-customer-head b{font-size:13px!important;line-height:1.2!important;word-break:break-word!important}
    .mcp-route-customer-actions{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:6px!important;align-items:center!important;min-width:0!important}
    .mcp-route-customer-actions button,.mcp-route-customer-actions select{min-height:32px!important;border-radius:10px!important;font-size:11px!important;font-weight:900!important;box-sizing:border-box!important}
    .mcp-route-customer-actions select{border:1px solid #cad7d4!important;background:#fff!important;padding:5px 7px!important;min-width:0!important;width:100%!important}
    .mcp-route-admin-danger{border-color:#fecaca!important;background:#fff7f7!important;color:#b91c1c!important}
    @media(max-width:420px){.mcp-route-admin-tools,.mcp-route-customer-actions{grid-template-columns:1fr!important}.mcp-route-customer-actions button,.mcp-route-customer-actions select{width:100%!important}}
  `;
}

async function loadData() {
  const [routes, customers] = await Promise.all([
    getAllLocal(LOCAL_STORES.mcpRoutes),
    getAllLocal(LOCAL_STORES.mcpRouteCustomers)
  ]);
  const activeRoutes = routes.filter(activeRoute).sort((a, b) => Number(a.weekday || 0) - Number(b.weekday || 0) || String(a.route_name || '').localeCompare(String(b.route_name || ''), 'vi'));
  return { routes, activeRoutes, customers };
}

function ensureButtons() {
  installStyle();
  const page = document.querySelector('section.page[data-page="mcp"].active');
  const filters = page?.querySelector('.mcp-filters');
  if (filters && !filters.querySelector('[data-mcp-route-admin]')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mcp-filter';
    button.dataset.mcpRouteAdmin = '1';
    button.textContent = 'Quản trị tuyến';
    const importButton = filters.querySelector('[data-mcp-import-customers]');
    if (importButton?.nextSibling) filters.insertBefore(button, importButton.nextSibling);
    else filters.appendChild(button);
  }

  const shell = document.querySelector('#dataShell.active');
  const mcpTab = document.querySelector('#dataHub [data-data-view="mcp"].active');
  if (shell && mcpTab) {
    const rows = [...shell.querySelectorAll('.mcp-route-admin-row')];
    rows.slice(1).forEach((row) => row.remove());
    if (!shell.querySelector('[data-mcp-route-admin]')) {
      const row = shell.querySelector('.mcp-route-export-row') || shell.querySelector('.data-shell-open-card');
      row?.insertAdjacentHTML('afterend', '<div class="mcp-route-admin-row"><button type="button" class="secondary" data-mcp-route-admin>Quản trị tuyến cố định</button></div>');
    }
  }
}

function routeOptions(routes = [], selectedId = '', excludeId = '') {
  return routes.filter((route) => route.id !== excludeId).map((route) => `<option value="${esc(route.id)}" ${route.id === selectedId ? 'selected' : ''}>${esc(routeLabel(route))}</option>`).join('');
}

function customerRow(customer, route, routes) {
  const routeSelect = `<select data-mcp-admin-target-route="${esc(customer.id)}"><option value="">Chuyển sang...</option>${routeOptions(routes, '', customer.route_id)}</select>`;
  return `<article class="mcp-route-customer-row ${activeCustomer(customer) ? '' : 'is-inactive'}" data-route-customer-id="${esc(customer.id)}">
    <div class="mcp-route-customer-head"><div><b>${esc(customer.customer_name || 'Khách')}</b><small>${esc([customer.phone, customer.area, customer.address].filter(Boolean).join(' · ') || 'Chưa có thông tin')}</small><small>Tuyến: ${esc(routeLabel(route))}</small></div><small>${activeCustomer(customer) ? 'Bật' : 'Tắt'}</small></div>
    <div class="mcp-route-customer-actions">${routeSelect}<button type="button" data-mcp-admin-move-customer="${esc(customer.id)}">Chuyển</button><button type="button" class="secondary" data-mcp-admin-toggle-customer="${esc(customer.id)}">${activeCustomer(customer) ? 'Tắt khách' : 'Bật khách'}</button><button type="button" class="mcp-route-admin-danger" data-mcp-admin-hide-customer="${esc(customer.id)}">Ẩn mềm</button></div>
  </article>`;
}

function routeCard(route, customers, routes) {
  const routeCustomers = customers.filter((customer) => customer.route_id === route.id).sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.customer_name || '').localeCompare(String(b.customer_name || ''), 'vi'));
  const activeCount = routeCustomers.filter(activeCustomer).length;
  return `<section class="mcp-route-admin-card"><h3>${esc(routeLabel(route))}</h3><small>${activeCount}/${routeCustomers.length} khách đang bật</small><div class="mcp-route-customer-list">${routeCustomers.map((customer) => customerRow(customer, route, routes)).join('') || '<small>Chưa có khách trong tuyến này.</small>'}</div></section>`;
}

async function renderAdminModal() {
  const dialog = document.querySelector('#modal');
  if (!dialog) return;
  const previousSearch = dialog.querySelector('[data-mcp-admin-search]')?.value || '';
  const previousRouteId = dialog.querySelector('[data-mcp-admin-route-filter]')?.value || '';
  const { activeRoutes, customers } = await loadData();
  const routeId = previousRouteId;
  const query = norm(previousSearch);
  const visibleRoutes = routeId ? activeRoutes.filter((route) => route.id === routeId) : activeRoutes;
  const visibleCustomerIds = new Set(customers.filter((customer) => {
    if (routeId && customer.route_id !== routeId) return false;
    if (!query) return true;
    const haystack = norm([customer.customer_name, customer.phone, customer.area, customer.address].filter(Boolean).join(' '));
    return haystack.includes(query);
  }).map((customer) => customer.id));
  const scopedCustomers = query || routeId ? customers.filter((customer) => visibleCustomerIds.has(customer.id)) : customers;
  dialog.dataset.type = 'mcp-route-admin';
  dialog.innerHTML = `<div class="modal"><header><h2>Quản trị tuyến MCP</h2><button type="button" data-mcp-admin-close>Đóng</button></header><div class="mcp-route-admin-body"><div class="mcp-route-admin-tools"><input type="search" data-mcp-admin-search placeholder="Tìm khách / SĐT / khu vực" value="${esc(previousSearch)}"><select data-mcp-admin-route-filter><option value="">Tất cả tuyến</option>${activeRoutes.map((route) => `<option value="${esc(route.id)}" ${route.id === routeId ? 'selected' : ''}>${esc(routeLabel(route))}</option>`).join('')}</select></div>${visibleRoutes.map((route) => routeCard(route, scopedCustomers, activeRoutes)).join('') || '<p class="mcp-empty">Chưa có tuyến cố định.</p>'}</div></div>`;
  if (!dialog.open) dialog.showModal();
}

async function activeSessionForRoute(routeId = '') {
  const activeId = await getActiveMcpRouteSessionId();
  if (!activeId) return null;
  const session = await getMcpSession(activeId).catch(() => null);
  return session?.route_id === routeId ? session : null;
}

async function reorderRoute(routeId = '') {
  const customers = await getAllLocal(LOCAL_STORES.mcpRouteCustomers);
  const activeRows = customers.filter((customer) => customer.route_id === routeId && activeCustomer(customer)).sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.customer_name || '').localeCompare(String(b.customer_name || ''), 'vi'));
  const now = nowIso();
  for (const [index, customer] of activeRows.entries()) {
    await putLocal(LOCAL_STORES.mcpRouteCustomers, { ...customer, sort_order: index + 1, sync_status: 'local', updated_at: now });
  }
  const session = await activeSessionForRoute(routeId);
  if (session) await recalcMcpRouteSession(session.id).catch(() => null);
}

async function toggleCustomer(customerId = '') {
  const customers = await getAllLocal(LOCAL_STORES.mcpRouteCustomers);
  const customer = customers.find((item) => item.id === customerId);
  if (!customer) return toast('Không tìm thấy khách.');
  const nextActive = !activeCustomer(customer);
  const duplicate = nextActive && customers.some((item) => item.id !== customer.id && item.route_id === customer.route_id && activeCustomer(item) && duplicateKey(item) && duplicateKey(item) === duplicateKey(customer));
  if (duplicate) return toast('Khách này trùng với khách đang bật trong tuyến.');
  const now = nowIso();
  await putLocal(LOCAL_STORES.mcpRouteCustomers, { ...customer, active: nextActive, sync_status: 'local', updated_at: now, raw_payload: { ...(customer.raw_payload || {}), active_changed_at: now } });
  await reorderRoute(customer.route_id);
  window.dispatchEvent(new CustomEvent('mcp:session-changed'));
  await renderAdminModal();
  toast(nextActive ? 'Đã bật khách trong tuyến.' : 'Đã tắt khách trong tuyến.');
}

async function hideCustomer(customerId = '') {
  const customers = await getAllLocal(LOCAL_STORES.mcpRouteCustomers);
  const customer = customers.find((item) => item.id === customerId);
  if (!customer) return toast('Không tìm thấy khách.');
  if (!window.confirm(`Ẩn mềm ${customer.customer_name || 'khách này'} khỏi tuyến?`)) return;
  const now = nowIso();
  await putLocal(LOCAL_STORES.mcpRouteCustomers, { ...customer, active: false, status: 'deleted', sync_status: 'local', deleted_at: customer.deleted_at || now, updated_at: now, raw_payload: { ...(customer.raw_payload || {}), deleted_at: customer.deleted_at || now, delete_reason: 'route_admin' } });
  await reorderRoute(customer.route_id);
  window.dispatchEvent(new CustomEvent('mcp:session-changed'));
  await renderAdminModal();
  toast('Đã ẩn mềm khách khỏi tuyến.');
}

function selectedTargetRoute(dialog, customerId) {
  return [...dialog.querySelectorAll('[data-mcp-admin-target-route]')].find((select) => select.dataset.mcpAdminTargetRoute === customerId)?.value || '';
}

async function moveCustomer(customerId = '') {
  const dialog = document.querySelector('#modal[data-type="mcp-route-admin"]');
  const targetRouteId = dialog ? selectedTargetRoute(dialog, customerId) : '';
  if (!targetRouteId) return toast('Chưa chọn tuyến đích.');
  const customers = await getAllLocal(LOCAL_STORES.mcpRouteCustomers);
  const customer = customers.find((item) => item.id === customerId);
  if (!customer) return toast('Không tìm thấy khách.');
  if (customer.route_id === targetRouteId) return toast('Khách đang ở tuyến này rồi.');
  const key = duplicateKey(customer);
  const duplicate = key && customers.some((item) => item.id !== customer.id && item.route_id === targetRouteId && activeCustomer(item) && duplicateKey(item) === key);
  if (duplicate) return toast('Tuyến đích đã có khách trùng tên/SĐT.');
  const targetRows = customers.filter((item) => item.route_id === targetRouteId && activeCustomer(item));
  const maxOrder = Math.max(0, ...targetRows.map((item) => Number(item.sort_order || 0)));
  const oldRouteId = customer.route_id;
  const now = nowIso();
  await putLocal(LOCAL_STORES.mcpRouteCustomers, { ...customer, route_id: targetRouteId, sort_order: maxOrder + 1, active: true, sync_status: 'local', updated_at: now, raw_payload: { ...(customer.raw_payload || {}), moved_at: now, moved_from_route_id: oldRouteId, moved_to_route_id: targetRouteId } });
  await reorderRoute(oldRouteId);
  await reorderRoute(targetRouteId);
  window.dispatchEvent(new CustomEvent('mcp:session-changed'));
  await renderAdminModal();
  toast('Đã chuyển khách sang tuyến khác.');
}

function schedule() {
  clearTimeout(scheduled);
  scheduled = setTimeout(ensureButtons, 180);
}

window.addEventListener('click', async (event) => {
  const open = event.target.closest('[data-mcp-route-admin]');
  if (open) {
    event.preventDefault();
    event.stopImmediatePropagation();
    await renderAdminModal();
    return;
  }
  if (event.target.closest('[data-mcp-admin-close]')) {
    event.preventDefault();
    document.querySelector('#modal')?.close();
    return;
  }
  const toggle = event.target.closest('[data-mcp-admin-toggle-customer]');
  if (toggle) {
    event.preventDefault();
    await toggleCustomer(toggle.dataset.mcpAdminToggleCustomer);
    return;
  }
  const hide = event.target.closest('[data-mcp-admin-hide-customer]');
  if (hide) {
    event.preventDefault();
    await hideCustomer(hide.dataset.mcpAdminHideCustomer);
    return;
  }
  const move = event.target.closest('[data-mcp-admin-move-customer]');
  if (move) {
    event.preventDefault();
    await moveCustomer(move.dataset.mcpAdminMoveCustomer);
  }
}, true);

document.addEventListener('input', (event) => {
  if (!event.target.closest('#modal[data-type="mcp-route-admin"]')) return;
  if (!event.target.matches('[data-mcp-admin-search]')) return;
  clearTimeout(document.__mcpAdminSearchTimer);
  document.__mcpAdminSearchTimer = setTimeout(() => renderAdminModal().catch(console.warn), 320);
}, true);

document.addEventListener('change', (event) => {
  if (!event.target.closest('#modal[data-type="mcp-route-admin"]')) return;
  if (event.target.matches('[data-mcp-admin-route-filter]')) renderAdminModal().catch(console.warn);
}, true);

installStyle();
window.addEventListener('DOMContentLoaded', schedule);
window.addEventListener('mcp:session-changed', schedule);
setInterval(schedule, 1600);
schedule();
