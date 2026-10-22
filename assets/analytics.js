/* Octaspan — Google Analytics 4, consent-gated.
   1. Replace GA_MEASUREMENT_ID with your GA4 ID (Admin > Data streams > Web > "Measurement ID", looks like G-AB12CD34EF).
   2. Nothing is loaded or sent until the visitor allows the "Analytics" cookie category in the consent banner.
   3. If they later withdraw consent, collection stops and GA cookies are cleared. */
(function () {
  'use strict';
  var GA_MEASUREMENT_ID = 'G-XXXXXXXXXX';
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

  // Optional custom events: add data-track="event_name" to any link/button.
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-track]');
    if (el && allowed() && window.gtag && loaded) gtag('event', el.getAttribute('data-track'), { page_path: location.pathname });
  });
})();
