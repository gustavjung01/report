import { getOrderRevenueDataset, buildRevenueSummary } from './order-summary.js?v=revenue-1';

let currentRange = 'today';
let currentTab = 'overview';

function esc(value = '') {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function money(value = 0) {
  const amount = Number(value || 0);
  return `${amount.toLocaleString('vi-VN')}đ`;
}

function localDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function monthStart(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function filtersForRange(range = currentRange) {
  const now = new Date();
  if (range === 'today') return { date_from: localDate(now), date_to: localDate(now) };
  if (range === '7d') return { date_from: localDate(addDays(now, -6)), date_to: localDate(now) };
  if (range === 'month') return { date_from: monthStart(now), date_to: localDate(now) };
  return {};
}

function labelForRange(range = currentRange) {
  if (range === 'today') return 'Hôm nay';
  if (range === '7d') return '7 ngày';
  if (range === 'month') return 'Tháng này';
  return 'Tất cả';
}

function ensurePage() {
  if (document.querySelector('section.page[data-page="revenue-shell"]')) return;
  const main = document.querySelector('main');
  if (!main) return;
  main.insertAdjacentHTML('beforeend', '<section class="page shell-page revenue-page" data-page="revenue-shell"></section>');
}

function showRevenuePage() {
  ensurePage();
  document.querySelectorAll('.page').forEach((element) => element.classList.toggle('active', element.dataset.page === 'revenue-shell'));
  document.querySelectorAll('.nav button').forEach((button) => button.classList.toggle('active', button.dataset.page === 'create'));
  const subtitle = document.querySelector('#subtitle');
  if (subtitle) subtitle.textContent = 'Doanh thu';
  renderRevenue();
}

function ensureHomeCard() {
  const grid = document.querySelector('section.page[data-page="create"] .grid-actions');
  if (!grid || grid.querySelector('[data-home-card="revenue"]')) return;
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'card home-card card-revenue';
  card.dataset.homeCard = 'revenue';
  card.dataset.page = 'revenue-shell';
  card.innerHTML = '<i>💰</i><b>Doanh thu</b><small>Theo khách, ngành, SKU, tuyến.</small><em>Xem số liệu</em>';
  const orderCard = grid.querySelector('.card-order, [data-page="order-shell"]');
  if (orderCard?.nextSibling) grid.insertBefore(card, orderCard.nextSibling);
  else grid.appendChild(card);
}

function ensureCss() {
  if (document.querySelector('style[data-revenue-ui]')) return;
  const style = document.createElement('style');
  style.dataset.revenueUi = '1';
  style.textContent = `
    section.page[data-page="create"] .card-revenue{background:#fff7e8}
    section.page[data-page="revenue-shell"]{overflow:auto;padding-bottom:18px}
    .revenue-page .shell-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px}
    .revenue-page .shell-title h1{margin:0;font-size:24px;color:#082337}.revenue-page .shell-title p{margin:3px 0 0;color:#63727c;font-size:12px;font-weight:800}
    .revenue-page .shell-back{border:1px solid #d7e6e2;background:#fff;border-radius:999px;min-height:36px;padding:0 12px;font-weight:950;color:#17343d}
    .revenue-hero{border:1px solid #9bdccd;border-radius:20px;background:linear-gradient(135deg,#00957f,#007866);color:#fff;padding:14px;margin-bottom:10px;display:grid;gap:4px;box-shadow:0 12px 28px rgba(0,120,102,.16)}
    .revenue-hero b{font-size:18px}.revenue-hero small{opacity:.88;font-weight:850}
    .revenue-filters{display:flex;gap:7px;overflow:auto;margin:0 0 10px;padding-bottom:1px}.revenue-filter{border:1px solid #d7e6e2;border-radius:999px;background:#fff;min-height:34px;padding:0 12px;white-space:nowrap;color:#17343d;font-size:12px;font-weight:950}.revenue-filter.active{background:#00957f;border-color:#00957f;color:#fff}
    .revenue-kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:10px}.revenue-kpi{border:1px solid #dce8e5;border-radius:17px;background:#fff;padding:11px;display:grid;gap:3px;box-shadow:0 8px 18px rgba(12,55,50,.055)}.revenue-kpi b{font-size:20px;color:#082337;line-height:1.08}.revenue-kpi span{font-size:11px;color:#63727c;font-weight:850}
    .revenue-tabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin-bottom:10px}.revenue-tab{border:1px solid #d7e6e2;border-radius:14px;background:#fff;min-height:38px;font-size:12px;font-weight:950;color:#17343d}.revenue-tab.active{background:#eafff8;border-color:#9bdccd;color:#007866}
    .revenue-list{display:grid;gap:8px}.revenue-row{border:1px solid #dce8e5;border-radius:16px;background:#fff;padding:10px;display:grid;gap:5px}.revenue-row-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.revenue-row b{color:#082337}.revenue-row strong{white-space:nowrap;color:#007866}.revenue-row small{color:#63727c;font-weight:800}.revenue-empty{border:1px dashed #cfe2dc;border-radius:16px;background:#fff;padding:18px;text-align:center;color:#63727c;font-weight:850}
  `;
  document.head.appendChild(style);
}

function kpiHtml(kpis = {}) {
  return `<div class="revenue-kpis">
    <article class="revenue-kpi"><b>${esc(money(kpis.revenue))}</b><span>Tổng doanh thu</span></article>
    <article class="revenue-kpi"><b>${esc(kpis.order_count || 0)}</b><span>Số đơn</span></article>
    <article class="revenue-kpi"><b>${esc(kpis.customer_count || 0)}</b><span>Khách mua</span></article>
    <article class="revenue-kpi"><b>${esc(kpis.sku_count || 0)}</b><span>SKU bán</span></article>
    <article class="revenue-kpi"><b>${esc(kpis.quantity || 0)}</b><span>Tổng số lượng</span></article>
    <article class="revenue-kpi"><b>${esc(money(kpis.average_order_value))}</b><span>Giá trị đơn TB</span></article>
  </div>`;
}

function rowHtml(row = {}, mode = '') {
  const sub = [];
  if (row.order_count !== undefined) sub.push(`${row.order_count} đơn`);
  if (row.quantity !== undefined) sub.push(`SL ${row.quantity}`);
  if (mode === 'sku' && row.product_name) sub.push(row.product_name);
  if (mode === 'industry' && row.industry_key) sub.push(row.industry_key);
  if (mode === 'customer' && row.area) sub.push(row.area);
  if (mode === 'route' && row.area) sub.push(row.area);
  return `<article class="revenue-row"><div class="revenue-row-head"><b>${esc(row.label || row.key || 'Chưa rõ')}</b><strong>${esc(money(row.revenue))}</strong></div><small>${esc(sub.filter(Boolean).join(' · ') || 'Chưa có chi tiết')}</small></article>`;
}

function listHtml(rows = [], mode = '') {
  const top = rows.slice(0, 30);
  if (!top.length) return '<div class="revenue-empty">Chưa có dữ liệu doanh thu trong khoảng này.</div>';
  return `<div class="revenue-list">${top.map((row) => rowHtml(row, mode)).join('')}</div>`;
}

function bodyForTab(summary = {}) {
  if (currentTab === 'customer') return listHtml(summary.by_customer, 'customer');
  if (currentTab === 'industry') return listHtml(summary.by_industry, 'industry');
  if (currentTab === 'sku') return listHtml(summary.by_sku, 'sku');
  if (currentTab === 'route') return listHtml(summary.by_route, 'route');
  return `${listHtml(summary.by_customer?.slice(0, 5), 'customer')}${listHtml(summary.by_sku?.slice(0, 5), 'sku')}`;
}

function shellHtml(summary = {}) {
  const kpis = summary.kpis || {};
  return `<div class="shell-top"><div class="shell-title"><h1>Doanh thu</h1><p>${esc(labelForRange())} · theo khách/ngành/SKU/tuyến</p></div><div class="shell-top-actions"><button type="button" class="shell-back" data-page="create">Home</button></div></div>
    <article class="revenue-hero"><b>${esc(money(kpis.revenue))}</b><small>${esc(kpis.order_count || 0)} đơn · ${esc(kpis.customer_count || 0)} khách · ${esc(kpis.sku_count || 0)} SKU</small></article>
    <div class="revenue-filters">
      ${['today','7d','month','all'].map((range) => `<button type="button" class="revenue-filter ${currentRange === range ? 'active' : ''}" data-revenue-range="${range}">${esc(labelForRange(range))}</button>`).join('')}
    </div>
    ${kpiHtml(kpis)}
    <div class="revenue-tabs">
      <button type="button" class="revenue-tab ${currentTab === 'overview' ? 'active' : ''}" data-revenue-tab="overview">Tổng</button>
      <button type="button" class="revenue-tab ${currentTab === 'customer' ? 'active' : ''}" data-revenue-tab="customer">Khách</button>
      <button type="button" class="revenue-tab ${currentTab === 'industry' ? 'active' : ''}" data-revenue-tab="industry">Ngành</button>
      <button type="button" class="revenue-tab ${currentTab === 'sku' ? 'active' : ''}" data-revenue-tab="sku">SKU</button>
      <button type="button" class="revenue-tab ${currentTab === 'route' ? 'active' : ''}" data-revenue-tab="route">Tuyến</button>
    </div>
    ${bodyForTab(summary)}`;
}

async function renderRevenue() {
  ensureCss();
  ensurePage();
  ensureHomeCard();
  const section = document.querySelector('section.page[data-page="revenue-shell"]');
  if (!section) return;
  section.innerHTML = '<div class="revenue-empty">Đang tính doanh thu...</div>';
  try {
    const dataset = await getOrderRevenueDataset(filtersForRange());
    const summary = buildRevenueSummary(dataset);
    section.innerHTML = shellHtml(summary);
  } catch (error) {
    console.warn('revenue render failed', error);
    section.innerHTML = '<div class="revenue-empty">Không tính được doanh thu local.</div>';
  }
}

function boot() {
  ensureCss();
  ensurePage();
  ensureHomeCard();
  renderRevenue();
}

document.addEventListener('click', (event) => {
  const revenueTrigger = event.target.closest('[data-page="revenue-shell"], [data-home-card="revenue"]');
  if (revenueTrigger) {
    event.preventDefault();
    event.stopImmediatePropagation();
    showRevenuePage();
    return;
  }
  const range = event.target.closest('[data-revenue-range]');
  if (range) {
    event.preventDefault();
    currentRange = range.dataset.revenueRange || 'today';
    renderRevenue();
    return;
  }
  const tab = event.target.closest('[data-revenue-tab]');
  if (tab) {
    event.preventDefault();
    currentTab = tab.dataset.revenueTab || 'overview';
    renderRevenue();
  }
}, true);

window.addEventListener('order:changed', renderRevenue);
window.addEventListener('mcp:session-changed', renderRevenue);
window.addEventListener('DOMContentLoaded', boot);
boot();
