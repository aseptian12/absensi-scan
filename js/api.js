// Klien REST ke Google Apps Script. POST wajib text/plain agar tidak kena preflight CORS.
const Api = (() => {
  const K = 'absensi.sesi';
  let s = null;
  try { s = JSON.parse(sessionStorage.getItem(K) || 'null'); } catch (e) {}
  if (s && s.exp < Date.now()) s = null;
  function E(m, c, p) { const e = new Error(m); e.app = 1; e.code = c; e.payload = p; return e; }
  function set(v) { s = v; try { v ? sessionStorage.setItem(K, JSON.stringify(v)) : sessionStorage.removeItem(K); } catch (e) {} }
  async function call(action, data, o) {
    o = o || {};
    const u = (window.APP_CONFIG || {}).GAS_URL || '';
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(u) || /GANTI|XXXX/.test(u)) throw E('GAS_URL belum diisi di js/config.js.', 'CONFIG');
    const c = new AbortController(), t = setTimeout(() => c.abort(), 30000);
    try {
      const res = o.get
        ? await fetch(u + '?action=' + encodeURIComponent(action), { signal: c.signal })
        : await fetch(u, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, signal: c.signal,
            body: JSON.stringify({ action: action, data: data || {}, token: o.auth && s ? s.token : '' }) });
      let j;
      try { j = await res.json(); } catch (e) { throw E('Respons server tidak valid. Pastikan Web App dideploy dengan akses "Anyone" dan URL /exec benar.', 'FORMAT'); }
      if (!j.success) {
        if (j.code === 'AUTH') { set(null); document.dispatchEvent(new Event('auth-expired')); }
        throw E(j.message, j.code, j);
      }
      return j;
    } catch (e) {
      if (e.app) throw e;
      throw E(e.name === 'AbortError' ? 'Server terlalu lama merespons.' : 'Tidak dapat terhubung ke server.', 'NETWORK');
    } finally { clearTimeout(t); }
  }
  return {
    get: a => call(a, null, { get: 1 }),
    post: (a, d) => call(a, d),
    admin: (a, d) => call(a, d, { auth: 1 }),
    async login(u, p) { const r = await call('auth.login', { username: u, password: p }); set({ token: r.data.token, exp: r.data.expires_at, admin: r.data.admin }); return r.data.admin; },
    async ubahPassword(l, b) { const r = await call('auth.password', { password_lama: l, password_baru: b }, { auth: 1 }); set({ token: r.data.token, exp: r.data.expires_at, admin: s.admin }); return r; },
    logout: () => set(null),
    logged: () => !!s,
    me: () => s && s.admin
  };
})();
