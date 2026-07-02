import { installAppShellUi } from './app-shell-ui-owner.js?v=app-shell-ui-owner-2';

// Test UI/flows: keep stable, do not refactor unless a Test-specific UI bug requires it.
import './test-pull.js';
import './compact-detail.js?v=test-detail-width-1';
import './app-update.js';
import './test-export.js';
import './test-data-card-ui.js?v=test-data-card-ui-1';
import './modal-scroll-fix.js';
import './modal-form-ui.js?v=ui-modal-zoom-1';
import './test-file-modal-ui.js?v=test-file-modal-1';
import './test-customer-picker-ui.js?v=test-customer-picker-1';

// Core routing shell. Import order is intentionally preserved from the pre-audit baseline.
import './mcp-start.js?v=ui-boundary-1';
import './page-router-fix.js?v=revenue-route-1';

// Home ownership: visual-only home launcher, floating cloud chip, and background decoration.
import './home-ui-owner.js?v=home-spacing-1';
import './home-today-dashboard.js?v=home-compact-1';

// Route visibility guard must load after Home dashboard CSS, because Home dashboard owns only Home and must never keep Home visible over other pages.
import './route-visibility-guard.js?v=route-visibility-1';

// App bottom navigation and compact sync status dot.
import './bottom-nav-status-ui.js?v=bottom-nav-status-1';

// Data/Admin ownership: Data hub UI loads here; Admin sync logic stays separate below.
import './data-admin-ui-owner.js?v=data-ui-owner-order-mobile-1';
import './data-report-compact-ui.js?v=data-report-compact-owner-1';
import './data-mcp-scroll-ui.js?v=mcp-emergency-usable-1';

// MCP actions/business adapters. Keep custom events and MCP action behavior unchanged.
import './mcp-order-actions.js?v=mcp-order-compact-2';
import './mcp-report-actions.js?v=mcp-report-1';
import './mcp-test-actions.js?v=mcp-test-1';

// MCP ownership: scoped page/card/modal/import UI patches load via mcp-ui-owner.js.
import './mcp-ui-owner.js?v=mcp-data-export-visible-1';

// Order ownership: order logic stays in order-ui.js; product picker only adds rows into the existing order form.
import './order-ui.js?v=bepsi-catalog-1';
import './order-product-picker.js?v=picker-panel-3';
import './order-product-input-hint.js?v=product-input-hint-2';
import './order-ui-owner.js?v=order-ui-owner-1';

// Revenue dashboard: read-only local summaries built from orders/order_items. Rendered inside Data hub.
import './revenue-ui.js?v=revenue-ui-4';

// Shared business shell.
import './business-ui-shells.js?v=ui-safe-1';

// Report ownership: report logic stays in report-ui.js; scoped UI patches load via report-ui-owner.js.
import './report-ui.js?v=report-local-1';
import './report-ui-owner.js?v=report-ui-owner-1';

// MCP management compact UI loaded after shared shell patches to keep existing override behavior.
import './mcp-manage-actions-compact-ui.js?v=mcp-manage-row-1';

// Sync/Admin. Do not rename #syncBtn/#syncState/#dbInfo without sync audit.
import './supabase-sync.js?v=supabase-sync-1';
import './sync-delete-guard.js?v=sync-delete-guard-1';

// Admin PWA install UI. Keeps #syncBtn/#syncState untouched and only adds an Admin action button/modal.
import './pwa-install-ui.js?v=pwa-install-1';

// AI ownership: AI page/settings adapter loads after sync to preserve current behavior.
import './ai-ui-owner.js?v=gemini-report-agent-1';

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
  card.className='card';
  card.dataset.homeCard='mcp';
  card.dataset.page='mcp';
  card.innerHTML='<b>MCP tuyến</b><small>Đi tuyến / ghé khách</small>';
  const cards=homeCards();
  const report=cards.find(el=>el.dataset.page==='report');
  if(report?.nextSibling)grid.insertBefore(card,report.nextSibling);
  else grid.appendChild(card);
}

installAppShellUi();
ensureMcpCard();
window.addEventListener('DOMContentLoaded',ensureMcpCard);
