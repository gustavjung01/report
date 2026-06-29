import './business-ui-shells.js';
import { makeGoogleMapsUrl, makeMcpRouteCustomer, nowIso } from '../data-model.js';
import { LOCAL_STORES, getAllLocal, putLocal } from '../local-db.js';
import { getActiveMcpSessionDetail, recalcMcpRouteSession, upsertMcpVisitForSession } from './mcp-core.js';

const weekdayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const statusLabel = { todo: 'Chưa ghé', done: 'Đã ghé', checked_in: 'Đã ghé', order: 'Có đơn', test: 'Có test', report: 'Có báo cáo', no: 'Không mua', no_buy: 'Không mua', follow_up: 'Theo dõi', skipped: 'Bỏ qua' };
const statusNote = { done: 'Đã check-in', checked_in: 'Đã check-in', order: 'Đánh dấu có đơn', test: 'Đánh dấu có test', report: 'Đánh dấu có báo cáo', no: 'Đã ghé nhưng không mua', no_buy: 'Đã ghé nhưng không mua' };
let activeFilter = 'all';

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

function css() { /* Shell styles are preloaded from polish.css to avoid first-load reflow. */ }

function page() {
  if (document.querySelector('section.page[data-page="mcp"]')) return;
  const main = document.querySelector('main');
  if (!main) return;
  main.insertAdjacentHTML('beforeend', '<section class="page mcp-page" data-page="mcp"></section>');
}

async function loadState() {
  const detail = await getActiveMcpSessionDetail();
  if (!detail) return null;
  const session = detail.session;
  const route = detail.route || { id: session.route_id, route_name: session.route_name, area: session.area };
  return {
    session,
    route,
    customers: detail.customers,
    visits: detail.visits,
    stats: detail.stats,
    today: session.session_date
  };
}

function visitFor(customer, visits) {
  return visits.find((visit) => visit.route_customer_id === customer.id) || null;
}

function statusOf(customer, visits) {
  const visit = visitFor(customer, visits);
  if (!visit) return 'todo';
  if (visit.status === 'order' || visit.has_order) return 'order';
  if (visit.status === 'test' || visit.has_test) return 'test';
  if (visit.status === 'report' || visit.has_report) return 'report';
  if (visit.status === 'no_buy') return 'no';
  return visit.status || 'done';
}

function statusClasses(status) {
  const base = status === 'todo' ? 'todo' : 'done';
  return [base, status].filter(Boolean).join(' ');
}

function statCount(customers, visits, status) {
  return customers.filter((customer) => statusOf(customer, visits) === status).length;
}

function customerMapUrl(customer) {
  return customer.google_maps_url || makeGoogleMapsUrl(customer.geo_lat, customer.geo_lng);
}

function renderLocation(customer) {
  const url = customerMapUrl(customer);
  if (!url) return '';
  const accuracy = Number.isFinite(Number(customer.geo_accuracy)) ? ` · ±${Math.round(Number(customer.geo_accuracy))}m` : '';
  return `<small class="mcp-location">📍 Đã lưu vị trí${accuracy} <a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Mở Google Maps</a></small>`;
}

function renderCards(customers, visits) {
  const filtered = customers.filter((customer) => {
    const status = statusOf(customer, visits);
    return activeFilter === 'all' || status === activeFilter || (activeFilter === 'done' && status !== 'todo');
  });

  if (!customers.length) {
    return '<p class="mcp-empty">Tuyến này chưa có khách. Bấm + Khách để thêm khách đầu tiên.</p>';
  }
  if (!filtered.length) return '<p class="mcp-empty">Không có khách trong bộ lọc này.</p>';

  return filtered.map((customer, index) => {
    const status = statusOf(customer, visits);
    const order = Number(customer.sort_order || index + 1);
    const detail = [customer.area, customer.phone, customer.address].filter(Boolean).join(' · ') || 'Khách trong tuyến';
    return `<article class="mcp-customer" data-status="${esc(statusClasses(status))}" data-customer-id="${esc(customer.id)}">
      <div class="mcp-customer-head"><div><h3>${esc(customer.customer_name)}</h3><small>#${esc(order)} · ${esc(detail)}</small></div><span class="mcp-badge ${esc(status)}">${esc(statusLabel[status] || status)}</span></div>
      ${customer.note ? `<small class="mcp-note">${esc(customer.note)}</small>` : ''}
      ${renderLocation(customer)}
      <div class="mcp-actions">
        <button type="button" data-mcp-status="done" data-customer-id="${esc(customer.id)}">Check-in</button>
        <button type="button" data-mcp-status="order" data-customer-id="${esc(customer.id)}">Có đơn</button>
        <button type="button" data-mcp-status="test" data-customer-id="${esc(customer.id)}">Có test</button>
        <button type="button" data-mcp-status="no" data-customer-id="${esc(customer.id)}">Không mua</button>
      </div>
      <div class="mcp-manage-actions">
        <button type="button" data-mcp-move-customer="up" data-customer-id="${esc(customer.id)}">↑</button>
        <button type="button" data-mcp-move-customer="down" data-customer-id="${esc(customer.id)}">↓</button>
        <button type="button" data-mcp-edit-customer data-customer-id="${esc(customer.id)}">Sửa</button>
        <button type="button" data-mcp-hide-customer data-customer-id="${esc(customer.id)}">Ẩn</button>
      </div>
    </article>`;
  }).join('');
}

function renderNoSession(section) {
  section.innerHTML = `<article class="mcp-route-card"><div class="mcp-route-main"><small>Chưa chọn phiên tuyến</small><b>MCP tuyến</b><p>Chọn ngày và tuyến trước khi thao tác khách.</p></div><div class="mcp-score"><span><b>0</b> khách</span><span><b>0</b> ghé</span></div></article><div class="mcp-list-wrap"><div class="mcp-list"><p class="mcp-empty">Chưa có phiên MCP đang mở. Bấm nút bên dưới để chọn ngày/tuyến.</p><button type="button" class="primary wide" data-mcp-start>Chọn / bắt đầu tuyến</button></div></div>`;
}

async function render() {
  const section = document.querySelector('section.page[data-page="mcp"]');
  if (!section) return;
  const state = await loadState();
  if (!state) return renderNoSession(section);
  const { session, route, customers, visits, today } = state;
  const done = customers.filter((customer) => statusOf(customer, visits) !== 'todo').length;
  const order = statCount(customers, visits, 'order');
  const test = statCount(customers, visits, 'test');
  const weekday = weekdayNames[Number(session.weekday)] || 'Phiên tuyến';
  const filters = [
    ['all', 'Tất cả'],
    ['todo', 'Chưa ghé'],
    ['done', 'Đã ghé'],
    ['order', 'Có đơn'],
    ['test', 'Có test'],
    ['no', 'Không mua']
  ];

  section.innerHTML = `<article class="mcp-route-card"><div class="mcp-route-main"><small>${esc(weekday)} · ${esc(today)}</small><b>${esc(route.route_name || session.route_name || 'Tuyến')} · ${esc(route.area || session.area || 'Chưa đặt khu vực')}</b><p>Phiên MCP đang thao tác.</p></div><div class="mcp-score"><span><b>${customers.length}</b> khách</span><span><b>${done}</b> ghé</span></div></article>
    <div class="mcp-stats"><div class="mcp-stat"><b>${customers.length}</b><span>Khách</span></div><div class="mcp-stat"><b>${done}</b><span>Đã ghé</span></div><div class="mcp-stat"><b>${order}</b><span>Có đơn</span></div><div class="mcp-stat"><b>${test}</b><span>Có test</span></div></div>
    <div class="mcp-list-wrap"><div class="mcp-filters"><button type="button" class="mcp-filter mcp-add" data-mcp-add-customer>+ Khách</button><button type="button" class="mcp-filter" data-mcp-start>Đổi tuyến</button>${filters.map(([value, label]) => `<button type="button" class="mcp-filter ${activeFilter === value ? 'active' : ''}" data-mcp-filter="${value}">${label}</button>`).join('')}</div><div class="mcp-list">${renderCards(customers, visits)}</div></div>`;
}

function setValue(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.value = value ?? '';
}

function setGeoDisplayFromFields() {
  const lat = document.querySelector('#mcpGeoLat')?.value;
  const lng = document.querySelector('#mcpGeoLng')?.value;
  const accuracy = document.querySelector('#mcpGeoAccuracy')?.value;
  const url = document.querySelector('#mcpGoogleMapsUrl')?.value || makeGoogleMapsUrl(lat, lng);
  const status = document.querySelector('#mcpGeoStatus');
  if (status && lat && lng) {
    status.textContent = `Đã lưu vị trí: ${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}${accuracy ? ` · độ chính xác ±${Math.round(Number(accuracy))}m` : ''}`;
  }
  const link = document.querySelector('#mcpGeoMapLink');
  if (link && url) {
    link.href = url;
    link.hidden = false;
  }
}

function customerModalHtml(customer = null) {
  const isEdit = Boolean(customer?.id);
  return `<form class="modal" data-mcp-customer-form data-customer-id="${esc(customer?.id || '')}"><header><h2>${isEdit ? 'Sửa khách trong tuyến' : 'Thêm khách vào tuyến'}</h2><button type="button" data-close>Đóng</button></header><div class="form"><div class="grid"><label><span>Khách</span><input id="mcpCustomerName" required placeholder="Tên quán / đại lý" value="${esc(customer?.customer_name || '')}"></label><label><span>SĐT</span><input id="mcpCustomerPhone" inputmode="tel" value="${esc(customer?.phone || '')}"></label></div><label><span>Khu vực</span><input id="mcpCustomerArea" placeholder="Ví dụ: Chợ Lớn" value="${esc(customer?.area || '')}"></label><label><span>Địa chỉ</span><input id="mcpCustomerAddress" value="${esc(customer?.address || '')}"></label><article class="line"><b>Vị trí khách</b><small id="mcpGeoStatus">${customerMapUrl(customer || {}) ? 'Đã có vị trí. Có thể lấy lại GPS nếu cần.' : 'Chưa lấy vị trí. Đứng tại khách rồi bấm nút bên dưới.'}</small><button type="button" class="secondary wide" data-mcp-get-location>📍 Lấy vị trí hiện tại</button><a id="mcpGeoMapLink" class="secondary wide" href="${esc(customerMapUrl(customer || {}) || '#')}" target="_blank" rel="noopener noreferrer" ${customerMapUrl(customer || {}) ? '' : 'hidden'}>Mở Google Maps</a><input id="mcpGeoLat" type="hidden" value="${esc(customer?.geo_lat ?? '')}"><input id="mcpGeoLng" type="hidden" value="${esc(customer?.geo_lng ?? '')}"><input id="mcpGeoAccuracy" type="hidden" value="${esc(customer?.geo_accuracy ?? '')}"><input id="mcpGeoCapturedAt" type="hidden" value="${esc(customer?.geo_captured_at || '')}"><input id="mcpGoogleMapsUrl" type="hidden" value="${esc(customerMapUrl(customer || {}) || '')}"></article><label><span>Ghi chú tuyến</span><textarea id="mcpCustomerNote" rows="2" placeholder="Giờ ghé, người liên hệ, ưu tiên...">${esc(customer?.note || '')}</textarea></label><button class="primary" data-mcp-save-customer>${isEdit ? 'Lưu khách' : 'Thêm vào tuyến'}</button></div></form>`;
}

function openCustomerModal(customer = null) {
  const dialog = document.querySelector('#modal');
  if (!dialog) return;
  dialog.dataset.type = 'mcp-customer';
  dialog.innerHTML = customerModalHtml(customer);
  if (!dialog.open) dialog.showModal();
  setGeoDisplayFromFields();
  document.querySelector('#mcpCustomerName')?.focus();
}

async function openEditCustomerModal(customerId) {
  const state = await loadState();
  const customer = state?.customers.find((item) => item.id === customerId);
  if (!customer) return toast('Không tìm thấy khách trong tuyến.');
  openCustomerModal(customer);
}

function setGeoFields({ latitude, longitude, accuracy }) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const acc = Number(accuracy);
  const url = makeGoogleMapsUrl(lat, lng);
  const capturedAt = nowIso();
  setValue('#mcpGeoLat', lat);
  setValue('#mcpGeoLng', lng);
  setValue('#mcpGeoAccuracy', Number.isFinite(acc) ? Math.round(acc) : '');
  setValue('#mcpGeoCapturedAt', capturedAt);
  setValue('#mcpGoogleMapsUrl', url);
  const status = document.querySelector('#mcpGeoStatus');
  if (status) status.textContent = `Đã lấy vị trí: ${lat.toFixed(6)}, ${lng.toFixed(6)}${Number.isFinite(acc) ? ` · độ chính xác ±${Math.round(acc)}m` : ''}`;
  const link = document.querySelector('#mcpGeoMapLink');
  if (link && url) {
    link.href = url;
    link.hidden = false;
  }
}

function requestCustomerLocation() {
  const status = document.querySelector('#mcpGeoStatus');
  if (!navigator.geolocation) {
    if (status) status.textContent = 'Máy/trình duyệt không hỗ trợ lấy vị trí.';
    return toast('Máy không hỗ trợ lấy vị trí.');
  }
  if (status) status.textContent = 'Đang lấy vị trí, vui lòng cho phép quyền GPS...';
  navigator.geolocation.getCurrentPosition(
    (position) => {
      setGeoFields({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      });
      toast('Đã lấy vị trí khách.');
    },
    (error) => {
      const message = error.code === error.PERMISSION_DENIED ? 'Bạn chưa cho phép quyền vị trí.' : 'Không lấy được vị trí. Thử đứng ngoài trời hoặc bật GPS.';
      if (status) status.textContent = message;
      toast(message);
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
  );
}

function activeRouteCustomers(rows, routeId) {
  return rows
    .filter((customer) => customer.route_id === routeId && customer.active !== false)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.customer_name).localeCompare(String(b.customer_name), 'vi'));
}

async function saveCustomer(event) {
  event.preventDefault();
  const state = await loadState();
  if (!state) return toast('Chọn phiên tuyến trước khi thêm khách.');
  const customers = await getAllLocal(LOCAL_STORES.mcpRouteCustomers);
  const form = event.target.closest('[data-mcp-customer-form]');
  const customerId = form?.dataset.customerId || '';
  const existing = customerId ? customers.find((customer) => customer.id === customerId && customer.route_id === state.session.route_id) : null;
  const routeCustomers = activeRouteCustomers(customers, state.session.route_id);
  const name = document.querySelector('#mcpCustomerName')?.value.trim();
  if (!name) return toast('Nhập tên khách trước đã.');
  const geoLat = document.querySelector('#mcpGeoLat')?.value;
  const row = makeMcpRouteCustomer({
    ...(existing || {}),
    id: existing?.id,
    route_id: existing?.route_id || state.session.route_id,
    customer_name: name,
    phone: document.querySelector('#mcpCustomerPhone')?.value,
    area: document.querySelector('#mcpCustomerArea')?.value || state.route.area || state.session.area,
    address: document.querySelector('#mcpCustomerAddress')?.value,
    note: document.querySelector('#mcpCustomerNote')?.value,
    geo_lat: geoLat,
    geo_lng: document.querySelector('#mcpGeoLng')?.value,
    geo_accuracy: document.querySelector('#mcpGeoAccuracy')?.value,
    geo_captured_at: document.querySelector('#mcpGeoCapturedAt')?.value || null,
    geo_source: geoLat ? (existing?.geo_source || 'gps') : '',
    google_maps_url: document.querySelector('#mcpGoogleMapsUrl')?.value,
    sort_order: existing?.sort_order || Math.max(0, ...routeCustomers.map((customer) => Number(customer.sort_order || 0))) + 1,
    active: true,
    sync_status: 'local',
    created_at: existing?.created_at,
    updated_at: nowIso()
  });
  await putLocal(LOCAL_STORES.mcpRouteCustomers, row);
  await recalcMcpRouteSession(state.session.id);
  document.querySelector('#modal')?.close();
  await render();
  if (existing) return toast('Đã lưu khách trong tuyến.');
  toast(row.google_maps_url ? 'Đã thêm khách và lưu vị trí.' : 'Đã thêm khách vào tuyến.');
}

async function setVisitStatus(customerId, status) {
  const state = await loadState();
  if (!state) return toast('Chọn phiên tuyến trước khi cập nhật.');
  const existing = state.visits.find((visit) => visit.route_customer_id === customerId);
  await upsertMcpVisitForSession({
    ...(existing || {}),
    session_id: state.session.id,
    route_customer_id: customerId,
    status,
    has_order: status === 'order' || existing?.has_order,
    has_test: status === 'test' || existing?.has_test,
    has_report: status === 'report' || existing?.has_report,
    note: statusNote[status] || existing?.note || ''
  });
  await render();
  toast(statusLabel[status] ? `Đã cập nhật: ${statusLabel[status]}` : 'Đã cập nhật trạng thái.');
}

async function moveCustomer(customerId, direction) {
  const state = await loadState();
  if (!state) return toast('Chọn phiên tuyến trước khi sắp xếp.');
  const rows = await getAllLocal(LOCAL_STORES.mcpRouteCustomers);
  const routeCustomers = activeRouteCustomers(rows, state.session.route_id);
  const index = routeCustomers.findIndex((customer) => customer.id === customerId);
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (index < 0) return toast('Không tìm thấy khách trong tuyến.');
  if (targetIndex < 0 || targetIndex >= routeCustomers.length) return toast('Khách đã ở đúng đầu/cuối tuyến.');
  const reordered = routeCustomers.slice();
  const [target] = reordered.splice(index, 1);
  reordered.splice(targetIndex, 0, target);
  const now = nowIso();
  for (const [idx, customer] of reordered.entries()) {
    await putLocal(LOCAL_STORES.mcpRouteCustomers, {
      ...customer,
      sort_order: idx + 1,
      sync_status: 'local',
      updated_at: now
    });
  }
  await recalcMcpRouteSession(state.session.id);
  await render();
  toast('Đã đổi thứ tự ghé.');
}

async function hideCustomer(customerId) {
  const state = await loadState();
  if (!state) return toast('Chọn phiên tuyến trước khi ẩn khách.');
  const rows = await getAllLocal(LOCAL_STORES.mcpRouteCustomers);
  const customer = rows.find((item) => item.id === customerId && item.route_id === state.session.route_id);
  if (!customer) return toast('Không tìm thấy khách trong tuyến.');
  const ok = window.confirm(`Ẩn ${customer.customer_name || 'khách này'} khỏi tuyến? Dữ liệu visit cũ vẫn được giữ.`);
  if (!ok) return;
  await putLocal(LOCAL_STORES.mcpRouteCustomers, {
    ...customer,
    active: false,
    sync_status: 'local',
    updated_at: nowIso()
  });
  const activeRows = activeRouteCustomers(rows.filter((item) => item.id !== customerId), state.session.route_id);
  const now = nowIso();
  for (const [idx, row] of activeRows.entries()) {
    await putLocal(LOCAL_STORES.mcpRouteCustomers, { ...row, sort_order: idx + 1, sync_status: 'local', updated_at: now });
  }
  await recalcMcpRouteSession(state.session.id);
  await render();
  toast('Đã ẩn khách khỏi tuyến.');
}

function isInActiveMcpPage(target) {
  return Boolean(target?.closest?.('section.page[data-page="mcp"].active'));
}

function handleMcpActionClick(event) {
  const geoButton = event.target.closest('[data-mcp-get-location]');
  if (geoButton && event.target.closest('#modal[data-type="mcp-customer"]')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    requestCustomerLocation();
    return;
  }
  if (!isInActiveMcpPage(event.target)) return;
  const addButton = event.target.closest('[data-mcp-add-customer]');
  if (addButton) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openCustomerModal();
    return;
  }
  const editButton = event.target.closest('[data-mcp-edit-customer]');
  if (editButton) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openEditCustomerModal(editButton.dataset.customerId);
    return;
  }
  const moveButton = event.target.closest('[data-mcp-move-customer]');
  if (moveButton) {
    event.preventDefault();
    event.stopImmediatePropagation();
    moveCustomer(moveButton.dataset.customerId, moveButton.dataset.mcpMoveCustomer);
    return;
  }
  const hideButton = event.target.closest('[data-mcp-hide-customer]');
  if (hideButton) {
    event.preventDefault();
    event.stopImmediatePropagation();
    hideCustomer(hideButton.dataset.customerId);
    return;
  }
  const filter = event.target.closest('[data-mcp-filter]');
  if (filter) {
    event.preventDefault();
    event.stopImmediatePropagation();
    activeFilter = filter.dataset.mcpFilter || 'all';
    render();
    return;
  }
  const statusButton = event.target.closest('[data-mcp-status]');
  if (statusButton) {
    event.preventDefault();
    event.stopImmediatePropagation();
    setVisitStatus(statusButton.dataset.customerId, statusButton.dataset.mcpStatus);
  }
}

function boot() {
  css();
  page();
  render().catch((error) => {
    console.warn('mcp render failed', error);
    toast('Không mở được dữ liệu MCP local.');
  });
}

window.addEventListener('click', handleMcpActionClick, true);

document.addEventListener('submit', (event) => {
  if (!event.target.matches('[data-mcp-customer-form]')) return;
  saveCustomer(event);
});

window.addEventListener('mcp:session-changed', () => render());
boot();
window.addEventListener('DOMContentLoaded', boot);
