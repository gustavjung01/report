import { ensureProductCatalog } from './product-catalog.js?v=picker-panel-1';

const FILTERS = [
  ['all', 'Tất cả'],
  ['nguyen-lieu-tra-sua', 'Trà sữa'],
  ['my-cay', 'Mì cay'],
  ['banh-trang', 'Bánh tráng'],
  ['dong-lanh', 'Đông lạnh'],
  ['phu-kien', 'Bao bì']
];

let catalog = [];
let state = { filter: 'all', q: '', selected: new Map() };

function esc(value = '') {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function money(value = 0) {
  const amount = Number(value || 0);
  return amount ? `${amount.toLocaleString('vi-VN')}đ` : 'Chưa có giá';
}

function normalize(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function toast(message) {
  const element = document.querySelector('#toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2200);
}

function ensureCss() {
  if (document.querySelector('style[data-order-product-picker]')) return;
  const style = document.createElement('style');
  style.dataset.orderProductPicker = '1';
  style.textContent = `
    #modal .order-product-trigger{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:8px 0 10px;padding:10px 11px;border:1px solid #9bdccd;border-radius:14px;background:#eafff8;color:#007866;font-weight:950}
    #modal .order-product-trigger small{font-weight:800;color:#44615d}
    #modal .order-picker-panel{position:fixed;left:50%;bottom:calc(10px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:90;width:min(390px,calc(100vw - 20px));max-height:min(76dvh,620px);display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;border:1px solid #cfe2dc;border-radius:20px;background:#fff;box-shadow:0 20px 60px rgba(4,34,38,.24);overflow:hidden}
    #modal .order-picker-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px;border-bottom:1px solid #e8f0ee}.order-picker-head b{font-size:15px}.order-picker-head button{border:0;background:#f2f7f5;border-radius:12px;min-height:36px;padding:0 12px;font-weight:900;color:#17343d}
    #modal .order-picker-tools{display:grid;gap:9px;padding:10px 12px;border-bottom:1px solid #edf3f1;background:#fbfefd}.order-picker-tools input{width:100%;min-height:42px;border:1px solid #d7e6e2;border-radius:13px;padding:0 12px;font-weight:850}.order-picker-filters{display:flex;gap:7px;overflow-x:auto;padding-bottom:1px}.order-picker-filter{border:1px solid #d7e6e2;border-radius:999px;background:#fff;white-space:nowrap;min-height:34px;padding:0 11px;font-size:12px;font-weight:950;color:#23444b}.order-picker-filter.active{background:#00957f;color:#fff;border-color:#00957f}
    #modal .order-picker-list{overflow:auto;padding:8px 10px 12px;background:#f8fbfa}.order-picker-item{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;margin-bottom:8px;padding:10px;border:1px solid #e0ece8;border-radius:15px;background:#fff}.order-picker-item b{display:block;font-size:13px;color:#102a33}.order-picker-item small{display:block;margin-top:2px;font-size:11px;color:#61737a}.order-picker-actions{display:grid;gap:6px;justify-items:end}.order-picker-qty{display:flex;align-items:center;overflow:hidden;border:1px solid #d7e6e2;border-radius:11px;background:#fff}.order-picker-qty button{width:30px;height:30px;border:0;background:#f5faf8;font-weight:950}.order-picker-qty span{min-width:26px;text-align:center;font-size:12px;font-weight:950}.order-picker-add{border:0;border-radius:11px;background:#00957f;color:#fff;min-height:32px;padding:0 12px;font-size:12px;font-weight:950}.order-picker-add.is-selected{background:#0d7d6e}.order-picker-choice{grid-column:1/-1;display:grid;gap:5px;margin-top:6px}.order-picker-choice label{display:grid;gap:4px;font-size:11px;font-weight:900;color:#50676d}.order-picker-choice select{min-height:36px;border:1px solid #d7e6e2;border-radius:11px;background:#fff;padding:0 10px;font-weight:850}
    #modal .order-picker-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-top:1px solid #e8f0ee;background:#fff}.order-picker-foot small{font-weight:900;color:#49646a}.order-picker-foot button{border:0;border-radius:14px;min-height:42px;padding:0 14px;background:#00957f;color:#fff;font-weight:950}.order-picker-foot button:disabled{background:#b9c9c5}.order-picker-empty{padding:18px;text-align:center;color:#63727c;font-weight:850}
  `;
  document.head.appendChild(style);
}

async function loadCatalogSafe() {
  try {
    catalog = await ensureProductCatalog();
  } catch (error) {
    console.warn('order product picker catalog failed', error);
    catalog = [];
  }
  return catalog;
}

function currentModal() {
  const modal = document.querySelector('#modal');
  if (!modal || !linesContainer(modal)) return null;
  return modal;
}

function linesContainer(modal = currentModal()) {
  return modal?.querySelector('#orderLines, #mcpOrderLines') || null;
}

function pickerPanel() {
  return currentModal()?.querySelector('[data-order-picker-panel]') || null;
}

function injectTrigger() {
  const modal = currentModal();
  const lines = linesContainer(modal);
  if (!modal || !lines || modal.querySelector('[data-order-open-picker]')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'order-product-trigger';
  button.setAttribute('data-order-open-picker', '');
  button.innerHTML = '<span>+ Chọn sản phẩm</span><small>Lọc ngành · chọn nhiều mã</small>';
  lines.parentElement?.insertBefore(button, lines);
}

function filteredCatalog() {
  const q = normalize(state.q);
  return catalog.filter((item) => {
    if (state.filter !== 'all' && item.industry_key !== state.filter) return false;
    if (!q) return true;
    const haystack = normalize([item.sku, item.name, item.brand, item.category, item.flavor, item.size, item.search_text].filter(Boolean).join(' '));
    return haystack.includes(q);
  }).slice(0, 80);
}

function filterHtml() {
  return FILTERS.map(([key, label]) => `<button type="button" class="order-picker-filter ${state.filter === key ? 'active' : ''}" data-order-picker-filter="${esc(key)}">${esc(label)}</button>`).join('');
}

function choiceHtml(product = {}) {
  const groups = product.choice_groups || [];
  if (!groups.length) return '';
  const selected = state.selected.get(product.id)?.choices || {};
  return `<div class="order-picker-choice">${groups.map((group) => `<label><span>${esc(group.name || 'Phân loại')}</span><select data-order-picker-choice="${esc(product.id)}" data-choice-key="${esc(group.key)}"><option value="">Chọn ${esc(String(group.name || 'phân loại').toLowerCase())}</option>${(group.values || []).map((value) => `<option value="${esc(value)}" ${selected[group.key] === value ? 'selected' : ''}>${esc(value)}</option>`).join('')}</select></label>`).join('')}</div>`;
}

function itemHtml(product = {}) {
  const selected = state.selected.get(product.id);
  const qty = selected?.quantity || 1;
  const isSelected = Boolean(selected);
  const sub = [product.sku, product.category, product.size, product.unit].filter(Boolean).join(' · ');
  return `<article class="order-picker-item" data-picker-product-id="${esc(product.id)}"><div><b>${esc(product.name || 'Sản phẩm')}</b><small>${esc(sub)}</small><small>${esc(money(product.price))}</small></div><div class="order-picker-actions"><div class="order-picker-qty"><button type="button" data-picker-qty="-" data-picker-product="${esc(product.id)}">−</button><span>${esc(qty)}</span><button type="button" data-picker-qty="+" data-picker-product="${esc(product.id)}">+</button></div><button type="button" class="order-picker-add ${isSelected ? 'is-selected' : ''}" data-picker-toggle="${esc(product.id)}">${isSelected ? 'Đã chọn' : '+ Chọn'}</button></div>${choiceHtml(product)}</article>`;
}

function selectedCount() {
  return state.selected.size;
}

function focusSearch() {
  const search = pickerPanel()?.querySelector('[data-order-picker-search]');
  if (!search) return;
  search.focus();
  const length = search.value.length;
  try { search.setSelectionRange(length, length); } catch {}
}

function renderPicker({ keepSearchFocus = false } = {}) {
  const panel = pickerPanel();
  if (!panel) return;
  const items = filteredCatalog();
  panel.innerHTML = `<div class="order-picker-head"><b>Chọn sản phẩm</b><button type="button" data-order-picker-close>Đóng</button></div><div class="order-picker-tools"><input data-order-picker-search placeholder="Tìm tên / SKU" value="${esc(state.q)}"><div class="order-picker-filters">${filterHtml()}</div></div><div class="order-picker-list">${items.map(itemHtml).join('') || '<div class="order-picker-empty">Không có sản phẩm phù hợp.</div>'}</div><div class="order-picker-foot"><small>Đã chọn: ${selectedCount()} mã</small><button type="button" data-order-picker-commit ${selectedCount() ? '' : 'disabled'}>Thêm ${selectedCount()} mã vào đơn</button></div>`;
  if (keepSearchFocus) setTimeout(focusSearch, 0);
}

async function openPicker() {
  ensureCss();
  await loadCatalogSafe();
  const modal = currentModal();
  if (!modal) return;
  state = { ...state, selected: new Map() };
  let panel = pickerPanel();
  if (!panel) {
    panel = document.createElement('div');
    panel.className = 'order-picker-panel';
    panel.setAttribute('data-order-picker-panel', '');
    modal.appendChild(panel);
  }
  renderPicker({ keepSearchFocus: true });
}

function closePicker() {
  pickerPanel()?.remove();
}

function productById(id = '') {
  return catalog.find((item) => item.id === id);
}

function setChoice(productId, choiceKey, value) {
  const product = productById(productId);
  if (!product) return;
  const current = state.selected.get(productId) || { product, quantity: 1, choices: {} };
  current.choices = { ...current.choices, [choiceKey]: value };
  state.selected.set(productId, current);
  renderPicker();
}

function toggleProduct(productId) {
  const product = productById(productId);
  if (!product) return;
  const current = state.selected.get(productId);
  if (current) {
    state.selected.delete(productId);
  } else {
    const choices = {};
    (product.choice_groups || []).forEach((group) => {
      if ((group.values || []).length === 1) choices[group.key] = group.values[0];
    });
    state.selected.set(productId, { product, quantity: 1, choices });
  }
  renderPicker();
}

function adjustQty(productId, delta) {
  const product = productById(productId);
  if (!product) return;
  const current = state.selected.get(productId) || { product, quantity: 1, choices: {} };
  current.quantity = Math.max(1, Number(current.quantity || 1) + delta);
  state.selected.set(productId, current);
  renderPicker();
}

function buildChoiceSelects(product, choices = {}) {
  return (product.choice_groups || []).map((group) => `<label class="order-choice-label"><span>${esc(group.name || 'Phân loại')}</span><select data-order-choice data-order-choice-key="${esc(group.key)}" ${group.required ? 'data-required="1"' : ''}>${(group.values || []).map((value) => `<option value="${esc(value)}" ${choices[group.key] === value ? 'selected' : ''}>${esc(value)}</option>`).join('')}</select></label>`).join('');
}

function lineHtml(entry) {
  const product = entry.product;
  const choices = entry.choices || {};
  const choiceText = Object.values(choices).filter(Boolean).join(' · ');
  const name = choiceText ? `${product.name} - ${choiceText}` : product.name;
  return `<div class="order-line mcp-order-line" data-order-line data-mcp-order-line><input data-order-product data-mcp-order-product list="productCatalogOptions" placeholder="Tìm sản phẩm/SKU" value="${esc(name)}"><input data-order-product-id data-mcp-order-product-id type="hidden" value="${esc(product.id || '')}"><input data-order-sku data-mcp-order-sku type="hidden" value="${esc(product.sku || '')}"><input data-order-unit data-mcp-order-unit type="hidden" value="${esc(product.unit || '')}"><input data-order-qty data-mcp-order-qty type="number" inputmode="numeric" min="1" value="${esc(entry.quantity || 1)}"><input data-order-price data-mcp-order-price type="number" inputmode="numeric" min="0" placeholder="Giá" value="${esc(product.price || '')}"><button type="button" class="secondary" data-order-remove-line data-mcp-order-remove-line>×</button><div class="order-choice" data-order-choice-wrap>${buildChoiceSelects(product, choices)}</div></div>`;
}

function commitSelection() {
  const entries = [...state.selected.values()];
  if (!entries.length) return;
  const missing = entries.find((entry) => (entry.product.choice_groups || []).some((group) => group.required && !entry.choices?.[group.key]));
  if (missing) {
    toast(`Chọn đủ phân loại cho ${missing.product.name}.`);
    return;
  }
  const target = linesContainer();
  if (!target) return;
  [...target.querySelectorAll('[data-order-line], [data-mcp-order-line]')]
    .filter((row) => !(row.querySelector('[data-order-product], [data-mcp-order-product]')?.value || '').trim())
    .forEach((row) => row.remove());
  target.insertAdjacentHTML('beforeend', entries.map(lineHtml).join(''));
  closePicker();
  target.querySelector('[data-order-qty], [data-mcp-order-qty]')?.dispatchEvent(new Event('input', { bubbles: true }));
  toast(`Đã thêm ${entries.length} mã vào đơn.`);
}

function handleClick(event) {
  if (event.target.closest('[data-order-open-picker]')) {
    event.preventDefault();
    openPicker();
    return;
  }
  if (event.target.closest('[data-order-picker-close]')) {
    event.preventDefault();
    closePicker();
    return;
  }
  const filter = event.target.closest('[data-order-picker-filter]');
  if (filter) {
    event.preventDefault();
    state.filter = filter.dataset.orderPickerFilter || 'all';
    renderPicker({ keepSearchFocus: true });
    return;
  }
  const toggle = event.target.closest('[data-picker-toggle]');
  if (toggle) {
    event.preventDefault();
    toggleProduct(toggle.dataset.pickerToggle);
    return;
  }
  const qty = event.target.closest('[data-picker-qty]');
  if (qty) {
    event.preventDefault();
    adjustQty(qty.dataset.pickerProduct, qty.dataset.pickerQty === '+' ? 1 : -1);
    return;
  }
  if (event.target.closest('[data-order-picker-commit]')) {
    event.preventDefault();
    commitSelection();
  }
}

function handleInput(event) {
  const search = event.target.closest('[data-order-picker-search]');
  if (!search) return;
  state.q = search.value || '';
  renderPicker({ keepSearchFocus: true });
}

function handleChange(event) {
  const choice = event.target.closest('[data-order-picker-choice]');
  if (!choice) return;
  setChoice(choice.dataset.orderPickerChoice, choice.dataset.choiceKey, choice.value);
}

function observeOrderModal() {
  const observer = new MutationObserver(() => injectTrigger());
  observer.observe(document.body, { childList: true, subtree: true });
  setInterval(injectTrigger, 700);
  injectTrigger();
}

ensureCss();
document.addEventListener('click', handleClick, true);
document.addEventListener('input', handleInput, true);
document.addEventListener('change', handleChange, true);
window.addEventListener('DOMContentLoaded', observeOrderModal);
observeOrderModal();
