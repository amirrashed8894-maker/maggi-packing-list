/*! Alola shared login gate v9 — v9: staff stay signed in on their one bound phone (1-year session renewed on every open,
    self-healing after a server store wipe, «برامجي» to open their other apps without a password); «خروج» still needs the password.
    v8.1 — talks to alola-maggi-auth. v8: Amir's paired phone/Mac is remembered for good
    (silent re-entry, self-healing pairing proof, one-tap switch between apps); staff login unchanged. */
(function () {
  'use strict';
  var API = (window.ALOLA_AUTH_API || 'https://alola-maggi-auth.onrender.com').replace(/\/$/, '');
  var TOKEN_KEY = 'alola_auth_token';
  var DEVICE_KEY = 'alola_device_id';
  var USER_KEY = 'alola_auth_user';
  var APP = (function () {
    if (window.ALOLA_AUTH_APP) return String(window.ALOLA_AUTH_APP);
    var h = String(location.hostname || '');
    if (h.indexOf('maggi-packing-list') !== -1) return 'maggi';
    if (h.indexOf('alola-packing-list') !== -1) return 'packing';
    if (h.indexOf('alola-receiving') !== -1) return 'receiving';
    if (h.indexOf('alola-production') !== -1) return 'production';
    if (h.indexOf('alola-quality') !== -1) return 'quality';
    if (h.indexOf('paper-handover') !== -1) return 'handover';
    if (h.indexOf('alola-cost-statement') !== -1) return 'cost';
    return '';
  })();
  var AMIR_APPS = ['packing', 'production', 'quality', 'receiving', 'handover', 'cost', 'maggi'];
  var PROOF_KEY = 'alola_amir_proof';   // last quick-entry token: proof this device was paired (kept on logout)
  var OUT_KEY = 'alola_amir_out';       // Amir pressed «خروج»: no automatic re-entry until he taps «دخول أمير»
  var HANDOFF = (function () {          // one-time link from another Alola app (#amir-handoff=…)
    try {
      var m = /[#&]amir-handoff=([A-Za-z0-9_.-]+)/.exec(location.hash || '');
      if (!m) return '';
      history.replaceState(history.state, '', location.pathname + location.search);
      return m[1];
    } catch (e) { return ''; }
  })();
  var STAFF_HANDOFF = (function () {    // one-time link for staff from another Alola app (#staff-handoff=…)
    try {
      var m = /[#&]staff-handoff=([A-Za-z0-9_.-]+)/.exec(location.hash || '');
      if (!m) return '';
      history.replaceState(history.state, '', location.pathname + location.search);
      return m[1];
    } catch (e) { return ''; }
  })();
  function isStaff(user) { return !!(user && user.username && user.username !== 'amir' && !user.multiDevice); }
  function keepStorage() { try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {}); } catch (e) {} }
  var OTHER_APPS = [['production', 'الإنتاج اليومي'], ['packing', 'باكينج ليست العلا'], ['quality', 'الجودة'], ['receiving', 'استلام الخام'], ['cost', 'بيان التكلفة'], ['handover', 'تسليم أصول ورق'], ['maggi', 'باكينج ليست ماجي']];
  var APP_TITLES = { production: 'الإنتاج اليومي — العلا', quality: 'الجودة — العلا', receiving: 'استلام الخام — العلا', packing: 'باكينج ليست العلا', maggi: 'باكينج ليست ماجي', cost: 'بيان التكلفة — العلا', handover: 'تسليم أصول ورق' };
  // wake the free auth server early (cold start) while the user is typing
  var wakeP = null;
  function wake() {
    if (wakeP) return wakeP;
    try { wakeP = fetch(API + '/health', { cache: 'no-store' }).catch(function () { wakeP = null; }); } catch (e) { wakeP = null; }
    return wakeP;
  }
  function appAllowed(user) {
    return !!(user && Array.isArray(user.apps) && user.apps.indexOf(APP) !== -1);
  }

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function deviceId() {
    try {
      var id = localStorage.getItem(DEVICE_KEY);
      if (id && id.length >= 16) return id;
      id = uuid();
      localStorage.setItem(DEVICE_KEY, id);
      return id;
    } catch (e) {
      return uuid();
    }
  }

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }
  function setSession(token, user) {
    rememberAmir(token, user);
    if (isStaff(user)) keepStorage(); // ask Safari/Chrome to keep the device id + session

    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user || {}));
    } catch (e) {}
  }
  function clearSession() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch (e) {}
  }
  function lsGet(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function lsSet(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) {} }
  function quickToken(t) { // quick-entry tokens carry the app id ("a")
    try { var p = JSON.parse(atob(String(t).split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))); return !!(p && p.u === 'amir' && p.a === APP && p.m === true); } catch (e) { return false; }
  }
  function rememberAmir(token, user) {
    if (user && user.username === 'amir' && AMIR_APPS.indexOf(APP) !== -1 && quickToken(token)) {
      lsSet(PROOF_KEY, token); lsSet(OUT_KEY, ''); lsSet('alola_amir_paired', '1');
      // ask Safari/Chrome to keep this site's storage (device id + proof) instead of evicting it
      try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {}); } catch (e) {}
    }
  }
  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (e) { return null; }
  }

  function injectStyles() {
    if (document.getElementById('alola-auth-css')) return;
    var s = document.createElement('style');
    s.id = 'alola-auth-css';
    s.textContent = [
      'html.alola-auth-lock body > *:not(#alola-auth-overlay){visibility:hidden!important}',
      '#alola-auth-overlay{position:fixed;inset:0;z-index:2147483000;background:linear-gradient(160deg,#1d4d2b 0%,#2F5233 45%,#0f2a18 100%);display:flex;align-items:center;justify-content:center;padding:16px;font-family:"Segoe UI",Tahoma,"Noto Sans Arabic",Cairo,Arial,sans-serif;direction:rtl}',
      '#alola-auth-overlay .box{width:100%;max-width:380px;background:#fff;border-radius:18px;padding:22px 18px;box-shadow:0 12px 40px #0005}',
      '#alola-auth-overlay h2{margin:0 0 6px;font-size:20px;color:#1d4d2b;text-align:center}',
      '#alola-auth-overlay .sub{margin:0 0 14px;font-size:13px;color:#666;text-align:center;line-height:1.5}',
      '#alola-auth-overlay label{display:block;font-size:13px;color:#444;margin:10px 0 4px}',
      '#alola-auth-overlay input{width:100%;box-sizing:border-box;min-height:46px;font-size:16px;padding:10px 12px;border:1.5px solid #ccc;border-radius:10px;font-family:inherit;direction:ltr;text-align:left}',
      '#alola-auth-overlay input:focus{outline:none;border-color:#4a7c50;box-shadow:0 0 0 3px #4a7c5033}',
      '#alola-auth-overlay button.login{width:100%;margin-top:14px;min-height:48px;border:0;border-radius:12px;background:#1d4d2b;color:#fff;font:inherit;font-size:16px;font-weight:700;cursor:pointer}',
      '#alola-auth-overlay button.login:disabled{opacity:.6;cursor:wait}',
      '#alola-auth-overlay button.amir{width:100%;margin-top:10px;min-height:48px;border:1.5px solid #1d4d2b;border-radius:12px;background:#f4f8f4;color:#1d4d2b;font:inherit;font-size:16px;font-weight:700;cursor:pointer}',
      '#alola-auth-overlay button.amir:disabled{opacity:.6;cursor:wait}',
      '#alola-auth-overlay #alola-auth-code{text-align:center;letter-spacing:3px;font-size:20px}',
      '#alola-auth-overlay .err{min-height:20px;margin-top:10px;color:#b42318;font-size:13.5px;text-align:center;line-height:1.4}',
      '#alola-auth-overlay .hint{margin-top:12px;font-size:12px;color:#777;text-align:center;line-height:1.5}',
      '#alola-auth-bar{position:fixed;top:0;left:0;z-index:2147482990;display:flex;gap:6px;padding:4px;pointer-events:none}',
      '#alola-auth-bar button{pointer-events:auto;border:0;border-radius:8px;padding:4px 8px;font-size:11px;background:#0008;color:#fff;cursor:pointer;font-family:inherit}',
      '#alola-auth-admin{position:fixed;inset:0;z-index:2147483010;background:#000a;display:none;align-items:center;justify-content:center;padding:16px;font-family:inherit;direction:rtl}',
      '#alola-auth-admin .box{background:#fff;border-radius:14px;padding:16px;max-width:420px;width:100%}',
      '#alola-auth-admin h3{margin:0 0 10px;color:#1d4d2b}',
      '#alola-auth-admin .row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid #eee;font-size:14px}',
      '#alola-auth-admin button{border:0;border-radius:8px;padding:8px 10px;background:#1d4d2b;color:#fff;font:inherit;cursor:pointer}',
      '#alola-auth-admin button.x{background:#eee;color:#333}',
      '#alola-auth-admin .msg{font-size:13px;color:#166534;min-height:18px;margin-top:8px}'
    ].join('');
    document.head.appendChild(s);
  }

  function showOverlay() {
    document.documentElement.classList.add('alola-auth-lock');
    var el = document.getElementById('alola-auth-overlay');
    if (el) { el.style.display = 'flex'; return el; }
    el = document.createElement('div');
    el.id = 'alola-auth-overlay';
    el.innerHTML = [
      '<div class="box">',
      '<h2>تسجيل الدخول</h2>',
      '<p class="sub">' + (APP_TITLES[APP] || 'برامج العلا') + ' — أدخل اليوزر والباسورد</p>',
      '<label>اليوزر</label>',
      '<input id="alola-auth-user" autocomplete="username" autocapitalize="off" spellcheck="false">',
      '<label>الباسورد</label>',
      '<input id="alola-auth-pass" type="password" autocomplete="current-password">',
      '<button class="login" id="alola-auth-go" type="button">دخول</button>',
      AMIR_APPS.indexOf(APP) !== -1 ? '<button class="amir" id="alola-auth-amir" type="button">دخول أمير</button>' : '',
      '<div class="err" id="alola-auth-err"></div>',
      '<div class="hint">كل حساب يشتغل على جهاز واحد فقط (ما عدا أمير)</div>',
      '</div>'
    ].join('');
    document.body.appendChild(el);
    var go = function () { doLogin(); };
    document.getElementById('alola-auth-go').addEventListener('click', go);
    var amirBtn = document.getElementById('alola-auth-amir');
    if (amirBtn) amirBtn.addEventListener('click', function () { doAmirLogin(false); });
    document.getElementById('alola-auth-pass').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') go();
    });
    document.getElementById('alola-auth-user').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') document.getElementById('alola-auth-pass').focus();
    });
    setTimeout(function () {
      var u = document.getElementById('alola-auth-user');
      if (u) u.focus();
    }, 50);
    return el;
  }

  function hideOverlay() {
    document.documentElement.classList.remove('alola-auth-lock');
    var el = document.getElementById('alola-auth-overlay');
    if (el) el.remove();
  }

  async function api(path, opts) {
    opts = opts || {};
    var headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    var token = getToken();
    if (token && !headers.Authorization) headers.Authorization = 'Bearer ' + token;
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var t = ctrl ? setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, opts.timeout || 45000) : null;
    try {
      var res = await fetch(API + path, {
        method: opts.method || 'GET',
        headers: headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: ctrl ? ctrl.signal : undefined
      });
      var data = null;
      try { data = await res.json(); } catch (e) { data = { ok: false, error: 'رد غير مفهوم من السيرفر' }; }
      return { status: res.status, data: data };
    } finally {
      if (t) clearTimeout(t);
    }
  }

  async function doLogin() {
    var uEl = document.getElementById('alola-auth-user');
    var pEl = document.getElementById('alola-auth-pass');
    var eEl = document.getElementById('alola-auth-err');
    var bEl = document.getElementById('alola-auth-go');
    var username = (uEl && uEl.value || '').trim();
    var password = pEl && pEl.value || '';
    if (!username || !password) {
      if (eEl) eEl.textContent = 'أدخل اليوزر والباسورد';
      return;
    }
    if (eEl) eEl.textContent = '';
    if (bEl) { bEl.disabled = true; bEl.textContent = 'جاري الدخول…'; }
    try {
      var body = { username: username, password: password, deviceId: deviceId(), app: APP, label: devLabel() };
      var r;
      try {
        r = await api('/api/login', { method: 'POST', body: body, timeout: 60000 });
      } catch (e1) {
        if (eEl) eEl.textContent = 'السيرفر بيصحى… لحظات';
        r = await api('/api/login', { method: 'POST', body: body, timeout: 90000 });
        if (eEl) eEl.textContent = '';
      }
      if (!r.data || !r.data.ok) {
        if (r.status === 403 && r.data && r.data.code === 'APP_DENIED') clearSession();
        if (eEl) eEl.textContent = (r.data && r.data.error) || 'فشل الدخول';
        return;
      }
      setSession(r.data.token, r.data.user);
      hideOverlay();
      mountBar(r.data.user);
    } catch (err) {
      if (eEl) eEl.textContent = 'تعذر الاتصال بخادم الدخول. حاول مرة أخرى بعد لحظات.';
    } finally {
      if (bEl) { bEl.disabled = false; bEl.textContent = 'دخول'; }
    }
  }

  var PAIRED_KEY = 'alola_amir_paired';
  function devLabel() {
    var ua = navigator.userAgent || '';
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/iPad/.test(ua)) return 'iPad';
    if (/Android/.test(ua)) return 'Android';
    if (/Macintosh|Mac OS X/.test(ua)) return 'Mac';
    if (/Windows/.test(ua)) return 'Windows';
    return 'جهاز';
  }
  function showPairBox() {
    var box = document.getElementById('alola-auth-pairbox');
    if (box) { box.style.display = 'block'; var i0 = document.getElementById('alola-auth-code'); if (i0) i0.focus(); return; }
    var amirBtn = document.getElementById('alola-auth-amir');
    if (!amirBtn) return;
    box = document.createElement('div');
    box.id = 'alola-auth-pairbox';
    box.innerHTML = '<label>كود ربط جهاز أمير (أول مرة بس على الجهاز ده)</label>' +
      '<input id="alola-auth-code" inputmode="numeric" autocomplete="one-time-code" maxlength="12" placeholder="8 أرقام">' +
      '<button class="amir" id="alola-auth-pair" type="button">ربط الجهاز والدخول</button>';
    amirBtn.parentNode.insertBefore(box, amirBtn.nextSibling);
    amirBtn.style.display = 'none';
    document.getElementById('alola-auth-pair').addEventListener('click', function () { doAmirLogin(true); });
    document.getElementById('alola-auth-code').addEventListener('keydown', function (e) { if (e.key === 'Enter') doAmirLogin(true); });
    setTimeout(function () { var i = document.getElementById('alola-auth-code'); if (i) i.focus(); }, 50);
  }

  async function doAmirLogin(withCode) {
    var eEl = document.getElementById('alola-auth-err');
    var bEl = document.getElementById(withCode ? 'alola-auth-pair' : 'alola-auth-amir');
    var bTxt = bEl ? bEl.textContent : '';
    if (eEl) eEl.textContent = '';
    var body = { deviceId: deviceId(), app: APP, label: devLabel(), proof: lsGet(PROOF_KEY) };
    if (withCode) {
      var cEl = document.getElementById('alola-auth-code');
      body.code = String(cEl && cEl.value || '').replace(/\D/g, '');
      if (body.code.length < 8) { if (eEl) eEl.textContent = 'اكتب كود الربط (8 أرقام)'; return; }
    }
    if (bEl) { bEl.disabled = true; bEl.textContent = 'جاري الدخول…'; }
    try {
      var r;
      try {
        r = await api('/api/login-amir', { method: 'POST', body: body, timeout: 60000 });
      } catch (e1) {
        if (eEl) eEl.textContent = 'السيرفر بيصحى… لحظات';
        r = await api('/api/login-amir', { method: 'POST', body: body, timeout: 90000 });
        if (eEl) eEl.textContent = '';
      }
      if (!r.data || !r.data.ok) {
        var code = r.data && r.data.code;
        if (code === 'PAIR_REQUIRED' || code === 'PAIR_BAD') showPairBox();
        if (eEl) eEl.textContent = (r.data && r.data.error) || 'فشل الدخول';
        return;
      }
      setSession(r.data.token, r.data.user);
      try { localStorage.setItem(PAIRED_KEY, '1'); } catch (e) {}
      hideOverlay();
      mountBar(r.data.user);
    } catch (e) {
      if (eEl) eEl.textContent = 'تعذر الاتصال بخادم الدخول. حاول مرة أخرى بعد لحظات.';
    } finally {
      if (bEl) { bEl.disabled = false; bEl.textContent = bTxt; }
    }
  }

  function mountBar(user) {
    var old = document.getElementById('alola-auth-bar');
    if (old) old.remove();
    var bar = document.createElement('div');
    bar.id = 'alola-auth-bar';
    var label = (user && user.label) || (user && user.username) || '';
    bar.innerHTML = '<button type="button" id="alola-auth-out" title="خروج">خروج' + (label ? ' · ' + label : '') + '</button>' +
      (user && user.admin ? '<button type="button" id="alola-auth-adm" title="إدارة الأجهزة">إدارة الأجهزة</button>' : '') +
      ((user && user.username === 'amir' && quickToken(getToken())) || staffApps(user).length ? '<button type="button" id="alola-auth-apps" title="افتح برنامج تاني من غير باسورد">برامجي</button>' : '');
    document.body.appendChild(bar);
    document.getElementById('alola-auth-out').onclick = function () {
      if (user && user.username === 'amir') lsSet(OUT_KEY, '1');
      clearSession();
      location.reload();
    };
    var adm = document.getElementById('alola-auth-adm');
    if (adm) adm.onclick = openAdmin;
    var apps = document.getElementById('alola-auth-apps');
    if (apps) apps.onclick = function () { openApps(user); };
  }

  function staffApps(user) {
    if (!isStaff(user) || !Array.isArray(user.apps)) return [];
    return OTHER_APPS.filter(function (a) { return a[0] !== APP && user.apps.indexOf(a[0]) !== -1; });
  }
  function openApps(user) {
    var staff = isStaff(user);
    var list = staff ? staffApps(user) : OTHER_APPS.filter(function (a) { return a[0] !== APP; });
    var panel = document.getElementById('alola-auth-admin');
    if (panel) panel.remove();
    panel = document.createElement('div');
    panel.id = 'alola-auth-admin';
    panel.innerHTML = '<div class="box"><h3>برامجي</h3><div style="font-size:13px;color:#666;margin-bottom:6px">افتح أي برنامج وانت داخل على طول — والتليفون ده هيتفتكر فيه كمان.</div>' +
      list.map(function (a) { return '<div class="row"><span><b>' + a[1] + '</b></span><button type="button" data-to="' + a[0] + '">فتح</button></div>'; }).join('') +
      '<div class="msg" id="alola-auth-amsg"></div><div style="margin-top:12px;text-align:left"><button type="button" class="x" id="alola-auth-aclose">إغلاق</button></div></div>';
    document.body.appendChild(panel);
    panel.style.display = 'flex';
    document.getElementById('alola-auth-aclose').onclick = function () { panel.remove(); };
    panel.querySelectorAll('button[data-to]').forEach(function (b) {
      b.onclick = async function () {
        var msg = document.getElementById('alola-auth-amsg');
        b.disabled = true; msg.textContent = 'جاري الفتح…';
        try {
          var r = await api(staff ? '/api/staff-handoff' : '/api/amir-handoff', { method: 'POST', body: { to: b.getAttribute('data-to'), app: APP } });
          if (r.data && r.data.ok && r.data.url) { location.href = r.data.url; return; }
          msg.textContent = (r.data && r.data.error) || 'تعذر الفتح';
        } catch (e) { msg.textContent = 'تعذر الاتصال بالسيرفر'; }
        b.disabled = false;
      };
    });
  }

  // Amir's device: enter silently (paired list, or signed pairing proof, or a handoff link). true = signed in.
  async function silentAmir(handoff) {
    if (AMIR_APPS.indexOf(APP) === -1) return false;
    var proof = lsGet(PROOF_KEY);
    if (!handoff && (!proof || lsGet(OUT_KEY) === '1')) return false;
    var body = { deviceId: deviceId(), app: APP, label: devLabel(), proof: proof };
    if (handoff) body.handoff = handoff;
    var r = await api('/api/login-amir', { method: 'POST', body: body, timeout: 90000 });
    if (r.data && r.data.ok) {
      setSession(r.data.token, r.data.user);
      hideOverlay();
      mountBar(r.data.user);
      return true;
    }
    if (r.data && r.data.code === 'PAIR_REQUIRED' && !handoff) lsSet(PROOF_KEY, '');
    return r.data && r.data.error ? r.data.error : false;
  }
  function busyOverlay() {
    showOverlay();
    var e = document.getElementById('alola-auth-err');
    if (e) e.textContent = 'جاري دخول أمير تلقائي…';
  }

  async function openAdmin() {
    var panel = document.getElementById('alola-auth-admin');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'alola-auth-admin';
      panel.innerHTML = '<div class="box"><h3>إعادة ربط الأجهزة</h3><div id="alola-auth-devlist">جاري التحميل…</div><div class="msg" id="alola-auth-amsg"></div><div style="margin-top:12px;text-align:left"><button type="button" class="x" id="alola-auth-aclose">إغلاق</button></div></div>';
      document.body.appendChild(panel);
      document.getElementById('alola-auth-aclose').onclick = function () { panel.style.display = 'none'; };
    }
    panel.style.display = 'flex';
    var list = document.getElementById('alola-auth-devlist');
    var msg = document.getElementById('alola-auth-amsg');
    msg.textContent = '';
    list.textContent = 'جاري التحميل…';
    try {
      var ra = await api('/api/admin/amir-devices?app=' + encodeURIComponent(APP));
      var amirHtml = '';
      if (ra.data && ra.data.ok && ra.data.devices && ra.data.devices.length) {
        amirHtml = '<div style="font-weight:700;margin:4px 0">أجهزة أمير في البرنامج ده (حد أقصى ' + (ra.data.max || 2) + ')</div>' +
          ra.data.devices.map(function (d) {
            var dt = d.at ? new Date(d.at).toLocaleDateString('en-GB', { timeZone: 'Africa/Cairo' }) : '';
            return '<div class="row"><span><b>' + String(d.label || 'جهاز').replace(/[<>&]/g, '') + '</b>' + (d.current ? ' (الجهاز ده)' : '') + '<br><small style="color:#666">مربوط ' + dt + '</small></span>' +
              '<button type="button" data-n="' + d.n + '"' + (d.current ? ' data-self="1"' : '') + '>فصل</button></div>';
          }).join('') + '<div style="font-weight:700;margin:12px 0 4px">حسابات الموظفين</div>';
      }
      var r = await api('/api/admin/devices?app=' + encodeURIComponent(APP));
      if (!r.data || !r.data.ok) {
        list.textContent = (r.data && r.data.error) || 'تعذر التحميل';
        return;
      }
      var devices = r.data.devices || {};
      var names = Object.keys(devices);
      if (!names.length) { list.innerHTML = amirHtml + 'لا يوجد حسابات مربوطة'; return; }
      list.innerHTML = amirHtml + names.map(function (u) {
        var bound = devices[u] ? 'مربوط' : 'غير مربوط';
        return '<div class="row"><span><b>' + u + '</b><br><small style="color:#666">' + bound + '</small></span><button type="button" data-u="' + u + '">فك الربط</button></div>';
      }).join('');
      list.querySelectorAll('button[data-n]').forEach(function (btn) {
        btn.onclick = async function () {
          if (btn.getAttribute('data-self') && !confirm('فصل الجهاز ده؟ هتحتاج كود الربط عشان تدخل تاني منه')) return;
          msg.textContent = '';
          btn.disabled = true;
          try {
            var rr = await api('/api/admin/amir-unpair?app=' + encodeURIComponent(APP), { method: 'POST', body: { n: Number(btn.getAttribute('data-n')), app: APP } });
            msg.textContent = (rr.data && (rr.data.message || rr.data.error)) || 'تم';
            if (rr.data && rr.data.ok && rr.data.self) { try { localStorage.removeItem(PAIRED_KEY); localStorage.removeItem(PROOF_KEY); } catch (e3) {} clearSession(); setTimeout(function () { location.reload(); }, 1200); return; }
            openAdmin();
          } catch (e) {
            msg.textContent = 'فشل الفصل';
            btn.disabled = false;
          }
        };
      });
      list.querySelectorAll('button[data-u]').forEach(function (btn) {
        btn.onclick = async function () {
          msg.textContent = '';
          btn.disabled = true;
          try {
            var rr = await api('/api/admin/reset-device?app=' + encodeURIComponent(APP), { method: 'POST', body: { username: btn.getAttribute('data-u') } });
            msg.textContent = (rr.data && (rr.data.message || rr.data.error)) || 'تم';
            openAdmin();
          } catch (e) {
            msg.textContent = 'فشل فك الربط';
            btn.disabled = false;
          }
        };
      });
    } catch (e) {
      list.textContent = 'تعذر الاتصال بالسيرفر';
    }
  }

  async function boot() {
    injectStyles();
    wake();
    var token = getToken();
    var amirDev = AMIR_APPS.indexOf(APP) !== -1 && !!lsGet(PROOF_KEY) && lsGet(OUT_KEY) !== '1';
    if (STAFF_HANDOFF) {
      showOverlay();
      var se0 = document.getElementById('alola-auth-err');
      if (se0) se0.textContent = 'جاري الدخول…';
      try {
        var shr = await api('/api/login-handoff', { method: 'POST', body: { handoff: STAFF_HANDOFF, deviceId: deviceId(), app: APP, label: devLabel() }, timeout: 90000 });
        if (shr.data && shr.data.ok) { setSession(shr.data.token, shr.data.user); hideOverlay(); mountBar(shr.data.user); return; }
        if (!token && se0) { se0.textContent = (shr.data && shr.data.error) || 'تعذر الدخول من الرابط'; return; }
      } catch (e) {
        if (!token) { if (se0) se0.textContent = 'السيرفر بيصحى… افتح الرابط تاني بعد لحظات'; return; }
      }
    }
    if (HANDOFF) {
      busyOverlay();
      try {
        var hr = await silentAmir(HANDOFF);
        if (hr === true) return;
        var he = document.getElementById('alola-auth-err');
        if (he) he.textContent = typeof hr === 'string' ? hr : 'تعذر الدخول من الرابط';
      } catch (e) {
        var he2 = document.getElementById('alola-auth-err');
        if (he2) he2.textContent = 'السيرفر بيصحى… افتح الرابط تاني بعد لحظات';
      }
      return;
    }
    if (!token) {
      if (amirDev) {
        busyOverlay();
        var sr = false;
        try { sr = await silentAmir(); if (sr === true) return; } catch (e) { sr = 'السيرفر بيصحى… اضغط «دخول أمير» بعد لحظات'; }
        var se = document.getElementById('alola-auth-err');
        if (se) se.textContent = typeof sr === 'string' ? sr : '';
        return;
      }
      showOverlay();
      return;
    }
    try {
      var r = await api('/api/me?app=' + encodeURIComponent(APP), { timeout: 60000 });
      if (r.data && r.data.ok) {
        setSession(r.data.token || token, r.data.user);
        hideOverlay();
        mountBar(r.data.user);
        return;
      }
      if (r.status === 503 && r.data && r.data.code === 'STORE_DOWN') throw new Error('store down');
      if (amirDev || quickToken(token)) {
        if (!lsGet(PROOF_KEY) && quickToken(token)) lsSet(PROOF_KEY, token);
        busyOverlay();
        var ar = await silentAmir();
        if (ar === true) return;
      }
      clearSession();
      if (r.data && r.data.code === 'AMIR_DEVICE' && !lsGet(PROOF_KEY)) { try { localStorage.removeItem(PAIRED_KEY); } catch (e) {} }
      showOverlay();
      if (r.data && r.data.error) {
        var el = document.getElementById('alola-auth-err');
        if (el) el.textContent = r.data.error;
      }
    } catch (e) {
      // Auth server cold start / offline: keep session optimistically if token present & not expired-looking
      var user = getUser();
      var pairedOk = true;
      if (user && user.username === 'amir' && AMIR_APPS.indexOf(APP) !== -1) {
        pairedOk = quickToken(token) || lsGet(PAIRED_KEY) === '1';
      }
      if (user && user.username && appAllowed(user) && pairedOk) {
        hideOverlay();
        mountBar(user);
        return;
      }
      showOverlay();
      var err = document.getElementById('alola-auth-err');
      if (err) err.textContent = 'السيرفر بيصحى… اضغط دخول بعد لحظات';
    }
  }

  window.AlolaAuth = {
    logout: function () { clearSession(); location.reload(); },
    user: getUser,
    apiBase: API
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
