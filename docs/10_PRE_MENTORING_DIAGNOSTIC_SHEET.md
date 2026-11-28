# PRE-MENTORING DIAGNOSTIC SHEET (LEMBAR DIAGNOSTIK KENDALA TEKNIS)
**HACKATHON DAY 1 — UMS HEALTH INNOVATION HACKATHON 2026 (SABTU, 28 NOVEMBER 2026)**

> **Petunjuk Pengisian (Format Softfile — Wajib 1 Halaman PDF):** Isi menggunakan poin singkat dan padat (maks. 2–3 baris per sel) agar dokumen tetap tepat maksimal 1–2 halaman saat diekspor ke PDF. Pastikan tautan MVP/Video Demo dapat diklik langsung. Simpan di dalam folder Google Drive tim (`[KodeKlaster]_[NamaTim]`) dan kumpulkan melalui `ums.id/LUARAND1UMSHIHACK26` paling lambat Jumat, 27 November 2026 pukul 23.59 WIB.

---

## A. IDENTITAS TIM & TAUTAN PURWARUPA

| Field | Isian | Field | Isian |
| :--- | :--- | :--- | :--- |
| **Nama Tim** | [Isi Nama Tim] | **Kode Klaster** | `[ ] RS-01  [ ] ARB-01  [x] ARB-02`<br>`[ ] LKPI-01  [ ] LKPI-02  [ ] UMS-01` |
| **Institusi** | Universitas Muhammadiyah Surakarta (UMS) | **Ketua Tim / WA** | [Nama Ketua] / [No. WA Aktif] |
| **Judul Inovasi** | **ArbaConnect ERP v3.0** — Sistem Distribusi Logistik Herbal & CRM B2B *Offline-First* untuk CV Arba'in Solo Raya | **Mode Hadir Day 1** | `[ ] Luring (Sunan Hotel)  [ ] Daring (Zoom)` |
| **Tautan MVP / Demo** | [Tempel link aktif aplikasi / video demo 2–3 mnt] | **Capaian MVP (%)** | **85%** dari komitmen Problem-Owner Clinic |

---

## B. RINGKASAN PROGRES KOMITMEN MVP SAAT INI

| Fitur / Komponen Inti yang SUDAH Berjalan (Ready Demo) | Fitur / Komponen yang MASIH Dalam Pengerjaan (WIP) |
| :--- | :--- |
| 1. **Field Sales PWA (*Offline-First*):** GPS Check-in, kanvasing & konsinyasi, Canvas E-Signature Apoteker, foto rak, antrean IndexedDB + *auto-sync* idempoten (`POST /api/sync`), & nota thermal/WA.<br>2. **Stok FEFO, Buku Besar Imutabel & CDOB:** 9 SKU ber-NIE BPOM & Halal BPJPH, potong stok atomik, QR Batch ISO/IEC 18004 (pindai kamera), **1-Klik Batch Recall & Karantina**, monitor suhu/RH gudang.<br>3. **Dasbor Eksekutif, CRM B2B & Order Guardrail:** KPI live multi-perangkat via SSE (`GET /api/events`), validasi SIA/SIPA, *Credit Limit Guardrail*, *Consignment Rebalancer*, TSP+OSRM Route Optimizer, & Surat Jalan 3 Rangkap.<br>4. **Keamanan & RBAC Server-Side:** 5 peran operasional, sesi `HMAC-SHA256`, & database relasional SQLite 10 tabel (`database/schema.sql`). | 1. **Migrasi Database & Hardening Produksi:** Transisi dari `node:sqlite` lokal ke PostgreSQL produksi, upgrade hashing kredensial ke `crypto.scrypt` per-user salt, & pemisahan penuh seed kredensial klien.<br>2. **Integrasi Perangkat & Kanal Lapangan:** Cetak langsung ke printer thermal 58mm via Web Bluetooth (ESC/POS) serta webhook WhatsApp Business untuk notifikasi otomatis faktur & jatuh tempo.<br>3. **Pilot Testing & Finalisasi KI:** Uji coba lapangan 5 hari bersama 2–3 sales & admin gudang CV Arba'in Solo Raya + pemberkasan Hak Cipta Program Komputer (DJKI). |

---

## C. KENDALA TEKNIS UTAMA (TECHNICAL BLOCKERS) & PERTANYAAN KUNCI UNTUK MENTOR-JURI
*Maksimal 3 poin paling krusial yang ingin dibedah pada Sesi Klinik Pagi (15 menit/tim — Rumus 3–10–2):*

| No | Kendala Teknis Utama (Technical Blocker) | Upaya yang Sudah Dicoba / Akar Masalah | Pertanyaan Kunci untuk Mentor-Juri (Teknis / Regulasi / Bisnis) |
| :---: | :--- | :--- | :--- |
| **1** | **Konflik Sinkronisasi Stok FEFO Saat Transaksi *Offline* Bersamaan (*Race Condition*)** pada batch terakhir yang tersisa di gudang. | Sudah menerapkan `client_uuid` idempoten & transaksi atomik `BEGIN IMMEDIATE` di SQLite. Namun jika 2 sales *offline* memesan batch FEFO terakhir secara bersamaan, order kedua berisiko kekurangan stok saat *auto-sync*. | Untuk SOP distributor herbal CV Arba'in, mana yang lebih disarankan: *auto-split* otomatis ke batch FEFO berikutnya, atau menahan order berstatus `menunggu_stok` agar diputus Admin Penjualan? |
| **2** | **Keterbatasan Cetak Thermal 58mm Langsung via Web Bluetooth (ESC/POS)** di variasi HP sales (Android lama & iOS Safari). | Nota thermal sudah berjalan via *browser print* & *share* WhatsApp. Uji koneksi Web Bluetooth langsung dari PWA masih terkendala perbedaan dukungan browser lintas perangkat sales. | Untuk tahap adopsi awal di CV Arba'in, apakah nota digital WhatsApp + cetak thermal via *bridge* Android sudah sah & diterima apotek sebagai bukti serah-terima barang/konsinyasi? |
| **3** | **Validasi Jejak Audit CDOB BPOM & Skema Hosting (*On-Premise* vs VPS Lokal)** agar patuh regulasi namun tetap hemat biaya (TCO). | Atribut NIE BPOM, Halal, SIA/SIPA, QR Batch, 1-Klik Recall, & RBAC sudah dibangun merujuk PerBPOM No. 6/2020 & UU PDP. Tim menimbang pemasangan di PC Gudang Kartasura (*on-premise*) vs VPS lokal (~Rp 300rb/bln). | Bukti/laporan audit digital apa yang paling krusial agar lolos inspeksi CDOB BPOM, dan skema *deployment* mana yang paling realistis bagi operasional CV Arba'in pasca-hackathon? |

---
*Taskforce UMS Health Innovation Hackathon 2026 — DRPPS Universitas Muhammadiyah Surakarta*
