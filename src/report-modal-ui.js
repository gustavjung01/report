function ensureReportModalUi() {
  if (document.querySelector('style[data-report-modal-ui]')) return;
  const style = document.createElement('style');
  style.dataset.reportModalUi = '1';
  style.textContent = `
    #modal[data-type="report-create"],
    #modal[data-type="report-detail"]{
      box-sizing:border-box!important;
      width:min(400px,calc(100vw - 18px))!important;
      max-width:calc(100vw - 18px)!important;
      max-height:calc(100dvh - 18px)!important;
      border-radius:18px!important;
      overflow:hidden!important;
      background:#fff!important;
      box-shadow:0 24px 70px rgba(8,35,55,.22)!important;
    }
    #modal[data-type="report-create"] .modal,
    #modal[data-type="report-detail"] .modal{
      box-sizing:border-box!important;
      width:100%!important;
      max-width:100%!important;
      max-height:calc(100dvh - 18px)!important;
      overflow-y:auto!important;
      overflow-x:hidden!important;
      -webkit-overflow-scrolling:touch!important;
      padding:15px!important;
      display:grid!important;
      gap:12px!important;
    }
    #modal[data-type="report-create"] header,
    #modal[data-type="report-detail"] header{
      display:flex!important;
      align-items:center!important;
      justify-content:space-between!important;
      gap:10px!important;
      position:sticky!important;
      top:0!important;
      z-index:3!important;
      background:#fff!important;
      padding-bottom:4px!important;
      min-width:0!important;
    }
    #modal[data-type="report-create"] h2,
    #modal[data-type="report-detail"] h2{
      margin:0!important;
      min-width:0!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
      white-space:nowrap!important;
      font-size:19px!important;
      line-height:1.18!important;
    }
    #modal[data-type="report-create"] header button,
    #modal[data-type="report-detail"] header button{
      flex:0 0 auto!important;
      min-height:34px!important;
      border:1px solid #dce8e5!important;
      border-radius:999px!important;
      background:#fbfffd!important;
      color:#17343d!important;
      padding:0 11px!important;
      font-weight:850!important;
    }
    #modal[data-type="report-create"] .form{
      display:grid!important;
      gap:10px!important;
      min-width:0!important;
    }
    #modal[data-type="report-create"] .grid{
      display:grid!important;
      grid-template-columns:1fr 1fr!important;
      gap:9px!important;
      min-width:0!important;
    }
    #modal[data-type="report-create"] label{
      display:grid!important;
      gap:5px!important;
      min-width:0!important;
      margin:0!important;
      color:#17343d!important;
      font-size:12px!important;
      font-weight:850!important;
    }
    #modal[data-type="report-create"] label span{
      display:block!important;
      min-width:0!important;
      color:#425863!important;
      font-size:11.5px!important;
      line-height:1.2!important;
    }
    #modal[data-type="report-create"] input,
    #modal[data-type="report-create"] textarea,
    #modal[data-type="report-create"] select{
      box-sizing:border-box!important;
      width:100%!important;
      min-width:0!important;
      min-height:40px!important;
      border:1px solid #cad7d4!important;
      border-radius:12px!important;
      background:#fff!important;
      color:#082337!important;
      padding:9px 10px!important;
      font-size:16px!important;
      line-height:1.2!important;
      outline:none!important;
    }
    #modal[data-type="report-create"] textarea{
      min-height:64px!important;
      resize:vertical!important;
    }
    #modal[data-type="report-create"] input:focus,
    #modal[data-type="report-create"] textarea:focus,
    #modal[data-type="report-create"] select:focus{
      border-color:#00957f!important;
      box-shadow:0 0 0 3px rgba(0,149,127,.13)!important;
    }
    #modal[data-type="report-create"] .primary{
      width:100%!important;
      min-height:44px!important;
      border-radius:13px!important;
    }
    #modal[data-type="report-detail"] .total,
    #modal[data-type="report-detail"] .line{
      display:grid!important;
      gap:7px!important;
      border:1px solid #dce8e5!important;
      border-radius:14px!important;
      background:#fbfffd!important;
      padding:10px!important;
      min-width:0!important;
      overflow:hidden!important;
    }
    #modal[data-type="report-detail"] .line small{
      color:#63727c!important;
      line-height:1.35!important;
      overflow-wrap:anywhere!important;
    }
    section.page[data-page="report-shell"] .shell-kpis{
      grid-template-columns:repeat(4,minmax(0,1fr))!important;
    }
    section.page[data-page="report-shell"] .shell-actions{
      grid-template-columns:repeat(2,minmax(0,1fr))!important;
    }
    @media(max-width:390px){
      #modal[data-type="report-create"] .grid{
        grid-template-columns:1fr!important;
      }
      #modal[data-type="report-create"] textarea{
        min-height:58px!important;
      }
      section.page[data-page="report-shell"] .shell-kpi{
        padding-left:3px!important;
        padding-right:3px!important;
      }
      section.page[data-page="report-shell"] .shell-kpi b{
        font-size:15px!important;
      }
      section.page[data-page="report-shell"] .shell-kpi span{
        font-size:9px!important;
      }
    }
  `;
  document.head.appendChild(style);
}

ensureReportModalUi();
window.addEventListener('DOMContentLoaded', ensureReportModalUi);
