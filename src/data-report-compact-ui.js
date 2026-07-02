function styleDataReportCompact(){
  let style=document.querySelector('style[data-report-data-compact-ui]');
  if(!style){style=document.createElement('style');style.dataset.reportDataCompactUi='1';document.head.appendChild(style)}
  style.textContent=`
    section.page[data-page="data"] #dataShell.data-shell-report-compact .data-shell-kpis{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:6px!important;margin:0!important}
    section.page[data-page="data"] #dataShell.data-shell-report-compact .data-shell-kpi{min-width:0!important;min-height:54px!important;padding:7px 4px!important;border-radius:14px!important;background:rgba(255,255,255,.86)!important;border:1px solid rgba(210,228,224,.88)!important;box-shadow:0 6px 14px rgba(12,55,50,.045)!important;display:grid!important;place-items:center!important;align-content:center!important;gap:2px!important}
    section.page[data-page="data"] #dataShell.data-shell-report-compact .data-shell-kpi b{font-size:17px!important;line-height:1!important;font-weight:950!important;color:#071f2f!important;letter-spacing:-.2px!important}
    section.page[data-page="data"] #dataShell.data-shell-report-compact .data-shell-kpi span{font-size:10px!important;line-height:1.1!important;font-weight:750!important;color:#5f717b!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:100%!important}
    section.page[data-page="data"] #dataShell.data-shell-report-compact > p.data-shell-note{display:none!important}
    section.page[data-page="data"] #dataShell.data-shell-report-compact .data-shell-list .data-shell-note{margin:0!important;padding:9px 10px!important;border-radius:13px!important;border:1px dashed rgba(157,186,178,.65)!important;background:rgba(255,255,255,.48)!important;color:#526873!important;font-size:11.5px!important;line-height:1.35!important}
  `;
}
function tuneReportCompact(){
  const shell=document.querySelector('section.page[data-page="data"] #dataShell');
  if(!shell)return;
  const kpis=[...shell.querySelectorAll(':scope > .data-shell-kpis .data-shell-kpi')];
  const text=kpis.map(card=>card.textContent||'').join(' ');
  const ok=kpis.length===4&&text.includes('Báo cáo')&&text.includes('Rủi ro');
  shell.classList.toggle('data-shell-report-compact',ok);
  if(ok)shell.querySelectorAll('.data-shell-list .data-shell-note').forEach(note=>{if(note.textContent.includes('Chưa có báo cáo'))note.textContent='Chưa có báo cáo. Vào Home → Báo cáo để tạo mới.'});
}
function boot(){styleDataReportCompact();tuneReportCompact();setTimeout(tuneReportCompact,80)}
boot();
window.addEventListener('DOMContentLoaded',boot);
document.addEventListener('click',()=>setTimeout(tuneReportCompact,80),true);
window.addEventListener('report:changed',()=>setTimeout(tuneReportCompact,80));