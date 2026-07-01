function loadAgain(t){
  setTimeout(()=>{
    const s=document.createElement('script');
    s.type='module';
    s.src='src/smart-report-page.js?v=late-clean-'+t;
    document.head.appendChild(s);
  },t);
}
[300,900,1800,3200,5000].forEach(loadAgain);
