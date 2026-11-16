/* TJR.store: JSON key/value in localStorage (prefix "tjr."), in-memory fallback.
   Every storage access is wrapped in try/catch; the site works without storage. */
(function (global) {
  'use strict';
  var TJR = global.TJR = global.TJR || {};
  var PREFIX = 'tjr.';
  var mem = {};

  // Resolved on every call so a blocked/replaced localStorage is handled live.
  function storage() {
    try { return global.localStorage || null; } catch (e) { return null; }
  }

  function get(key, fallback) {
    var k = PREFIX + key;
    var raw = null;
    try {
      var s = storage();
      if (s) raw = s.getItem(k);
    } catch (e) { raw = null; }
    if (raw !== null && raw !== undefined) {
      try { return JSON.parse(raw); } catch (e2) { /* corrupt entry: fall through */ }
    }
    return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : fallback;
  }

  function set(key, value) {
    var k = PREFIX + key;
    mem[k] = value;
    try {
      var s = storage();
      if (s) s.setItem(k, JSON.stringify(value));
    } catch (e) { /* quota / blocked: memory copy is enough */ }
  }

  function remove(key) {
    var k = PREFIX + key;
    delete mem[k];
    try {
      var s = storage();
      if (s) s.removeItem(k);
    } catch (e) { /* ignore */ }
  }

  TJR.store = { get: get, set: set, remove: remove };
})(typeof window !== 'undefined' ? window : globalThis);
