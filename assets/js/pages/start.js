/* TJR Liquidity: step 0, the beginner page (v3). Classic script, after layout and motion.
   Pure helpers on TJR.startPage (no DOM, tested in Node by tests/start.test.js); the page code starts below the DOM guard. */
(function (global) {
  'use strict';
  var TJR = global.TJR = global.TJR || {};
  var doc = global.document;
  var P = TJR.startPage = TJR.startPage || {};

  if (!doc || !TJR.layout || !TJR.layout.mount) return;   // Node (tests): helpers only
  TJR.motion.init();
  TJR.layout.mount({
    page: 'start',
    close: { title: 'พร้อมแล้ว ไปเรียน liquidity', line: 'ขั้นถัดไปคือความคิดหลักของระบบ TJR', label: 'ไปขั้น 1', href: 'learn.html' }
  });
})(typeof window !== 'undefined' ? window : globalThis);
