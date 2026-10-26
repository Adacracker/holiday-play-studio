// Brew Bottle Shop: pouring rules, solver and level generator (no graphics; also runs under Node for level checks).
// Level: { s: [flask strings], cap?: [..], fz?: {i: k}, fn?: {i: color}, ing?: [[flask, unit]], cust: [colors], par, sol: [[from, to], ...] }
//   flask string = units bottom -> top, 'a'..'l' = colour 0..11, UPPER CASE = hidden (shown as "?" until it is the top unit)
//   cap: units a flask holds (4, tiny vials hold 2). fz: frozen flask, unusable until k pours were made. fn: funnel, accepts only that colour.
// Rule: pour the top run of one colour onto an empty flask or the same colour, as much as fits. 4 units of one colour in a flask = a finished
// potion: it is corked and leaves the table. Win = every colour corked.
(function (root) {
  const CAP = 4;
  function parse(L) {
    const n = L.s.length, cap = [], fz = [], fn = [], u = [], h = [], g = [];
    for (let i = 0; i < n; i++) {
      cap.push(L.cap ? L.cap[i] : CAP); fz.push(L.fz && L.fz[i] ? L.fz[i] : 0); fn.push(L.fn && L.fn[i] !== undefined ? L.fn[i] : -1);
      const s = L.s[i], uu = [], hh = [], gg = [];
      for (const ch of s) { const lo = ch.toLowerCase(); uu.push(lo.charCodeAt(0) - 97); hh.push(ch !== lo); gg.push(0); }
      u.push(uu); h.push(hh); g.push(gg);
    }
    (L.ing || []).forEach(([fi, ui]) => { if (g[fi] && ui < g[fi].length) g[fi][ui] = 1; });
    let colors = 0; u.forEach(a => a.forEach(c => { colors = Math.max(colors, c + 1); }));
    return { n, cap, fz, fn, colors };
  }
  function newState(L) {
    const P = parse(L), S = { u: [], h: [], g: [], done: [], moves: 0, corked: [], P };
    for (let i = 0; i < L.s.length; i++) {
      const uu = [], hh = [], gg = [];
      for (const ch of L.s[i]) { const lo = ch.toLowerCase(); uu.push(lo.charCodeAt(0) - 97); hh.push(ch !== lo); gg.push(0); }
      S.u.push(uu); S.h.push(hh); S.g.push(gg); S.done.push(false);
    }
    (L.ing || []).forEach(([fi, ui]) => { if (S.g[fi] && ui < S.g[fi].length) S.g[fi][ui] = 1; });
    return S;
  }
  const frozen = (S, i) => S.P.fz[i] > S.moves;
  function runLen(a) { if (!a.length) return 0; const c = a[a.length - 1]; let k = 0; for (let j = a.length - 1; j >= 0 && a[j] === c; j--) k++; return k; }
  // how many units pouring a -> b would move (0 = not allowed)
  function canPour(S, a, b) {
    if (a === b || S.done[a] || S.done[b] || frozen(S, a) || frozen(S, b)) return 0;
    const A = S.u[a], B = S.u[b]; if (!A.length) return 0;
    const c = A[A.length - 1], space = S.P.cap[b] - B.length; if (space <= 0) return 0;
    if (B.length && B[B.length - 1] !== c) return 0;
    if (S.P.fn[b] >= 0 && S.P.fn[b] !== c) return 0;
    return Math.min(runLen(A), space);
  }
  function isDone(S, i) { const a = S.u[i]; return a.length === CAP && S.P.cap[i] === CAP && a.every(c => c === a[0]); }
  // returns { n, c, done: flask index corked or -1, revealed: unit index revealed in a or -1, ing }
  function pour(S, a, b) {
    const n = canPour(S, a, b); if (!n) return null;
    const A = S.u[a], c = A[A.length - 1]; let ing = 0;
    for (let k = 0; k < n; k++) { S.u[b].push(A.pop()); S.h[a].pop(); S.h[b].push(false); const gg = S.g[a].pop(); S.g[b].push(gg); ing += gg; }
    let revealed = -1; const t = A.length - 1; if (t >= 0 && S.h[a][t]) { S.h[a][t] = false; revealed = t; }
    S.moves++;
    let done = -1; if (isDone(S, b)) { S.done[b] = true; S.corked.push(b); done = b; }
    return { n, c, done, revealed, ing };
  }
  const won = S => S.corked.length >= S.P.colors;
  function snapshot(S) { return { u: S.u.map(a => a.slice()), h: S.h.map(a => a.slice()), g: S.g.map(a => a.slice()), done: S.done.slice(), moves: S.moves, corked: S.corked.slice() }; }
  function restore(S, z) { S.u = z.u.map(a => a.slice()); S.h = z.h.map(a => a.slice()); S.g = z.g.map(a => a.slice()); S.done = z.done.slice(); S.moves = z.moves; S.corked = z.corked.slice(); }
  function addFlask(S, cap = CAP) { S.u.push([]); S.h.push([]); S.g.push([]); S.done.push(false); S.P.cap.push(cap); S.P.fz.push(0); S.P.fn.push(-1); S.P.n++; return S.u.length - 1; }
  function anyMove(S) { for (let a = 0; a < S.u.length; a++) for (let b = 0; b < S.u.length; b++) if (canPour(S, a, b)) return true; return false; }

  // ---------- solver: depth-first search with a visited set over canonical states ----------
  // works on a compact copy; returns list of [from, to] (indices of the original flasks) or null.
  function solve(S0, opt = {}) {
    const limit = opt.limit || 400000, rnd = opt.rnd || null;
    const n = S0.u.length, cap = S0.P.cap, fz = S0.P.fz, fn = S0.P.fn;
    const maxFz = Math.max(0, ...fz);
    const u = S0.u.map(a => a.slice()), done = S0.done.slice();
    let moves = S0.moves, nodes = 0; const colors = S0.P.colors; let corked = S0.corked.length;
    const seen = new Set(), path = [];
    const keyOf = () => {
      const parts = [];
      for (let i = 0; i < n; i++) { if (done[i]) continue; const f = fz[i] > moves ? fz[i] - moves : 0; parts.push(cap[i] + '' + f + (fn[i] + 1).toString(16) + ':' + u[i].join(',')); }
      parts.sort(); return (moves < maxFz ? moves : '') + '|' + parts.join('/');
    };
    const can = (a, b) => {
      if (a === b || done[a] || done[b] || fz[a] > moves || fz[b] > moves) return 0;
      const A = u[a], B = u[b]; if (!A.length) return 0; const c = A[A.length - 1], sp = cap[b] - B.length; if (sp <= 0) return 0;
      if (B.length && B[B.length - 1] !== c) return 0; if (fn[b] >= 0 && fn[b] !== c) return 0;
      let k = 0; for (let j = A.length - 1; j >= 0 && A[j] === c; j--) k++; return Math.min(k, sp);
    };
    function dfs() {
      if (corked >= colors) return true;
      if (++nodes > limit) return false;
      const k = keyOf(); if (seen.has(k)) return false; seen.add(k);
      const cand = [];
      const emptyTaken = new Set();
      for (let a = 0; a < n; a++) {
        const A = u[a]; if (!A.length || done[a]) continue;
        const uniform = A.every(c => c === A[0]);
        for (let b = 0; b < n; b++) {
          const m = can(a, b); if (!m) continue;
          const B = u[b];
          if (!B.length) {
            if (uniform && fn[b] < 0 && cap[b] >= cap[a]) continue; // moving a single-colour flask into an empty one changes nothing
            const ek = cap[b] + ':' + fn[b] + ':' + (fz[b] > 0 ? b : 'x'); if (emptyTaken.has(ek + ':' + a)) continue; emptyTaken.add(ek + ':' + a);
          }
          if (uniform && m < A.length && B.length) { /* partial move out of a uniform flask: allowed */ }
          // score: finishing a potion first, then pours that empty a flask / land on same colour, then into empties
          let sc = 0; const after = B.length + m;
          if (after === 4 && cap[b] === 4 && (B.length === 0 ? m === 4 : B.every(c => c === B[0]))) sc += 100;
          if (B.length) sc += 20 + (B.every(c => c === B[0]) ? 10 : 0); else sc -= 10;
          if (m === A.length) sc += 8; else if (A[A.length - 1 - m] !== undefined) sc += 2;
          if (rnd) sc += rnd() * 12;
          cand.push([sc, a, b, m]);
        }
      }
      cand.sort((x, y) => y[0] - x[0]);
      for (const [, a, b, m] of cand) {
        const A = u[a], B = u[b];
        for (let q = 0; q < m; q++) B.push(A.pop());
        moves++; let dn = false; if (B.length === 4 && cap[b] === 4 && B.every(c => c === B[0])) { done[b] = true; corked++; dn = true; }
        path.push([a, b]);
        if (dfs()) return true;
        path.pop(); if (dn) { done[b] = false; corked--; } moves--;
        for (let q = 0; q < m; q++) A.push(B.pop());
      }
      return false;
    }
    const ok = dfs();
    return ok ? { sol: path.slice(), nodes } : (opt.stats ? { sol: null, nodes } : null);
  }
  // shortest of a few randomized searches
  function solveShort(S0, tries = 6, rng = Math.random, limit = 200000) {
    let best = solve(S0, { limit }); if (!best) return null;
    const nodes = best.nodes;
    for (let t = 0; t < tries; t++) { const r = solve(S0, { limit, rnd: rng }); if (r && r.sol.length < best.sol.length) best = r; }
    return { sol: best.sol, nodes };
  }
  // next move hint for the player's current state
  function hint(S, limit = 120000) { const r = solve(S, { limit }); return r && r.sol.length ? r.sol[0] : null; }

  // ---------- generator ----------
  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // spec: { colors, empty, tiny, frozen: [k...], funnel, hidden (0..1), ing, cust }
  function generate(spec, seed, maxTries = 400) {
    const rng = mulberry(seed);
    let best = null;
    for (let tr = 0; tr < maxTries; tr++) {
      const C = spec.colors, units = [];
      for (let c = 0; c < C; c++) for (let k = 0; k < CAP; k++) units.push(c);
      for (let i = units.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [units[i], units[j]] = [units[j], units[i]]; }
      const fl = []; for (let c = 0; c < C; c++) fl.push(units.slice(c * CAP, c * CAP + CAP));
      // reject boards that start too sorted
      let bad = false;
      for (const f of fl) { if (f.every(c => c === f[0])) bad = true; if (runLen(f) >= 3) bad = true; }
      if (spec.colors > 3) { let pairs = 0; for (const f of fl) for (let k = 1; k < 4; k++) if (f[k] === f[k - 1]) pairs++; if (pairs > Math.ceil(C * 0.5)) bad = true; }
      if (bad) continue;
      const s = fl.map(f => f.map(c => String.fromCharCode(97 + c)).join(''));
      const cap = s.map(() => CAP);
      for (let e = 0; e < spec.empty; e++) { s.push(''); cap.push(CAP); }
      for (let e = 0; e < (spec.tiny || 0); e++) { s.push(''); cap.push(2); }
      const L = { s, cap };
      // frozen flasks: full flasks that thaw after k pours
      if (spec.frozen && spec.frozen.length) { L.fz = {}; const idx = [...Array(C).keys()]; spec.frozen.forEach((k, q) => { const j = Math.floor(rng() * idx.length); L.fz[idx.splice(j, 1)[0]] = k; }); }
      // funnel: an empty flask that only accepts one colour
      if (spec.funnel) { L.fn = {}; const ei = C; L.fn[ei] = Math.floor(rng() * C); }
      const S = newState(L), r = solveShort(S, spec.tries ?? 4, rng, spec.limit || 150000);
      if (!r) continue;
      if (r.sol.length < (spec.minMoves || 0)) continue;
      const score = r.nodes + r.sol.length * 3;
      if (!best || (spec.easy ? score < best.score : score > best.score)) best = { L, r, score };
      if (tr >= (spec.pick || 3) - 1 && best) break;
    }
    if (!best) return null;
    const { L, r } = best;
    // hidden layers: never the top unit, never in frozen flasks' top
    if (spec.hidden) {
      L.s = L.s.map((f, i) => f.split('').map((ch, k) => (k < f.length - 1 && rng() < spec.hidden) ? ch.toUpperCase() : ch).join(''));
    }
    if (spec.ing) { L.ing = []; const used = new Set(); for (let q = 0; q < spec.ing; q++) { const fi = Math.floor(rng() * spec.colors); if (used.has(fi)) continue; used.add(fi); L.ing.push([fi, Math.floor(rng() * 4)]); } }
    const cs = [...Array(spec.colors).keys()]; for (let i = cs.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cs[i], cs[j]] = [cs[j], cs[i]]; }
    L.cust = cs.slice(0, Math.min(spec.cust || 0, spec.colors));
    L.par = r.sol.length; L.sol = r.sol; L.nodes = r.nodes;
    return L;
  }
  // difficulty curve: flasks grow from 3 to 14, mechanics arrive over time
  function specFor(n) { // n = 1-based level
    const C = n <= 1 ? 2 : n <= 3 ? 3 : n <= 5 ? 4 : n <= 8 ? 5 : n <= 12 ? 6 : n <= 18 ? 7 : n <= 26 ? 8 : n <= 36 ? 9 : n <= 50 ? 10 : n <= 70 ? 11 : 12;
    const breather = n % 5 === 0 && n > 5, boss = n % 10 === 9 && n > 10;
    const sp = { colors: breather ? Math.max(4, C - 2) : C, empty: n <= 2 ? 1 : 2, tiny: 0, frozen: [], funnel: false, hidden: 0, ing: 0, cust: n <= 1 ? 1 : n <= 6 ? 2 : 3, pick: breather ? 2 : 3 + (boss ? 3 : 0), easy: n <= 3 };
    if (n >= 8) sp.hidden = Math.min(0.4, 0.2 + (n - 8) * 0.003);
    if (n >= 8 && n < 12) sp.hidden = 0.25;
    if (n >= 10) sp.ing = n < 40 ? 1 : 2;
    if (n >= 16 && (n % 4 === 0 || n % 7 === 2)) { sp.tiny = 1; if (n >= 60 && n % 3 === 0) sp.empty = 1; }
    if (n === 16) { sp.tiny = 1; sp.empty = 2; }
    if (n >= 22 && (n % 3 === 1 || n === 22)) sp.frozen = [Math.min(9, 3 + Math.floor(n / 25))];
    if (n >= 50 && n % 6 === 1) sp.frozen.push(Math.min(10, 4 + Math.floor(n / 30)));
    if (n >= 30 && (n % 5 === 3 || n === 30)) sp.funnel = true;
    if (breather) { sp.hidden *= 0.5; sp.frozen = []; sp.tiny = 0; }
    if (n <= 7) sp.hidden = 0;
    while (sp.colors + sp.empty + sp.tiny > 14) sp.colors--;
    sp.minMoves = Math.min(4 + sp.colors * 2, Math.round(sp.colors * 2.2));
    if (n === 1) sp.minMoves = 3;
    return sp;
  }
  const API = { CAP, parse, newState, canPour, pour, won, isDone, snapshot, restore, addFlask, anyMove, runLen, solve, solveShort, hint, generate, specFor, mulberry, frozen };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.BrewLogic = API;
})(typeof window !== 'undefined' ? window : globalThis);
