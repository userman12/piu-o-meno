// Calcola uno step (incremento) dedicato per ogni domanda e lo inserisce nel
// campo `max: N,` -> `max: N, step: S,` di questions.js. Eseguito una tantum:
// il risultato viene salvato nei dati, non ricalcolato a runtime.
import { readFileSync, writeFileSync } from 'fs';

function pickStep(max, target = 100) {
  const topK = Math.ceil(Math.log10(max));
  let best = 1, bestDiff = Infinity;
  for (let k = 0; k <= topK; k++) {
    for (const m of [1, 2, 5]) {
      const step = m * 10 ** k;
      if (step > max) continue;
      const diff = Math.abs(max / step - target);
      if (diff < bestDiff) { bestDiff = diff; best = step; }
    }
  }
  return best;
}

const path = new URL('../questions.js', import.meta.url);
const src = readFileSync(path, 'utf8');

// Solo dove manca: `(?!\s*step:)` rende lo script idempotente, così si può
// rilanciare dopo aver aggiunto nuove domande senza toccare quelle esistenti.
const out = src.replace(/max:\s*(\d+),(?!\s*step:)/g,
  (m, maxStr) => `max: ${maxStr}, step: ${pickStep(Number(maxStr))},`);

writeFileSync(path, out);
console.log('fatto');
