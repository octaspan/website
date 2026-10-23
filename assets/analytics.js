/* Octaspan — Google Analytics 4, consent-gated.
   1. Replace GA_MEASUREMENT_ID with your GA4 ID (Admin > Data streams > Web > "Measurement ID", looks like G-AB12CD34EF).
   2. Nothing is loaded or sent until the visitor allows the "Analytics" cookie category in the consent banner.
   3. If they later withdraw consent, collection stops and GA cookies are cleared. */
(function () {
  'use strict';
  var GA_MEASUREMENT_ID = 'G-SVVS09HQZT';
  if (!/^G-[A-Z0-9]{6,}$/.test(GA_MEASUREMENT_ID) || /X{6,}/.test(GA_MEASUREMENT_ID)) return; // not configured yet
  var KEY = 'octaspan_cookie_consent', loaded = false;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  // Consent Mode v2: everything denied until the visitor says otherwise
  gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });

  function allowed() {
    try { var c = JSON.parse(localStorage.getItem(KEY)); return !!(c && c.analytics === true); } catch (e) { return false; }
  }
  function load() {
    if (loaded) return; loaded = true;
    var s = document.createElement('script'); s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', GA_MEASUREMENT_ID, { anonymize_ip: true, allow_google_signals: false, allow_ad_personalization_signals: false }); // sends the page_view
  }
  function clearCookies() {
    document.cookie.split(';').forEach(function (c) {
      var n = c.split('=')[0].trim();
      if (n === '_ga' || n.indexOf('_ga_') === 0) document.cookie = n + '=; Max-Age=0; path=/; domain=.' + location.hostname.replace(/^www\./, '');
    });
  }
  function sync() {
    if (allowed()) { gtag('consent', 'update', { analytics_storage: 'granted' }); load(); }
    else { gtag('consent', 'update', { analytics_storage: 'denied' }); if (loaded) { window['ga-disable-' + GA_MEASUREMENT_ID] = true; clearCookies(); } }
  }
  document.addEventListener('octaspan:consent', sync);
  sync();

  // Pages without the site-wide cookie banner (e.g. the Live Threat Snapshot) get a small consent bar,
  // so first-time visitors landing there directly can choose. Same storage key/format as the main banner.
  function miniBanner() {
    if (document.getElementById('cookieBanner')) return;
    var saved; try { saved = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    if (saved && saved.ts && Date.now() - saved.ts < 90 * 86400e3) return;
    var d = document.createElement('div'); d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Cookie preferences');
    d.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#eaf0f8;color:#0b1626;padding:14px 20px;display:flex;gap:16px;flex-wrap:wrap;align-items:center;justify-content:space-between;font:14px/1.5 system-ui,sans-serif;box-shadow:0 -4px 20px rgba(0,0,0,.25)';
    d.innerHTML = '<span style="max-width:760px">We use analytics cookies to understand how this page is used. They are off unless you allow them. See our <a href="cookies.html" style="color:#0a6f8c">Cookie Policy</a>.</span>' +
      '<span style="display:flex;gap:10px"><button type="button" data-a="0" style="padding:8px 18px;border:1px solid #0b1626;background:transparent;color:#0b1626;border-radius:999px;cursor:pointer;font:inherit">Decline</button>' +
      '<button type="button" data-a="1" style="padding:8px 18px;border:1px solid #0b1626;background:#0b1626;color:#fff;border-radius:999px;cursor:pointer;font:inherit">Accept analytics</button></span>';
    d.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var yes = b.getAttribute('data-a') === '1', c = { essential: true, preference: yes, analytics: yes, social: false, ts: Date.now() };
      try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (x) {}
      d.remove(); document.dispatchEvent(new CustomEvent('octaspan:consent', { detail: c }));
    });
    document.body.appendChild(d);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', miniBanner); else miniBanner();

  // Optional custom events: add data-track="event_name" to any link/button.
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-track]');
    if (el && allowed() && window.gtag && loaded) gtag('event', el.getAttribute('data-track'), { page_path: location.pathname });
  });
})();
