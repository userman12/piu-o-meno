'use strict';

const $ = s => document.querySelector(s);
const KEY = 'piuomeno.v1';
const ROUND_CHOICES = [5, 10, 15];

/* fmtScale / fmtExact / buildTicks arrivano da scale.js */

/* ---------------- picker a rotella ---------------- */

const scroll = $('#pickerScroll');
const unitEl = $('#picker-unit');
let ticks = [], items = [], curIdx = 0, ITEM_H = 60, painted = [], rafPending = false, trailT;

// ponytail: rende in DOM tutte le tacche (max ~220 nodi), niente virtualizzazione.
// Se in futuro le scale superassero il migliaio di valori, virtualizzare la finestra visibile.
function buildPicker(max, step, unit) {
  ticks = buildTicks(max, step);
  const frag = document.createDocumentFragment();
  items = ticks.map(v => {
    const el = document.createElement('div');
    el.className = 'pick';
    el.textContent = fmtScale(v);
    frag.append(el);
    return el;
  });
  scroll.replaceChildren(frag);
  unitEl.textContent = unit;
  painted = [];
  ITEM_H = items[0].offsetHeight || 60;
  curIdx = -1;
  setIndex(Math.floor(items.length / 2), false, true);
  paint();
}

function paint() {
  const c = scroll.scrollTop / ITEM_H;
  const mid = Math.round(c);
  for (const el of painted) { el.style.transform = ''; el.style.opacity = ''; }
  painted = [];
  for (let i = Math.max(0, mid - 4); i <= Math.min(items.length - 1, mid + 4); i++) {
    const d = Math.abs(i - c);
    items[i].style.transform = `scale(${Math.max(.55, 1 - d * .17)})`;
    items[i].style.opacity = Math.max(.16, 1 - d * .28);
    painted.push(items[i]);
  }
  const idx = Math.min(items.length - 1, Math.max(0, mid));
  if (idx !== curIdx) { curIdx = idx; buzz(); announce(); }
}

function announce() {
  scroll.setAttribute('aria-valuetext', fmtScale(ticks[curIdx]) + ' ' + unitEl.textContent);
}

const buzz = () => { try { navigator.vibrate?.(5); } catch {} };

function setIndex(i, smooth, silent) {
  i = Math.max(0, Math.min(items.length - 1, i));
  if (i !== curIdx) { curIdx = i; if (!silent) buzz(); announce(); }
  scroll.scrollTo({ top: i * ITEM_H, behavior: smooth ? 'smooth' : 'auto' });
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
  show('s-guess');
  buildPicker(q.max, q.step, q.u); // dopo show(): serve il layout per misurare l'altezza
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
