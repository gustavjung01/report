import { installAppShellUi } from './app-shell-ui-owner.js?v=app-shell-ui-owner-1';

// Test UI/flows: keep stable, do not refactor unless a Test-specific UI bug requires it.
import './test-pull.js';
import './compact-detail.js?v=test-detail-width-1';
import './app-update.js';
import './test-export.js';
import './modal-scroll-fix.js';
import './modal-form-ui.js?v=ui-modal-zoom-1';
import './test-file-modal-ui.js?v=test-file-modal-1';

// Core routing shell. Import order is intentionally preserved from the pre-audit baseline.
import './mcp-start.js?v=ui-boundary-1';
import './page-router-fix.js';

// Data/Admin ownership: Data hub UI loads here; Admin sync logic stays separate below.
import './data-admin-ui-owner.js?v=data-admin-ui-owner-1';

// MCP actions/business adapters. Keep custom events and MCP action behavior unchanged.
import './mcp-order-actions.js?v=mcp-order-compact-1';
import './mcp-report-actions.js?v=mcp-report-1';
import './mcp-test-actions.js?v=mcp-test-1';

// MCP ownership: scoped page/card/modal/import UI patches load via mcp-ui-owner.js.
import './mcp-ui-owner.js?v=mcp-ui-owner-1';

// Order ownership: order logic stays in order-ui.js; product picker only adds rows into the existing order form.
import './order-ui.js?v=bepsi-catalog-1';
import './order-product-picker.js?v=picker-panel-1';
import './order-product-input-hint.js?v=product-input-hint-1';
import './order-ui-owner.js?v=order-ui-owner-1';

// Shared business shell.
import './business-ui-shells.js?v=ui-safe-1';

// Report ownership: report logic stays in report-ui.js; scoped UI patches load via report-ui-owner.js.
import './report-ui.js?v=report-local-1';
import './report-ui-owner.js?v=report-ui-owner-1';

// MCP management compact UI loaded after shared shell patches to keep existing override behavior.
import './mcp-manage-actions-compact-ui.js?v=mcp-manage-row-1';

// Sync/Admin. Do not rename #syncBtn/#syncState/#dbInfo/#adminStats without sync audit.
import './supabase-sync.js?v=supabase-sync-1';

// AI ownership: AI page/settings adapter loads after sync to preserve current behavior.
import './ai-ui-owner.js?v=ai-ui-owner-1';

function homeGrid(){
  return document.querySelector('section.page[data-page="create"] .grid-actions');
}

function homeCards(){
  const grid=homeGrid();
  return grid?[...grid.querySelectorAll(':scope > .card')]:[];
}

function ensureMcpCard(){
  const grid=homeGrid();
  if(!grid || grid.querySelector(':scope > [data-home-card="mcp"]'))return;
  const card=document.createElement('button');
  card.type='button';
  card.className='card home-card card-mcp';
  card.dataset.homeCard='mcp';
  card.dataset.page='mcp';
  card.innerHTML='<i>🧭</i><b>MCP tuyến</b><small>Tuyến hôm nay và trạng thái ghé.</small><em>Xem UI</em>';
  grid.insertBefore(card,grid.firstElementChild);
}

function tuneHomeCards(){
  ensureMcpCard();
  homeCards().forEach(c=>{
    const t=c.textContent||'';
    c.classList.remove('is-hidden','card-mcp','card-order','card-test','card-report','home-card');
    c.classList.add('home-card');
    let i=c.querySelector('i'),b=c.querySelector('b'),sm=c.querySelector('small'),e=c.querySelector('em');

    if(c.dataset.homeCard==='mcp'||t.includes('MCP')){
      c.classList.add('card-mcp');
      c.dataset.page='mcp';
      if(i)i.textContent='🧭';
      if(b)b.textContent='MCP tuyến';
      if(sm)sm.textContent='Tuyến hôm nay và trạng thái ghé.';
      if(e)e.textContent='Xem UI';
      return;
    }

    if(t.includes('Đơn hàng')){
      c.classList.add('card-order');
      c.removeAttribute('data-open');
      c.dataset.page='order-shell';
      if(i)i.textContent='🛒';
      if(b)b.textContent='Đơn hàng';
      if(sm)sm.textContent='Tạo đơn nhanh từ khách/tuyến.';
      if(e)e.textContent='Mở';
      return;
    }

    if(t.includes('File test')||t.includes('Test sản phẩm')){
      c.classList.add('card-test');
      c.removeAttribute('data-open');
      c.setAttribute('data-open-test','');
      if(i)i.textContent='🧪';
      if(b)b.textContent='Test sản phẩm';
      if(sm)sm.textContent='Tạo file test và thêm khách.';
      if(e)e.textContent='Mở';
      return;
    }

    if(t.includes('Báo cáo thị trường')||t.includes('Báo cáo')){
      c.classList.add('card-report');
      c.removeAttribute('data-open');
      c.dataset.page='report-shell';
      if(i)i.textContent='📊';
      if(b)b.textContent='Báo cáo';
      if(sm)sm.textContent='Khung UI thị trường.';
      if(e)e.textContent='Xem UI';
    }
  });
}

function focus(){
  tuneHomeCards();
  const h=document.querySelector('section.page[data-page="data"] h1');
  if(h)h.textContent='Dữ liệu';
  const w=document.querySelector('section.page[data-page="admin"] .warn');
  if(w)w.textContent='Local DB là cache. Supabase dùng để đồng bộ nhiều thiết bị.';
  const create=document.querySelector('.nav [data-page="create"] span');
  const data=document.querySelector('.nav [data-page="data"] span');
  const ai=document.querySelector('.nav [data-page="ai"] span');
  const admin=document.querySelector('.nav [data-page="admin"] span');
  if(create)create.textContent='Home';
  if(data)data.textContent='Dữ liệu';
  if(ai)ai.textContent='AI';
  if(admin)admin.textContent='Admin';
}

installAppShellUi();
focus();
window.addEventListener('DOMContentLoaded',focus);
