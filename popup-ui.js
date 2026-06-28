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

function directToast(text){
  const toast=document.getElementById('toast');
  if(!toast)return alert(text);
  toast.textContent=text;
  toast.classList.add('show');
  clearTimeout(directToast.t);
  directToast.t=setTimeout(()=>toast.classList.remove('show'),4200);
}

function readReportState(){
  for(const key of ['bepi-field-report-v5','bepi-field-report-v4','bepi-field-report-v3']){
    try{
      const raw=localStorage.getItem(key);
      if(raw)return JSON.parse(raw);
    }catch(error){}
  }
  return {reports:[],activeReportId:'',settings:{}};
}

function getScriptUrl(){
  const state=readReportState();
  const url=(document.getElementById('sheetUrl')?.value||state.settings?.sheetEndpoint||'').trim();
  if(!url){
    directToast('Dán Apps Script URL /exec trước.');
    document.getElementById('sheetSection')?.scrollIntoView({behavior:'smooth'});
    return '';
  }
  return url;
}

function directTestPayload(){
  const now=new Date().toISOString();
  return {
    action:'testReport',
    source:'Bepi direct GET fallback',
    submittedAt:now,
    settings:{createDriveFile:true,driveFolderId:'1DTIHNs8NzOATNHTId9G8qRaInHsXxtGO'},
    report:{id:'test-'+Date.now(),kind:'Test',date:now.slice(0,10),market:'TEST SHEET DRIVE',sales:'Bepi App',note:'Test trực tiếp từ app',createdAt:now,updatedAt:now,summary:{totalCustomers:1,needSample:0,follow:0,bad:0}},
    products:['Trà Đen','Trà Quả Mộng','Trà Gạo Rang','Trà Lài','Trà Olong','Trà Olong Sen'],
    customers:[{id:'cus-'+Date.now(),name:'Khách test',area:'Test app',testType:'Trà ONA Test',followDate:'',marketTags:['Giá tốt'],note:'Dòng test',tests:{'Trà Đen':{status:'ok',note:'test ghi Sheet'}}}]
  };
}

function openPayload(payload){
  const url=getScriptUrl();
  if(!url)return;
  const next=url+'?payload='+encodeURIComponent(JSON.stringify(payload));
  window.open(next,'_blank','noopener,noreferrer');
  directToast('Đã mở tab Apps Script. Tab mới sẽ báo OK hoặc lỗi thật.');
}

document.getElementById('testSheetBtn')?.addEventListener('click',(event)=>{
  event.preventDefault();
  event.stopImmediatePropagation();
  openPayload(directTestPayload());
},true);

setPopupState();
