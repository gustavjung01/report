function esc(value=''){
  return String(value??'').replace(/[&<>'"]/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
}

function attachOrderCardActions(){
  const shell=document.querySelector('section.page[data-page="data"] #dataShell.active.data-shell-order');
  if(!shell)return;
  shell.querySelectorAll('.data-shell-list > .data-shell-card[data-order-id]').forEach((card)=>{
    const id=card.dataset.orderId||'';
    if(!id)return;
    let actions=card.querySelector(':scope > .shell-actions');
    if(!actions){
      card.insertAdjacentHTML('beforeend','<div class="shell-actions"></div>');
      actions=card.querySelector(':scope > .shell-actions');
    }
    if(!actions.querySelector('[data-order-detail]')){
      actions.insertAdjacentHTML('beforeend',`<button type="button" class="primary-lite" data-order-detail="${esc(id)}">Mở</button>`);
    }
    if(!actions.querySelector('[data-order-export-slip]')){
      actions.insertAdjacentHTML('beforeend',`<button type="button" class="secondary" data-order-export-slip="${esc(id)}">Phiếu</button>`);
    }
  });
}

function schedule(delay=80){setTimeout(attachOrderCardActions,delay)}
window.addEventListener('DOMContentLoaded',()=>schedule(0));
window.addEventListener('order:changed',()=>schedule(120));
document.addEventListener('click',()=>schedule(120),true);
document.addEventListener('submit',()=>schedule(120),true);
schedule(0);