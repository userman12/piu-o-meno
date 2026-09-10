'use strict';

const $ = s => document.querySelector(s);
const KEY = 'piuomeno.v1';
const ROUND_CHOICES = [5, 10, 15];

/* fmtScale / fmtExact / buildTicks arrivano da scale.js */

/* ---------------- gauge: scala a livello che si riempie ---------------- */

const scroll = $('#pickerScroll');
const unitEl = $('#gauge-unit');
const valueEl = $('#gauge-value');
const fillEl = $('#gaugeFill');
const ITEM_H = 56; // altezza di ogni tacca invisibile: solo per lo scroll-snap, nessun rendering
let ticks = [], itemCount = 0, curIdx = 0, rafPending = false, trailT;

function buildPicker(max, step, unit) {
  ticks = buildTicks(max, step);
  itemCount = ticks.length;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < itemCount; i++) {
    const el = document.createElement('div');
    el.className = 'gauge-tick-spacer';
    frag.append(el);
  }
  scroll.replaceChildren(frag);
  unitEl.textContent = unit;
  curIdx = -1;
  setIndex(Math.floor(itemCount / 2), false, true);
  paint();
}

// Testo lungo ("780 miliardi") non deve uscire dalla card: il font si restringe coi caratteri.
function setValueText(text) {
  valueEl.textContent = text;
  valueEl.style.fontSize = text.length <= 3 ? '' /* usa il clamp() di default */
    : `clamp(24px, ${Math.max(6, 15 - text.length * 0.55)}vw, 60px)`;
}

function paint() {
  const maxScroll = (itemCount - 1) * ITEM_H;
  const frac = maxScroll > 0 ? Math.min(1, Math.max(0, scroll.scrollTop / maxScroll)) : 0;
  fillEl.style.height = (frac * 100) + '%';

  const idx = Math.min(itemCount - 1, Math.max(0, Math.round(scroll.scrollTop / ITEM_H)));
  if (idx !== curIdx) {
    curIdx = idx;
    setValueText(fmtScale(ticks[curIdx]));
    buzz();
    announce();
  }
}

function announce() {
  scroll.setAttribute('aria-valuetext', fmtScale(ticks[curIdx]) + ' ' + unitEl.textContent);
}

const buzz = () => { try { navigator.vibrate?.(5); } catch {} };

function setIndex(i, smooth, silent) {
  i = Math.max(0, Math.min(itemCount - 1, i));
  if (i !== curIdx) {
    curIdx = i;
    setValueText(fmtScale(ticks[curIdx]));
    if (!silent) buzz();
    announce();
  }
  scroll.scrollTo({ top: i * ITEM_H, behavior: smooth ? 'smooth' : 'auto' });
  if (silent) paint(); // aggiorna subito il riempimento, senza aspettare l'evento scroll
}

scroll.addEventListener('scroll', () => {
  clearTimeout(trailT);
  trailT = setTimeout(paint, 130); // recupera l'ultimo frame perso dal throttle
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => { rafPending = false; paint(); });
}, { passive: true });

function holdBtn(btn, dir) {
  let delay, rep, n;
  const stop = () => { clearTimeout(delay); clearInterval(rep); };
  btn.addEventListener('pointerdown', e => {
    e.preventDefault();
    n = 0;
    setIndex(curIdx + dir, true);
    delay = setTimeout(() => {
      rep = setInterval(() => {
        n++;
        setIndex(curIdx + dir * (n < 6 ? 1 : n < 16 ? 3 : 8), false);
      }, 70);
    }, 380);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => btn.addEventListener(ev, stop));
}
holdBtn($('#step-minus'), -1);
holdBtn($('#step-plus'), 1);

/* ---------------- stato partita ---------------- */

let S = null;

const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !s.deck || s.v !== 1) return null;
    // Se l'app era stata chiusa a metà stima, si riparte dal passaggio del telefono.
    if (s.phase === 'guess') s.phase = 'pass';
    return s;
  } catch { return null; }
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const newDeck = rounds => shuffle([...QUESTIONS.keys()]).slice(0, rounds);

function startGame(names, rounds) {
  const deck = newDeck(rounds);
  S = { v: 1, names, rounds: deck.length, deck, i: 0, scores: [0, 0], guesses: [null, null], turn: 0, phase: 'pass' };
  save();
  render();
}

const curQ = () => QUESTIONS[S.deck[S.i]];

/* ---------------- schermate ---------------- */

const show = id => {
  document.querySelectorAll('.screen').forEach(el => el.classList.toggle('active', el.id === id));
};

function render() {
  if (S.phase === 'pass') return renderPass();
  if (S.phase === 'guess') return renderGuess();
  if (S.phase === 'reveal') return renderReveal();
  return renderEnd();
}

function renderPass() {
  const t = S.turn;
  const el = $('#s-pass');
  el.classList.toggle('t0', t === 0);
  el.classList.toggle('t1', t === 1);
  $('#pass-name').textContent = S.names[t];
  $('#pass-hint').textContent = t === 0
    ? `Round ${S.i + 1} di ${S.rounds} · nessuno sbirci!`
    : `${S.names[0]} ha già risposto. Ora tocca a te, senza guardare.`;
  show('s-pass');
}

function renderGuess() {
  const q = curQ();
  $('#guess-round').textContent = `Round ${S.i + 1}/${S.rounds}`;
  $('#guess-cat').textContent = q.c;
  $('#guess-who').innerHTML = `Tocca a <b>${esc(S.names[S.turn])}</b>`;
  $('#guess-q').textContent = q.q;
  $('#s-guess').classList.toggle('turn0', S.turn === 0);
  $('#s-guess').classList.toggle('turn1', S.turn === 1);
  show('s-guess');
  buildPicker(q.max, q.step, q.u);
}

function renderReveal() {
  const q = curQ();
  const [g0, g1] = S.guesses;
  const d = [Math.abs(g0 - q.a), Math.abs(g1 - q.a)];
  const win = d[0] < d[1] ? 0 : d[1] < d[0] ? 1 : 2;

  $('#reveal-round').textContent = `Round ${S.i + 1}/${S.rounds}`;
  $('#reveal-q').textContent = q.q;
  $('#answer-value').textContent = fmtExact(q.a);
  $('#answer-unit').textContent = q.u;

  $('#results').replaceChildren(...[0, 1].map(t => {
    const el = document.createElement('div');
    el.className = `res p${t + 1}` + (win === t || win === 2 ? ' win' : '');
    el.innerHTML =
      `<span class="res-name">${esc(S.names[t])}</span>` +
      `<span class="res-tag">${win === t || win === 2 ? '+1 punto' : ''}</span>` +
      `<span class="res-guess">${fmtScale(S.guesses[t])}</span>` +
      `<span class="res-diff">scarto ${fmtExact(d[t])}</span>`;
    return el;
  }));

  $('#scoreline').textContent =
    `${S.names[0]} ${S.scores[0]} — ${S.scores[1]} ${S.names[1]}`;
  $('#btn-next').textContent = S.i + 1 >= S.rounds ? 'Vedi il vincitore' : 'Prossimo round';
  show('s-reveal');
}

function renderEnd() {
  const [a, b] = S.scores;
  const tie = a === b;
  $('#end-emoji').textContent = tie ? '🤝' : '🏆';
  $('#end-kicker').textContent = tie ? 'Finisce in' : 'Vince';
  $('#end-name').textContent = tie ? 'parità!' : S.names[a > b ? 0 : 1];
  $('#final-score').replaceChildren(...[0, 1].map(t => {
    const el = document.createElement('div');
    el.className = `fs p${t + 1}`;
    el.innerHTML = `<span class="fs-name">${esc(S.names[t])}</span><span class="fs-pts">${S.scores[t]}</span>`;
    return el;
  }));
  show('s-end');
}

const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------------- transizioni ---------------- */

$('#btn-pass-ok').onclick = () => { S.phase = 'guess'; save(); render(); };

$('#btn-confirm').onclick = () => {
  S.guesses[S.turn] = ticks[curIdx];
  if (S.turn === 0) {
    S.turn = 1;
    S.phase = 'pass';
  } else {
    const a = curQ().a;
    const d0 = Math.abs(S.guesses[0] - a), d1 = Math.abs(S.guesses[1] - a);
    if (d0 <= d1) S.scores[0]++;
    if (d1 <= d0) S.scores[1]++;
    S.phase = 'reveal';
  }
  save();
  render();
};

$('#btn-next').onclick = () => {
  S.i++;
  S.guesses = [null, null];
  S.turn = 0;
  S.phase = S.i >= S.rounds ? 'end' : 'pass';
  save();
  render();
};

$('#btn-rematch').onclick = () => startGame(S.names, S.rounds);
$('#btn-home').onclick = () => show('s-home');

/* ---------------- home e setup ---------------- */

let pickedRounds = 10;

ROUND_CHOICES.forEach(n => {
  const b = document.createElement('button');
  b.className = 'chip' + (n === pickedRounds ? ' on' : '');
  b.textContent = n;
  b.onclick = () => {
    pickedRounds = n;
    $('#rounds').querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === b));
  };
  $('#rounds').append(b);
});

$('#btn-new').onclick = () => {
  const prev = load();
  if (prev) { $('#name1').value = prev.names[0]; $('#name2').value = prev.names[1]; }
  show('s-setup');
};

$('#btn-resume').onclick = () => { S = load(); if (S) render(); };

$('#btn-start').onclick = () => {
  const n1 = $('#name1').value.trim() || 'Giocatore 1';
  const n2 = $('#name2').value.trim() || 'Giocatore 2';
  startGame([n1, n2 === n1 ? n2 + ' 2' : n2], pickedRounds);
};

document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => show(b.dataset.back));

$('#btn-help').onclick = () => $('#help').showModal();
$('#help-close').onclick = () => $('#help').close();

/* ---------------- avvio ---------------- */

const saved = load();
if (saved && saved.phase !== 'end') $('#btn-resume').classList.remove('hidden');
show('s-home');

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
