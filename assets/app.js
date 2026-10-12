/* ============================================================
   CONFIG — replace with your deployed Google Apps Script Web App URL.
   One Apps Script project can handle all three endpoints below
   (see SETUP_GUIDE.md + google-apps-script/Code.gs).
   ============================================================ */
const CONFIG = {
  SHEETS_ENDPOINT: "https://script.google.com/macros/s/REPLACE_WITH_YOUR_DEPLOYMENT_ID/exec",
  DEMO_MODE: true, // set false once SHEETS_ENDPOINT is a real deployment
  MAX_FILE_MB: 25,
  ACCEPTED_EXT: ['.pdf', '.doc', '.docx', '.xls', '.xlsx']
};

document.getElementById('year').textContent = new Date().getFullYear();

/* ---------------- Cookie consent banner ---------------- */
(function(){
  const KEY = 'octaspan_cookie_consent';
  const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000;
  const banner = document.getElementById('cookieBanner');
  const overlay = document.getElementById('cookieModalOverlay');
  let saved = null;
  try{ saved = JSON.parse(localStorage.getItem(KEY)); }catch(e){}
  const isExpired = !saved || !saved.ts || (Date.now() - saved.ts) > THREE_MONTHS_MS;

  function showBanner(){ banner.classList.add('show'); }
  function hideBanner(){ banner.classList.remove('show'); }
  function openModal(){ overlay.classList.add('show'); }
  function closeModal(){ overlay.classList.remove('show'); }
  function persist(consent){
    try{ localStorage.setItem(KEY, JSON.stringify(consent)); }catch(e){}
  }

  if(isExpired){ showBanner(); }

  document.getElementById('cookieAccept').addEventListener('click', ()=>{
    persist({ essential:true, preference:true, analytics:true, social:true, ts:Date.now() });
    hideBanner();
  });
  document.getElementById('cookieDecline').addEventListener('click', ()=>{
    persist({ essential:true, preference:false, analytics:false, social:false, ts:Date.now() });
    hideBanner();
  });
  document.getElementById('cookieManage').addEventListener('click', openModal);
  document.getElementById('cookieManageLink').addEventListener('click', (e)=>{ e.preventDefault(); openModal(); });
  document.getElementById('cookieModalClose').addEventListener('click', closeModal);
  document.getElementById('cookieModalSave').addEventListener('click', ()=>{
    persist({
      essential:true,
      preference: document.getElementById('prefPreference').checked,
      analytics: document.getElementById('prefAnalytics').checked,
      social: document.getElementById('prefSocial').checked,
      ts:Date.now()
    });
    closeModal();
    hideBanner();
    toast('Cookie preferences saved.');
  });
})();

/* ---------------- Utility: toast ---------------- */
function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(()=>t.classList.remove('show'), 3200);
}

/* ---------------- Tab pre-selection from URL (?tab=xxx) ----------------
   Mega-menu links and CTA buttons that used to jump to a hash + pre-select
   a tab now link to "page.html?tab=key" instead. On load, if this page has
   a tabbar and the URL carries a tab param, activate it.
------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', function(){
  const params = new URLSearchParams(location.search);
  const tabKey = params.get('tab');
  if(tabKey){
    const tabbar = document.querySelector('.tabbar');
    if(tabbar) activateTab(tabbar, tabKey);
  }
});

/* ---------------- Mega menu (desktop) ---------------- */
const navItems = document.querySelectorAll('.nav-item');
function closeAllMega(){
  navItems.forEach(ni=>{ ni.classList.remove('open'); ni.querySelector('button')?.setAttribute('aria-expanded','false'); });
}
navItems.forEach(ni=>{
  const btn = ni.querySelector('button');
  if(!btn) return;
  btn.addEventListener('click', (e)=>{
    e.stopPropagation();
    const isOpen = ni.classList.contains('open');
    closeAllMega();
    if(!isOpen){ ni.classList.add('open'); btn.setAttribute('aria-expanded','true'); }
  });
});
document.addEventListener('click', closeAllMega);
document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') closeAllMega(); });

/* ---------------- Mobile drawer ---------------- */
const drawer = document.getElementById('mobileDrawer');
function closeDrawer(){ drawer.classList.remove('open'); }
document.getElementById('menuToggle').addEventListener('click', ()=>{
  buildMobileAccordions();
  drawer.classList.add('open');
});
document.getElementById('drawerClose').addEventListener('click', closeDrawer);

function buildMobileAccordions(){
  const holder = document.getElementById('mobileAccordions');
  if(holder.dataset.built) return;
  holder.dataset.built = '1';
  const sections = [
    {title:'Who Are We', href:'about.html', links:['Purpose & Values','Our Impact','Our People','Governance','Awards & Recognition','Press Room','Contact Us']},
    {title:'What We Do', href:'services.html', links:['Cyber Defense','Analytics & Automation','Cloud & Data Security','Identity Protection','Applications & DevSecOps Pipeline','Infrastructure & Zero Trust Architecture','Consulting & Strategy','Threat Intelligence']},
    {title:'Our Thinking', href:'insights.html', links:['Overview','Featured Research','Reports & Survey','Banking','Telecom']},
    {title:'Knowledge Hub', href:'knowledge.html', links:['Case Studies','Whitepapers & Research Reports','Infographics','Video Content','Podcasts','Free Tools','Downloadable Guides']},
    {title:'Courses', href:'courses.html', links:['Explore Certification Programs','Featured Courses','Corporate Training','Short Workshops','Free Webinars and Workshop','Learning Paths']},
  ];
  sections.forEach(sec=>{
    const div = document.createElement('div');
    div.className = 'mobile-acc';
    div.innerHTML = `<button type="button">${sec.title}<span class="caret"></span></button>
      <div class="mobile-acc-panel">${sec.links.map(l=>`<a href="${sec.href}">${l}</a>`).join('')}</div>`;
    div.querySelector('button').addEventListener('click', ()=> div.classList.toggle('open'));
    holder.appendChild(div);
  });
}

/* ---------------- Generic tab system (Courses / Insights / Contact&RFP) ---------------- */
function activateTab(tabbar, key){
  if(!tabbar) return;
  const panelHolder = tabbar.parentElement;
  tabbar.querySelectorAll('.tabbtn').forEach(b=>b.classList.toggle('active', b.dataset.tab === key));
  panelHolder.querySelectorAll('.tabpanel').forEach(p=>{
    const match = p.dataset.tabpanel === key;
    p.classList.toggle('active', match);
    p.classList.toggle('anim', match);
  });
}
document.querySelectorAll('.tabbar').forEach(tabbar=>{
  tabbar.querySelectorAll('.tabbtn').forEach(btn=>{
    btn.addEventListener('click', ()=> activateTab(tabbar, btn.dataset.tab));
  });
});

/* ---------------- Sub-section tile navigation ---------------- */
function tileGoTab(pageId, tabKey){
  const tabbar = document.querySelector('#page-' + pageId + ' .tabbar');
  activateTab(tabbar, tabKey);
  if(tabbar) tabbar.scrollIntoView({behavior:'smooth', block:'start'});
}
function tileScrollTo(elId){
  const el = document.getElementById(elId);
  if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
}

/* ---------------- Services matrix accordion ---------------- */
document.querySelectorAll('.matrix-row').forEach(row=>{
  row.querySelector('.matrix-head').addEventListener('click', ()=>{
    const wasOpen = row.classList.contains('open');
    document.querySelectorAll('.matrix-row').forEach(r=>r.classList.remove('open'));
    if(!wasOpen) row.classList.add('open');
  });
});

/* ---------------- Topic chip styling (contact form) ---------------- */
document.querySelectorAll('#topicGrid .topic-chip input').forEach(inp=>{
  inp.addEventListener('change', ()=>{
    document.querySelectorAll('#topicGrid .topic-chip').forEach(c=>c.classList.remove('checked'));
    inp.closest('.topic-chip').classList.add('checked');
  });
});
document.querySelector('#topicGrid .topic-chip')?.classList.add('checked');

/* ---------------- Newsletter forms (every page) ---------------- */
function refNumber(prefix){
  return prefix + '-' + Date.now().toString(36).toUpperCase().slice(-6);
}
document.querySelectorAll('[data-newsletter-form]').forEach(form=>{
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const email = form.querySelector('input[type=email]').value.trim();
    const msgEl = form.querySelector('.nl-msg');
    const btn = form.querySelector('button[type=submit]');
    if(!/^\S+@\S+\.\S+$/.test(email)){
      msgEl.textContent = 'Please enter a valid email address.';
      msgEl.className = 'nl-msg show err';
      return;
    }
    const interests = Array.from(form.querySelectorAll('input[type=checkbox]:checked')).map(c=>c.value);
    btn.disabled = true; btn.textContent = 'Subscribing...';
    const payload = { formType:'newsletter', email, interests, page: location.pathname.split('/').pop() || 'index.html', submittedAt: new Date().toISOString() };
    const result = await submitToSheets(payload);
    btn.disabled = false; btn.textContent = 'Subscribe';
    if(result.ok){
      msgEl.textContent = 'Subscribed — check your inbox to confirm.';
      msgEl.className = 'nl-msg show ok';
      form.reset();
      toast('You are subscribed to the Octaspan newsletter.');
    } else {
      msgEl.textContent = result.message || 'Something went wrong. Please try again.';
      msgEl.className = 'nl-msg show err';
    }
  });
});

/* ---------------- Shared Google Sheets submit helper ----------------
   Uses a Google Apps Script Web App as a lightweight serverless
   endpoint that appends rows to a Google Sheet (and, for RFP file
   payloads, saves files to Drive). See SETUP_GUIDE.md.
------------------------------------------------------------------- */
async function submitToSheets(payload){
  const isPlaceholder = CONFIG.DEMO_MODE || CONFIG.SHEETS_ENDPOINT.includes('REPLACE_WITH_YOUR_DEPLOYMENT_ID');
  if(isPlaceholder){
    // Demo mode: simulate latency + success so the prototype is fully clickable.
    await new Promise(r=>setTimeout(r, 650));
    console.info('[Demo mode] Would POST to Google Sheets endpoint:', payload);
    return { ok:true, demo:true };
  }
  try{
    await fetch(CONFIG.SHEETS_ENDPOINT, {
      method:'POST',
      mode:'no-cors', // Apps Script web apps typically require no-cors from the browser
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify(payload)
    });
    // no-cors means we cannot read the response body; treat dispatch as success.
    return { ok:true };
  }catch(err){
    console.error('Sheets submit failed', err);
    return { ok:false, message:'Could not reach the submission service. Please try again shortly.' };
  }
}

/* ---------------- Region → team routing (demo logic) ---------------- */
function regionFor(country){
  const map = {
    'United States':'North America', 'Canada':'North America',
    'United Kingdom':'Europe', 'Germany':'Europe', 'France':'Europe',
    'India':'Asia Pacific', 'Singapore':'Asia Pacific', 'Australia':'Asia Pacific',
    'UAE':'Middle East & Africa'
  };
  return map[country] || 'Global Response Team';
}

/* shared helpers */
function fileToBase64(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = ()=> resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* check-chip toggle (partner form) */
document.querySelectorAll('.check-chip input').forEach(i=>{i.addEventListener('change',()=>{ if(i.type==='radio'){document.querySelectorAll('.check-chip input[name="'+i.name+'"]').forEach(o=>o.parentElement.classList.toggle('checked',o.checked));} else {i.parentElement.classList.toggle('checked',i.checked);} });});

if(document.getElementById('contactForm')){
/* ---------------- CONTACT FORM ---------------- */
const contactForm = document.getElementById('contactForm');
contactForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const msgEl = document.getElementById('contactFormMsg');
  msgEl.textContent = ''; msgEl.className = 'nl-msg';

  const fd = new FormData(contactForm);
  if(fd.get('companyWebsite')){ return; } // honeypot triggered — silently drop
  const required = ['firstName','lastName','email','company','country','message'];
  for(const r of required){
    if(!fd.get(r) || !String(fd.get(r)).trim()){
      msgEl.textContent = 'Please complete all required fields before submitting.';
      msgEl.className = 'nl-msg show err';
      return;
    }
  }
  if(!document.getElementById('privacyConsent').checked){
    msgEl.textContent = 'Please accept the Privacy Policy to continue.';
    msgEl.className = 'nl-msg show err';
    return;
  }

  const btn = document.getElementById('contactSubmitBtn');
  btn.disabled = true; btn.textContent = 'Sending...';

  const payload = {
    formType:'contact',
    topic: fd.get('topic'),
    firstName: fd.get('firstName'), lastName: fd.get('lastName'),
    email: fd.get('email'), phone: fd.get('phone'),
    company: fd.get('company'), jobTitle: fd.get('jobTitle'),
    country: fd.get('country'), serviceInterest: fd.get('serviceInterest'),
    message: fd.get('message'), referralSource: fd.get('referralSource'),
    preferredContact: fd.get('preferredContact'),
    sourcePage: 'Contact Us & RFP',
    submittedAt: new Date().toISOString()
  };

  const result = await submitToSheets(payload);
  btn.disabled = false; btn.textContent = 'Send message';

  if(result.ok){
    const ref = refNumber('OCT');
    document.getElementById('confirmRefContact').textContent = ref;
    document.getElementById('confirmRegionContact').textContent = regionFor(payload.country);
    document.getElementById('confirmTeamContact').textContent = payload.topic;
    contactForm.style.display = 'none';
    document.getElementById('contactConfirm').style.display = 'block';
  } else {
    msgEl.textContent = result.message;
    msgEl.className = 'nl-msg show err';
  }
});
document.getElementById('contactResetBtn').addEventListener('click', ()=>{
  contactForm.reset();
  contactForm.style.display = 'block';
  document.getElementById('contactConfirm').style.display = 'none';
  document.querySelectorAll('#topicGrid .topic-chip').forEach(c=>c.classList.remove('checked'));
  document.querySelector('#topicGrid .topic-chip').classList.add('checked');
});

/* ---------------- RFP WIZARD ---------------- */
let rfpStep = 1;
const RFP_TOTAL_STEPS = 6;
const rfpForm = document.getElementById('rfpForm');
let rfpFiles = []; // {file, id, status}

function renderWizardNav(){
  document.getElementById('wizardBack').style.visibility = rfpStep === 1 ? 'hidden' : 'visible';
  const nextBtn = document.getElementById('wizardNext');
  const navEl = document.getElementById('wizardNav');
  if(rfpStep === RFP_TOTAL_STEPS){
    navEl.style.display = 'none';
  } else {
    navEl.style.display = 'flex';
    nextBtn.textContent = rfpStep === RFP_TOTAL_STEPS - 1 ? 'Review & Continue' : 'Continue';
  }
}
function goToStep(n){
  rfpStep = n;
  document.querySelectorAll('.wizard-panel').forEach(p=> p.classList.toggle('active', Number(p.dataset.panel) === n));
  document.querySelectorAll('.w-step').forEach(s=>{
    const sn = Number(s.dataset.step);
    s.classList.toggle('active', sn === n);
    s.classList.toggle('done', sn < n);
  });
  if(n === RFP_TOTAL_STEPS) buildReview();
  renderWizardNav();
  document.querySelector('.form-shell')?.scrollIntoView({behavior:'smooth', block:'start'});
}
function currentPanelValid(){
  const panel = document.querySelector(`.wizard-panel[data-panel="${rfpStep}"]`);
  const fields = panel.querySelectorAll('[required]');
  for(const f of fields){
    if(f.type === 'checkbox' && !f.checked) { f.reportValidity?.(); f.focus(); return false; }
    if(f.type !== 'checkbox' && !String(f.value||'').trim()){ f.reportValidity?.(); f.focus(); return false; }
  }
  if(rfpStep === 5 && rfpFiles.length === 0){
    document.getElementById('fileErrorMsg').textContent = 'Please attach at least one RFP document before continuing.';
    document.getElementById('fileErrorMsg').classList.add('show');
    return false;
  }
  return true;
}
document.getElementById('wizardNext').addEventListener('click', ()=>{
  if(!currentPanelValid()) return;
  if(rfpStep < RFP_TOTAL_STEPS) goToStep(rfpStep + 1);
});
document.getElementById('wizardBack').addEventListener('click', ()=>{
  if(rfpStep > 1) goToStep(rfpStep - 1);
});

function buildReview(){
  const fd = new FormData(rfpForm);
  const grid = document.getElementById('rfpReviewGrid');
  const rows = [
    ['Organization', fd.get('orgName') || '—'],
    ['Country / Region', fd.get('rfpCountry') || '—'],
    ['Contact', [fd.get('rfpFirstName'), fd.get('rfpLastName')].filter(Boolean).join(' ') || '—'],
    ['Email', fd.get('rfpEmail') || '—'],
    ['Services required', fd.get('servicesRequired') || '—'],
    ['Project title', fd.get('projectTitle') || '—'],
    ['Estimated budget', fd.get('estimatedBudget') || 'Not specified'],
    ['Files attached', String(rfpFiles.length)],
  ];
  grid.innerHTML = rows.map(r=>`<div class="confirm-item"><div class="k">${r[0]}</div><div class="v">${r[1]}</div></div>`).join('');
}

/* ---- File upload: dropzone, validation, list, remove ---- */
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const fileListEl = document.getElementById('fileList');

document.getElementById('chooseFilesBtn').addEventListener('click', ()=> fileInput.click());
fileInput.addEventListener('change', (e)=> handleFiles(e.target.files));

['dragenter','dragover'].forEach(evt=>{
  dropzone.addEventListener(evt, (e)=>{ e.preventDefault(); dropzone.classList.add('drag'); });
});
['dragleave','drop'].forEach(evt=>{
  dropzone.addEventListener(evt, (e)=>{ e.preventDefault(); dropzone.classList.remove('drag'); });
});
dropzone.addEventListener('drop', (e)=>{ handleFiles(e.dataTransfer.files); });

function extOf(name){
  const m = name.toLowerCase().match(/\.[a-z0-9]+$/);
  return m ? m[0] : '';
}
function fmtSize(bytes){
  if(bytes < 1024*1024) return (bytes/1024).toFixed(0) + ' KB';
  return (bytes/(1024*1024)).toFixed(1) + ' MB';
}
function handleFiles(fileListObj){
  const errEl = document.getElementById('fileErrorMsg');
  errEl.classList.remove('show'); errEl.textContent = '';
  Array.from(fileListObj).forEach(file=>{
    const ext = extOf(file.name);
    const id = 'f' + Math.random().toString(36).slice(2, 9);
    const tooBig = file.size > CONFIG.MAX_FILE_MB * 1024 * 1024;
    const badType = !CONFIG.ACCEPTED_EXT.includes(ext);
    const entry = { file, id, error: tooBig ? `Exceeds ${CONFIG.MAX_FILE_MB}MB limit` : (badType ? 'Unsupported file type' : null) };
    rfpFiles.push(entry);
  });
  fileInput.value = '';
  renderFileList();
}
function renderFileList(){
  fileListEl.innerHTML = '';
  rfpFiles.forEach(entry=>{
    const div = document.createElement('div');
    div.className = 'file-item' + (entry.error ? ' fi-error' : '');
    div.innerHTML = `
      <div>
        <div class="fi-name">${entry.file.name}</div>
        <div class="fi-meta">${entry.error ? entry.error : fmtSize(entry.file.size) + ' · ' + extOf(entry.file.name).replace('.','').toUpperCase()}</div>
      </div>
      <button type="button" class="fi-remove" data-remove="${entry.id}">Remove</button>`;
    fileListEl.appendChild(div);
  });
  fileListEl.querySelectorAll('[data-remove]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      rfpFiles = rfpFiles.filter(f=>f.id !== btn.dataset.remove);
      renderFileList();
    });
  });
}


/* ---- RFP submit ---- */
rfpForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const msgEl = document.getElementById('rfpFormMsg');
  msgEl.textContent = ''; msgEl.className = 'nl-msg';

  if(!document.getElementById('rfpPrivacy').checked){
    msgEl.textContent = 'Please accept the Privacy Policy and Terms of Use to continue.';
    msgEl.className = 'nl-msg show err';
    return;
  }
  const validFiles = rfpFiles.filter(f=>!f.error);
  if(validFiles.length === 0){
    msgEl.textContent = 'Please attach at least one valid RFP document.';
    msgEl.className = 'nl-msg show err';
    return;
  }

  const btn = document.getElementById('rfpSubmitBtn');
  btn.disabled = true; btn.textContent = 'Submitting...';

  const fd = new FormData(rfpForm);
  let filesPayload = [];
  try{
    if(!CONFIG.DEMO_MODE){
      filesPayload = await Promise.all(validFiles.map(async f=>({
        name: f.file.name, mimeType: f.file.type || 'application/octet-stream',
        size: f.file.size, base64: await fileToBase64(f.file)
      })));
    } else {
      filesPayload = validFiles.map(f=>({ name:f.file.name, size:f.file.size }));
    }
  }catch(err){
    console.error(err);
    msgEl.textContent = 'Could not read one of the attached files. Please try again.';
    msgEl.className = 'nl-msg show err';
    btn.disabled = false; btn.textContent = 'Submit RFP';
    return;
  }

  const payload = {
    formType:'rfp',
    country: fd.get('rfpCountry'),
    orgName: fd.get('orgName'), industry: fd.get('industry'), companyLocation: fd.get('companyLocation'),
    revenueRange: fd.get('revenueRange'), employeeCount: fd.get('employeeCount'), website: fd.get('companyWebsiteField'),
    title: fd.get('rfpTitle'), firstName: fd.get('rfpFirstName'), lastName: fd.get('rfpLastName'),
    jobTitle: fd.get('rfpJobTitle'), email: fd.get('rfpEmail'), phone: fd.get('rfpPhone'),
    servicesRequired: fd.get('servicesRequired'), projectTitle: fd.get('projectTitle'),
    businessChallenge: fd.get('businessChallenge'), startDate: fd.get('startDate'), completionDate: fd.get('completionDate'),
    estimatedBudget: fd.get('estimatedBudget'), proposalDeadline: fd.get('proposalDeadline'),
    otherFirmsInvited: !!fd.get('otherFirmsInvited'),
    files: filesPayload,
    submittedAt: new Date().toISOString()
  };

  const result = await submitToSheets(payload);
  btn.disabled = false; btn.textContent = 'Submit RFP';

  if(result.ok){
    const ref = refNumber('RFP');
    document.getElementById('confirmRefRfp').textContent = ref;
    document.getElementById('confirmFilesRfp').textContent = validFiles.length + ' file' + (validFiles.length>1?'s':'');
    document.getElementById('confirmRegionRfp').textContent = regionFor(payload.country);
    document.getElementById('wizardSteps').style.display = 'none';
    rfpForm.style.display = 'none';
    document.getElementById('wizardNav').style.display = 'none';
    document.getElementById('rfpConfirm').style.display = 'block';
  } else {
    msgEl.textContent = result.message;
    msgEl.className = 'nl-msg show err';
  }
});
document.getElementById('rfpResetBtn').addEventListener('click', ()=>{
  rfpForm.reset();
  rfpFiles = [];
  renderFileList();
  rfpForm.style.display = 'block';
  document.getElementById('wizardSteps').style.display = 'flex';
  document.getElementById('rfpConfirm').style.display = 'none';
  goToStep(1);
});
renderWizardNav();
}

/* ---------------- Practice areas slider ---------------- */
(function(){
  const slider = document.getElementById('practiceSlider');
  const prev = document.getElementById('practicesPrev');
  const next = document.getElementById('practicesNext');
  if(!slider) return;
  const scrollAmount = () => Math.min(slider.clientWidth * 0.8, 600);
  prev.addEventListener('click', ()=> slider.scrollBy({left: -scrollAmount(), behavior:'smooth'}));
  next.addEventListener('click', ()=> slider.scrollBy({left: scrollAmount(), behavior:'smooth'}));
})();


/* ---------------- PARTNER FORM ---------------- */
if(document.getElementById('partnerForm')){
(function(){
  const form = document.getElementById('partnerForm');
  const TOTAL = 4; let step = 1;
  const files = {profile:null, brochure:null};
  const $ = id => document.getElementById(id);
  const ext = n => { const m=n.toLowerCase().match(/\.[a-z0-9]+$/); return m?m[0]:''; };
  const size = b => b<1048576 ? (b/1024).toFixed(0)+' KB' : (b/1048576).toFixed(1)+' MB';

  function render(){
    document.querySelectorAll('#partnerForm .wizard-panel').forEach(p=>p.classList.toggle('active', Number(p.dataset.panel)===step));
    document.querySelectorAll('#pfWizardSteps .w-step').forEach(s=>{const n=Number(s.dataset.step); s.classList.toggle('active',n===step); s.classList.toggle('done',n<step);});
    $('pfWizardBack').style.visibility = step===1?'hidden':'visible';
    $('pfWizardNext').style.display = step===TOTAL?'none':'inline-flex';
    $('pfWizardNav').style.display = 'flex';
    document.querySelector('.form-shell').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function valid(){
    const panel = document.querySelector('#partnerForm .wizard-panel[data-panel="'+step+'"]');
    const seen = {};
    for(const f of panel.querySelectorAll('[required]')){
      if(f.type==='radio'){
        if(seen[f.name]) continue; seen[f.name]=1;
        if(!panel.querySelector('input[name="'+f.name+'"]:checked')){
          const m=$('pfMsg'); m.textContent='Please choose an option for: '+(f.dataset.label||f.name); m.className='nl-msg show err';
          f.closest('.field').scrollIntoView({block:'center'}); return false;
        }
      } else if(f.type==='checkbox'){ if(!f.checked){f.reportValidity&&f.reportValidity(); f.focus(); return false;} }
      else if(!String(f.value||'').trim()){ f.reportValidity&&f.reportValidity(); f.focus(); return false; }
      else if(f.type==='email' && f.checkValidity && !f.checkValidity()){ f.reportValidity(); return false; }
    }
    $('pfMsg').className='nl-msg'; return true;
  }
  $('pfWizardNext').addEventListener('click',()=>{ if(valid() && step<TOTAL){step++;render();} });
  $('pfWizardBack').addEventListener('click',()=>{ if(step>1){step--;render();} });

  function setupUpload(key, accept){
    const dz=$('dz-'+key), inp=$('in-'+key), list=$('list-'+key);
    function paint(){
      list.innerHTML='';
      const f=files[key]; if(!f) return;
      const div=document.createElement('div'); div.className='file-item'+(f.error?' fi-error':'');
      div.innerHTML='<div><div class="fi-name"></div><div class="fi-meta"></div></div><button type="button" class="fi-remove">Remove</button>';
      div.querySelector('.fi-name').textContent=f.file.name;
      div.querySelector('.fi-meta').textContent=f.error||(size(f.file.size)+' · '+ext(f.file.name).slice(1).toUpperCase());
      div.querySelector('button').addEventListener('click',()=>{files[key]=null;paint();});
      list.appendChild(div);
    }
    function take(fl){
      if(!fl||!fl.length) return; const file=fl[0]; let error=null;
      if(file.size>CONFIG.MAX_FILE_MB*1048576) error='Exceeds '+CONFIG.MAX_FILE_MB+'MB limit';
      else if(!accept.includes(ext(file.name))) error='Unsupported file type';
      files[key]={file,error}; inp.value=''; paint();
    }
    $('choose-'+key).addEventListener('click',()=>inp.click());
    inp.addEventListener('change',e=>take(e.target.files));
    ['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('drag');}));
    ['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('drag');}));
    dz.addEventListener('drop',e=>take(e.dataTransfer.files));
  }
  setupUpload('profile',['.pdf','.ppt','.pptx','.doc','.docx']);
  setupUpload('brochure',['.pdf']);

  form.addEventListener('submit', async e=>{
    e.preventDefault();
    const msg=$('pfMsg'); msg.className='nl-msg';
    if(!valid()) return;
    for(const k of ['profile','brochure']) if(files[k]&&files[k].error){ msg.textContent='Please fix or remove the invalid '+k+' file.'; msg.className='nl-msg show err'; return; }
    const btn=$('partnerSubmitBtn'); btn.disabled=true; btn.textContent='Submitting...';
    const fd=new FormData(form);
    const multi=n=>fd.getAll(n+'[]');
    const list=[];
    try{
      for(const k of ['profile','brochure']){
        const f=files[k]; if(!f) continue;
        if(!CONFIG.DEMO_MODE) list.push({kind:k,name:f.file.name,mimeType:f.file.type||'application/octet-stream',size:f.file.size,base64:await fileToBase64(f.file)});
        else list.push({kind:k,name:f.file.name,size:f.file.size});
      }
    }catch(err){ msg.textContent='Could not read an attached file. Please try again.'; msg.className='nl-msg show err'; btn.disabled=false; btn.textContent='Submit Partnership Application'; return; }
    const payload={
      formType:'partner', partnerType:fd.get('partnerType'),
      companyName:fd.get('companyName'), website:fd.get('website'), companyLinkedIn:fd.get('companyLinkedIn'),
      country:fd.get('country'), city:fd.get('city'), companyType:fd.get('companyType'), companySize:fd.get('companySize'), yearEstablished:fd.get('yearEstablished'),
      contactPerson:fd.get('contactPerson'), designation:fd.get('designation'), email:fd.get('email'), phone:fd.get('phone'), linkedIn:fd.get('linkedIn'),
      partnershipAreas:multi('partnershipAreas'), productName:fd.get('productName'), productDescription:fd.get('productDescription'),
      customerSegment:multi('customerSegment'), deploymentModel:multi('deploymentModel'), techSupport:multi('techSupport'), certifications:fd.get('certifications'),
      teamSize:fd.get('teamSize'), deliveryCapability:multi('deliveryCapability'),
      partnershipModel:multi('partnershipModel'), lookingFor:multi('lookingFor'), currentMarkets:multi('currentMarkets'),
      customerCount:fd.get('customerCount'), enterpriseCustomerCount:fd.get('enterpriseCustomerCount'),
      existingPartnerships:fd.get('existingPartnerships'), existingPartnershipsDetail:fd.get('existingPartnershipsDetail'),
      partnershipProposal:fd.get('partnershipProposal'), authorized:fd.get('authorized'),
      preferredEngagement:multi('preferredEngagement'), timeframe:fd.get('timeframe'), heardFrom:fd.get('heardFrom'),
      files:list, sourcePage:'partner-form.html', submittedAt:new Date().toISOString()
    };
    const result=await submitToSheets(payload);
    btn.disabled=false; btn.textContent='Submit Partnership Application';
    if(result.ok){
      $('pfRef').textContent=refNumber('PTR');
      $('pfWizardSteps').style.display='none'; form.style.display='none'; $('pfWizardNav').style.display='none';
      $('partnerConfirm').style.display='block';
      document.querySelector('.form-shell').scrollIntoView({behavior:'smooth',block:'start'});
    } else { msg.textContent=result.message; msg.className='nl-msg show err'; }
  });
  render();
})();
}

/* ---------- Live threat feed (refreshes every 3 hours) ---------- */
(function(){
  const panel=document.getElementById('threatFeed'); if(!panel) return;
  const REFRESH_MS=3*60*60*1000, ENDPOINT='/api/threat-feed';
  const rows=document.getElementById('tfRows'), status=document.getElementById('tfStatus'),
        updated=document.getElementById('tfUpdated'), sources=document.getElementById('tfSources'),
        dot=panel.querySelector('.pulse-dot');
  let lastOk=null;
  const esc=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ago=ts=>{const m=Math.max(0,Math.round((Date.now()-ts)/60000));
    if(m<2) return 'just now'; if(m<60) return m+'m ago'; const h=Math.round(m/60); return h<24?h+'h ago':Math.round(h/24)+'d ago';};
  const level=n=>n>=6?'tag-crit':n>=3?'tag-warn':'tag-ok';
  function draw(d){
    rows.innerHTML=d.sectors.map(s=>{
      const link=s.latest
        ? '<a href="'+esc(s.latest.url)+'" target="_blank" rel="noopener noreferrer" title="'+esc(s.latest.source)+'">'+esc(s.latest.title)+'</a>'
        : '<span class="tf-none">No new reports in the last '+d.windowHours+'h</span>';
      return '<div class="tf-row"><div class="scan-line"><span>'+esc(s.label)+'</span><span class="tag '+level(s.count)+'">'+s.count+' in '+d.windowHours+'h</span></div>'+link+'</div>';
    }).join('');
    lastOk=new Date(d.generatedAt).getTime();
    sources.textContent=d.sources.length+' sources · '+d.totalStories+' stories scanned';
    status.textContent='live'; dot.classList.remove('stale'); tick();
  }
  function tick(){ if(lastOk) updated.textContent='updated '+ago(lastOk); }
  async function load(){
    try{
      const r=await fetch(ENDPOINT,{cache:'no-cache'}); if(!r.ok) throw new Error(r.status);
      draw(await r.json());
    }catch(e){
      status.textContent=lastOk?'stale':'offline'; dot.classList.add('stale');
      if(!lastOk){ rows.innerHTML='<div class="scan-line"><span>Live feed temporarily unavailable. Retrying automatically.</span></div>'; }
    }
  }
  load(); setInterval(load,REFRESH_MS); setInterval(tick,60000);
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden && lastOk && Date.now()-lastOk>REFRESH_MS) load(); });
})();
