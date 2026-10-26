// One ShaderMaterial for every sliceable holiday treat. The colour of any point is a SOLID (3D) texture,
// so every cut, at any angle, shows a correct cross-section: cake layers, yule-log spirals, stollen fruit...
// Materials: 0 gingerbread, 1 chocolate (bark / fudge / truffle), 2 cranberry jelly, 3 layer cake,
//            4 rolls (yule log / stollen / candy cane), 5 peppermint taffy, 6 cocoa bomb.
// The brand logo can be iced on the top face (uLogoOn) - it lives in object space, so it is sliced with the treat.
import * as THREE from 'three';

const VERT = /* glsl */`
attribute float cap;
uniform float uTime, uWob;
uniform vec3 uB;
varying vec3 vP, vW, vWN;
varying float vCap;
void main() {
  vec3 p = position;
  if (uWob > 0.001) {
    float h = clamp((p.y + uB.y) / (2.0 * uB.y), 0.0, 1.0);
    p.x += uWob * sin(uTime * 19.0 + p.y * 3.0) * h * 0.16;
    p.z += uWob * cos(uTime * 16.0 + p.y * 2.5) * h * 0.11;
    p.y *= 1.0 - uWob * 0.07 * sin(uTime * 19.0 + 1.3);
  }
  vP = position; vCap = cap;
  vec4 wp = modelMatrix * vec4(p, 1.0); vW = wp.xyz;
  vWN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FRAG = /* glsl */`
precision highp float;
uniform float uTime, uSeed, uGold, uCrack, uFade;
uniform int uMat, uVar, uShape;
uniform vec3 uB, uC1, uC2, uC3, uC4, uLight;
uniform float uR;
uniform vec4 uG[4];
uniform vec4 uGA;     // guide visibility (alpha) per guide
uniform vec4 uTgt;    // hammer target xyz + alpha
uniform sampler2D uLogo;
uniform float uLogoOn, uLogoR;
uniform vec3 uLogoRing;
varying vec3 vP, vW, vWN;
varying float vCap;

float h31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
// cellular noise: x = F1, y = cell hash, z = F2
vec3 vor(vec3 p) {
  vec3 i = floor(p), f = fract(p); float d1 = 9.0, d2 = 9.0, id = 0.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z)), c = i + g;
    vec3 o = vec3(h31(c), h31(c + 17.3), h31(c + 41.9));
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; id = h31(c + 7.7); } else if (d < d2) d2 = d;
  }
  return vec3(d1, id, d2);
}
float sdf(vec3 p) {
  if (uShape == 0) { vec3 q = abs(p) - (uB - uR); return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - uR; }
  if (uShape == 1) { vec2 d = vec2(length(p.xz) - uB.x + uR, abs(p.y) - uB.y + uR); return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - uR; }
  float k0 = length(p / uB), k1 = length(p / (uB * uB)); return k0 * (k0 - 1.0) / max(k1, 1e-5);
}
vec3 band3(float y, vec3 a, vec3 b, vec3 c) { // three soft layers along 0..1
  vec3 col = mix(a, b, smoothstep(0.325, 0.345, y)); return mix(col, c, smoothstep(0.655, 0.675, y));
}
float sdCap2(vec2 p, vec2 a, vec2 b, float r) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
// gingerbread man silhouette (top view, -y = away from camera = up on screen)
float sdMan(vec2 q) {
  float d = length(q - vec2(0.0, -0.2)) - 0.12;
  d = min(d, sdCap2(q, vec2(0.0, -0.08), vec2(0.0, 0.1), 0.115));
  d = min(d, sdCap2(q, vec2(-0.25, -0.03), vec2(0.25, -0.03), 0.06));
  d = min(d, sdCap2(q, vec2(0.0, 0.12), vec2(-0.15, 0.31), 0.065));
  d = min(d, sdCap2(q, vec2(0.0, 0.12), vec2(0.15, 0.31), 0.065));
  return d;
}

void main() {
  vec3 p = vP;
  bool isCap = vCap > 0.0;
  float dep = -sdf(p);
  float yN = (p.y + uB.y) / (2.0 * uB.y);
  vec3 col = uC1; float gloss = 0.4, spec = 0.3, jelly = 0.0, rough = 0.0;
  float spark = 0.0;
  bool topFace = !isCap && p.y > uB.y - 0.03;

  if (uMat == 0) { // ---------------- GINGERBREAD
    col = uC1 * (0.86 + 0.24 * fbm(p * 6.0 + uSeed));
    col *= 1.0 - 0.2 * step(0.85, h31(floor(p * 70.0)));                 // spice specks
    if (isCap) {
      col = uC1 * 1.2 * (0.86 + 0.22 * fbm(p * 14.0 + uSeed));
      vec3 v = vor(p * 16.0); col *= 1.0 - 0.28 * smoothstep(0.13, 0.0, v.x) * step(v.y, 0.5);   // crumb pores
      col = mix(uC1 * 0.62, col, smoothstep(0.0, 0.07, dep));                                  // baked crust
      if (p.y > uB.y - 0.035) col = uC2;                                                         // icing layer seen in the cut
      gloss = 0.12; spec = 0.05;
    } else { gloss = 0.32; spec = 0.16; rough = 0.35; }
    if (topFace) {
      vec2 q = p.xz; float ic = 0.0, dot_ = 0.0;
      vec2 hb = uB.xz - 0.13; vec2 d2 = abs(q) - hb; float rr = length(max(d2, 0.0)) + min(max(d2.x, d2.y), 0.0) - 0.03;
      ic = smoothstep(0.024, 0.012, abs(rr + 0.012 * sin((q.x + q.y) * 60.0)));                  // piped border
      if (uVar == 0) {
        vec2 mq = q / min(1.25, uB.z * 1.6);
        float m = sdMan(mq); ic = max(ic, smoothstep(0.022, 0.01, abs(m)));
        dot_ = max(smoothstep(0.03, 0.02, length(mq - vec2(-0.045, -0.22))), smoothstep(0.03, 0.02, length(mq - vec2(0.045, -0.22))));
        dot_ = max(dot_, smoothstep(0.035, 0.025, min(length(mq - vec2(0.0, -0.04)), length(mq - vec2(0.0, 0.06)))));
        ic = max(ic, smoothstep(0.016, 0.008, abs(length(mq - vec2(0.0, -0.17)) - 0.06)) * step(-0.17, mq.y));  // smile
      } else if (uVar == 2) {
        float zz = abs(fract(q.x * 2.6 + 0.12 * sin(q.y * 26.0) + uSeed) - 0.5);
        ic = max(ic, smoothstep(0.07, 0.045, zz) * step(rr, -0.06));
        vec3 v = vor(vec3(q * 7.0, uSeed)); dot_ = smoothstep(0.16, 0.1, v.x) * step(v.y, 0.3) * step(rr, -0.06);
      }
      col = mix(col, uC2 * (0.97 + 0.04 * vn(p * 40.0)), ic);
      col = mix(col, uC3, dot_);
      if (ic + dot_ > 0.5) { gloss = 0.7; spec = 0.45; rough = 0.0; }
    }
  } else if (uMat == 1) { // ---------------- CHOCOLATE
    if (uVar == 0) { // peppermint bark: dark base, white top with crushed candy
      float y2 = yN + 0.04 * sin(p.x * 5.0 + p.z * 3.0 + uSeed);
      if (y2 < 0.5) { col = uC1 * (0.92 + 0.08 * vn(p * 24.0)); gloss = 0.85; spec = 0.6; }
      else {
        col = uC2 * (0.95 + 0.05 * vn(p * 20.0)); gloss = 0.5; spec = 0.3;
        vec3 v = vor(p * 9.0 + uSeed); if (v.x < 0.22 && v.y < 0.4) { col = v.y < 0.24 ? uC3 : uC4; gloss = 0.95; spec = 0.85; }
      }
      col *= 1.0 - 0.3 * smoothstep(0.025, 0.0, abs(y2 - 0.5));
      if (isCap) { gloss *= 0.6; spec *= 0.5; }
    } else if (!isCap || dep < 0.075 + 0.01 * vn(p * 20.0)) {
      col = uC1 * (0.92 + 0.08 * vn(p * 24.0)); gloss = 0.85; spec = 0.65;
      if (uShape == 0 && !isCap) { vec2 g = abs(fract(p.xz / 0.52 + 0.5) - 0.5); float gr = smoothstep(0.43, 0.49, max(g.x, g.y)); col *= 1.0 - 0.38 * gr * step(uB.y - 0.06, p.y); }
      if (uShape == 2 && !isCap) { float dl = abs(fract(p.y * 3.4 + 0.15 * sin(p.x * 10.0 + p.z * 8.0 + uSeed)) - 0.5); col = mix(col, uC4, smoothstep(0.08, 0.05, dl) * step(0.0, p.y)); }
      if (isCap) { gloss = 0.4; spec = 0.25; }
    } else if (uVar == 2) { // truffle: ganache rings
      float r = length(p) / uB.x; col = mix(uC2, uC3, smoothstep(0.42, 0.46, r + 0.03 * vn(p * 9.0))); col *= 0.93 + 0.08 * vn(p * 30.0); gloss = 0.55; spec = 0.4;
    } else { // fudge: chewy brand-colour nougat with nuts under a shiny top
      float y2 = yN + 0.03 * sin(p.x * 6.0 + uSeed);
      if (y2 < 0.5) {
        col = uC2 * (0.9 + 0.12 * vn(p * 14.0)); vec3 v = vor(p * 5.5 + uSeed); if (v.x < 0.22 && v.y < 0.45) col = mix(uC4, uC4 * 0.75, v.x / 0.22); gloss = 0.2; spec = 0.1;
      } else { col = uC3 * (0.95 + 0.07 * sin(p.x * 30.0 + p.y * 9.0)); gloss = 0.95; spec = 0.75; }
      col *= 1.0 - 0.35 * smoothstep(0.03, 0.0, abs(y2 - 0.5));
    }
  } else if (uMat == 2) { // ---------------- CRANBERRY JELLY
    jelly = 1.0; gloss = 0.97; spec = 1.0;
    vec3 base = uC1;
    if (uVar == 1) base = band3(yN + 0.03 * sin(p.x * 5.0), uC1, uC2, uC3);
    col = base;
    if (isCap || uVar != 1) {
      vec3 v = vor(p * 3.6 + uSeed);
      if (v.y < 0.32 && v.x < 0.3) { col = mix(uC4, uC4 * 0.8, v.x / 0.3); jelly = 0.6; }
      float b = vor(p * 13.0 + 3.0).x; col = mix(col, vec3(1.0), smoothstep(0.1, 0.03, b) * 0.6 * step(0.5, h31(floor(p * 13.0 + 3.0))));
    }
  } else if (uMat == 3) { // ---------------- LAYER CAKE
    float fro = 0.07 + 0.012 * vn(p * 20.0);
    if (!isCap || dep < fro) {
      col = uC1 * (0.95 + 0.07 * vn(p * 18.0)); gloss = 0.55; spec = 0.35; jelly = 0.08;
      col *= 0.95 + 0.06 * sin(atan(p.z, p.x) * 16.0 + p.y * 12.0);
      if (!isCap && p.y > -uB.y * 0.6) { // sprinkles
        vec3 sc = p * 26.0 + uSeed; vec3 c3 = floor(sc); float h = h31(c3); vec3 f = fract(sc) - 0.5;
        if (h > 0.84 && length(f) < 0.3) { float k = h31(c3 + 3.1); col = k < 0.3 ? vec3(0.85, 0.08, 0.15) : k < 0.6 ? vec3(0.1, 0.5, 0.22) : k < 0.8 ? vec3(1.0) : uC3; gloss = 0.95; spec = 0.7; }
      }
    } else {
      float y2 = yN + 0.02 * sin(p.x * 7.0 + p.z * 5.0 + uSeed);
      col = uC2 * (0.88 + 0.16 * fbm(p * 16.0 + uSeed));
      vec3 v = vor(p * 22.0); col *= 1.0 - 0.2 * smoothstep(0.15, 0.0, v.x);
      gloss = 0.1; spec = 0.05;
      float d1 = min(abs(y2 - 0.26), abs(y2 - 0.74)), d2 = abs(y2 - 0.5);
      if (d1 < 0.045) { col = uC3 * (0.97 + 0.04 * vn(p * 30.0)); gloss = 0.4; spec = 0.2; }
      if (d2 < 0.055) { col = d2 < 0.028 ? uC4 : uC3; gloss = 0.6; spec = 0.4; jelly = d2 < 0.028 ? 0.4 : 0.0; }
    }
  } else if (uMat == 4) { // ---------------- ROLLS (axis along x)
    float rad = length(p.yz) / uB.y, ang = atan(p.z, p.y);
    bool endFace = abs(p.x) > uB.x - 0.03;
    if (uVar == 0) { // yule log
      if (!isCap && !endFace) {
        float ridge = sin(ang * 16.0 + 6.0 * fbm(vec3(p.x * 2.0, ang * 2.0, 1.0) + uSeed) + p.x * 1.5);
        col = mix(uC1 * 0.6, uC1 * 1.3, smoothstep(-0.6, 0.9, ridge)); gloss = 0.5; spec = 0.35;
        float sn = smoothstep(0.5, 0.85, p.y / uB.y + 0.35 * (fbm(p * 7.0 + uSeed) - 0.5));
        col = mix(col, vec3(0.98), sn * 0.95); if (sn > 0.5) { gloss = 0.1; spec = 0.05; }
      } else if (dep < 0.045) { col = uC1 * 0.85; gloss = 0.6; spec = 0.35; }
      else {
        float s = fract(rad * 3.0 - ang / 6.2831853 + 0.06 * vn(p * 8.0));
        float cream = smoothstep(0.6, 0.64, s) * (1.0 - smoothstep(0.92, 0.96, s));
        col = mix(uC2 * (0.88 + 0.16 * fbm(p * 14.0)), uC3, cream); gloss = 0.15 + 0.35 * cream; spec = 0.08 + 0.2 * cream;
      }
    } else if (uVar == 1) { // stollen
      if (!isCap) {
        float su = smoothstep(-0.75, 0.1, p.y / uB.y + 0.4 * (fbm(p * 5.0 + uSeed) - 0.5));           // powdered sugar, golden crust below
        col = mix(uC1 * (0.85 + 0.3 * fbm(p * 9.0)), vec3(0.97, 0.96, 0.93) * (0.9 + 0.12 * fbm(p * 12.0)), su);
        vec3 v = vor(p * 4.0 + uSeed); if (v.x < 0.12 && v.y < 0.3) col = mix(col, v.y < 0.15 ? vec3(0.8, 0.1, 0.15) : vec3(0.25, 0.6, 0.25), 0.55);
        col *= 0.94 + 0.08 * vn(p * 40.0); gloss = 0.1; spec = 0.05; rough = 0.8; }
      else if (dep < 0.03) col = vec3(0.98);
      else if (dep < 0.07) { col = uC1; gloss = 0.2; spec = 0.1; }
      else {
        col = uC2 * (0.88 + 0.18 * fbm(p * 12.0)); gloss = 0.1; spec = 0.05;
        vec3 v = vor(p * 6.5 + uSeed);
        if (v.x < 0.17) { float k = v.y; col = k < 0.25 ? vec3(0.85, 0.08, 0.13) : k < 0.5 ? vec3(0.2, 0.62, 0.22) : k < 0.72 ? vec3(1.0, 0.62, 0.1) : vec3(0.35, 0.18, 0.12); gloss = 0.8; spec = 0.6; jelly = 0.3; }
        if (length(p.yz * vec2(1.0, 0.8)) < 0.15) { col = uC4 * (0.95 + 0.06 * vn(p * 25.0)); gloss = 0.3; spec = 0.15; }   // marzipan core
      }
    } else { // candy cane
      float s = fract(p.x * 1.5 + ang / 6.2831853);
      if (!isCap || dep < 0.035) { col = s < 0.36 ? uC1 : (s < 0.44 ? uC3 : vec3(1.0)); gloss = 0.95; spec = 0.9; }
      else {
        col = vec3(1.0) * (0.95 + 0.05 * vn(p * 30.0));
        float pw = fract(ang / 6.2831853 * 6.0 + rad * 0.3); if (rad < 0.8 && rad > 0.18 && pw < 0.2) col = mix(col, uC1, 0.9);
        gloss = 0.75; spec = 0.55; jelly = 0.25;
      }
    }
  } else if (uMat == 5) { // ---------------- PEPPERMINT TAFFY
    float m = fbm(p * 1.4 + uSeed); float sw = sin((p.x + p.y * 1.3 - p.z) * 2.6 + m * 9.0);
    col = mix(uC1, uC2, smoothstep(-0.5, 0.5, sw)); col = mix(col, uC3, smoothstep(0.78, 1.0, abs(sw)) * 0.75);
    vec3 cell = floor(p * 46.0); float hh = h31(cell);
    if (hh > 0.9) spark = pow(max(0.0, sin(uTime * 3.0 + hh * 80.0 + dot(normalize(vWN), vec3(9.0, 4.0, 7.0)) * 2.0)), 6.0);
    gloss = 0.92; spec = 0.85; jelly = 0.3;
  } else { // ---------------- COCOA BOMB
    float r = length(p / uB);
    if (!isCap) {
      col = uC1 * (0.92 + 0.1 * vn(p * 20.0)); gloss = 0.92; spec = 0.85;
      float dl = abs(fract(p.y * 3.0 + 0.16 * sin(p.x * 11.0 + p.z * 7.0 + uSeed)) - 0.5);
      if (dl < 0.06 && p.y > -0.15) { col = uC2 * (0.95 + 0.06 * vn(p * 30.0)); gloss = 0.7; spec = 0.5; }
      vec3 sc = p * 30.0 + uSeed; float h = h31(floor(sc));
      if (p.y > uB.y * 0.55 && h > 0.8 && length(fract(sc) - 0.5) < 0.3) { col = h > 0.9 ? vec3(1.0) : uC4; gloss = 0.9; }
    } else if (r > 0.86) { col = uC1 * (0.8 + 0.12 * vn(p * 22.0)); gloss = 0.5; spec = 0.3; }
    else {
      vec3 v = vor(p * 9.0 + uSeed);
      if (v.y < 0.42 && v.x < 0.3) {                         // mini marshmallows in cocoa powder
        col = (v.y < 0.24 ? uC3 : uC4) * (0.8 + 0.2 * smoothstep(0.3, 0.0, v.x)); gloss = 0.25; spec = 0.12; jelly = 0.3;
      } else {                                              // cocoa powder
        col = vec3(0.36, 0.2, 0.12) * (0.75 + 0.4 * fbm(p * 18.0)); gloss = 0.05; spec = 0.02; rough = 1.0;
        spark = step(0.92, h31(floor(p * 40.0))) * pow(max(0.0, sin(uTime * 2.4 + h31(floor(p * 40.0)) * 70.0)), 5.0);
      }
    }
  }

  // brand logo iced on the top face
  if (uLogoOn > 0.5 && topFace) {
    vec2 q = p.xz / uLogoR; float r = length(q);
    if (r < 1.0) {
      float disc = smoothstep(1.0, 0.97, r);
      col = mix(col, vec3(0.99, 0.98, 0.96), disc);
      col = mix(col, uLogoRing, smoothstep(0.955, 0.935, r) * smoothstep(0.86, 0.885, r));
      vec2 uv = vec2(0.5 + q.x * 0.58, 0.5 - q.y * 0.58);
      if (r < 0.86) { vec4 lg = texture2D(uLogo, uv); col = mix(col, lg.rgb, lg.a); }
      gloss = 0.55; spec = 0.3; rough = 0.0; jelly = 0.0;
    }
  }

  // golden bonus treats: metallic gold skin
  if (uGold > 0.5 && !isCap) { float g = fbm(p * 4.0); col = mix(vec3(1.0, 0.72, 0.18), vec3(1.0, 0.9, 0.45), g); gloss = 0.95; spec = 1.6; jelly = 0.0; rough = 0.0; }

  // ---------------- lighting (world space)
  vec3 N = normalize(vWN); if (!gl_FrontFacing) N = -N;
  if (rough > 0.0) N = normalize(N + (vec3(vn(p * 60.0), vn(p * 60.0 + 9.0), vn(p * 60.0 + 19.0)) - 0.5) * 0.35 * rough);
  vec3 V = normalize(cameraPosition - vW), L = normalize(uLight);
  float ndl = dot(N, L);
  float wrap = mix(max(ndl, 0.0), (ndl + 0.7) / 1.7, max(jelly, 0.25));
  vec3 sky = vec3(1.0, 0.96, 0.92), gnd = vec3(0.5, 0.52, 0.66);
  vec3 hemi = mix(gnd, sky, N.y * 0.5 + 0.5);
  float fill = max(dot(N, normalize(vec3(0.8, 0.3, -0.4))), 0.0);
  vec3 c = col * (hemi * 0.5 + vec3(1.0, 0.93, 0.84) * wrap * 0.8 + vec3(0.7, 0.8, 1.0) * fill * 0.2);
  vec3 H = normalize(L + V);
  float sp = pow(max(dot(N, H), 0.0), mix(6.0, 140.0, gloss)) * spec;
  float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 tint = uGold > 0.5 && !isCap ? vec3(1.0, 0.82, 0.4) : vec3(1.0);
  c += sp * tint + fr * (0.12 + 0.25 * jelly) * mix(sky, col * 1.6, jelly);
  c += col * jelly * 0.22 * (1.0 - max(ndl, 0.0));            // fake subsurface glow
  if (isCap) { float age = uTime - vCap; c += col * 0.35 * exp(-age * 2.0); } // fresh-cut sheen
  c += vec3(1.0, 0.98, 0.92) * spark * 1.8;
  if (uGold > 0.5 && !isCap) { // polished gold: fake studio reflections
    vec3 R = reflect(-V, N); float env = smoothstep(-0.2, 0.55, R.y) + 0.5 * smoothstep(0.75, 0.95, abs(R.x));
    c = col * vec3(0.95, 0.68, 0.22) * (0.25 + 1.15 * env) + vec3(1.0, 0.92, 0.6) * pow(max(dot(N, H), 0.0), 90.0) * 1.8 + fr * vec3(1.0, 0.8, 0.4) * 0.4;
  }
  c *= mix(0.62, 1.0, smoothstep(0.0, 0.3, vW.y));             // contact shadow near the belt

  // ---------------- guide decals (marker lines wrap the treat)
  for (int i = 0; i < 4; i++) {
    float a = uGA[i]; if (a <= 0.001) continue;
    vec4 g = uG[i]; float s = dot(p, g.xyz) - g.w;
    vec3 tg = normalize(cross(g.xyz, vec3(0.0, 1.0, 0.0)) + vec3(0.0, 0.0, 1e-4));
    float u = dot(p, tg) + p.y;
    float dash = step(0.42, fract(u * 4.2 - uTime * 0.9));
    float lw = 0.024, ol = 0.05;
    float core = smoothstep(lw, lw * 0.5, abs(s)) * dash, out_ = smoothstep(ol, ol * 0.6, abs(s)) * dash;
    c = mix(c, vec3(0.08, 0.1, 0.22), out_ * 0.6 * a);
    c = mix(c, vec3(1.0), core * a);
  }
  if (uTgt.w > 0.001) { // hammer target ring + cross
    float d = length(p - uTgt.xyz); float pulse = 0.14 + 0.025 * sin(uTime * 7.0);
    float ring = smoothstep(0.03, 0.012, abs(d - pulse)); vec3 q = p - uTgt.xyz;
    float cr = smoothstep(0.022, 0.01, min(abs(q.x + q.z), abs(q.x - q.z))) * step(d, 0.09);
    c = mix(c, vec3(0.12, 0.08, 0.16), smoothstep(0.05, 0.02, abs(d - pulse)) * 0.6 * uTgt.w);
    c = mix(c, vec3(1.0, 0.95, 0.5), max(ring, cr) * uTgt.w);
  }
  if (uCrack > 0.0) { // spreading crack along guide 0
    vec4 g = uG[0]; float s = dot(p, g.xyz) - g.w + 0.035 * (vn(p * 18.0) - 0.5) + 0.02 * (vn(p * 47.0) - 0.5);
    float spread = length(p - uTgt.xyz);
    float k = smoothstep(0.016, 0.004, abs(s)) * step(spread, uCrack * 2.2);
    c = mix(c, vec3(0.08, 0.05, 0.06), k);
    c += vec3(1.0, 0.9, 1.0) * smoothstep(0.05, 0.0, abs(s)) * step(spread, uCrack * 2.2) * 0.25;
  }
  c *= uFade;
  gl_FragColor = vec4(pow(max(c, 0.0), vec3(1.0 / 2.2)), 1.0);
}`;

const lin = hex => new THREE.Color(hex); // THREE.Color converts sRGB hex to linear working space
const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1); blank.needsUpdate = true;
export function setColors(m, colors) {
  const cs = (colors || ['#ffffff']).map(lin); while (cs.length < 4) cs.push(cs[cs.length - 1].clone());
  const u = m.uniforms; u.uC1.value.copy(cs[0]); u.uC2.value.copy(cs[1]); u.uC3.value.copy(cs[2]); u.uC4.value.copy(cs[3]);
}
export function makeMaterial(o) {
  const m = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    uniforms: {
      uTime: { value: 0 }, uSeed: { value: o.seed || 0 }, uGold: { value: o.gold ? 1 : 0 }, uCrack: { value: 0 }, uFade: { value: 1 }, uWob: { value: 0 },
      uMat: { value: o.mat }, uVar: { value: o.variant || 0 }, uShape: { value: o.shape }, uR: { value: o.r || 0 },
      uB: { value: new THREE.Vector3(...o.b) }, uC1: { value: new THREE.Color() }, uC2: { value: new THREE.Color() }, uC3: { value: new THREE.Color() }, uC4: { value: new THREE.Color() },
      uLight: { value: new THREE.Vector3(-0.45, 0.85, 0.55) },
      uG: { value: [new THREE.Vector4(1, 0, 0, 99), new THREE.Vector4(1, 0, 0, 99), new THREE.Vector4(1, 0, 0, 99), new THREE.Vector4(1, 0, 0, 99)] },
      uGA: { value: new THREE.Vector4(0, 0, 0, 0) }, uTgt: { value: new THREE.Vector4(0, 0, 0, 0) },
      uLogo: { value: o.logo || blank }, uLogoOn: { value: o.logo ? 1 : 0 }, uLogoR: { value: o.logoR || 0.4 }, uLogoRing: { value: lin(o.ring || '#ffffff') },
    },
  });
  setColors(m, o.colors);
  return m;
}
