// Convex solid generation (signed distance functions projected onto a cube-sphere grid)
// and real-time plane slicing of triangle soups with capped cross-sections.

const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);

// ---- signed distance functions (same formulas live in the shader for the "depth" lookup)
export function sdfOf(shape) {
  const [bx, by, bz] = shape.b, r = shape.r || 0;
  if (shape.kind === 'box') return (x, y, z) => {
    const qx = Math.abs(x) - (bx - r), qy = Math.abs(y) - (by - r), qz = Math.abs(z) - (bz - r);
    return len3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, Math.max(qy, qz)), 0) - r;
  };
  if (shape.kind === 'cyl') return (x, y, z) => {
    const dx = Math.sqrt(x * x + z * z) - bx + r, dy = Math.abs(y) - by + r, mx = Math.max(dx, 0), my = Math.max(dy, 0);
    return Math.min(Math.max(dx, dy), 0) + Math.sqrt(mx * mx + my * my) - r;
  };
  // ellipsoid (optionally bumpy)
  const bump = shape.bump || 0, seed = shape.seed || 0;
  return (x, y, z) => {
    const k0 = len3(x / bx, y / by, z / bz), k1 = len3(x / (bx * bx), y / (by * by), z / (bz * bz));
    let d = k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(bx, by, bz);
    if (bump) d -= bump * (Math.sin(x * 5.1 + seed) * Math.sin(y * 4.3 + seed * 1.7) * Math.sin(z * 4.7 + seed * 0.6) + 0.5 * Math.sin(x * 11.3 + z * 9.1 + seed));
    return d;
  };
}

// Builds a closed, outward-wound, smooth-shaded triangle soup for a convex shape.
export function buildSolid(shape, N = 14) {
  const sdf = sdfOf(shape), [bx, by, bz] = shape.b, maxR = len3(bx, by, bz) * 1.3;
  const map = u => Math.sin(u * Math.PI / 2); // denser near cube edges -> smoother rounded corners
  const faces = [[0, 1, 2, 1], [0, 1, 2, -1], [1, 2, 0, 1], [1, 2, 0, -1], [2, 0, 1, 1], [2, 0, 1, -1]];
  const P = [], Nn = [];
  const pt = [0, 0, 0];
  function surf(dx, dy, dz, out, o) {
    const l = len3(dx, dy, dz); dx /= l; dy /= l; dz /= l;
    let a = 0, b = maxR;
    for (let i = 0; i < 22; i++) { const m = (a + b) / 2; if (sdf(dx * m, dy * m, dz * m) > 0) b = m; else a = m; }
    const t = (a + b) / 2, x = dx * t, y = dy * t, z = dz * t, e = 0.002;
    let nx = sdf(x + e, y, z) - sdf(x - e, y, z), ny = sdf(x, y + e, z) - sdf(x, y - e, z), nz = sdf(x, y, z + e) - sdf(x, y, z - e);
    const nl = len3(nx, ny, nz) || 1;
    out[o] = x; out[o + 1] = y; out[o + 2] = z; out[o + 3] = nx / nl; out[o + 4] = ny / nl; out[o + 5] = nz / nl;
  }
  const grid = new Float32Array((N + 1) * (N + 1) * 6);
  for (const [ax, au, av, s] of faces) {
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      pt[ax] = s; pt[au] = map(i / N * 2 - 1); pt[av] = map(j / N * 2 - 1);
      surf(pt[0] * bx, pt[1] * by, pt[2] * bz, grid, (j * (N + 1) + i) * 6);
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1;
      tri(a, b, d); tri(a, d, c);
    }
  }
  function tri(a, b, c) {
    const A = a * 6, B = b * 6, C = c * 6, g = grid;
    const ux = g[B] - g[A], uy = g[B + 1] - g[A + 1], uz = g[B + 2] - g[A + 2], vx = g[C] - g[A], vy = g[C + 1] - g[A + 1], vz = g[C + 2] - g[A + 2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    if (len3(cx, cy, cz) < 1e-10) return;
    const flip = cx * (g[A + 3] + g[B + 3] + g[C + 3]) + cy * (g[A + 4] + g[B + 4] + g[C + 4]) + cz * (g[A + 5] + g[B + 5] + g[C + 5]) < 0;
    const order = flip ? [A, C, B] : [A, B, C];
    for (const o of order) { P.push(g[o], g[o + 1], g[o + 2]); Nn.push(g[o + 3], g[o + 4], g[o + 5]); }
  }
  return { pos: new Float32Array(P), nor: new Float32Array(Nn), cap: new Float32Array(P.length / 3) };
}

export function volumeOf(d) {
  const p = d.pos; let v = 0;
  for (let i = 0; i < p.length; i += 9) {
    const ax = p[i], ay = p[i + 1], az = p[i + 2], bx = p[i + 3], by = p[i + 4], bz = p[i + 5], cx = p[i + 6], cy = p[i + 7], cz = p[i + 8];
    v += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return v / 6;
}

// range of signed distances of the vertices to the plane n.x = d
export function planeRange(d, nx, ny, nz, dd) {
  const p = d.pos; let mn = 1e9, mx = -1e9;
  for (let i = 0; i < p.length; i += 3) { const s = p[i] * nx + p[i + 1] * ny + p[i + 2] * nz - dd; if (s < mn) mn = s; if (s > mx) mx = s; }
  return [mn, mx];
}

// Slices a solid by the plane n.x = dd. Returns { front (s>0), back (s<0) } or null when the plane misses.
// New faces get cap = capTime so the shader can show the cross-section texture (and a fresh-cut glow).
export function slice(d, nx, ny, nz, dd, capTime, minPart = 0.025) {
  const [mn, mx] = planeRange(d, nx, ny, nz, dd);
  if (mx < minPart || mn > -minPart) return null;
  const p = d.pos, q = d.nor, c = d.cap, nT = p.length / 9;
  const cap = nT * 2 + 512;
  const mkT = () => ({ p: new Float32Array(cap * 9), n: new Float32Array(cap * 9), c: new Float32Array(cap * 3), k: 0 });
  const F = mkT(), B = mkT(), cut = [];
  const EPS = 1e-7, V = [new Float32Array(7), new Float32Array(7), new Float32Array(7)], sd = [0, 0, 0];
  const polyF = [], polyB = [];
  function copyTri(T, i, t) {
    const o = T.k * 9; T.p.set(p.subarray(i, i + 9), o); T.n.set(q.subarray(i, i + 9), o); T.c[T.k * 3] = c[t]; T.c[T.k * 3 + 1] = c[t + 1]; T.c[T.k * 3 + 2] = c[t + 2]; T.k++;
  }
  function putV(T, v, slot) { const o = T.k * 9 + slot * 3; T.p[o] = v[0]; T.p[o + 1] = v[1]; T.p[o + 2] = v[2]; T.n[o] = v[3]; T.n[o + 1] = v[4]; T.n[o + 2] = v[5]; T.c[T.k * 3 + slot] = v[6]; }
  function emitPoly(T, poly) { for (let k = 1; k + 1 < poly.length; k++) { putV(T, poly[0], 0); putV(T, poly[k], 1); putV(T, poly[k + 1], 2); T.k++; } }
  function lerpV(a, b, t) {
    const n0 = a[3] + (b[3] - a[3]) * t, n1 = a[4] + (b[4] - a[4]) * t, n2 = a[5] + (b[5] - a[5]) * t, l = len3(n0, n1, n2) || 1;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, n0 / l, n1 / l, n2 / l, a[6] === b[6] ? a[6] : (a[6] > 0 && b[6] > 0 ? a[6] : 0)];
  }
  for (let i = 0, t = 0; i < p.length; i += 9, t += 3) {
    let pos = 0, neg = 0;
    for (let k = 0; k < 3; k++) {
      const o = i + k * 3;
      let s = p[o] * nx + p[o + 1] * ny + p[o + 2] * nz - dd; if (s < EPS && s > -EPS) s = 0; sd[k] = s;
      if (s > 0) pos++; else if (s < 0) neg++; else cut.push(p[o], p[o + 1], p[o + 2]);
    }
    if (!neg) { copyTri(F, i, t); continue; }
    if (!pos) { copyTri(B, i, t); continue; }
    for (let k = 0; k < 3; k++) { const o = i + k * 3, v = V[k]; v[0] = p[o]; v[1] = p[o + 1]; v[2] = p[o + 2]; v[3] = q[o]; v[4] = q[o + 1]; v[5] = q[o + 2]; v[6] = c[t + k]; }
    polyF.length = 0; polyB.length = 0;
    for (let k = 0; k < 3; k++) {
      const a = V[k], b = V[(k + 1) % 3], sa = sd[k], sb = sd[(k + 1) % 3];
      if (sa >= 0) polyF.push(a); if (sa <= 0) polyB.push(a);
      if ((sa > 0 && sb < 0) || (sa < 0 && sb > 0)) {
        const m = lerpV(a, b, sa / (sa - sb)); polyF.push(m); polyB.push(m); cut.push(m[0], m[1], m[2]);
      }
    }
    if (polyF.length >= 3) emitPoly(F, polyF);
    if (polyB.length >= 3) emitPoly(B, polyB);
  }
  // cap polygon: convex hull of the cut points in plane coordinates
  let ux, uy, uz; if (Math.abs(ny) < 0.9) { ux = nz; uy = 0; uz = -nx; } else { ux = 0; uy = -nz; uz = ny; }
  const ul = len3(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
  const vx = ny * uz - nz * uy, vy = nz * ux - nx * uz, vz = nx * uy - ny * ux;
  const pts = [];
  for (let i = 0; i < cut.length; i += 3) pts.push([cut[i] * ux + cut[i + 1] * uy + cut[i + 2] * uz, cut[i] * vx + cut[i + 1] * vy + cut[i + 2] * vz]);
  const hull = convexHull(pts);
  if (hull.length >= 3 && hull.length < 500) {
    let cx = 0, cy = 0; for (const h of hull) { cx += h[0]; cy += h[1]; } cx /= hull.length; cy /= hull.length;
    const to3 = (a, b) => [nx * dd + ux * a + vx * b, ny * dd + uy * a + vy * b, nz * dd + uz * a + vz * b, 0, 0, 0, capTime];
    const C = to3(cx, cy);
    for (let k = 0; k < hull.length; k++) {
      const A = to3(hull[k][0], hull[k][1]), Bp = to3(hull[(k + 1) % hull.length][0], hull[(k + 1) % hull.length][1]);
      // hull is counter-clockwise in (u,v) and u x v = n, so CCW faces +n: that is the back piece's outside
      C[3] = A[3] = Bp[3] = nx; C[4] = A[4] = Bp[4] = ny; C[5] = A[5] = Bp[5] = nz; emitPoly(B, [C, A, Bp]);
      C[3] = A[3] = Bp[3] = -nx; C[4] = A[4] = Bp[4] = -ny; C[5] = A[5] = Bp[5] = -nz; emitPoly(F, [C, Bp, A]);
    }
  }
  const fin = T => ({ pos: T.p.slice(0, T.k * 9), nor: T.n.slice(0, T.k * 9), cap: T.c.slice(0, T.k * 3) });
  return { front: fin(F), back: fin(B) };
}

function convexHull(pts) {
  if (pts.length < 3) return pts;
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const u = []; for (const p of pts) { if (u.length && Math.abs(u[u.length - 1][0] - p[0]) < 1e-6 && Math.abs(u[u.length - 1][1] - p[1]) < 1e-6) continue; u.push(p); }
  if (u.length < 3) return u;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const p of u) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 1e-9) lo.pop(); lo.push(p); }
  for (let i = u.length - 1; i >= 0; i--) { const p = u[i]; while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 1e-9) hi.pop(); hi.push(p); }
  lo.pop(); hi.pop(); return lo.concat(hi);
}

// 2D convex hull helper for footprints (exported for the game)
export function hull2(pts) { return convexHull(pts.map(p => [p[0], p[1]])); }
