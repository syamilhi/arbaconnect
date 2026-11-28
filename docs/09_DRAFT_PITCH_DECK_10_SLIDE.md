# Draft Pitch Deck — ArbaConnect ERP v3.0 (Maksimal 10 Slide)

> **Format Target:** PowerPoint (`.pptx`) & PDF (`.pdf`) — Rasio 16:9  
> **Kompetisi:** UMS Health Innovation Hackathon 2026 (Tantangan ARB-02)  
> **Mitra Industri:** CV Arba'in Solo Raya (Gudang Sentral Kartasura, Sukoharjo)  
> **Panduan Visual:** Gunakan palet warna utama aplikasi (`#005c55` Teal Tua, `#0f766e` Hijau Aksen, `#f8fafc` Latar Bersih, `#dc2626`/`#d97706` untuk status alarm kritis/ROP). Maksimal 40–60 kata per slide agar mudah dibaca juri dalam 5–7 menit presentasi.

---

## Slide 1 — Cover (Identitas & Proposisi Utama)

**Judul Utama:**  
**ArbaConnect ERP v3.0**  
*Sistem Distribusi Logistik Herbal & CRM B2B Offline-First untuk CV Arba'in Solo Raya*

**Subjudul / Tagline:**  
Kendali Penuh Stok FEFO, Konsinyasi, & Sales Lapangan — Tetap Jalan di Area *Blank Spot*, Kepatuhan CDOB BPOM, Nol Lisensi Asing.

**Info Bawah Slide:**
- **Tantangan:** ARB-02 — Sistem CRM & Distribusi Terpadu
- **Mitra Industri:** CV Arba'in Solo Raya (Kartasura, Sukoharjo)
- **Tim:** [Nama Tim & Anggota — Universitas Muhammadiyah Surakarta]
- **Event:** UMS Health Innovation Hackathon 2026

**Arahan Visual:**
- Kiri: Judul, tagline, dan logo ArbaConnect / UMS.
- Kanan: Mockup berdampingan antara layar **Laptop (Dasbor Eksekutif)** dan **HP Android (Field Sales PWA)**.

**Catatan Presenter (~20 detik):**  
"Perkenalkan, kami dari tim [Nama Tim] menghadirkan **ArbaConnect ERP**, sistem logistik herbal dan CRM B2B *offline-first* yang kami bangun khusus menjawab tantangan operasional distribusi CV Arba'in Solo Raya."

---

## Slide 2 — Validasi Masalah Mitra (CV Arba'in Solo Raya)

**Judul Slide:**  
**Tantangan Nyata Distribusi Herbal di CV Arba'in Solo Raya**

**Konteks Mitra (Strip Atas):**  
`148+ Mitra Apotek & Minimarket` · `6 Sub-Rayon Solo Raya` · `Omset ~Rp 480 Jt/Bln` · `Kategori: Madu, Kapsul Herbal, Minyak & Kosmetik`

**4 Masalah Tervalidasi di Lapangan:**
1. **Pencatatan Manual & Area *Blank Spot***  
   Order lapangan via WhatsApp & nota kertas karbon rawan salah input ulang, duplikasi transaksi, dan kunjungan sales sulit dipantau.
2. **Susut Kedaluwarsa (*Expired Loss*) & Konsinyasi Macet**  
   Stok titipan di ratusan apotek tidak terlacak berdasarkan *Expired Date* (FEFO); barang mendekati ED sering terlambat ditarik atau digeser.
3. **Celah Kepatuhan CDOB BPOM**  
   Pelacakan nomor *batch* & prosedur penarikan (*Batch Recall*) secara manual memakan waktu lama; masa berlaku SIA/SIPA apotek belum terverifikasi otomatis.
4. **Kebocoran Piutang & Rute Kanvasing Tidak Efisien**  
   Penjualan kredit ke outlet menunggak (*overdue*) tidak terkunci otomatis, dan rute kunjungan harian belum teroptimasi.

**Arahan Visual:**
- Gunakan layout 4 kartu masalah (2x2 grid) dengan ikon merah/oranye dan angka dampak singkat.

**Catatan Presenter (~45 detik):**  
"Dari hasil pemetaan operasional CV Arba'in Solo Raya yang melayani 148+ apotek di 6 sub-rayon Solo Raya, kami menemukan 4 bottleneck utama: ketergantungan nota manual di area sinyal lemah, susut barang konsinyasi kedaluwarsa, lambatnya pelacakan batch CDOB BPOM, serta risiko piutang macet."

---

## Slide 3 — Solusi & Nilai Tambah (ArbaConnect ERP)

**Judul Slide:**  
**ArbaConnect: Satu Ekosistem Terpadu untuk 5 Peran Operasional**

**Peran Terintegrasi:**  
`Super Admin` · `Direktur` · `Admin Gudang` · `Admin Penjualan` · `Sales Lapangan`

**4 Pilar Solusi:**
1. **Field Sales PWA (*Offline-First*)**  
   Sales tetap bisa GPS Check-in, catat konsinyasi, ambil tanda tangan Apoteker, dan buat nota di area tanpa sinyal (antrean lokal IndexedDB).
2. **Kendali Stok FEFO & Buku Besar Imutabel**  
   Pemotongan stok batch otomatis berbasis kedaluwarsa terdekat, alarm *Reorder Point* (ROP), stiker QR Batch, dan **1-Klik Batch Recall**.
3. **Consignment Rebalancer & Credit Guardrail**  
   Deteksi otomatis stok titipan lambat/mendekati ED untuk digeser antar-apotek + penguncian otomatis order kredit outlet *overdue*.
4. **Sinkronisasi Real-Time Multi-Perangkat**  
   Begitu HP sales mendapat sinyal, data tersinkronisasi otomatis tanpa duplikasi dan layar Direktur/Gudang langsung ter-update instan.

**Arahan Visual:**
- Diagram alur horizontal 3 tahap: **Lapangan (Sales PWA)** → **Otorisasi & Gudang (Admin)** → **Keputusan Strategis (Direktur)**.

**Catatan Presenter (~45 detik):**  
"ArbaConnect menyatukan seluruh rantai distribusi dalam satu platform ringan yang langsung berjalan di HP Android biasa milik sales maupun komputer gudang—tanpa perlu membeli perangkat baru."

---

## Slide 4 — Arsitektur Solusi & Keunggulan Teknis

**Judul Slide:**  
**Arsitektur Ringan, *Offline-First*, & *Zero External Dependency***

**Diagram Arsitektur (Kiri — Visual Utama):**
- **Layer Klien (PWA):** Pure HTML5 / CSS3 / ES6 + Service Worker (`sw.js`) + IndexedDB Offline Queue + Camera QR (`BarcodeDetector`) + Canvas E-Signature.
- **Layer Sinkronisasi & API:** `POST /api/sync` (Idempoten via `client_uuid` anti-duplikasi) + `GET /api/events` (Server-Sent Events / SSE push real-time).
- **Layer Server & Basis Data:** Node.js Native HTTP + Built-in SQLite (`node:sqlite`, transaksi atomik `BEGIN IMMEDIATE...COMMIT`) dengan skema 10 tabel relasional siap migrasi ke **PostgreSQL** (`database/schema.sql`).

**Keunggulan Teknis Kunci (Kanan):**
- **0 NPM Dependencies:** Bebas *vendor lock-in* & biaya lisensi SaaS asing.
- **Keamanan Berlapis:** Strict RBAC 5 peran di server (`ROLE_ALLOWED_MUTATIONS`), sesi `HMAC-SHA256` (`HttpOnly; SameSite=Strict`), anti *brute-force*, header CSP/HSTS.
- **Kedaulatan Data:** *Self-hostable* di PC Server Gudang Kartasura atau VPS lokal Indonesia.

**Arahan Visual:**
- Diagram arsitektur 3-tier bersih di sisi kiri (60%), 3 kotak poin keunggulan teknis di sisi kanan (40%).

**Catatan Presenter (~50 detik):**  
"Secara teknis, keunggulan kami ada pada arsitektur *offline-first* idempoten dengan nol dependensi eksternal. Setiap transaksi offline diberi `client_uuid` agar tidak pernah ganda saat sinkronisasi, dipotong secara atomik di database relasional 10 tabel, dan langsung di-broadcast via SSE ke layar direksi."

---

## Slide 5 — Progres MVP Saat Ini (Purwarupa v3.0 Siap Demo)

**Judul Slide:**  
**Progres MVP: Sistem End-to-End Fungsional & Teruji Multi-Perangkat**

| Modul MVP | Fitur Nyata yang Sudah Berjalan | Status |
| :--- | :--- | :---: |
| **Dasbor Eksekutif** | KPI live (Omset, Mitra Aktif, Kunjungan, SKU Kritis ROP/ED), performa sales, proyeksi stok, ekspor CSV/cetak. | **Selesai** |
| **Stok & Buku Besar** | 9 SKU master (NIE BPOM + Halal BPJPH), FEFO & ROP, QR Batch ISO/IEC 18004, **1-Klik Batch Recall & Karantina**, monitor suhu/RH CDOB. | **Selesai** |
| **CRM B2B & Outlet** | Direktori outlet + validasi SIA/SIPA, Credit Limit Guardrail, *Consignment Rebalancer*, TSP + OSRM Route Optimizer, impor/ekspor CSV. | **Selesai** |
| **Verifikasi Order** | Guardrail CDOB (tahan batch kritis `<30 hari` & kredit *overdue*), potong stok atomik, **Surat Jalan 3 Rangkap** ber-NIE BPOM. | **Selesai** |
| **Field Sales PWA** | Mode Offline/Online, GPS Check-in, katalog & konsinyasi, Canvas E-Signature Apoteker, foto rak, nota thermal + share WA. | **Selesai** |

**Arahan Visual:**
- Tabel ringkas di atas dengan badge hijau `Selesai` + 2–3 *screenshot* kecil antarmuka nyata (Dasbor, Gudang QR/Recall, PWA Sales).

**Catatan Presenter (~45 detik):**  
"Saat ini ArbaConnect v3.0 bukan lagi sekadar mockup desain. Kelima modul inti sudah berjalan penuh secara end-to-end dengan database relasional persisten dan siap didemokan langsung antar-perangkat."

---

## Slide 6 — Skenario Alur Operasional (Live Demo Flow)

**Judul Slide:**  
**Dari Lapangan Tanpa Sinyal hingga Kendali Penarikan Batch dalam 1 Klik**

**4 Langkah Alur Nyata di Aplikasi:**
1. **Offline Check-in & Order (HP Sales)**  
   Matikan sinyal → GPS Check-in apotek → input order/konsinyasi + TTD Apoteker → tersimpan aman di antrean IndexedDB lokal.
2. **Auto-Sync & Update Instan (Multi-Device)**  
   Nyalakan sinyal → `POST /api/sync` otomatis → layar Laptop Direktur & Admin Gudang langsung ter-update via SSE tanpa *refresh*.
3. **Guardrail CDOB & Surat Jalan (Admin Penjualan)**  
   Sistem memblokir batch kritis `<30 hari` / outlet *overdue* → persetujuan order memotong stok FEFO atomik, mencatat buku besar SHA-256, & menerbitkan **Surat Jalan 3 Rangkap**.
4. **QR Batch & 1-Klik Batch Recall (Admin Gudang)**  
   Pindai stiker QR Batch ISO/IEC 18004 → jika ada instruksi BPOM, 1 klik langsung melacak seluruh apotek penerima, kirim WA Recall ke APA, dan mengarantina batch.

**Arahan Visual:**
- 4 kolom bernomor (1 → 2 → 3 → 4) berisi *screenshot* asli aplikasi pada tiap tahap + panah penghubung.

**Catatan Presenter (~40 detik):**  
"Inilah alur kerja nyata yang kami buktikan saat demo: mulai dari sales yang bekerja di area tanpa sinyal, sinkronisasi real-time ke pusat, validasi guardrail CDOB, hingga simulasi *Batch Recall* dalam hitungan detik."

---

## Slide 7 — Kepatuhan Regulasi Kesehatan, Keamanan Data, KI & TKDN

**Judul Slide:**  
**Kepatuhan CDOB BPOM, Perlindungan Data, Potensi KI & TKDN >88%**

**Kolom Kiri — Kepatuhan Regulasi Kesehatan & Data:**
- **CDOB BPOM (PerBPOM No. 6/2020):** FEFO wajib, buku besar batch imutabel, **1-Klik Batch Recall** (Bab VIII), dan monitoring suhu/RH gudang (`15–25°C, RH <60%`).
- **NIE BPOM & Halal BPJPH (UU No. 33/2014):** Atribut NIE (`POM TR/MD/NA`) & sertifikat Halal terintegrasi hingga stiker QR & Surat Jalan; validasi legalitas **SIA/SIPA** apotek.
- **UU PDP (UU No. 27/2022) & PP 71/2019:** Strict RBAC 5 peran, kriptografi sesi server-side, dan penyimpanan data di server lokal Indonesia.

**Kolom Kanan — Kekayaan Intelektual (KI) & TKDN:**
- **Rencana Pendaftaran KI (DJKI Kemenkumham):**  
  **Hak Cipta Program Komputer** atas sistem logistik herbal *offline-first* (sinkronisasi idempoten `client_uuid`, generator QR ISO/IEC 18004 tanpa library eksternal, dan algoritma *Consignment Rebalancer*).
- **TKDN Perangkat Lunak >88%:**  
  100% kode dikembangkan talenta lokal (UMS Surakarta), nol dependensi SaaS/framework asing berbayar, siap dipasang *on-premise* atau Data Center Indonesia.

**Arahan Visual:**
- Layout 2 kolom seimbang: Kiri bertema "Kepatuhan & Regulasi" (ikon perisai), Kanan bertema "KI & Kemandirian Teknologi (TKDN)" (badge `TKDN >88%`).

**Catatan Presenter (~50 detik):**  
"Di sektor kesehatan, kepatuhan adalah syarat mutlak. ArbaConnect dirancang selaras dengan CDOB BPOM, UU Jaminan Produk Halal, dan UU PDP. Selain itu, keunikan mesin sinkronisasi dan *Consignment Rebalancer* siap didaftarkan Hak Cipta di DJKI dengan estimasi TKDN perangkat lunak di atas 88%."

---

## Slide 8 — Estimasi Biaya (TCO) & ROI Nyata untuk Mitra

**Judul Slide:**  
**Efisiensi Biaya hingga 85% dibanding SaaS ERP — *Payback Period* < 1 Bulan**

**Tabel Perbandingan TCO Tahun Pertama (CV Arba'in — 15 Pengguna):**

| Komponen Biaya | Manual (Excel + WA) | SaaS ERP Komersial | **ArbaConnect ERP** |
| :--- | :---: | :---: | :---: |
| Lisensi Software / Bln | Rp 0 | Rp 3,5 – 6,0 Jt | **Rp 0** |
| Server / VPS Lokal / Bln | Rp 0 | Termasuk | **Rp 250 – 400 Rb** *(atau Rp 0 di PC Gudang)* |
| Perangkat Sales | HP Pribadi | HP / Tablet Khusus | **Rp 0** *(PWA di HP Android biasa)* |
| Printer Thermal 58mm *(Opsional)* | Nota Karbon ~Rp 400rb/bln | Printer Khusus | **Rp 250 Rb/unit** *(sekali beli)* |
| **Total Biaya Tahun ke-1** | **~Rp 4,8 Jt + *Hidden Loss*** | **Rp 42 – 72 Jt / thn** | **~Rp 4,5 – 6,5 Jt / thn** |

**Proyeksi Dampak Ekonomi & ROI (Asumsi Omset ~Rp 480 Jt/Bln):**
- **Cegah Susut Kedaluwarsa (1,5% omset):** Hemat **~Rp 7,2 Jt/bln** (~Rp 86,4 Jt/thn).
- **Optimasi Rute Kanvasing (hemat jarak 12–18%):** Hemat BBM & waktu **~Rp 1,5 – 2,5 Jt/bln**.
- **Titik Impas (*Payback Period*):** **< 1 bulan operasional** dari penghematan susut FEFO & ATK nota.

**Arahan Visual:**
- Tabel perbandingan di bagian atas (sorot kolom ArbaConnect dengan warna hijau lembut), diikuti 3 kotak angka besar di bawah: `Hemat ~Rp 86,4 Jt/thn`, `TCO ~Rp 5 Jt/thn`, `Payback < 1 Bln`.

**Catatan Presenter (~50 detik):**  
"Dibanding SaaS ERP komersial yang mencapai 42 hingga 72 juta per tahun, ArbaConnect hanya membutuhkan sekitar 4,5 hingga 6,5 juta rupiah di tahun pertama. Bahkan jika hanya menekan susut barang kedaluwarsa sebesar 1,5%, mitra sudah menghemat 7,2 juta per bulan—artinya biaya operasional tertutup dalam kurang dari satu bulan."

---

## Slide 9 — Model Bisnis & Strategi Hilirisasi

**Judul Slide:**  
**Strategi Adopsi Tanpa Hambatan & Model Bisnis Berkelanjutan**

**Kolom Kiri — Rencana Onboarding Mitra CV Arba'in (2 Minggu):**
- **Hari 1–3 (Migrasi Data):** Impor massal data master produk & 148+ apotek dari Excel/CSV melalui fitur **Impor CSV** bawaan.
- **Hari 4–7 (Pelatihan Per Peran):** Pelatihan singkat Admin Gudang, Penjualan, & Sales menggunakan istilah operasional Indonesia sehari-hari (*Nota, Barang Titipan, Surat Jalan*).
- **Minggu 2 (*Parallel Run*):** Uji jalan berdampingan selama 7 hari sebelum *cut-over* penuh tanpa mengganggu omset harian.

**Kolom Kanan — Model Bisnis & Skalabilitas (B2B Herbal & Farmasi):**
1. **Setup & Onboarding Fee (Sekali Bayar):** Instalasi *on-premise*/VPS lokal, migrasi data, & pendampingan SOP CDOB (**Rp 3 – 5 Jt/mitra**).
2. **Maintenance & SLA Support (Tahunan/Bulanan):** Pembaruan regulasi BPOM, backup otomatis, & dukungan teknis (**Rp 350 – 500 Rb/bln**).
3. **Add-On Integrasi:** Modul WhatsApp Business otomatis & integrasi printer thermal.
4. **Potensi Ekspansi:** Replikasi ke distributor herbal, kosmetik, dan PBF skala UMKM-menengah di Jawa Tengah & nasional.

**Arahan Visual:**
- Kiri: Timeline 3 fase onboarding (Hari 1–3 → Hari 4–7 → Minggu 2).
- Kanan: 3 blok sumber pendapatan (*Setup Fee*, *Maintenance SLA*, *Ekspansi Distributor*).

**Catatan Presenter (~45 detik):**  
"Agar mitra tidak kesulitan beradaptasi, kami menyiapkan jalur migrasi 2 minggu dengan fitur Impor CSV dan *parallel run*. Setelah sukses di CV Arba'in sebagai *flagship partner*, model bisnis berbasis *setup fee* dan *maintenance SLA* terjangkau ini siap direplikasi ke distributor herbal dan UMKM kesehatan lainnya."

---

## Slide 10 — Roadmap Menuju Grand Final & Penutup

**Judul Slide:**  
**Rencana Kerja 4 Minggu Menuju Grand Final**

| Tahap | Jadwal | Target Deliverable Konkret |
| :--- | :---: | :--- |
| **Sprint 1 — Backend Produksi** | Minggu 1 | Migrasi SQLite → **PostgreSQL** (skema 10 tabel siap pakai), upgrade hashing password ke `crypto.scrypt` per-user salt, & pemisahan penuh seed kredensial klien. |
| **Sprint 2 — Integrasi Lapangan** | Minggu 2 | Integrasi **Web Bluetooth ESC/POS** ke printer thermal 58mm fisik + webhook **WhatsApp Business** untuk notifikasi otomatis faktur & jatuh tempo. |
| **Sprint 3 — Pilot Testing Mitra** | Minggu 3 | Uji coba lapangan 5 hari bersama 2–3 sales & 1 admin gudang CV Arba'in Solo Raya; validasi metrik riil (kecepatan input order, akurasi stok fisik vs sistem, feedback UX). |
| **Sprint 4 — KI & Finalisasi** | Minggu 4 | Pengajuan berkas **Hak Cipta Program Komputer (DJKI)**, finalisasi SOP CDOB & migrasi 148+ outlet, serta pitch deck Grand Final berbasis data pilot riil. |

**Penutup (Footer CTA):**  
**"ArbaConnect ERP — Mendigitalisasi Distribusi Herbal Lokal dengan Standar CDOB, Tanpa Terhalang Sinyal."**  
*Terima Kasih · Siap Sesi Tanya Jawab & Live Demo*  
Kontak Tim: [Email / Nomor WA / GitHub Repo]

**Arahan Visual:**
- Diagram roadmap horizontal 4 kotak (Minggu 1 → Minggu 4) dengan ikon milestone, plus banner penutup teal tua di bawah.

**Catatan Presenter (~35 detik):**  
"Menuju Grand Final dalam 4 minggu ke depan, fokus kami jelas: pengerasan backend ke PostgreSQL di minggu pertama, integrasi printer Bluetooth & WhatsApp di minggu kedua, pilot testing langsung bersama tim CV Arba'in di minggu ketiga, dan pengajuan Hak Cipta DJKI di minggu keempat. Terima kasih, kami siap untuk sesi tanya jawab dan demo langsung."
