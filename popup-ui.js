const editor=document.getElementById('customerEditor');
const quick=document.getElementById('quickAddBtn');
const form=document.getElementById('customerForm');
const cancel=document.getElementById('cancelEditBtn');
const nameInput=document.getElementById('customerName');

function setPopupState(){
  document.body.classList.toggle('popup-open',Boolean(editor&&editor.open));
}

function openEditorPopup(){
  if(!editor)return;
  editor.open=true;
  setPopupState();
  setTimeout(()=>nameInput&&nameInput.focus(),180);
}

function closeEditorPopup(){
  if(!editor)return;
  editor.open=false;
  setPopupState();
}

if(editor){
  editor.open=false;
  editor.addEventListener('toggle',setPopupState);
  editor.querySelector('summary')?.addEventListener('click',(event)=>{
    if(editor.open){
      event.preventDefault();
      closeEditorPopup();
    }
  });
}

quick?.addEventListener('click',()=>setTimeout(openEditorPopup,30));
form?.addEventListener('submit',()=>setTimeout(closeEditorPopup,80));
cancel?.addEventListener('click',()=>setTimeout(closeEditorPopup,80));

document.addEventListener('click',(event)=>{
  const edit=event.target.closest('[data-edit-customer]');
  if(edit)setTimeout(openEditorPopup,80);
});

document.addEventListener('keydown',(event)=>{
  if(event.key==='Escape'&&editor?.open)closeEditorPopup();
});

setPopupState();
