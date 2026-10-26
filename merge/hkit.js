/* Holiday Kit — shared winter layer for the branded holiday games (copied per game folder).
   Needs window.Brand (../shared/brand.js). Classic script; exposes window.HKit.
   HKit.init({slug, title, subtitle})  -> call once, early (sets CSS vars, storage prefix, audio unlock)
   HKit.splash({title, sub, minMs})    -> Promise; big brand splash on #loading (auto-hides, tap skips). Call HKit.ready() when game assets are ready.
   HKit.snow({z, count, front})        -> snow overlay canvas (pointer-events none)
   HKit.lights({z})                    -> twinkling string lights along the top edge
   HKit.badge({corner})                -> small HUD brand badge (logo + name)
   HKit.timer({seconds, onEnd, onTick, mount}) -> festive countdown pill; returns {start, pause, resume, reset, left, add(s), el}
   HKit.hint(html, ms)                 -> 3 s how-to-play bubble with animated pointer
   HKit.music.start()/stop()/toggle()  -> original synthesized jingle loop (starts on first gesture automatically after start())
   HKit.sfx.<name>(opts)               -> pop({pitch,vol}), thud(vol), chime, bell, whoosh, slice, sparkle, thud, tick, combo(n), fanfare, merge(level), click, error
   HKit.muteButton({corner})           -> round mute toggle button
   HKit.end(score, extraHtml)          -> fanfare + Brand.endScreen; resolves on Play again
   HKit.wrapCanvas(img, opts)          -> canvas: brand gift-wrap pattern with logo stickers
   HKit.store.get(k, d) / set(k, v)    -> localStorage under hp.<slug>.
*/
(function () {
  var K = {}; window.HKit = K;
  var slug = 'game';
  K.colors = { red: '#d62839', redD: '#9e1b2a', green: '#1f7a4d', greenD: '#145236', gold: '#f4c542', snow: '#f7fbff', night: '#0e2440', ice: '#cfe8ff', cocoa: '#6b3e26' };
  K.brand = function () { return (window.Brand && Brand.get()) || { name: 'Your Brand', primary: '#c62828', secondary: '#1b5e20', accent: '#ffd54f' }; };

  K.store = {
    get: function (k, d) { try { var v = localStorage.getItem('hp.' + slug + '.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('hp.' + slug + '.' + k, JSON.stringify(v)); } catch (e) {} }
  };

  /* ---------- CSS ---------- */
  var css = [
    ':root{--hk-red:#d62839;--hk-green:#1f7a4d;--hk-gold:#f4c542;}',
    '.hk-font{font-family:"KFuture",ui-rounded,"SF Pro Rounded","Nunito",system-ui,sans-serif;}',
    '#hk-splash{position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2.2vmin;text-align:center;color:#fff;',
    ' background:radial-gradient(120% 90% at 50% 30%,var(--brand-primary,#c62828) 0%,color-mix(in srgb,var(--brand-secondary,#1b5e20) 70%,#06101e) 100%);transition:opacity .45s ease,transform .45s ease;cursor:pointer;overflow:hidden}',
    '#hk-splash.out{opacity:0;transform:scale(1.04);pointer-events:none}',
    '#hk-splash .hk-logo{width:min(46vmin,260px);height:min(46vmin,260px);border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;',
    ' box-shadow:0 0 0 1.4vmin var(--brand-accent,#ffd54f),0 0 0 2.6vmin rgba(255,255,255,.25),0 18px 50px rgba(0,0,0,.35);animation:hkPop .7s cubic-bezier(.2,1.6,.4,1) both;overflow:hidden}',
    '#hk-splash .hk-logo img{width:86%;height:86%;object-fit:contain}',
    '#hk-splash .hk-name{font-size:min(7.4vmin,46px);font-weight:900;text-shadow:0 3px 0 rgba(0,0,0,.25);animation:hkUp .6s .15s both;max-width:92vw;line-height:1.1}',
    '#hk-splash .hk-pres{font:800 min(3.4vmin,17px) ui-rounded,system-ui,sans-serif;letter-spacing:3px;text-transform:uppercase;opacity:.85;animation:hkUp .6s .25s both}',
    '#hk-splash .hk-title{font-size:min(10vmin,64px);color:var(--brand-accent,#ffd54f);text-shadow:0 4px 0 rgba(0,0,0,.28),0 0 24px rgba(255,255,255,.35);animation:hkUp .6s .35s both;line-height:1.02;max-width:94vw}',
    '#hk-splash .hk-sub{font:800 min(3.6vmin,18px) ui-rounded,system-ui,sans-serif;opacity:.9;animation:hkUp .6s .45s both}',
    '#hk-splash .hk-bar{width:min(52vmin,280px);height:10px;border-radius:6px;background:rgba(255,255,255,.22);overflow:hidden;margin-top:1vmin}',
    '#hk-splash .hk-bar i{display:block;height:100%;width:0;border-radius:6px;background:repeating-linear-gradient(-45deg,#fff 0 10px,var(--hk-red) 10px 20px);transition:width .3s}',
    '@keyframes hkPop{from{transform:scale(.3) rotate(-12deg);opacity:0}}@keyframes hkUp{from{transform:translateY(18px);opacity:0}}',
    '#hk-badge{position:fixed;z-index:60;pointer-events:none;display:flex;align-items:center;gap:7px;padding:4px 11px 4px 4px;border-radius:30px;background:rgba(255,255,255,.93);',
    ' box-shadow:0 0 0 2.5px var(--brand-primary,#c62828),0 4px 12px rgba(0,0,0,.18);font:900 13px ui-rounded,system-ui,sans-serif;color:var(--brand-secondary,#1b5e20);max-width:46vw}',
    '#hk-badge img{width:30px;height:30px;border-radius:50%;object-fit:contain;background:#fff;flex:none}',
    '#hk-badge span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#hk-timer{position:fixed;z-index:61;left:50%;transform:translateX(-50%);top:calc(30px + env(safe-area-inset-top));pointer-events:none;display:flex;align-items:center;gap:7px;',
    ' padding:5px 14px 5px 8px;border-radius:22px;background:#fff;color:#7a1020;font:900 20px "KFuture",ui-rounded,system-ui,sans-serif;',
    ' box-shadow:0 0 0 3px var(--hk-red),0 0 0 6px #fff,0 6px 16px rgba(0,0,0,.22);font-variant-numeric:tabular-nums}',
    '#hk-timer svg{width:24px;height:24px;flex:none}',
    '#hk-timer .hk-tb{position:absolute;left:10px;right:10px;bottom:-9px;height:5px;border-radius:3px;background:rgba(255,255,255,.6);overflow:hidden}',
    '#hk-timer .hk-tb i{display:block;height:100%;background:repeating-linear-gradient(-45deg,var(--hk-red) 0 6px,#fff 6px 12px);transform-origin:left}',
    '#hk-timer.low{animation:hkThrob .5s ease-in-out infinite alternate;background:#ffe9ec}',
    '@keyframes hkThrob{to{transform:translateX(-50%) scale(1.12)}}',
    '#hk-big{position:fixed;z-index:62;left:50%;top:42%;transform:translate(-50%,-50%);pointer-events:none;font:900 min(22vmin,150px) "KFuture",ui-rounded,system-ui,sans-serif;color:#fff;',
    ' text-shadow:0 6px 0 var(--hk-red),0 0 30px rgba(255,255,255,.6);opacity:0}',
    '#hk-big.go{animation:hkBig .9s ease-out}@keyframes hkBig{0%{opacity:0;transform:translate(-50%,-50%) scale(.4)}25%{opacity:1;transform:translate(-50%,-50%) scale(1.1)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.5)}}',
    '#hk-hint{position:fixed;z-index:63;left:50%;bottom:calc(16% + env(safe-area-inset-bottom));transform:translateX(-50%);pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:10px;transition:opacity .4s}',
    '#hk-hint .hk-hb{background:rgba(14,36,64,.88);color:#fff;padding:10px 18px;border-radius:18px;font:900 17px ui-rounded,system-ui,sans-serif;text-align:center;box-shadow:0 0 0 3px rgba(255,255,255,.8),0 8px 20px rgba(0,0,0,.25);max-width:88vw}',
    '#hk-hint .hk-hb small{display:block;font-size:12.5px;opacity:.8;margin-top:3px}',
    '#hk-hint .hk-hand{width:54px;height:54px;filter:drop-shadow(0 4px 3px rgba(0,0,0,.3))}',
    '#hk-hint.out{opacity:0}',
    '.hk-anim-swipe .hk-hand{animation:hkSwipe 1.1s ease-in-out infinite}@keyframes hkSwipe{0%{transform:translate(-70px,20px) rotate(-10deg)}50%{transform:translate(70px,-20px) rotate(10deg)}100%{transform:translate(-70px,20px) rotate(-10deg)}}',
    '.hk-anim-tap .hk-hand{animation:hkTap .8s ease-in-out infinite}@keyframes hkTap{50%{transform:translateY(10px) scale(.88)}}',
    '.hk-anim-drag .hk-hand{animation:hkDrag 1.4s ease-in-out infinite}@keyframes hkDrag{0%,10%{transform:translate(-60px,0)}60%,100%{transform:translate(60px,0)}}',
    '#hk-mute{position:fixed;z-index:64;width:42px;height:42px;border-radius:50%;border:0;background:rgba(255,255,255,.93);box-shadow:0 0 0 2.5px var(--hk-green),0 4px 10px rgba(0,0,0,.2);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:20px;padding:0}',
    '#hk-lights{position:fixed;left:0;right:0;top:0;height:34px;pointer-events:none}',
    '.hk-snowc{position:fixed;inset:0;width:100%;height:100%;pointer-events:none}'
  ].join('\n');
  function addCss() { var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }

  var corners = {
    tl: 'left:calc(10px + env(safe-area-inset-left));top:calc(10px + env(safe-area-inset-top))',
    tr: 'right:calc(10px + env(safe-area-inset-right));top:calc(10px + env(safe-area-inset-top))',
    bl: 'left:calc(10px + env(safe-area-inset-left));bottom:calc(10px + env(safe-area-inset-bottom))',
    br: 'right:calc(10px + env(safe-area-inset-right));bottom:calc(10px + env(safe-area-inset-bottom))'
  };
  function place(el, corner, extra) { el.style.cssText += ';' + (corners[corner] || corner) + ';' + (extra || ''); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  K.esc = esc;

  K.init = function (o) {
    o = o || {}; slug = o.slug || slug; K.title = o.title || ''; K.subtitle = o.subtitle || '';
    addCss();
    if (window.Brand) { Brand.css(); Brand.onChange(function () { Brand.css(); refreshBrand(); }); }
    var unlock = function () { K.audio.unlock(); };
    ['pointerdown', 'touchstart', 'keydown', 'mousedown'].forEach(function (ev) { window.addEventListener(ev, unlock, { capture: true, passive: true }); });
    document.addEventListener('visibilitychange', function () { if (K.audio.ctx) { if (document.hidden) K.audio.ctx.suspend(); else if (!K.audio.muted) K.audio.ctx.resume(); } });
  };
  var brandHooks = [];
  K.onBrand = function (fn) { brandHooks.push(fn); };
  function refreshBrand() {
    var b = K.brand();
    var bd = document.getElementById('hk-badge');
    if (bd) { bd.querySelector('span').textContent = b.name; bd.querySelector('img').src = b.logo || ''; }
    var sp = document.getElementById('hk-splash');
    if (sp) { var im = sp.querySelector('.hk-logo img'); if (im) im.src = b.logo || ''; var nm = sp.querySelector('.hk-name'); if (nm) nm.textContent = b.name; }
    brandHooks.forEach(function (f) { try { f(b); } catch (e) { console.warn(e); } });
  }

  /* ---------- splash (#loading) ---------- */
  var readyRes, readyP = new Promise(function (r) { readyRes = r; });
  K.ready = function () { readyRes(); };
  K.progress = function (p) { var i = document.querySelector('#hk-splash .hk-bar i'); if (i) i.style.width = Math.round(Math.max(0, Math.min(1, p)) * 100) + '%'; };
  K.splash = function (o) {
    o = o || {};
    var b = K.brand();
    var el = document.getElementById('loading');
    if (!el) { el = document.createElement('div'); el.id = 'loading'; document.body.appendChild(el); }
    el.removeAttribute('class'); el.id = 'loading';
    var wrap = document.createElement('div'); wrap.id = 'hk-splash'; wrap.className = 'hk-font';
    wrap.innerHTML = '<div class="hk-logo"><img alt=""></div><div class="hk-name"></div><div class="hk-pres">presents</div>' +
      '<div class="hk-title">' + esc(o.title || K.title) + '</div><div class="hk-sub">' + esc(o.sub || K.subtitle || '') + '</div><div class="hk-bar"><i></i></div>';
    wrap.querySelector('.hk-logo img').src = b.logo || ''; wrap.querySelector('.hk-name').textContent = b.name;
    el.innerHTML = ''; el.appendChild(wrap);
    el.style.cssText = 'position:fixed;inset:0;z-index:9000';
    var sn = K.snow({ parent: wrap, z: 1, count: 70 });
    var t0 = performance.now(), minMs = o.minMs == null ? 1900 : o.minMs, skipped = false;
    var hold = /[?&]splash=hold/.test(location.search);
    var skip; var skipP = new Promise(function (r) { skip = r; });
    wrap.addEventListener('pointerdown', function () { skipped = true; skip(); });
    window.addEventListener('keydown', function kd() { skipped = true; skip(); window.removeEventListener('keydown', kd); });
    var fake = 0, fi = setInterval(function () { fake = Math.min(.9, fake + .12); K.progress(fake); }, 160);
    return readyP.then(function () {
      clearInterval(fi); K.progress(1);
      if (hold) return new Promise(function () {});
      var wait = Math.max(0, minMs - (performance.now() - t0));
      return Promise.race([new Promise(function (r) { setTimeout(r, wait); }), skipP]);
    }).then(function () {
      wrap.classList.add('out');
      return new Promise(function (r) { setTimeout(function () { el.hidden = true; el.style.display = 'none'; if (sn) sn.stop(); r(); }, 420); });
    });
  };

  /* ---------- snow ---------- */
  K.snow = function (o) {
    o = o || {};
    var c = document.createElement('canvas'); c.className = 'hk-snowc'; c.style.zIndex = o.z == null ? 50 : o.z;
    if (o.parent) { c.style.position = 'absolute'; (o.parent).appendChild(c); } else document.body.appendChild(c);
    var g = c.getContext('2d'), W = 0, H = 0, dpr = Math.min(2, window.devicePixelRatio || 1), flakes = [], run = true, last = performance.now();
    var base = o.count || 60;
    function size() { W = c.clientWidth || innerWidth; H = c.clientHeight || innerHeight; c.width = W * dpr; c.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(base * Math.min(1.6, Math.max(.6, (W * H) / (900 * 600))));
      while (flakes.length < n) flakes.push(mk(true)); flakes.length = n; }
    function mk(any) { var r = Math.random(); var s = r < .7 ? 1 + Math.random() * 2 : 2.5 + Math.random() * 2.5;
      return { x: Math.random() * W, y: any ? Math.random() * H : -10, s: s, v: 18 + s * 14 + Math.random() * 12, ph: Math.random() * 7, w: .6 + Math.random() * 1.2, a: .55 + Math.random() * .4 }; }
    addEventListener('resize', size); size();
    function frame(t) {
      if (!run) return; var dt = Math.min(.05, (t - last) / 1000); last = t;
      g.clearRect(0, 0, W, H);
      for (var i = 0; i < flakes.length; i++) { var f = flakes[i]; f.y += f.v * dt; f.ph += dt * f.w; f.x += Math.sin(f.ph) * 14 * dt + 6 * dt;
        if (f.y > H + 8) { flakes[i] = mk(false); continue; } if (f.x > W + 8) f.x = -8;
        g.globalAlpha = f.a; g.fillStyle = '#fff'; g.beginPath(); g.arc(f.x, f.y, f.s, 0, 6.283); g.fill(); }
      g.globalAlpha = 1; requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return { canvas: c, stop: function () { run = false; c.remove(); }, setCount: function (n) { base = n; size(); } };
  };

  /* ---------- string lights ---------- */
  K.lights = function (o) {
    o = o || {};
    var c = document.createElement('canvas'); c.id = 'hk-lights'; c.style.zIndex = o.z == null ? 55 : o.z; document.body.appendChild(c);
    var g = c.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1), W, H = 34;
    var cols = ['#ff3b4e', '#ffd23f', '#3fd27a', '#4fb4ff', '#ff8ad8'];
    function size() { W = innerWidth; c.width = W * dpr; c.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); }
    addEventListener('resize', size); size();
    function y(x) { var seg = 150; var p = (x % seg) / seg; return 6 + Math.sin(p * Math.PI) * 12; }
    function frame(t) {
      g.clearRect(0, 0, W, H);
      g.strokeStyle = '#1d3b2a'; g.lineWidth = 2; g.beginPath(); for (var x = 0; x <= W; x += 4) { x ? g.lineTo(x, y(x)) : g.moveTo(x, y(x)); } g.stroke();
      var n = Math.ceil(W / 38);
      for (var i = 0; i < n; i++) { var bx = 19 + i * 38, by = y(bx) + 3; var col = cols[i % cols.length];
        var on = .55 + .45 * Math.sin(t / 380 + i * 1.7 + (i % 3) * 2);
        g.fillStyle = '#2b2b2b'; g.fillRect(bx - 2.5, by - 2, 5, 4);
        g.globalAlpha = .35 * on; g.fillStyle = col; g.beginPath(); g.arc(bx, by + 7, 10, 0, 6.283); g.fill();
        g.globalAlpha = .6 + .4 * on; g.beginPath(); g.ellipse(bx, by + 7, 4.2, 6, 0, 0, 6.283); g.fill();
        g.globalAlpha = .8 * on; g.fillStyle = '#fff'; g.beginPath(); g.arc(bx - 1.3, by + 5, 1.4, 0, 6.283); g.fill(); g.globalAlpha = 1; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return c;
  };

  /* ---------- badge ---------- */
  K.badge = function (o) {
    o = o || {}; var b = K.brand();
    var el = document.getElementById('hk-badge') || document.createElement('div'); el.id = 'hk-badge';
    el.innerHTML = '<img alt=""><span></span>'; el.querySelector('img').src = b.logo || ''; el.querySelector('span').textContent = b.name;
    el.style.cssText = ''; place(el, o.corner || 'bl', o.style); document.body.appendChild(el); return el;
  };

  /* ---------- timer ---------- */
  var flakeSvg = '<svg viewBox="0 0 24 24"><g stroke="#3a8fd8" stroke-width="2.2" stroke-linecap="round" fill="none"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5M3 10.3l3.4.9-.9 3.4M21 13.7l-3.4-.9.9-3.4M3 13.7l3.4-.9-.9-3.4M21 10.3l-3.4.9.9 3.4"/></g></svg>';
  K.timer = function (o) {
    o = o || {}; var total = o.seconds || 90, left = total, running = false, last = 0, raf = 0, lastWhole = -1, ended = false;
    var el = document.getElementById('hk-timer') || document.createElement('div'); el.id = 'hk-timer';
    el.innerHTML = flakeSvg + '<span>0:00</span><div class="hk-tb"><i></i></div>'; (o.mount || document.body).appendChild(el);
    if (o.top != null) el.style.top = o.top;
    var span = el.querySelector('span'), bar = el.querySelector('.hk-tb i');
    var big = document.getElementById('hk-big') || document.createElement('div'); big.id = 'hk-big'; document.body.appendChild(big);
    function fmt(s) { s = Math.ceil(s); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
    function draw() { span.textContent = fmt(left); bar.style.transform = 'scaleX(' + Math.max(0, left / total) + ')'; el.classList.toggle('low', left <= 10 && left > 0); }
    function flash(txt) { big.textContent = txt; big.classList.remove('go'); void big.offsetWidth; big.classList.add('go'); }
    K.flash = flash;
    function tick(t) {
      if (!running) return; var dt = Math.min(.25, (t - last) / 1000); last = t; left = Math.max(0, left - dt);
      var w = Math.ceil(left);
      if (w !== lastWhole) { lastWhole = w; if (o.onTick) o.onTick(w); if (w <= 5 && w > 0) { K.sfx.tick(); flash(String(w)); } else if (w <= 10 && w > 0) K.sfx.tick(.5); if (w === 30 && total > 40) { K.sfx.bell(); } }
      draw();
      if (left <= 0 && !ended) { ended = true; running = false; K.sfx.bell(); flash("Time!"); if (o.onEnd) o.onEnd(); return; }
      raf = requestAnimationFrame(tick);
    }
    var api = {
      el: el,
      start: function () { left = total; ended = false; lastWhole = -1; running = true; last = performance.now(); draw(); cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); },
      pause: function () { running = false; cancelAnimationFrame(raf); },
      resume: function () { if (ended || running) return; running = true; last = performance.now(); raf = requestAnimationFrame(tick); },
      reset: function () { api.pause(); left = total; ended = false; draw(); },
      left: function () { return left; },
      running: function () { return running; },
      add: function (s) { left = Math.min(total, left + s); draw(); },
      endNow: function () { left = 0.001; if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(tick); } }
    };
    document.addEventListener('visibilitychange', function () { if (document.hidden && running) { api.pause(); api._autoPaused = true; } else if (!document.hidden && api._autoPaused) { api._autoPaused = false; api.resume(); } });
    draw(); return api;
  };

  /* ---------- hint ---------- */
  var handSvg = '<svg class="hk-hand" viewBox="0 0 64 64"><path d="M26 6c3 0 5 2 5 5v17l2-1c2-1 5 0 6 2l1 1c2-1 5 0 6 2 2-1 5 0 6 3v13c0 8-6 14-14 14h-4c-5 0-9-2-12-6L12 41c-2-2-2-5 0-7s5-2 7 0l2 2V11c0-3 2-5 5-5z" fill="#fff" stroke="#0e2440" stroke-width="3" stroke-linejoin="round"/></svg>';
  K.hint = function (html, ms, kind) {
    var el = document.getElementById('hk-hint') || document.createElement('div'); el.id = 'hk-hint';
    el.className = 'hk-anim-' + (kind || 'tap');
    el.innerHTML = handSvg + '<div class="hk-hb">' + html + '</div>'; document.body.appendChild(el);
    var done = false; function hide() { if (done) return; done = true; el.classList.add('out'); setTimeout(function () { el.remove(); }, 450); }
    setTimeout(hide, ms || 3000); return { hide: hide, el: el };
  };

  /* ---------- audio ---------- */
  var A = K.audio = { ctx: null, master: null, music: null, fx: null, muted: false };
  A.muted = !!K.store.get('mute', false);
  A.ensure = function () {
    if (A.ctx) return A.ctx;
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    A.ctx = new AC(); A.master = A.ctx.createGain(); A.master.gain.value = A.muted ? 0 : .9;
    var comp = A.ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    A.master.connect(comp); comp.connect(A.ctx.destination);
    A.music = A.ctx.createGain(); A.music.gain.value = .32; A.music.connect(A.master);
    A.fx = A.ctx.createGain(); A.fx.gain.value = .75; A.fx.connect(A.master);
    var len = A.ctx.sampleRate * 1, buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; A.noise = buf;
    return A.ctx;
  };
  A.unlock = function () { var c = A.ensure(); if (!c) return; if (c.state !== 'running' && !A.muted) c.resume(); if (K.music.wanted && !K.music.on) K.music._go(); };
  A.setMuted = function (m) { A.muted = m; K.store.set('mute', m); if (A.master) A.master.gain.value = m ? 0 : .9; if (A.ctx) { if (m) A.ctx.suspend(); else A.ctx.resume(); } };
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  function ok() { return A.ctx && A.ctx.state === 'running' && !A.muted; }
  // bell / celesta voice
  function bell(dest, f, t, vol, dec) {
    var c = A.ctx, o = c.createOscillator(), m = c.createOscillator(), mg = c.createGain(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = f; m.type = 'sine'; m.frequency.value = f * 3.5; mg.gain.setValueAtTime(f * 1.2, t); mg.gain.exponentialRampToValueAtTime(f * .05, t + dec);
    m.connect(mg); mg.connect(o.frequency); o.connect(g); g.connect(dest); env(g, t, .004, vol, dec);
    var o2 = c.createOscillator(), g2 = c.createGain(); o2.type = 'sine'; o2.frequency.value = f * 2; o2.connect(g2); g2.connect(dest); env(g2, t, .003, vol * .25, dec * .5);
    o.start(t); m.start(t); o2.start(t); o.stop(t + dec + .1); m.stop(t + dec + .1); o2.stop(t + dec + .1);
  }
  function tone(dest, type, f, t, vol, dec, f2) {
    var c = A.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dec);
    o.connect(g); g.connect(dest); env(g, t, .005, vol, dec); o.start(t); o.stop(t + dec + .05);
  }
  function noise(dest, t, vol, dec, hp, lp) {
    var c = A.ctx, s = c.createBufferSource(); s.buffer = A.noise; var f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 5000;
    var g = c.createGain(); s.connect(f); var last = f; if (lp) { var l = c.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = lp; f.connect(l); last = l; }
    last.connect(g); g.connect(dest); env(g, t, .002, vol, dec); s.start(t, Math.random() * .5); s.stop(t + dec + .05);
  }
  // music: original 8-bar jingle in C, 138 bpm
  var MEL = [
    [76, 79, 84, 79, 76, 0, 74, 76], [81, 0, 79, 76, 72, 0, 76, 0], [77, 81, 84, 81, 79, 77, 76, 74], [74, 79, 83, 86, 84, 0, 0, 0],
    [84, 83, 81, 79, 76, 79, 84, 0], [81, 79, 76, 72, 74, 76, 0, 0], [77, 0, 81, 0, 79, 76, 74, 72], [74, 0, 71, 74, 72, 0, 0, 0]];
  var CH = [[48, 55, 64, 67], [45, 52, 60, 64], [41, 48, 57, 60], [43, 50, 59, 62], [48, 55, 64, 67], [45, 52, 60, 64], [41, 48, 57, 60], [43, 50, 59, 65]];
  var M = K.music = { on: false, wanted: false, step: 0, next: 0, timer: 0, bpm: 138, intensity: 0 };
  M._go = function () {
    if (!A.ctx || A.ctx.state !== 'running') return; M.on = true; M.step = 0; M.next = A.ctx.currentTime + .08; clearInterval(M.timer); M.timer = setInterval(M._sched, 40);
  };
  M._sched = function () {
    if (!A.ctx) return; var c = A.ctx, sp = 60 / M.bpm / 2;
    while (M.next < c.currentTime + .18) {
      var t = M.next, s = M.step, bar = Math.floor(s / 8) % 8, st = s % 8, cyc = Math.floor(s / 64);
      var n = MEL[bar][st]; var part = (cyc % 2 === 1);
      if (n) bell(A.music, mtof(part && st % 2 ? n + 12 : n), t, .22, .55);
      var ch = CH[bar];
      if (st === 0 || st === 4) tone(A.music, 'triangle', mtof(st === 0 ? ch[0] : ch[1]) , t, .34, .32);
      if (st === 2 || st === 6) { for (var k = 1; k < 4; k++) tone(A.music, 'sine', mtof(ch[k] + 12), t, .045, .22); }
      noise(A.music, t, st % 2 ? .05 : .11, st % 2 ? .05 : .09, 7000); // sleigh bells
      if (st === 4) noise(A.music, t, .07, .06, 1800, 6000); // soft clap
      M.next += sp; M.step++;
    }
  };
  M.start = function () { M.wanted = true; A.ensure(); if (A.ctx && A.ctx.state === 'running') M._go(); };
  M.stop = function () { M.wanted = false; M.on = false; clearInterval(M.timer); };
  M.toggle = function () { A.setMuted(!A.muted); return !A.muted; };
  M.tempo = function (b) { M.bpm = b; };
  var S = K.sfx = {};
  S.pop = function (o) { if (!ok()) return; var t = A.ctx.currentTime, p = (o && o.pitch) || 1, v = (o && o.vol) || 1; tone(A.fx, 'sine', 520 * p, t, .5 * v, .09, 1200 * p); noise(A.fx, t, .25 * v, .04, 2500); };
  S.click = function () { if (!ok()) return; tone(A.fx, 'triangle', 900, A.ctx.currentTime, .25, .05); };
  S.chime = function (o) { if (!ok()) return; var t = A.ctx.currentTime, b = (o && o.note) || 84; [0, 4, 7].forEach(function (d, i) { bell(A.fx, mtof(b + d), t + i * .06, .25, .5); }); };
  S.bell = function () { if (!ok()) return; var t = A.ctx.currentTime; bell(A.fx, mtof(88), t, .35, 1.1); bell(A.fx, mtof(81), t + .12, .25, 1); for (var i = 0; i < 6; i++) noise(A.fx, t + i * .05, .12, .06, 7000); };
  S.whoosh = function () { if (!ok()) return; var c = A.ctx, t = c.currentTime, s = c.createBufferSource(); s.buffer = A.noise; var f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(3500, t + .16); var g = c.createGain(); s.connect(f); f.connect(g); g.connect(A.fx); env(g, t, .03, .35, .17); s.start(t); s.stop(t + .25); };
  S.slice = function (o) { if (!ok()) return; S.whoosh(); var t = A.ctx.currentTime; noise(A.fx, t + .02, .3, .06, 3000, 9000); tone(A.fx, 'triangle', 300 * ((o && o.pitch) || 1), t + .02, .2, .08, 140); };
  S.sparkle = function () { if (!ok()) return; var t = A.ctx.currentTime; for (var i = 0; i < 5; i++) bell(A.fx, mtof(96 + [0, 4, 7, 12, 16][i]), t + i * .045, .12, .3); };
  S.thud = function (v) { if (!ok()) return; var t = A.ctx.currentTime; v = v || 1; tone(A.fx, 'sine', 160, t, .5 * v, .14, 60); noise(A.fx, t, .12 * v, .05, 300, 1500); };
  S.tick = function (v) { if (!ok()) return; var t = A.ctx.currentTime; tone(A.fx, 'square', 1500, t, .08 * (v || 1), .04); bell(A.fx, mtof(96), t, .1 * (v || 1), .15); };
  S.combo = function (n) { if (!ok()) return; var t = A.ctx.currentTime, sc = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]; var k = Math.min(sc.length - 1, n || 0); bell(A.fx, mtof(76 + sc[k]), t, .3, .45); bell(A.fx, mtof(83 + sc[k]), t + .05, .15, .35); };
  S.merge = function (lv) { if (!ok()) return; var t = A.ctx.currentTime, b = 67 + Math.min(17, (lv || 0) * 2); bell(A.fx, mtof(b), t, .3, .5); bell(A.fx, mtof(b + 7), t + .07, .25, .5); bell(A.fx, mtof(b + 12), t + .14, .2, .6); tone(A.fx, 'sine', 300, t, .2, .1, 600); };
  S.error = function () { if (!ok()) return; var t = A.ctx.currentTime; tone(A.fx, 'triangle', 220, t, .25, .15, 160); };
  S.fanfare = function () { if (!ok()) return; var t = A.ctx.currentTime; [72, 76, 79, 84, 79, 84, 88].forEach(function (n, i) { bell(A.fx, mtof(n), t + i * .11, .3, i === 6 ? 1.4 : .5); tone(A.fx, 'triangle', mtof(n - 12), t + i * .11, .12, .2); }); for (var i = 0; i < 14; i++) noise(A.fx, t + i * .06, .1, .05, 7000); };

  K.muteButton = function (o) {
    o = o || {}; var b = document.getElementById('hk-mute') || document.createElement('button'); b.id = 'hk-mute'; b.setAttribute('aria-label', 'Sound');
    function upd() { b.textContent = A.muted ? '\u{1F507}' : '\u{1F514}'; }
    b.style.cssText = ''; place(b, o.corner || 'br', o.style); upd();
    b.onclick = function (e) { e.stopPropagation(); A.setMuted(!A.muted); if (!A.muted) A.unlock(); upd(); };
    b.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    document.body.appendChild(b); return b;
  };

  /* ---------- end ---------- */
  K.end = function (score, extraHtml) {
    S.fanfare();
    var best = K.store.get('best', 0); var nb = score > best; if (nb) K.store.set('best', score);
    var extra = (extraHtml || '') + '<div style="margin-top:6px;font:800 14px ui-rounded,system-ui,sans-serif;opacity:.75">' + (nb && best > 0 ? 'New best!' : 'Best: ' + Math.max(best, score)) + '</div>';
    if (window.Brand && Brand.endScreen) return Brand.endScreen({ score: score, extraHtml: extra });
    return Promise.resolve();
  };

  /* ---------- gift wrap pattern ---------- */
  K.wrapCanvas = function (img, o) {
    o = o || {}; var b = K.brand(), S2 = o.size || 512; var c = document.createElement('canvas'); c.width = c.height = S2; var g = c.getContext('2d');
    var p = o.primary || b.primary, s = o.secondary || b.secondary, a = o.accent || b.accent, style = o.style || 0;
    g.fillStyle = p; g.fillRect(0, 0, S2, S2);
    g.save();
    if (style % 3 === 0) { g.strokeStyle = a; g.globalAlpha = .55; g.lineWidth = S2 / 26; for (var i = -S2; i < S2 * 2; i += S2 / 6) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + S2, S2); g.stroke(); } }
    else if (style % 3 === 1) { g.fillStyle = s; g.globalAlpha = .45; for (var y = 0; y < 4; y++) for (var x = 0; x < 4; x++) { if ((x + y) % 2) g.fillRect(x * S2 / 4, y * S2 / 4, S2 / 4, S2 / 4); } }
    else { g.fillStyle = '#fff'; g.globalAlpha = .7; for (var y2 = 0; y2 < 8; y2++) for (var x2 = 0; x2 < 8; x2++) { g.beginPath(); g.arc((x2 + (y2 % 2) * .5) * S2 / 8, (y2 + .5) * S2 / 8, S2 / 60, 0, 7); g.fill(); } }
    g.restore();
    if (img && o.logos !== false) {
      var pos = o.logos === 1 ? [[.5, .5, .5]] : [[.25, .25, .26], [.75, .75, .26]];
      pos.forEach(function (q) { var r = S2 * q[2] / 2; g.save(); g.fillStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = S2 / 50; g.beginPath(); g.arc(q[0] * S2, q[1] * S2, r, 0, 7); g.fill(); g.restore();
        g.save(); g.beginPath(); g.arc(q[0] * S2, q[1] * S2, r * .9, 0, 7); g.clip(); var ar = img.width / img.height || 1, w = r * 1.7, h = w / ar; if (h > r * 1.7) { h = r * 1.7; w = h * ar; } g.drawImage(img, q[0] * S2 - w / 2, q[1] * S2 - h / 2, w, h); g.restore(); });
    }
    return c;
  };
})();
