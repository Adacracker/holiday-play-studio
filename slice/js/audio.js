// Layered ASMR cut sounds, all synthesized with WebAudio (no files). Music + mute live in HKit (hkit.js).
export function makeSound() {
  const hkMuted = () => !!(window.HKit && window.HKit.audio && window.HKit.audio.muted);
  const S = {
    ctx: null, master: null, rev: null, noise: null, lastCoin: 0,
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended' && !document.hidden && !hkMuted()) this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const c = this.ctx = new AC();
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 5; comp.knee.value = 8; comp.connect(c.destination);
      this.master = c.createGain(); this.master.gain.value = 0.6; this.master.connect(comp);
      // small room reverb for a soft "studio" feel
      const rl = Math.floor(c.sampleRate * 1.4), ir = c.createBuffer(2, rl, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < rl; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rl, 3.2); }
      const conv = c.createConvolver(); conv.buffer = ir; this.rev = c.createGain(); this.rev.gain.value = 0.22; this.rev.connect(conv); conv.connect(this.master);
      const n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; this.noise = b;
    },
    out(dest, wet = 0.5) { return dest || this._bus(wet); },
    _bus(wet) { const key = Math.round(wet * 20); this.buses = this.buses || {}; if (this.buses[key]) return this.buses[key]; const g = this.buses[key] = this.ctx.createGain(); g.connect(this.master); if (wet > 0) { const w = this.ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(this.rev); } return g; },
    ok() { return this.ctx && !hkMuted() && this.ctx.state === 'running'; },
    tone(f, d, type = 'sine', v = 0.2, delay = 0, slide = 0, dest = null, att = 0.006) {
      if (!this.ok()) return;
      const c = this.ctx, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + d);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(dest || this._bus(0.35)); o.start(t); o.stop(t + d + 0.05);
    },
    // filtered noise; f2 = sweep target, q = resonance
    nz(dur, type, f, v, delay = 0, f2 = 0, q = 0.8, dest = null, att = 0.003) {
      if (!this.ok()) return;
      const c = this.ctx, t = c.currentTime + delay, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noise; fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(fl); fl.connect(g); g.connect(dest || this._bus(0.3)); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
    },
    // tiny granular ticks: the crunchy / crumbly texture of a cut
    grains(n, spread, f, v, delay = 0, fJit = 0.5) {
      if (!this.ok()) return; const bus = this._bus(0.25);
      for (let i = 0; i < n; i++) { const tt = delay + Math.pow(Math.random(), 0.8) * spread; this.nz(0.008 + Math.random() * 0.012, 'bandpass', f * (1 - fJit / 2 + Math.random() * fJit), v * (0.4 + Math.random() * 0.6), tt, 0, 2.5, bus, 0.001); }
    },
    swish(k = 1) { this.nz(0.13, 'bandpass', 900, 0.09 * k, 0, 5200, 1.4); },
    // material cut sounds; q = 0..3 quality (MISS..PERFECT), L = cut length 0..1.5
    cut(mat, q = 2, blade = 'knife') {
      const pk = 0.9 + q * 0.05;
      switch (mat) {
        case 'soap': this.nz(0.16, 'highpass', 3200, 0.3); this.nz(0.05, 'bandpass', 7200, 0.12, 0.01, 0, 2); this.tone(150 * pk, 0.07, 'sine', 0.16); this.grains(9, 0.12, 5200, 0.07); break;
        case 'choco': this.nz(0.025, 'highpass', 2600, 0.55); this.nz(0.1, 'bandpass', 1700 * pk, 0.3, 0, 0, 9); this.tone(950 * pk, 0.045, 'triangle', 0.08); this.grains(10, 0.22, 3200, 0.06, 0.02); break;
        case 'jelly': this.nz(0.28, 'lowpass', 320, 0.32, 0, 2400, 7); this.tone(380 * pk, 0.2, 'sine', 0.2, 0, 0.38); this.tone(260 * pk, 0.16, 'sine', 0.12, 0.09, 0.45); break;
        case 'sand': this.grains(46, 0.42, 3600, 0.11, 0, 0.8); this.nz(0.38, 'lowpass', 1300, 0.09, 0, 500); this.tone(95, 0.09, 'sine', 0.12); break;
        case 'fruit': this.nz(0.13, 'bandpass', 1900, 0.38, 0, 900, 1.1); this.grains(16, 0.14, 2600, 0.09); this.nz(0.22, 'lowpass', 900, 0.2, 0.02, 280, 3);
          for (let i = 0; i < 3; i++) this.tone(1300 - i * 150, 0.06, 'sine', 0.05, 0.16 + i * 0.11 + Math.random() * 0.05, 0.5); break;
        case 'slime': this.nz(0.42, 'lowpass', 220, 0.28, 0, 1600, 5); this.tone(210 * pk, 0.32, 'sine', 0.14, 0, 0.55);
          for (let i = 0; i < 6; i++) this.tone(3000 + Math.random() * 3200, 0.05, 'sine', 0.035, 0.05 + Math.random() * 0.3); break;
        case 'geode': this.crack(); break;
      }
      if (blade === 'wire') this.tone(230, 0.32, 'sawtooth', 0.035, 0, 0.96);
      if (blade === 'laser') { this.tone(1900, 0.16, 'sine', 0.09, 0, 0.2); this.nz(0.2, 'bandpass', 6200, 0.05, 0, 0, 3); }
    },
    crack() {
      this.nz(0.035, 'highpass', 4800, 0.6); this.nz(0.26, 'lowpass', 420, 0.38); this.tone(70, 0.22, 'sine', 0.25, 0, 0.6);
      const fs = [2093, 2794, 3322, 3951, 4699]; for (let i = 0; i < fs.length; i++) this.tone(fs[i] * (0.97 + Math.random() * 0.06), 1.4, 'sine', 0.045, 0.04 + i * 0.07, 0, null, 0.004);
    },
    hammer() { this.nz(0.03, 'bandpass', 1500, 0.4, 0, 0, 3); this.tone(220, 0.06, 'triangle', 0.12, 0, 0.6); },
    land(size = 1, mat = '') {
      const v = Math.min(1, 0.4 + size * 0.5);
      if (mat === 'jelly' || mat === 'slime') { this.tone(170, 0.14, 'sine', 0.16 * v, 0, 0.5); this.nz(0.09, 'lowpass', 600, 0.12 * v); return; }
      this.nz(0.12, 'lowpass', 380, 0.26 * v); this.tone(85, 0.12, 'sine', 0.2 * v, 0, 0.6);
      if (mat === 'sand') this.grains(18, 0.35, 3000, 0.06, 0.03);
      if (mat === 'choco' || mat === 'geode') this.grains(5, 0.08, 2600, 0.06);
    },
    pour() { this.grains(30, 0.6, 3300, 0.05, 0, 0.8); this.nz(0.6, 'bandpass', 2400, 0.04, 0, 1400, 0.7); },
    press(k) { this.nz(0.09, 'bandpass', 300 + k * 900, 0.04, 0, 0, 2); },
    chunk() { this.nz(0.05, 'highpass', 2500, 0.4); this.nz(0.25, 'lowpass', 300, 0.35); this.tone(60, 0.2, 'sine', 0.3, 0, 0.7); this.grains(14, 0.2, 3000, 0.07, 0.03); },
    grade(q, combo) {
      if (q === 3) { const base = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24][Math.min(10, combo)]; const f = 784 * Math.pow(2, base / 12);
        this.tone(f, 0.5, 'sine', 0.11, 0.03); this.tone(f * 1.5, 0.4, 'sine', 0.05, 0.07); this.tone(f * 2, 0.3, 'triangle', 0.03, 0.1); }
      else if (q === 2) this.tone(660, 0.3, 'sine', 0.08, 0.03);
      else if (q === 1) this.tone(440, 0.22, 'sine', 0.06, 0.03);
      else { this.tone(200, 0.2, 'triangle', 0.08, 0.02, 0.7); }
    },
    coin() { const n = performance.now(); if (n - this.lastCoin < 45) return; this.lastCoin = n; this.tone(1568, 0.07, 'triangle', 0.05); this.tone(2349, 0.09, 'triangle', 0.035, 0.03); },
    ui() { this.tone(700, 0.06, 'sine', 0.1); this.tone(1050, 0.05, 'sine', 0.06, 0.035); },
    buy() { [660, 880, 1320, 1760].forEach((f, i) => this.tone(f, 0.18, 'sine', 0.11, i * 0.06)); },
    star(i) { const f = [784, 988, 1175][i] || 1175; this.tone(f, 0.5, 'sine', 0.13); this.tone(f * 2, 0.35, 'sine', 0.05, 0.03); this.grains(8, 0.15, 6000, 0.04); },
    win() { [523, 659, 784, 1047, 1318].forEach((f, i) => this.tone(f, 0.45, 'sine', 0.12, i * 0.08)); },
    whoosh() { this.nz(0.5, 'bandpass', 300, 0.06, 0, 1400, 0.9, null, 0.15); },
    pause() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); },
    resume() { if (this.ctx && this.ctx.state === 'suspended' && !hkMuted()) this.ctx.resume(); },
  };
  return S;
}
