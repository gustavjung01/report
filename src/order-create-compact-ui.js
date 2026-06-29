function mountOrderCreateCompactUi() {
  let style = document.querySelector('style[data-order-create-compact-ui]');
  if (!style) {
    style = document.createElement('style');
    style.dataset.orderCreateCompactUi = '1';
    document.head.appendChild(style);
  }
  style.textContent = `
    #modal[data-type="order-create"]{
      width:min(404px,calc(100vw - 20px))!important;
    }
    #modal[data-type="order-create"] .modal{
      max-height:calc(100dvh - 22px)!important;
      overflow:auto!important;
      padding:12px 14px 14px!important;
      gap:8px!important;
    }
    #modal[data-type="order-create"] .modal header{
      margin-bottom:2px!important;
    }
    #modal[data-type="order-create"] .modal header h2{
      font-size:18px!important;
      line-height:1.15!important;
      margin:0!important;
    }
    #modal[data-type="order-create"] .form.order-form{
      display:grid!important;
      gap:7px!important;
    }
    #modal[data-type="order-create"] .grid{
      gap:7px!important;
      align-items:end!important;
    }
    #modal[data-type="order-create"] .order-customer-source-row{
      grid-template-columns:minmax(0,.82fr) minmax(0,1.18fr)!important;
    }
    #modal[data-type="order-create"] .order-customer-source-row label.is-disabled span{
      color:#91a0a5!important;
    }
    #modal[data-type="order-create"] .order-customer-source-row select:disabled{
      background:#f5f8f7!important;
      color:#91a0a5!important;
      -webkit-text-fill-color:#91a0a5!important;
      opacity:1!important;
    }
    #modal[data-type="order-create"] label{
      display:grid!important;
      gap:3px!important;
      min-width:0!important;
    }
    #modal[data-type="order-create"] label span{
      font-size:11px!important;
      line-height:1.1!important;
      font-weight:900!important;
      color:#40555e!important;
    }
    #modal[data-type="order-create"] input,
    #modal[data-type="order-create"] select,
    #modal[data-type="order-create"] textarea{
      min-height:38px!important;
      border-radius:12px!important;
      padding:8px 10px!important;
      font-size:16px!important;
      line-height:1.2!important;
    }
    #modal[data-type="order-create"] textarea{
      min-height:54px!important;
      resize:vertical!important;
    }
    #modal[data-type="order-create"] #orderCustomerMode,
    #modal[data-type="order-create"] #orderCustomerSelect{
      min-height:40px!important;
      font-weight:850!important;
    }
    #modal[data-type="order-create"] #orderCustomerMode{
      padding-left:8px!important;
      padding-right:6px!important;
    }
    #modal[data-type="order-create"] #orderProvince,
    #modal[data-type="order-create"] #orderDistrict,
    #modal[data-type="order-create"] #orderGeoText{
      min-height:36px!important;
    }
    #modal[data-type="order-create"] #orderGeoText{
      font-size:14px!important;
      font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;
    }
    #modal[data-type="order-create"] .line{
      padding:9px 10px!important;
      border-radius:15px!important;
      display:grid!important;
      gap:7px!important;
    }
    #modal[data-type="order-create"] .line>b{
      font-size:14px!important;
      line-height:1.1!important;
    }
    #modal[data-type="order-create"] #orderLines{
      display:grid!important;
      gap:6px!important;
    }
    #modal[data-type="order-create"] .order-line{
      display:grid!important;
      grid-template-columns:minmax(0,1.45fr) 50px 72px 34px!important;
      gap:6px!important;
      align-items:center!important;
    }
    #modal[data-type="order-create"] .order-line input{
      min-width:0!important;
      min-height:38px!important;
      padding:7px 9px!important;
    }
    #modal[data-type="order-create"] .order-line [data-order-qty]{
      text-align:center!important;
      padding-left:4px!important;
      padding-right:4px!important;
    }
    #modal[data-type="order-create"] .order-line [data-order-price]{
      padding-left:8px!important;
      padding-right:6px!important;
    }
    #modal[data-type="order-create"] .order-line [data-order-remove-line]{
      min-height:38px!important;
      width:34px!important;
      padding:0!important;
      border-radius:12px!important;
      font-size:18px!important;
    }
    #modal[data-type="order-create"] [data-order-add-line]{
      min-height:38px!important;
      border-radius:12px!important;
      font-size:14px!important;
      font-weight:950!important;
    }
    #modal[data-type="order-create"] #orderNote{
      min-height:60px!important;
    }
    #modal[data-type="order-create"] .total{
      padding:9px 10px!important;
      border-radius:13px!important;
      position:sticky!important;
      bottom:-1px!important;
      z-index:1!important;
      background:#fff8ef!important;
    }
    #modal[data-type="order-create"] .primary[data-order-save]{
      min-height:43px!important;
      border-radius:13px!important;
      font-size:15px!important;
    }
    @media(max-width:380px){
      #modal[data-type="order-create"] .modal{padding:10px 11px 12px!important;gap:6px!important}
      #modal[data-type="order-create"] .form.order-form{gap:6px!important}
      #modal[data-type="order-create"] .grid{gap:6px!important}
      #modal[data-type="order-create"] .order-customer-source-row{grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr)!important}
      #modal[data-type="order-create"] .order-line{grid-template-columns:minmax(0,1fr) 46px 66px 32px!important;gap:5px!important}
      #modal[data-type="order-create"] .order-line [data-order-remove-line]{width:32px!important}
    }
  `;
}

mountOrderCreateCompactUi();
window.addEventListener('DOMContentLoaded', mountOrderCreateCompactUi);
