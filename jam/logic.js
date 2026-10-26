// Honk Out: parking-lot rules and solver (no graphics; also runs under Node for level checks).
// Level: { w, h, map: [rows], v: [vehicles], road: side|-1 }
//   map chars: '.' asphalt  '#' planter (nobody drives through)  '^' '>' 'v' '<' painted one-way arrow
//   vehicle: { x, z, d, l, key?, lock?, light?, ph? }  (x, z) = front cell, d = facing (0 up, 1 right, 2 down, 3 left), l = length in cells
//   key: colour id carried by this car; lock: colour id, the car cannot leave until the car with that key has left
//   light: the car only leaves on green (real time, does not change the solution); road: lot side with passing traffic (real time)
// Rule: tap a vehicle and it drives forward along its lane. Arrows turn it; driving against an arrow is not allowed.
// If every cell to the lot edge is free it leaves the lot; otherwise it bumps the first vehicle in its way and stays.
// Leaving never makes another vehicle worse off, so a greedy peel is a complete solver.
(function (root) {
  const DX = [0, 1, 0, -1], DZ = [-1, 0, 1, 0], AR = { '^': 0, '>': 1, 'v': 2, '<': 3 };
  function cellsOf(w, x, z, d, l) { const c = []; for (let k = 0; k < l; k++) c.push((z - DZ[d] * k) * w + (x - DX[d] * k)); return c; }
  // Route from the front cell to the lot edge. ok = false if it hits a planter, its own body, drives against an arrow or loops.
  function route(L, x, z, d, own) {
    const cells = [], dirs = [], seen = new Set();
    for (let s = 0; s < 500; s++) {
      const nx = x + DX[d], nz = z + DZ[d];
      if (nx < 0 || nz < 0 || nx >= L.w || nz >= L.h) return { ok: true, cells, dirs, side: d, ex: x, ez: z };
      const k = nz * L.w + nx;
      if (L.block[k] || (own && own.indexOf(k) >= 0)) return { ok: false, cells, dirs };
      const a = L.arrow[k];
      if (a >= 0 && a === (d + 2) % 4) return { ok: false, cells, dirs };
      cells.push(k); x = nx; z = nz; if (a >= 0) d = a; dirs.push(d);
      const sk = k * 4 + d; if (seen.has(sk)) return { ok: false, cells, dirs }; seen.add(sk);
    }
    return { ok: false, cells, dirs };
  }
  function parse(lv) {
    const w = lv.w, h = lv.h, n = w * h, block = new Uint8Array(n), arrow = new Int8Array(n).fill(-1);
    for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) { const c = lv.map[z][x], k = z * w + x; if (c === '#') block[k] = 1; else if (c in AR) arrow[k] = AR[c]; }
    const L = { w, h, block, arrow, road: lv.road == null ? -1 : lv.road };
    L.veh = lv.v.map((o, i) => ({ i, x: o.x, z: o.z, d: o.d, l: o.l, cells: cellsOf(w, o.x, o.z, o.d, o.l), key: o.key == null ? -1 : o.key, lock: o.lock == null ? -1 : o.lock, light: !!o.light, ph: o.ph || 0 }));
    L.veh.forEach(v => { v.route = route(L, v.x, v.z, v.d, v.cells); v.keyCar = v.lock >= 0 ? L.veh.findIndex(u => u.key === v.lock) : -1; });
    return L;
  }
  function newState(L) { const occ = new Int16Array(L.w * L.h).fill(-1); L.veh.forEach(v => v.cells.forEach(k => { occ[k] = v.i; })); return { occ, gone: new Uint8Array(L.veh.length), left: L.veh.length }; }
  // What stops vehicle i right now: null (free), { type: 'lock', by }, { type: 'car', by, at } (at = index in route), { type: 'wall' }
  function blocker(L, s, i) {
    const v = L.veh[i]; if (!v.route.ok) return { type: 'wall' };
    if (v.keyCar >= 0 && !s.gone[v.keyCar]) return { type: 'lock', by: v.keyCar };
    const c = v.route.cells; for (let j = 0; j < c.length; j++) { const o = s.occ[c[j]]; if (o >= 0 && o !== i) return { type: 'car', by: o, at: j }; }
    return null;
  }
  function leave(L, s, i) { s.gone[i] = 1; s.left--; L.veh[i].cells.forEach(k => { if (s.occ[k] === i) s.occ[k] = -1; }); }
  function unleave(L, s, i) { s.gone[i] = 0; s.left++; L.veh[i].cells.forEach(k => { s.occ[k] = i; }); }
  // Apply one tap. Returns { ok: true } when the vehicle leaves, or { ok: false, b } with the blocker.
  function tap(L, s, i) { if (s.gone[i]) return { ok: false, b: { type: 'gone' } }; const b = blocker(L, s, i); if (b) return { ok: false, b }; leave(L, s, i); return { ok: true }; }
  function free(L, s) { const f = []; for (let i = 0; i < L.veh.length; i++) if (!s.gone[i] && !blocker(L, s, i)) f.push(i); return f; }
  // Greedy peel. Returns the removal order (a shortest solution: one tap per vehicle) or null.
  function solve(L, s0) {
    const s = s0 ? { occ: s0.occ.slice(), gone: s0.gone.slice(), left: s0.left } : newState(L), order = [];
    for (;;) { const f = free(L, s); if (!f.length) break; for (const i of f) if (!blocker(L, s, i)) { leave(L, s, i); order.push(i); } }
    return s.left === 0 ? order : null;
  }
  // Peel layers (all free vehicles leave at once): depth of the puzzle.
  function layers(L) {
    const s = newState(L), out = [];
    for (;;) { const f = free(L, s); if (!f.length) break; out.push(f); f.forEach(i => leave(L, s, i)); }
    return { layers: out, solved: s.left === 0 };
  }
  // Best hint: a free vehicle whose departure frees the most others (ties: the one others wait on the most).
  function hint(L, s) {
    const f = free(L, s); if (!f.length) return -1; let best = f[0], bs = -1;
    for (const i of f) { leave(L, s, i); const n = free(L, s).length; unleave(L, s, i); const sc = n * 10 + L.veh[i].l; if (sc > bs) { bs = sc; best = i; } }
    return best;
  }
  const API = { DX, DZ, AR, parse, route, cellsOf, newState, blocker, tap, leave, unleave, free, solve, layers, hint };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.JamLogic = API;
})(typeof window !== 'undefined' ? window : globalThis);
