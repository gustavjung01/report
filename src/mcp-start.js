import { makeMcpRoute, todayIsoDate } from '../data-model.js';
import { LOCAL_STORES, putLocal } from '../local-db.js';
import { createOrOpenMcpRouteSession, getMcpRouteCustomers, getMcpRoutes, setActiveMcpRouteSessionId } from './mcp-core.js';

const weekdayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
let lastCreatedRouteId = '';

function esc(value = '') {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function toast(message) {
  const element = document.querySelector('#toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2200);
}

function weekdayFromDate(value) {
  return new Date(`${value || todayIsoDate()}T00:00:00`).getDay();
}

function activateMcpPage() {
  document.querySelectorAll('section.page').forEach((element) => element.classList.toggle('active', element.dataset.page === 'mcp'));
  document.querySelectorAll('.nav button').forEach((button) => button.classList.toggle('active', button.dataset.page === 'create'));
  const subtitle = document.querySelector('#subtitle');
  if (subtitle) subtitle.textContent = 'MCP tuyến';
  window.dispatchEvent(new CustomEvent('mcp:session-changed'));
}

async function routeOptions(selectedDate, selectedRouteId = '') {
  const routes = await getMcpRoutes();
  const weekday = weekdayFromDate(selectedDate);
  const sorted = routes.slice().sort((a, b) => {
    const aw = Number(a.weekday) === weekday ? 0 : 1;
    const bw = Number(b.weekday) === weekday ? 0 : 1;
    return aw - bw || Number(a.weekday || 0) - Number(b.weekday || 0) || String(a.route_name).localeCompare(String(b.route_name), 'vi');
  });
  const selected = selectedRouteId || sorted.find((route) => Number(route.weekday) === weekday)?.id || sorted[0]?.id || '';
  const options = sorted.map((route) => `<option value="${esc(route.id)}" ${route.id === selected ? 'selected' : ''}>${esc(route.route_name)} · ${esc(weekdayNames[Number(route.weekday)] || 'Chưa gán thứ')} · ${esc(route.area || 'Chưa đặt khu vực')}</option>`).join('');
  return { routes: sorted, selected, html: options || '<option value="">Chưa có tuyến</option>' };
}

async function updateRouteSummary() {
  const select = document.querySelector('#mcpStartRoute');
  const summary = document.querySelector('#mcpStartSummary');
  const chosen = document.querySelector('#mcpChosenRoute');
  if (!select || !summary) return;
  const routeId = select.value;
  if (!routeId) {
    summary.textContent = 'Chưa có tuyến. Tạo tuyến nhanh bên dưới trước khi bắt đầu.';
    if (chosen) chosen.textContent = 'Chưa chọn tuyến.';
    return;
  }
  const routes = await getMcpRoutes();
  const route = routes.find((item) => item.id === routeId);
  const customers = await getMcpRouteCustomers(routeId);
  const text = `${route?.route_name || 'Tuyến'} · ${route?.area || 'Chưa đặt khu vực'} · ${customers.length} khách trong tuyến`;
  summary.textContent = text;
  if (chosen) chosen.innerHTML = `<b>Đang chọn:</b> ${esc(text)}${routeId === lastCreatedRouteId ? ' · Tuyến vừa tạo' : ''}`;
}

export async function openMcpStartModal(seed = {}) {
  const dialog = document.querySelector('#modal');
  if (!dialog) return;
  const selectedDate = seed.session_date || todayIsoDate();
  const { selected, html } = await routeOptions(selectedDate, seed.route_id || '');
  dialog.dataset.type = 'mcp-start';
  dialog.innerHTML = `<form class="modal" data-mcp-start-form><header><h2>Bắt đầu MCP tuyến</h2><button type="button" data-close>Đóng</button></header><div class="form"><div class="grid"><label><span>Ngày đi tuyến</span><input id="mcpStartDate" type="date" value="${esc(selectedDate)}"></label><label><span>Sales</span><input id="mcpStartSales" placeholder="Tên sales" value="${esc(seed.sales || '')}"></label></div><label><span>Chọn tuyến</span><select id="mcpStartRoute">${html}</select></label><p class="data-shell-note" id="mcpChosenRoute">Đang chọn tuyến...</p><p class="data-shell-note" id="mcpStartSummary">Đang đọc tuyến...</p><button class="primary" data-mcp-start-submit>Bắt đầu tuyến này</button><article class="line"><b>Tạo tuyến nhanh</b><div class="grid"><label><span>Tên tuyến</span><input id="mcpNewRouteName" placeholder="Ví dụ: Tuyến A"></label><label><span>Khu vực</span><input id="mcpNewRouteArea" placeholder="Ví dụ: Chợ Lớn"></label></div><small id="mcpNewRouteWeekday">Gán theo ngày đang chọn: ${esc(weekdayNames[weekdayFromDate(selectedDate)])}</small><button type="button" class="secondary wide" data-mcp-create-route>+ Tạo tuyến và chọn tuyến này</button></article></div></form>`;
  if (!dialog.open) dialog.showModal();
  if (selected) document.querySelector('#mcpStartRoute').value = selected;
  await updateRouteSummary();
}

async function refreshRoutesAfterDateChange() {
  const date = document.querySelector('#mcpStartDate')?.value || todayIsoDate();
  const select = document.querySelector('#mcpStartRoute');
  const hint = document.querySelector('#mcpNewRouteWeekday');
  if (hint) hint.textContent = `Gán theo ngày đang chọn: ${weekdayNames[weekdayFromDate(date)]}`;
  if (!select) return;
  const { selected, html } = await routeOptions(date, select.value);
  select.innerHTML = html;
  if (selected) select.value = selected;
  await updateRouteSummary();
}

async function refreshRouteSelect(routeId, date) {
  const select = document.querySelector('#mcpStartRoute');
  if (!select) return;
  const { html } = await routeOptions(date, routeId);
  select.innerHTML = html;
  select.value = routeId;
  await updateRouteSummary();
}

async function createRouteQuick() {
  const date = document.querySelector('#mcpStartDate')?.value || todayIsoDate();
  const nameInput = document.querySelector('#mcpNewRouteName');
  const areaInput = document.querySelector('#mcpNewRouteArea');
  const name = nameInput?.value.trim();
  if (!name) return toast('Nhập tên tuyến trước đã.');
  const route = makeMcpRoute({
    route_name: name,
    area: areaInput?.value,
    weekday: weekdayFromDate(date),
    note: 'Tạo nhanh từ popup bắt đầu MCP.'
  });
  await putLocal(LOCAL_STORES.mcpRoutes, route);
  lastCreatedRouteId = route.id;
  await refreshRouteSelect(route.id, date);
  if (nameInput) nameInput.value = '';
  if (areaInput) areaInput.value = '';
  toast('Đã tạo và chọn tuyến. Bấm Bắt đầu tuyến này.');
}

async function startSession(event) {
  event.preventDefault();
  const routeId = document.querySelector('#mcpStartRoute')?.value || '';
  const date = document.querySelector('#mcpStartDate')?.value || todayIsoDate();
  if (!routeId) return toast('Chọn hoặc tạo tuyến trước.');
  const session = await createOrOpenMcpRouteSession({
    route_id: routeId,
    session_date: date,
    sales: document.querySelector('#mcpStartSales')?.value,
    status: 'active'
  });
  await setActiveMcpRouteSessionId(session.id);
  document.querySelector('#modal')?.close();
  activateMcpPage();
  toast('Đã mở phiên MCP tuyến.');
}

document.addEventListener('click', (event) => {
  const startButton = event.target.closest('[data-mcp-start]');
  const homeMcpCard = event.target.closest('section.page[data-page="create"] .home-card[data-page="mcp"]');
  if (startButton || homeMcpCard) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openMcpStartModal();
    return;
  }
  if (event.target.closest('[data-mcp-create-route]')) {
    event.preventDefault();
    createRouteQuick();
  }
}, true);

document.addEventListener('change', (event) => {
  if (event.target.closest('#mcpStartDate')) refreshRoutesAfterDateChange();
  if (event.target.closest('#mcpStartRoute')) updateRouteSummary();
});

document.addEventListener('submit', (event) => {
  if (!event.target.matches('[data-mcp-start-form]')) return;
  startSession(event);
});
