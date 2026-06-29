function ensureModalFormCss() {
  if (document.querySelector('style[data-modal-form-ui]')) return;
  const style = document.createElement('style');
  style.dataset.modalFormUi = '1';
  style.textContent = `
    #modal[data-type="customer"],
    #modal[data-type="test-detail"],
    #modal[data-type="mcp-start"],
    #modal[data-type="mcp-customer"],
    #modal[data-type="order-create"],
    #modal[data-type="order-detail"]{
      box-sizing:border-box!important;
      width:min(400px,calc(100vw - 18px))!important;
      max-width:calc(100vw - 18px)!important;
      max-height:calc(100dvh - 18px)!important;
      border-radius:18px!important;
      overflow:hidden!important;
      background:#fff!important;
      box-shadow:0 24px 70px rgba(8,35,55,.22)!important;
    }
    #modal[data-type="customer"] .modal,
    #modal[data-type="test-detail"] .modal,
    #modal[data-type="mcp-start"] .modal,
    #modal[data-type="mcp-customer"] .modal,
    #modal[data-type="order-create"] .modal,
    #modal[data-type="order-detail"] .modal{
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
    #modal[data-type="customer"] header,
    #modal[data-type="test-detail"] header,
    #modal[data-type="mcp-start"] header,
    #modal[data-type="mcp-customer"] header,
    #modal[data-type="order-create"] header,
    #modal[data-type="order-detail"] header{
      display:flex!important;
      align-items:center!important;
      justify-content:space-between!important;
      gap:10px!important;
      position:sticky!important;
      top:0!important;
      z-index:2!important;
      background:#fff!important;
      padding-bottom:4px!important;
      min-width:0!important;
    }
    #modal[data-type="customer"] h2,
    #modal[data-type="test-detail"] h2,
    #modal[data-type="mcp-start"] h2,
    #modal[data-type="mcp-customer"] h2,
    #modal[data-type="order-create"] h2,
    #modal[data-type="order-detail"] h2{
      margin:0!important;
      min-width:0!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
      white-space:nowrap!important;
      font-size:19px!important;
      line-height:1.18!important;
    }
    #modal[data-type="customer"] header button,
    #modal[data-type="test-detail"] header button,
    #modal[data-type="mcp-start"] header button,
    #modal[data-type="mcp-customer"] header button,
    #modal[data-type="order-create"] header button,
    #modal[data-type="order-detail"] header button{
      flex:0 0 auto!important;
      min-height:34px!important;
      border:1px solid #dce8e5!important;
      border-radius:999px!important;
      background:#fbfffd!important;
      color:#17343d!important;
      padding:0 11px!important;
      font-weight:850!important;
    }
    #modal[data-type="customer"] .form,
    #modal[data-type="mcp-start"] .form,
    #modal[data-type="mcp-customer"] .form,
    #modal[data-type="order-create"] .form{
      display:grid!important;
      gap:10px!important;
      min-width:0!important;
    }
    #modal[data-type="customer"] .grid,
    #modal[data-type="mcp-start"] .grid,
    #modal[data-type="mcp-customer"] .grid,
    #modal[data-type="order-create"] .grid{
      display:grid!important;
      grid-template-columns:1fr 1fr!important;
      gap:9px!important;
      min-width:0!important;
    }
    #modal[data-type="customer"] label,
    #modal[data-type="mcp-start"] label,
    #modal[data-type="mcp-customer"] label,
    #modal[data-type="order-create"] label{
      display:grid!important;
      gap:5px!important;
      min-width:0!important;
      margin:0!important;
      color:#17343d!important;
      font-size:12px!important;
      font-weight:850!important;
    }
    #modal[data-type="customer"] label span,
    #modal[data-type="mcp-start"] label span,
    #modal[data-type="mcp-customer"] label span,
    #modal[data-type="order-create"] label span{
      display:block!important;
      min-width:0!important;
      color:#425863!important;
      font-size:11.5px!important;
      line-height:1.2!important;
    }
    #modal[data-type="customer"] input,
    #modal[data-type="customer"] textarea,
    #modal[data-type="customer"] select,
    #modal[data-type="mcp-start"] input,
    #modal[data-type="mcp-start"] textarea,
    #modal[data-type="mcp-start"] select,
    #modal[data-type="mcp-customer"] input,
    #modal[data-type="mcp-customer"] textarea,
    #modal[data-type="mcp-customer"] select,
    #modal[data-type="order-create"] input,
    #modal[data-type="order-create"] textarea,
    #modal[data-type="order-create"] select{
      box-sizing:border-box!important;
      width:100%!important;
      min-width:0!important;
      min-height:40px!important;
      border:1px solid #cad7d4!important;
      border-radius:12px!important;
      background:#fff!important;
      color:#082337!important;
      padding:9px 10px!important;
      font-size:14px!important;
      line-height:1.2!important;
      outline:none!important;
    }
    #modal[data-type="customer"] textarea,
    #modal[data-type="mcp-start"] textarea,
    #modal[data-type="mcp-customer"] textarea,
    #modal[data-type="order-create"] textarea{
      min-height:74px!important;
      resize:vertical!important;
    }
    #modal[data-type="customer"] input:focus,
    #modal[data-type="customer"] textarea:focus,
    #modal[data-type="customer"] select:focus,
    #modal[data-type="mcp-start"] input:focus,
    #modal[data-type="mcp-start"] textarea:focus,
    #modal[data-type="mcp-start"] select:focus,
    #modal[data-type="mcp-customer"] input:focus,
    #modal[data-type="mcp-customer"] textarea:focus,
    #modal[data-type="mcp-customer"] select:focus,
    #modal[data-type="order-create"] input:focus,
    #modal[data-type="order-create"] textarea:focus,
    #modal[data-type="order-create"] select:focus{
      border-color:#00957f!important;
      box-shadow:0 0 0 3px rgba(0,149,127,.13)!important;
    }
    #modal[data-type="customer"] .primary,
    #modal[data-type="mcp-start"] .primary,
    #modal[data-type="mcp-customer"] .primary,
    #modal[data-type="order-create"] .primary{
      width:100%!important;
      min-height:44px!important;
      border-radius:13px!important;
    }
    #modal[data-type="customer"] .line,
    #modal[data-type="mcp-start"] .line,
    #modal[data-type="mcp-customer"] .line,
    #modal[data-type="order-create"] .line,
    #modal[data-type="order-detail"] .line,
    #modal[data-type="order-detail"] .total{
      display:grid!important;
      gap:7px!important;
      border:1px solid #dce8e5!important;
      border-radius:14px!important;
      background:#fbfffd!important;
      padding:10px!important;
      min-width:0!important;
      overflow:hidden!important;
    }
    #modal[data-type="customer"] .test-row,
    #modal[data-type="mcp-customer"] .line{
      width:100%!important;
      max-width:100%!important;
    }
    #modal[data-type="mcp-customer"] .line small{
      color:#63727c!important;
      line-height:1.35!important;
    }
    #modal[data-type="mcp-customer"] .line a.secondary{
      display:grid!important;
      place-items:center!important;
      text-decoration:none!important;
    }
    #modal[data-type="order-create"] .order-line{
      display:grid!important;
      grid-template-columns:minmax(0,1.35fr) 54px 78px 34px!important;
      gap:6px!important;
      align-items:center!important;
    }
    #modal[data-type="order-create"] .order-line .secondary{
      width:34px!important;
      min-width:34px!important;
      min-height:40px!important;
      padding:0!important;
      border-radius:10px!important;
    }
    #modal[data-type="order-create"] #orderTotal{
      position:sticky!important;
      bottom:0!important;
      z-index:2!important;
      background:#fff8ef!important;
      border:1px solid #ffd6a8!important;
      border-radius:14px!important;
      padding:10px!important;
      color:#9a5500!important;
    }
    @media(max-width:390px){
      #modal[data-type="customer"] .grid,
      #modal[data-type="mcp-start"] .grid,
      #modal[data-type="mcp-customer"] .grid,
      #modal[data-type="order-create"] .grid{
        grid-template-columns:1fr!important;
      }
      #modal[data-type="order-create"] .order-line{
        grid-template-columns:minmax(0,1fr) 48px 70px 32px!important;
        gap:5px!important;
      }
      #modal[data-type="order-create"] .order-line input{
        padding-left:7px!important;
        padding-right:7px!important;
        font-size:13px!important;
      }
    }
  `;
  document.head.appendChild(style);
}

ensureModalFormCss();
window.addEventListener('DOMContentLoaded', ensureModalFormCss);
