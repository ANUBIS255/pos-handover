import { Geolocation } from "@capacitor/geolocation";
import { Filesystem, Directory } from "@capacitor/filesystem";

const DB_KEY="pos_handover_records_v1";
const $=s=>document.querySelector(s);
let photoData="";
let records=load();
function load(){try{return JSON.parse(localStorage.getItem(DB_KEY)||"[]")}catch{return []}}
function save(){localStorage.setItem(DB_KEY,JSON.stringify(records))}
function toast(t){const el=$("#toast");el.textContent=t;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600)}
function nextSerial(){const n=Number(localStorage.getItem("pos_handover_seq")||0)+1;return "POS-"+String(n).padStart(5,"0")}
function updateMeta(){$("#serial").textContent=nextSerial();$("#date").textContent=new Date().toLocaleString("ar-EG")}
updateMeta();
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===b));$("#new").classList.toggle("hidden",b.dataset.tab!=="new");$("#records").classList.toggle("hidden",b.dataset.tab!=="records");if(b.dataset.tab==="records")render()}));
$("#photo").addEventListener("change",async e=>{const f=e.target.files?.[0];if(!f)return;if(!f.type.startsWith("image/")){toast("اختر ملف صورة");return}photoData=await compressImage(f);$("#preview").src=photoData;$("#preview").classList.remove("hidden")});
function compressImage(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{const scale=Math.min(1,1600/Math.max(img.width,img.height));const c=document.createElement("canvas");c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext("2d").drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL("image/jpeg",.82))};img.onerror=reject;img.src=reader.result};reader.onerror=reject;reader.readAsDataURL(file)})}
$("#gpsBtn").addEventListener("click",async()=>{
  $("#gpsStatus").textContent="جارٍ تحديد الموقع...";
  try{
    let p;
    if(window.Capacitor?.isNativePlatform?.()){
      const permission=await Geolocation.requestPermissions();
      if(permission.location!=="granted" && permission.coarseLocation!=="granted") throw new Error("permission");
      p=await Geolocation.getCurrentPosition({enableHighAccuracy:true,timeout:20000,maximumAge:0});
    }else{
      if(!navigator.geolocation)throw new Error("unsupported");
      p=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:20000,maximumAge:0}));
    }
    const lat=p.coords.latitude, lng=p.coords.longitude;
    $('[name=lat]').value=lat.toFixed(6); $('[name=lng]').value=lng.toFixed(6);
    $("#gpsStatus").textContent="تم تحديد الموقع بنجاح";
    toast("تم وضع الإحداثيات في حقول الموقع");
  }catch(e){
    $("#gpsStatus").textContent="لم يتم تحديد الموقع";
    if(e.message==="permission")toast("اسمح للتطبيق بالوصول إلى الموقع من رسالة الإذن التي ستظهر أو من إعدادات أندرويد");
    else if(e.message==="unsupported")toast("تحديد الموقع غير مدعوم على هذا الجهاز");
    else toast("تعذر تحديد الموقع. فعّل GPS واسمح للتطبيق باستخدام الموقع");
  }
});
$("#handoverForm").addEventListener("submit",e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const machine=String(fd.get("machine")).trim();if(records.some(r=>r.machine.toLowerCase()===machine.toLowerCase())){toast("رقم الماكينة مسجل من قبل");return}if(!fd.get("ack")||!fd.get("noDues")){toast("يجب تأكيد الإقرارين قبل حفظ المحضر");return}const n=Number(localStorage.getItem("pos_handover_seq")||0)+1;localStorage.setItem("pos_handover_seq",n);const r={id:"POS-"+String(n).padStart(5,"0"),createdAt:new Date().toISOString(),village:String(fd.get("village")).trim(),merchant:String(fd.get("merchant")).trim(),machine,phone:String(fd.get("phone")).trim(),charger:!!fd.get("charger"),battery:!!fd.get("battery"),sim:!!fd.get("sim"),lat:fd.get("lat")||"",lng:fd.get("lng")||"",photo:photoData,noDues:true,ack:true};records.unshift(r);try{save()}catch(err){records.shift();localStorage.setItem("pos_handover_seq",String(n-1));toast("مساحة التخزين ممتلئة؛ احذف بعض الصور أو صدّر نسخة احتياطية");return}e.currentTarget.reset();photoData="";$("#preview").classList.add("hidden");$("#gpsStatus").textContent="لم يتم تحديد الموقع";updateMeta();toast("تم حفظ المحضر بنجاح")});
function render(){const q=$("#search").value.trim().toLowerCase();const list=records.filter(r=>[r.merchant,r.machine,r.village,r.id].some(x=>String(x).toLowerCase().includes(q)));$("#recordList").innerHTML=list.length?list.map(r=>`<article class="record"><strong>${esc(r.merchant)} — ${esc(r.machine)}</strong><small>${esc(r.id)} · ${esc(r.village)} · ${new Date(r.createdAt).toLocaleString("ar-EG")}</small><div class="record-actions"><button class="secondary" data-view="${r.id}">عرض</button><button class="secondary" data-jpg="${r.id}">حفظ JPG</button><button class="secondary" data-del="${r.id}">حذف</button></div></article>`).join(""):"<p class='hint'>لا توجد محاضر مطابقة.</p>";}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
$("#search").addEventListener("input",render);
$("#recordList").addEventListener("click",e=>{const v=e.target.dataset.view,j=e.target.dataset.jpg,d=e.target.dataset.del;if(v){const r=records.find(x=>x.id===v);showDetail(r)}if(j){const r=records.find(x=>x.id===j);makeJpg(r)}if(d){if(confirm("هل تريد حذف هذا المحضر نهائيًا؟")){records=records.filter(x=>x.id!==d);save();render();toast("تم الحذف")}}});
function showDetail(r){if(!r)return;$("#detailContent").innerHTML=`<h3>محضر ${esc(r.id)}</h3><div class="detail-grid">${[["التاريخ",new Date(r.createdAt).toLocaleString("ar-EG")],["القرية",r.village],["التاجر",r.merchant],["رقم الماكينة",r.machine],["التليفون",r.phone],["الشاحن",r.charger?"نعم":"لا"],["البطارية",r.battery?"نعم":"لا"],["الشريحة",r.sim?"نعم":"لا"],["GPS",r.lat?`${r.lat}, ${r.lng}`:"غير محدد"]].map(a=>`<div><b>${a[0]}</b>${esc(a[1])}</div>`).join("")}</div><p class="hint">إقرار التاجر بعدم وجود مستحقات مالية أو مبالغ نقدية لدى مستلم المنطقة الجديد: ${r.noDues?"تم التأكيد":"غير مسجل في هذا المحضر"}.</p><p class="hint">إقرار مراجعة البيانات والموافقة عليها بحضور مندوب المنطقة السابق ومشرف المنطقة: ${r.ack?"تم التأكيد":"غير مسجل في هذا المحضر"}.</p>${r.photo?`<img class="detail-photo" src="${r.photo}" alt="صورة المستند">`:""}`;$("#detailDialog").showModal()}
$("#closeDialog").addEventListener("click",()=>$("#detailDialog").close());
function makeJpg(r){
  const c=document.createElement("canvas"),ctx=c.getContext("2d");
  c.width=1200;c.height=r.photo?1900:1500;
  ctx.fillStyle="#fff";ctx.fillRect(0,0,c.width,c.height);
  ctx.fillStyle="#10243a";ctx.fillRect(0,0,c.width,140);
  ctx.fillStyle="#fff";ctx.font="bold 42px sans-serif";ctx.textAlign="right";ctx.direction="rtl";
  ctx.fillText("محضر استلام / تسليم ماكينة POS",1120,85);
  ctx.fillStyle="#182b3e";ctx.font="30px sans-serif";let y=210;
  const rows=[["رقم المحضر",r.id],["التاريخ",new Date(r.createdAt).toLocaleString("ar-EG")],["القرية",r.village],["اسم التاجر",r.merchant],["رقم الماكينة",r.machine],["رقم التليفون",r.phone],["الشاحن",r.charger?"موجود":"غير موجود"],["البطارية",r.battery?"موجودة":"غير موجودة"],["الشريحة",r.sim?"موجودة":"غير موجودة"],["خط العرض",r.lat||"غير محدد"],["خط الطول",r.lng||"غير محدد"]];
  for(const [k,v] of rows){ctx.textAlign="right";ctx.direction="rtl";ctx.fillStyle="#607588";ctx.fillText(k,1080,y);ctx.textAlign="left";ctx.direction="ltr";ctx.fillStyle="#182b3e";ctx.fillText(String(v),100,y);ctx.strokeStyle="#dce5eb";ctx.beginPath();ctx.moveTo(80,y+22);ctx.lineTo(1120,y+22);ctx.stroke();y+=72}
  y+=18;ctx.fillStyle="#10243a";ctx.font="bold 28px sans-serif";ctx.textAlign="right";ctx.direction="rtl";ctx.fillText("إقرارات التاجر",1080,y);y+=52;
  ctx.fillStyle="#182b3e";ctx.font="25px sans-serif";
  const drawWrapped=(text,maxWidth,lineHeight)=>{let line="",lines=[];for(const word of text.split(" ")){const test=line?line+" "+word:word;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word}else line=test}if(line)lines.push(line);for(const ln of lines){ctx.fillText(ln,1080,y);y+=lineHeight}};
  ctx.textAlign="right";ctx.direction="rtl";
  drawWrapped("☑ أقرّ أنا التاجر بأنه لا توجد لي أي مستحقات مالية أو مبالغ نقدية لدى مستلم المنطقة الجديد، ولا توجد أي مبالغ أو عهد مالية معلّقة في ذمته لصالحـي حتى تاريخ تحرير هذا المحضر، وذلك بعد المراجعة والتأكيد.",1000,38);
  y+=12;
  drawWrapped("☑ أقرّ بأن جميع البيانات والإقرارات الواردة بهذا المحضر قد تمت مراجعتها وتأكيدها والموافقة عليها من جانبي، وذلك في حضور مندوب المنطقة السابق ومشرف المنطقة.",1000,38);
  y+=24;ctx.font="22px sans-serif";ctx.fillStyle="#607588";ctx.fillText("تم إنشاء هذا المحضر إلكترونيًا من تطبيق POS Handover",1080,y);
  const finish=()=>downloadCanvas(c,r.id);
  if(r.photo){const img=new Image();img.onload=()=>{const maxW=1000,maxH=300,scale=Math.min(maxW/img.width,maxH/img.height);ctx.drawImage(img,100,y+35,img.width*scale,img.height*scale);finish()};img.onerror=finish;img.src=r.photo}else finish();
}
async function downloadCanvas(c,id){
  try{
    const data=c.toDataURL("image/jpeg",.92).split(",")[1];
    if(window.Capacitor?.isNativePlatform?.()){
      const result=await Filesystem.writeFile({path:`POS Handover/${id}.jpg`,data,directory:Directory.Documents,recursive:true});
      toast("تم حفظ الصورة في مجلد Documents / POS Handover على الهاتف");
      return result;
    }
    const a=document.createElement("a");a.href="data:image/jpeg;base64,"+data;a.download=`${id}.jpg`;a.click();toast("تم تنزيل صورة المحضر");
  }catch(e){
    const a=document.createElement("a");a.href=c.toDataURL("image/jpeg",.92);a.download=`${id}.jpg`;a.click();
    toast("تعذر الحفظ المباشر؛ بدأ تنزيل الصورة بالطريقة البديلة");
  }
}
$("#exportAll").addEventListener("click",()=>{const blob=new Blob([JSON.stringify({version:1,records},null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`pos-handover-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href)});
$("#importFile").addEventListener("change",async e=>{const f=e.target.files?.[0];if(!f)return;try{const data=JSON.parse(await f.text());const incoming=Array.isArray(data)?data:data.records;if(!Array.isArray(incoming))throw Error();const ids=new Set(records.map(x=>x.id));const machines=new Set(records.map(x=>x.machine));for(const r of incoming){if(r?.id&&!ids.has(r.id)&&r.machine&&!machines.has(r.machine)){records.push(r);ids.add(r.id);machines.add(r.machine)}}save();render();toast("تم استيراد البيانات غير المكررة")}catch{toast("ملف النسخة الاحتياطية غير صالح")}e.target.value=""});
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
render();