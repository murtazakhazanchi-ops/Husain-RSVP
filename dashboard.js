"use strict";
const API_URL="https://script.google.com/macros/s/AKfycbwo6kNofaeRAnITieVxDRccMurllRKSFmO-cElHxIYI3ytJJn3MfjKCOvtqdtva93_q/exec",KEY="212-34";
let key="",data=null,filtered=[],editing=null,charts={},dashboardLoaded=false;
const $=id=>document.getElementById(id);

document.addEventListener("DOMContentLoaded",()=>{
  bind(); $("adminKeyInput").value=KEY;
  for(let i=1;i<=10;i++) $("editAdults").add(new Option(i,i));
  for(let i=0;i<=4;i++) $("editChildren").add(new Option(i,i));
});

function bind(){
  $("loginBtn").onclick=login;
  $("adminKeyInput").onkeydown=e=>{if(e.key==="Enter")login()};
  $("refreshBtn").onclick=()=>load();
  document.querySelectorAll(".tab-button").forEach(b=>b.onclick=()=>tab(b.dataset.tab));
  document.querySelectorAll("[data-open-tab]").forEach(b=>b.onclick=()=>tab(b.dataset.openTab));
  $("searchInput").oninput=filterGuests; $("guestFilter").onchange=filterGuests;
  $("csvBtn").onclick=csv; $("excelBtn").onclick=excel; $("pdfBtn").onclick=()=>print();
  ["venueNameInput","venueAddressInput","mapsUrlInput","latitudeInput","longitudeInput","venueNotesInput","publicRsvpUrlInput"].forEach(id=>$(id).oninput=venuePreview);
  $("venueAnnounced").onchange=venuePreview; $("saveVenueBtn").onclick=saveVenue;
  $("generateQrBtn").onclick=qr; $("copyRsvpLinkBtn").onclick=copyLink; $("shareInvitationBtn").onclick=shareLink;
  $("announcementFilter").onchange=messages; $("countryCodeInput").oninput=messages;
  $("sendNextBtn").onclick=sendNext; $("copyMessageBtn").onclick=copyPreview; $("openPreviewWhatsAppBtn").onclick=openPreview;
  $("resetAnnouncementsBtn").onclick=resetMessages;
  $("editAttending").onchange=editAges; $("editChildren").onchange=editAges; $("saveEditBtn").onclick=saveEdit;
}

async function login(){
  if($("adminKeyInput").value.trim()!==KEY) return $("loginError").textContent="Incorrect key.";
  key=KEY; await load(true);
}
async function load(first=false){
  try{
    const r=await fetch(`${API_URL}?action=dashboard&key=${encodeURIComponent(key)}`);
    const j=await r.json();
    if(!j.success||!j.summary||!Array.isArray(j.rows)) throw Error(j.message||"Unable to load dashboard.");
    data=j; $("loginView").hidden=true; $("dashboardView").hidden=false;
    $("lastUpdatedText").textContent=new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
    renderAll(); dashboardLoaded=true; toast(first?"Dashboard ready.":"Dashboard synced.");
  }catch(e){$("loginError").textContent=e.message;$("loginView").hidden=false;$("dashboardView").hidden=true}
}
function renderAll(){eventStatus();summary();drawCharts();recent();filterGuests();venueForm();messages()}
function tab(name){
  document.querySelectorAll(".tab-button").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));
  document.querySelectorAll(".tab-panel").forEach(p=>p.classList.remove("active"));
  $(`${name}Tab`).classList.add("active");
  if(name==="overview") setTimeout(drawCharts,40);
}
function eventStatus(){
  const s=data.summary,c=data.config||{},last=data.rows[data.rows.length-1],published=c.publishVenue??c.venueAnnounced;
  $("eventStatusRows").innerHTML=`<div class="event-status-row"><span>RSVP status</span><strong><i class="status-dot open"></i>Open</strong></div>
  <div class="event-status-row"><span>Venue</span><strong>${published?"Published":"Pending"}</strong></div>
  <div class="event-status-row"><span>Venue Messages</span><strong>Sent ${s.announcementSent||0} of ${s.acceptedFamilies}</strong></div>
  <div class="event-status-row"><span>Last RSVP</span><strong>${last?esc(last.lastUpdated):"No RSVP responses"}</strong></div>`;
}
function summary(){
  const s=data.summary,items=[["Total Attending",s.totalGuests,1],["Accepted RSVPs",s.acceptedFamilies],["Declined RSVPs",s.declinedFamilies],["Adults",s.adults],["Children",s.children],["RSVP Responses",s.totalResponses]];
  $("summaryCards").innerHTML=items.map(x=>`<article class="summary-card ${x[2]?"primary":""}"><span>${x[0]}</span><strong>${x[1]}</strong></article>`).join("");
}
function drawCharts(){
  if(!data||typeof Chart==="undefined")return;
  Object.values(charts).forEach(c=>c?.destroy()); charts={};
  const s=data.summary,gp=s.totalGuests?Math.round(s.adults/s.totalGuests*100):0,acceptedLabel=s.acceptedFamilies===1?"Accepted RSVP":"Accepted RSVPs";
  $("attendanceCenter").innerHTML=`<strong>${s.acceptedFamilies}</strong><span>${acceptedLabel}</span>`;
  $("guestMixCenter").innerHTML=`<strong>${gp}%</strong><span>Adults</span>`;
  const opt={responsive:true,maintainAspectRatio:false,cutout:"68%",plugins:{legend:{position:"bottom",labels:{usePointStyle:true,padding:16}}}};
  charts.a=new Chart($("attendanceChart"),{type:"doughnut",data:{labels:["Accepted RSVPs","Declined RSVPs"],datasets:[{data:[s.acceptedFamilies,s.declinedFamilies],backgroundColor:["#28C76F","#E53935"],borderWidth:0,hoverOffset:8}]},options:opt});
  charts.g=new Chart($("guestMixChart"),{type:"doughnut",data:{labels:["Adults","Children"],datasets:[{data:[s.adults,s.children],backgroundColor:["#163D72","#F5B335"],borderWidth:0,hoverOffset:8}]},options:opt});
  const counts={}; data.rows.forEach(r=>r.childAges.forEach(a=>counts[a]=(counts[a]||0)+1)); const e=Object.entries(counts);
  charts.age=new Chart($("ageChart"),{type:"bar",data:{labels:e.map(x=>x[0]),datasets:[{data:e.map(x=>x[1]),backgroundColor:"#3F87C5",borderRadius:7}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0}},x:{grid:{display:false}}}}});
}
function recent(){
  $("recentList").innerHTML=[...data.rows].slice(-5).reverse().map(r=>`<article class="recent-item"><div><strong>${esc(r.guestName)}</strong><div class="guest-meta">${esc(r.mobileNumber)} · ${esc(r.action)}</div></div><span class="badge ${r.attending==="Yes"?"accepted":"declined"}">${r.attending==="Yes"?"Accepted RSVP":"Declined RSVP"}</span></article>`).join("")||`<p class="empty-state">No RSVPs yet.</p>`;
}
function filterGuests(){
  const q=$("searchInput").value.trim().toLowerCase(),f=$("guestFilter").value;
  filtered=data.rows.filter(r=>{const s=`${r.guestName} ${r.mobileNumber} ${r.rsvpId}`.toLowerCase();return(!q||s.includes(q))&&(f==="all"||f==="accepted"&&r.attending==="Yes"||f==="declined"&&r.attending==="No"||f==="withChildren"&&r.attending==="Yes"&&r.children>0||f==="withoutChildren"&&r.attending==="Yes"&&r.children===0||f==="updated"&&String(r.action).toLowerCase().includes("updated"))});
  guests();
}
function guests(){
  const call=`<svg viewBox="0 0 24 24"><path d="M6.6 3h3l1.5 4.5-2 1.5c1.4 3.2 3.7 5.5 6.9 6.9l1.5-2L22 15.4v3c0 1.4-1.1 2.6-2.5 2.6C10.4 21 3 13.6 3 4.5 3 3.7 3.7 3 4.5 3h2.1Z" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
  const edit=`<svg viewBox="0 0 24 24"><path d="m4 20 4.5-1 10-10-3.5-3.5-10 10L4 20Z" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
  const message=`<svg viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 3V5Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8 9h8M8 12h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
  $("guestList").innerHTML=filtered.map(r=>`<article class="guest-card"><div class="guest-card-header"><div><h3>${esc(r.guestName)}</h3><p class="guest-meta"><strong>Mobile</strong> ${esc(r.mobileNumber)}</p></div><span class="badge ${r.attending==="Yes"?"accepted":"declined"}"><span>Status</span> ${r.attending==="Yes"?"Accepted RSVP":"Declined RSVP"}</span></div><div class="guest-stats"><div><span>Adults</span><strong>${r.adults}</strong></div><div><span>Children</span><strong>${r.children}</strong></div><div><span>Updated</span><strong>${shortTime(r.lastUpdated)}</strong></div></div><p class="guest-meta"><strong>Child Ages</strong> ${r.childAges.length?esc(r.childAges.join(", ")):"None"}</p><p class="guest-meta"><strong>RSVP ID</strong> ${esc(r.rsvpId)}</p><div class="card-actions"><button class="secondary-button icon-text-button call" data-mobile="${esc(r.mobileNumber)}"><span class="svg-icon">${call}</span>Call</button><button class="secondary-button icon-text-button edit" data-id="${esc(r.rsvpId)}"><span class="svg-icon">${edit}</span>Edit</button>${r.attending==="Yes"?`<button class="whatsapp-button icon-text-button msg" data-id="${esc(r.rsvpId)}"><span class="svg-icon">${message}</span>Venue Message</button>`:""}</div></article>`).join("");
  $("emptyGuests").hidden=filtered.length!==0;
  document.querySelectorAll(".call").forEach(b=>b.onclick=()=>location.href=`tel:${b.dataset.mobile}`);
  document.querySelectorAll(".edit").forEach(b=>b.onclick=()=>openEdit(b.dataset.id));
  document.querySelectorAll(".msg").forEach(b=>b.onclick=()=>{const r=data.rows.find(x=>x.rsvpId===b.dataset.id);if(r)openGuestWhatsApp(r)});
}
function venueForm(){
  const c=data.config||{};$("venueAnnounced").checked=!!(c.publishVenue??c.venueAnnounced);$("venueNameInput").value=c.venueName||"";$("venueAddressInput").value=c.venueAddress||"";$("mapsUrlInput").value=c.mapsUrl||"";$("latitudeInput").value=c.latitude||"";$("longitudeInput").value=c.longitude||"";$("venueNotesInput").value=c.venueNotes||"";$("publicRsvpUrlInput").value=c.publicRsvpUrl||"";venuePreview();
}
function coordUrl(){const lat=$("latitudeInput").value.trim(),lng=$("longitudeInput").value.trim();return lat&&lng?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`:""}
function venuePreview(){
  $("venueError").textContent="";
  const on=$("venueAnnounced").checked,n=$("venueNameInput").value.trim(),a=$("venueAddressInput").value.trim(),m=$("mapsUrlInput").value.trim(),lat=$("latitudeInput").value.trim(),lng=$("longitudeInput").value.trim(),directions=m||coordUrl();
  $("venuePreviewName").textContent=on&&n?n:"Venue not announced";$("venuePreviewAddress").textContent=on&&a?a:"Add venue details above.";$("venuePreviewCoords").textContent=lat&&lng?`Coordinates: ${lat}, ${lng}`:"";$("venuePreviewLink").hidden=!(on&&directions);$("venuePreviewLink").href=directions||"#";if(!$("qrPanel").hidden)qr(false);
}
async function saveVenue(){
  const publishVenue=$("venueAnnounced").checked,publicRsvpUrl=$("publicRsvpUrlInput").value.trim(),config={publishVenue,venueAnnounced:publishVenue,venueName:$("venueNameInput").value.trim(),venueAddress:$("venueAddressInput").value.trim(),venueNotes:$("venueNotesInput").value.trim(),mapsUrl:$("mapsUrlInput").value.trim(),latitude:$("latitudeInput").value.trim(),longitude:$("longitudeInput").value.trim(),publicRsvpUrl};
  $("venueError").textContent="";
  if(!publicRsvpUrl){$("venueError").textContent="Public RSVP Webpage URL is required.";return}
  if(publishVenue&&(!config.venueName||!config.venueAddress||(!config.mapsUrl&&(!config.latitude||!config.longitude)))){$("venueError").textContent="Venue Name, Address and either Google Maps URL or coordinates are required before publishing.";return}
  try{const r=await post({mode:"saveConfig",adminKey:key,config});if(!r.success)throw Error(r.message);data.config=r.config;venuePreview();eventStatus();toast("Venue saved.")}catch(e){$("venueError").textContent=e.message}
}
function publicUrl(){return $("publicRsvpUrlInput")?.value.trim()||data?.config?.publicRsvpUrl||""}
function needPublicUrl(){const u=publicUrl();if(u)return u;$("venueError").textContent="Public RSVP Webpage URL is required.";tab("venue");return""}
function qrCodeAvailable(){if(typeof QRCode!=="undefined"&&typeof QRCode.toCanvas==="function")return true;console.warn("QRCode library unavailable.");return false}
function qr(showError=true){const u=showError?needPublicUrl():publicUrl();if(!dashboardLoaded||!u||!qrCodeAvailable())return;$("qrPanel").hidden=false;QRCode.toCanvas($("qrCanvas"),u,{width:180,margin:1},()=>{})}
async function copyLink(){const u=needPublicUrl();if(!u)return;try{await navigator.clipboard.writeText(u);toast("RSVP link copied.")}catch{toast("Could not copy link.",true)}}
function shareLink(){const u=needPublicUrl();if(!u)return;window.open(`https://wa.me/?text=${encodeURIComponent(`Captain Husain is turning one. Please RSVP by 8 August 2026:\n${u}`)}`,"_blank","noopener")}
function acceptedRsvps(){return data.rows.filter(r=>r.attending==="Yes")}
function messages(){
  const rows=acceptedRsvps(),sent=rows.filter(r=>r.announcementStatus==="Sent").length,pending=rows.length-sent;
  $("messageSummary").innerHTML=`<article><span>Pending</span><strong>${pending}</strong></article><article><span>Sent</span><strong>${sent}</strong></article><article><span>Total</span><strong>${rows.length}</strong></article>`;
  const f=$("announcementFilter").value,v=rows.filter(r=>f==="all"||f==="sent"&&r.announcementStatus==="Sent"||f==="pending"&&r.announcementStatus!=="Sent");
  $("announcementQueue").innerHTML=v.map(r=>`<article class="announcement-card"><div class="announcement-card-header"><div><h3>${esc(r.guestName)}</h3><p class="announcement-meta">${esc(attendance(r))} · ${esc(r.mobileNumber)}</p></div><span class="badge ${r.announcementStatus==="Sent"?"sent":"pending"}">${r.announcementStatus==="Sent"?"Sent":"Pending"}</span></div><div class="announcement-card-actions"><button class="secondary-button preview" data-id="${r.rsvpId}">Preview</button><button class="whatsapp-button send" data-id="${r.rsvpId}">Open WhatsApp</button><button class="secondary-button toggle" data-id="${r.rsvpId}">${r.announcementStatus==="Sent"?"Mark Pending":"Mark Sent"}</button></div></article>`).join("")||`<p class="empty-state">No messages in this view.</p>`;
  document.querySelectorAll(".preview").forEach(b=>b.onclick=()=>preview(rows.find(x=>x.rsvpId===b.dataset.id)));
  document.querySelectorAll(".send").forEach(b=>b.onclick=()=>openGuestWhatsApp(rows.find(x=>x.rsvpId===b.dataset.id)));
  document.querySelectorAll(".toggle").forEach(b=>b.onclick=()=>mark(rows.find(x=>x.rsvpId===b.dataset.id),rows.find(x=>x.rsvpId===b.dataset.id).announcementStatus==="Sent"?"Pending":"Sent",b.closest(".announcement-card")));
  const cur=rows.find(r=>r.rsvpId===$("messagePreview").dataset.rsvpId),first=rows.find(r=>r.announcementStatus!=="Sent")||rows[0];preview(cur||first);
}
function attendance(r){const a=`${r.adults} ${r.adults===1?"adult":"adults"}`;return r.children?`${a} and ${r.children} ${r.children===1?"child":"children"}`:a}
function msg(r){const c=data.config||{},notes=c.venueNotes?`\n\n${c.venueNotes}`:"",coords=c.latitude&&c.longitude?`https://www.google.com/maps/search/?api=1&query=${c.latitude},${c.longitude}`:"";return`Ahoy, ${r.guestName}!\n\nWe look forward to welcoming you to Captain Husain’s first birthday celebration.\n\nYour RSVP is accepted for *${attendance(r)}*.\n\nSaturday, 5 September 2026\n7:30 PM\n${c.venueName||"Venue to be announced"}\n${c.venueAddress||""}\n\nDirections:\n${c.mapsUrl||coords}${notes}\n\nWe look forward to celebrating with you and your family!`}
function preview(r){if(!r)return;$("messagePreview").value=msg(r);$("messagePreview").dataset.rsvpId=r.rsvpId}
function phone(v){const d=String(v||"").replace(/\D/g,""),cc=$("countryCodeInput").value.replace(/\D/g,"")||"91";return d.length===10?cc+d:d.startsWith("0")&&d.length===11?cc+d.slice(1):d}
function openGuestWhatsApp(r){if(!r)return;const c=data.config||{},published=c.publishVenue??c.venueAnnounced;if(!published||!c.venueName||(!c.mapsUrl&&(!c.latitude||!c.longitude))){tab("venue");return toast("Save and publish venue first.",true)}preview(r);window.open(`https://wa.me/${phone(r.mobileNumber)}?text=${encodeURIComponent(msg(r))}`,"_blank","noopener")}
async function mark(r,status,card){const j=await post({mode:"markAnnouncement",adminKey:key,rsvpId:r.rsvpId,status});if(j.success){r.announcementStatus=j.status;if(status==="Sent"&&card){card.classList.add("fade-out");setTimeout(()=>{messages();guests();eventStatus()},180)}else{messages();guests();eventStatus()}}}
function sendNext(){const r=acceptedRsvps().find(x=>x.announcementStatus!=="Sent");r?openGuestWhatsApp(r):toast("All messages are marked as sent.")}
async function copyPreview(){await navigator.clipboard.writeText($("messagePreview").value);toast("Message copied.")}
function openPreview(){openGuestWhatsApp(acceptedRsvps().find(r=>r.rsvpId===$("messagePreview").dataset.rsvpId))}
async function resetMessages(){if(!confirm("Reset all message statuses to Pending?"))return;const r=await post({mode:"resetAnnouncements",adminKey:key});if(r.success){data.rows.forEach(x=>{if(x.attending==="Yes")x.announcementStatus="Pending"});messages();eventStatus()}}
function openEdit(id){editing=data.rows.find(r=>r.rsvpId===id);if(!editing)return;$("editRsvpId").value=editing.rsvpId;$("editName").value=editing.guestName;$("editMobile").value=editing.mobileNumber;$("editAttending").value=editing.attending;$("editAdults").value=Math.max(1,editing.adults||1);$("editChildren").value=editing.children||0;editAges();$("editDialog").showModal()}
function editAges(){const n=$("editAttending").value==="Yes"?Number($("editChildren").value):0;$("editAdults").disabled=$("editAttending").value==="No";$("editChildren").disabled=$("editAttending").value==="No";$("editAges").innerHTML="";for(let i=0;i<n;i++){const l=document.createElement("label"),s=document.createElement("select");l.textContent=`Child ${i+1} age`;["Below 1 year",...Array.from({length:17},(_,x)=>`${x+1} year${x?"s":""}`)].forEach(a=>s.add(new Option(a,a)));s.value=editing?.childAges?.[i]||"Below 1 year";l.appendChild(s);$("editAges").appendChild(l)}}
async function saveEdit(){const ages=[...$("editAges").querySelectorAll("select")].map(s=>s.value),j=await post({mode:"adminUpdate",adminKey:key,rsvpId:$("editRsvpId").value,guestName:$("editName").value.trim(),mobileNumber:$("editMobile").value.trim(),attending:$("editAttending").value,adultCount:Number($("editAdults").value),childCount:Number($("editChildren").value),childAges:ages});if(j.success){$("editDialog").close();await load();tab("guests")}else $("editError").textContent=j.message}
function exportRows(){return[["Guest Name","Mobile","Attending","Adults","Children","Child Ages","RSVP ID","Last Updated","Action","Venue Message"],...filtered.map(r=>[r.guestName,r.mobileNumber,r.attending,r.adults,r.children,r.childAges.join("; "),r.rsvpId,r.lastUpdated,r.action,r.announcementStatus])]}
function csv(){download("husain-rsvp.csv",exportRows().map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n"),"text/csv")}
function excel(){download("husain-rsvp.xls",`<table>${exportRows().map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table>`,"application/vnd.ms-excel")}
function download(n,c,t){const b=new Blob([c],{type:t}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=n;a.click()}
async function post(d){return(await fetch(API_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(d)})).json()}
function toast(m,e=false){const x=$("toast");x.textContent=m;x.style.background=e?"#9E2230":"#0C2C55";x.classList.add("show");setTimeout(()=>x.classList.remove("show"),2300)}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function shortTime(v){const d=new Date(v);return isNaN(d)?String(v).slice(-8):d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
