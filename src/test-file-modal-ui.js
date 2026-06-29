function ensureTestFileModalCss() {
  if (document.querySelector('style[data-test-file-modal-ui]')) return;
  const style = document.createElement('style');
  style.dataset.testFileModalUi = '1';
  style.textContent = `
    #modal[data-type="file"]{
      box-sizing:border-box!important;
      width:min(400px,calc(100vw - 18px))!important;
      max-width:calc(100vw - 18px)!important;
      max-height:calc(100dvh - 18px)!important;
      border-radius:18px!important;
      overflow:hidden!important;
      background:#fff!important;
      box-shadow:0 24px 70px rgba(8,35,55,.22)!important;
    }
    #modal[data-type="file"] .modal{
      box-sizing:border-box!important;
      width:100%!important;
      max-width:100%!important;
      max-height:calc(100dvh - 18px)!important;
      overflow-y:auto!important;
      overflow-x:hidden!important;
      -webkit-overflow-scrolling:touch!important;
      display:grid!important;
      gap:12px!important;
      padding:15px!important;
    }
    #modal[data-type="file"] header{
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
    #modal[data-type="file"] h2{
      margin:0!important;
      min-width:0!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
      white-space:nowrap!important;
      font-size:19px!important;
      line-height:1.18!important;
    }
    #modal[data-type="file"] header button{
      flex:0 0 auto!important;
      min-height:34px!important;
      border:1px solid #dce8e5!important;
      border-radius:999px!important;
      background:#fbfffd!important;
      color:#17343d!important;
      padding:0 11px!important;
      font-weight:850!important;
    }
    #modal[data-type="file"] .form{
      display:grid!important;
      gap:10px!important;
      min-width:0!important;
    }
    #modal[data-type="file"] .grid{
      display:grid!important;
      grid-template-columns:1fr 1fr!important;
      gap:9px!important;
      min-width:0!important;
      width:100%!important;
    }
    #modal[data-type="file"] label{
      display:grid!important;
      gap:5px!important;
      min-width:0!important;
      margin:0!important;
      color:#17343d!important;
      font-size:12px!important;
      font-weight:850!important;
    }
    #modal[data-type="file"] label span{
      display:block!important;
      min-width:0!important;
      color:#425863!important;
      font-size:11.5px!important;
      line-height:1.2!important;
    }
    #modal[data-type="file"] input,
    #modal[data-type="file"] textarea,
    #modal[data-type="file"] select{
      box-sizing:border-box!important;
      width:100%!important;
      min-width:0!important;
      max-width:100%!important;
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
    #modal[data-type="file"] textarea{
      min-height:74px!important;
      resize:vertical!important;
    }
    #modal[data-type="file"] input:focus,
    #modal[data-type="file"] textarea:focus,
    #modal[data-type="file"] select:focus{
      border-color:#00957f!important;
      box-shadow:0 0 0 3px rgba(0,149,127,.13)!important;
    }
    #modal[data-type="file"] .line{
      display:grid!important;
      gap:8px!important;
      border:1px solid #dce8e5!important;
      border-radius:14px!important;
      background:#fbfffd!important;
      padding:10px!important;
      min-width:0!important;
      overflow:hidden!important;
    }
    #modal[data-type="file"] .line>.grid{
      grid-template-columns:minmax(0,1fr) auto!important;
      align-items:center!important;
    }
    #modal[data-type="file"] [data-add-product]{
      width:auto!important;
      min-width:76px!important;
      min-height:40px!important;
      padding:0 12px!important;
      white-space:nowrap!important;
    }
    #modal[data-type="file"] #picked{
      display:flex!important;
      flex-wrap:wrap!important;
      gap:6px!important;
      min-width:0!important;
      max-width:100%!important;
      overflow:hidden!important;
    }
    #modal[data-type="file"] #picked .chip{
      max-width:100%!important;
      min-height:32px!important;
      padding:0 10px!important;
      border-radius:999px!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
      white-space:nowrap!important;
    }
    #modal[data-type="file"] .primary{
      width:100%!important;
      min-height:44px!important;
      border-radius:13px!important;
    }
    @media(max-width:390px){
      #modal[data-type="file"] .grid{
        grid-template-columns:1fr!important;
      }
      #modal[data-type="file"] .line>.grid{
        grid-template-columns:minmax(0,1fr) auto!important;
      }
    }
  `;
  document.head.appendChild(style);
}

ensureTestFileModalCss();
window.addEventListener('DOMContentLoaded', ensureTestFileModalCss);
