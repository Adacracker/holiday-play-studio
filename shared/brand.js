/*
 * Holiday Play Studio — shared brand runtime (window.Brand).
 * Spec: ../BRAND-SPEC.md. Include in <head> BEFORE the game script:
 *   <script src="../shared/brand.js"></script>
 *
 * Brand source priority: 1) URL hash #brand=<base64url(JSON)>  2) window.BRAND_CONFIG  3) defaults.
 * Live updates: parent page posts {type:'brand:update', brand:{...}} (partial objects are merged).
 *
 * API
 *   Brand.get()                 -> current brand object (copy). logo is always set (placeholder badge if none).
 *   Brand.onChange(fn)          -> fn(brand) now and on every update; returns an unsubscribe function.
 *   Brand.css()                 -> sets --brand-primary/--brand-secondary/--brand-accent/--brand-name on :root.
 *   Brand.logoImage()           -> Promise<HTMLImageElement> (loaded current logo).
 *   Brand.logoTexture(THREE)    -> Promise<THREE.Texture>; the same texture object is refreshed on live logo changes.
 *   Brand.endScreen({score, extraHtml}) -> shows the shared end card; Promise resolves when "Play again" is pressed.
 *   Brand.encode(obj)           -> '#brand=<base64url(JSON)>' (used by the storefront).
 *   Brand.decode(str)           -> object from a base64url string (or '#brand=...' string).
 *   Brand.placeholderLogo(name) -> data URL of the neutral initials badge.
 * No dependencies, no network calls (a logo given as an https URL is loaded by the browser only if a brand sets one).
 */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  if (window.Brand && window.Brand.__hp) return; // loaded twice

  var STUDIO = 'Holiday Play Studio';
  var DEFAULTS = {
    name: 'Your Brand',
    logo: '',
    primary: '#c62828',
    secondary: '#1b5e20',
    accent: '#ffd54f',
    message: 'Happy Holidays from {name}!',
    ctaText: 'Visit us',
    ctaUrl: '',
    showPoweredBy: true
  };

  var listeners = [];
  var current = null;          // resolved brand
  var logoIsPlaceholder = true;
  var imgPromise = null, imgFor = null;
  var textures = [];           // {THREE, tex}
  var endState = null;         // open end screen

  // ---------- helpers ----------
  function extend(dst) {
    for (var i = 1; i < arguments.length; i++) {
      var s = arguments[i];
      if (!s || typeof s !== 'object') continue;
      for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k) && s[k] !== undefined && s[k] !== null) dst[k] = s[k];
    }
    return dst;
  }

  function b64urlEncode(str) {
    var utf8 = unescape(encodeURIComponent(str));
    return btoa(utf8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return decodeURIComponent(escape(atob(s)));
  }

  function encode(obj) { return '#brand=' + b64urlEncode(JSON.stringify(obj || {})); }
  function decode(str) {
    str = String(str || '');
    var m = /(?:^|[#&?])brand=([^&]*)/.exec(str);
    var raw = m ? m[1] : str;
    try { raw = decodeURIComponent(raw); } catch (e) {}
    return JSON.parse(b64urlDecode(raw));
  }

  function fromHash() {
    var h = (location.hash || '');
    if (!/brand=/.test(h)) return null;
    try { var o = decode(h); return (o && typeof o === 'object') ? o : null; }
    catch (e) { try { console.warn('[Brand] could not read #brand hash:', e.message); } catch (_) {} return null; }
  }

  var colorCtx = null;
  function normColor(v) { // returns '#rrggbb' / 'rgba(...)' or null when invalid
    if (typeof v !== 'string' || !v.trim()) return null;
    v = v.trim();
    if (window.CSS && CSS.supports && !CSS.supports('color', v)) return null;
    try {
      if (!colorCtx) colorCtx = document.createElement('canvas').getContext('2d');
      colorCtx.fillStyle = '#010203';
      colorCtx.fillStyle = v;
      var out = colorCtx.fillStyle;
      if (out === '#010203' && v.toLowerCase() !== '#010203') return null;
      return out;
    } catch (e) { return v; }
  }
  function rgbOf(c) {
    c = normColor(c) || '#000000';
    var m;
    if ((m = /^#([0-9a-f]{6})$/i.exec(c))) { var n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
    if ((m = /rgba?\(([^)]+)\)/.exec(c))) { var p = m[1].split(','); return [+p[0], +p[1], +p[2]]; }
    return [0, 0, 0];
  }
  function lum(c) {
    var a = rgbOf(c).map(function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }
  function inkOn(c) { return lum(c) > 0.42 ? '#1a1a1a' : '#ffffff'; }
  function mix(c1, c2, t) {
    var a = rgbOf(c1), b = rgbOf(c2);
    return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' + Math.round(a[1] + (b[1] - a[1]) * t) + ',' + Math.round(a[2] + (b[2] - a[2]) * t) + ')';
  }

  function safeLogo(v) {
    if (typeof v !== 'string') return '';
    v = v.trim();
    if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml)[;,]/i.test(v)) return v;
    if (/^https?:\/\//i.test(v)) return v;
    if (/^(\.{0,2}\/)?[\w\-./]+\.(png|jpe?g|gif|webp|svg)$/i.test(v)) return v; // relative file in a delivered build
    return '';
  }
  function safeUrl(v) {
    if (typeof v !== 'string') return '';
    v = v.trim();
    if (/^https?:\/\//i.test(v) || /^mailto:/i.test(v) || /^tel:/i.test(v)) return v;
    if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(v)) return 'https://' + v; // "example.com/shop"
    return '';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var LETTER;
  try { LETTER = new RegExp('[\\p{L}\\p{N}]', 'u'); } catch (e) { LETTER = /[A-Za-z0-9À-ɏͰ-ϿЀ-ӿ]/; }
  function initials(name) {
    var words = String(name || '').replace(/['’]s\b/gi, '').split(/[\s\-_&+.,/]+/).filter(function (w) { return LETTER.test(w); });
    var out = '';
    for (var i = 0; i < words.length && out.length < 2; i++) {
      var m = words[i].match(LETTER);
      if (m) out += m[0];
    }
    return (out || '★').toUpperCase();
  }

  var placeholderCache = {};
  function placeholderLogo(name) {
    var ini = initials(name);
    if (placeholderCache[ini]) return placeholderCache[ini];
    var S = 256, c = document.createElement('canvas'); c.width = c.height = S;
    var g = c.getContext('2d');
    if (!g) return '';
    var cx = S / 2;
    // soft drop shadow ring
    g.beginPath(); g.arc(cx, cx + 3, 120, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fill();
    // outer ring
    g.beginPath(); g.arc(cx, cx, 120, 0, Math.PI * 2); g.fillStyle = '#e9e4da'; g.fill();
    // inner disc
    var grd = g.createLinearGradient(0, 20, 0, S - 20);
    grd.addColorStop(0, '#4a4f57'); grd.addColorStop(1, '#2b2f35');
    g.beginPath(); g.arc(cx, cx, 106, 0, Math.PI * 2); g.fillStyle = grd; g.fill();
    // thin inset line
    g.beginPath(); g.arc(cx, cx, 96, 0, Math.PI * 2); g.lineWidth = 2; g.strokeStyle = 'rgba(233,228,218,0.45)'; g.stroke();
    // initials
    g.fillStyle = '#f4efe6'; g.textAlign = 'center'; g.textBaseline = 'middle';
    var fs = ini.length > 1 ? 92 : 112;
    g.font = '700 ' + fs + 'px "Helvetica Neue", Helvetica, Arial, sans-serif';
    g.fillText(ini, cx, cx + 6);
    var url = c.toDataURL('image/png');
    placeholderCache[ini] = url;
    return url;
  }

  // ---------- resolve ----------
  function resolve(raw) {
    var b = extend({}, DEFAULTS, raw);
    b.name = String(b.name || '').trim().slice(0, 80) || DEFAULTS.name;
    b.primary = normColor(b.primary) || DEFAULTS.primary;
    b.secondary = normColor(b.secondary) || DEFAULTS.secondary;
    b.accent = normColor(b.accent) || DEFAULTS.accent;
    b.message = String(b.message || '').slice(0, 280) || DEFAULTS.message;
    b.ctaText = String(b.ctaText || '').slice(0, 40) || DEFAULTS.ctaText;
    b.ctaUrl = safeUrl(b.ctaUrl);
    b.showPoweredBy = !(b.showPoweredBy === false || b.showPoweredBy === 'false' || b.showPoweredBy === 0);
    var logo = safeLogo(b.logo);
    logoIsPlaceholder = !logo;
    b.logo = logo || placeholderLogo(b.name);
    return b;
  }

  var rawState = {}; // unresolved user input (so placeholder logo follows name changes)
  function setRaw(next, notify) {
    var prevLogo = current && current.logo;
    rawState = next;
    current = resolve(rawState);
    if (current.logo !== prevLogo) { imgPromise = null; refreshTextures(); }
    applyCss();
    if (endState) renderEnd();
    if (notify) emit();
  }
  function emit() {
    var snap = Brand.get();
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](snap); } catch (e) { try { console.error('[Brand] onChange handler failed', e); } catch (_) {} }
    }
  }

  function initial() {
    var cfg = (window.BRAND_CONFIG && typeof window.BRAND_CONFIG === 'object') ? window.BRAND_CONFIG : null;
    var h = fromHash();
    return extend({}, cfg, h);
  }

  // ---------- CSS vars ----------
  function applyCss() {
    var root = document.documentElement;
    if (!root || !current) return;
    var s = root.style;
    s.setProperty('--brand-primary', current.primary);
    s.setProperty('--brand-secondary', current.secondary);
    s.setProperty('--brand-accent', current.accent);
    s.setProperty('--brand-name', JSON.stringify(current.name));
    s.setProperty('--brand-on-primary', inkOn(current.primary));
    s.setProperty('--brand-on-secondary', inkOn(current.secondary));
    s.setProperty('--brand-on-accent', inkOn(current.accent));
  }

  // ---------- logo ----------
  function loadImage(src) {
    return new Promise(function (res, rej) {
      var img = new Image();
      if (/^https?:/i.test(src)) img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      img.onload = function () { res(img); };
      img.onerror = function () { rej(new Error('logo failed to load')); };
      img.src = src;
    });
  }
  function logoImage() {
    var src = current.logo;
    if (imgPromise && imgFor === src) return imgPromise;
    imgFor = src;
    imgPromise = loadImage(src).catch(function () {
      try { console.warn('[Brand] logo could not be loaded, using placeholder'); } catch (_) {}
      return loadImage(placeholderLogo(current.name));
    });
    return imgPromise;
  }
  function setTexImage(THREE, tex, img) {
    tex.image = img;
    if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    else if ('encoding' in tex && THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
    tex.needsUpdate = true;
  }
  function logoTexture(THREE) {
    if (!THREE || !THREE.Texture) return Promise.reject(new Error('Brand.logoTexture needs THREE'));
    var tex = new THREE.Texture();
    if (THREE.LinearFilter) tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    textures.push({ THREE: THREE, tex: tex });
    return logoImage().then(function (img) { setTexImage(THREE, tex, img); return tex; });
  }
  function refreshTextures() {
    if (!textures.length || !current) return;
    logoImage().then(function (img) {
      for (var i = 0; i < textures.length; i++) setTexImage(textures[i].THREE, textures[i].tex, img);
    });
  }

  // ---------- end screen ----------
  var CSS_ID = 'hp-brand-end-css';
  function injectCss() {
    if (document.getElementById(CSS_ID)) return;
    var st = document.createElement('style'); st.id = CSS_ID;
    st.textContent = [
      '.hp-end{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;',
      'background:rgba(8,14,12,.62);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);',
      'font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;opacity:0;transition:opacity .25s ease;',
      'touch-action:manipulation;-webkit-tap-highlight-color:transparent}',
      '.hp-end.hp-in{opacity:1}',
      '.hp-end *{box-sizing:border-box}',
      '.hp-card{position:relative;width:min(92vw,380px);max-height:calc(100vh - 32px);overflow:auto;border-radius:22px;text-align:center;',
      'padding:26px 22px 18px;background:#fffaf2;color:#1d1d1d;box-shadow:0 24px 60px rgba(0,0,0,.35),0 0 0 1px rgba(255,255,255,.4) inset;',
      'transform:translateY(14px) scale(.97);transition:transform .35s cubic-bezier(.2,.9,.3,1.2)}',
      '.hp-end.hp-in .hp-card{transform:none}',
      '.hp-ribbon{position:absolute;left:0;right:0;top:0;height:10px;border-radius:22px 22px 0 0;',
      'background:repeating-linear-gradient(135deg,var(--hp-p) 0 14px,var(--hp-a) 14px 18px,var(--hp-s) 18px 32px,var(--hp-a) 32px 36px)}',
      '.hp-logo{width:96px;height:96px;margin:6px auto 10px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;',
      'box-shadow:0 6px 18px rgba(0,0,0,.14),0 0 0 4px var(--hp-a);overflow:hidden}',
      '.hp-logo img{max-width:84%;max-height:84%;object-fit:contain;display:block}',
      '.hp-logo.hp-ph img{max-width:100%;max-height:100%}',
      '.hp-name{font-size:13px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;color:var(--hp-s);margin:0 0 6px}',
      '.hp-msg{font-size:22px;line-height:1.22;font-weight:800;margin:0 0 14px;color:#1d1d1d;text-wrap:balance}',
      '.hp-score{display:inline-flex;flex-direction:column;align-items:center;padding:8px 22px;border-radius:14px;margin:0 0 14px;',
      'background:var(--hp-tint)}',
      '.hp-score small{font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;opacity:.7}',
      '.hp-score b{font-size:40px;line-height:1.05;font-weight:900;color:var(--hp-p);font-variant-numeric:tabular-nums}',
      '.hp-extra{margin:0 0 12px;font-size:14px;line-height:1.4}',
      '.hp-btns{display:flex;flex-direction:column;gap:10px;margin-top:2px}',
      '.hp-btn{appearance:none;border:0;cursor:pointer;display:block;width:100%;padding:14px 18px;border-radius:999px;font:inherit;',
      'font-size:17px;font-weight:800;text-decoration:none;transition:transform .12s ease,filter .12s ease;min-height:48px}',
      '.hp-btn:active{transform:scale(.97)}',
      '.hp-btn:hover{filter:brightness(1.06)}',
      '.hp-btn:focus-visible{outline:3px solid var(--hp-a);outline-offset:3px}',
      '.hp-play{background:var(--hp-p);color:var(--hp-onp);box-shadow:0 6px 0 var(--hp-pd)}',
      '.hp-cta{background:transparent;color:var(--hp-s);box-shadow:inset 0 0 0 2px var(--hp-s)}',
      '.hp-credit{margin:14px 0 0;font-size:11px;opacity:.5;letter-spacing:.02em}',
      '@media (max-height:520px){.hp-card{padding:16px 18px 12px}.hp-logo{width:64px;height:64px;margin:4px auto 6px}',
      '.hp-msg{font-size:18px;margin-bottom:8px}.hp-score{margin-bottom:8px}.hp-score b{font-size:30px}.hp-btns{flex-direction:row}}',
      '@media (prefers-reduced-motion:reduce){.hp-end,.hp-card{transition:none}}'
    ].join('');
    (document.head || document.documentElement).appendChild(st);
  }

  function renderEnd() {
    if (!endState) return;
    var b = current, el = endState.el, o = endState.opts;
    el.style.setProperty('--hp-p', b.primary);
    el.style.setProperty('--hp-s', b.secondary);
    el.style.setProperty('--hp-a', b.accent);
    el.style.setProperty('--hp-onp', inkOn(b.primary));
    el.style.setProperty('--hp-pd', mix(b.primary, '#000000', 0.35));
    el.style.setProperty('--hp-tint', mix(b.accent, '#ffffff', 0.72));
    var msg = esc(b.message).replace(/\{name\}/g, esc(b.name));
    var hasScore = o.score !== undefined && o.score !== null && o.score !== '';
    var html = '<div class="hp-card" role="dialog" aria-modal="true" aria-label="' + esc(b.name) + '">' +
      '<div class="hp-ribbon"></div>' +
      '<div class="hp-logo' + (logoIsPlaceholder ? ' hp-ph' : '') + '"><img alt="' + esc(b.name) + ' logo" src="' + esc(b.logo) + '"></div>' +
      '<p class="hp-name">' + esc(b.name) + '</p>' +
      '<p class="hp-msg">' + msg + '</p>' +
      (hasScore ? '<div class="hp-score"><small>' + esc(o.scoreLabel || 'Your score') + '</small><b>' + esc(o.score) + '</b></div>' : '') +
      (o.extraHtml ? '<div class="hp-extra">' + o.extraHtml + '</div>' : '') +
      '<div class="hp-btns">' +
      '<button type="button" class="hp-btn hp-play" data-hp="again">Play again</button>' +
      (b.ctaUrl ? '<a class="hp-btn hp-cta" data-hp="cta" href="' + esc(b.ctaUrl) + '" target="_blank" rel="noopener noreferrer">' + esc(b.ctaText) + '</a>' : '') +
      '</div>' +
      (b.showPoweredBy ? '<p class="hp-credit">game by ' + esc(STUDIO) + '</p>' : '') +
      '</div>';
    var hadFocus = document.activeElement && el.contains(document.activeElement);
    el.innerHTML = html;
    if (hadFocus || !endState.focused) {
      endState.focused = true;
      var btn = el.querySelector('.hp-play');
      try { btn && btn.focus({ preventScroll: true }); } catch (e) {}
    }
  }

  function closeEnd(resolveIt) {
    if (!endState) return;
    var st = endState; endState = null;
    document.removeEventListener('keydown', st.onKey, true);
    st.el.classList.remove('hp-in');
    setTimeout(function () { if (st.el.parentNode) st.el.parentNode.removeChild(st.el); }, 260);
    if (resolveIt) st.resolve();
  }

  function endScreen(opts) {
    opts = opts || {};
    if (endState) closeEnd(false);
    injectCss();
    return new Promise(function (resolve) {
      var el = document.createElement('div');
      el.className = 'hp-end';
      var st = { el: el, opts: opts, resolve: resolve, focused: false };
      // keep pointer/touch input from leaking to the game underneath
      ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'click', 'wheel', 'contextmenu'].forEach(function (t) {
        el.addEventListener(t, function (e) {
          e.stopPropagation();
          var hit = e.target && e.target.closest && e.target.closest('[data-hp]');
          if (t === 'click' && hit && hit.getAttribute('data-hp') === 'again') { e.preventDefault(); closeEnd(true); }
        }, false);
      });
      st.onKey = function (e) {
        if (!endState) return;
        var k = e.key;
        if (k === 'Enter' || k === ' ' || k === 'Spacebar') {
          var a = document.activeElement;
          if (a && a.getAttribute && a.getAttribute('data-hp') === 'cta') return; // let the link work
          e.preventDefault(); e.stopPropagation(); closeEnd(true);
        } else if (k !== 'Tab') { e.stopPropagation(); }
      };
      endState = st;
      var mount = function () {
        (document.body || document.documentElement).appendChild(el);
        renderEnd();
        document.addEventListener('keydown', st.onKey, true);
        requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('hp-in'); }); });
      };
      if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
    });
  }

  // ---------- public ----------
  var Brand = {
    __hp: true,
    studio: STUDIO,
    defaults: extend({}, DEFAULTS),
    get: function () { return extend({}, current); },
    onChange: function (fn) {
      if (typeof fn !== 'function') return function () {};
      listeners.push(fn);
      try { fn(Brand.get()); } catch (e) { try { console.error('[Brand] onChange handler failed', e); } catch (_) {} }
      return function () { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
    },
    css: function () { applyCss(); return Brand.get(); },
    logoImage: function () { return logoImage(); },
    logoTexture: logoTexture,
    endScreen: endScreen,
    encode: encode,
    decode: decode,
    placeholderLogo: placeholderLogo,
    isPlaceholderLogo: function () { return logoIsPlaceholder; },
    inkOn: inkOn
  };
  window.Brand = Brand;

  setRaw(initial(), false);

  // live updates from a parent page (storefront preview) or same window
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || typeof d !== 'object' || d.type !== 'brand:update' || !d.brand || typeof d.brand !== 'object') return;
    if (e.source && e.source !== window.parent && e.source !== window) return;
    var next = d.replace ? extend({}, d.brand) : extend({}, rawState, d.brand);
    setRaw(next, true);
  });
  window.addEventListener('hashchange', function () {
    var h = fromHash();
    if (h) setRaw(extend({}, rawState, h), true);
  });
  // let an embedding page know we're listening (it may re-send a large logo by postMessage)
  try { if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'brand:ready' }, '*'); } catch (e) {}
})();
