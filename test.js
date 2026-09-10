// node test.js
const assert = require('assert');
const { fmtScale, fmtExact, buildTicks } = require('./scale.js');
require('./questions.js');
const QUESTIONS = eval(require('fs').readFileSync('./questions.js', 'utf8') + ';QUESTIONS');

// --- formattazione ---
assert.strictEqual(fmtScale(8_200_000_000), '8,2 miliardi');
assert.strictEqual(fmtScale(8_250_000_000), '8,25 miliardi');
assert.strictEqual(fmtScale(1_000_000_000), '1 miliardo');
assert.strictEqual(fmtScale(450_000_000), '450 milioni');
assert.strictEqual(fmtScale(42_000), '42 mila');
assert.strictEqual(fmtScale(3_000_000_000_000), '3.000 miliardi');
assert.strictEqual(fmtScale(206), '206');
assert.strictEqual(fmtExact(42_195), '42.195');
assert.strictEqual(fmtExact(384_400), '384.400');

// --- scala, per ogni domanda del gioco ---
const seen = new Set();
const sigDigits = n => String(n).replace(/0+$/, '').length;

for (const q of QUESTIONS) {
  const w = `[${q.q}]`;
  assert.ok(!seen.has(q.q), `domanda duplicata ${w}`);
  seen.add(q.q);
  assert.ok(Number.isInteger(q.a) && q.a > 0, `risposta non valida ${w}`);
  assert.ok(q.a < q.max, `il fondo scala non supera la risposta ${w}`);
  assert.ok(q.a > q.max / 50, `la risposta è schiacciata in fondo alla scala ${w}`);
  assert.ok(Number.isInteger(q.step) && q.step > 0, `step non valido ${w}`);
  assert.ok(sigDigits(q.step) <= 1, `step non arrotondato (1/2/5 × 10^k): ${q.step} ${w}`);

  const t = buildTicks(q.max, q.step);
  assert.ok(t.length >= 5 && t.length <= 250, `${t.length} tacche ${w}`);
  assert.strictEqual(t[0], 0, `la scala non parte da 0 ${w}`);
  assert.strictEqual(t[t.length - 1], q.max, `la scala non arriva a max ${w}`);

  for (let i = 1; i < t.length; i++) {
    assert.ok(Number.isInteger(t[i]), `tacca non intera ${t[i]} ${w}`);
    assert.ok(t[i] > t[i - 1], `tacche non crescenti ${w}`);
    assert.ok(t[i] - t[i - 1] <= q.step, `passo più largo dello step dichiarato ${w}`);
  }

  // Lo step dedicato deve portare una tacca vicino alla risposta.
  const best = t.reduce((a, b) => Math.abs(b - q.a) < Math.abs(a - q.a) ? b : a);
  assert.ok(Math.abs(best - q.a) <= q.step,
    `nessuna tacca vicina alla risposta: migliore ${best} vs ${q.a} ${w}`);
}

console.log(`ok — ${QUESTIONS.length} domande, formattazione e scale verificate`);
