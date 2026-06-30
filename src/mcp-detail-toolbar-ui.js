// MCP detail toolbar UI-only patch.
// Scope: real MCP route page only. Do not change MCP data, events, or business logic.

const PAGE_SELECTOR = 'section.page[data-page="mcp"]';
const PANEL_ID = 'mcpMoreFilterPanel';

function ensureStyle() {
  let style = document.querySelector('style[data-mcp-detail-toolbar-ui]');
  if (!style) {
    style = document.createElement('style');
    style.dataset.mcpDetailToolbarUi = '1';
    document.head.appendChild(style);
  }

  style.textContent = `
    ${PAGE_SELECTOR}.active{
      scroll-padding-top:86px!important;
    }
    ${PAGE_SELECTOR}.active .mcp-route-card{
      position:sticky!important;
      top:0!important;
      z-index:30!important;
      margin:0 0 7px!important;
      box-shadow:0 8px 18px rgba(15,118,110,.18)!important;
      transform:translateZ(0)!important;
    }
    ${PAGE_SELECTOR}.active .mcp-stats{
      display:grid!important;
      grid-template-columns:repeat(4,minmax(0,1fr))!important;
      gap:7px!important;
      margin:0 0 7px!important;
    }
    ${PAGE_SELECTOR}.active .mcp-stat{
      min-width:0!important;
      padding:8px 4px!important;
      border-radius:12px!important;
    }
    ${PAGE_SELECTOR}.active .mcp-stat b{font-size:16px!important;line-height:1!important}
    ${PAGE_SELECTOR}.active .mcp-stat span{font-size:9.5px!important;line-height:1.1!important;white-space:nowrap!important}

    ${PAGE_SELECTOR}.active .mcp-filters.mcp-detail-toolbar{
      position:relative!important;
      top:auto!important;
      z-index:18!important;
      display:grid!important;
      grid-template-columns:minmax(0,.98fr) minmax(0,.9fr) minmax(0,.78fr) minmax(0,.78fr)!important;
      gap:6px!important;
      margin:0 0 7px!important;
      padding:0!important;
      overflow:visible!important;
      background:transparent!important;
      touch-action:manipulation!important;
    }
    ${PAGE_SELECTOR}.active .mcp-filters.mcp-detail-toolbar .mcp-filter,
    ${PAGE_SELECTOR}.active .mcp-filters.mcp-detail-toolbar [data-mcp-toolbar-toggle]{
      width:100%!important;
      min-width:0!important;
      min-height:34px!important;
      padding:0 5px!important;
      border-radius:13px!important;
      font-size:11px!important;
      line-height:1!important;
      font-weight:900!important;
      white-space:nowrap!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
    }
    ${PAGE_SELECTOR}.active .mcp-filters.mcp-detail-toolbar [data-mcp-filter="all"]{
      background:#eafff9!important;
      border-color:#b7efe2!important;
      color:#087568!important;
    }
    ${PAGE_SELECTOR}.active [data-mcp-toolbar-toggle]{
      border:1px solid #d7e5e2!important;
      background:#fff!important;
      color:#17343d!important;
    }
    ${PAGE_SELECTOR}.active [data-mcp-toolbar-toggle][aria-expanded="true"]{
      background:#eef9f6!important;
      border-color:#8fd9ce!important;
      color:#087568!important;
    }
    ${PAGE_SELECTOR}.active .mcp-more-panel{
      display:none!important;
      position:sticky!important;
      top:64px!important;
      z-index:22!important;
      margin:-1px 0 7px!important;
      padding:7px!important;
      border:1px solid #d7e5e2!important;
      border-radius:16px!important;
      background:rgba(255,255,255,.98)!important;
      box-shadow:0 12px 26px rgba(15,23,42,.12)!important;
      backdrop-filter:blur(10px)!important;
    }
    ${PAGE_SELECTOR}.active .mcp-more-panel.open{display:block!important}
    ${PAGE_SELECTOR}.active .mcp-more-panel-inner{
      display:grid!important;
      grid-template-columns:repeat(3,minmax(0,1fr))!important;
      gap:6px!important;
    }
    ${PAGE_SELECTOR}.active .mcp-more-panel .mcp-filter{
      min-width:0!important;
      min-height:34px!important;
      padding:0 6px!important;
      border-radius:12px!important;
      font-size:11px!important;
      font-weight:900!important;
      white-space:nowrap!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
    }
    ${PAGE_SELECTOR}.active .mcp-export-row{
      display:grid!important;
      grid-template-columns:repeat(3,minmax(0,1fr))!important;
      gap:6px!important;
      margin:0 0 8px!important;
    }
    ${PAGE_SELECTOR}.active .mcp-export-row button{
      min-width:0!important;
      min-height:34px!important;
      padding:0 4px!important;
      border-radius:13px!important;
      font-size:10.5px!important;
      line-height:1.05!important;
      font-weight:900!important;
      white-space:nowrap!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
    }
    @media(max-width:360px){
      ${PAGE_SELECTOR}.active .mcp-filters.mcp-detail-toolbar{gap:5px!important;grid-template-columns:minmax(0,1fr) minmax(0,.86fr) minmax(0,.72fr) minmax(0,.72fr)!important}
      ${PAGE_SELECTOR}.active .mcp-filters.mcp-detail-toolbar .mcp-filter,
      ${PAGE_SELECTOR}.active .mcp-filters.mcp-detail-toolbar [data-mcp-toolbar-toggle],
      ${PAGE_SELECTOR}.active .mcp-export-row button{font-size:10px!important}
      ${PAGE_SELECTOR}.active .mcp-more-panel-inner{grid-template-columns:repeat(2,minmax(0,1fr))!important}
    }
  `;
}

function isKeepButton(button) {
  return Boolean(
    button.matches('[data-mcp-add-customer]')
    || button.matches('[data-mcp-import-customers]')
    || button.matches('[data-mcp-filter="all"]')
    || button.matches('[data-mcp-toolbar-toggle]')
  );
}

function ensurePanel(page, filters) {
  let panel = page.querySelector(`#${PANEL_ID}`);
  if (!panel) {
    panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'mcp-more-panel';
    panel.innerHTML = '<div class="mcp-more-panel-inner"></div>';
  }
  if (!panel.querySelector('.mcp-more-panel-inner')) {
    panel.innerHTML = '<div class="mcp-more-panel-inner"></div>';
  }
  if (filters.nextElementSibling !== panel) filters.insertAdjacentElement('afterend', panel);
  return panel;
}

function ensureToggle(filters) {
  let toggle = filters.querySelector('[data-mcp-toolbar-toggle]');
  if (!toggle) {
    toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.dataset.mcpToolbarToggle = '1';
    toggle.setAttribute('aria-controls', PANEL_ID);
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = 'Chọn';
    filters.appendChild(toggle);
  }
  return toggle;
}

function orderMainToolbar(filters, toggle) {
  const add = filters.querySelector('[data-mcp-add-customer]');
  const imp = filters.querySelector('[data-mcp-import-customers]');
  const all = filters.querySelector('[data-mcp-filter="all"]');
  [add, imp, all, toggle].filter(Boolean).forEach((button) => filters.appendChild(button));
}

function refreshToggleLabel(toggle, panel) {
  const active = panel.querySelector('.mcp-filter.active:not([data-mcp-filter="all"])');
  toggle.textContent = active ? `Lọc: ${active.textContent.trim()}` : 'Chọn';
}

function enhanceMcpToolbar() {
  ensureStyle();
  const page = document.querySelector(`${PAGE_SELECTOR}.active`);
  const filters = page?.querySelector('.mcp-filters');
  if (!page || !filters) return;

  filters.classList.add('mcp-detail-toolbar');
  const panel = ensurePanel(page, filters);
  const inner = panel.querySelector('.mcp-more-panel-inner');
  const toggle = ensureToggle(filters);

  Array.from(filters.querySelectorAll('button')).forEach((button) => {
    if (!isKeepButton(button)) inner.appendChild(button);
  });

  orderMainToolbar(filters, toggle);
  refreshToggleLabel(toggle, panel);
}

function setPanelOpen(open) {
  const page = document.querySelector(`${PAGE_SELECTOR}.active`);
  const panel = page?.querySelector(`#${PANEL_ID}`);
  const toggle = page?.querySelector('[data-mcp-toolbar-toggle]');
  if (!panel || !toggle) return;
  panel.classList.toggle('open', Boolean(open));
  toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function scheduleEnhance(delay = 60) {
  clearTimeout(scheduleEnhance.timer);
  scheduleEnhance.timer = setTimeout(enhanceMcpToolbar, delay);
}

window.addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-mcp-toolbar-toggle]');
  if (toggle && toggle.closest(PAGE_SELECTOR)) {
    event.preventDefault();
    event.stopPropagation();
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    setPanelOpen(open);
    return;
  }

  const panelButton = event.target.closest(`#${PANEL_ID} button`);
  if (panelButton) setPanelOpen(false);
  else if (!event.target.closest(`#${PANEL_ID}`) && !event.target.closest('[data-mcp-toolbar-toggle]')) setPanelOpen(false);

  scheduleEnhance(120);
}, true);

window.addEventListener('DOMContentLoaded', () => scheduleEnhance(0));
window.addEventListener('mcp:session-changed', () => scheduleEnhance(80));
window.addEventListener('hashchange', () => scheduleEnhance(80));
const observer = new MutationObserver(() => scheduleEnhance(80));
observer.observe(document.documentElement, { childList: true, subtree: true });
scheduleEnhance(0);
