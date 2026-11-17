/* Label de-collision (Task 9): TJR.chart.overlays.placer. Close levels (a stack of lows a few ticks
   apart) get their tags side by side on their own lines, then under the line, and only then the old
   climb above the label they hit. Wrapped in an IIFE (all test files share one vm global scope). */
(function () {
  'use strict';
  var P = TJR.chart.overlays.placer;
  var BOX = { left: 0, right: 600, top: 0, bottom: 400 };
  function rect(x, y) { return { x: x, y: y, w: 80, h: 17 }; }
  function overlap(a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }

  test('placer: a free label stays where it is', function () {
    var place = P(BOX), r = place(rect(300, 100), { minX: 0 });
    eq(r.x, 300); eq(r.y, 100);
  });

  test('placer: a taken spot slides the label left along its own row, never left of minX', function () {
    var place = P(BOX);
    var a = place(rect(300, 100), { minX: 0 });
    var b = place(rect(300, 106), { minX: 100 });
    var c = place(rect(300, 110), { minX: 100 });
    eq(b.y, 106, 'b keeps its row');
    eq(c.y, 110, 'c keeps its row');
    ok(b.x + b.w <= a.x, 'b ends left of a');
    ok(c.x + c.w <= b.x, 'c ends left of b');
    ok(c.x >= 100, 'c stays right of its minX');
    ok(!overlap(a, b) && !overlap(b, c) && !overlap(a, c), 'no two labels overlap');
  });

  test('placer: with no room to slide, the label takes its alternative (under the line)', function () {
    var place = P(BOX);
    var a = place(rect(300, 100), { minX: 0 });
    var b = place(rect(300, 106), { minX: 290, alts: [rect(300, 140)] });
    eq(b.x, 300); eq(b.y, 140);
    ok(!overlap(a, b));
  });

  test('placer: without minX or alts it climbs above the label it hits (the old rule)', function () {
    var place = P(BOX);
    var a = place(rect(300, 100));
    var b = place(rect(300, 106));
    eq(b.x, 300);
    ok(b.y + b.h <= a.y, 'b sits above a');
  });

  test('placer: an alternative outside the plot is skipped; fixed tags are steered around', function () {
    var place = P(BOX);
    place.add({ x: 280, y: 95, w: 40, h: 17 });                // a structure tag
    var b = place(rect(300, 100), { minX: 250, alts: [rect(300, 395)] });
    ok(b.y + b.h <= 95, 'climbed above the tag: no slide room, the alternative is off the plot');
    var c = place(rect(400, 100), { minX: 0 });
    eq(c.y, 100); eq(c.x, 400, 'clear spot untouched');
  });
})();
