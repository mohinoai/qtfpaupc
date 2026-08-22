# 🚀 Bounties Challenge PRD — Constellation: Star-Gazing Session Log

---

## 1. 🎯 Project Overview
- **Nama Proyek:** Constellation: Star-Gazing Session Log
- **Tujuan Utama:** Aplikasi single-page untuk mencatat dan menelusuri riwayat sesi pengamatan bintang — tanggal/waktu, lokasi, kondisi langit, konstelasi yang terlihat, dan catatan — dengan urutan reverse-chronological, bisa dihapus, dan tersimpan permanen di localStorage.
- **Target Ukuran Repositori:** < 40KB (asumsi default karena brief tidak menyebutkan cap eksplisit — sesuaikan jika ada angka lain)

---

## 2. 📝 Fitur Utama (Completeness Checklist)
- [ ] **Tambah entri sesi** — form dengan field: tanggal & waktu (datetime-local picker), lokasi (free-text), kondisi langit (dropdown: Clear, Partly Cloudy, Light-Polluted, dll — bukan free text, agar konsisten kalau nanti difilter), konstelasi yang terlihat (multi-select berbasis checkbox/tag-picker dari daftar nama umum + opsi tambah custom, lebih aksesibel daripada comma-separated text yang gampang typo), dan notes (textarea opsional)
- [ ] **Lihat semua entri** — daftar card, urut reverse-chronological (terbaru di atas) berdasarkan tanggal & waktu sesi (bukan urutan input), tiap card menampilkan ringkasan: tanggal/waktu, lokasi, badge kondisi langit, daftar konstelasi (chip/tag), dan cuplikan notes
- [ ] **Hapus entri** — tombol hapus per card dengan two-step confirmation (klik pertama ubah jadi "Yakin hapus?" dalam batas waktu singkat, klik kedua baru eksekusi)
- [ ] **Persistensi localStorage** — data tersimpan otomatis setiap ada perubahan (tambah/hapus) dan dimuat ulang saat refresh halaman, tetap terurut reverse-chronological setelah reload

---

## 3. 🎨 Problem Solving & Design (Aksesibilitas & UI/UX)

### 3.1. Struktur HTML & Aksesibilitas (A11y)
- [ ] **Landmarks:** `<header>` untuk judul app, `<main id="main-content">`, `<section aria-labelledby="...">` terpisah untuk form tambah dan daftar sesi.
- [ ] **Skip Link:** `<a href="#main-content" class="skip-link">Skip to content</a>` sebagai elemen pertama di `<body>`, **verifikasi manual dengan menekan Tab sekali dari awal halaman** — pastikan benar-benar muncul saat fokus, bukan cuma terdefinisi di CSS. Perhatikan khusus di tema gelap: pastikan warna skip-link tetap kontras terlihat saat fokus, jangan sampai tenggelam di background gelap.
- [ ] **Form Labels:** setiap input (tanggal/waktu, lokasi, kondisi langit, konstelasi, notes) punya `<label for="...">` visible.
- [ ] **Multi-select konstelasi aksesibel:** gunakan checkbox group dengan `<fieldset>` + `<legend>` "Konstelasi yang terlihat" (bukan `<select multiple>` yang sulit dioperasikan, atau div-div yang diklik tanpa semantik form), setiap checkbox punya label sendiri sehingga bisa dinavigasi dan dibaca screen reader satu per satu.
- [ ] **Kontras warna di tema gelap:** karena brief minta dark background dengan aksen bintang, pastikan teks utama dan badge/chip tetap memenuhi rasio kontras WCAG AA (minimal 4.5:1 untuk teks normal) terhadap background gelap — jangan sampai estetika atmosferik mengorbankan keterbacaan.
- [ ] **Screen Reader Announcement:** `<p id="live-region" class="sr-only" aria-live="polite"></p>` diisi teks dinamis untuk: entri berhasil ditambah, berhasil dihapus. **Uji manual: pastikan teks di DOM benar-benar berubah saat aksi terjadi.**
- [ ] **Focus-visible di semua elemen interaktif** (tombol tambah, hapus, checkbox konstelasi, dropdown kondisi langit, form submit) — **uji manual dengan Tab melewati seluruh halaman**, pastikan ring/outline benar-benar terlihat kontras di atas background gelap, bukan ter-override style lain atau menyatu dengan warna latar.

### 3.2. Penanganan Edge Cases (Off the Happy Path)
- [ ] **Empty state (belum ada sesi tercatat sama sekali):** section terpisah eksplisit — aksen visual (misal ilustrasi bintang/langit malam sederhana) + pesan ajakan jelas ("Belum ada sesi pengamatan tercatat, mulai catat sesi pertamamu") + tombol CTA ke form tambah.
- [ ] **Error state validasi form:** jika tanggal/waktu kosong atau tidak valid, lokasi kosong, kondisi langit belum dipilih, atau tidak ada satupun konstelasi dicentang, tampilkan pesan error *inline* di bawah field terkait (`<span class="error" hidden>` di-unhide) **dan** hubungkan via `aria-describedby` + border merah ke field yang error — termasuk untuk fieldset checkbox konstelasi (pesan error muncul di bawah legend, bukan menempel ke satu checkbox saja).
- [ ] **Tanggal/waktu di masa depan:** batasi input datetime-local agar tidak menerima nilai di masa depan (gunakan atribut `max` yang di-set ke waktu sekarang di timezone lokal user, dihitung ulang saat form dibuka — bukan hardcode statis), karena sesi pengamatan logisnya tidak mungkin dicatat sebelum terjadi.
- [ ] **Feedback storage error terhubung ke aksi, bukan hanya banner umum:** saat simpan (`saveSessions`) gagal setelah user menekan tombol tambah, tampilkan feedback yang terlihat menyambung ke aksi tersebut — misalnya pesan singkat/toast yang muncul dekat form/tombol submit yang baru saja ditekan (atau highlight sesaat pada entri yang gagal tersimpan) — selain (atau menggantikan) banner page-level umum, supaya user langsung tahu aksi mana yang gagal, bukan cuma ada peringatan generik di atas halaman yang tidak jelas konteksnya.
- [ ] **Storage read failure:** jika data di localStorage rusak/gagal di-parse saat load pertama, JANGAN silently kembalikan array kosong — tampilkan pesan terpisah (beda dari feedback write-failure di atas) yang menyatakan data lama gagal dimuat, dipicu dari jalur kode load itu sendiri.

---

## 4. ⚙️ Technical Craft (Arsitektur & Kualitas Kode)

### 4.1. Pemisahan Logika (Architecture)
- [ ] **Pure Domain Logic (`domain.ts`):** fungsi murni terpisah dari DOM — `validateSessionInput(input)`, `createSessionEntry(input, id)`, `sortByDateDesc(sessions)`. Tidak ada satupun fungsi domain yang menyentuh DOM atau localStorage langsung, dan tidak memanggil `new Date()`/`Date.now()` secara internal — waktu "sekarang" (untuk validasi max-date) harus jadi **parameter input** eksplisit agar bisa di-unit-test dengan timestamp palsu.
- [ ] **Storage layer terpisah (`storage.ts`) dengan DUA fungsi publik independen:** `loadSessions()` (try/catch parsing sendiri, mengembalikan sinyal read-failure sendiri) dan `saveSessions(sessions)` (try/catch write sendiri, mengembalikan sinyal write-failure sendiri) — **kedua fungsi ini TIDAK saling memanggil satu sama lain**, sehingga feedback error di UI benar-benar terpicu sesuai jalurnya masing-masing. Semua data dari storage wajib lewat fungsi validasi/normalisasi yang sama dengan data baru (entri corrupt/schema-mismatch di-skip, bukan bikin render crash).
- [ ] **DOM Rendering:** kerangka UI statis (header, form shell termasuk fieldset checkbox konstelasi, empty state markup, skip link) ditulis langsung di `index.html`. JavaScript hanya render ulang daftar sesi dinamis dan toggle visibility state (empty/error).
- [ ] **Form select/checkbox wajib punya constraint DOM eksplisit:** dropdown kondisi langit punya `required` + placeholder option `disabled`; validasi "minimal satu konstelasi dicentang" dilakukan di level submit handler karena constraint HTML native tidak mendukung "minimal 1 dari banyak checkbox" secara langsung — pastikan pesan error untuk kasus ini jelas.
- [ ] **Cek ukuran build setelah setiap fitur besar selesai ditambahkan** (form tambah, multi-select konstelasi, sort/render list, storage layer) — bukan hanya sekali di akhir, agar overcap terdeteksi lebih awal.

### 4.2. Testing & Keamanan
- [ ] **Unit Tests (`domain.test.ts`):** minimal cover — `validateSessionInput` (field kosong, tanggal di masa depan relatif terhadap `now` yang di-pass sebagai parameter, tidak ada konstelasi dicentang), `sortByDateDesc` (urutan campur, tanggal sama persis/stabil), normalisasi entri corrupt dari storage (field hilang di-skip, bukan crash).
- [ ] **Sanitasi Input:** gunakan `textContent`/`createTextNode` (bukan `innerHTML`) saat merender lokasi/notes/nama konstelasi custom ke card, untuk mencegah XSS. Trim spasi berlebih di semua field teks sebelum disimpan.

---

## 5. 📦 Stack & Deployment Strategy
- **Stack dipilih:** Vanilla HTML, Vanilla CSS, Vanilla TypeScript via Vite (native ES Modules, tanpa framework). Cek ukuran repo setelah tiap fitur besar (lihat 4.1), hapus folder `tests` saat deploy jika mendekati batas ukuran.
- **Tema visual:** atmosferik & malam berbintang — background gelap pekat (`#0a0e1a`/`#12172b`), aksen bintang kecil (SVG titik-titik ringan atau CSS radial-gradient dot pattern di background, bukan gambar berat), tipografi tipis/elegan untuk judul (letter-spacing lebar terasa seperti nama konstelasi), aksen warna terang secukupnya (biru muda/putih keperakan) untuk teks dan badge agar tetap kontras.
- **Framework (React/Vue/Tailwind):** 🚫 Dihindari.

---

## 6. ⚖️ Catatan Keseimbangan Skor
*Instruksi di atas dibuat setara jumlah dan kedetailannya di ketiga kategori (Design/A11y, Completeness, Technical Craft), mengikuti pola yang terbukti dapat skor tinggi (Houseplant 84, Ink Swatch 85, Hiking Trail Logbook 87). Perbaikan terbaru dari catatan Hiking (Completeness 77): feedback storage error diminta terhubung ke aksi spesifik yang gagal (toast/pesan dekat titik aksi), bukan sekadar banner page-level umum yang terasa terpisah dari tindakan user. Poin kontras warna & fokus-visible di tema gelap ditekankan khusus karena estetika "night sky" pada brief ini rawan mengorbankan keterbacaan.*
