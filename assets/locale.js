/* Location + language selector and localized cookie-consent prompt.
   Needs assets/locale-data.js and the cookie banner markup (ids: cookieBanner, cookieText, ...). */
(function () {
  'use strict';
  const D = window.OCTASPAN_LOCALE_DATA;
  if (!D) return;
  const KEY = 'octaspan_locale', CONSENT_KEY = 'octaspan_cookie_consent';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const baseLang = (l) => l.split('-')[0];

  const items = D.LOCATIONS.map((l, id) => ({ ...l, id, hay: norm([l.name, l.alias, l.langLabel, l.lang, l.iso].join(' ')), nName: norm(l.name), nAlias: norm(l.alias) }));
  const nLocations = new Set(items.map((i) => i.name)).size, nLanguages = new Set(items.map((i) => i.lang)).size;

  /** Search by country (native or English name), language, ISO code or language code. All words must match. */
  function search(q) {
    const toks = norm(q).split(/\s+/).filter(Boolean);
    if (!toks.length) return items;
    const rank = (i) => (i.nName.startsWith(toks[0]) ? 0 : i.nAlias.split(' ').some((w) => w.startsWith(toks[0])) ? 1 : 2);
    return items.filter((i) => toks.every((t) => i.hay.includes(t))).sort((a, b) => rank(a) - rank(b) || a.id - b.id);
  }

  let current = null;
  const t = (k, it) => { const lang = (it || current || {}).lang; return ((D.T[lang] || {})[k]) ?? D.T.en[k]; };
  const find = (s) => s && items.find((i) => i.iso === s.iso && i.lang === s.lang && i.name === s.name);

  function detect() {
    for (const tag of navigator.languages || [navigator.language || 'en']) {
      const [lang, region] = String(tag).split('-');
      const hit = items.find((i) => i.iso === (region || '').toUpperCase() && baseLang(i.lang) === lang.toLowerCase());
      if (hit) return hit;
    }
    return items[0]; // Global - English
  }
  function load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || sessionStorage.getItem(KEY)); } catch (e) {}
    return find(s) || detect();
  }
  // The saved location is a "Preference" cookie: only written to persistent storage if that category is allowed.
  function save(it) {
    const rec = JSON.stringify({ iso: it.iso, lang: it.lang, name: it.name });
    let allowed = true;
    try { const c = JSON.parse(localStorage.getItem(CONSENT_KEY)); if (c && c.preference === false) allowed = false; } catch (e) {}
    try { (allowed ? localStorage : sessionStorage).setItem(KEY, rec); if (allowed) sessionStorage.removeItem(KEY); else localStorage.removeItem(KEY); } catch (e) {}
  }

  /* ---------- trigger button ---------- */
  const slot = document.querySelector('.selectors');
  let btn = null;
  function buildButton() {
    if (!slot) return;
    slot.innerHTML = '<button type="button" class="loc-btn" id="locBtn" aria-haspopup="dialog" aria-expanded="false">' +
      '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 4 5.7 4 9s-1.4 6.4-4 9c-2.6-2.6-4-5.7-4-9s1.4-6.4 4-9z"/></svg>' +
      '<span class="loc-seg loc-loc"></span><span class="loc-seg loc-lang"></span><span class="loc-code"></span>' +
      '<svg class="loc-chev" viewBox="0 0 12 8" width="10" height="7" aria-hidden="true"><path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button>';
    btn = $('locBtn');
    btn.addEventListener('click', openPanel);
  }
  function paintButton() {
    if (!btn) return;
    btn.querySelector('.loc-loc').textContent = current.name;
    btn.querySelector('.loc-lang').textContent = current.langLabel;
    btn.querySelector('.loc-code').textContent = current.iso + ' - ' + baseLang(current.lang).toUpperCase();
    btn.setAttribute('aria-label', t('change') + ': ' + current.name + ', ' + current.langLabel);
  }

  /* ---------- drawer ---------- */
  let overlay = null, lastFocus = null, shown = [];
  function buildPanel() {
    overlay = document.createElement('div');
    overlay.className = 'loc-overlay'; overlay.hidden = true;
    overlay.innerHTML = '<div class="loc-panel" role="dialog" aria-modal="true" aria-labelledby="locTitle">' +
      '<button type="button" class="loc-close" id="locClose"><svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="1.6" fill="none"/></svg></button>' +
      '<h2 id="locTitle"></h2><p class="loc-sub" id="locSub"></p>' +
      '<label class="loc-search"><svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8.5" cy="8.5" r="6"/><path d="M13 13l5 5"/></svg><input type="search" id="locSearch" autocomplete="off" spellcheck="false" aria-controls="locList"></label>' +
      '<div class="loc-current" id="locCurrent" aria-live="polite"></div>' +
      '<ul class="loc-list" id="locList" role="listbox"></ul><p class="loc-empty" id="locEmpty" hidden></p></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closePanel(); });
    $('locClose').addEventListener('click', closePanel);
    $('locSearch').addEventListener('input', (e) => renderList(e.target.value));
    overlay.addEventListener('keydown', onKey);
    $('locList').addEventListener('click', (e) => { const b = e.target.closest('button[data-id]'); if (b) choose(items[+b.dataset.id]); });
  }
  function paintPanel() {
    $('locTitle').textContent = t('selTitle');
    $('locSub').textContent = t('avail').replace('{n}', nLocations).replace('{m}', nLanguages);
    $('locSearch').placeholder = t('search'); $('locSearch').setAttribute('aria-label', t('search'));
    $('locClose').setAttribute('aria-label', t('close'));
    $('locCurrent').innerHTML = '<span><b>' + esc(current.name) + '</b> - ' + esc(current.langLabel) + '</span><svg viewBox="0 0 20 20" width="22" height="22" aria-hidden="true"><path d="M3 10.5l4.5 4.5L17 5" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
    overlay.querySelector('.loc-panel').dir = D.RTL.includes(current.lang) ? 'rtl' : 'ltr';
  }
  function renderList(q) {
    shown = search(q || '');
    $('locList').innerHTML = shown.map((i) => '<li role="presentation"><button type="button" role="option" data-id="' + i.id + '" lang="' + esc(i.lang) + '" aria-selected="' + (i === current) + '"><b>' + esc(i.name) + '</b><span> - ' + esc(i.langLabel) + '</span></button></li>').join('');
    $('locEmpty').hidden = shown.length > 0; $('locEmpty').textContent = t('none');
    $('locList').scrollTop = 0;
  }
  function openPanel() {
    if (!overlay) buildPanel();
    lastFocus = document.activeElement; paintPanel(); $('locSearch').value = ''; renderList('');
    overlay.hidden = false; document.body.classList.add('loc-lock'); if (btn) btn.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => { overlay.classList.add('open'); $('locSearch').focus(); });
  }
  function closePanel() {
    if (!overlay || overlay.hidden) return;
    overlay.classList.remove('open'); overlay.hidden = true; document.body.classList.remove('loc-lock');
    if (btn) { btn.setAttribute('aria-expanded', 'false'); btn.focus(); } else if (lastFocus) lastFocus.focus();
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); closePanel(); return; }
    const opts = [...overlay.querySelectorAll('#locList button')], i = opts.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); (opts[i + 1] || opts[0] || document.activeElement).focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (i > 0) opts[i - 1].focus(); else $('locSearch').focus(); }
    else if (e.key === 'Enter' && document.activeElement === $('locSearch') && shown.length) { e.preventDefault(); choose(shown[0]); }
    else if (e.key === 'Tab') { // keep focus inside the dialog
      const f = [$('locClose'), $('locSearch'), opts[0]].filter(Boolean); const idx = f.indexOf(document.activeElement);
      if (idx === -1 && opts.includes(document.activeElement)) { e.preventDefault(); (e.shiftKey ? $('locSearch') : $('locClose')).focus(); }
      else if (e.shiftKey && idx === 0) { e.preventDefault(); (opts[0] || $('locSearch')).focus(); }
      else if (!e.shiftKey && idx === f.length - 1 && !opts.length) { e.preventDefault(); $('locClose').focus(); }
    }
  }

  /* ---------- cookie consent: localisation + regional behaviour ---------- */
  function applyConsent(it) {
    const banner = $('cookieBanner'); if (!banner) return;
    const reg = D.REGIMES[D.regimeOf(it.iso)];
    const law = reg.law || t('localLaws', it);
    const rtl = D.RTL.includes(it.lang), lang = baseLang(it.lang) === 'zh' ? it.lang : baseLang(it.lang);
    [banner, document.querySelector('.cookie-modal')].forEach((el) => { if (!el) return; el.lang = lang; el.dir = rtl ? 'rtl' : 'ltr'; });
    banner.setAttribute('aria-label', t('aria', it));
    $('cookieText').innerHTML = esc(t('body', it)).replace('{policy}', '<a href="cookies.html">' + esc(t('policy', it)) + '</a>') +
      '<br><br><small class="cookie-law">' + esc(t('law', it).replace('{law}', law)) + '</small>';
    $('cookieAccept').textContent = t('accept', it); $('cookieManage').textContent = t('manage', it); $('cookieDecline').textContent = t('decline', it);
    const modal = document.querySelector('.cookie-modal');
    if (modal) {
      modal.setAttribute('aria-label', t('mTitle', it));
      modal.querySelector('h3').textContent = t('mTitle', it);
      const intro = modal.querySelector(':scope > p'); if (intro) intro.hidden = true;
      [['mEssential', 'mEssentialD'], ['mPref', 'mPrefD'], ['mAnalytics', 'mAnalyticsD'], ['mSocial', 'mSocialD']].forEach(([a, b], n) => {
        const row = modal.querySelectorAll('.cookie-pref-row')[n]; if (!row) return;
        row.querySelector('strong').textContent = t(a, it); row.querySelector('span').textContent = t(b, it);
      });
      $('cookieModalClose').textContent = t('cancel', it); $('cookieModalSave').textContent = t('save', it);
      // regional default: in opt-in regimes optional categories start OFF; elsewhere preference + analytics start ON
      $('prefPreference').checked = !reg.strict; $('prefAnalytics').checked = !reg.strict; $('prefSocial').checked = false;
    }
  }

  function choose(it) {
    current = it; save(it); paintButton();
    document.documentElement.dataset.locale = it.iso + '-' + it.lang;
    closePanel();
    applyConsent(it);
    const banner = $('cookieBanner'); // the consent prompt reappears in the chosen language / regime
    if (banner) banner.classList.add('show');
    document.dispatchEvent(new CustomEvent('octaspan:localechange', { detail: { iso: it.iso, lang: it.lang, name: it.name } }));
  }

  buildButton();
  current = load();
  paintButton(); applyConsent(current);
  window.OctaspanLocale = { t: (k) => t(k), search, choose, current: () => current, locations: items, open: openPanel };
})();
