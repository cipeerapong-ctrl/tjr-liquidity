test('store set/get round-trips JSON', () => {
  TJR.store.set('x', { a: 1 });
  eq(TJR.store.get('x'), { a: 1 });
  eq(TJR.store.get('missing', 7), 7);
  TJR.store.remove('x');
  eq(TJR.store.get('x', null), null);
});

test('store survives a throwing localStorage (memory fallback)', () => {
  const real = window.localStorage;
  const boom = () => { throw new Error('blocked'); };
  window.localStorage = { getItem: boom, setItem: boom, removeItem: boom };
  let threw = false;
  try {
    TJR.store.set('y', { b: [1, 2] });
    eq(TJR.store.get('y'), { b: [1, 2] });
    TJR.store.remove('y');
    eq(TJR.store.get('y', 'gone'), 'gone');
  } catch (e) { threw = true; }
  window.localStorage = real;
  ok(!threw, 'store must never throw');
});

test('util.roundTick snaps to 0.25', () => {
  eq(TJR.util.roundTick(30012.13), 30012.25);
  eq(TJR.util.roundTick(30012.1), 30012);
  eq(TJR.util.roundTick(7500.4, 0.5), 7500.5);
});

test('util.clamp / lerp / fmtPrice', () => {
  eq(TJR.util.clamp(5, 0, 3), 3);
  eq(TJR.util.clamp(-1, 0, 3), 0);
  eq(TJR.util.lerp(10, 20, 0.5), 15);
  eq(TJR.util.fmtPrice(30012.25), '30,012.25');
  eq(TJR.util.fmtPrice(7500), '7,500.00');
});

test('util.tsChip builds label and link', () => {
  const c = TJR.util.tsChip(1425);
  eq(c.label, '23:45');
  ok(c.href.endsWith('?t=1425'), c.href);
  eq(c.href, 'https://youtu.be/Vulini8xbB0?t=1425');
  eq(TJR.util.tsChip(2947).label, '49:07');
  eq(TJR.util.tsChip(5).label, '00:05');
});
