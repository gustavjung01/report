import {
  DEFAULT_ONA_PRODUCTS,
  makeOrder,
  makeOrderItem,
  makeOnaTest,
  makeOnaTestItem,
  makeMarketReport,
  makeMarketReportProduct,
  makeMarketReportCompetitor,
  makeAiSummary,
  uid,
  todayIsoDate
} from './data-model.js';

import {
  configureSupabaseV2,
  readSupabaseSettings,
  isSupabaseV2Ready,
  loadProducts,
  syncOrder,
  syncOnaTest,
  syncMarketReport,
  syncAiSummary
} from './supabase-v2.js';

import {
  LOCAL_STORES,
  openLocalDb,
  getAllLocal,
  putLocal,
  putManyLocal,
  enqueueLocalSync,
  getSyncQueue,
  updateSyncJob,
  clearDoneSyncJobs,
  localStats
} from './local-db.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const TEST_STATUSES = [['pending','Chưa thử'],['ok','OK'],['interested','Quan tâm'],['sample','Cần mẫu'],['follow','Báo sau'],['bad','Chưa tốt'],['retry','Thử lại']];
const LABELS = { draft:'Nháp', pending_confirm:'Chờ xác nhận', confirmed:'Đã chốt', delivering:'Đang giao', delivered:'Đã giao', cancelled:'Hủy', pending:'Chưa thử', ok:'OK', interested:'Quan tâm', sample:'Cần mẫu', follow:'Báo sau', bad:'Chưa tốt', retry:'Thử lại' };
let products = DEFAULT_ONA_PRODUCTS.map((p) => ({ ...p, active: true, wholesale_price: 0, retail_price: 0 }));
let activeFilter = 'today';

function esc(v = '') { return String(v ?? '').replace(/[&<>'"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c])); }
function money(v = 0) { return `${Math.round(Number(v) || 0).toLocaleString('vi-VN')}đ`; }
function toast(m) { const t = $('#toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2800); }
function opt(list, selected = '') { return list.map(([v, l]) => `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(l)}</option>`).join(''); }
function prodOpt(selected = '') { return products.map((p) => `<option value="${esc(p.id)}" ${p.id === selected ? 'selected' : ''}>${esc(p.name)}</option>`).join(''); }
function product(id) { return products.find((p) => p.id === id) || products[0] || {}; }
function ready() { configureSupabaseV2(readSupabaseSettings()); return navigator.onLine && isSupabaseV2Ready(); }
function dt(v = '') { const [y, m, d] = String(v).slice(0, 10).split('-'); return d ? `${d}/${m}/${y}` : v; }
function badge(s) { return s === 'synced' ? '<em class="sync-dot ok">Đã đồng bộ</em>' : s === 'error' ? '<em class="sync-dot danger">Lỗi sync</em>' : '<em class="sync-dot warn">Chờ sync</em>'; }
function sc(s) { return ['ok','confirmed','delivered','synced'].includes(s) ? 'ok' : ['interested','sample','follow','retry'].includes(s) ? 'blue' : ['bad','cancelled','error'].includes(s) ? 'danger-soft' : 'muted'; }

function setDbBadge() {
  const pill = $('#dbStatusPill');
  if (!pill) return;
  pill.classList.toggle('off', !ready());
  const text = $('b', pill);
  if (text) text.textContent = ready() ? 'Online Sync' : 'Local DB';
}

function closeForms() {
  ['#orderFormPanel', '#testFormPanel', '#marketFormPanel'].forEach((s) => { const p = $(s); if (p) p.hidden = true; });
}
function openPanel(s) { closeForms(); const p = $(s); if (p) { p.hidden = false; p.scrollIntoView({ behavior:'smooth', block:'start' }); } }

function injectForms() {
  const orderPanel = $('#orderFormPanel');
  if (!orderPanel) return;
  if (!$('#testFormPanel')) orderPanel.insertAdjacentHTML('afterend', `
    <section class="panel-card" id="testFormPanel" hidden>
      <div class="section-head"><div><h2>Tạo test sản phẩm</h2><p>Lưu Local DB trước, đồng bộ ona_tests sau.</p></div><button data-close-local-form type="button">Đóng</button></div>
      <form id="testFormLocal" class="order-form">
        <div class="form-grid two"><label><span>Ngày test</span><input id="testDateLocal" type="date" required></label><label><span>Sales</span><input id="testSalesLocal" value="A Tân"></label></div>
        <div class="form-grid two"><label><span>Khách hàng</span><input id="testCustomerLocal" required></label><label><span>SĐT</span><input id="testPhoneLocal" type="tel"></label></div>
        <div class="form-grid two"><label><span>Khu vực</span><input id="testAreaLocal"></label><label><span>Loại quán</span><input id="testShopLocal"></label></div>
        <div class="form-grid two"><label><span>Trạng thái chung</span><select id="testOverallLocal">${opt(TEST_STATUSES)}</select></label><label><span>Hẹn báo lại</span><input id="testFollowLocal" type="date"></label></div>
        <label class="check-row"><input id="testSampleLocal" type="checkbox"><span>Cần mẫu / gửi thêm</span></label>
        <div id="testItemsLocal" class="order-items"></div>
        <label><span>Ghi chú test</span><textarea id="testNoteLocal" rows="2"></textarea></label>
        <div class="sticky-actions"><button type="button" id="resetTestLocal">Xóa form</button><button class="primary" type="submit">Lưu phiếu test</button></div>
      </form>
    </section>`);
  if (!$('#marketFormPanel')) $('#testFormPanel').insertAdjacentHTML('afterend', `
    <section class="panel-card" id="marketFormPanel" hidden>
      <div class="section-head"><div><h2>Tạo báo cáo thị trường</h2><p>Lưu market_reports, sản phẩm và đối thủ riêng.</p></div><button data-close-local-form type="button">Đóng</button></div>
      <form id="marketFormLocal" class="order-form">
        <div class="form-grid two"><label><span>Ngày</span><input id="marketDateLocal" type="date" required></label><label><span>Sales</span><input id="marketSalesLocal" value="A Tân"></label></div>
        <div class="form-grid two"><label><span>Khu vực</span><input id="marketAreaLocal" required></label><label><span>Tuyến</span><input id="marketRouteLocal"></label></div>
        <div class="form-grid two"><label><span>Loại thị trường</span><input id="marketTypeLocal"></label><label><span>Số điểm ghé</span><input id="marketShopsLocal" type="number" min="0"></label></div>
        <label><span>Tóm tắt đối thủ</span><textarea id="marketCompetitorLocal" rows="2"></textarea></label>
        <label><span>Tóm tắt giá</span><textarea id="marketPriceLocal" rows="2"></textarea></label>
        <label><span>Nhu cầu</span><textarea id="marketDemandLocal" rows="2"></textarea></label>
        <div class="section-head"><h2>Sản phẩm ghi nhận</h2><button type="button" id="addMarketProductLocal">＋ SP</button></div><div id="marketProductsLocal" class="order-items"></div>
        <div class="section-head"><h2>Đối thủ / giá gặp</h2><button type="button" id="addMarketRivalLocal">＋ Đối thủ</button></div><div id="marketRivalsLocal" class="order-items"></div>
        <label><span>Cơ hội</span><textarea id="marketOpportunityLocal" rows="2"></textarea></label><label><span>Rủi ro</span><textarea id="marketRiskLocal" rows="2"></textarea></label><label><span>Việc tiếp theo</span><input id="marketNextLocal"></label><label><span>Ghi chú</span><textarea id="marketNoteLocal" rows="2"></textarea></label>
        <div class="sticky-actions"><button type="button" id="resetMarketLocal">Xóa form</button><button class="primary" type="submit">Lưu báo cáo</button></div>
      </form>
    </section>`);
}

function renderTestProducts() {
  const box = $('#testItemsLocal');
  if (!box) return;
  box.innerHTML = products.map((p) => `<article class="order-item-row test-product-row" data-id="${esc(p.id)}" data-name="${esc(p.name)}"><strong>${esc(p.name)}</strong><select class="test-status-local">${opt(TEST_STATUSES)}</select><input class="test-note-local" placeholder="Ghi chú nhanh"></article>`).join('');
}
function addMarketProduct() { $('#marketProductsLocal')?.insertAdjacentHTML('beforeend', `<article class="order-item-row market-product-row"><label><span>Sản phẩm</span><select class="market-product-local">${prodOpt()}</select></label><label><span>Phản hồi</span><input class="market-feedback-local"></label><footer><button type="button" class="remove-local-row">Xóa</button></footer></article>`); }
function addMarketRival() { $('#marketRivalsLocal')?.insertAdjacentHTML('beforeend', `<article class="order-item-row market-rival-row"><div class="form-grid two"><label><span>Đối thủ</span><input class="rival-name-local"></label><label><span>Giá</span><input class="rival-price-local"></label></div><label><span>Nhận xét</span><input class="rival-note-local"></label><footer><button type="button" class="remove-local-row">Xóa</button></footer></article>`); }
function resetTest() { $('#testFormLocal')?.reset(); if ($('#testDateLocal')) $('#testDateLocal').value = todayIsoDate(); if ($('#testSalesLocal')) $('#testSalesLocal').value = 'A Tân'; renderTestProducts(); }
function resetMarket() { $('#marketFormLocal')?.reset(); if ($('#marketDateLocal')) $('#marketDateLocal').value = todayIsoDate(); if ($('#marketSalesLocal')) $('#marketSalesLocal').value = 'A Tân'; if ($('#marketProductsLocal')) { $('#marketProductsLocal').innerHTML = ''; addMarketProduct(); } if ($('#marketRivalsLocal')) { $('#marketRivalsLocal').innerHTML = ''; addMarketRival(); } }

async function refreshProducts() {
  const local = await getAllLocal(LOCAL_STORES.products);
  if (local.length) products = local;
  if (ready()) {
    try {
      const remote = await loadProducts();
      if (remote.length) { products = remote.map((p) => ({ ...p, sync_status:'synced' })); await putManyLocal(LOCAL_STORES.products, products); }
    } catch (error) { console.warn('Không pull được products, dùng local/fallback.', error); }
  }
  if (!products.length) { products = DEFAULT_ONA_PRODUCTS.map((p) => ({ ...p, active:true, wholesale_price:0, retail_price:0 })); await putManyLocal(LOCAL_STORES.products, products); }
  const seed = $('#productSeedList');
  if (seed) seed.innerHTML = products.map((p) => `<span>${esc(p.name)}</span>`).join('');
  renderTestProducts();
}

function orderTotals() {
  let subtotal = 0, discount_total = 0;
  $$('.order-item-row', $('#orderItems')).forEach((r) => { const q = Number($('.line-qty', r)?.value || 0); const p = Number($('.line-price', r)?.value || 0); const d = Number($('.line-discount', r)?.value || 0); subtotal += q * p; discount_total += d; const total = $('.line-total', r); if (total) total.textContent = money(Math.max(q * p - d, 0)); });
  $('#orderSubtotal').textContent = money(subtotal); $('#orderDiscountTotal').textContent = money(discount_total); $('#orderGrandTotal').textContent = money(Math.max(subtotal - discount_total, 0));
  return { subtotal, discount_total, grand_total: Math.max(subtotal - discount_total, 0) };
}

async function saveOrderLocal(event) {
  event.preventDefault(); event.stopImmediatePropagation();
  const n = (await getAllLocal(LOCAL_STORES.orders)).length + 1;
  const order = makeOrder({ id: uid('order'), order_code: `DH${todayIsoDate().replaceAll('-', '').slice(2)}${String(n).padStart(3, '0')}`, order_date: $('#orderDate').value || todayIsoDate(), sales: $('#orderSales').value, customer_name: $('#orderCustomerName').value, customer_phone: $('#orderCustomerPhone').value, area: $('#orderArea').value, delivery_address: $('#orderDeliveryAddress').value, status: $('#orderStatus').value, note: $('#orderNote').value, sync_status:'pending', ...orderTotals() });
  const items = $$('.order-item-row', $('#orderItems')).map((r) => { const p = product($('.order-product-select', r).value); return makeOrderItem({ id: uid('order-item'), order_id: order.id, product_id: p.id, product_name: p.name, sku: p.sku, unit: p.unit, quantity: $('.line-qty', r).value, unit_price: $('.line-price', r).value, discount: $('.line-discount', r).value, note: $('.line-note', r).value }); }).filter((i) => i.product_name && Number(i.quantity) > 0);
  if (!order.customer_name) return toast('Thiếu tên khách hàng.'); if (!items.length) return toast('Đơn hàng cần ít nhất 1 sản phẩm.');
  await putLocal(LOCAL_STORES.orders, order); await putManyLocal(LOCAL_STORES.orderItems, items); await enqueueLocalSync('order', order.id, { order, items });
  await syncQueue(true); closeForms(); await renderAll(); toast('Đã lưu đơn vào Local DB.');
}

async function saveTestLocal(event) {
  event.preventDefault(); event.stopImmediatePropagation();
  const test = makeOnaTest({ id: uid('ona-test'), test_date: $('#testDateLocal').value || todayIsoDate(), sales: $('#testSalesLocal').value, customer_name: $('#testCustomerLocal').value, customer_phone: $('#testPhoneLocal').value, area: $('#testAreaLocal').value, shop_type: $('#testShopLocal').value, follow_date: $('#testFollowLocal').value || null, need_sample: $('#testSampleLocal').checked, overall_status: $('#testOverallLocal').value, overall_note: $('#testNoteLocal').value, sync_status:'pending' });
  const items = $$('.test-product-row').map((r) => makeOnaTestItem({ id: uid('ona-test-item'), test_id: test.id, product_id: r.dataset.id, product_name: r.dataset.name, status: $('.test-status-local', r).value, note: $('.test-note-local', r).value })).filter((i) => i.status !== 'pending' || i.note);
  if (!test.customer_name) return toast('Thiếu tên khách hàng test.'); if (!items.length && !test.overall_note) return toast('Phiếu test cần phản hồi hoặc ghi chú.');
  await putLocal(LOCAL_STORES.onaTests, test); await putManyLocal(LOCAL_STORES.onaTestItems, items); await enqueueLocalSync('ona_test', test.id, { test, items });
  await syncQueue(true); resetTest(); closeForms(); await renderAll(); toast('Đã lưu phiếu test vào Local DB.');
}

async function saveMarketLocal(event) {
  event.preventDefault(); event.stopImmediatePropagation();
  const report = makeMarketReport({ id: uid('market-report'), report_date: $('#marketDateLocal').value || todayIsoDate(), sales: $('#marketSalesLocal').value, market_area: $('#marketAreaLocal').value, route_name: $('#marketRouteLocal').value, market_type: $('#marketTypeLocal').value, total_shops: $('#marketShopsLocal').value, competitor_summary: $('#marketCompetitorLocal').value, price_summary: $('#marketPriceLocal').value, demand_summary: $('#marketDemandLocal').value, opportunity_summary: $('#marketOpportunityLocal').value, risk_summary: $('#marketRiskLocal').value, next_action: $('#marketNextLocal').value, note: $('#marketNoteLocal').value, sync_status:'pending' });
  const reportProducts = $$('.market-product-row').map((r) => { const p = product($('.market-product-local', r).value); return makeMarketReportProduct({ id: uid('market-product'), market_report_id: report.id, product_id: p.id, product_name: p.name, feedback: $('.market-feedback-local', r).value }); }).filter((i) => i.feedback);
  const competitors = $$('.market-rival-row').map((r) => makeMarketReportCompetitor({ id: uid('market-competitor'), market_report_id: report.id, competitor_name: $('.rival-name-local', r).value, price_range: $('.rival-price-local', r).value, note: $('.rival-note-local', r).value })).filter((i) => i.competitor_name || i.price_range || i.note);
  if (!report.market_area) return toast('Thiếu khu vực thị trường.'); if (!report.competitor_summary && !report.price_summary && !report.demand_summary && !reportProducts.length && !competitors.length) return toast('Báo cáo cần thông tin thị trường.');
  await putLocal(LOCAL_STORES.marketReports, report); await putManyLocal(LOCAL_STORES.marketReportProducts, reportProducts); await putManyLocal(LOCAL_STORES.marketReportCompetitors, competitors); await enqueueLocalSync('market_report', report.id, { report, products: reportProducts, competitors });
  await syncQueue(true); resetMarket(); closeForms(); await renderAll(); toast('Đã lưu báo cáo thị trường vào Local DB.');
}

async function runJob(job) {
  const at = new Date().toISOString();
  if (job.type === 'order') return syncOrder({ ...job.payload.order, sync_status:'synced', synced_at: at }, job.payload.items || []);
  if (job.type === 'ona_test') return syncOnaTest({ ...job.payload.test, sync_status:'synced', synced_at: at }, job.payload.items || []);
  if (job.type === 'market_report') return syncMarketReport({ ...job.payload.report, sync_status:'synced', synced_at: at }, job.payload.products || [], job.payload.competitors || []);
  if (job.type === 'ai_summary') return syncAiSummary({ ...job.payload, status:'done', sync_status:'synced', synced_at: at });
  throw new Error(`Chưa hỗ trợ sync type ${job.type}`);
}
async function markDone(job) {
  const at = new Date().toISOString();
  if (job.type === 'order') await putLocal(LOCAL_STORES.orders, { ...job.payload.order, sync_status:'synced', synced_at: at });
  if (job.type === 'ona_test') await putLocal(LOCAL_STORES.onaTests, { ...job.payload.test, sync_status:'synced', synced_at: at });
  if (job.type === 'market_report') await putLocal(LOCAL_STORES.marketReports, { ...job.payload.report, sync_status:'synced', synced_at: at });
  if (job.type === 'ai_summary') await putLocal(LOCAL_STORES.aiSummaries, { ...job.payload, status:'done', sync_status:'synced', synced_at: at });
}
async function syncQueue(silent = false) {
  setDbBadge();
  if (!ready()) { if (!silent) toast('Đang offline, dữ liệu nằm trong Local DB.'); return; }
  let ok = 0, fail = 0;
  for (const job of await getSyncQueue()) {
    if (job.status === 'done') continue;
    await updateSyncJob(job.id, { status:'syncing', attempts: Number(job.attempts || 0) + 1, last_error:'' });
    try { await runJob(job); await markDone(job); await updateSyncJob(job.id, { status:'done' }); ok += 1; }
    catch (error) { await updateSyncJob(job.id, { status:'error', last_error: error.message || String(error) }); fail += 1; }
  }
  await clearDoneSyncJobs(); await renderAll(); if (!silent) toast(`Đồng bộ: ${ok} thành công, ${fail} lỗi.`);
}

function inFilter(rows, field) {
  if (activeFilter === 'unsynced') return rows.filter((r) => r.sync_status !== 'synced');
  const today = new Date(`${todayIsoDate()}T00:00:00`).getTime();
  const min = activeFilter === '7days' ? today - 6 * 86400000 : activeFilter === 'month' ? new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() : today;
  return rows.filter((r) => new Date(`${r[field]}T00:00:00`).getTime() >= min);
}

async function renderAll() {
  const [orders, orderItems, tests, testItems, reports, reportProducts, competitors, customers] = await Promise.all([getAllLocal(LOCAL_STORES.orders), getAllLocal(LOCAL_STORES.orderItems), getAllLocal(LOCAL_STORES.onaTests), getAllLocal(LOCAL_STORES.onaTestItems), getAllLocal(LOCAL_STORES.marketReports), getAllLocal(LOCAL_STORES.marketReportProducts), getAllLocal(LOCAL_STORES.marketReportCompetitors), getAllLocal(LOCAL_STORES.customers)]);
  const orderRows = inFilter(orders, 'order_date').sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  if ($('#orderList')) $('#orderList').innerHTML = orderRows.length ? orderRows.map((o) => `<article class="record-card"><div><h3>${esc(o.order_code || o.id)}</h3><p>Khách: ${esc(o.customer_name)} ${o.area ? '- ' + esc(o.area) : ''}</p><p>${orderItems.filter((i) => i.order_id === o.id).length} sản phẩm · ${money(o.grand_total)}</p><small>${dt(o.order_date)} · ${esc(o.sales)}</small></div><aside><span class="status ${sc(o.status)}">${LABELS[o.status] || o.status}</span>${badge(o.sync_status)}</aside></article>`).join('') : '<article class="record-card placeholder-card"><div><h3>Chưa có đơn hàng</h3><p>Bấm Tạo → Đơn hàng để tạo đơn đầu tiên.</p></div></article>';
  const testRows = inFilter(tests, 'test_date').sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  if ($('[data-data-panel="tests"]')) $('[data-data-panel="tests"]').innerHTML = testRows.length ? testRows.map((t) => `<article class="record-card"><div><h3>${esc(t.customer_name)}</h3><p>${esc(t.area || '-')} · ${testItems.filter((i) => i.test_id === t.id).length} sản phẩm có phản hồi</p><p>${esc(t.overall_note || 'Đã ghi nhận test')}</p><small>${dt(t.test_date)} · ${esc(t.sales)}</small></div><aside><span class="status ${sc(t.overall_status)}">${LABELS[t.overall_status] || t.overall_status}</span>${badge(t.sync_status)}</aside></article>`).join('') : '<article class="record-card placeholder-card"><div><h3>Chưa có phiếu test</h3><p>Bấm Tạo → Test sản phẩm để ghi phản hồi thật.</p></div></article>';
  const reportRows = inFilter(reports, 'report_date').sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  if ($('[data-data-panel="reports"]')) $('[data-data-panel="reports"]').innerHTML = reportRows.length ? reportRows.map((r) => `<article class="record-card"><div><h3>${esc(r.market_area)}</h3><p>${reportProducts.filter((p) => p.market_report_id === r.id).length} sản phẩm · ${competitors.filter((c) => c.market_report_id === r.id).length} đối thủ</p><p>${esc(r.opportunity_summary || r.demand_summary || r.next_action || 'Đã ghi nhận')}</p><small>${dt(r.report_date)} · ${esc(r.sales)}</small></div><aside><span class="status muted">Báo cáo</span>${badge(r.sync_status)}</aside></article>`).join('') : '<article class="record-card placeholder-card"><div><h3>Chưa có báo cáo thị trường</h3><p>Bấm Tạo → Báo cáo thị trường để ghi đối thủ, giá, nhu cầu.</p></div></article>';
  if ($('#customerList')) { const map = new Map(); [...orders, ...tests].forEach((r) => { if (r.customer_name) map.set(`${r.customer_name}|${r.customer_phone || ''}`, { name:r.customer_name, phone:r.customer_phone, area:r.area }); }); const rows = customers.length ? customers : Array.from(map.values()); $('#customerList').innerHTML = rows.length ? rows.map((c) => `<article class="record-card"><div><h3>${esc(c.name || c.customer_name)}</h3><p>${esc(c.phone || '')} ${c.area ? '· ' + esc(c.area) : ''}</p><small>Khách hàng</small></div><aside><span class="status muted">Khách</span></aside></article>`).join('') : '<article class="record-card placeholder-card"><div><h3>Chưa có khách hàng</h3><p>Khách tự tạo từ đơn hàng và phiếu test.</p></div></article>'; }
  if ($('#recentList')) { const rows = [...orders.map((o) => ({ icon:'🛒', title:`Đơn ${o.order_code || o.customer_name}`, sub:`${dt(o.order_date)} · ${money(o.grand_total)}`, status:o.sync_status, at:o.created_at })), ...tests.map((t) => ({ icon:'🍵', title:`Test ${t.customer_name}`, sub:`${dt(t.test_date)} · ${t.area || ''}`, status:t.sync_status, at:t.created_at })), ...reports.map((r) => ({ icon:'📍', title:`TT ${r.market_area}`, sub:`${dt(r.report_date)} · ${r.next_action || ''}`, status:r.sync_status, at:r.created_at }))].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 4); $('#recentList').innerHTML = rows.length ? rows.map((r) => `<article class="mini-row"><span class="mini-icon">${r.icon}</span><div><strong>${esc(r.title)}</strong><small>${esc(r.sub)}</small></div>${badge(r.status)}</article>`).join('') : '<article class="mini-row"><span class="mini-icon">▯</span><div><strong>Chưa có dữ liệu</strong><small>Tạo đơn, test hoặc báo cáo để bắt đầu.</small></div><em class="sync-dot warn">Local DB</em></article>'; }
  const stats = await localStats(); if ($('#localRecordCount')) $('#localRecordCount').textContent = String(stats.records); if ($('#pendingSyncCount')) $('#pendingSyncCount').textContent = String(stats.pending); if ($('#errorSyncCount')) $('#errorSyncCount').textContent = String(stats.error);
  const metric = $('.metric-row'); if (metric) metric.innerHTML = `<div><strong id="aiOrderCount">${orders.length}</strong><small>Đơn hàng</small></div><div><strong>${tests.length}</strong><small>Phiếu test</small></div><div><strong>${reports.length}</strong><small>Báo cáo</small></div>`;
}

async function aiSummary() {
  const [orders, orderItems, tests, reports] = await Promise.all([getAllLocal(LOCAL_STORES.orders), getAllLocal(LOCAL_STORES.orderItems), getAllLocal(LOCAL_STORES.onaTests), getAllLocal(LOCAL_STORES.marketReports)]);
  const revenue = orders.reduce((sum, o) => sum + Number(o.grand_total || 0), 0);
  const top = Object.entries(orderItems.reduce((acc, i) => { acc[i.product_name] = (acc[i.product_name] || 0) + Number(i.quantity || 0); return acc; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, qty]) => `${name} (${qty})`);
  const summary = makeAiSummary({ id: uid('ai-summary'), title:`Tổng hợp ${todayIsoDate()}`, summary_type:'company_report', date_to: todayIsoDate(), source_refs:[...orders.map((r) => ({ type:'order', id:r.id })), ...tests.map((r) => ({ type:'ona_test', id:r.id })), ...reports.map((r) => ({ type:'market_report', id:r.id }))], result:{ revenue, top }, status:'done', sync_status:'pending' });
  await putLocal(LOCAL_STORES.aiSummaries, summary); await enqueueLocalSync('ai_summary', summary.id, summary); await syncQueue(true);
  const box = $('.ai-result'); if (box) box.innerHTML = `<h2>Kết quả tổng hợp</h2><details open><summary>📌 Tóm tắt điều hành</summary><p>Có ${orders.length} đơn, ${tests.length} phiếu test, ${reports.length} báo cáo. Doanh số ghi nhận: ${money(revenue)}.</p></details><details open><summary>💰 Sản phẩm bán chạy</summary><p>${esc(top.join(', ') || 'Chưa có dữ liệu đơn hàng')}</p></details>`;
  toast('Đã tổng hợp từ dữ liệu thật.');
}

function bind() {
  document.addEventListener('submit', (e) => { if (e.target.id === 'orderForm') saveOrderLocal(e); if (e.target.id === 'testFormLocal') saveTestLocal(e); if (e.target.id === 'marketFormLocal') saveMarketLocal(e); }, true);
  document.addEventListener('click', (e) => {
    const create = e.target.closest('[data-create-type]');
    if (create) { e.preventDefault(); e.stopImmediatePropagation(); if (create.dataset.createType === 'order') openPanel('#orderFormPanel'); if (create.dataset.createType === 'test') { resetTest(); openPanel('#testFormPanel'); } if (create.dataset.createType === 'market') { resetMarket(); openPanel('#marketFormPanel'); } return; }
    if (e.target.closest('[data-close-local-form]')) closeForms();
    if (e.target.closest('#addMarketProductLocal')) addMarketProduct();
    if (e.target.closest('#addMarketRivalLocal')) addMarketRival();
    if (e.target.closest('#resetTestLocal')) resetTest();
    if (e.target.closest('#resetMarketLocal')) resetMarket();
    if (e.target.closest('.remove-local-row')) e.target.closest('.order-item-row')?.remove();
    if (e.target.closest('#syncQueueBtn')) syncQueue();
    if (e.target.closest('#mockAiButton')) { e.preventDefault(); e.stopImmediatePropagation(); aiSummary(); }
    const fb = e.target.closest('.filter-pills button');
    if (fb) { activeFilter = fb.textContent.includes('7') ? '7days' : fb.textContent.includes('Tháng') ? 'month' : fb.textContent.includes('Chưa') ? 'unsynced' : 'today'; renderAll(); }
  }, true);
  $('#orderItems')?.addEventListener('input', orderTotals);
  window.addEventListener('online', () => syncQueue(true));
  window.addEventListener('offline', setDbBadge);
}

async function init() {
  injectForms(); bind(); await openLocalDb(); await refreshProducts(); resetTest(); resetMarket(); await syncQueue(true); await renderAll(); setDbBadge();
}
init().catch((error) => { console.error(error); toast(error.message || 'Không khởi động được Local DB workflow.'); });
