/* TJR.motion: the site's motion setup. Classic script; nothing touches the DOM until init() is called.

   GSAP 3.12.5 and ScrollTrigger 3.12.5 come from cdnjs by <script> tags on each page, before this file:
     https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js
     https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js
   Opened offline from file:// they may be missing: init() never throws, pages still render whole and
   simply do not move (TJR.motion.enabled is false).

   TJR.motion.init({ kit, kitSrc }) -> TJR.motion
     - registers ScrollTrigger with gsap (once) and refreshes it when the web fonts are in (line heights
       change when Geist and IBM Plex Sans Thai replace the fallback faces);
     - wires the kit's hover layer: assets/motion/motion.css is linked in each page's head and acts by
       itself (buttons, links, cards, focus); <html data-motion> is set if a page left it off; the kit's
       assets/motion/motion.js (an ES module: the hero entrance, tab indicator, counts, card loops) is
       added as <script type="module"> when the page is served over http(s). Chrome runs no module from
       file://, so there it is skipped and the kit's CSS fallback fades the hero's words in at 700 ms.
       kit: false skips it; kitSrc overrides its URL (default: beside this file, ../../motion/motion.js);
     - reads prefers-reduced-motion. Idempotent.
   TJR.motion.reduced   boolean, live (follows the system setting)
   TJR.motion.enabled   gsap present and motion not reduced: pages animate only when this is true,
                        otherwise they draw the final frame
   TJR.motion.gsap / .ScrollTrigger   the libraries, or null
   TJR.motion.onChange(fn) -> off()   fn(reduced) when the reduced-motion setting changes */
(function (global) {
  'use strict';
  var TJR = global.TJR = global.TJR || {};
  var doc = global.document;

  var SELF = '';
  try { SELF = (doc && doc.currentScript && doc.currentScript.src) || ''; } catch (e) { SELF = ''; }

  var st = { inited: false, kit: false, mql: null, subs: [], fonts: false };
  var motion = TJR.motion = TJR.motion || {};

  function query() {
    try { return global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : null; } catch (e) { return null; }
  }
  function sync() {
    motion.reduced = !!(st.mql && st.mql.matches);
    motion.enabled = !!motion.gsap && !motion.reduced;
  }
  function onMql() {
    sync();
    st.subs.slice().forEach(function (fn) { try { fn(motion.reduced); } catch (e) { /* a page's listener */ } });
  }

  function kitSrc(opts) {
    if (opts && opts.kitSrc) return opts.kitSrc;
    var m = /^(.*\/)js\/core\/motion\.js(?:[?#].*)?$/.exec(SELF);
    return m ? m[1] + 'motion/motion.js' : '';
  }
  function served() {
    try { var p = global.location && global.location.protocol; return p === 'http:' || p === 'https:'; } catch (e) { return false; }
  }
  function loadKit(opts) {
    if (st.kit || !doc || !doc.createElement || !served()) return;
    var src = kitSrc(opts);
    if (!src) return;
    st.kit = true;
    if (doc.querySelector('script[src$="motion/motion.js"]')) return;   // the page already tags it
    var s = doc.createElement('script');
    s.type = 'module';
    s.src = src;
    s.setAttribute('data-tjr-kit', 'motion');
    (doc.head || doc.documentElement).appendChild(s);
  }

  function registerGsap() {
    var g = global.gsap, ST = global.ScrollTrigger;
    motion.gsap = g && typeof g.to === 'function' ? g : null;
    if (!motion.gsap || !ST) motion.ScrollTrigger = null;
    else if (motion.ScrollTrigger !== ST && typeof motion.gsap.registerPlugin === 'function') {
      try { motion.gsap.registerPlugin(ST); motion.ScrollTrigger = ST; } catch (e) { motion.ScrollTrigger = null; }
    }
    if (motion.ScrollTrigger && !st.fonts && doc && doc.fonts && doc.fonts.ready && typeof ST.refresh === 'function') {
      st.fonts = true;
      doc.fonts.ready.then(function () { try { ST.refresh(); } catch (e) { /* nothing pinned yet */ } });
    }
  }

  function init(opts) {
    opts = opts || {};
    if (!st.mql) {
      st.mql = query();
      if (st.mql) {
        if (st.mql.addEventListener) st.mql.addEventListener('change', onMql);
        else if (st.mql.addListener) st.mql.addListener(onMql);
      }
    }
    var html = doc && doc.documentElement;
    if (html && html.hasAttribute && !html.hasAttribute('data-motion')) html.setAttribute('data-motion', '');
    registerGsap();
    sync();
    if (opts.kit !== false) loadKit(opts);
    st.inited = true;
    return motion;
  }

  function onChange(fn) {
    if (typeof fn !== 'function') return function () {};
    st.subs.push(fn);
    return function () { var i = st.subs.indexOf(fn); if (i >= 0) st.subs.splice(i, 1); };
  }

  motion.init = init;
  motion.onChange = onChange;
  motion.gsap = null;
  motion.ScrollTrigger = null;
  st.mql = query();   // readable before init(): a media query, not the DOM
  if (st.mql) {
    if (st.mql.addEventListener) st.mql.addEventListener('change', onMql);
    else if (st.mql.addListener) st.mql.addListener(onMql);
  }
  sync();
})(typeof window !== 'undefined' ? window : globalThis);
