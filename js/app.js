(() => {
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CLS = { Hadir: 'ok', Terlambat: 'late', Alpha: 'bad' };
const badge = s => '<span class="b b-' + (CLS[s] || 'info') + '">' + esc(s) + '</span>';
const empty = (n, t) => '<tr><td colspan="' + n + '" class="empty">' + t + '</td></tr>';
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const A = { siswa: [], lap: null };
let tabNow = 'siswa';

function applyName(n) { n = n || 'Absensi Barcode Siswa'; $('#app-name').textContent = n; document.title = n; try { localStorage.setItem('absensi.nama', n); } catch (e) {} }
function toast(m, t) { const e = document.createElement('div'); e.className = 'toast ' + (t || ''); e.textContent = m; $('#toasts').append(e); setTimeout(() => e.remove(), 3500); }
let ac;
function beep(ok) {
  try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain();
    o.connect(g); g.connect(ac.destination); o.frequency.value = ok ? 880 : 200; g.gain.value = .1; o.start(); o.stop(ac.currentTime + .2); } catch (e) {}
}
async function run(btn, fn) {
  if (btn) btn.disabled = true;
  try { return await fn(); } catch (e) { if (e.code !== 'AUTH') toast(e.message, 'err'); } finally { if (btn) btn.disabled = false; }
}

// ---------- NAVIGASI ----------
function go(v) {
  $('#v-scan').hidden = v !== 'scan'; $('#v-admin').hidden = v !== 'admin';
  $$('[data-go]').forEach(b => b.classList.toggle('on', b.dataset.go === v));
  if (v === 'scan') loadPublic(); else stopCam();
  scrollTo(0, 0);
}
function openAdmin() { $('#who').textContent = 'Masuk sebagai ' + Api.me().nama; go('admin'); tab(tabNow); }
$$('[data-go]').forEach(b => b.onclick = () => {
  if (b.dataset.go === 'scan') return go('scan');
  Api.logged() ? openAdmin() : $('#dlg-login').showModal();
});
document.addEventListener('click', e => { const c = e.target.closest('[data-close]'); if (c) c.closest('dialog').close(); });
document.addEventListener('auth-expired', () => { toast('Sesi berakhir. Silakan login ulang.', 'warn'); go('scan'); });
$('#logout').onclick = () => { Api.logout(); go('scan'); toast('Anda sudah keluar.'); };

// ---------- SCANNER ----------
let facing = 'user', last = { c: '', t: 0 }, busy = false, pause = 0, loop = null, models = null;
const MODEL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/';
function loadModels() {
  if (typeof faceapi === 'undefined') throw new Error('Library wajah gagal dimuat. Periksa internet.');
  return models = models || (async () => {
    try { let ok = false; try { ok = await faceapi.tf.setBackend('webgl'); } catch (e) {} if (!ok) await faceapi.tf.setBackend('cpu'); await faceapi.tf.ready(); } catch (e) {}
    await Promise.all([faceapi.nets.tinyFaceDetector.loadFromUri(MODEL), faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL), faceapi.nets.faceRecognitionNet.loadFromUri(MODEL)]);
  })().catch(e => { models = null; console.error(e); throw new Error('Model wajah gagal dimuat. Periksa internet lalu coba lagi.'); });
}
async function openStream(v) { v.srcObject = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: 640, height: 480 }, audio: false }); v.classList.toggle('rear', facing === 'environment'); await v.play(); }
function closeStream(v) { if (v.srcObject) v.srcObject.getTracks().forEach(t => t.stop()); v.srcObject = null; }
let lastErr = '';
async function detect(v) {
  if (!v.videoWidth) return null;
  try {
    lastErr = '';
    return await faceapi.detectSingleFace(v, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: .4 })).withFaceLandmarks(true).withFaceDescriptor();
  } catch (e) { lastErr = e.message || String(e); console.error(e); return null; }
}
async function startCam() {
  try { $('#cam-st').textContent = 'Memuat model…'; await loadModels(); await openStream($('#vid')); }
  catch (e) { closeStream($('#vid')); $('#cam-st').textContent = 'Siap'; return toast(/^(Library|Model)/.test(e.message) ? e.message : 'Kamera tidak bisa dibuka. Izinkan akses kamera (situs harus HTTPS).', 'err'); }
  $('#cam').textContent = 'Tutup kamera'; $('#cam-st').textContent = 'Mencari wajah…';
  loop = setInterval(async () => {
    if (busy || Date.now() < pause || !$('#vid').srcObject) return;
    const r = await detect($('#vid'));
    if (!busy) $('#cam-st').textContent = r ? 'Wajah terdeteksi…' : (lastErr ? 'Error deteksi' : 'Mencari wajah…');
    if (r && !busy && $('#vid').srcObject) submit(null, false, Array.from(r.descriptor));
  }, 700);
}
function stopCam() { clearInterval(loop); loop = null; closeStream($('#vid')); $('#cam').textContent = 'Buka kamera'; $('#cam-st').textContent = 'Siap'; }
$('#cam').onclick = () => { beep(1); $('#vid').srcObject ? stopCam() : startCam(); };
$('#cam-sw').onclick = async () => {
  facing = facing === 'user' ? 'environment' : 'user';
  $('#cam-sw').textContent = 'Kamera: ' + (facing === 'user' ? 'Depan' : 'Belakang');
  if ($('#vid').srcObject) { stopCam(); await startCam(); }
};
$('#f-manual').onsubmit = e => { e.preventDefault(); const v = $('#code').value; $('#code').value = ''; submit(v, true); };

function show(d, type, text) {
  const s = d.student;
  $('#l-name').textContent = s.nama_siswa;
  $('#l-info').textContent = 'Kelas ' + s.kelas + ' • ' + d.status + ' • ' + d.waktu;
  $('#last').className = 'card result ' + type;
  toast(text, type === 'ok' ? '' : 'warn');
}
async function submit(code, manual, face) {
  code = String(code || '').trim();
  const n = Date.now();
  if ((!code && !face) || busy || (code && !manual && code === last.c && n - last.t < 4000)) return;
  last = { c: code, t: n }; busy = true; $('#cam-st').textContent = 'Memproses…';
  try {
    const r = face ? await Api.post('scan.wajah', { descriptor: face }) : await Api.post('scan', { code: code });
    show(r.data, 'ok', r.data.student.nama_siswa + ' — ' + r.data.status); beep(1);
  } catch (e) {
    beep(0);
    if (e.code === 'DUPLICATE') show(e.payload.data, 'warn', e.message);
    else { $('#last').className = 'card result err'; $('#l-name').textContent = 'Tidak dikenali'; $('#l-info').textContent = e.message; toast(e.message, 'err'); }
  } finally { busy = false; pause = Date.now() + 3000; $('#cam-st').textContent = $('#vid').srcObject ? 'Mencari wajah…' : 'Siap'; loadPublic(); }
}
async function loadPublic() {
  try {
    const d = (await Api.get('public.data')).data;
    applyName(d.pengaturan.nama_app);
    $('#s-hadir').textContent = d.statistik.hadir; $('#s-telat').textContent = d.statistik.terlambat;
    $('#logs').innerHTML = d.logs.length ? d.logs.map(l => '<tr><td>' + esc(l.waktu) + '<td>' + esc(l.nama_siswa) + '<td>' + esc(l.kelas) + '<td>' + badge(l.status)).join('')
      : empty(4, 'Belum ada absensi hari ini.');
    $('#hid').hidden = d.logs.length > 0 || d.statistik.total === 0;
  } catch (e) { if (e.code !== 'CONFIG') toast(e.message, 'err'); }
}
$('#refresh').onclick = loadPublic;
setInterval(() => { if (!$('#v-scan').hidden && !document.hidden) loadPublic(); }, 60000);

// ---------- LOGIN ----------
$('#f-login').onsubmit = async e => {
  e.preventDefault(); $('#le').textContent = ''; const b = e.submitter; b.disabled = true;
  try { await Api.login($('#lu').value, $('#lp').value); $('#lp').value = ''; $('#dlg-login').close(); openAdmin(); }
  catch (x) { $('#le').textContent = x.message; } finally { b.disabled = false; }
};

// ---------- ADMIN: TAB ----------
function tab(n) {
  tabNow = n;
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === n));
  $$('.tab').forEach(t => t.hidden = t.id !== 't-' + n);
  ({ siswa: loadSiswa, manual: loadSiswa, laporan: loadLap, set: loadSet, akun: loadAkun })[n]();
}
$$('#tabs button').forEach(b => b.onclick = () => tab(b.dataset.tab));

// ---------- ADMIN: SISWA ----------
const genCode = () => 'BC' + [...crypto.getRandomValues(new Uint8Array(8))].map(b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
async function loadSiswa() {
  await run(null, async () => {
    A.siswa = (await Api.admin('siswa.list')).data; renderSiswa();
    $('#ma-s').innerHTML = A.siswa.map(s => '<option value="' + esc(s.id_siswa) + '">' + esc(s.id_siswa + ' - ' + s.nama_siswa + ' (' + s.kelas + ')') + '</option>').join('');
  });
}
function renderSiswa() {
  const q = $('#q').value.toLowerCase();
  const l = A.siswa.filter(s => (s.id_siswa + s.nama_siswa + s.kelas).toLowerCase().includes(q));
  $('#sb').innerHTML = l.length ? l.map(s => '<tr><td>' + esc(s.id_siswa) + '<td>' + esc(s.nama_siswa) + '<td>' + esc(s.kelas) + '<td><code>' + esc(s.barcode_code) + '</code><br><small>' + (s.ada_wajah ? '✔ wajah terdaftar' : 'wajah belum ada') + '</small>' +
    '<td class="act"><button class="btn ghost sm" data-act="qr" data-id="' + esc(s.id_siswa) + '">QR</button><button class="btn ghost sm" data-act="edit" data-id="' + esc(s.id_siswa) + '">Edit</button><button class="btn bad sm" data-act="del" data-id="' + esc(s.id_siswa) + '">Hapus</button>').join('')
    : empty(5, 'Belum ada siswa. Klik "Tambah siswa".');
}
$('#q').oninput = renderSiswa;
$('#sb').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  const s = A.siswa.find(x => x.id_siswa === b.dataset.id); if (!s) return;
  if (b.dataset.act === 'qr') showQR(s);
  if (b.dataset.act === 'edit') openSiswa(s);
  if (b.dataset.act === 'del' && confirm('Hapus ' + s.nama_siswa + '? Riwayat absensinya tidak ikut terhapus.'))
    run(b, async () => { toast((await Api.admin('siswa.delete', { id_siswa: s.id_siswa })).message); loadSiswa(); });
};
function openSiswa(s) {
  $('#st').textContent = s ? 'Edit siswa' : 'Tambah siswa'; $('#sm').value = s ? 'edit' : 'baru';
  $('#si').value = s ? s.id_siswa : ''; $('#si').readOnly = !!s; $('#sn').value = s ? s.nama_siswa : '';
  $('#sk').value = s ? s.kelas : ''; $('#sc').value = s ? s.barcode_code : genCode(); $('#sh').value = s ? s.no_hp : ''; enr = []; $('#fsave').disabled = true;
  $('#fs').textContent = s && s.ada_wajah ? 'Wajah sudah terdaftar. Rekam ulang untuk mengganti.' : 'Wajah belum terdaftar.';
  $('#dlg-siswa').showModal();
}
$('#add').onclick = () => openSiswa(null);
$('#gen').onclick = () => $('#sc').value = genCode();
function saveSiswa(btn, close) {
  if (!$('#f-siswa').reportValidity()) return;
  run(btn, async () => {
    const r = await Api.admin('siswa.save', { mode: $('#sm').value, id_siswa: $('#si').value, nama_siswa: $('#sn').value, kelas: $('#sk').value, barcode_code: $('#sc').value, no_hp: $('#sh').value, wajah: enr.length === 3 ? enr : undefined });
    toast(r.message); loadSiswa();
    if (close) return $('#dlg-siswa').close();
    $('#sm').value = 'edit'; $('#si').readOnly = true; $('#fsave').disabled = true; $('#fs').textContent = '✔ Wajah tersimpan.'; enr = [];
  });
}
$('#f-siswa').onsubmit = e => { e.preventDefault(); saveSiswa(e.submitter, true); };
$('#fsave').onclick = e => saveSiswa(e.currentTarget, false);
let enr = [];
$('#enr').onclick = async () => {
  const st = $('#fs'), v = $('#ev'); enr = []; $('#fsave').disabled = true;
  try { st.textContent = 'Memuat model…'; await loadModels(); v.hidden = false; await openStream(v); }
  catch (e) { closeStream(v); v.hidden = true; return st.textContent = 'Gagal: ' + (e.name === 'NotAllowedError' ? 'izin kamera ditolak' : e.message); }
  while (enr.length < 3 && v.srcObject) {
    const r = await detect(v);
    st.textContent = r ? 'Wajah terdeteksi, merekam… (' + (enr.length + 1) + '/3)' : (lastErr ? 'Error deteksi: ' + lastErr : 'Wajah belum terdeteksi. Dekatkan wajah, pastikan terang dan lurus ke kamera. (' + enr.length + '/3)');
    if (r) enr.push(Array.from(r.descriptor, n => Math.round(n * 1e4) / 1e4));
    await new Promise(x => setTimeout(x, r ? 900 : 300));
  }
  if (enr.length === 3) { st.textContent = '✔ 3 sampel terekam. Klik Simpan wajah.'; $('#fsave').disabled = false; }
  closeStream(v); v.hidden = true;
};
$('#dlg-siswa').addEventListener('close', () => { closeStream($('#ev')); $('#ev').hidden = true; });
function showQR(s) {
  if (typeof QRCode === 'undefined') return toast('Library QR gagal dimuat. Periksa internet.', 'err');
  $('#qn').textContent = s.nama_siswa; $('#qi').textContent = 'Kelas ' + s.kelas; $('#qc').textContent = s.barcode_code;
  const b = $('#qbox'); b.innerHTML = '';
  new QRCode(b, { text: s.barcode_code, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M });
  $('#dlg-qr').dataset.f = 'QR_' + s.barcode_code; $('#dlg-qr').showModal();
}
$('#qdl').onclick = () => {
  const c = $('#qbox canvas'), a = document.createElement('a'); if (!c) return;
  a.href = c.toDataURL('image/png'); a.download = $('#dlg-qr').dataset.f + '.png'; a.click();
};
$('#qpr').onclick = () => print();

// ---------- ADMIN: ABSEN MANUAL ----------
$('#f-ma').onsubmit = e => {
  e.preventDefault();
  run(e.submitter, async () => {
    const r = await Api.admin('absen.manual', { id_siswa: $('#ma-s').value, tanggal: $('#ma-t').value, status: $('#ma-st').value, keterangan: $('#ma-k').value });
    toast(r.message); $('#ma-k').value = '';
  });
};

// ---------- ADMIN: LAPORAN ----------
async function loadLap() {
  await run(null, async () => { A.lap = (await Api.admin('laporan', { start: $('#l-a').value, end: $('#l-b').value })).data; renderLap(); });
}
function renderLap() {
  const l = A.lap.logs, c = {};
  l.forEach(x => c[x.status] = (c[x.status] || 0) + 1);
  $('#sum').innerHTML = Object.keys(c).map(k => badge(k) + ' ' + c[k]).join(' &nbsp; ') + (A.lap.terpotong ? ' — dibatasi 5.000 baris, persempit tanggal' : '');
  $('#lb').innerHTML = l.length ? l.map(x => '<tr><td>' + esc(x.tanggal) + '<td>' + esc(x.waktu) + '<td>' + esc(x.nama_siswa) + '<td>' + esc(x.kelas) + '<td>' + badge(x.status) + '<td>' + esc(x.keterangan) + '<td><button class="btn bad sm" data-id="' + esc(x.id_log) + '">Hapus</button>').join('')
    : empty(7, 'Tidak ada data pada rentang tanggal ini.');
}
$('#f-lap').onsubmit = e => { e.preventDefault(); loadLap(); };
$('#lb').onclick = e => {
  const b = e.target.closest('button[data-id]'); if (!b) return;
  const x = A.lap.logs.find(l => l.id_log === b.dataset.id); if (!x) return;
  if (!confirm('Hapus catatan ' + x.nama_siswa + ' (' + x.status + ', ' + x.tanggal + ')? Tidak bisa dibatalkan.')) return;
  run(b, async () => { toast((await Api.admin('absen.hapus', { id_log: x.id_log })).message); loadLap(); });
};
$('#csv').onclick = () => {
  const l = (A.lap && A.lap.logs) || [];
  if (!l.length) return toast('Tampilkan laporan yang ada isinya dulu.', 'err');
  const q = v => { v = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
  const rows = [['Tanggal', 'Waktu', 'ID Siswa', 'Nama', 'Kelas', 'Status', 'Keterangan']].concat(l.map(x => [x.tanggal, x.waktu, x.id_siswa, x.nama_siswa, x.kelas, x.status, x.keterangan]));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + rows.map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  a.download = 'Rekap_Absensi_' + $('#l-a').value + '_sd_' + $('#l-b').value + '.csv'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

// ---------- ADMIN: PENGATURAN ----------
async function loadSet() {
  await run(null, async () => {
    const c = (await Api.admin('pengaturan.get')).data;
    $('#set-nama').value = c.nama_app; $('#set-in').value = c.jam_masuk; $('#set-tol').value = c.toleransi_menit; $('#set-out').value = c.jam_pulang; $('#set-pub').checked = c.log_publik;
  });
}
$('#f-set').onsubmit = e => {
  e.preventDefault();
  run(e.submitter, async () => {
    const r = await Api.admin('pengaturan.save', { nama_app: $('#set-nama').value, jam_masuk: $('#set-in').value, toleransi_menit: Number($('#set-tol').value), jam_pulang: $('#set-out').value, log_publik: $('#set-pub').checked });
    applyName($('#set-nama').value.trim()); toast(r.message);
  });
};

// ---------- ADMIN: AKUN SAYA ----------
function loadAkun() { const m = Api.me(); $('#ak-info').textContent = 'Username: ' + m.username + ' • Nama: ' + m.nama + ' • Peran: ' + m.role; }
$('#f-pw').onsubmit = e => {
  e.preventDefault();
  if ($('#pw-1').value !== $('#pw-2').value) return toast('Ulangi password tidak sama.', 'err');
  run(e.submitter, async () => { const r = await Api.ubahPassword($('#pw-0').value, $('#pw-1').value); toast(r.message); e.target.reset(); });
};

// ---------- INIT ----------
try { applyName(localStorage.getItem('absensi.nama')); } catch (e) { applyName(); }
const u = (window.APP_CONFIG || {}).GAS_URL || '';
if (!u || /GANTI|XXXX/.test(u)) $('#warn').hidden = false;
$('#today').textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const now = new Date();
$('#l-b').value = $('#ma-t').value = iso(now); $('#l-a').value = iso(new Date(now.getFullYear(), now.getMonth(), 1));
$('#ma-t').max = iso(now);
loadPublic();
})();
