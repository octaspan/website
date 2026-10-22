/* Octaspan i18n — translates the whole page from per-language catalogs (assets/i18n/<lang>.json).
   Keys are ids derived from the English source text, so pages need no markup changes.
   - "html" items: elements whose content is only inline markup (translated as innerHTML, tags preserved)
   - "text" items: bare text nodes next to block elements
   - "attr" items: placeholder / aria-label / title / alt
   Anything without a translation stays English. */
(function () {
  'use strict';
  const INLINE = new Set('A ABBR B BDI BR CITE EM I MARK SMALL SPAN STRONG SUB SUP TIME U WBR S Q IMG SVG'.split(' '));
  const SKIP_TAGS = new Set('SCRIPT STYLE NOSCRIPT SVG CANVAS TEXTAREA CODE PRE TEMPLATE IFRAME'.split(' '));
  const SKIP_SEL = '[data-i18n-skip],.selectors,.loc-overlay,#cookieBanner,.cookie-modal-overlay,#cookieModalOverlay,.toast';
  const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  const DIR = 'assets/i18n/';

  const SVG_RE = /<svg[\s\S]*?<\/svg>/g;
  const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
  function hash(s) { // FNV-1a 32 -> base36
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(36);
  }
  const hasLetters = (s) => /\p{L}{2}/u.test(s);

  const items = [];          // {kind, el|node, attr, key, id, orig}
  const seen = new WeakSet();
  const dicts = {};
  let lang = 'en';

  function ownText(el) {
    for (const n of el.childNodes) if (n.nodeType === 3 && hasLetters(n.nodeValue)) return true;
    return false;
  }
  function inlineOnly(el) {
    for (const c of el.children) {
      if (!INLINE.has(c.tagName.toUpperCase()) || c.hasAttribute('id') || c.hasAttribute('data-i18n-skip')) return false;
      if (c.tagName.toUpperCase() !== 'SVG' && !inlineOnly(c)) return false;
    }
    return true;
  }
  function add(it) { it.id = hash(it.key); items.push(it); }

  function walk(el) {
    if (SKIP_TAGS.has(el.tagName.toUpperCase()) || el.matches(SKIP_SEL)) return;
    if (!seen.has(el)) {
      seen.add(el);
      for (const a of ATTRS) {
        const v = el.getAttribute(a);
        if (v && hasLetters(v)) add({ kind: 'attr', el, attr: a, key: norm(v), orig: v });
      }
    }
    const tag = el.tagName.toUpperCase();
    const leaf = el.children.length === 0 || (ownText(el) && inlineOnly(el) && !el.hasAttribute('id'));
    if (leaf && el.childNodes.length && hasLetters(el.textContent) && tag !== 'BODY') {
      if (!el.__i18nDone) {
        el.__i18nDone = true;
        if (tag === 'OPTION' && !el.hasAttribute('value')) el.setAttribute('value', el.textContent.trim());
        const html = el.innerHTML;
        if (/^Octa<span[^>]*>span<\/span>$/.test(html.trim())) return;
        const svgs = html.match(SVG_RE) || [];
        add({ kind: 'html', el, key: norm(html.replace(SVG_RE, '<svg></svg>')), orig: html, svgs });
      }
      return;
    }
    for (const n of Array.from(el.childNodes)) {
      if (n.nodeType === 1) walk(n);
      else if (n.nodeType === 3 && hasLetters(n.nodeValue) && !n.__i18nDone) {
        n.__i18nDone = true;
        add({ kind: 'text', node: n, key: norm(n.nodeValue), orig: n.nodeValue });
      }
    }
  }

  function collect() {
    walk(document.body);
    const t = document.querySelector('title');
    if (t && !t.__i18nDone) { t.__i18nDone = true; add({ kind: 'text', node: t.firstChild, key: norm(t.textContent), orig: t.textContent }); }
    document.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"]').forEach((m) => {
      if (!m.__i18nDone) { m.__i18nDone = true; add({ kind: 'attr', el: m, attr: 'content', key: norm(m.content), orig: m.content }); }
    });
    return items;
  }

  function put(it, val) {
    if (it.kind === 'html') {
      if (it.svgs && it.svgs.length && val !== it.orig) { let n = 0; val = val.replace(/<svg><\/svg>/g, () => it.svgs[n++] || ''); }
      it.el.innerHTML = val;
    }
    else {
      if (val !== it.orig && val.indexOf('&') > -1) { const ta = document.createElement('textarea'); ta.innerHTML = val; val = ta.value; }
      if (it.kind === 'text') it.node.nodeValue = val; else it.el.setAttribute(it.attr, val);
    }
  }

  async function dict(l) {
    if (dicts[l]) return dicts[l];
    try {
      const r = await fetch(DIR + l + '.json', { cache: 'default' });
      dicts[l] = r.ok ? await r.json() : {};
    } catch (e) { dicts[l] = {}; }
    return dicts[l];
  }

  async function apply(l) {
    lang = l || 'en';
    collect();
    const d = lang === 'en' ? null : await dict(lang);
    if (l !== lang) return; // a newer request superseded this one
    for (const it of items) {
      const tr = d && d[it.id];
      if (!tr) { if (it.cur) { put(it, it.orig); it.cur = false; } continue; }
      put(it, it.kind === 'text' ? it.orig.replace(it.orig.trim(), tr) : tr);
      it.cur = true;
    }
    legalNote();
    document.dispatchEvent(new CustomEvent('octaspan:translated', { detail: { lang } }));
  }

  function legalNote() {
    const legal = /\/(privacy|terms|cookies)(\.html)?$/.test(location.pathname);
    const main = document.getElementById('main');
    let n = document.getElementById('i18nNote');
    if (!legal || !main || lang === 'en') { if (n) n.remove(); return; }
    if (!n) {
      n = document.createElement('p'); n.id = 'i18nNote'; n.setAttribute('data-i18n-skip', '');
      n.style.cssText = 'margin:0;padding:10px 16px;background:#eef3f8;color:#1c2b3a;font-size:13px;text-align:center';
      main.prepend(n);
    }
    n.textContent = tr('Translated for convenience. If anything differs, the English version prevails.');
  }

  // Translate a dynamic (JS-generated) message by its English text. Falls back to the English string.
  function tr(s) {
    const d = dicts[lang];
    return (d && d[hash(norm(s))]) || s;
  }

  window.OctaspanI18n = { apply, tr, collect, hash, norm, items: () => items, lang: () => lang, ready: (l) => dict(l) };
})();
