# Laporan Revisi & Penyempurnaan Sistem ArbaConnect ERP (Pasca Evaluasi)

**Proyek:** ArbaConnect ERP — Sistem Distribusi, Stok FEFO & Field Sales PWA  
**Mitra:** CV Arba'in Solo Raya (Tantangan ARB-02 — UMS Health Innovation Hackathon 2026)  
**Tanggal Pembaruan:** 28 November 2026  
**Versi Aplikasi:** v3.0.0 (PWA Cache `v31`)

---

## 1. Ringkasan Eksekutif

Dokumen ini mencatat seluruh revisi, penambahan fitur, dan perbaikan arsitektur yang telah diimplementasikan berdasarkan **hasil evaluasi sesi presentasi penguji** serta **temuan teknis saat deployment di Vercel**. Fokus utama revisi meliputi:

1. **Pemisahan Sistem Audit Log (`audit_logs`)** dari tabel transaksi utama untuk kebutuhan audit kepatuhan CDOB/BPOM dan pelacakan siklus hidup barang (*end-to-end traceability*).
2. **Kebijakan & Mekanisme *Override* Mendesak Barang Mendekati Kedaluwarsa (Near-ED)** serta pemblokiran mutlak barang yang sudah *expired* atau dikarantina.
3. **Integrasi Data & Persistensi Lintas Perangkat pada Vercel** menggunakan adapter Cloud KV (Vercel KV / Upstash Redis), stabilisasi token sesi *serverless*, serta *polling fallback*.
4. **Penyempurnaan UI/UX Mode *Offline* & Sinkronisasi**, meliputi penghapusan *double alert* di Field Sales PWA, penambahan *progress bar* sinkronisasi, perbaikan tombol **"Kirim ke Pusat"**, dan peningkatan responsivitas *mobile* untuk seluruh peran (termasuk Admin & Direktur).

---

## 2. Matriks Evaluasi & Implementasi Revisi

| No | Masukan Penguji / Temuan Teknis | Solusi yang Diimplementasikan | Berkas Terkait | Status |
|---|---|---|---|---|
| 1 | **Log data harus terpisah dari transaksi utama** agar auditor mudah melacak 1 barang dari masuk hingga terjual (siapa, outlet mana, tanggal & jam). | Pembuatan tabel SQL terpisah `audit_logs`, endpoint `GET /api/audit-logs`, pencatatan otomatis seluruh event penting, dan panel UI **"Audit Log Terpisah & Pelacakan Jejak Barang"**. | `database/schema.sql`, `server/server.js`, `js/store.js`, `js/views/inventoryLedger.js` | Selesai |
| 2 | **Kebijakan penjualan barang *expired* & mendekati *expired*** (aman ditahan, kecuali kondisi mendesak sebelum ED dengan konfirmasi admin). | Blokir mutlak produk *expired*/karantina di sisi client & server; pesanan produk Near-ED (<30 hari) otomatis ditahan (`PENDING_EXPIRY_OVERRIDE`) dan memerlukan tombol **"Setujui Override Mendesak (Near-ED)"** oleh Admin Penjualan/Gudang dengan alasan tercatat di `audit_logs`. | `server/server.js`, `js/store.js`, `js/views/fieldSalesPwa.js`, `js/views/orderApproval.js` | Selesai |
| 3 | **Data tidak berubah / tidak terintegrasi lintas perangkat saat deploy di Vercel.** | Penambahan adapter Cloud KV (Vercel KV / Upstash Redis REST *zero-dependency* dengan deteksi otomatis *custom prefix*), perbaikan `SERVER_AUTH_SECRET` deterministik antar-instance, perbaikan fallback DB in-memory, mekanisme anti-overwrite, *polling fallback* 10 detik, dan perbaikan `Cache-Control` aset statis. | `server/server.js`, `js/offlineSync.js`, `vercel.json`, `.env.example`, `sw.js`, `index.html` | Selesai |
| 4 | **Indikator bekerja *offline* dan notifikasi/progres sinkronisasi ("Sinkronisasi sukses").** | Penambahan Global Sync Progress Banner untuk role Admin/Direktur serta integrasi *progress bar* & status *"Sinkronisasi Sukses!"* langsung di banner PWA. | `index.html`, `js/app.js`, `js/offlineSync.js`, `js/views/fieldSalesPwa.js`, `css/components.css` | Selesai |
| 5 | **Perbaikan *double alert* di Field Sales PWA & tombol "Kirim ke Pusat" kadang tidak merespons saat ada antrean.** | Menyembunyikan banner global saat di halaman Field Sales PWA sehingga hanya tampil **1 banner tunggal** di bawah statistik kunjungan; memperbaiki *silent failure* saat klik manual (menampilkan status `Mengirim...`, pesan error eksplisit seperti offline/`401`, dan membersihkan antrean lokal saat berhasil). | `js/app.js`, `js/views/fieldSalesPwa.js`, `js/store.js`, `js/offlineSync.js` | Selesai |
| 6 | **Seluruh peran (termasuk Admin & Direktur) harus nyaman diakses dari HP.** | Penambahan aturan responsif *mobile* (`@media (max-width: 768px)`) untuk tabel gulir sentuh, modal dialog, padding kontainer, dan toast notifikasi. | `css/components.css` | Selesai |
| 7 | **Peta Field Sales PWA tetap dapat diakses saat *offline* (anti layar abu-abu).** | Penambahan fitur **Unduh Peta Offline** (*pre-cache* tile OSM area seluruh outlet Solo Raya zoom 15–16 ke `MAP_CACHE` Service Worker) serta **Mode Radar GPS Offline** (SVG lokal + geofence 50m + jarak Haversine & arah mata angin) sebagai *fallback* otomatis saat tile belum ter-cache. | `js/views/fieldSalesPwa.js`, `sw.js`, `index.html` | Selesai |

---

## 3. Rincian Teknis Revisi

### 3.1. Sistem Audit Log Terpisah (`audit_logs`)
* **Struktur Tabel Terpisah:** Ditambahkan tabel `audit_logs` pada `database/schema.sql` dan `server/server.js` (SQLite + Cloud KV) dengan indeks pada `(product_sku, no_batch, created_at)` dan `(actor, created_at)`.
* **Jenis Aktivitas yang Dicatat Otomatis:**
  * `INBOUND_BATCH` (penerimaan barang masuk gudang)
  * `ADJUST_STOCK` (penyesuaian stok opname)
  * `ORDER_CREATED` (pembuatan order oleh sales)
  * `ORDER_NEAR_ED_HELD` (penahanan otomatis order yang memuat barang Near-ED)
  * `NEAR_EXPIRY_OVERRIDE` (persetujuan khusus override mendesak Near-ED beserta alasan dan penyetuju)
  * `ORDER_APPROVED` & `ORDER_REJECTED` (otorisasi/penolakan faktur)
  * `ORDER_DELIVERED` (serah terima / POD pengiriman armada)
  * `BATCH_RECALL_QUARANTINE` (karantina & penarikan batch CDOB)
  * `VISIT_LOGGED` (aktivitas kunjungan GPS lapangan)
* **Endpoint & Tampilan Auditor:**
  * Endpoint `GET /api/audit-logs` mendukung parameter query `sku`, `batch`, `actor`, `outletId`, `action`, dan pencarian bebas `q`.
  * Pada halaman **Gudang & Buku Besar Stok**, ditambahkan bagian khusus **Section 3: Audit Log Terpisah & Pelacakan Jejak Barang (Traceability)** lengkap dengan kotak pencarian dan filter tipe aktivitas.

### 3.2. Aturan Barang *Expired* & *Override* Mendesak (Near-ED)
* **Blokir Mutlak (*Expired* / Karantina):** Fungsi `isProductExpired()` memblokir penambahan produk ke keranjang di UI PWA (`fieldSalesPwa.js`), menolak mutasi di `store.js`, serta menolak request `SUBMIT_ORDER` di `server.js` dengan pesan kepatuhan CDOB.
* **Penahanan & *Override* Near-ED (<30 Hari / Kritis):**
  * Produk dengan status FEFO kritis (`<= 30` hari sebelum kedaluwarsa) diberi label peringatan *"Near-ED — Ditahan, butuh Override Admin"* pada katalog PWA.
  * Saat dipesan untuk kebutuhan mendesak outlet, order berstatus `PENDING` dengan `syncStatus = 'PENDING_EXPIRY_OVERRIDE'` dan **stok belum dipotong**.
  * Pada halaman **Verifikasi Order**, muncul banner kuning peringatan beserta tombol **"Setujui Override Mendesak (Near-ED)"** yang meminta input alasan persetujuan, memotong stok FEFO, menyetujui order (`APPROVED`), dan mencatat mutasi `APPROVE_EXPIRY_OVERRIDE` ke `audit_logs`.

### 3.3. Integrasi Data & Persistensi Deploy Vercel
* **Adapter Cloud KV (Vercel KV / Upstash Redis):**
  * Menggunakan `fetch` bawaan Node.js (*zero-dependency*) dengan format command REST standar Upstash (`["GET", key]` dan `["SET", key, value]`).
  * Mendukung deteksi otomatis baik nama variabel standar (`KV_REST_API_URL`/`TOKEN`, `UPSTASH_REDIS_REST_URL`/`TOKEN`) maupun variabel dengan *Custom Prefix* dari Vercel Marketplace (`*_KV_REST_API_*`, `*_UPSTASH_REDIS_REST_*`).
  * Endpoint `GET /api/health` (terautentikasi) kini menampilkan `storageMode`, `cloudKvConfigured`, `cloudKvEnvSource`, dan `detectedStorageEnvKeys`.
* **Stabilitas Autentikasi Serverless:** `SERVER_AUTH_SECRET` diturunkan secara deterministik dari `ARBA_AUTH_SECRET` atau metadata deployment Vercel (tanpa *random per-boot nonce*), mencegah error `401` saat berpindah container serverless.
* **Sinkronisasi Cerdas & Anti-Overwrite:** Penambahan `stateVersion` mencegah state lokal yang lebih baru tertimpa data awal apabila container *ephemeral* baru saja *cold start*, disertai *polling fallback* otomatis setiap 10 detik ketika SSE terputus.
* **Kebijakan Cache Aset:** Header `Cache-Control` pada `/(css|js|icons)/(.*)` di `vercel.json` diubah menjadi `public, max-age=0, must-revalidate` dan versi cache Service Worker diperbarui ke `arbaconnect-pwa-v31` agar setiap pembaruan deploy langsung diterima pengguna.

### 3.4. Penyempurnaan UI/UX Mode *Offline*, Progress Sinkronisasi & Mobile
* **Satu Banner Tunggal di Field Sales PWA:** `#global-sync-status-banner` disembunyikan otomatis saat berada di rute `field-sales-pwa-preview` sehingga tidak terjadi *double alert*; seluruh informasi status *offline*, progress bar sinkronisasi, notifikasi *"Sinkronisasi Sukses!"*, dan pesan error terpusat di 1 banner tepat di bawah statistik kunjungan (*Kunjungan / Order / Omset*).
* **Responsivitas Tombol "Kirim ke Pusat":** Menangani klik manual (`manual: true`), mencegah *silent failure* saat sedang sibuk (`isSyncing`) atau gagal (`401`/offline), mengubah label tombol menjadi `Mengirim...` selama proses pengiriman, serta memastikan `offlineQueue` dibersihkan setelah pengiriman berhasil.
* **Responsivitas Mobile Semua Role:** Aturan media query `@media (max-width: 768px)` di `css/components.css` mengoptimalkan tampilan tabel (*touch scroll*), modal, dan toast pada layar smartphone untuk Admin Gudang, Admin Penjualan, dan Direktur.

---

## 4. Daftar Berkas yang Dimodifikasi

| Berkas | Ringkasan Perubahan |
|---|---|
| `database/schema.sql` | Tambah tabel `audit_logs`, indeks pelacakan, serta kolom `expiry_override_*` pada tabel `orders`. |
| `server/server.js` | Tambah adapter Cloud KV (Upstash/Vercel KV + deteksi *custom prefix*), stabilisasi `SERVER_AUTH_SECRET`, perbaikan fallback in-memory, tabel & endpoint `GET /api/audit-logs`, validasi *expired*, serta mutasi `APPROVE_EXPIRY_OVERRIDE` & `QUARANTINE_BATCH`. |
| `js/offlineSync.js` | Tambah event `arba:sync-progress`, anti-overwrite berbasis `stateVersion`, *polling fallback* 10 detik, penanganan pesan error `401`/manual sync, dan pembersihan antrean lokal. |
| `js/store.js` | Tambah `auditLogs`, `stateVersion`, `recordAuditLog()`, `isProductExpired()`, `isProductNearExpiry()`, `approveExpiryOverride()`, perbaikan `syncNow()` & `setNetworkOnlineState()`, serta sinkronisasi `QUARANTINE_BATCH`. |
| `js/app.js` | Tambah controller Global Sync Progress Banner untuk role Admin/Direktur, sembunyikan banner global di halaman PWA (anti *double alert*), dan pembaruan cache `v31`. |
| `js/views/inventoryLedger.js` | Tambah panel **Section 3: Audit Log Terpisah & Pelacakan Jejak Barang (Traceability)** beserta pencarian & filter aksi. |
| `js/views/fieldSalesPwa.js` | Tambah blokir produk *expired*/karantina, label peringatan Near-ED, penyatuan banner tunggal offline + progress bar di bawah statistik kunjungan, dan perbaikan tombol `#btn-pwa-sync-now`. |
| `js/views/orderApproval.js` | Tambah banner peringatan Near-ED dan tombol/alur **Setujui Override Mendesak (Near-ED)**. |
| `index.html` | Tambah elemen `#global-sync-status-banner` dan pembaruan cache-busting aset ke `?v=31`. |
| `css/components.css` | Tambah styling `.global-sync-banner` (offline/syncing/success/error + progress bar) dan aturan responsif mobile (`<= 768px`). |
| `vercel.json` | Ubah `Cache-Control` aset `/(css|js|icons)/(.*)` menjadi `public, max-age=0, must-revalidate`. |
| `sw.js` | Naikkan `CACHE_VERSION` ke `arbaconnect-pwa-v31`. |
| `.env.example` | Tambah dokumentasi variabel `KV_REST_API_URL`, `KV_REST_API_TOKEN`, dan `UPSTASH_REDIS_REST_*`. |

---

## 5. Hasil Verifikasi & Pengujian

1. **Pemeriksaan Sintaks (`node --check`):** Seluruh berkas JavaScript backend dan frontend (`server.js`, `offlineSync.js`, `store.js`, `app.js`, `inventoryLedger.js`, `orderApproval.js`, `fieldSalesPwa.js`, `sw.js`) lulus tanpa error sintaks.
2. **Pengujian End-to-End API & Audit Log:**
   * `GET /api/health` merespons `200 OK` dengan metrik `storageMode`, `cloudKvConfigured`, dan jumlah baris `audit_logs`.
   * `POST /api/sync` (`ADD_INBOUND_BATCH`) menaikkan `stateVersion` dan mencatat `INBOUND_BATCH` ke `audit_logs`.
   * `POST /api/sync` (`SUBMIT_ORDER` dengan produk Near-ED `SKU-ARB-EVO250`) menahan order (`PENDING_EXPIRY_OVERRIDE`) dan mencatat `ORDER_NEAR_ED_HELD`.
   * `POST /api/sync` (`APPROVE_EXPIRY_OVERRIDE`) menyetujui order (`APPROVED`), memotong stok, dan mencatat `NEAR_EXPIRY_OVERRIDE` pada `GET /api/audit-logs`.
3. **Verifikasi Deteksi Environment Cloud KV:** Teruji mendeteksi variabel standar maupun *custom prefix* (contoh: `ARBA_KV_REST_API_URL` + `ARBA_KV_REST_API_TOKEN`) dengan hasil `storageMode: "cloud-kv"` dan `cloudKvConfigured: true`.
