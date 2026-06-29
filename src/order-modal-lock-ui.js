function ensureOrderModalLockUi() {
  let style = document.querySelector('style[data-order-modal-lock-ui]');
  if (!style) {
    style = document.createElement('style');
    style.dataset.orderModalLockUi = '1';
    document.head.appendChild(style);
  }
  style.textContent = `
    #modal[data-type="order-create"]{
      box-sizing:border-box!important;
      inline-size:min(404px,calc(100vw - 24px))!important;
      width:min(404px,calc(100vw - 24px))!important;
      min-width:0!important;
      max-width:calc(100vw - 24px)!important;
      max-height:calc(100dvh - 22px)!important;
      margin:auto!important;
      padding:0!important;
      overflow:hidden!important;
      border-radius:18px!important;
      background:#fff!important;
    }
    #modal[data-type="order-create"] .modal{
      box-sizing:border-box!important;
      inline-size:100%!important;
      width:100%!important;
      min-width:0!important;
      max-width:100%!important;
      max-height:calc(100dvh - 22px)!important;
      overflow-y:auto!important;
      overflow-x:hidden!important;
      padding:14px!important;
      display:grid!important;
      gap:11px!important;
      contain:inline-size!important;
    }
    #modal[data-type="order-create"] .form,
    #modal[data-type="order-create"] .order-form{
      box-sizing:border-box!important;
      inline-size:100%!important;
      width:100%!important;
      min-width:0!important;
      max-width:100%!important;
      display:grid!important;
      gap:9px!important;
      overflow:hidden!important;
    }
    #modal[data-type="order-create"] .grid{
      box-sizing:border-box!important;
      inline-size:100%!important;
      width:100%!important;
      min-width:0!important;
      max-width:100%!important;
      display:grid!important;
      grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;
      gap:8px!important;
      overflow:hidden!important;
    }
    #modal[data-type="order-create"] label{
      min-width:0!important;
      max-width:100%!important;
      overflow:hidden!important;
    }
    #modal[data-type="order-create"] input,
    #modal[data-type="order-create"] textarea,
    #modal[data-type="order-create"] select{
      box-sizing:border-box!important;
      inline-size:100%!important;
      width:100%!important;
      min-width:0!important;
      max-width:100%!important;
    }
    #modal[data-type="order-create"] .line{
      box-sizing:border-box!important;
      inline-size:100%!important;
      width:100%!important;
      min-width:0!important;
      max-width:100%!important;
      overflow:hidden!important;
    }
    #modal[data-type="order-create"] #orderLines{
      display:grid!important;
      gap:7px!important;
      min-width:0!important;
      max-width:100%!important;
      overflow:hidden!important;
    }
    #modal[data-type="order-create"] .order-line{
      box-sizing:border-box!important;
      inline-size:100%!important;
      width:100%!important;
      min-width:0!important;
      max-width:100%!important;
      display:grid!important;
      grid-template-columns:minmax(0,1fr) 50px 70px 34px!important;
      gap:6px!important;
      align-items:center!important;
      overflow:hidden!important;
    }
    #modal[data-type="order-create"] .order-line input{
      min-width:0!important;
      padding-left:8px!important;
      padding-right:8px!important;
    }
    #modal[data-type="order-create"] .order-line .secondary{
      width:34px!important;
      min-width:34px!important;
      max-width:34px!important;
      height:40px!important;
      min-height:40px!important;
      padding:0!important;
      border-radius:11px!important;
    }
    #modal[data-type="order-create"] .wide,
    #modal[data-type="order-create"] .primary,
    #modal[data-type="order-create"] #orderTotal{
      box-sizing:border-box!important;
      inline-size:100%!important;
      width:100%!important;
      min-width:0!important;
      max-width:100%!important;
    }
    @media(max-width:430px){
      #modal[data-type="order-create"]{
        inline-size:calc(100vw - 20px)!important;
        width:calc(100vw - 20px)!important;
        max-width:calc(100vw - 20px)!important;
      }
      #modal[data-type="order-create"] .modal{
        padding:13px!important;
      }
      #modal[data-type="order-create"] .grid{
        grid-template-columns:minmax(0,1fr)!important;
        gap:7px!important;
      }
      #modal[data-type="order-create"] .order-line{
        grid-template-columns:minmax(0,1fr) 46px 64px 32px!important;
        gap:5px!important;
      }
      #modal[data-type="order-create"] .order-line .secondary{
        width:32px!important;
        min-width:32px!important;
        max-width:32px!important;
      }
    }
  `;
}

ensureOrderModalLockUi();
window.addEventListener('DOMContentLoaded', ensureOrderModalLockUi);
