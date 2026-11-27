# 08 - Kelayakan Regulasi Kesehatan, Keamanan Data, KI/TKDN, Biaya/Hilirisasi & Roadmap Grand Final

> **Dokumen Pendukung Kurasi Hackathon Day 1 — UMS Health Innovation Hackathon 2026**
> **Mitra Industri:** CV Arba'in Solo Raya (Gudang Sentral Kartasura, Sukoharjo)
> **Purwarupa:** ArbaConnect ERP v3.0 (Offline-First PWA & Relational SQL Engine)

---

## 1. Kelayakan Teknis, Kepatuhan Regulasi Kesehatan & Keamanan Data (Bobot 10%)

### A. Matriks Kepatuhan Regulasi Kesehatan & Distribusi Herbal

| Regulasi / Standar | Persyaratan Utama | Implementasi Nyata di ArbaConnect ERP |
| :--- | :--- | :--- |
| **CDOB BPOM** (PerBPOM No. 6/2020) — *Keterlacakan Batch & FEFO* | Pengeluaran barang wajib mengikuti *First-Expired, First-Out* (FEFO) & setiap mutasi terekam nomor batch + ED. | `product_batches` & `stock_ledger` imutabel dengan hash kriptografis, **Guardrail CDOB** menahan otorisasi batch Kritis (`<30 hari`), serta **Stiker QR Batch ISO/IEC 18004** yang dapat dipindai kamera optik (`BarcodeDetector`). |
| **CDOB BPOM Bab VIII** — *Penarikan Kembali (Batch Recall)* | Distributor wajib mampu melacak seluruh fasilitas penerima 1 nomor batch dalam hitungan menit saat ada instruksi penarikan BPOM. | Fitur **1-Klik Batch Recall** (`openBatchRecallModal`) di modul Gudang: menampilkan seluruh Apotek penerima batch, total unit beredar, tombol **WA Recall APA**, dan **Karantina Batch** yang langsung mengunci distribusi. |
| **Registrasi BPOM (NIE) & Halal BPJPH** (UU No. 33/2014 JPH) | Setiap sediaan herbal/kosmetik yang diedarkan wajib mencantumkan Nomor Izin Edar (`POM TR` / `MD` / `NA`) dan Sertifikat Halal. | Seluruh 9 SKU master dilengkapi `nieBpom`, `noHalal`, dan `storageTemp` di `database/schema.sql` & `js/data.js`, tampil pada Katalog Gudang, Stiker QR Batch, dan **Surat Jalan 3 Rangkap**. |
| **Legalitas Sarana Penerima (SIA/SIPA)** | Penyaluran ke Apotek wajib memverifikasi Nomor SIA & SIPA Apoteker Penanggung Jawab (APA) yang masih aktif. | Master outlet B2B menyimpan `noSia`, `noSipa`, `sipaExpiry`, dan `sipaStatus`; guardrail otorisasi memperingatkan jika SIPA segera habis/kadaluarsa. |
| **CPOTB / CDOB Penyimpanan** | Pemantauan suhu & kelembapan gudang produk herbal (15–25°C, RH <60%). | Indikator pemantauan suhu/RH Gudang Kartasura (`22,4°C • RH 52% • Normal CDOB`) terintegrasi pada header operasional gudang. |
| **UU PDP (UU No. 27/2022) & PP No. 71/2019 (PSTE)** | Perlindungan data pribadi pelanggan/pegawai, pembatasan akses berbasis peran, dan kedaulatan lokasi data di Indonesia. | **Strict RBAC** 5 peran di sisi server (`ROLE_ALLOWED_MUTATIONS`), sesi **HMAC-SHA256 `HttpOnly; SameSite=Strict`**, anti brute-force login, header keamanan CSP/HSTS/X-Frame-Options, dan arsitektur *self-hostable* di VPS/server lokal Indonesia. |

---

### B. Potensi Kekayaan Intelektual (KI) & TKDN

1. **Potensi Pendaftaran KI (DJKI Kemenkumham):**
   - **Hak Cipta Program Komputer:** Pendaftaran atas *"Sistem Distribusi Logistik Herbal Offline-First Berbasis FEFO, Buku Besar Imutabel, dan Consignment Rebalancer (ArbaConnect ERP)"*.
   - **Keunikan Teknis yang Dilindungi:** Mekanisme sinkronisasi idempoten berbasis `client_uuid` + IndexedDB untuk wilayah *blank spot* Solo Raya, generator QR Batch standar ISO/IEC 18004 tanpa library eksternal, serta algoritma *Consignment Rebalancer* (pemindahan stok titipan lambat antar-apotek sebelum kedaluwarsa).
2. **Potensi TKDN Perangkat Lunak (>88% Komponen Dalam Negeri):**
   - **100% Pure Vanilla HTML5/CSS3/ES6 + Node.js Built-in SQLite (`node:sqlite`)** — **nol dependensi framework/SaaS asing berbayar (`0 npm dependencies`)**.
   - Seluruh logika bisnis, antarmuka Bahasa Indonesia, skema CDOB, dan mesin sinkronisasi dikembangkan 100% oleh talenta lokal (tim mahasiswa UMS Surakarta).
   - Server produksi dapat dipasang di **PC Server lokal Gudang Kartasura (On-Premise)** atau **Data Center Indonesia** (Biznet Gio / IDCloudHost / NevaCloud) sehingga mendukung penuh kepatuhan PP 71/2019.

---

## 2. Kelayakan Hilirisasi, Rasionalitas Biaya (HPP/TCO) & ROI Mitra (Bobot 10%)

### A. Perbandingan Biaya Kepemilikan (TCO) untuk CV Arba'in Solo Raya

| Komponen Biaya | Pencatatan Manual (Excel + WA) | SaaS ERP Komersial (15 User) | **ArbaConnect ERP (On-Prem / VPS Lokal)** |
| :--- | :---: | :---: | :---: |
| **Lisensi Software / Bulan** | Rp 0 | Rp 3.500.000 – Rp 6.000.000 | **Rp 0** (Milik Mitra / Open Standard) |
| **Server / Cloud / Bulan** | Rp 0 | Termasuk | **Rp 250.000 – Rp 400.000** (VPS Lokal + Backup) atau **Rp 0** (PC Gudang) |
| **Investasi Perangkat Sales** | HP Pribadi | HP Baru / Tablet Khusus | **Rp 0** (PWA ringan berjalan di HP Android biasa milik sales) |
| **Printer Thermal 58mm (Opsional)** | Nota Kertas Karbon (~Rp 400rb/bln) | Printer Khusus | **Rp 250.000 / unit** (sekali beli, hemat kertas nota karbon) |
| **Total Biaya Tahun Pertama** | ~Rp 4.800.000 (ATK) + **Hidden Loss** | **Rp 42.000.000 – Rp 72.000.000** | **~Rp 4.500.000 – Rp 6.500.000 / tahun** |

### B. Estimasi Dampak Ekonomi & ROI Nyata (Asumsi Omset ~Rp 480 Juta / Bulan)

1. **Pencegahan Susut Barang Kedaluwarsa (*Expired Loss*):**
   - Dengan kontrol FEFO + *Consignment Rebalancer*, penurunan produk retur kedaluwarsa sebesar **1,5% saja** dari omset bulanan = penghematan **~Rp 7.200.000 / bulan** (~Rp 86,4 juta/tahun).
2. **Efisiensi BBM & Waktu Kunjungan Sales (TSP + OSRM Route Optimizer):**
   - Pemangkasan jarak tempuh rata-rata 12–18% untuk 6 sub-rayon Solo Raya = penghematan BBM & waktu operasional **~Rp 1.500.000 – Rp 2.500.000 / bulan**.
3. **Penurunan Piutang Macet (*Bad Debt*):**
   - *Credit Limit Guardrail* & AI Credit Scoring mencegah penjualan kredit ke outlet *Overdue* tanpa persetujuan Direksi.
4. **Payback Period:** Biaya operasional tahun pertama (~Rp 5 juta) **tertutup dalam < 1 bulan** operasional dari penghematan barang kedaluwarsa & administrasi nota!

### C. Kesiapan Adopsi & Migrasi Tanpa Hambatan (Onboarding Mitra)
- **Fase 1 (Hari 1–3):** Impor data master produk & 148+ apotek CV Arba'in dari file Excel/CSV existing melalui fitur **Impor CSV** yang sudah tersedia di modul Gudang & CRM.
- **Fase 2 (Hari 4–7):** Pelatihan terpisah per peran (Admin Gudang, Admin Penjualan, Sales Lapangan) — antarmuka sudah menggunakan istilah operasional Indonesia sehari-hari (*Nota, Barang Titipan, Surat Jalan*), bukan istilah ERP asing.
- **Fase 3 (Minggu 2):** *Parallel run* selama 7 hari (input di ArbaConnect berdampingan dengan catatan lama) sebelum *cut-over* penuh.

---

## 3. Strategi Sesi II: Coachability (20%) & Skenario Live Demo 5 Menit

### A. Checklist Coachability (Bukti Nyata *Before–After*)
1. **Sebelum Sesi I Pagi:** Jalankan `git tag v1.0-pre-mentoring` agar kondisi awal tercatat objektif.
2. **Saat Klinik Mentor Pagi:** Catat 3 poin revisi paling berdampak dari Mentor (prioritaskan yang langsung terlihat saat demo siang: validasi bisnis, UX alur mitra, atau laporan CDOB).
3. **Saat Verifikasi Siang (Dewan Juri):** Tunjukkan langsung `git diff --stat v1.0-pre-mentoring` dan demokan fitur hasil revisi secara *live* (*before → after*).

### B. Skenario Live Demo 5 Menit Anti-Gagal (Jalankan Lokal `npm start`)
> **Penting:** Untuk demo multi-perangkat (HP Sales + Laptop Direktur), jalankan server lokal (`npm start`) pada jaringan Wi-Fi/hotspot yang sama agar database SQLite persisten & real-time SSE (`/api/events`) berjalan instan 100% tanpa batasan *cold start* serverless.

1. **Menit 0–1 (Masalah Mitra & Field Sales Offline-First):** Buka tampilan HP Sales (`field-sales-pwa-preview`), matikan sinyal (*Offline Mode*), lakukan GPS Check-in, buat pesanan + tanda tangan Apoteker (Canvas E-Signature) → pesanan masuk antrean IndexedDB lokal tanpa error.
2. **Menit 1–2 (Sinkronisasi Real-Time Multi-Device):** Nyalakan sinyal kembali (*Online*) → antrean otomatis tersinkronisasi (`POST /api/sync` idempoten) → layar Laptop Direktur & Admin Gudang langsung ter-update otomatis via SSE tanpa refresh!
3. **Menit 2–3 (Guardrail CDOB, FEFO & Surat Jalan 3 Rangkap):** Di Admin Penjualan, tunjukkan peringatan *Guardrail CDOB* untuk batch kritis/kredit, lalu setujui pesanan normal → stok terpotong atomik, tercatat di Buku Besar SHA-256, dan tampilkan **Surat Jalan 3 Rangkap** ber-NIE BPOM.
4. **Menit 3–4 (QR Batch Nyata & 1-Klik Batch Recall):** Di modul Gudang, tunjukkan **QR Batch ISO/IEC 18004** (bisa langsung discan kamera HP juri!) + klik tombol **Batch Recall** untuk melacak seluruh apotek penerima batch & karantina dalam 1 klik.
5. **Menit 4–5 (Dampak Bisnis & Hilirisasi):** Tunjukkan **Consignment Rebalancer**, **TSP Route Optimizer (OSRM)**, serta ringkasan TCO (~Rp 300rb/bln) vs ROI penghematan susut FEFO untuk CV Arba'in Solo Raya.

---

## 4. Roadmap Menuju Grand Final (Bobot 10%)

| Tahap | Target Waktu | Deliverable Konkret |
| :--- | :---: | :--- |
| **Sprint 1 — Penguatan Backend Produksi** | Minggu 1 | Migrasi koneksi SQLite → PostgreSQL produksi (menggunakan `database/schema.sql` 10 tabel yang sudah siap), upgrade hashing kredensial server ke `crypto.scrypt` per-user salt, & pemisahan penuh seed kredensial dari file statis klien. |
| **Sprint 2 — Integrasi Perangkat Lapangan** | Minggu 2 | Integrasi Web Bluetooth ESC/POS untuk cetak langsung ke printer thermal 58mm fisik + integrasi webhook WhatsApp Business untuk notifikasi otomatis faktur & jatuh tempo. |
| **Sprint 3 — Pilot Testing di CV Arba'in** | Minggu 3 | Uji coba lapangan 5 hari bersama 2–3 sales & 1 admin gudang CV Arba'in Solo Raya; pengumpulan metrik riil (waktu input order, akurasi stok fisik vs sistem, feedback UX). |
| **Sprint 4 — Finalisasi Hilirisasi & KI** | Minggu 4 | Penyusunan berkas pendaftaran Hak Cipta Program Komputer (DJKI), SOP operasional CDOB & migrasi data 148+ outlet, serta finalisasi pitch deck Grand Final berbasis data pilot riil. |
