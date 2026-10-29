# Panduan Instalasi — Sistem Absensi Siswa Barcode v3.0

Arsitektur: **frontend** (GitHub Pages) → `fetch()` → **backend** (Google Apps Script sebagai REST API) → Google Sheets.

## Bagian 1 — Backend (Google Apps Script)

1. Buka spreadsheet database Anda → **Ekstensi → Apps Script** (atau buat proyek baru di <https://script.google.com>).
2. Ganti seluruh isi `Code.gs` dengan isi **Kode.gs**. Hapus file `Index.html` lama (tidak dipakai lagi).
3. Klik ⚙️ **Setelan Proyek** → centang **Tampilkan file manifes "appsscript.json"** → ganti isinya dengan berkas **appsscript.json**.
4. Pilih fungsi **`setupAppEnvironment`** → ▶ **Run** → izinkan akses. Jalankan **sekali** (aman bila diulang).
5. Buka **Execution log**, catat baris `LOGIN ADMIN → username: admin | password: …`. Password hanya tampil sekali.
6. **Deploy → New deployment → Web app** · Execute as: **Me** · Who has access: **Anyone** → Deploy → salin URL berakhiran **/exec**.

> Setiap mengubah `Kode.gs`, lakukan **Deploy → Manage deployments → ✏️ → Version: New version**, supaya URL yang sama memakai kode terbaru.

## Bagian 2 — Frontend

1. Ekstrak `absensi-barcode-frontend.zip`. Folder hasil ekstrak **itulah** folder kerja Anda; di dalamnya langsung terlihat `index.html`, `css\`, `js\`.
2. Buka `js/config.js`, ganti `GANTI_DENGAN_ID_DEPLOYMENT` dengan URL /exec dari langkah 6 di atas (satu baris `GAS_URL`).

## Bagian 3 — Push ke GitHub Pages

1. Buat repository **Public** baru di github.com (jangan centang README/.gitignore/license).
2. Buka terminal **di folder hasil ekstrak** (Windows: buka folder → klik address bar → ketik `powershell` → Enter). Cek `dir` (Windows) / `ls` (Mac/Linux): **`index.html` harus terlihat di daftar teratas**. Jika yang terlihat folder lain, masuk satu level lagi sebelum lanjut.
3. Jalankan satu per satu (ganti `USERNAME` dan `NAMA-REPO`):

```bash
git init
git add .
git commit -m "Upload pertama"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```

4. Saat diminta password, tempel **Personal Access Token** (github.com/settings/tokens → *classic* → centang **repo**). Layar tidak menampilkan karakter saat mengetik — itu normal.
5. Di repo: **Settings → Pages → Deploy from a branch → main / (root)** → Save. Centang **Enforce HTTPS** (wajib untuk kamera). Situs aktif di `https://USERNAME.github.io/NAMA-REPO/`.
6. Update berikutnya: `git add .` → `git commit -m "pesan"` → `git push`, lalu **Ctrl+Shift+R**.

> Jangan pakai "Upload files" di web GitHub — struktur folder `css/` dan `js/` akan hilang dan halaman tampil tanpa gaya.

## Keamanan (penting)

- Password admin **tidak lagi disimpan di sheet**; hanya hash + salt di *Script Properties*. Sheet `Admin` lama (berisi password teks biasa) tidak dipakai — **hapus**.
- Ganti/tambah admin atau reset password: edit `USERNAME` & `NAMA` di fungsi `buatAtauResetAdmin()` → Run → catat password di log. Semua sesi lama otomatis keluar.
- Login dikunci 15 menit setelah 5 kali salah. Sesi berlaku 12 jam.
- Kode barcode siswa = "kunci" absen. Pakai kode acak (tombol **Acak**), jangan berurutan seperti `BC1001`. Scanner publik hanya menerima **kode barcode**, bukan ID siswa.
- Jangan tambah editor proyek Apps Script sembarangan (editor bisa melihat Script Properties) dan jangan bagikan spreadsheet database.

## Masalah umum

| Gejala | Penyebab / solusi |
|---|---|
| Banner kuning "Alamat server belum diisi" | `GAS_URL` di `js/config.js` belum diisi, atau belum di-push |
| "Respons server tidak valid" | Web App belum di-deploy sebagai **Anyone**, atau URL bukan /exec |
| Perubahan backend tidak berefek | Belum **New version** di Manage deployments |
| Kamera tidak mau terbuka | Situs harus HTTPS dan izin kamera diberikan di browser |
| Halaman 404 di GitHub Pages | Folder yang di-push salah: `index.html` harus ada di **root** repo |
| Halaman tanpa gaya (polos) | Struktur folder rata; push ulang dari terminal sesuai Bagian 3 |

## Absensi scan wajah (v3.1)

- Setelah mengganti `Kode.gs`: jalankan ulang **`setupAppEnvironment`** (menambah kolom `Face_Descriptor` di sheet Siswa), lalu **New version** di Manage deployments.
- Daftarkan wajah: **Panel Admin → Siswa → Edit → Rekam wajah (3 sampel) → Simpan**. Lakukan di tempat terang, wajah lurus ke kamera.
- Scanner publik: **Buka kamera** → siswa menghadap layar. Model wajah dimuat dari CDN saat pertama dibuka (beberapa MB).
- Pencocokan dilakukan di server; data wajah tidak pernah dikirim ke browser. Data wajah adalah **data biometrik** — minta persetujuan siswa/orang tua dan jangan bagikan spreadsheet.
- Batasan: belum ada deteksi "orang hidup", jadi foto wajah di layar bisa mengelabui. Untuk penggunaan di bawah pengawasan guru ini cukup; kode barcode tetap tersedia sebagai cadangan.
