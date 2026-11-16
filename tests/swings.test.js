const bull = (o, h, l, c) => ({ t: 0, o, h, l, c });

test('rng: same seed gives identical first 10 next()', () => {
  const a = TJR.rng.make(42), b = TJR.rng.make(42);
  const sa = [], sb = [];
  for (let k = 0; k < 10; k++) { sa.push(a.next()); sb.push(b.next()); }
  eq(sa, sb);
  ok(sa.every((v) => v >= 0 && v < 1), 'next() must stay in [0,1)');
  ok(JSON.stringify(sa) !== JSON.stringify((() => { const c = TJR.rng.make(43); const r = []; for (let k = 0; k < 10; k++) r.push(c.next()); return r; })()), 'different seed differs');
});

test('rng: range / int / pick / chance / gauss behave', () => {
  const r = TJR.rng.make(7);
  let seen = {};
  for (let k = 0; k < 500; k++) {
    const x = r.range(2, 5);
    ok(x >= 2 && x < 5, 'range ' + x);
    const n = r.int(1, 3);
    ok(n === 1 || n === 2 || n === 3, 'int ' + n);
    seen[n] = true;
  }
  eq(Object.keys(seen).sort(), ['1', '2', '3'], 'int is inclusive on both ends');
  const arr = ['a', 'b', 'c'];
  for (let k = 0; k < 50; k++) ok(arr.indexOf(r.pick(arr)) >= 0);
  let hits = 0;
  for (let k = 0; k < 2000; k++) if (r.chance(0.25)) hits++;
  ok(hits > 400 && hits < 600, 'chance(0.25) hits ' + hits);
  ok(r.chance(1) === true && r.chance(0) === false);
  let sum = 0;
  for (let k = 0; k < 2000; k++) sum += r.gauss();
  ok(Math.abs(sum / 2000) < 0.1, 'gauss mean ~ 0, got ' + sum / 2000);
});

test('swings: [bull, bear, bear, bull] gives one high and one low', () => {
  const cs = [
    bull(100, 110, 99, 108),   // 0 bull
    bull(108, 112, 100, 102),  // 1 bear, higher wick than 0
    bull(102, 105, 90, 95),    // 2 bear
    bull(95, 100, 88, 99),     // 3 bull, lower wick than 2
  ];
  const s = TJR.swings.find(cs);
  eq(s.highs, [{ i: 1, price: 112, pair: [0, 1] }]);
  eq(s.lows, [{ i: 3, price: 88, pair: [2, 3] }]);
  ok(TJR.swings.isHigh(cs, 0) && !TJR.swings.isHigh(cs, 1) && !TJR.swings.isHigh(cs, 2));
  ok(TJR.swings.isLow(cs, 2) && !TJR.swings.isLow(cs, 0) && !TJR.swings.isLow(cs, 3));
});

test('swings: wick holder is candle k when k has the higher high / lower low', () => {
  const cs = [
    bull(100, 120, 99, 108),   // bull with the higher wick
    bull(108, 112, 100, 102),  // bear
    bull(102, 105, 85, 95),    // bear with the lower wick
    bull(95, 100, 88, 99),     // bull
  ];
  const s = TJR.swings.find(cs);
  eq(s.highs, [{ i: 0, price: 120, pair: [0, 1] }]);
  eq(s.lows, [{ i: 2, price: 85, pair: [2, 3] }]);
});

test('swings: a doji is neither side of a pair', () => {
  const cs = [
    bull(100, 110, 99, 108),   // bull
    bull(105, 112, 100, 105),  // doji
    bull(105, 111, 98, 105),   // doji
    bull(105, 109, 97, 106),   // bull
  ];
  const s = TJR.swings.find(cs);
  eq(s.highs, []);
  eq(s.lows, []);
  ok(!TJR.swings.isHigh(cs, 0) && !TJR.swings.isLow(cs, 1) && !TJR.swings.isLow(cs, 2));
});

test('swings: edges and short series are safe', () => {
  eq(TJR.swings.find([]), { highs: [], lows: [] });
  eq(TJR.swings.find([bull(1, 2, 0, 1.5)]), { highs: [], lows: [] });
  ok(!TJR.swings.isHigh([bull(1, 2, 0, 1.5)], 0));
  ok(!TJR.swings.isHigh([], 5) && !TJR.swings.isLow([], -1));
});

test('swings.label: highs 100,105,103 -> H, HH, LH', () => {
  const out = TJR.swings.label([
    { i: 1, price: 100, type: 'high' },
    { i: 5, price: 105, type: 'high' },
    { i: 9, price: 103, type: 'high' },
  ]);
  eq(out.map((p) => p.tag), ['H', 'HH', 'LH']);
  eq(out[1].i, 5);
  eq(out[1].price, 105);
});

test('swings.label: lows and interleaved highs track separately', () => {
  const out = TJR.swings.label([
    { i: 1, price: 100, type: 'high' },
    { i: 2, price: 90, type: 'low' },
    { i: 3, price: 105, type: 'high' },
    { i: 4, price: 92, type: 'low' },
    { i: 5, price: 88, type: 'low' },
  ]);
  eq(out.map((p) => p.tag), ['H', 'L', 'HH', 'HL', 'LL']);
});
