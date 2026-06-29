function ensureMcpOrderModalUi() {
  if (document.querySelector('style[data-mcp-order-modal-ui]')) return;
  const style = document.createElement('style');
  style.dataset.mcpOrderModalUi = '1';
  style.textContent = `
    #modal[data-type="mcp-order"]{
      box-sizing:border-box!important;
      width:min(400px,calc(100vw - 18px))!important;
      max-width:calc(100vw - 18px)!important;
      max-height:calc(100dvh - 18px)!important;
      border-radius:18px!important;
      overflow:hidden!important;
      background:#fff!important;
      box-shadow:0 24px 70px rgba(8,35,55,.22)!important;
    }
    #modal[data-type="mcp-order"] .modal{
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
    #modal[data-type="mcp-order"] header{
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
    #modal[data-type="mcp-order"] h2{
      margin:0!important;
      min-width:0!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
      white-space:nowrap!important;
      font-size:19px!important;
      line-height:1.18!important;
    }
    #modal[data-type="mcp-order"] header button{
      flex:0 0 auto!important;
      min-height:34px!important;
      border:1px solid #dce8e5!important;
      border-radius:999px!important;
      background:#fbfffd!important;
      color:#17343d!important;
      padding:0 11px!important;
      font-weight:850!important;
    }
    #modal[data-type="mcp-order"] .form{
      display:grid!important;
      gap:10px!important;
      min-width:0!important;
    }
    #modal[data-type="mcp-order"] .grid{
      display:grid!important;
      grid-template-columns:1fr 1fr!important;
      gap:9px!important;
      min-width:0!important;
    }
    #modal[data-type="mcp-order"] label{
      display:grid!important;
      gap:5px!important;
      min-width:0!important;
      margin:0!important;
      color:#17343d!important;
      font-size:12px!important;
      font-weight:850!important;
    }
    #modal[data-type="mcp-order"] label span{
      display:block!important;
      min-width:0!important;
      color:#425863!important;
      font-size:11.5px!important;
      line-height:1.2!important;
    }
    #modal[data-type="mcp-order"] input,
    #modal[data-type="mcp-order"] textarea,
    #modal[data-type="mcp-order"] select{
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
    #modal[data-type="mcp-order"] textarea{
      min-height:74px!important;
      resize:vertical!important;
    }
    #modal[data-type="mcp-order"] input:focus,
    #modal[data-type="mcp-order"] textarea:focus,
    #modal[data-type="mcp-order"] select:focus{
      border-color:#00957f!important;
      box-shadow:0 0 0 3px rgba(0,149,127,.13)!important;
    }
    #modal[data-type="mcp-order"] .primary{
      width:100%!important;
      min-height:44px!important;
      border-radius:13px!important;
    }
    #modal[data-type="mcp-order"] .line{
      display:grid!important;
      gap:7px!important;
      border:1px solid #dce8e5!important;
      border-radius:14px!important;
      background:#fbfffd!important;
      padding:10px!important;
      min-width:0!important;
      overflow:hidden!important;
    }
    #modal[data-type="mcp-order"] .mcp-order-source{
      border:1px solid #ffd8a8!important;
      border-radius:14px!important;
      background:#fff8ef!important;
      padding:10px!important;
      color:#7b3f00!important;
      font-size:12px!important;
      line-height:1.35!important;
      min-width:0!important;
    }
    #modal[data-type="mcp-order"] .mcp-order-source b,
    #modal[data-type="mcp-order"] .mcp-order-source span{
      display:block!important;
      min-width:0!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
      white-space:nowrap!important;
    }
    #modal[data-type="mcp-order"] .mcp-order-line{
      display:grid!important;
      grid-template-columns:minmax(0,1.35fr) 54px 78px 34px!important;
      gap:6px!important;
      align-items:center!important;
      min-width:0!important;
    }
    #modal[data-type="mcp-order"] .mcp-order-line input{
      min-width:0!important;
    }
    #modal[data-type="mcp-order"] .mcp-order-line .secondary{
      width:34px!important;
      min-width:34px!important;
      min-height:40px!important;
      padding:0!important;
      border-radius:10px!important;
    }
    #modal[data-type="mcp-order"] #mcpOrderTotal{
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
      #modal[data-type="mcp-order"] .grid{
        grid-template-columns:1fr!important;
      }
      #modal[data-type="mcp-order"] .mcp-order-line{
        grid-template-columns:minmax(0,1fr) 48px 70px 32px!important;
        gap:5px!important;
      }
      #modal[data-type="mcp-order"] .mcp-order-line input{
        padding-left:7px!important;
        padding-right:7px!important;
        font-size:16px!important;
      }
    }
  `;
  document.head.appendChild(style);
}

ensureMcpOrderModalUi();
window.addEventListener('DOMContentLoaded', ensureMcpOrderModalUi);
