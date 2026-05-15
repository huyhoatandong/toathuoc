let meds = window.INIT_MEDICINES || [];
const DEFAULT_ADVICE = 'Khi tái khám, vui lòng mang theo đơn này. Nếu vào thứ 7, chủ nhật hoặc ngày lễ có thể đến sớm hơn.';
const $ = id => document.getElementById(id);

function todayISO(){ return new Date().toISOString().slice(0,10); }
function dateVN(iso){ const d = iso ? new Date(iso + 'T00:00:00') : new Date(); return `Ngày ${String(d.getDate()).padStart(2,'0')} tháng ${String(d.getMonth()+1).padStart(2,'0')} năm ${d.getFullYear()}`; }
function esc(s=''){ return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function jsString(obj){ return JSON.stringify(obj).replace(/'/g,'&#39;'); }
function medByName(name){ return meds.find(m => m.name.toLowerCase() === (name || '').toLowerCase()); }
function medOptions(listId){ return `<datalist id="${listId}">${meds.map(m=>`<option value="${esc(m.name)}"></option>`).join('')}</datalist>`; }

function makeRow(data={}){
  const div=document.createElement('div'); div.className='med-row';
  const listId='medlist_'+Math.random().toString(36).slice(2);
  div.innerHTML=`
    ${medOptions(listId)}
    <div class="top">
      <input class="m-name" list="${listId}" placeholder="Tên thuốc" value="${esc(data.name||'')}">
      <input class="m-qty" placeholder="Số lượng" value="${esc(data.quantity||'')}">
      <button class="remove" type="button">×</button>
    </div>
    <div class="bottom">
      <input class="m-days" placeholder="Số lần/ngày" value="${esc(data.days||'')}">
      <input class="m-dose" placeholder="Mỗi lần" value="${esc(data.dose||'')}">
      <input class="m-route" placeholder="Cách dùng / thời điểm" value="${esc(data.route||'')}">
    </div>
    <input class="m-ins" placeholder="Dặn dò riêng của thuốc" value="${esc(data.instruction||'')}" style="margin-top:8px">
  `;
  div.querySelector('.remove').onclick=()=>{div.remove();updatePreview();};
  div.querySelector('.m-name').addEventListener('change',e=>{
    const m=medByName(e.target.value);
    if(m){
      div.querySelector('.m-qty').value=m.default_quantity||'';
      div.querySelector('.m-days').value=m.default_days||'';
      div.querySelector('.m-dose').value=m.default_dose||'';
      div.querySelector('.m-route').value=m.default_route||'';
      div.querySelector('.m-ins').value=m.default_instruction||'';
    }
    updatePreview();
  });
  div.querySelectorAll('input').forEach(i=>i.addEventListener('input',updatePreview));
  $('medicineRows').appendChild(div); updatePreview();
}

function refreshDatalists(){ document.querySelectorAll('.med-row datalist').forEach(old=>{ old.innerHTML=meds.map(m=>`<option value="${esc(m.name)}"></option>`).join(''); }); }
function getItems(){ return [...document.querySelectorAll('.med-row')].map(r=>({name:r.querySelector('.m-name').value.trim(),quantity:r.querySelector('.m-qty').value.trim(),days:r.querySelector('.m-days').value.trim(),dose:r.querySelector('.m-dose').value.trim(),route:r.querySelector('.m-route').value.trim(),instruction:r.querySelector('.m-ins').value.trim()})).filter(x=>x.name); }

function updatePreview(){
  $('pv_name').textContent=$('patient_name').value;
  $('pv_gender').textContent=$('gender').value;
  $('pv_age').textContent=$('age').value;
  $('pv_diagnosis').textContent=$('diagnosis').value;
  $('pv_advice').textContent=$('advice').value;
  $('pv_today_sign').textContent=dateVN($('prescription_date').value);
  $('pv_items').innerHTML=getItems().map((it,i)=>`
    <div class="rx-item">
      <div class="rx-item-name"><span class="index">${i+1}/</span><span class="name">${esc(it.name)}</span><span class="qty">Số lượng: ${esc(it.quantity||'………………')}</span></div>
      <div class="rx-item-use">Ngày: ${esc(it.days||'……')} lần, &nbsp; mỗi lần: ${esc(it.dose||'………')}</div>
      ${it.route?`<div class="rx-item-use">${esc(it.route)}</div>`:''}
      ${it.instruction?`<div class="rx-item-use">${esc(it.instruction)}</div>`:''}
    </div>`).join('');
}

async function saveCurrentPrescription(showMessage=true){
  const payload={patient_name:$('patient_name').value,gender:$('gender').value,age:$('age').value,diagnosis:$('diagnosis').value,advice:$('advice').value,prescription_date:$('prescription_date').value,items:getItems()};
  const r=await fetch('/api/prescription',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const j=await r.json();
  if(!j.ok) throw new Error(j.error || 'Lỗi lưu toa');
  if(showMessage) $('status').textContent='Đã lưu toa, bệnh nhân và thuốc mới.';
  await loadHistory(); await loadMedicines(); await refreshPatients();
  return j;
}

function fillMedForm(m){ $('newMedName').value=m.name||''; $('newMedQty').value=m.default_quantity||''; $('newMedDays').value=m.default_days||''; $('newMedDose').value=m.default_dose||''; $('newMedRoute').value=m.default_route||''; $('newMedIns').value=m.default_instruction||''; }
function clearMedForm(){ ['newMedName','newMedQty','newMedDays','newMedDose','newMedRoute','newMedIns'].forEach(id=>$(id).value=''); }

async function loadMedicines(){ meds=await fetch('/api/medicines').then(r=>r.json()); refreshDatalists(); renderMedicineList(); }
function renderMedicineList(){
  $('medicineList').innerHTML=meds.map(m=>`
    <div class="medicine-item"><div><b>${esc(m.name)}</b><br><small>SL: ${esc(m.default_quantity||'')} | Ngày: ${esc(m.default_days||'')} lần | Mỗi lần: ${esc(m.default_dose||'')} | ${esc(m.default_route||'')}</small></div>
    <div class="medicine-actions"><button type="button" class="secondary small" onclick='fillMedForm(${jsString(m)})'>Sửa</button><button type="button" class="danger small" onclick='deleteMedicine(${m.id}, ${JSON.stringify(m.name)})'>Xóa</button></div></div>`).join('') || '<div class="medicine-item">Chưa có thuốc trong danh mục.</div>';
}
async function deleteMedicine(id,name){ if(!confirm(`Xóa thuốc "${name}" khỏi danh mục thuốc tham khảo?`)) return; const r=await fetch('/api/medicine/'+id,{method:'DELETE'}); const j=await r.json(); $('status').textContent=j.ok?'Đã xóa thuốc khỏi danh mục.':(j.error||'Lỗi xóa thuốc'); if(j.ok) await loadMedicines(); }

async function loadHistory(){
  const list=await fetch('/api/prescriptions').then(r=>r.json());
  $('history').innerHTML=list.slice(0,50).map(x=>`<div class="history-item" onclick="loadPrescription(${x.id})"><b>${esc(x.patient_name)}</b><br>${esc(x.prescription_date||'')} - ${esc(x.diagnosis||'')}</div>`).join('') || '<div class="history-item">Chưa có toa đã lưu.</div>';
}
async function loadPrescription(id){
  const list=await fetch('/api/prescriptions').then(r=>r.json());
  const p=list.find(x=>x.id==id); if(!p) return;
  $('patient_name').value=p.patient_name||''; $('gender').value=p.gender||''; $('age').value=p.age||''; $('diagnosis').value=p.diagnosis||''; $('advice').value=p.advice||DEFAULT_ADVICE; $('prescription_date').value=p.prescription_date||todayISO();
  $('medicineRows').innerHTML='';
  try{ const items=JSON.parse(p.items_json||'[]'); if(items.length) items.forEach(it=>makeRow(it)); else makeRow(); } catch(e){ makeRow(); }
  updatePreview(); window.scrollTo({top:0,behavior:'smooth'});
}
async function refreshPatients(){
  const patients=await fetch('/api/patients').then(r=>r.json());
  $('patientSelect').innerHTML='<option value="">-- Bệnh nhân mới --</option>'+patients.map(p=>`<option value='${JSON.stringify(p).replace(/'/g,"&#39;")}'>${p.name} ${p.age?'- '+p.age+' tuổi':''}</option>`).join('');
}

['patient_name','gender','age','diagnosis','advice','prescription_date'].forEach(id=>$(id).addEventListener('input',updatePreview));
$('prescription_date').value=todayISO(); $('advice').value=DEFAULT_ADVICE;
$('addRow').onclick=()=>makeRow();

$('newBtn').onclick=()=>{ document.querySelectorAll('.main-panel input,.main-panel textarea,.main-panel select').forEach(el=>{ if(el.id!=='prescription_date') el.value=''; }); $('medicineRows').innerHTML=''; $('prescription_date').value=todayISO(); $('advice').value=DEFAULT_ADVICE; makeRow(); updatePreview(); };

$('patientSelect').onchange=e=>{ if(!e.target.value) return; const p=JSON.parse(e.target.value); $('patient_name').value=p.name||''; $('gender').value=p.gender||''; $('age').value=p.age||''; $('diagnosis').value=p.diagnosis||''; $('advice').value=p.note||DEFAULT_ADVICE; updatePreview(); };

$('saveBtn').onclick=async()=>{ try{ await saveCurrentPrescription(true); } catch(err){ $('status').textContent=err.message||'Lỗi lưu toa'; } };

$('printBtn').onclick=async()=>{
  try{
    updatePreview();
    $('status').textContent='Đang lưu toa trước khi in...';
    await saveCurrentPrescription(false);
    $('status').textContent='Đã tự động lưu toa. Đang mở cửa sổ in...';
    setTimeout(()=>window.print(),300);
  }catch(err){
    $('status').textContent=err.message||'Không lưu được toa nên chưa in.';
    alert(err.message||'Không lưu được toa nên chưa in.');
  }
};

$('saveMedBtn').onclick=async()=>{
  const payload={name:$('newMedName').value.trim(),default_quantity:$('newMedQty').value,default_days:$('newMedDays').value,default_dose:$('newMedDose').value,default_route:$('newMedRoute').value,default_instruction:$('newMedIns').value};
  const r=await fetch('/api/medicine',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const j=await r.json(); $('status').textContent=j.ok?'Đã lưu thuốc vào danh mục thuốc tham khảo.':(j.error||'Lỗi lưu thuốc');
  if(j.ok){ clearMedForm(); await loadMedicines(); }
};
$('clearMedBtn').onclick=clearMedForm;

makeRow(); updatePreview(); renderMedicineList(); loadHistory(); refreshPatients();
