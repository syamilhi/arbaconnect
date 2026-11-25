# Field Sales PWA (`#field-sales-pwa-preview`) — Audit & Simplification Approach

## 1. What Is Currently Built

### Shell & Container Integration
- **Mobile-only shell mode** (`css/layout.css`, `.app-wrapper.pwa-mobile-only`): Hides `.app-header`, `.app-sidebar`, `.sidebar-backdrop`, and `.app-footer`, and centers `.main-view-container` so the Field Sales view renders as a standalone mobile app.
- **Phone frame container** (`js/views/fieldSalesPwa.js`): `#field-sales-pwa-preview` uses `w-full transition-all duration-200 max-w-[420px] rounded-3xl border border-border-subtle/70 bg-surface shadow-xl overflow-hidden` (`style="max-width: 420px; border-radius: 28px;"`).

### Top Bar & Daily Target Strip
- **Top bar (`bg-[#005c55]`)**:
  - Salesperson avatar (`w-8 h-8` with initials), full name, division/territory + `· Terkunci` label.
  - `#btn-pwa-online-toggle`: Toggles online/offline state (integrates with `ArbaOfflineSync` IndexedDB queue).
  - `#btn-pwa-logout`: Direct logout button (the only exit/redirect path when desktop chrome is hidden).
- **Daily target strip**: Single-line summary `Kunjungan hari ini: X/Y | Order: Z | Omset: W% target` powered by `ArbaStore.getAnalytics()`.

### Outlet & Consignment Card
- **Header**: `OUTLET` label + `#btn-gps-checkin` (`Check-in`).
- **Selector**: `#pwa-outlet-select` dropdown for choosing the active outlet.
- **Outlet metadata row**: `PIC: <name> · <payment term>` on the left, and `Tagihan Barang Laku` + `Rp ...` on the right.
- **Consignment alert box (pink)**: `Titipan: X unit | Laku: Y unit` and `Mendekati ED: <product> (<qty>, ED <date>)`.
- **Quick action buttons**: `Isi Konsinyasi`, `Rute`, and `Kunjungan` (opens `openVisitOnlyModal`).

### Product Catalog & Cart
- **Header**: `KATALOG PRODUK`, `#btn-pwa-scan-qr` (`Scan QR`), and total unit counter.
- **Filters**: Category tabs (`Semua`, `Madu`, `Kapsul`, `Minyak`, `Kosmetik`) and `#pwa-search-input`.
- **Product list**: Scrollable container (`max-height: 260px`) inside the main body (`max-height: 580px`). Each row shows product name, price, warehouse stock (`Gudang: ...`), consignment breakdown (`Titip · Laku · Sisa`), and `- qty +` steppers.

### Checkout, Proof & Modals
- **Checkout form**: `#pwa-term-select` (payment term), `#pwa-notes-input`, `#pwa-signature-canvas` (touch/mouse `<canvas>`), and `#pwa-shelf-file-input` (`<input type="file" capture="environment">` for shelf photo).
- **Sticky bottom bar**: `#btn-pwa-checkout` submits via `ArbaStore.submitFieldSalesOrder`.
- **Modals**:
  - `openVisitOnlyModal`: Logs a non-order visit via `ArbaStore.logFieldVisit`.
  - `openThermalReceiptModal`: Displays a thermal-style receipt with WhatsApp share and print actions.

---

## 2. Observed UI/UX & "Text Slop" Issues

Based on `js/views/fieldSalesPwa.js` and the current mobile render:

1. **Squished Avatar & Cramped 3-Line Header**
   - The `w-8 h-8` avatar lacks `shrink-0`, so when the division/territory text wraps onto 3 lines (`Divisi Kosmetik & Perawatan (Jebres & Sukoharjo) · Terkunci`), the circle compresses into a narrow oval.
   - `· Terkunci` adds unnecessary text noise in the header.
2. **Truncated & Awkwardly Wrapped Outlet Metadata**
   - `PIC: apt. Sri Wahyuningsih · Konsin...` truncates the payment term mid-word.
   - `Tagihan Barang Laku` wraps onto 3 lines on the right side, competing with the PIC line.
3. **Nested Scrollbars**
   - The main body has `max-height: 580px` and the product list has `max-height: 260px`. Double-scrolling inside a 420px mobile container feels cramped and fights thumb scrolling.
4. **Everything Dumped Into One Long Vertical Scroll**
   - Outlet selection, consignment status, quick actions, product catalog, payment terms, notes, signature canvas, and shelf photo upload are all stacked in one screen. A field rep has to scroll past the entire catalog just to reach signature/photo/checkout, or scroll past outlet info every time they adjust quantities.
5. **Verbose Labels & Mixed Styling**
   - Redundant phrasing (`Tagihan Barang Laku`, `· Terkunci`, `Mendekati ED: ...` inline paragraph) and mixed inline `style="..."` attributes alongside utility classes make spacing inconsistent.

---

## 3. Recommended Approach (Minimal, Easy, Informative)

The underlying store/offline/receipt logic (`ArbaStore`, `ArbaOfflineSync`, `<canvas>` signature, camera input, thermal receipt) is already solid. The goal is to **restructure the presentation** without breaking those flows:

1. **Fix the Top Bar (1-Line Identity)**
   - Add `shrink-0` to the avatar so it stays circular.
   - Show only **Name** on line 1 and **Territory/Division** (truncated cleanly with `truncate`, without `· Terkunci`) on line 2.
   - Keep `Online/Offline` pill and `Keluar` compact.
2. **Split the Flow Into 2 Clear Tabs / Steps**
   - **Tab 1: `Outlet`** — Outlet selector, GPS `Check-in`, concise 2-column KPI strip (`Tagihan` | `Titipan / Laku`), `Mendekati ED` badge (only when relevant), and the 3 quick actions (`Isi Konsinyasi`, `Rute`, `Kunjungan`).
   - **Tab 2: `Order`** — Search + category chips, full-height product list (no nested `260px` scrollbox), and a compact checkout drawer/footer for payment term, signature, shelf photo, and `Buat Nota`.
   - *Why*: Eliminates nested scrolling and lets the field rep focus on **one job at a time** (check-in/outlet context vs. picking items & closing the order).
3. **Clean Up Outlet Metadata**
   - Put `PIC` and `Termin` on separate clean chips or a 2-column grid instead of `PIC: ... · Konsin...` so nothing truncates mid-word.
   - Shorten `Tagihan Barang Laku` to `Tagihan`.
4. **Single Scroll Container**
   - Remove the inner `max-height: 260px` on the product list and let the active tab scroll naturally inside `#field-sales-pwa-preview` above the sticky bottom action bar.

