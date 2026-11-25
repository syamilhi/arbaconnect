# Workspace Audit & Slop Analysis — ArbaConnect ERP

**Scope:** Read-only audit of the entire ArbaConnect codebase (`index.html`, `css/*`, `js/*`, `js/views/*`, `server/server.js`, `database/schema.sql`, `sw.js`, `manifest.json`).  
**Goal:** Separate real working functionality from prototype theater, hardcoded/fake widgets, over-explaining UI copy, and CSS/layout debt.

---

## 1. Executive Summary

Underneath the UI, the core application plumbing is functional:
- **Backend & Persistence (`server/server.js`, `database/schema.sql`)**: Node HTTP server (`node:sqlite`) implementing 10 SQL tables, SSE live push (`/api/events`), idempotent sync (`/api/sync`), and 21 mutation handlers matching `js/store.js`.
- **Client State & Offline Sync (`js/store.js`, `js/offlineSync.js`, `js/utils.js`)**: Reactive store, IndexedDB mutation queue (`ArbaConnectOfflineDB`), `localStorage` fallback, live `getAnalytics()` selector, and working CSV import/export (`parseCsv`, `downloadCsv`).

**Where the mess lives:** Almost entirely in the **presentation layer** (`index.html`, `js/app.js`, `js/auth.js`, `js/views/*.js`, `js/advancedFeatures.js`, `css/*.css`). The UI suffers from four recurring patterns:
1. **Self-describing / over-explaining copy** — Paragraphs, badges, and subtitles explaining *what the feature is supposed to be* or quoting stakeholder interviews directly inside production UI.
2. **Hardcoded / fake widgets** — Static numbers, SVG charts, and fake telemetry sitting right next to live `ArbaStore` data, creating contradictory metrics on the same screen.
3. **Bloated & redundant navigation/actions** — Multiple overlapping ways to switch roles, view profiles, or trigger modals, plus loud multi-colored "command center" toolbars.
4. **Broken/incomplete CSS utility layer** — **112 CSS classes** referenced in JS/HTML do not exist in `css/*.css`, forcing brittle inline `style="..."` hacks and broken responsive grids.

---

## 2. Shell, Layout & Auth Audit

### 2.1 Global Shell (`index.html`, `js/app.js`)
| Item | Location | What's Wrong |
| :--- | :--- | :--- |
| **Role Context Strip** | `index.html#L267`, `js/app.js#L230-L319` | Giant gradient banner rendered at the top of every page (`#role-context-strip`) containing a full-caps badge (`SUPER ADMINISTRATOR (AKSES PENUH SELURUH DIVISI)`), greeting, and a 2–3 sentence explanation of what the role can do and how terms were adapted ("Istilah & informasi disesuaikan untuk pengambilan keputusan direksi..."). |
| **Brand Subtitle Override** | `js/app.js#L294-L297` | Overwrites `#header-brand-subtitle` with verbose ALL CAPS `cfg.roleTitle`. |
| **Hardcoded Notification Menu** | `index.html#L118-L147` | Only `#notif-pending-count-label` updates. The three items (`Pesanan Baru Siap Validasi`, `Madu Randu mendekati ambang batas`, `99.4% Kepatuhan batch tervalidasi`) are static HTML strings regardless of actual stock or order state. |
| **Sidebar Compliance Card** | `index.html#L243-L250` | `.cdob-full-card` is a static decorative blurb (`Integritas CDOB & FEFO: Penerapan mutasi stok tanggal kedaluwarsa terdekat aktif.`) that adds no interactive value. |
| **Redundant Account/Role Controls** | `index.html#L79-L89`, `#L150-L161`, `js/auth.js#L530-L733` | Four overlapping entry points: (1) `#role-perspective-select` in header, (2) `#header-profile-pill` opening `openProfileModal()` (which duplicates sidebar links, sync button, reset demo, switch account, and logout), (3) `#header-logout-btn` (`switch_account` icon that opens login portal without logging out), and (4) `user-profile-settings` sidebar page. |
| **Version Mismatch** | `index.html#L273` vs `package.json#L3` | Footer states `ArbaConnect v2.5.0-Vanilla`; `package.json` states `3.0.0`. |

### 2.2 Login Portal (`js/auth.js#L182-L528`)
- **Pre-filled admin credentials & exposed passwords**: Form defaults to `superadmin` / `admin123`, prints `Super Admin: admin123 | Role Lain: 123` above the password field, and prints plaintext credentials (`User: superadmin • Pass: admin123`) inside the Super Admin quick card.
- **Self-explaining instructional clutter**: Includes a 5-bullet role summary card inside the login form explaining how each role's UI works, plus a bottom tip box explaining where the Profile & Password menu will be after logging in.

---

## 3. Per-View Audit: Over-Explaining Copy & Fake/Hardcoded Widgets

### 3.1 Executive Dashboard (`js/views/executiveDashboard.js`)
- **Verbose header & command strip (`L62-L177`)**:
  - 3-part eyebrow (`Laporan Strategis Direksi · Wilayah Distribusi Solo Raya · Standar BPOM, CDOB & FEFO`) + title + 2-line descriptive subtitle.
  - "Pusat Kendali Otomasi & Keputusan Direksi" bar with `OTOMASI AKTIF` badge, explanatory sentence ("Klik tombol di kanan untuk..."), and 5 brightly colored inline-styled buttons duplicating features already accessible from Inventory/CRM.
- **6 Pilar / Interview-Quote Banner (`L571-L677`)**:
  - Eyebrow literally reads `Hasil Penyelarasan Wawancara Mitra CV Arba'in (6 Fokus Utama)` followed by a numbered list as an `<h2>`.
  - Alarm Oranye & Alarm Pink cards contain explanatory rationale instead of concise status ("Ambang alarm berbeda tiap produk sesuai konsumsi bulanan (contoh: Madu Randu ~2 Ton vs Madu Rambutan ~1 Ton)", `"Mbak, tolong yang dijual ini dulu"`).
  - Note: `.lg:grid-cols-2` on `L592` is **undefined in `css/utilities.css`**, so the two alarm cards stack vertically even on desktop.
- **Hardcoded / Non-Live Widgets**:
  - **Dual-Bar SVG Chart (`L350-L419`)**: Bar heights and labels (`138M`, `412M`, `114M`, `92M`, etc.) and `Update: 28 Mar 2026, 17:30 WIB` are static strings—never computed from `orders`.
  - **Footer Micro-Insights (`L423-L451`)**: Hardcoded `Madu Murni Arba 500g`, `Rp 3.260.000 / PO`, `99.4% Kepatuhan`.
  - **RFM Segmentation & Repeat Order Projection (`L454-L568`)**: `34 Apotek`, `58 Mitra`, `12 Mitra`, and the two projected repeat orders (`Apotek Sehat Mandiri Kartasura`, `Minimarket Barokah Sukoharjo`) are hardcoded. `openAtRiskModal()` (`L1463-L1558`) hardcodes two static outlets (`Apotek Medika Boyolali`, `Toko Herbal Sehat Karanganyar`).
  - **Fake Telemetry (`L1037`)**: `WebSocket PWA Stream Terhubung: Latency 42ms` (app uses SSE `/api/events`, not WebSocket, and `42ms` is fabricated text).
  - **PDF Report Modal (`L1370-L1460`)**: Displays `VALIDATED TKT 5` badge and hardcoded city revenue totals (`Rp 195.400.000`, etc.).

### 3.2 Inventory & Stock Ledger (`js/views/inventoryLedger.js`)
- **Action Button Bloat (`L104-L198`)**: 8 action buttons stacked in two rows inside the header (`+ Catat Barang Masuk`, `Scan & Cetak Stiker QR`, `Cek Keaslian Stok (CDOB)`, `Koreksi Stok Opname`, `PO Supplier`, `Impor CSV`, `Ekspor CSV`, `Cetak Opname`).
- **Hardcoded Metrics vs. Real 9-SKU Dataset**:
  - `js/data.js` has **9 products** (`products.length === 9`), yet:
    - Donut SVG (`L296-L365`) hardcodes `42 Batch`, `35 (83%)`, `5 (12%)`, `2 (5%)` with fixed `stroke-dasharray`.
    - Safety stock bar (`L368-L390`) hardcodes `Terkendali 91%`, `Stok Normal (33 SKU)`, `Buffer Menipis (5 SKU)`, `Kritis ROP (4 SKU)` (`33+5+4 = 42`).
    - Card 3 (`L267`) hardcodes `Rp 14.200.000 Nilai Stok`.
    - Card 4 (`L272-L290`) hardcodes `100% Tersinkronisasi • Idempoten & Anti-Selisih • SHA256 OK`.
    - Ledger footer (`L862-L879`) hardcodes `Blok Hash: 9d8f...3e2a1 (Status Sinkron)` and `24 Feb 2026, 08:00 WIB`.
- **Decorative / Offline-Breaking Filler (`L393-L412`)**: External `lh3.googleusercontent.com/aida-public/...` image banner (`Audit Operasional • Gudang Utama Kartasura • SOP FEFO Strict 100% dipatuhi seluruh staff logistik`) that fails when offline and serves no operational purpose.
- **Self-Explaining Copy (`L645-L659`)**: `Anti-Fraud Gudang` badge and subtitle quoting the interview example (`contoh: ambil 15 dari gudang, masuk kantor 12, selisih 3 langsung terdeteksi otomatis`).

### 3.3 B2B CRM & Directory (`js/views/b2bCrm.js`)
- **Contradictory Outlet Counts**:
  - `js/data.js` has `11` sample outlets plus `baseline: { extraApotek: 677, extraMinimarket: 336 }` (`1024` total).
  - Card 1 (`L178`) computes `168 + (outlets.length - 6)` → `173` (and hardcodes `148 Aktif`, `20 Baru / Evaluasi`).
  - Card 2 (`L204`) hardcodes `104` Apotek; Card 3 (`L226`) hardcodes `64` Minimarket (`104 + 64 = 168`).
  - Card 4 (`L248`) hardcodes `94.2% Optimal` and `0 Bad Debt` regardless of actual `creditStatus` values (`Overdue` outlets exist in `data.js`).
  - Table footer (`L559`) hardcodes `Total Jaringan: 1.024+ Mitra`.
- **Fake Per-Outlet Sparkline (`L628-L662`)**: Every selected outlet displays the exact same static SVG path and labels (`Jan: 16.2 Jt`, `Feb: 19.8 Jt`, `Mar: 22.5 Jt`, `Apr: 26.0 Jt (▲15%)`).
- **Static Fleet Box (`L832-L857`)**: `Armada Pengiriman Hari Ini` hardcodes `34 Outlet Solo & Sukoharjo` and `28 Outlet Karanganyar & Klaten`.
- **Verbose Toolbar (`L104-L164`)**: 6 buttons across the top, duplicating Executive Dashboard launchers (`Tarik & Geser Stok Macet`, `Skor Kelayakan Kredit`, `Peta & Rute Kunjungan`).

### 3.4 Order Approval Queue (`js/views/orderApproval.js`)
- **Hardcoded Tab Counters & Offsets**:
  - Tab 2 (`L167`): `${28 + approvedOrders.length - 1}` (magic offset `+27`).
  - Tab 3 (`L190`): hardcoded `14` Faktur (actual `driverManifests` has 2 manifests / 4 orders).
  - Tab 4 (`L213`): `${1 + rejectedOrders.length}` (magic offset `+1`).
- **Stale Sales Rep Filter (`L235-L239`)**: Dropdown hardcodes `Anita Rahmawati` and `Hadi Kurniawan` instead of populating from `state.salesTeam`.
- **Fake Bottom Feed & Fleet Cards (`L835-L939`)**:
  - Left panel claims `Realtime WebSocket Sync` and shows 3 static fake timestamps (`10:12:44`, `10:05:19`, `09:51:02`) instead of reading `state.ledger`.
  - Right panel hardcodes `GranMax AD-8941-KA (8 Outlet)` and `BlindVan AD-1044-YB (6 Outlet)` instead of reading `state.driverManifests`.
- **Broken Substitute Batch Modal (`L1274-L1324`)**: Hardcodes copy about `"SKU Madu Hutan Liar di Gudang Utama Kartasura tersisa 25 unit..."` for every order and calls `approveOrder()` instead of `substituteOrderBatch()`.

### 3.5 Field Sales PWA (`js/views/fieldSalesPwa.js`)
*(Desktop shell chrome was already hidden and `#btn-pwa-logout` added in prior step, but internal prototype/slop elements remain.)*
- **Dead Prototype State**: `state.isPhoneFrame` (`L19`) and `?pwa=full|phone` query check (`L39-L45`) are unused now that the desktop switcher was removed; `.phone-simulation-frame` (`zoom: 1.1111`) and `.phone-screen` in `css/components.css#L406-L429` are also dead.
- **Over-explaining Copy**: `Mode Offline-First (Disimpan di IndexedDB Lokal)` banner (`L227`), numbered step headers (`2. Pilih Barang / Scan Kemasan`), and verbose CTA (`Simpan Tagihan & Ganti Nota Baru`).
- **Simulated Hardware/Proof Features**:
  - `TTD Cepat` (`L508`, `L765-L784`) auto-draws a fake cursive signature onto the canvas.
  - `Ambil Foto Audit` (`L557`, `L797-L804`) generates a cartoon placeholder image (`generateSampleShelfPhotoDataUrl` in `advancedFeatures.js`) instead of only using real camera/file upload (`#pwa-shelf-file-input`).
  - GPS Check-in (`L846`, `L851`) silently fabricates `-7.5583, 110.8214 (Presisi GPS)` if `navigator.geolocation` fails or is denied.

### 3.6 User Profile & Admin (`js/views/userProfileAndAdmin.js`)
- **Verbose Page Headers**: `SUPER ADMIN CONTROL CENTER • FULL SYSTEM ACCESS` + multi-line explanation of what the page does.
- **Plaintext Password Exposure (`L518-L524`, `L634-L637`, `L872-L878`)**: Displays user passwords & offline PINs in the admin table (behind a client toggle) and modal inputs.
- **Duplicate Profile Navigation (`L133-L164`)**: Left column renders a card listing all allowed modules with descriptions—duplicating the sidebar.

### 3.7 Advanced Feature Modals (`js/advancedFeatures.js`)
- **Hackathon / Marketing Terminology**: Header comment literally calls them `6 Advanced Enterprise & Hackathon Features`. UI contains labels like `OPTICAL FEFO SCANNER v2.5`, `Simulasi Scan Cepat Stiker Batch (1-Klik)`, `🤖 ${sc.recommendation}`, `💡 Alasan AI:`, `Terapkan Plafon AI`, `ANTI-MANIPULASI STOK`, `PETA TELEMETRI GEOFENCE SOLO RAYA`.
- **Uses `.modal-card` (`L119`, `L418`, `L618`, `L799`, `L889`)**: Class is undefined in `css/components.css` (which defines `.modal-dialog`), causing these modals to rely on `js/auth.js` / inline styles and lack proper dark-mode surface styling.

---

## 4. CSS & Styling Debt (`css/*`)

1. **Global Zoom Hack (`css/tokens.css#L134-L138`)**:
   - `html { zoom: 0.9; }` shrinks the entire page, causing non-standard scaling and requiring `zoom: 1.1111` workarounds (`.phone-simulation-frame`) and `zoom: 1 !important` in `print.css`.
2. **112 Undefined CSS Classes Used in Views**:
   - Audited `index.html` + `js/**/*.js` against `css/*.css`: **112 class names** have no matching selector in any stylesheet.
   - High-impact missing classes:
     - Layout/Grid: `lg:grid-cols-2`, `sm:grid-cols-4`, `md:w-auto`, `md:border-t-0`, `md:pt-0`
     - Components/Sizing: `.modal-card`, `w-11`, `h-11`, `my-4`, `mb-2.5`, `pr-1`, `gap-3.5`, `max-h-44`, `max-h-56`, `max-h-72`, `font-extrabold`
     - Colors: `bg-slate-950`, `bg-rose-100`, `text-rose-800`, `text-rose-950`, `bg-emerald-200`, `text-emerald-900`, `text-emerald-950`, `border-emerald-200`, `border-emerald-300`, `text-amber-800`, `text-amber-950`, `border-amber-200`, `border-amber-300`, `bg-violet-100`, `text-violet-700`, `text-violet-800`, `bg-white/80`, `bg-white/90`, `border-primary/25`, `hover:bg-rose-700`, `hover:bg-amber-200`, `hover:bg-emerald-800`.
3. **Mixed Styling Paradigms**:
   - Views mix Tailwind-like utility classes, custom token classes (`font-label-sm`, `gap-space-lg`), BEM-ish component classes (`.btn`, `.card`), and heavy inline `style="..."` attributes—especially in newer sections (`role-context-strip`, `advancedFeatures.js`, `executiveDashboard.js` alarms) where utility classes were missing.

