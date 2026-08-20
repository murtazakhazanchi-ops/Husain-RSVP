"use strict";
const API_URL="https://script.google.com/macros/s/AKfycbwo6kNofaeRAnITieVxDRccMurllRKSFmO-cElHxIYI3ytJJn3MfjKCOvtqdtva93_q/exec",KEY="212-34";
let key="",data=null,filtered=[],filteredInvitations=[],editing=null,editingInvitation=null,charts={},dashboardLoaded=false;
const $=id=>document.getElementById(id);
const INVITATION_IMAGE_PATH="husain-invite.jpg";

document.addEventListener("DOMContentLoaded",()=>{
  bind(); $("adminKeyInput").value=KEY;
  for(let i=1;i<=10;i++) $("editAdults").add(new Option(i,i));
  for(let i=0;i<=4;i++) $("editChildren").add(new Option(i,i));
  for(let i=0;i<=10;i++) $("inviteAdultsInput").add(new Option(i,i));
  for(let i=0;i<=4;i++) $("inviteChildrenInput").add(new Option(i,i));
  inviteTotal();
});

function bind(){
  $("loginBtn").onclick=login;
  $("adminKeyInput").onkeydown=e=>{if(e.key==="Enter")login()};
  $("refreshBtn").onclick=()=>load();
  document.querySelectorAll(".tab-button").forEach(b=>b.onclick=()=>tab(b.dataset.tab));
  document.querySelectorAll("[data-open-tab]").forEach(b=>b.onclick=()=>tab(b.dataset.openTab));
  $("searchInput").oninput=filterGuests; $("guestFilter").onchange=filterGuests;
  $("csvBtn").onclick=csv; $("excelBtn").onclick=excel; $("pdfBtn").onclick=()=>print();
  $("addInvitationBtn").onclick=()=>openInvitationDialog();
  $("invitationFilter").onchange=filterGuests; $("shareFilter").onchange=filterGuests;
  $("inviteAdultsInput").onchange=inviteTotal; $("inviteChildrenInput").onchange=inviteTotal;
  $("saveInvitationBtn").onclick=saveInvitation;
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
    const r=await fetch(`${API_URL}?action=dashboard&key=${encodeURIComponent(key)}&_=${Date.now()}`,{cache:"no-store"});
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
  const rsvpOpen=c.rsvpOpen!==false;
  $("eventStatusRows").innerHTML=`<div class="event-status-row rsvp-status-control"><span>RSVP status</span><div class="rsvp-status-action"><strong><i class="status-dot ${rsvpOpen?"open":"closed"}"></i>${rsvpOpen?"Open":"Closed"}</strong><button id="rsvpToggleBtn" class="${rsvpOpen?"secondary-button":"primary-button"} rsvp-toggle-button" type="button">${rsvpOpen?"Close RSVPs":"Reopen RSVPs"}</button></div></div>
  <div class="event-status-row"><span>Venue</span><strong>${published?"Published":"Pending"}</strong></div>
  <div class="event-status-row"><span>Venue Messages</span><strong>Sent ${s.announcementSent||0} of ${s.acceptedFamilies}</strong></div>
  <div class="event-status-row"><span>Last RSVP</span><strong>${last?esc(last.lastUpdated):"No RSVP responses"}</strong></div>`;
  $("rsvpToggleBtn").onclick=()=>toggleRsvpOpen(!rsvpOpen);
}
async function toggleRsvpOpen(nextOpen){
  if(!nextOpen&&!confirm("Close RSVPs?\n\nNew RSVP submissions will be disabled until you reopen them."))return;
  const button=$("rsvpToggleBtn"),previous=data.config?.rsvpOpen!==false;
  if(button){button.disabled=true;button.textContent=nextOpen?"Reopening...":"Closing..."}
  try{
    const r=await post({mode:"setRsvpOpen",adminKey:key,rsvpOpen:nextOpen});
    if(!r.success)throw Error(r.message||"Unable to update RSVP status.");
    data.config=r.config||{...(data.config||{}),rsvpOpen:nextOpen};
    eventStatus();
    toast(nextOpen?"RSVPs reopened.":"RSVPs closed.");
  }catch(e){
    data.config={...(data.config||{}),rsvpOpen:previous};
    eventStatus();
    toast(e.message||"Unable to update RSVP status.",true);
  }
}
function summary(){
  const s=data.summary,items=[["Total Attending",s.totalGuests,1],["Accepted RSVPs",s.acceptedFamilies],["Declined RSVPs",s.declinedFamilies],["Adults",s.adults],["Children",s.children],["RSVP Responses",s.totalResponses],["Personal Invites Created",s.personalInvitesCreated||0],["Invites Shared",s.invitesShared||0],["Awaiting Response",s.awaitingResponse||0],["Not Yet Shared",s.notYetShared||0]];
  $("summaryCards").innerHTML=items.map(x=>`<article class="summary-card ${x[2]?"primary":""}"><span>${x[0]}</span><strong>${x[1]}</strong></article>`).join("");
}
function plural(n,singular,pluralText=`${singular}s`){return Number(n)===1?singular:pluralText}
function doughnutOptions(){return{responsive:true,maintainAspectRatio:false,cutout:"68%",layout:{padding:{top:2,bottom:2}},plugins:{legend:{position:"bottom",labels:{usePointStyle:true,padding:24,boxWidth:8,boxHeight:8,font:{size:12,weight:"700"}}}}}}
const legendSpacingPlugin={id:"legendSpacing",afterInit(chart){const legend=chart.legend;if(!legend||legend._spaced)return;const fit=legend.fit;legend.fit=function(){fit.bind(legend)();this.height+=16};legend._spaced=true}};
function positionChartCenter(chart){
  const area=chart.chartArea,wrap=chart.canvas.closest(".chart-with-center"),center=wrap?.querySelector(".chart-center");
  if(!area||!center)return;
  center.style.setProperty("--chart-center-top",`${area.top}px`);
  center.style.setProperty("--chart-center-left",`${area.left}px`);
  center.style.setProperty("--chart-center-width",`${area.right-area.left}px`);
  center.style.setProperty("--chart-center-height",`${area.bottom-area.top}px`);
}
const centerOverlayPlugin={id:"centerOverlayBounds",afterLayout:positionChartCenter,afterResize:positionChartCenter};
function drawCharts(){
  if(!data||typeof Chart==="undefined")return;
  Object.values(charts).forEach(c=>c?.destroy()); charts={};
  const s=data.summary,gp=s.totalGuests?Math.round(s.adults/s.totalGuests*100):0;
  $("attendanceCenter").innerHTML=`<strong>${s.acceptedFamilies}</strong><span>Accepted</span>`;
  $("guestMixCenter").innerHTML=`<strong>${gp}%</strong><span>Adults</span>`;
  $("attendanceSummary").textContent=`${s.acceptedFamilies} accepted • ${s.declinedFamilies} declined`;
  $("guestMixSummary").textContent=`${s.adults} ${plural(s.adults,"adult")} • ${s.children} ${plural(s.children,"child","children")}`;
  charts.a=new Chart($("attendanceChart"),{type:"doughnut",data:{labels:["Accepted","Declined"],datasets:[{data:[s.acceptedFamilies,s.declinedFamilies],backgroundColor:["#28C76F","#E53935"],borderWidth:0,hoverOffset:8}]},options:doughnutOptions(),plugins:[legendSpacingPlugin,centerOverlayPlugin]});
  charts.g=new Chart($("guestMixChart"),{type:"doughnut",data:{labels:["Adults","Children"],datasets:[{data:[s.adults,s.children],backgroundColor:["#163D72","#F5B335"],borderWidth:0,hoverOffset:8}]},options:doughnutOptions(),plugins:[legendSpacingPlugin,centerOverlayPlugin]});
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
  invitations();
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
function invitationPeople(adults,children){const parts=[];if(adults)parts.push(`${adults} ${plural(adults,"Adult")}`);if(children)parts.push(`${children} ${plural(children,"Child","Children")}`);return parts.join(" · ")||"0 people"}
function invitationUrl(inv){const u=publicUrl(),t=inv.inviteToken||inv.token;if(!u||!t)return"";return`${u}${u.includes("?")?"&":"?"}invite=${encodeURIComponent(t)}`}
function requireInvitationUrl(inv){const u=invitationUrl(inv);if(u)return u;tab("venue");toast("Add the Public RSVP Webpage URL before sharing invitation links.",true);return""}
function approvedInvitationMessage(url,includeUrl=true){return`⚓ Ahoy, Mateys!\n\nCaptain Husain is turning ONE, and we’d be delighted to have you celebrate this special milestone with us.\n\nPlease take a moment to RSVP using the link below so we can make the necessary arrangements.\n\nRSVP here:${includeUrl?`\n${url}`:""}\n\nThe venue details will be shared once finalized.\n\nWe look forward to celebrating this special day with you and your family.\n\nWith love,\nMurtaza, Batul, Husaina, Zahra & Captain Husain ⚓`}
function invitations(){
  const q=$("searchInput").value.trim().toLowerCase(),f=$("invitationFilter").value,sf=$("shareFilter").value,items=data.invitations||[];
  filteredInvitations=items.filter(inv=>{const s=`${inv.guestName} ${inv.mobileNumber} ${inv.inviteToken||inv.token} ${inv.rsvpId}`.toLowerCase(),share=inv.shareStatus==="Shared"?"Shared":"Not Shared";return(!q||s.includes(q))&&(f==="all"||inv.status===f)&&(sf==="all"||share===sf)});
  const copy=`<svg viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
  const wa=`<svg viewBox="0 0 24 24"><path d="M20.5 11.7a8.5 8.5 0 0 1-12.4 7.5L3 20.5l1.4-5a8.5 8.5 0 1 1 16.1-3.8Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.5 7.5c.4-.5.8-.5 1.2-.1l1.2 2c.2.4.1.7-.2 1l-.7.7c1.1 2.1 2.8 3.6 4.9 4.4l.7-.9c.3-.4.7-.5 1.1-.3l2 1c.5.2.6.6.4 1.1-.4 1.1-1.7 2-2.9 2-4.5 0-9.6-4.5-9.6-9 0-.8.8-1.6 1.9-1.9Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`;
  const share=`<svg viewBox="0 0 24 24"><path d="M12 3v11M8 7l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 12v7h14v-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const edit=`<svg viewBox="0 0 24 24"><path d="m4 20 4.5-1 10-10-3.5-3.5-10 10L4 20Z" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
  $("invitationList").innerHTML=filteredInvitations.map(inv=>{const shared=inv.shareStatus==="Shared",token=esc(inv.inviteToken||inv.token);return`<article class="invitation-card"><div class="invitation-card-header"><div><h3>${esc(inv.guestName)}</h3><p class="guest-meta"><strong>Mobile</strong> ${inv.mobileNumber?esc(inv.mobileNumber):"Not provided"}</p></div><div class="invitation-badges"><span class="badge ${inv.status==="Accepted"?"accepted":inv.status==="Declined"?"declined":"pending"}">${esc(inv.status)}</span><span class="badge ${shared?"sent":"pending"}">${shared?"Shared":"Not Shared"}</span></div></div><div class="invitation-details"><div><span>Invited</span><strong>${esc(invitationPeople(inv.adultsInvited,inv.childrenInvited))}</strong></div><div><span>Attending</span><strong>${inv.status==="Awaiting RSVP"?"—":esc(invitationPeople(inv.adultsAttending,inv.childrenAttending))}</strong></div><div><span>Sharing</span><strong>${shared?`Shared<br><small>${esc(shortDateTime(inv.lastSharedAt))}</small>`:"Not Shared"}</strong></div><div><span>Share Count</span><strong>${Number(inv.shareCount||0)}</strong></div></div><p class="guest-meta invite-link-meta"><strong>Invitation ID</strong> ${token}</p><div class="card-actions"><button class="secondary-button icon-text-button copy-invite" data-token="${token}"><span class="svg-icon">${copy}</span>Copy Invitation Link</button><button class="secondary-button icon-text-button native-share-invite" data-token="${token}"><span class="svg-icon">${share}</span>${shared?"Share Again":"Share Invitation"}</button><button class="whatsapp-button icon-text-button share-invite" data-token="${token}"><span class="svg-icon">${wa}</span>${shared?"Share Again":"Share on WhatsApp"}</button><button class="secondary-button icon-text-button edit-invite" data-token="${token}"><span class="svg-icon">${edit}</span>Edit Invitation</button>${shared?`<button class="secondary-button icon-text-button unshare-invite" data-token="${token}">Mark Unshared</button>`:""}</div></article>`}).join("");
  $("emptyInvitations").hidden=filteredInvitations.length!==0;
  document.querySelectorAll(".copy-invite").forEach(b=>b.onclick=()=>copyInvitationLink(invitationByToken(b.dataset.token)));
  document.querySelectorAll(".native-share-invite").forEach(b=>b.onclick=()=>nativeShareInvitation(invitationByToken(b.dataset.token)));
  document.querySelectorAll(".share-invite").forEach(b=>b.onclick=()=>shareInvitationWhatsApp(invitationByToken(b.dataset.token)));
  document.querySelectorAll(".edit-invite").forEach(b=>b.onclick=()=>openInvitationDialog(invitationByToken(b.dataset.token)));
  document.querySelectorAll(".unshare-invite").forEach(b=>b.onclick=()=>markInvitationUnshared(invitationByToken(b.dataset.token)));
}
function invitationByToken(token){return(data.invitations||[]).find(inv=>(inv.inviteToken||inv.token)===token)}
async function copyInvitationLink(inv){if(!inv)return;const u=requireInvitationUrl(inv);if(!u)return;try{await navigator.clipboard.writeText(u);toast("Invitation link copied.")}catch{toast("Could not copy invitation link.",true)}}
function refreshInvitationSummary(){const invitations=data.invitations||[],shared=invitations.filter(inv=>inv.shareStatus==="Shared");data.summary={...(data.summary||{}),personalInvitesCreated:invitations.length,invitesShared:shared.length,awaitingResponse:shared.filter(inv=>inv.status==="Awaiting RSVP").length,notYetShared:invitations.filter(inv=>inv.shareStatus!=="Shared").length}}
async function markInvitationShared(inv){if(!inv)return;const r=await post({mode:"markInvitationShared",adminKey:key,inviteToken:inv.inviteToken||inv.token});if(r.success&&r.invitation){Object.assign(inv,r.invitation);refreshInvitationSummary();summary();invitations();toast("Invitation marked shared.")}}
async function markInvitationUnshared(inv){if(!inv)return;const r=await post({mode:"markInvitationUnshared",adminKey:key,inviteToken:inv.inviteToken||inv.token});if(r.success&&r.invitation){Object.assign(inv,r.invitation);refreshInvitationSummary();summary();invitations();toast("Invitation marked unshared.")}else toast(r.message||"Unable to update sharing status.",true)}
async function shareInvitationWhatsApp(inv){if(!inv)return;const u=requireInvitationUrl(inv);if(!u)return;const opened=window.open(`https://wa.me/${inv.mobileNumber?phone(inv.mobileNumber):""}?text=${encodeURIComponent(approvedInvitationMessage(u))}`,"_blank");if(opened){await markInvitationShared(inv)}else toast("WhatsApp share could not be opened.",true)}
async function nativeShareInvitation(inv){if(!inv)return;const u=requireInvitationUrl(inv);if(!u)return;try{if(!navigator.share)throw Error("native-share-unavailable");const response=await fetch(INVITATION_IMAGE_PATH,{cache:"no-store"});if(!response.ok)throw Error("image-unavailable");const blob=await response.blob(),file=new File([blob],"husain-invite.jpg",{type:blob.type||"image/jpeg"});if(!navigator.canShare||!navigator.canShare({files:[file]}))throw Error("file-share-unavailable");await navigator.share({files:[file],text:approvedInvitationMessage(u,false),url:u});await markInvitationShared(inv)}catch(e){if(e&&e.name==="AbortError")return;await shareInvitationWhatsApp(inv)}}
function inviteTotal(){$("inviteTotalOutput").textContent=Number($("inviteAdultsInput").value||0)+Number($("inviteChildrenInput").value||0)}
function openInvitationDialog(inv=null){editingInvitation=inv;$("invitationDialogTitle").textContent=inv?"Edit Invitation":"Add Invitation";$("saveInvitationBtn").textContent=inv?"Save Invitation":"Create Invitation";$("invitationTokenInput").value=inv?.inviteToken||inv?.token||"";$("inviteNameInput").value=inv?.guestName||"";$("inviteMobileInput").value=inv?.mobileNumber||"";$("inviteAdultsInput").value=String(inv?.adultsInvited??2);$("inviteChildrenInput").value=String(inv?.childrenInvited??0);$("invitationError").textContent="";inviteTotal();$("invitationDialog").showModal()}
async function saveInvitation(){
  const payload={guestName:$("inviteNameInput").value.trim(),mobileNumber:$("inviteMobileInput").value.trim(),adultsInvited:Number($("inviteAdultsInput").value||0),childrenInvited:Number($("inviteChildrenInput").value||0)};
  if(editingInvitation)payload.inviteToken=$("invitationTokenInput").value;
  $("invitationError").textContent="";
  if(!payload.guestName){$("invitationError").textContent="Guest Name is required.";return}
  if(payload.adultsInvited+payload.childrenInvited<1){$("invitationError").textContent="At least one person must be invited.";return}
  try{
    const r=await post({mode:editingInvitation?"updateInvitation":"createInvitation",adminKey:key,invitation:payload});
    if(!r.success)throw Error(r.message||"Unable to save invitation.");
    $("invitationDialog").close();
    await load();
    tab("guests");
    toast(editingInvitation?"Invitation updated.":"Invitation created.");
  }catch(e){$("invitationError").textContent=e.message}
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
function msg(r){const c=data.config||{},notes=c.venueNotes?`\n\n${c.venueNotes}`:"",coords=c.latitude&&c.longitude?`https://www.google.com/maps/search/?api=1&query=${c.latitude},${c.longitude}`:"";return`Ahoy, ${r.guestName}!\n\nWe look forward to welcoming you to Captain Husain’s first birthday celebration.\n\nYour RSVP is accepted for *${attendance(r)}*.\n\nSaturday, 5 September 2026\n12:00 PM\n${c.venueName||"Venue to be announced"}\n${c.venueAddress||""}\n\nDirections:\n${c.mapsUrl||coords}${notes}\n\nWe look forward to celebrating with you and your family!`}
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
function shortDateTime(v){const d=new Date(v);return isNaN(d)?String(v||"").slice(-16):`${d.toLocaleDateString([],{day:"2-digit",month:"short"})} · ${d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}`}
