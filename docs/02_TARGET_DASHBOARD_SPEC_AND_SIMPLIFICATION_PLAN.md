# Target Dashboard Standard & Simplification Plan

**Objective:** Refactor ArbaConnect ERP's UI into a clean, regular, functional business dashboard—eliminating over-explaining text, hardcoded/fake metrics, redundant navigation, and CSS inconsistencies while preserving the working state store, SQLite sync, and RBAC logic.

---

## 1. Defining "Correct": Regular Good Dashboard Format

A regular, well-crafted operational dashboard follows five rules:
1. **No self-describing UI copy**: Components show data, labels, and actions—never paragraphs explaining *why* a feature exists, *how* the algorithm works, or *what role the user has*.
   - **Bad**: `"Hasil Penyelarasan Wawancara Mitra CV Arba'in (6 Fokus Utama)"` / `"Istilah & informasi disesuaikan untuk pengambilan keputusan direksi..."`
   - **Good**: `"Stok Menipis"` / `"Ringkasan Penjualan"`
2. **Every visible number is real**: Every KPI, chart, table, notification, and counter must derive from `window.ArbaStore` (`products`, `outlets`, `orders`, `ledger`, `salesTeam`, `driverManifests`, `visitLogs`). If a metric has no backing data, remove the widget rather than faking it.
3. **Calm visual hierarchy**:
   - Page header = **Title** (2–5 words) + **Primary CTA** (+ optional compact secondary menu). No multi-sentence subtitles, no 3-item breadcrumbs, no rainbow strips of 5–6 action pills.
   - Standard neutral surfaces (`bg-surface-container-lowest`, subtle borders) with semantic color reserved strictly for status badges and alerts—not full-width pastel gradient banners.
4. **One place for each control**:
   - Account / Logout / Switch User lives in one clean header profile menu + `/user-profile-settings`.
   - Each operational tool lives in its natural view (e.g., Rebalance & Credit Score in CRM; QR & Chain Audit in Inventory), not repeated as a 5-button "automation bar" on the Executive Dashboard.
5. **Consistent CSS without inline-style patches**: Standardize on `css/tokens.css`, `css/components.css`, and `css/utilities.css` (or a clean component-first layout) with zero undefined utility classes and no `zoom: 0.9` root hack.

---

## 2. Shell, Header & Auth Simplification

| Target | Current State | Target ("Correct") State |
| :--- | :--- | :--- |
| **`#role-context-strip`** (`index.html`, `js/app.js`) | Full-width pastel gradient banner on every view explaining the user's role & system terms. | **Remove completely.** |
| **`#header-brand-subtitle`** (`js/app.js`) | Overwritten with ALL CAPS `cfg.roleTitle`. | Keep static concise subtitle (`CV Arba'in Solo Raya`) or omit on smaller screens. |
| **Header Actions** (`index.html`, `js/app.js`) | Search + Role Select + Sync Pill + Install PWA + Fullscreen + Dark Mode + Notif + Profile Pill (opens redundant modal) + Switch Account button. | Streamline: Search + Sync Status + Dark Mode + Live Notif Menu + Profile Dropdown/Action (links to Profile Settings & Logout). Keep Role Switcher only for `super-admin`. Remove `openProfileModal()` redundancy. |
| **Notification Menu** (`index.html`, `js/app.js`) | 3 hardcoded items (`Madu Randu`, `99.4%`). | Render dynamically from `getAnalytics()` (`pendingOrders`, `orangeStockAlarms.length`, `pinkExpiryAlarms.length`). |
| **Sidebar** (`index.html`, `js/app.js`) | Role-rewritten nav labels + `.cdob-full-card` static blurb. | Consistent, concise nav labels (`Dasbor`, `Stok & Gudang`, `Mitra Outlet`, `Verifikasi Order`, `Aplikasi Sales`, `Manajemen User`, `Profil`). **Remove `.cdob-full-card`.** |
| **Footer** (`index.html`) | `ArbaConnect v2.5.0-Vanilla • Arsitektur Logistik...` | Align version (`v3.0.0` matching `package.json`) and keep single-line minimal footer. |
| **Login Portal** (`js/auth.js`) | Pre-filled `superadmin`/`admin123`, plaintext password hints, 5-bullet role essay, info callout. | Clean 2-column or centered login card: empty inputs by default, clean "Quick Demo Account" selector *without* printing passwords inline or writing instructional essays. |

---

## 3. View-by-View Simplification Plan

### 3.1 Executive Dashboard (`js/views/executiveDashboard.js`)
- **Remove**:
  - Top 5-button "Alat Bantu Keputusan Cepat" (`OTOMASI AKTIF`) bar.
  - "Hasil Penyelarasan Wawancara Mitra (6 Fokus Utama)" header & copy.
  - Hardcoded Dual-Bar SVG chart (`138M` / `412M`), hardcoded Micro-Insights footer (`99.4%`, `Rp 3.260.000`), hardcoded RFM Segmentation (`34 Apotek`, `58 Mitra`, `12 Mitra`) & hardcoded Repeat Order Projection (`Apotek Sehat Mandiri`, `Minimarket Barokah`), and fake `Latency 42ms` WebSocket indicator.
  - `VALIDATED TKT 5` badge and hardcoded city revenue table in PDF modal.
- **Keep & Make Clean/Live**:
  - **Page Header**: `"Dasbor Eksekutif"` + `"Ekspor CSV"` and `"Cetak Laporan"` buttons.
  - **4 Live KPI Cards**: Omset Bulan Ini, Mitra Outlet Aktif, Kunjungan Sales Hari Ini, SKU Kritis (ROP & Kedaluwarsa)—using live `getAnalytics()` data.
  - **2-Column Actionable Alerts** (fix `.lg:grid-cols-2`):
    - **Stok Menipis** (`orangeStockAlarms`, concise SKU / sisa / ROP / `Restock` button).
    - **Mendekati Kedaluwarsa** (`pinkExpiryAlarms`, concise lokasi / produk / ED / `Tindak Lanjuti` button).
  - **2-Column Performance & Turnover**:
    - **Performa Tim Sales** (live table from `analytics.salesPerformance`).
    - **Ketahanan Stok & Proyeksi Produksi** (live table from `analytics.stockTurnover` / `productForecasting`).
  - **Pesanan Terbaru** (live paginated `orders` table with search & status filter, minus fake WebSocket latency text).

### 3.2 Inventory & Stock Ledger (`js/views/inventoryLedger.js`)
- **Remove**:
  - External Google image banner (`Audit Operasional • Gudang Utama Kartasura`).
  - Hardcoded SVG Donut (`42 Batch`), hardcoded Safety Stock bar (`33 SKU + 5 + 4`), hardcoded `Rp 14.200.000` & `SHA256 OK` cards, and hardcoded ledger footer (`Blok Hash: 9d8f...3e2a1`).
  - Verbose 2-row 8-button header & interview-quote subtitle on Sales Loadings (`contoh: ambil 15 dari gudang...`).
- **Keep & Make Clean/Live**:
  - **Page Header**: `"Stok & Buku Besar"` + primary `"+ Barang Masuk"` + compact `"Opname"`, `"PO Supplier"`, and `"Lainnya"` (QR, Impor/Ekspor CSV, Cetak).
  - **4 Live KPI Cards**: Total SKU & Unit Fisik, SKU Di Bawah ROP, Batch Mendekati ED (computed from `products`), Total Mutasi Ledger (computed from `ledger.length`).
  - **Katalog Stok & ROP Table** (live search, category/ROP filter, Restock PO trigger).
  - **Barang Bawaan Sales** (concise cards for `salesLoadings` + reconcile modal).
  - **Buku Besar Mutasi (`stock_ledger`)** (filter pills + clean table, optional link to Chain Audit modal).

### 3.3 B2B CRM & Directory (`js/views/b2bCrm.js`)
- **Remove**:
  - Contradictory hardcoded KPI values (`168 + ...`, `104`, `64`, `94.2%`, `1.024+ Mitra`).
  - Static identical SVG sparkline (`Jan: 16.2 Jt ... Apr: 26.0 Jt`) in the outlet detail drawer.
  - Static `"Armada Pengiriman Hari Ini"` box (`34 Outlet`, `28 Outlet`).
  - Duplicate cross-view buttons (`Tarik & Geser Stok Macet`, `Skor Kelayakan Kredit`, `Peta & Rute Kunjungan`) if kept only as secondary tools or consolidated cleanly.
- **Keep & Make Clean/Live**:
  - **Page Header**: `"Mitra Outlet"` + `"+ Tambah Outlet"` + `"Ekspor CSV"` / `"Impor CSV"`.
  - **4 Live KPI Cards**: Total Mitra (computed from `outlets` or consistent `analytics.totalOutlets`), Apotek vs Minimarket (computed), Status Kredit Lancar vs Perhatian/Overdue (computed), Total Limit/Piutang Berjalan (computed).
  - **Filter Bar + Master Table + Outlet Detail Drawer**: Compute outlet order history/YTD from `orders` + `selectedOutlet` without fake monthly sparkline numbers.

### 3.4 Order Approval Queue (`js/views/orderApproval.js`)
- **Remove**:
  - Magic-offset tab counts (`28 + ... - 1`, hardcoded `14`, `1 + ...`).
  - Stale hardcoded sales rep options (`Anita Rahmawati`, `Hadi Kurniawan`).
  - Fake bottom-left `"Realtime WebSocket Sync"` stream (`10:12:44`, `10:05:19`, `09:51:02`) and hardcoded bottom-right fleet card (`8 Outlet`, `6 Outlet`).
  - Hardcoded `"Madu Hutan Liar"` copy in `openSubstituteBatchModal`.
- **Keep & Make Clean/Live**:
  - **4 Tab Cards with exact live counts**: `Menunggu` (`pendingOrders.length`), `Disetujui` (`approvedOrders.length`), `Pengiriman` (`driverManifests` order count), `Ditolak` (`rejectedOrders.length`).
  - **Sales Rep Filter** populated dynamically from `state.salesTeam`.
  - **Selected Order Detail + Queue List** + working `Batch Approve`, `Adjust Qty`, `Substitute Batch` (wired to `substituteOrderBatch()`), `Reject`, and `Surat Jalan`.
  - Optional concise footer panels reading live `state.ledger.slice(0, 3)` and `state.driverManifests` (or omit footer panels altogether for a cleaner queue page).

### 3.5 Field Sales PWA (`js/views/fieldSalesPwa.js`)
- **Remove**:
  - Dead `state.isPhoneFrame` & URL `?pwa=` override, plus dead `.phone-simulation-frame` / `.phone-screen` rules in `css/components.css`.
  - Verbose step numbering (`2. Pilih Barang / Scan Kemasan`), explanatory offline banner prose (`Mode Offline-First (Disimpan di IndexedDB Lokal)`), and verbose CTA (`Simpan Tagihan & Ganti Nota Baru` → `Simpan Nota`).
  - Fake `TTD Cepat` auto-signature button and fake canvas `Ambil Foto Audit` generator (keep real Canvas signature drawing + real file/camera `<input type="file" capture="environment">`).
  - Silent fake GPS fallback: clearly distinguish `"GPS Terverifikasi"` vs `"Check-in Manual"` if device geolocation is unavailable.

### 3.6 User Profile & Admin (`js/views/userProfileAndAdmin.js`)
- **Simplify**:
  - Concise headers (`Profil & Keamanan`, `Manajemen Pengguna`) without `SUPER ADMIN CONTROL CENTER` banners.
  - Remove the redundant "Halaman yang Dapat Diakses" module directory card from Profile Settings (sidebar already handles navigation).
  - Mask passwords by default in User Management (`••••••`) with explicit per-user reset in the edit modal rather than a bulk plaintext password column.

### 3.7 Advanced Modals (`js/advancedFeatures.js`)
- Replace `.modal-card` with standard `.modal-dialog` (or define `.modal-card` cleanly in `css/components.css`) so all modals share consistent light/dark theme styling.
- Remove hackathon/AI buzzwords (`OPTICAL FEFO SCANNER v2.5`, `🤖`, `💡 Alasan AI:`, `ANTI-MANIPULASI STOK`, `PETA TELEMETRI GEOFENCE`). Keep clean titles: `Scan QR Batch`, `Mutasi Stok Konsinyasi`, `Rute Kunjungan`, `Skor Kredit Outlet`, `Audit Buku Besar`.

---

## 4. CSS Architecture Cleanup (`css/*`)

1. **Remove `html { zoom: 0.9; }`** from `css/tokens.css` (and remove compensating `zoom: 1.1111` / `zoom: 1 !important` hacks), adjusting base font sizes cleanly if needed.
2. **Audit & unify classes**:
   - Either add missing utility classes (`lg:grid-cols-2`, `sm:grid-cols-4`, `font-extrabold`, spacing/color utilities) to `css/utilities.css` OR migrate ad-hoc inline styles and missing utilities to clean semantic component classes in `css/components.css` (`.kpi-grid`, `.kpi-card`, `.data-table`, `.badge`, `.card`, `.modal-dialog`).
   - Fix dark-mode contrast in places that currently hardcode light-mode hex values via inline styles (`bg-white`, `#0f172a`, `#f8fafc`).

---

## 5. Recommended Execution Order (For Approval)

1. **Phase 1 — CSS & Shell Foundation**: Clean `css/tokens.css`, `css/components.css`, `css/utilities.css`; remove `#role-context-strip`, `.cdob-full-card`, static notification items, and redundant `openProfileModal()` / `header-brand-subtitle` overwrite in `index.html`, `js/app.js`, `js/auth.js`.
2. **Phase 2 — Core Views Cleanup**: Simplify `executiveDashboard.js`, `inventoryLedger.js`, `b2bCrm.js`, and `orderApproval.js` (remove fake charts/metrics, interview copy, and redundant toolbars; wire all numbers to live store data).
3. **Phase 3 — Mobile PWA, Admin & Modals**: Clean `fieldSalesPwa.js`, `userProfileAndAdmin.js`, `auth.js` login screen, and `advancedFeatures.js` modal styling & copy.
4. **Phase 4 — Verification**: Re-run undefined CSS class audit (`0` missing classes), `node -c` syntax checks across all JS files, and browser verification across all 5 roles in light/dark mode and desktop/mobile widths.

