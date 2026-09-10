'use strict';

/* Numeri leggibili e generazione della scala. Nessuna dipendenza dal DOM. */

// useGrouping 'always': altrimenti it-IT scrive "3000" invece di "3.000".
const nf = (n, d = 0) =>
  new Intl.NumberFormat('it-IT', { maximumFractionDigits: d, useGrouping: 'always' }).format(n);

// Abbreviato e leggibile: "8,2 miliardi", "450 milioni", "42 mila".
function fmtScale(n) {
  if (n >= 1e9) { const v = n / 1e9; return nf(v, 2) + (v === 1 ? ' miliardo' : ' miliardi'); }
  if (n >= 1e6) { const v = n / 1e6; return nf(v, 2) + (v === 1 ? ' milione' : ' milioni'); }
  if (n >= 1e4) return nf(n / 1e3, 1) + ' mila';
  return nf(n);
}

// La risposta esatta e gli scarti: cifre intere finché restano leggibili.
const fmtExact = n => n < 1e7 ? nf(n) : fmtScale(n);

// `step` è dedicato a ogni domanda (campo `step` in questions.js, generato una
// tantum da tools/compute_steps.mjs): nessuna deduzione a runtime, solo la
// scala 0..max a incrementi costanti.
function buildTicks(max, step) {
  const out = [0];
  let v = 0;
  while (v < max) { v = Math.min(v + step, max); out.push(v); }
  return out;
}

if (typeof module !== 'undefined') module.exports = { fmtScale, fmtExact, buildTicks };
