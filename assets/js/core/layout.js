/* TJR.layout: the shared nav and footer, written once here as template strings and injected on load
   (works from file://, no fetch). Classic script; nothing touches the DOM until mount() is called.

   Dealt (assets/css/tokens.css): nav-centre, footer-dark, close-word, buttons tonal, mark ring. The markup
   is the kit's (assets/starter.html, system.css classes); this file adds the phone sheet's behaviour,
   because the kit's system.js is a module and Chrome runs no module script from file://.

   TJR.layout.mount({ page, base, close })
     page   a PAGES id: 'home' | 'learn' | 'confluences' | 'strategy' | 'scenarios' | 'playbook' | 'risk' | 'lab'
            (that word gets aria-current="page"; anything else marks none)
     base   prefix for the site's own links ('' at the site root, '../' from dev/); by default the folder
            layout.js was loaded from, minus assets/js/core/
     close  optional { title, line, label, href }: the dealt close-word row (the h2, one line, the main
            button, then the name across the .wrap); the footer is then footer.closing, one screen tall.
            Without it the footer is the plain dark footer at its own height.
     -> { nav, footer } (the injected elements). Calling it again replaces both and their listeners.
   Pure builders (no DOM): navHTML(opts), footerHTML(opts), chip(sec, clip?), olderNote(html, clip, sec),
   webDef(html, url), gap(); constants NAME, PAGES, CLIP, PLAYLIST, GAP_TEXT, SOURCE_TEXT, OLDER_LABEL, WEBDEF_LABEL.
   chip(sec) is the main-clip chip; chip(sec, n) is a playlist chip "#n MM:SS" (TJR.sources, core/sources.js).
   A page puts <main id="top"> (the skip link's target) and a <noscript> copy of navHTML's bar. */
(function (global) {
  'use strict';
  var TJR = global.TJR = global.TJR || {};
  var doc = global.document;

  // where this file was loaded from, read once while it runs (classic scripts only), for the default base
  var SELF = '';
  try { SELF = (doc && doc.currentScript && doc.currentScript.src) || ''; } catch (e) { SELF = ''; }

  var NAME = 'Liquidity';
  var CLIP = 'https://youtu.be/Vulini8xbB0';
  var CLIP_TITLE = 'TJR · The ONLY Liquidity Guide You’ll Ever Need';
  var PLAYLIST = 'https://www.youtube.com/playlist?list=PLKE_22Jx497s5Q6ZX2pfDcDwCm_IyxR7e';
  var PLAYLIST_TITLE = 'เพลย์ลิสต์ Path to Profitability';
  var SOURCE_TEXT = 'เนื้อหาจากคลิปของ TJR เท่านั้น';
  var GAP_TEXT = 'คลิปไม่ได้ระบุ';
  var OLDER_LABEL = 'คลิปเก่า (ม.ค. 2026) พูดว่า…';
  var WEBDEF_LABEL = 'นิยามทั่วไป ไม่ใช่จากคลิป';
  var CTA = { label: 'เริ่มบทเรียน', page: 'learn' };
  var PAGES = [
    { id: 'home', label: 'หน้าแรก', href: 'index.html' },
    { id: 'learn', label: 'บทเรียน', href: 'learn.html' },
    { id: 'confluences', label: 'Confluences', href: 'confluences.html' },
    { id: 'strategy', label: 'กลยุทธ์', href: 'strategy.html' },
    { id: 'scenarios', label: 'สถานการณ์', href: 'scenarios.html' },
    { id: 'playbook', label: 'Playbook', href: 'playbook.html' },
    { id: 'risk', label: 'ความเสี่ยง', href: 'risk.html' },
    { id: 'lab', label: 'แบบฝึก', href: 'lab.html' }
  ];
  // footer columns, ordered as the nav
  var COLUMNS = [
    { title: 'เรียน', ids: ['home', 'learn', 'confluences', 'strategy'] },
    { title: 'ฝึก', ids: ['scenarios', 'playbook', 'risk', 'lab'] }
  ];

  var ICON_BARS = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M2 5h14M2 13h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  var ICON_CROSS = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M4 4l10 10M14 4L4 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  var ARROW = '<svg class="m-arrow" viewBox="0 0 12 12" aria-hidden="true"><path class="m-arrow__stem" d="M1 6h8"/><path class="m-arrow__head" d="M4.5 2.5 8 6l-3.5 3.5"/></svg>';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function defaultBase() {
    var m = /^(.*\/)assets\/js\/core\/layout\.js(?:[?#].*)?$/.exec(SELF);
    return m ? m[1] : '';
  }
  function baseOf(opts) { return opts && typeof opts.base === 'string' ? opts.base : defaultBase(); }
  function pageById(id) { for (var i = 0; i < PAGES.length; i++) if (PAGES[i].id === id) return PAGES[i]; return null; }
  function logo(base, cls) {
    return '<a class="' + cls + '" href="' + esc(base + 'index.html') + '"><span class="mark" data-mark="ring" aria-hidden="true"></span>' + esc(NAME) + '</a>';
  }

  // ------------------------------------------------------------------ builders (pure)

  function navHTML(opts) {
    opts = opts || {};
    var base = baseOf(opts), page = opts.page, cta = pageById(CTA.page);
    var items = PAGES.map(function (p) {
      var cur = p.id === page ? ' aria-current="page"' : '';
      return '<div class="nav__item"><a class="nav__link" href="' + esc(base + p.href) + '"' + cur + '>' + esc(p.label) + '</a></div>';
    }).join('');
    return '<header class="nav nav--centre" data-tjr-layout="nav">' +
      '<div class="wrap nav__bar">' +
        '<a class="skip-link" href="#top">ข้ามไปที่เนื้อหา</a>' +
        logo(base, 'nav__logo') +
        '<nav class="nav__links" id="tjr-nav-links" aria-label="เมนูหลัก">' + items + '</nav>' +
        '<div class="nav__actions"><a class="btn btn--primary" href="' + esc(base + cta.href) + '">' + esc(CTA.label) + '</a></div>' +
        '<button class="nav__toggle" type="button" aria-expanded="false" aria-controls="tjr-nav-links" aria-label="เมนู">' + ICON_BARS + '</button>' +
      '</div>' +
    '</header>';
  }

  function closeHTML(close, base) {
    var href = close.href != null ? close.href : base + pageById(CTA.page).href;
    return '<div class="closing__cta close--word">' +
      '<div class="section-head--split">' +
        '<div><h2 id="close-h">' + esc(close.title) + '</h2>' + (close.line ? '<p class="t-lead">' + esc(close.line) + '</p>' : '') + '</div>' +
        '<a class="btn btn--primary" href="' + esc(href) + '">' + esc(close.label || CTA.label) + ARROW + '</a>' +
      '</div>' +
      '<p class="close__word" aria-hidden="true">' + esc(NAME) + '</p>' +
    '</div>';
  }

  function footerHTML(opts) {
    opts = opts || {};
    var base = baseOf(opts), close = opts.close && opts.close.title ? opts.close : null;
    var cols = COLUMNS.map(function (c) {
      return '<div class="span-2 footer__col"><h3>' + esc(c.title) + '</h3><ul>' + c.ids.map(function (id) {
        var p = pageById(id);
        return '<li><a href="' + esc(base + p.href) + '">' + esc(p.label) + '</a></li>';
      }).join('') + '</ul></div>';
    }).join('');
    // close-word sets the name across the .wrap: the company block then shows no second, large name
    var brand = '<div class="span-4 stack-4 footer__brand">' + (close ? '' : logo(base, 'footer__mark')) +
      '<p class="footer__lede">เรียนระบบ liquidity จากคลิปเดียว บนกราฟที่ยุ่งเหมือนตลาดจริง</p></div>';
    var source = '<div class="span-4 footer__col footer__source"><h3>ที่มา</h3>' +
      '<p class="footer__source-line"><a href="' + CLIP + '" target="_blank" rel="noopener">' + esc(CLIP_TITLE) + '</a></p>' +
      '<p class="footer__source-line"><a href="' + PLAYLIST + '" target="_blank" rel="noopener">' + esc(PLAYLIST_TITLE) + '</a></p>' +
      '<p class="footer__source-note">' + esc(SOURCE_TEXT) + '</p></div>';
    var links = '<div class="closing__links">' +
      '<div class="grid">' + brand + cols + source + '</div>' +
      '<div class="footer__legal"><span>© 2026 ' + esc(NAME) + ' · สรุปเพื่อการเรียน ไม่ใช่เว็บไซต์ของ TJR</span></div>' +
    '</div>';
    var cls = close ? 'footer closing footer--dark ground-inverse' : 'footer footer--dark ground-inverse';
    return '<footer class="' + cls + '" data-tjr-layout="footer"' + (close ? ' aria-labelledby="close-h"' : ' aria-label="ส่วนท้าย"') + '>' +
      '<div class="wrap">' + (close ? closeHTML(close, base) : '') + links + '</div>' +
    '</footer>';
  }

  // the timestamp chip (site.css .ts-chip): "▶ MM:SS" (the triangle is drawn by CSS), opens the main clip there.
  // chip(sec, n) with a playlist clip n: "▶ #n MM:SS", class ts-chip--pl, opens that video there.
  function chip(sec, clip) {
    var c = TJR.util.tsChip(sec, clip);
    if (!c.clip) {
      return '<a class="ts-chip" href="' + esc(c.href) + '" target="_blank" rel="noopener" aria-label="ดูในคลิปที่ ' + c.label + '">' + c.label + '</a>';
    }
    var mmss = c.label.replace(/^#\d+ /, '');
    return '<a class="ts-chip ts-chip--pl" href="' + esc(c.href) + '" target="_blank" rel="noopener" aria-label="' +
      esc('ดูในคลิป #' + c.clip + ' ' + TJR.sources.byClip(c.clip).title + ' ที่ ' + mmss) + '">' + c.label + '</a>';
  }
  // the older-video box (site.css .older-note): what the January 2026 playlist said where the main clip differs.
  // html is trusted markup written in the page; the chip points at the playlist clip it came from.
  function olderNote(html, clip, sec) {
    return '<aside class="older-note"><p class="older-note__label">' + OLDER_LABEL + '</p>' +
      '<div class="older-note__body">' + html + '</div>' +
      '<p class="older-note__src chips">' + chip(sec, clip) + '</p></aside>';
  }
  // the general-definition box (site.css .web-def): a definition from the web, not from a clip, with its source
  function webDef(html, url) {
    var u = String(url == null ? '' : url);
    var link = /^https?:\/\//i.test(u)
      ? '<p class="web-def__src"><a href="' + esc(u) + '" target="_blank" rel="noopener">ที่มา: ' + esc(u) + '</a></p>' : '';
    return '<aside class="web-def"><p class="web-def__label">' + WEBDEF_LABEL + '</p>' +
      '<div class="web-def__body">' + html + '</div>' + link + '</aside>';
  }
  // the gap badge (site.css .badge-gap): what the clip does not say, never filled in
  function gap() { return '<span class="badge-gap">' + GAP_TEXT + '</span>'; }

  // ------------------------------------------------------------------ mount (DOM)

  var teardown = null;

  function wireSheet(nav) {
    var toggle = nav.querySelector('.nav__toggle');
    var body = doc.body;
    function isOpen() { return nav.classList.contains('is-open'); }
    function setOpen(open) {
      nav.classList.toggle('is-open', open);
      if (body) body.classList.toggle('nav-locked', open);
      if (toggle) { toggle.setAttribute('aria-expanded', String(open)); toggle.innerHTML = open ? ICON_CROSS : ICON_BARS; }
    }
    function onToggle(e) {
      // the kit's system.js, if a page ever loads it too, wires this same button: only one handler runs
      if (e && e.stopImmediatePropagation) e.stopImmediatePropagation();
      setOpen(!isOpen());
    }
    function onKey(e) {
      if (e.key !== 'Escape' || !isOpen()) return;
      setOpen(false);
      if (toggle) toggle.focus();
    }
    // a tap on any link in the open sheet closes it, so the page it leads to is never left under the sheet
    function onNavClick(e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (a && isOpen()) setOpen(false);
    }
    var wide = global.matchMedia ? global.matchMedia('(min-width: 1024px)') : null;
    function onWide(e) { if (e.matches) setOpen(false); }

    if (toggle) toggle.addEventListener('click', onToggle);
    nav.addEventListener('click', onNavClick);
    doc.addEventListener('keydown', onKey);
    if (wide) { if (wide.addEventListener) wide.addEventListener('change', onWide); else if (wide.addListener) wide.addListener(onWide); }

    return function () {
      setOpen(false);
      if (toggle) toggle.removeEventListener('click', onToggle);
      nav.removeEventListener('click', onNavClick);
      doc.removeEventListener('keydown', onKey);
      if (wide) { if (wide.removeEventListener) wide.removeEventListener('change', onWide); else if (wide.removeListener) wide.removeListener(onWide); }
    };
  }

  function fromHTML(html) {
    var t = doc.createElement('template');
    t.innerHTML = html;
    return t.content.firstElementChild;
  }

  function mount(opts) {
    opts = opts || {};
    if (!doc || !doc.body) return { nav: null, footer: null };
    if (teardown) { teardown(); teardown = null; }
    var root = doc.documentElement;
    if (!root.hasAttribute('data-tone')) root.setAttribute('data-tone', 'dark');   // footer--dark on this dark ground

    var nav = fromHTML(navHTML(opts)), footer = fromHTML(footerHTML(opts));
    var oldNav = doc.querySelector('[data-tjr-layout="nav"]'), oldFooter = doc.querySelector('[data-tjr-layout="footer"]');
    var navSlot = doc.querySelector('[data-tjr-nav]'), footSlot = doc.querySelector('[data-tjr-footer]');

    if (oldNav) oldNav.replaceWith(nav);
    else if (navSlot) navSlot.replaceWith(nav);
    else doc.body.insertBefore(nav, doc.body.firstChild);

    var main = doc.querySelector('main');
    if (oldFooter) oldFooter.replaceWith(footer);
    else if (footSlot) footSlot.replaceWith(footer);
    else if (main && main.parentNode) main.parentNode.insertBefore(footer, main.nextSibling);
    else doc.body.appendChild(footer);

    var unwire = wireSheet(nav);
    teardown = function () { unwire(); };
    return { nav: nav, footer: footer };
  }

  TJR.layout = {
    mount: mount,
    navHTML: navHTML,
    footerHTML: footerHTML,
    chip: chip,
    olderNote: olderNote,
    webDef: webDef,
    gap: gap,
    NAME: NAME,
    CLIP: CLIP,
    PLAYLIST: PLAYLIST,
    OLDER_LABEL: OLDER_LABEL,
    WEBDEF_LABEL: WEBDEF_LABEL,
    GAP_TEXT: GAP_TEXT,
    SOURCE_TEXT: SOURCE_TEXT,
    PAGES: PAGES.map(function (p) { return { id: p.id, label: p.label, href: p.href }; })
  };
})(typeof window !== 'undefined' ? window : globalThis);
