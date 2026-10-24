/* Octaspan feedback widget: a tab fixed to the right edge that slides a feedback form in from the right.
   Submits to the same Google Apps Script endpoint as the other forms (formType "feedback" -> "Website Feedback" sheet). */
(function () {
  'use strict';
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbxwdbxvkAYqGoATIslrKesBJUMF-HVijXMhXWydKbzX4V-kgC2SPzawnJYhb-APr0WXUA/exec';
  var COOLDOWN_MS = 30000, KEY = 'octaspan_feedback_last';

  var css = '' +
  '.fb-tab{position:fixed;right:0;top:62%;transform:translateY(-50%);z-index:9990;writing-mode:vertical-rl;transform-origin:center;background:#29d3f0;color:#04122a;border:0;border-radius:10px 0 0 10px;padding:16px 9px;font:600 13px/1 "IBM Plex Sans",system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;box-shadow:-4px 4px 18px rgba(0,0,0,.35);transition:padding .15s,background .15s}' +
  '.fb-tab:hover,.fb-tab:focus-visible{background:#6fe3f6;padding-right:13px}' +
  '.fb-tab svg{width:14px;height:14px;margin-bottom:8px;transform:rotate(90deg)}' +
  'body.fb-open .fb-tab{display:none}' +
  '.fb-scrim{position:fixed;inset:0;z-index:10000;background:rgba(2,8,20,.55);opacity:0;pointer-events:none;transition:opacity .25s}' +
  '.fb-scrim.open{opacity:1;pointer-events:auto}' +
  '.fb-panel{position:fixed;top:0;right:0;bottom:0;z-index:10001;width:min(440px,100%);background:#0a1a38;color:#e8f0fd;border-left:1px solid #29d3f0;box-shadow:-20px 0 60px rgba(0,0,0,.55);transform:translateX(105%);transition:transform .3s cubic-bezier(.2,.8,.2,1);display:flex;flex-direction:column;font:14px/1.5 "IBM Plex Sans",system-ui,sans-serif}' +
  '.fb-panel.open{transform:none}' +
  '.fb-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:20px 22px 14px;border-bottom:1px solid #1c3961}' +
  '.fb-head h2{margin:0;font-size:20px;font-weight:600}.fb-head p{margin:4px 0 0;color:#9bb0cf;font-size:13px}' +
  '.fb-x{background:none;border:1px solid #1c3961;color:#e8f0fd;width:34px;height:34px;border-radius:8px;font-size:22px;line-height:1;cursor:pointer;flex:none}.fb-x:hover{border-color:#29d3f0}' +
  '.fb-form{flex:1;overflow:auto;padding:16px 22px 22px;display:grid;grid-template-columns:1fr 1fr;gap:12px}' +
  '.fb-form label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:#9bb0cf;letter-spacing:.02em}' +
  '.fb-form .full{grid-column:1/-1}' +
  '.fb-form .req::after{content:" *";color:#f0524f}' +
  '.fb-form input,.fb-form select,.fb-form textarea{font:inherit;font-size:14px;color:#e8f0fd;background:#06122a;border:1px solid #1c3961;border-radius:8px;padding:9px 10px;width:100%}' +
  '.fb-form textarea{min-height:120px;resize:vertical}' +
  '.fb-form input:focus,.fb-form select:focus,.fb-form textarea:focus{outline:2px solid #29d3f0;outline-offset:1px;border-color:#29d3f0}' +
  '.fb-form [aria-invalid=true]{border-color:#f0524f}' +
  '.fb-err{font-size:12px;color:#ff9b99;min-height:0}' +
  '.fb-check{flex-direction:row!important;gap:10px!important;align-items:flex-start;font-size:13px!important;color:#cfdcf0!important}.fb-check input{width:auto;margin-top:3px;flex:none}' +
  '.fb-check a{color:#29d3f0}' +
  '.fb-hp{position:absolute!important;left:-9999px!important;width:1px;height:1px;overflow:hidden}' +
  '.fb-submit{grid-column:1/-1;font:inherit;font-weight:600;font-size:14px;color:#04122a;background:#29d3f0;border:0;border-radius:8px;padding:11px 16px;cursor:pointer}.fb-submit:hover{background:#6fe3f6}.fb-submit[disabled]{opacity:.6;cursor:not-allowed}' +
  '.fb-msg{grid-column:1/-1;font-size:13px;padding:10px 12px;border-radius:8px;display:none}.fb-msg.err{display:block;background:rgba(240,82,79,.12);border:1px solid #f0524f;color:#ffb3b1}' +
  '.fb-note{grid-column:1/-1;margin:0;font-size:11.5px;color:#6f86a8}' +
  '.fb-done{padding:34px 24px;text-align:center}.fb-done h3{margin:10px 0 6px;font-size:20px}.fb-done p{color:#9bb0cf;margin:0 0 16px}.fb-done .ok{width:54px;height:54px;border-radius:50%;background:rgba(47,194,122,.15);border:1px solid #2fc27a;color:#2fc27a;display:inline-flex;align-items:center;justify-content:center;font-size:28px}' +
  '@media(max-width:520px){.fb-form{grid-template-columns:1fr}}' +
  '@media(prefers-reduced-motion:reduce){.fb-panel,.fb-scrim,.fb-tab{transition:none}}';

  var tab, scrim, panel, form, opener;
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };

  function build() {
    if (!document.getElementById('fbStyle')) { var st = document.createElement('style'); st.id = 'fbStyle'; st.textContent = css; document.head.appendChild(st); }
    tab = document.createElement('button'); tab.type = 'button'; tab.className = 'fb-tab'; tab.id = 'fbTab';
    tab.setAttribute('aria-haspopup', 'dialog'); tab.setAttribute('aria-expanded', 'false');
    tab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>Feedback';
    scrim = document.createElement('div'); scrim.className = 'fb-scrim';
    panel = document.createElement('aside'); panel.className = 'fb-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'fbTitle'); panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = '<div class="fb-head"><div><h2 id="fbTitle">Help us improve</h2><p>Tell us what works, what does not, and what you would like to see.</p></div><button type="button" class="fb-x" aria-label="Close feedback form">&times;</button></div>' +
      '<form class="fb-form" id="fbForm" novalidate>' +
      '<label>First name<span class="req" hidden></span><input name="firstName" autocomplete="given-name" maxlength="80" required><span class="fb-err" data-for="firstName"></span></label>' +
      '<label>Last name<input name="lastName" autocomplete="family-name" maxlength="80" required><span class="fb-err" data-for="lastName"></span></label>' +
      '<label class="full">Company name<input name="company" autocomplete="organization" maxlength="160" required><span class="fb-err" data-for="company"></span></label>' +
      '<label class="full">Role<input name="role" autocomplete="organization-title" maxlength="120" placeholder="e.g. CISO, Security Analyst" required><span class="fb-err" data-for="role"></span></label>' +
      '<label class="full">Email address<input name="email" type="email" autocomplete="email" maxlength="160" required><span class="fb-err" data-for="email"></span></label>' +
      '<label class="full">Phone number (optional)<input name="phone" type="tel" autocomplete="tel" maxlength="40" placeholder="+91 …"><span class="fb-err" data-for="phone"></span></label>' +
      '<label class="full">What is your feedback about? (optional)<select name="topic"><option value="">Choose one</option><option>Data accuracy</option><option>Design and usability</option><option>New feature or data source</option><option>Performance</option><option>Something else</option></select></label>' +
      '<label class="full">Feedback<textarea name="feedback" maxlength="3000" required placeholder="What should we improve?"></textarea><span class="fb-err" data-for="feedback"></span></label>' +
      '<label class="fb-hp" aria-hidden="true">Leave this empty<input name="website" tabindex="-1" autocomplete="off"></label>' +
      '<label class="fb-check full"><input type="checkbox" name="consent" required><span>I agree to the <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a> and <a href="terms.html" target="_blank" rel="noopener">Terms of Use</a>, and consent to Octaspan using these details to review my feedback and contact me about it.</span></label><span class="fb-err full" data-for="consent"></span>' +
      '<div class="fb-msg" id="fbMsg" role="alert"></div>' +
      '<button type="submit" class="fb-submit" id="fbSubmit">Send feedback</button>' +
      '<p class="fb-note">Fields marked * are required. Please do not include passwords or confidential client data.</p></form>';
    document.body.appendChild(tab); document.body.appendChild(scrim); document.body.appendChild(panel);
    // mark required labels visually (the label text node is the first child)
    panel.querySelectorAll('input[required],textarea[required]').forEach(function (el) { if (el.type === 'checkbox') return; var l = el.closest('label'); var t = l.firstChild; if (t && t.nodeType === 3) { var sp = document.createElement('span'); sp.className = 'req'; sp.textContent = t.nodeValue; l.replaceChild(sp, t); } });
    panel.querySelectorAll('.fb-form > label > span[hidden]').forEach(function (x) { x.remove(); });
    form = panel.querySelector('#fbForm');
    tab.addEventListener('click', function () { open(tab); });
    scrim.addEventListener('click', close);
    panel.querySelector('.fb-x').addEventListener('click', close);
    form.addEventListener('submit', submit);
    form.addEventListener('input', function (e) { var el = e.target; if (el.getAttribute && el.getAttribute('aria-invalid')) { el.removeAttribute('aria-invalid'); var m = panel.querySelector('.fb-err[data-for="' + el.name + '"]'); if (m) m.textContent = ''; } });
    document.addEventListener('keydown', function (e) {
      if (!panel.classList.contains('open')) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'Tab') {
        var f = Array.prototype.filter.call(panel.querySelectorAll('button,input,select,textarea,a[href]'), function (x) { return !x.disabled && x.offsetParent !== null && x.tabIndex !== -1; });
        if (!f.length) return; var a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    });
  }

  function open(from) {
    opener = from || document.activeElement;
    document.body.classList.add('fb-open'); panel.classList.add('open'); scrim.classList.add('open'); panel.setAttribute('aria-hidden', 'false'); tab.setAttribute('aria-expanded', 'true');
    setTimeout(function () { var f = panel.querySelector('input[name=firstName]') || panel.querySelector('.fb-x'); if (f) f.focus(); }, 80);
  }
  function close() {
    document.body.classList.remove('fb-open'); panel.classList.remove('open'); scrim.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); tab.setAttribute('aria-expanded', 'false');
    if (opener && opener.focus) opener.focus();
  }

  function setErr(name, msg) { var el = form.elements[name], m = panel.querySelector('.fb-err[data-for="' + name + '"]'); if (m) m.textContent = msg || ''; if (el) { if (msg) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid'); } }

  function validate() {
    var f = form.elements, ok = true, first = null;
    var need = { firstName: 'Please enter your first name.', lastName: 'Please enter your last name.', company: 'Please enter your company name.', role: 'Please enter your role.', feedback: 'Please tell us your feedback.' };
    Object.keys(need).forEach(function (k) { var bad = !f[k].value.trim(); setErr(k, bad ? need[k] : ''); if (bad && ok) first = f[k]; if (bad) ok = false; });
    var em = f.email.value.trim(), emBad = !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em);
    setErr('email', emBad ? 'Please enter a valid email address.' : ''); if (emBad) { if (ok) first = f.email; ok = false; }
    var ph = f.phone.value.trim(), phBad = ph && !/^[+()\d][\d\s().\-]{5,}$/.test(ph);
    setErr('phone', phBad ? 'Please enter a valid phone number, or leave it blank.' : ''); if (phBad) { if (ok) first = f.phone; ok = false; }
    setErr('consent', f.consent.checked ? '' : 'Please accept the Privacy Policy and Terms of Use to continue.'); if (!f.consent.checked) { if (ok) first = f.consent; ok = false; }
    if (first) first.focus();
    return ok;
  }

  async function submit(e) {
    e.preventDefault();
    var msg = panel.querySelector('#fbMsg'); msg.className = 'fb-msg'; msg.textContent = '';
    if (!validate()) return;
    var f = form.elements;
    if (f.website.value) { done(); return; } // honeypot tripped: pretend success, send nothing
    try { var last = +sessionStorage.getItem(KEY) || 0; if (Date.now() - last < COOLDOWN_MS) { msg.className = 'fb-msg err'; msg.textContent = 'Thanks, we have just received your feedback. Please wait a moment before sending another.'; return; } } catch (x) {}
    var btn = panel.querySelector('#fbSubmit'); btn.disabled = true; btn.textContent = 'Sending…';
    var payload = { formType: 'feedback', firstName: f.firstName.value.trim(), lastName: f.lastName.value.trim(), company: f.company.value.trim(), role: f.role.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim(), topic: f.topic.value, feedback: f.feedback.value.trim(), consent: true, page: location.pathname + location.search, website: '' };
    try {
      await fetch(ENDPOINT, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
      try { sessionStorage.setItem(KEY, String(Date.now())); } catch (x) {}
      done(payload.firstName);
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Send feedback';
      msg.className = 'fb-msg err'; msg.textContent = 'We could not send your feedback just now. Please check your connection and try again.';
    }
  }

  function done(name) {
    form.outerHTML = '<div class="fb-done" role="status"><div class="ok" aria-hidden="true">&#10003;</div><h3>Thank you' + (name ? ', ' + esc(name) : '') + '!</h3><p>Your feedback has been sent to the Octaspan team. We read every note and may follow up by email.</p><button type="button" class="fb-submit" id="fbClose" style="width:100%">Close</button></div>';
    panel.querySelector('#fbClose').addEventListener('click', function () { close(); setTimeout(reset, 400); });
  }
  function reset() { var d = panel.querySelector('.fb-done'); if (d) { var parent = d.parentNode; parent.removeChild(d); panel.remove(); scrim.remove(); tab.remove(); build(); } }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
