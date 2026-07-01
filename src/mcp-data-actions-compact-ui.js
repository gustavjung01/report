function installStyle() {
  let style = document.querySelector('style[data-mcp-data-actions-compact]');
  if (!style) {
    style = document.createElement('style');
    style.dataset.mcpDataActionsCompact = '1';
    document.head.appendChild(style);
  }
  style.textContent = `
    #dataShell.active.mcp-data-compact .data-shell-kpis{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;margin:0 0 8px!important}
    #dataShell.active.mcp-data-compact .data-shell-kpi{min-height:52px!important;padding:7px 6px!important;border-radius:12px!important;display:grid!important;align-content:center!important;gap:2px!important}
    #dataShell.active.mcp-data-compact .data-shell-kpi b{font-size:18px!important;line-height:1!important}
    #dataShell.active.mcp-data-compact .data-shell-kpi span{font-size:10px!important;line-height:1.15!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    #dataShell.active.mcp-data-compact .mcp-route-export-row{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;margin:0 0 8px!important;position:relative!important;z-index:1!important}
    #dataShell.active.mcp-data-compact .mcp-route-export-row button{min-height:32px!important;border-radius:10px!important;font-size:10.5px!important;font-weight:900!important;padding:6px 5px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    #dataShell.active.mcp-data-compact .mcp-route-admin-row{display:none!important}
    #dataShell.active.mcp-data-compact .data-shell-open-card{margin-top:0!important;padding:9px 10px!important}
    #dataShell.active.mcp-data-compact .data-shell-open-card .data-shell-open-btn{display:none!important}
    #dataShell.active.mcp-data-compact .data-shell-open-card h3{font-size:13px!important;margin-bottom:2px!important}
    #dataShell.active.mcp-data-compact .data-shell-open-card small{font-size:11px!important;line-height:1.25!important}
    #dataShell.active.mcp-data-compact .data-shell-list{display:grid!important;gap:8px!important}
    #dataShell.active.mcp-data-compact .mcp-session-card{position:relative!important;min-width:0!important;padding:10px!important;border:1px solid rgba(15,118,110,.14)!important;border-radius:16px!important;background:linear-gradient(180deg,#ffffff 0%,#f8fffd 100%)!important;box-shadow:0 8px 18px rgba(15,57,50,.08)!important;transition:transform .12s ease,box-shadow .12s ease,border-color .12s ease!important;cursor:pointer!important}
    #dataShell.active.mcp-data-compact .mcp-session-card:active{transform:scale(.992)!important;box-shadow:0 4px 12px rgba(15,57,50,.08)!important}
    #dataShell.active.mcp-data-compact .mcp-session-card:focus-visible{outline:2px solid rgba(20,184,166,.55)!important;outline-offset:2px!important}
    #dataShell.active.mcp-data-compact .mcp-session-card .shell-card-head{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:8px!important;align-items:start!important;min-width:0!important}
    #dataShell.active.mcp-data-compact .mcp-session-card .shell-card-head>div{min-width:0!important;display:grid!important;gap:3px!important}
    #dataShell.active.mcp-data-compact .mcp-session-card h3{font-size:13.5px!important;line-height:1.18!important;margin:0!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    #dataShell.active.mcp-data-compact .mcp-session-card small{font-size:11px!important;line-height:1.25!important;color:#5c6d76!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    #dataShell.active.mcp-data-compact .mcp-session-card .shell-badge{font-size:10px!important;line-height:1!important;padding:5px 7px!important;border-radius:999px!important;max-width:82px!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
    #dataShell.active.mcp-data-compact .mcp-session-card .shell-actions{display:grid!important;grid-template-columns:1fr 1fr!important;gap:6px!important;margin-top:8px!important}
    #dataShell.active.mcp-data-compact .mcp-session-card .shell-actions:empty{display:none!important}
    #dataShell.active.mcp-data-compact .mcp-session-card .shell-actions button{min-height:31px!important;border-radius:10px!important;font-size:10.5px!important;font-weight:900!important;padding:5px 6px!important;min-width:0!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    @media(max-width:360px){#dataShell.active.mcp-data-compact .mcp-route-export-row button{font-size:10px!important;padding-inline:3px!important}#dataShell.active.mcp-data-compact .mcp-session-card{padding:9px!important;border-radius:15px!important}#dataShell.active.mcp-data-compact .mcp-session-card h3{font-size:13px!important}#dataShell.active.mcp-data-compact .mcp-session-card small{font-size:10.5px!important}#dataShell.active.mcp-data-compact .mcp-session-card .shell-actions{grid-template-columns:1fr!important}}
  `;
}

function ensureActionRow(shell) {
  const openCard = shell.querySelector('.data-shell-open-card');
  let row = shell.querySelector('.mcp-route-export-row');
  if (!row && openCard) {
    openCard.insertAdjacentHTML('beforebegin', '<div class="mcp-route-export-row"></div>');
    row = shell.querySelector('.mcp-route-export-row');
  }
  if (!row) return null;
  [...shell.querySelectorAll('.mcp-route-export-row')].forEach((item) => {
    if (item !== row) item.remove();
  });
  return row;
}

function compactMcpDataActions() {
  installStyle();
  const shell = document.querySelector('#dataShell.active');
  const mcpTab = document.querySelector('#dataHub [data-data-view="mcp"].active');
  if (!shell || !mcpTab) {
    document.querySelector('#dataShell.mcp-data-compact')?.classList.remove('mcp-data-compact');
    return;
  }

  shell.classList.add('mcp-data-compact');
  const row = ensureActionRow(shell);
  if (!row) return;

  [...shell.querySelectorAll('.mcp-route-admin-row')].forEach((item) => item.remove());
  [...row.querySelectorAll('[data-mcp-start]')].forEach((button) => button.remove());

  if (!row.querySelector('[data-mcp-export-routes]')) {
    row.insertAdjacentHTML('beforeend', '<button type="button" class="secondary" data-mcp-export-routes>Xuất tuyến</button>');
  }
  if (!row.querySelector('[data-mcp-route-admin]')) {
    row.insertAdjacentHTML('beforeend', '<button type="button" class="secondary" data-mcp-route-admin>Quản trị tuyến</button>');
  }
  if (!row.querySelector('[data-mcp-start]')) {
    row.insertAdjacentHTML('beforeend', '<button type="button" class="secondary" data-mcp-start>Bắt đầu phiên</button>');
  }

  const seen = new Set();
  [...row.querySelectorAll('button')].forEach((button) => {
    const key = button.dataset.mcpExportRoutes ? 'export' : button.dataset.mcpRouteAdmin ? 'admin' : button.dataset.mcpStart !== undefined ? 'start' : button.textContent.trim();
    if (seen.has(key)) button.remove();
    else seen.add(key);
  });

  const startButtons = [...shell.querySelectorAll('[data-mcp-start]')];
  startButtons.forEach((button) => {
    if (!row.contains(button)) button.remove();
  });
}

function schedule() {
  clearTimeout(schedule.timer);
  schedule.timer = setTimeout(compactMcpDataActions, 120);
}

installStyle();
window.addEventListener('DOMContentLoaded', schedule);
window.addEventListener('mcp:session-changed', schedule);
document.addEventListener('click', schedule, true);
setInterval(schedule, 1200);
schedule();
