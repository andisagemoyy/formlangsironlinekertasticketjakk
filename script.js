(() => {
  'use strict';
  const DB=window.LANGSIR_DB,DATA=window.DINAS_DATA,STORAGE='formLangsirJakkSimpleV1';
  const $=(s,root=document)=>root.querySelector(s),$$=(s,root=document)=>[...root.querySelectorAll(s)];
  const unique=values=>[...new Set(values.filter(Boolean))];
  const reverse=values=>[...values].reverse();
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state={shift:'',type:'R',editing:'',data:loadData(),routes:[]};

  function loadData(){try{return JSON.parse(localStorage.getItem(STORAGE))||{records:{},counters:{},duty:{}};}catch{return {records:{},counters:{},duty:{}};}}
  function saveData(){localStorage.setItem(STORAGE,JSON.stringify(state.data));}
  function localDate(){const d=new Date(),pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;}
  const dayNames=['MINGGU','SENIN','SELASA','RABU','KAMIS','JUMAT','SABTU'];
  function automaticDay(date=$('#serviceDate').value){if(!date)return '';const d=new Date(`${date}T00:00:00`);return Number.isNaN(d.getTime())?'':dayNames[d.getDay()];}
  function syncDayControl(){const auto=automaticDay(),option=$('#serviceDay option[value=""]');if(option)option.textContent=auto?`Otomatis — ${auto}`:'Otomatis';$('#dayHint').textContent=$('#serviceDay').value?'Pilihan manual':'Mengikuti tanggal';}
  function currentServiceDay(){return $('#serviceDay').value||automaticDay();}
  function label(key){if(key.startsWith('dao-'))return 'DAO '+key.slice(4);const found=DB.jakkTracks.find(x=>x[0]===key);return 'JAKK '+(found?.[1]||key);}
  function levelSwitches(origin,targetLevel){const start=DB.level[origin]??targetLevel,step=start<=targetLevel?1:-1,out=[];for(let n=start;step>0?n<=targetLevel:n>=targetLevel;n+=step)out.push(...(DB.levelSwitches[n]||[]));return unique(out);}
  function daoInternalSwitches(from,to){
    if(!from||!to||from===to)return [];
    const graph=new Map();
    for(const [a,b] of DB.daoEastEdges||[]){if(!graph.has(a))graph.set(a,[]);if(!graph.has(b))graph.set(b,[]);graph.get(a).push(b);graph.get(b).push(a);}
    const queue=[[from,[from]]],seen=new Set([from]);
    while(queue.length){const [node,path]=queue.shift();for(const next of graph.get(node)||[]){if(seen.has(next))continue;const nextPath=[...path,next];if(next===to)return nextPath.filter(item=>/^W/.test(item));seen.add(next);queue.push([next,nextPath]);}}
    return [];
  }
  function routeId(from,to,via=''){return [from,to,via].join('|');}
  function buildRoutes(){
    const routes=[];
    for(const jakk of DB.serviceTracks)for(const [dao] of DB.daoTracks){
      const exact=DB.verifiedRoutes[`${jakk}|${dao}`],signals=exact?.signals||[DB.startSignals[jakk],'L44B'],jakkW=exact?.jakk||DB.jakkDaoSwitches[jakk],daoW=exact?.dao||DB.daoWestSwitches[dao];
      routes.push({id:routeId(label(jakk),label(dao)),from:label(jakk),to:label(dao),via:'',signals,switches:[...jakkW,...daoW],verified:!!exact?.verified||DB.verifiedJakkDao===true,movement:'{{ka}} LANGSIR DARI JALUR {{dari}} KE JALUR {{ke}}.'});
      routes.push({id:routeId(label(dao),label(jakk)),from:label(dao),to:label(jakk),via:'',signals:['L46A','L44A'],switches:[...daoW].reverse().concat([...jakkW].reverse()),verified:!!exact?.verified||DB.verifiedJakkDao===true,movement:'{{ka}} LANGSIR DARI JALUR {{dari}} KE JALUR {{ke}}.'});
    }
    for(const jakk of DB.serviceTracks)for(const [entry] of DB.daoTracks)for(const [coupling] of DB.daoTracks){
      if(entry===coupling)continue;
      const via=`MASUK DAO ${entry.slice(4)} UNTUK GANDENG`,internal=daoInternalSwitches(entry,coupling);
      routes.push({id:routeId(label(jakk),label(coupling),via),from:label(jakk),to:label(coupling),via,signals:[DB.startSignals[jakk],'L44B'],switches:unique([...DB.jakkDaoSwitches[jakk],...(DB.daoWestSwitches[entry]||[]),...internal]),verified:DB.verifiedJakkDao===true&&DB.verifiedDaoTopology===true&&internal.length>0,movement:`{{ka}} LANGSIR DARI JALUR {{dari}} MASUK JALUR ${entry.slice(4)} DAO, GANDENG RANGKAIAN DI JALUR ${coupling.slice(4)} DAO.`});
    }
    for(const [origin] of DB.jakkTracks)for(const cabin of DB.cabinSignals)for(const target of DB.serviceTracks){
      const via=`DEPAN KABIN ${cabin}`;
      routes.push({id:routeId(label(origin),label(target),via),from:label(origin),to:label(target),via,signals:unique([DB.startSignals[origin],cabin]),switches:unique([...levelSwitches(origin,DB.cabinLevel[cabin]),...reverse(levelSwitches(target,DB.cabinLevel[cabin]))]),verified:false,movement:`{{ka}} LANGSIR DARI JALUR {{dari}} KE DEPAN KABIN ${cabin}, GANDENG RANGKAIAN DI JALUR ${target.slice(5).toUpperCase()} JAKK.`});
    }
    return routes;
  }
  state.routes=buildRoutes();

  const dutyKey=()=>`${$('#serviceDate').value}|${state.shift}`;
  const recordKey=code=>`${$('#serviceDate').value}|${state.shift}|${state.type}|${code}`;
  const codePair=code=>code.startsWith('R')?'L'+code.slice(1):'R'+code.slice(1);
  const roman=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
  function nextNumber(date){const next=(state.data.counters[date]||0)+1;state.data.counters[date]=next;return next;}
  function numberText(n,date){const d=new Date(`${date}T00:00:00`);return `${String(n).padStart(3,'0')}/${roman[d.getMonth()]}/JAKK/${d.getFullYear()}`;}
  function splitPerson(value){const parts=value.split('/').map(x=>x.trim());return {name:parts[0]||'',nipp:parts.slice(1).join('/')};}
  function currentDuty(){return state.data.duty[dutyKey()]||{};}
  function staff(){const duty=currentDuty();return {'SCHOWING':splitPerson(duty.staffSchowing||''),'PLR':splitPerson(duty.staffPlr||''),'MAS':splitPerson(duty.staffMas||''),'PAP/PPKA':splitPerson(duty.staffPap||'')};}

  function selectShift(shift){state.shift=shift;state.type='R';$('#home').hidden=true;$('#workspace').hidden=false;$('#shiftTitle').textContent='Dinas '+shift[0]+shift.slice(1).toLowerCase();loadDuty();render();window.scrollTo({top:0,behavior:'smooth'});}
  function loadDuty(){const d=currentDuty();$('#serviceDay').value=d.serviceDay||'';syncDayControl();$('#startTime').value=d.startTime||'';$('#endTime').value=d.endTime||'';$('#staffSchowing').value=d.staffSchowing||'';$('#staffPlr').value=d.staffPlr||'';$('#staffMas').value=d.staffMas||'';$('#staffPap').value=d.staffPap||'';}
  function saveDuty(){state.data.duty[dutyKey()]={serviceDay:$('#serviceDay').value,startTime:$('#startTime').value,endTime:$('#endTime').value,staffSchowing:$('#staffSchowing').value,staffPlr:$('#staffPlr').value,staffMas:$('#staffMas').value,staffPap:$('#staffPap').value};saveData();}
  function render(){
    const codes=DATA[state.shift][state.type],allCodes=[...DATA[state.shift].R,...DATA[state.shift].L],savedAll=allCodes.filter(code=>state.data.records[`${$('#serviceDate').value}|${state.shift}|${code[0]}|${code}`]);
    const savedType=codes.filter(code=>state.data.records[recordKey(code)]).length;
    $$('.type-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.type===state.type));
    $('#listTitle').textContent=state.type==='R'?'Langsir Rangkaian':'Lok Dinas';$('#listMeta').textContent=`${savedType} dari ${codes.length} sudah diisi`;
    $('#rCount').textContent=`${DATA[state.shift].R.length} KA`;$('#lCount').textContent=`${DATA[state.shift].L.length} lok`;
    $('#savedSummary').textContent=`${allCodes.length} form dinas · Letter · 2 form/lembar`;
    $('#downloadExcel').disabled=$('#downloadExcelBottom').disabled=false;
    $('#trainList').innerHTML=codes.map(code=>{const record=state.data.records[recordKey(code)];let desc='Jalur belum diisi — tetap masuk Excel';if(record){if(record.type==='L'&&record.input){desc=`1. JAKK VII → ${record.input.entry||'DAO kosong'}, gandeng ${record.input.coupling||'DAO kosong'}<br>2. ${record.input.coupling||'DAO kosong'} → ${record.input.return||'JAKK kosong'}`;}else desc=record.steps.map((s,i)=>`${i+1}. ${s.from_track||'Jalur kosong'} → ${s.to_track||'Jalur kosong'}`).join('<br>');}return `<article class="train-row ${record?'saved':''}"><b class="train-code">${esc(code)}</b><div class="route-text">${record?'<b>Sudah disimpan</b>':''}${desc}</div><div class="row-actions"><button class="edit-route" data-code="${esc(code)}">${record?'Ubah jalur':'Isi jalur'}</button><button class="single-export" data-print-code="${esc(code)}">Cetak 1 Form</button></div></article>`;}).join('');
  }

  function options(values,current,placeholder){return `<option value="">${placeholder}</option>`+values.map(v=>`<option value="${esc(v)}" ${v===current?'selected':''}>${esc(v)}</option>`).join('');}
  function routeById(id){return state.routes.find(r=>r.id===id);}
  const serviceLabels=()=>DB.serviceTracks.map(label);
  const daoLabels=()=>DB.daoTracks.map(([key])=>label(key));
  const shortTrack=track=>String(track||'').replace(/^JAKK |^DAO /,'');
  const blankMovement=code=>`${code} LANGSIR DARI JALUR    KE JALUR DAO.`;
  const directRoute=(from,to)=>state.routes.find(r=>r.from===from&&r.to===to&&!r.via);
  function couplingRoute(from,entry,coupling){
    if(entry===coupling)return directRoute(from,coupling);
    const via=`MASUK DAO ${shortTrack(entry)} UNTUK GANDENG`;
    return state.routes.find(r=>r.from===from&&r.to===coupling&&r.via===via);
  }
  function routeResult(route,movement){
    if(!route)return 'Jalur belum lengkap. Form tetap masuk Excel; jalur, sinyal, dan wesel yang belum tersedia akan dikosongkan.';
    return `<b>Sinyal:</b> ${esc(route.signals.join(', '))}<br><b>Wesel:</b> ${esc(route.switches.join(', '))}<br><b>Perintah:</b> ${esc(movement)}${route.verified?'':'<span class="source-warning">Status sumber: belum terverifikasi</span>'}`;
  }
  function rStage1Html(code){return `<div class="stage-head"><b>Pergerakan 1 · ${esc(code)}</b><small>Rangkaian masuk DAO</small></div><div class="stage-grid"><label>Dari jalur<select class="r-from">${options(serviceLabels(),'','Pilih VII, VIII, atau IX')}</select></label><label>Ke jalur DAO<select class="r-dao">${options(daoLabels(),'','Pilih jalur DAO')}</select></label></div><div class="stage-result">Pilih jalur asal dan jalur DAO.</div>`;}
  function rStage2Html(code){return `<div class="stage-head"><b>Pergerakan 2 · ${esc(code)}</b><small>Terisi otomatis dari gerakan 1</small></div><div class="stage-grid"><label>Dari jalur DAO<span class="auto-field r-auto-dao">Otomatis dari gerakan 1</span></label><label>Ke jalur<select class="r-return">${options(serviceLabels(),'','Pilih VII, VIII, atau IX')}</select></label></div><div class="stage-result">Jalur asal otomatis mengikuti tujuan gerakan 1.</div>`;}
  function lStageHtml(code){return `<div class="stage-head"><b>Pergerakan 1 · ${esc(code)}</b><small>Lok masuk dan gandeng di DAO</small></div><div class="stage-grid three"><label>Dari jalur<span class="auto-field">JAKK VII</span></label><label>Masuk jalur DAO<select class="l-entry">${options(daoLabels(),'','Boleh dikosongkan')}</select></label><label>Gandeng jalur DAO<select class="l-coupling">${options(daoLabels(),'','Boleh dikosongkan')}</select></label></div><div class="stage-result">Jalur asal Lok Dinas otomatis JAKK VII.</div>`;}
  function lStage2Html(code){return `<div class="stage-head"><b>Pergerakan 2 · ${esc(code)}</b><small>Setelah gandeng menjadi rangkaian</small></div><div class="stage-grid"><label>Dari jalur DAO<span class="auto-field l-auto-dao">Otomatis dari jalur gandeng</span></label><label>Ke jalur<select class="l-return">${options(serviceLabels(),'','Pilih VII, VIII, atau IX')}</select></label></div><div class="stage-result">Jalur asal R otomatis mengikuti jalur DAO tempat gandeng.</div>`;}
  function updateRPreview(){
    const code=$('#recordKey').value,from=$('.r-from').value,dao=$('.r-dao').value,to=$('.r-return').value,route1=directRoute(from,dao),route2=directRoute(dao,to);
    $('.r-auto-dao').textContent=dao||'Otomatis dari gerakan 1';
    const movement1=route1?`${code} LANGSIR DARI JALUR ${shortTrack(from)} KE JALUR ${shortTrack(dao)} DAO.`:'';
    const movement2=route2?`${codePair(code)} LANGSIR DARI JALUR ${shortTrack(dao)} DAO KE JALUR ${shortTrack(to)}.`:'';
    const result1=$('.stage-result',$('#stage1')),result2=$('.stage-result',$('#stage2'));
    result1.classList.toggle('ready',!!route1);result1.innerHTML=routeResult(route1,movement1);
    result2.classList.toggle('ready',!!route2);result2.innerHTML=routeResult(route2,movement2);
  }
  function updateLPreview(){
    const code=$('#recordKey').value,from='JAKK VII',entry=$('.l-entry').value,coupling=$('.l-coupling').value,to=$('.l-return').value,route1=couplingRoute(from,entry,coupling),route2=directRoute(coupling,to);
    $('.l-auto-dao').textContent=coupling||'Otomatis dari jalur gandeng';
    const movement1=route1?`${code} LANGSIR DARI JALUR VII KE JALUR ${shortTrack(entry)} DAO, GANDENG JALUR ${shortTrack(coupling)} DAO.`:'';
    const movement2=route2?`${codePair(code)} LANGSIR DARI JALUR ${shortTrack(coupling)} DAO KE JALUR ${shortTrack(to)}.`:'';
    const result1=$('.stage-result',$('#stage1')),result2=$('.stage-result',$('#stage2'));
    result1.classList.toggle('ready',!!route1);result1.innerHTML=routeResult(route1,movement1);
    result2.classList.toggle('ready',!!route2);result2.innerHTML=routeResult(route2,movement2);
  }
  function stepsForR(code,input={}){
    const from=input.from||'',dao=input.dao||'',to=input.return||'',route1=directRoute(from,dao),route2=directRoute(dao,to);
    const movement1=route1?`${code} LANGSIR DARI JALUR ${shortTrack(from)} KE JALUR ${shortTrack(dao)} DAO.`:blankMovement(code);
    const movement2=route2?`${codePair(code)} LANGSIR DARI JALUR ${shortTrack(dao)} DAO KE JALUR ${shortTrack(to)}.`:blankMovement(codePair(code));
    return [
      {train_code:code,route_id:route1?.id||'',from_track:route1?from:'',to_track:route1?dao:'',via:'',signals:route1?.signals.join(', ')||'',switches:route1?.switches.join(', ')||'',movement:movement1,verified:!!route1?.verified},
      {train_code:codePair(code),route_id:route2?.id||'',from_track:route2?dao:'',to_track:route2?to:'',via:'',signals:route2?.signals.join(', ')||'',switches:route2?.switches.join(', ')||'',movement:movement2,verified:!!route2?.verified}
    ];
  }
  function stepsForL(code,input={}){
    const from='JAKK VII',entry=input.entry||'',coupling=input.coupling||'',to=input.return||'',route1=couplingRoute(from,entry,coupling),route2=directRoute(coupling,to);
    const movement1=route1?`${code} LANGSIR DARI JALUR VII KE JALUR ${shortTrack(entry)} DAO, GANDENG JALUR ${shortTrack(coupling)} DAO.`:blankMovement(code);
    const movement2=route2?`${codePair(code)} LANGSIR DARI JALUR ${shortTrack(coupling)} DAO KE JALUR ${shortTrack(to)}.`:blankMovement(codePair(code));
    return [
      {train_code:code,route_id:route1?.id||'',from_track:route1?from:'',to_track:route1?coupling:'',via:'',signals:route1?.signals.join(', ')||'',switches:route1?.switches.join(', ')||'',movement:movement1,verified:!!route1?.verified},
      {train_code:codePair(code),route_id:route2?.id||'',from_track:route2?coupling:'',to_track:route2?to:'',via:'',signals:route2?.signals.join(', ')||'',switches:route2?.switches.join(', ')||'',movement:movement2,verified:!!route2?.verified}
    ];
  }
  function currentSteps(code,type,input){return type==='R'?stepsForR(code,input):stepsForL(code,input);}
  function openRoute(code){
    state.editing=recordKey(code);const record=state.data.records[state.editing];$('#recordKey').value=code;$('#dialogTitle').textContent=code;$('#deleteRoute').hidden=!record;
    if(state.type==='R'){
      $('#routeHelp').textContent='Otomatis dua gerakan: R masuk DAO, lalu L kembali dari jalur DAO yang sama.';
      $('#stage1').innerHTML=rStage1Html(code);$('#stage2').innerHTML=rStage2Html(codePair(code));$('#stage2').hidden=false;
      $('.r-from').value=record?.input?.from||record?.steps?.[0]?.from_track||'';
      $('.r-dao').value=record?.input?.dao||record?.steps?.[0]?.to_track||'';
      $('.r-return').value=record?.input?.return||record?.steps?.[1]?.to_track||'';
      $$('#routeDialog select').forEach(select=>select.onchange=updateRPreview);updateRPreview();
    }else{
      $('#routeHelp').textContent='Otomatis dua gerakan: L dari jalur VII masuk dan gandeng di DAO, lalu berubah menjadi R untuk kembali ke JAKK.';
      $('#stage1').innerHTML=lStageHtml(code);$('#stage2').innerHTML=lStage2Html(codePair(code));$('#stage2').hidden=false;
      $('.l-entry').value=record?.input?.entry||record?.steps?.[0]?.to_track||'';
      $('.l-coupling').value=record?.input?.coupling||record?.steps?.[0]?.to_track||'';
      $('.l-return').value=record?.input?.return||record?.steps?.[1]?.to_track||'';
      $$('#routeDialog select').forEach(select=>select.onchange=updateLPreview);updateLPreview();
    }
    $('#routeDialog').showModal();
  }
  function saveRoute(){
    const code=$('#recordKey').value;let input;
    if(state.type==='R'){
      input={kind:'R',from:$('.r-from').value,dao:$('.r-dao').value,return:$('.r-return').value};
    }else{
      input={kind:'L',from:'JAKK VII',entry:$('.l-entry').value,coupling:$('.l-coupling').value,return:$('.l-return').value};
    }
    const steps=currentSteps(code,state.type,input);
    const date=$('#serviceDate').value,existing=state.data.records[state.editing],daily=existing?.daily_number||nextNumber(date);
    state.data.records[state.editing]={date,shift:state.shift,type:state.type,code,daily_number:daily,number:existing?.number||numberText(daily,date),input,steps,updated_at:new Date().toISOString()};saveData();saveDuty();$('#routeDialog').close();render();toast(`${code} berhasil disimpan.`);return true;
  }
  function deleteRoute(){if(!state.data.records[state.editing])return;delete state.data.records[state.editing];saveData();$('#routeDialog').close();render();toast('Isian dihapus.');}
  async function exportOrders(single=null){
    saveDuty();const date=$('#serviceDate').value,duty=currentDuty(),codes=single?[single]:[...DATA[state.shift].R.map(code=>({code,type:'R'})),...DATA[state.shift].L.map(code=>({code,type:'L'}))];
    const prepared=codes.map(({code,type})=>{const saved=state.data.records[`${date}|${state.shift}|${type}|${code}`],blankSteps=[{train_code:code,movement:blankMovement(code)},{train_code:codePair(code),movement:blankMovement(codePair(code))}],fresh=saved?.input?currentSteps(code,type,saved.input):null,steps=fresh||[saved?.steps?.[0]||blankSteps[0],saved?.steps?.[1]||blankSteps[1]];return {...(saved||{}),date,shift:state.shift,type,code,steps,service_day:currentServiceDay(),service_date:date,start_time:duty.startTime||'',end_time:duty.endTime||'',staff:staff()};});
    try{const bytes=await new window.XlsxTemplate(window.XLSX_TEMPLATES).export(prepared),blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=single?`Form_Langsir_${single.code}_${date}.xlsx`:`Form_Langsir_${date}_${state.shift}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);toast(single?`${single.code} dibuat sebagai 1 form Excel.`:`${prepared.length} form dibuat dalam 1 sheet Excel memanjang.`);}catch(error){console.error(error);toast('Excel gagal dibuat: '+error.message);}
  }
  function clearShift(){const prefix=`${$('#serviceDate').value}|${state.shift}|`,count=Object.keys(state.data.records).filter(k=>k.startsWith(prefix)).length;if(!count)return toast('Belum ada isian pada dinas ini.');if(!confirm(`Hapus ${count} isian pada dinas ${state.shift.toLowerCase()}?`))return;for(const key of Object.keys(state.data.records))if(key.startsWith(prefix))delete state.data.records[key];saveData();render();toast('Isian dinas dikosongkan.');}
  let toastTimer;function toast(message){clearTimeout(toastTimer);const el=$('#toast');el.textContent=message;el.className='toast';el.hidden=false;toastTimer=setTimeout(()=>el.hidden=true,3500);}

  $('#serviceDate').value=localDate();
  $$('.shift-option').forEach(b=>b.onclick=()=>selectShift(b.dataset.shift));
  $('#back').onclick=()=>{$('#workspace').hidden=true;$('#home').hidden=false;};
  $$('.type-tabs button').forEach(b=>b.onclick=()=>{state.type=b.dataset.type;render();});
  $('#trainList').onclick=e=>{const print=e.target.closest('[data-print-code]');if(print){exportOrders({code:print.dataset.printCode,type:state.type});return;}const b=e.target.closest('[data-code]');if(b)openRoute(b.dataset.code);};
  $('#routeForm').onsubmit=e=>{e.preventDefault();saveRoute();};
  $$('[data-close]').forEach(b=>b.onclick=()=>$('#routeDialog').close());
  $('#deleteRoute').onclick=deleteRoute;$('#clearShift').onclick=clearShift;
  $('#downloadExcel').onclick=$('#downloadExcelBottom').onclick=()=>exportOrders();
  $('#serviceDate').onchange=()=>{loadDuty();render();};
  $('#serviceDay').onchange=()=>{syncDayControl();saveDuty();};
  $$('#startTime,#endTime,#staffSchowing,#staffPlr,#staffMas,#staffPap').forEach(el=>el.onchange=saveDuty);
})();
