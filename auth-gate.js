/*! Alola/Maggi shared login gate — talks to alola-maggi-auth */
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
    if (h.indexOf('alola-production') !== -1) return 'production';
    if (h.indexOf('alola-quality') !== -1) return 'quality';
    return '';
  })();
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
      '<p class="sub">برامج العلا وماجي — أدخل اليوزر والباسورد</p>',
      '<label>اليوزر</label>',
      '<input id="alola-auth-user" autocomplete="username" autocapitalize="off" spellcheck="false">',
      '<label>الباسورد</label>',
      '<input id="alola-auth-pass" type="password" autocomplete="current-password">',
      '<button class="login" id="alola-auth-go" type="button">دخول</button>',
      '<div class="err" id="alola-auth-err"></div>',
      '<div class="hint">غير حساب أمير: الحساب مربوط بتليفون واحد فقط</div>',
      '</div>'
    ].join('');
    document.body.appendChild(el);
    var go = function () { doLogin(); };
    document.getElementById('alola-auth-go').addEventListener('click', go);
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
      var r = await api('/api/login', {
        method: 'POST',
        body: { username: username, password: password, deviceId: deviceId(), app: APP },
        timeout: 60000
      });
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

  function mountBar(user) {
    var old = document.getElementById('alola-auth-bar');
    if (old) old.remove();
    var bar = document.createElement('div');
    bar.id = 'alola-auth-bar';
    var label = (user && user.label) || (user && user.username) || '';
    bar.innerHTML = '<button type="button" id="alola-auth-out" title="خروج">خروج' + (label ? ' · ' + label : '') + '</button>' +
      (user && user.admin ? '<button type="button" id="alola-auth-adm" title="إدارة الأجهزة">إدارة الأجهزة</button>' : '');
    document.body.appendChild(bar);
    document.getElementById('alola-auth-out').onclick = function () {
      clearSession();
      location.reload();
    };
    var adm = document.getElementById('alola-auth-adm');
    if (adm) adm.onclick = openAdmin;
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
      var r = await api('/api/admin/devices');
      if (!r.data || !r.data.ok) {
        list.textContent = (r.data && r.data.error) || 'تعذر التحميل';
        return;
      }
      var devices = r.data.devices || {};
      var names = Object.keys(devices);
      if (!names.length) { list.textContent = 'لا يوجد حسابات مربوطة'; return; }
      list.innerHTML = names.map(function (u) {
        var bound = devices[u] ? 'مربوط' : 'غير مربوط';
        return '<div class="row"><span><b>' + u + '</b><br><small style="color:#666">' + bound + '</small></span><button type="button" data-u="' + u + '">فك الربط</button></div>';
      }).join('');
      list.querySelectorAll('button[data-u]').forEach(function (btn) {
        btn.onclick = async function () {
          msg.textContent = '';
          btn.disabled = true;
          try {
            var rr = await api('/api/admin/reset-device', { method: 'POST', body: { username: btn.getAttribute('data-u') } });
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
    var token = getToken();
    if (!token) {
      showOverlay();
      return;
    }
    try {
      var r = await api('/api/me?app=' + encodeURIComponent(APP), { timeout: 60000 });
      if (r.data && r.data.ok) {
        setSession(token, r.data.user);
        hideOverlay();
        mountBar(r.data.user);
        return;
      }
      clearSession();
      showOverlay();
      if (r.data && r.data.error) {
        var el = document.getElementById('alola-auth-err');
        if (el) el.textContent = r.data.error;
      }
    } catch (e) {
      // Auth server cold start / offline: keep session optimistically if token present & not expired-looking
      var user = getUser();
      if (user && user.username && appAllowed(user)) {
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
