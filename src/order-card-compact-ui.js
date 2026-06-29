function ensureOrderCardCompactUi() {
  let style = document.querySelector('style[data-order-card-compact-ui]');
  if (!style) {
    style = document.createElement('style');
    style.dataset.orderCardCompactUi = '1';
    document.head.appendChild(style);
  }
  style.textContent = `
    section.page[data-page="order-shell"] .shell-list{
      display:grid!important;
      grid-auto-rows:max-content!important;
      align-content:start!important;
      align-items:start!important;
      gap:8px!important;
      min-height:0!important;
      overflow-y:auto!important;
      overflow-x:hidden!important;
    }
    section.page[data-page="order-shell"] .shell-card{
      box-sizing:border-box!important;
      height:auto!important;
      min-height:0!important;
      max-height:none!important;
      align-self:start!important;
      padding:10px 11px!important;
      border-radius:15px!important;
      overflow:hidden!important;
    }
    section.page[data-page="order-shell"] .shell-card-head{
      align-items:flex-start!important;
      gap:8px!important;
      min-width:0!important;
    }
    section.page[data-page="order-shell"] .shell-card-head>div{
      min-width:0!important;
      overflow:hidden!important;
    }
    section.page[data-page="order-shell"] .shell-card h3{
      margin:0 0 2px!important;
      font-size:14.5px!important;
      line-height:1.1!important;
      white-space:nowrap!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
    }
    section.page[data-page="order-shell"] .shell-card small{
      font-size:11px!important;
      line-height:1.18!important;
      white-space:nowrap!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
    }
    section.page[data-page="order-shell"] .shell-badge{
      padding:4px 7px!important;
      font-size:10px!important;
      line-height:1.1!important;
    }
    section.page[data-page="order-shell"] .shell-actions{
      margin-top:8px!important;
      gap:6px!important;
      grid-template-columns:repeat(3,minmax(0,1fr))!important;
    }
    section.page[data-page="order-shell"] .shell-actions button{
      min-height:32px!important;
      border-radius:9px!important;
      font-size:10.5px!important;
      line-height:1!important;
      padding:0 4px!important;
    }
    @media(max-width:430px){
      section.page[data-page="order-shell"] .shell-list{
        gap:7px!important;
      }
      section.page[data-page="order-shell"] .shell-card{
        padding:9px 10px!important;
      }
      section.page[data-page="order-shell"] .shell-actions button{
        min-height:31px!important;
        font-size:10px!important;
      }
    }
  `;
}

ensureOrderCardCompactUi();
window.addEventListener('DOMContentLoaded', ensureOrderCardCompactUi);
