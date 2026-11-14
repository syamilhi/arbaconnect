/**
 * ArbaConnect ERP - Inventory & Stock Ledger View
 * Features:
 * - 4 Inventory KPI Cards (Total SKU, Di Bawah ROP, Peringatan FEFO, Ledger Sync SHA-256)
 * - 3 Visual Panels (SVG Donut FEFO chart, Safety stock progress bar, Kartasura warehouse banner)
 * - Section 1: Warehouse Stock Catalog & ROP Monitor with category & status filters, PO restock modal
 * - Section 2: Real-time Immutable Stock Ledger with mutation filter pills (ALL, MASUK, KELUAR, PENYESUAIAN, RETUR)
 * - Modals:
 *   1. + Penerimaan Batch (Inbound Batch Entry)
 *   2. Penyesuaian Opname (Stock Opname Reconciliation)
 *   3. PO Supplier List & Receipt Workflow
 *   4. Terbitkan PO ke Vendor Restock
 *   5. Pratinjau Berkas Cetak Laporan Opname Stok
 * - CSV Export
 */

(function () {
  'use strict';

  window.ArbaViews = window.ArbaViews || {};

  var state = {
    searchQuery: '',
    selectedCategory: 'all',
    selectedRopStatus: 'all',
    activeLedgerFilter: 'ALL',
    catalogPage: 1,
    catalogPageSize: 6
  };

  function renderInventoryLedger(container) {
    var appState = window.ArbaStore.getState();
    var products = appState.products;
    var ledger = appState.ledger;
    var supplierPOs = appState.supplierPOs;
    var salesLoadings = appState.salesLoadings || [];

    // Compute metrics
    var totalPhysicalUnits = products.reduce(function (acc, p) { return acc + p.stock; }, 0);
    var belowRopCount = products.filter(function (p) { return p.stock <= p.rop; }).length;
    var criticalExpiryCount = products.filter(function (p) { return p.fefoStatus === 'Kritis (<30 Hari)'; }).length;
    var warningExpiryCount = products.filter(function (p) { return p.fefoStatus === 'Mendekati ED (<3 Bulan)'; }).length;

    // Filter products
    var filteredProducts = products.filter(function (p) {
      var matchesSearch =
        p.name.toLowerCase().indexOf(state.searchQuery.toLowerCase()) !== -1 ||
        p.sku.toLowerCase().indexOf(state.searchQuery.toLowerCase()) !== -1;

      var matchesCategory =
        state.selectedCategory === 'all' ||
        (state.selectedCategory === 'madu' && p.category === 'Madu Herbal') ||
        (state.selectedCategory === 'kapsul' && p.category === 'Kapsul Herbal') ||
        (state.selectedCategory === 'minyak' && p.category === 'Minyak & Cairan') ||
        (state.selectedCategory === 'kosmetik' && p.category === 'Kosmetik Herbal') ||
        (state.selectedCategory === 'serbuk' && p.category === 'Serbuk');

      var matchesStatus =
        state.selectedRopStatus === 'all' ||
        (state.selectedRopStatus === 'safe' && p.stock > p.rop) ||
        (state.selectedRopStatus === 'below-rop' && p.stock <= p.rop && p.stock > 0) ||
        (state.selectedRopStatus === 'empty' && p.stock === 0);

      return matchesSearch && matchesCategory && matchesStatus;
    });

    var totalCatalogPages = Math.max(1, Math.ceil(filteredProducts.length / state.catalogPageSize));
    if (state.catalogPage > totalCatalogPages) state.catalogPage = totalCatalogPages;
    var paginatedProducts = filteredProducts.slice(
      (state.catalogPage - 1) * state.catalogPageSize,
      state.catalogPage * state.catalogPageSize
    );

    // Filter ledger
    var filteredLedger = ledger.filter(function (entry) {
      if (state.activeLedgerFilter === 'ALL') return true;
      return entry.type === state.activeLedgerFilter;
    });

    var html = `
      <div class="flex flex-col w-full gap-space-lg">
        <!-- Top Bar / Action Center -->
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-container-lowest p-5 rounded-xl border border-border-subtle/60">
          <div class="flex flex-col gap-0.5 min-w-0">
            <div class="flex items-center gap-2 text-primary text-xs uppercase tracking-wider font-semibold">
              <span class="material-symbols-outlined text-[15px]">warehouse</span>
              <span>Gudang CV Arba'in · Standar CDOB &amp; FEFO</span>
            </div>
            <h1 class="text-xl text-on-surface tracking-tight font-bold">
              Kelola Stok Real-Time &amp; Buku Besar Stok (Stock Ledger)
            </h1>
            <p class="text-xs text-on-surface-variant max-w-xl">
              Audit mutasi inventaris atomik, kalkulasi otomatis Reorder Point (ROP), &amp; kontrol FEFO batch
            </p>
          </div>

          <!-- Compact Action Cluster -->
          <div class="flex flex-col sm:items-end gap-2 shrink-0">
            <!-- Primary Operations Row -->
            <div class="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
              <button
                id="btn-inbound-batch"
                class="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-container text-white text-xs font-semibold whitespace-nowrap transition-colors shadow-xs active:scale-95 cursor-pointer border-0"
                type="button"
                title="Input penerimaan batch herbal baru masuk gudang"
              >
                <span class="material-symbols-outlined text-[16px]">add_box</span>
                <span>+ Penerimaan Batch</span>
              </button>

              <button
                id="btn-adjust-opname"
                class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border border-border-subtle/50"
                type="button"
                title="Penyesuaian selisih fisik opname berkala"
              >
                <span class="material-symbols-outlined text-[15px] text-on-surface-variant">tune</span>
                <span>Penyesuaian Opname</span>
              </button>
            </div>

            <!-- Secondary Report & PO Tools Row -->
            <div class="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
              <button
                id="btn-supplier-po-list"
                class="flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface-container-low hover:bg-surface-container text-primary text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border border-border-subtle/50"
                type="button"
                title="Daftar Purchase Order ke Supplier Herbal"
              >
                <span class="material-symbols-outlined text-[15px]">local_mall</span>
                <span>PO Supplier</span>
                ${supplierPOs.length > 0 ? `
                  <span class="px-1.5 py-0.2 rounded-full bg-primary text-white text-[10px] font-bold">
                    ${supplierPOs.length}
                  </span>
                ` : ''}
              </button>

              <button
                id="btn-import-ledger-csv"
                class="flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface-container-low hover:bg-surface-container text-primary text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border border-border-subtle/50"
                type="button"
                title="Migrasi / Impor Master SKU & Saldo Stok Awal dari CSV"
              >
                <span class="material-symbols-outlined text-[15px]">upload_file</span>
                <span>Impor CSV</span>
              </button>

              <button
                id="btn-export-ledger-csv"
                class="flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border border-border-subtle/50"
                type="button"
                title="Unduh seluruh mutasi Stock Ledger dalam format CSV"
              >
                <span class="material-symbols-outlined text-[15px] text-on-surface-variant">table_chart</span>
                <span>Ekspor CSV</span>
              </button>

              <button
                id="btn-print-opname"
                class="flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border border-border-subtle/50"
                type="button"
                title="Cetak lembar formulir opname fisik gudang"
              >
                <span class="material-symbols-outlined text-[15px] text-on-surface-variant">print</span>
                <span>Cetak Opname</span>
              </button>
            </div>
          </div>
        </div>

        <!-- KPI Cards Metric Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-md">
          <!-- Card 1: Total SKU Aktif -->
          <div class="bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-border-subtle/40 flex flex-col justify-between">
            <div class="flex items-start justify-between">
              <div>
                <span class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">
                  Total SKU Aktif
                </span>
                <div class="font-headline-xl text-headline-xl text-on-surface mt-1 tracking-tight font-bold text-2xl">
                  ${products.length} <span class="font-title-sm text-title-sm text-on-surface-variant font-normal text-sm">SKU</span>
                </div>
              </div>
              <div class="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-primary">
                <span class="material-symbols-outlined text-[22px]">medication</span>
              </div>
            </div>
            <div class="mt-4 pt-3 bg-surface-container-low/50 rounded-lg p-2.5 flex items-center justify-between">
              <span class="font-body-sm text-body-sm text-on-surface-variant text-xs">Total Saldo Fisik:</span>
              <span class="font-code-table text-code-table font-semibold text-primary text-xs">
                ${window.ArbaUtils.formatNumber(totalPhysicalUnits)} unit
              </span>
            </div>
          </div>

          <!-- Card 2: Di Bawah ROP -->
          <div class="bg-surface-container-lowest p-5 rounded-xl border border-border-subtle/60 flex flex-col justify-between">
            <div class="flex items-start justify-between">
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-amber-700 uppercase tracking-wider font-semibold">
                    Di Bawah ROP
                  </span>
                  <span class="w-2 h-2 rounded-full bg-amber-500" style="display:inline-block;"></span>
                </div>
                <div class="text-2xl text-amber-700 mt-1 tracking-tight font-bold">
                  ${belowRopCount} <span class="text-xs text-on-surface-variant font-normal">SKU Segera Pesan</span>
                </div>
              </div>
              <div class="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700" style="background:#fef3c7;">
                <span class="material-symbols-outlined text-[20px]">production_quantity_limits</span>
              </div>
            </div>
            <div class="mt-4 pt-2.5 border-t border-border-subtle/40 flex items-center justify-between text-xs text-on-surface-variant">
              <span>Buffer Pengaman (95%)</span>
              <span class="font-semibold text-amber-700">Perlu Reorder Segera</span>
            </div>
          </div>

          <!-- Card 3: Peringatan FEFO -->
          <div class="bg-surface-container-lowest p-5 rounded-xl border border-border-subtle/60 flex flex-col justify-between">
            <div class="flex items-start justify-between">
              <div>
                <span class="text-xs text-rose-700 uppercase tracking-wider font-semibold">
                  Peringatan FEFO
                </span>
                <div class="text-2xl text-rose-700 mt-1 tracking-tight font-bold">
                  ${criticalExpiryCount} <span class="text-xs text-on-surface-variant font-normal">Kritis &lt;30 Hari</span>
                </div>
              </div>
              <div class="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center text-rose-700" style="background:#fee2e2;">
                <span class="material-symbols-outlined text-[20px]">event_busy</span>
              </div>
            </div>
            <div class="mt-4 pt-2.5 border-t border-border-subtle/40 flex items-center justify-between text-xs text-on-surface-variant">
              <span>${warningExpiryCount} Batch &lt;90 Hari</span>
              <span class="font-semibold text-rose-700">Rp 14.200.000 Nilai Stok</span>
            </div>
          </div>

          <!-- Card 4: Status Ledger Sync -->
          <div class="bg-surface-container-lowest p-5 rounded-xl border border-border-subtle/60 flex flex-col justify-between">
            <div class="flex items-start justify-between">
              <div>
                <span class="text-xs text-primary uppercase tracking-wider font-semibold">
                  Status Ledger Sync
                </span>
                <div class="text-2xl text-primary mt-1 tracking-tight font-bold">
                  100% <span class="text-xs text-on-surface-variant font-normal">Tersinkronisasi</span>
                </div>
              </div>
              <div class="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700" style="background:#dcfce7;">
                <span class="material-symbols-outlined text-[20px]">enhanced_encryption</span>
              </div>
            </div>
            <div class="mt-4 pt-3 bg-status-success-bg/50 rounded-lg p-2.5 flex items-center justify-between text-xs">
              <span class="font-body-sm text-body-sm text-status-success-text">Idempoten &amp; Anti-Selisih</span>
              <span class="font-code-table text-code-table font-semibold text-primary">SHA256 OK</span>
            </div>
          </div>
        </div>

        <!-- Visual Quick Glance: FEFO Distribution Chart & Warehouse Banner -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-space-md">
          <!-- Visual 1: Stock Status Distribution SVG Metric Card -->
          <div class="bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-border-subtle/40 flex flex-col justify-between">
            <div class="flex items-center justify-between mb-2">
              <span class="font-title-sm text-title-sm text-on-surface font-bold text-sm">Sebaran Ketahanan FEFO Batch</span>
              <span class="font-label-sm text-label-sm text-on-surface-variant text-xs">Batch Aktif</span>
            </div>
            <div class="flex items-center gap-space-md">
              <!-- SVG Donut Chart -->
              <div class="relative w-28 h-28 flex-shrink-0 flex items-center justify-center" style="position:relative; width:112px; height:112px;">
                <svg class="w-full h-full transform -rotate-90" viewBox="0 0 36 36" style="transform: rotate(-90deg);">
                  <path
                    class="text-surface-container-high"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#e2e8f0"
                    stroke-width="3.8"
                  ></path>
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#005c55"
                    stroke-dasharray="70, 100"
                    stroke-width="3.8"
                  ></path>
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#f59e0b"
                    stroke-dasharray="20, 100"
                    stroke-dashoffset="-70"
                    stroke-width="3.8"
                  ></path>
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#ef4444"
                    stroke-dasharray="10, 100"
                    stroke-dashoffset="-90"
                    stroke-width="3.8"
                  ></path>
                </svg>
                <div class="absolute flex flex-col items-center" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); text-align:center;">
                  <span class="font-headline-md text-headline-md text-on-surface font-bold leading-none text-xl">42</span>
                  <span class="font-label-sm text-label-sm text-on-surface-variant text-[11px]">Batch</span>
                </div>
              </div>
              <div class="flex flex-col gap-2 flex-grow text-xs">
                <div class="flex items-center justify-between text-on-surface">
                  <div class="flex items-center gap-1.5 font-label-md text-label-md">
                    <span class="w-2.5 h-2.5 rounded-full bg-primary" style="display:inline-block; width:10px; height:10px;"></span>
                    <span>Aman (&gt;6 Bulan)</span>
                  </div>
                  <span class="font-code-table text-code-table font-semibold">35 (83%)</span>
                </div>
                <div class="flex items-center justify-between text-on-surface">
                  <div class="flex items-center gap-1.5 font-label-md text-label-md">
                    <span class="w-2.5 h-2.5 rounded-full bg-badge-amber" style="display:inline-block; width:10px; height:10px; background:#f59e0b;"></span>
                    <span>Waspada (&lt;90 Hari)</span>
                  </div>
                  <span class="font-code-table text-code-table font-semibold">5 (12%)</span>
                </div>
                <div class="flex items-center justify-between text-on-surface">
                  <div class="flex items-center gap-1.5 font-label-md text-label-md">
                    <span class="w-2.5 h-2.5 rounded-full bg-badge-red" style="display:inline-block; width:10px; height:10px; background:#ef4444;"></span>
                    <span>Kritis (&lt;30 Hari)</span>
                  </div>
                  <span class="font-code-table text-code-table font-semibold text-rose-600">2 (5%)</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Visual 2: Quick ROP Health Indicator -->
          <div class="bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-border-subtle/40 flex flex-col justify-between">
            <div class="flex items-center justify-between">
              <span class="font-title-sm text-title-sm text-on-surface font-bold text-sm">Progres Safety Stock Keseluruhan</span>
              <span class="px-2 py-0.5 rounded-full bg-status-success-bg text-status-success-text font-label-sm text-label-sm font-semibold text-xs">
                Terkendali 91%
              </span>
            </div>
            <div class="my-3 flex flex-col gap-1.5">
              <div class="w-full bg-surface-container h-3 rounded-full overflow-hidden flex" style="height:12px;">
                <div class="bg-primary h-full" style="width: 78%;" title="Stok Normal: 78%"></div>
                <div class="bg-badge-amber h-full" style="width: 13%; background:#f59e0b;" title="Buffer Menipis: 13%"></div>
                <div class="bg-badge-red h-full" style="width: 9%; background:#ef4444;" title="Kritis ROP: 9%"></div>
              </div>
              <div class="flex justify-between font-label-sm text-label-sm text-on-surface-variant text-[11px]">
                <span>Stok Normal (33 SKU)</span>
                <span>Buffer Menipis (5 SKU)</span>
                <span>Kritis ROP (4 SKU)</span>
              </div>
            </div>
            <p class="font-body-sm text-body-sm text-on-surface-variant text-xs">
              Pemesanan otomatis terintegrasi langsung dengan Purchase Order Vendor CV Arba'in di Kartasura.
            </p>
          </div>

          <!-- Visual 3: Photo Rich Operational Warehouse Unit -->
          <div class="relative bg-surface-container-lowest rounded-xl shadow-xs overflow-hidden min-h-[140px] flex items-center border border-border-subtle/40" style="position:relative; min-height:140px;">
            <img
              class="absolute inset-0 w-full h-full object-cover"
              style="position:absolute; width:100%; height:100%; object-fit:cover;"
              alt="Warehouse CV Arba'in Kartasura"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCXSkCCkRfjOjEsxVM3gjkn_FdhuEZVzJw9g39lPyfJZH1wt00Sz6FuthN0pSTVc5I_JKr0X5vakXqjr0q0kC7dvrYCUMRSm6TFMpadVeQXtgQuxGOTWrxKWUPVu9iQvBU7QLOlYwqOiuBCObsnpcZHdh6nHwKBZmKkVmJARgwO6m7eiqRkqqT8aBjveWpwnZZTctEVaKvU2nG1tpuhQRwSL2pq3WuqE1mKp7FOabRUrhf1dAW4BtyA"
            />
            <div class="absolute inset-0 bg-gradient-to-r" style="position:absolute; inset:0; background:linear-gradient(to right, rgba(11,28,48,0.92) 0%, rgba(11,28,48,0.65) 60%, transparent 100%);"></div>
            <div class="relative p-space-md text-white flex flex-col justify-center" style="position:relative; z-index:2; padding:1.25rem;">
              <span class="font-label-sm text-label-sm uppercase tracking-wider text-teal-200 font-bold text-[10px]">
                Audit Operasional
              </span>
              <h2 class="font-headline-md text-headline-md text-white font-bold text-lg">
                Gudang Utama Kartasura
              </h2>
              <p class="font-body-sm text-body-sm text-slate-200 mt-1 max-w-[200px] text-xs">
                SOP FEFO Strict 100% dipatuhi seluruh staff logistik.
              </p>
            </div>
          </div>
        </div>

        <!-- SECTION 1: Warehouse Stock Catalog & ROP Monitor -->
        <section class="flex flex-col gap-space-md bg-surface-container-lowest p-space-lg rounded-xl shadow-xs border border-border-subtle/40">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
            <div>
              <div class="flex items-center gap-2">
                <h2 class="font-headline-md text-headline-md text-on-surface font-bold text-lg">
                  Katalog Stok Gudang &amp; Monitoring Reorder Point (ROP)
                </h2>
                <span class="px-2 py-0.5 rounded-full bg-surface-container text-primary font-label-sm text-label-sm font-semibold text-xs">
                  Live Audit
                </span>
              </div>
              <p class="font-body-sm text-body-sm text-on-surface-variant text-xs">
                Perhitungan dinamis waktu tenggang (Lead Time L) dan rata-rata permintaan harian (d) produk herbal CV Arba'in.
              </p>
            </div>

            <!-- Filters -->
            <div class="flex flex-wrap items-center gap-2">
              <div class="relative">
                <span class="material-symbols-outlined text-on-surface-variant absolute left-2.5 top-2.5 text-[18px]">
                  search
                </span>
                <input
                  id="catalog-search"
                  value="${window.ArbaUtils.escapeHtml(state.searchQuery)}"
                  class="pl-8 pr-3 py-2 bg-surface-container-low rounded-lg font-body-sm text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:bg-surface-container w-52 sm:w-60 text-xs border-0"
                  placeholder="Cari SKU / Nama Herbal..."
                  type="text"
                />
              </div>
              <select
                id="catalog-category-select"
                class="bg-surface-container-low font-label-md text-label-md text-on-surface px-3 py-2 rounded-lg cursor-pointer focus:outline-none focus:bg-surface-container text-xs border-0"
              >
                <option value="all" ${state.selectedCategory === 'all' ? 'selected' : ''}>Semua Kategori</option>
                <option value="madu" ${state.selectedCategory === 'madu' ? 'selected' : ''}>Madu Herbal</option>
                <option value="kapsul" ${state.selectedCategory === 'kapsul' ? 'selected' : ''}>Kapsul Herbal</option>
                <option value="minyak" ${state.selectedCategory === 'minyak' ? 'selected' : ''}>Minyak &amp; Cairan</option>
                <option value="kosmetik" ${state.selectedCategory === 'kosmetik' ? 'selected' : ''}>Kosmetik Herbal</option>
                <option value="serbuk" ${state.selectedCategory === 'serbuk' ? 'selected' : ''}>Serbuk</option>
              </select>
              <select
                id="catalog-rop-select"
                class="bg-surface-container-low font-label-md text-label-md text-on-surface px-3 py-2 rounded-lg cursor-pointer focus:outline-none focus:bg-surface-container text-xs border-0"
              >
                <option value="all" ${state.selectedRopStatus === 'all' ? 'selected' : ''}>Semua Status ROP</option>
                <option value="safe" ${state.selectedRopStatus === 'safe' ? 'selected' : ''}>Stok Aman</option>
                <option value="below-rop" ${state.selectedRopStatus === 'below-rop' ? 'selected' : ''}>Di Bawah ROP</option>
                <option value="empty" ${state.selectedRopStatus === 'empty' ? 'selected' : ''}>Stok Habis</option>
              </select>
            </div>
          </div>

          <!-- Data Table ROP & Catalog -->
          <div class="overflow-x-auto rounded-xl border border-border-subtle/30">
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="bg-surface-container-low/60 text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                  <th class="py-3 px-4">SKU / Nama Produk Herbal</th>
                  <th class="py-3 px-3">Kategori</th>
                  <th class="py-3 px-3 text-right">Saldo Fisik</th>
                  <th class="py-3 px-3 text-right">Safety Stock</th>
                  <th class="py-3 px-3 text-right">ROP Kalkulasi</th>
                  <th class="py-3 px-3">Batch Aktif</th>
                  <th class="py-3 px-3">FEFO Exp. Date</th>
                  <th class="py-3 px-4 text-center">Tindakan Logistik</th>
                </tr>
              </thead>
              <tbody class="font-body-md text-body-md divide-y divide-border-subtle/30">
                ${paginatedProducts.map(function (p) {
                  var isBelowRop = p.stock <= p.rop;
                  var isCriticalExp = p.fefoStatus === 'Kritis (<30 Hari)';
                  var isWarningExp = p.fefoStatus === 'Mendekati ED (<3 Bulan)';

                  var rowBgClass = 'hover:bg-surface-container-low/40 transition-colors';
                  if (isCriticalExp) {
                    rowBgClass = 'bg-status-danger-bg/20 hover:bg-status-danger-bg/30 transition-colors';
                  } else if (isBelowRop) {
                    rowBgClass = 'bg-status-warning-bg/20 hover:bg-status-warning-bg/30 transition-colors';
                  }

                  return `
                    <tr class="${rowBgClass}">
                      <td class="py-3 px-4">
                        <div class="flex items-center gap-3">
                          <div
                            class="w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                              isCriticalExp
                                ? 'bg-status-danger-bg text-status-danger-text'
                                : isBelowRop
                                ? 'bg-status-warning-bg text-status-warning-text'
                                : 'bg-surface-container text-primary'
                            }"
                            style="width:32px; height:32px; border-radius:8px; display:inline-flex; align-items:center; justify-content:center;"
                          >
                            <span class="material-symbols-outlined text-[18px]">${p.icon}</span>
                          </div>
                          <div>
                            <div class="font-semibold text-on-surface">${p.name}</div>
                            <div class="font-code-table text-code-table text-on-surface-variant font-mono text-[11px]">${p.sku}</div>
                          </div>
                        </div>
                      </td>
                      <td class="py-3 px-3">
                        <span class="px-2 py-0.5 rounded bg-surface-container font-label-sm text-label-sm text-on-surface">
                          ${p.category}
                        </span>
                      </td>
                      <td class="py-3 px-3 text-right font-code-table text-code-table font-semibold ${
                        isCriticalExp
                          ? 'text-rose-600 font-bold'
                          : isBelowRop
                          ? 'text-amber-700 font-bold'
                          : 'text-on-surface'
                      }">
                        ${window.ArbaUtils.formatNumber(p.stock)} unit
                      </td>
                      <td class="py-3 px-3 text-right font-code-table text-code-table text-on-surface-variant">
                        ${p.safetyStock} unit
                      </td>
                      <td class="py-3 px-3 text-right">
                        <div class="font-code-table text-code-table font-semibold ${
                          isBelowRop ? 'text-amber-700 font-bold' : 'text-primary'
                        }">
                          ${p.rop} unit
                        </div>
                        <div class="font-label-sm text-label-sm text-on-surface-variant text-[10px]">${p.ropFormula}</div>
                      </td>
                      <td class="py-3 px-3 font-code-table text-code-table">
                        <span class="px-2 py-0.5 rounded ${
                          isCriticalExp
                            ? 'bg-status-danger-bg text-status-danger-text font-bold'
                            : 'bg-surface-container-low text-on-surface'
                        }">
                          ${p.activeBatch}
                        </span>
                      </td>
                      <td class="py-3 px-3">
                        <div class="flex items-center gap-1.5">
                          <span class="w-2 h-2 rounded-full ${
                            isCriticalExp
                              ? 'bg-rose-600'
                              : isWarningExp
                              ? 'bg-amber-500'
                              : 'bg-emerald-600'
                          }" style="display:inline-block; width:8px; height:8px;"></span>
                          <span class="font-code-table text-code-table ${
                            isCriticalExp ? 'text-rose-600 font-bold' : 'text-on-surface'
                          }">
                            ${p.fefoDate}
                          </span>
                        </div>
                        <span class="font-label-sm text-label-sm text-[10px] ${
                          isCriticalExp
                            ? 'text-rose-600 font-bold'
                            : isWarningExp
                            ? 'text-amber-700 font-semibold'
                            : 'text-emerald-700'
                        }">
                          ${p.fefoStatus}
                        </span>
                      </td>
                      <td class="py-3 px-4 text-center">
                        ${isCriticalExp ? `
                          <button
                            class="btn-trigger-po flex items-center justify-center gap-1 w-full px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-container text-white font-label-sm text-label-sm font-semibold transition-all cursor-pointer shadow-xs active:scale-95 border-0"
                            data-sku="${p.sku}"
                            type="button"
                          >
                            <span class="material-symbols-outlined text-[16px]">priority_high</span>
                            <span>Prioritas Restock / PO</span>
                          </button>
                        ` : isBelowRop ? `
                          <button
                            class="btn-trigger-po flex items-center justify-center gap-1 w-full px-3 py-1.5 rounded-lg bg-badge-amber hover:bg-status-warning-text text-white font-label-sm text-label-sm font-semibold transition-all shadow-xs cursor-pointer active:scale-95 border-0"
                            data-sku="${p.sku}"
                            type="button"
                          >
                            <span class="material-symbols-outlined text-[16px]">shopping_cart_checkout</span>
                            <span>Trigger Restock / PO</span>
                          </button>
                        ` : `
                          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-status-success-bg text-status-success-text font-label-sm text-label-sm font-semibold">
                            <span class="material-symbols-outlined text-[14px]">check_circle</span> Stok Optimal
                          </span>
                        `}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <!-- Table Pagination & Count Note -->
          <div class="flex flex-col sm:flex-row items-center justify-between text-on-surface-variant font-label-sm text-label-sm pt-2 text-xs">
            <div>Menampilkan ${paginatedProducts.length} dari ${filteredProducts.length} Master SKU Herbal CV Arba'in (Hal ${state.catalogPage}/${totalCatalogPages})</div>
            <div class="flex items-center gap-1">
              <button
                id="btn-catalog-prev"
                type="button"
                class="px-2.5 py-1 rounded bg-surface-container-lowest hover:bg-surface-container text-on-surface border-0 cursor-pointer ${state.catalogPage <= 1 ? 'opacity-40' : ''}"
              >
                &lt; Sebelumnya
              </button>
              ${Array.from({ length: totalCatalogPages }, function (_, idx) {
                var pNum = idx + 1;
                var active = pNum === state.catalogPage;
                return `
                  <button
                    type="button"
                    class="btn-catalog-page px-2.5 py-1 rounded ${active ? 'bg-primary text-white font-bold' : 'bg-surface-container-low hover:bg-surface-container text-on-surface font-semibold'} border-0 cursor-pointer"
                    data-page="${pNum}"
                  >
                    ${pNum}
                  </button>
                `;
              }).join('')}
              <button
                id="btn-catalog-next"
                type="button"
                class="px-2.5 py-1 rounded bg-surface-container-lowest hover:bg-surface-container text-on-surface border-0 cursor-pointer ${state.catalogPage >= totalCatalogPages ? 'opacity-40' : ''}"
              >
                Berikutnya &gt;
              </button>
            </div>
          </div>
        </section>

        <!-- SECTION 1B: Kontrol Barang Bawaan Sales dari Gudang (Ambil Gudang Pagi vs Laku di Apotek vs Kembali ke Gudang — Anti-Fraud) -->
        <section class="flex flex-col gap-space-md bg-surface-container-lowest p-space-lg rounded-xl shadow-xs border border-border-subtle/40">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
            <div>
              <div class="flex items-center gap-2">
                <h2 class="font-headline-md text-headline-md text-on-surface font-bold text-lg">
                  Kontrol Barang Bawaan Sales Keliling (Ambil Gudang vs Laku Apotek vs Kembali Gudang)
                </h2>
                <span class="px-2 py-0.5 rounded-full text-xs font-bold" style="background:#fff7ed; color:#c2410c; border:1px solid #fb923c;">
                  Anti-Fraud Gudang
                </span>
              </div>
              <p class="font-body-sm text-body-sm text-on-surface-variant text-xs">
                Mencegah selisih barang bawaan sales (contoh: ambil 15 dari gudang, masuk kantor 12, selisih 3 langsung terdeteksi otomatis)
              </p>
            </div>
            <button
              id="btn-new-sales-load"
              type="button"
              class="px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-semibold cursor-pointer border-0 flex items-center gap-1.5 shrink-0"
            >
              <span class="material-symbols-outlined text-[16px]">local_shipping</span>
              <span>+ Catat Sales Ambil Barang Gudang</span>
            </button>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            ${salesLoadings.map(function (ld) {
              var hasDiscrepancy = ld.status === 'SELISIH_AUDIT' || (ld.items || []).some(function (i) { return i.discrepancy > 0; });
              var isKlop = ld.status === 'TERVERIFIKASI_KLOP' && !hasDiscrepancy;
              var badgeBg = hasDiscrepancy ? '#fef2f2' : (isKlop ? '#ecfdf5' : '#fffbeb');
              var badgeBorder = hasDiscrepancy ? '#f87171' : (isKlop ? '#34d399' : '#fbbf24');
              var badgeColor = hasDiscrepancy ? '#b91c1c' : (isKlop ? '#047857' : '#92400e');
              var badgeLabel = hasDiscrepancy ? '⚠ SELISIH TERDETEKSI' : (isKlop ? '✓ KEMBALI GUDANG KLOP' : 'SEDANG KELILING');

              return `
                <div class="rounded-xl p-4 flex flex-col justify-between gap-3" style="background:${badgeBg}; border:1.5px solid ${badgeBorder};">
                  <div>
                    <div class="flex items-center justify-between gap-2 mb-1">
                      <div>
                        <div class="font-bold text-sm text-slate-900">${ld.salesRep}</div>
                        <div class="text-[11px] text-slate-600">${ld.division} · ${ld.routeArea}</div>
                      </div>
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-bold" style="background:#fff; color:${badgeColor}; border:1px solid ${badgeBorder};">
                        ${badgeLabel}
                      </span>
                    </div>

                    ${ld.auditNote ? `
                      <div class="p-2 rounded-lg text-[11px] font-semibold mb-2" style="background:#fee2e2; color:#991b1b;">
                        ${ld.auditNote}
                      </div>
                    ` : ''}

                    <div class="bg-white/90 rounded-lg p-2.5 space-y-1.5 border border-slate-200/80 text-xs">
                      <div class="grid grid-cols-12 text-[10px] font-bold text-slate-500 uppercase pb-1 border-b border-slate-200">
                        <span class="col-span-5">SKU Produk</span>
                        <span class="col-span-2 text-center">Ambil</span>
                        <span class="col-span-2 text-center">Drop</span>
                        <span class="col-span-3 text-right">Kembali</span>
                      </div>
                      ${(ld.items || []).map(function (it) {
                        return `
                          <div class="grid grid-cols-12 items-center text-[11px] text-slate-800">
                            <span class="col-span-5 font-semibold truncate" title="${it.name}">${it.name}</span>
                            <span class="col-span-2 text-center font-mono font-bold">${it.loadedQty}</span>
                            <span class="col-span-2 text-center font-mono text-emerald-700 font-bold">${it.droppedQty}</span>
                            <span class="col-span-3 text-right font-mono font-bold ${it.discrepancy > 0 ? 'text-rose-600' : 'text-slate-800'}">
                              ${it.returnedQty}${it.discrepancy > 0 ? ` (-${it.discrepancy}!)` : ''}
                            </span>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  </div>

                  <div class="flex items-center justify-between pt-1 text-xs">
                    <span class="text-slate-700">Setoran Tagihan: <b class="text-slate-900">${window.ArbaUtils.formatRupiah(ld.cashCollected)}</b></span>
                    <button
                      type="button"
                      class="btn-reconcile-load px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer border-0"
                      style="background:#005c55; color:#fff;"
                      data-load-id="${ld.id}"
                    >
                      ${hasDiscrepancy ? 'Selesaikan Selisih & Klopkan' : 'Verifikasi Kembali Gudang'}
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </section>

        <!-- SECTION 2: Stock Ledger Audit Log (Immutable Transaction Ledger) -->
        <section class="flex flex-col gap-space-md bg-surface-container-lowest p-space-lg rounded-xl shadow-xs border border-border-subtle/40">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
            <div>
              <div class="flex items-center gap-2">
                <h2 class="font-headline-md text-headline-md text-on-surface font-bold text-lg">
                  Audit Log Buku Besar Stok (Real-Time Stock Ledger)
                </h2>
                <span class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-status-success-bg text-status-success-text font-label-sm text-label-sm font-semibold text-xs">
                  <span class="w-1.5 h-1.5 rounded-full bg-badge-green" style="display:inline-block; width:6px; height:6px;"></span> Tamper-Proof
                </span>
              </div>
              <p class="font-body-sm text-body-sm text-on-surface-variant text-xs">
                Pencatatan mutasi inventaris atomik berurutan anti-selisih untuk CV Arba'in
              </p>
            </div>

            <!-- Mutation Filters -->
            <div class="flex flex-wrap items-center gap-2">
              ${['ALL', 'MASUK', 'KELUAR', 'PENYESUAIAN', 'RETUR'].map(function (filter) {
                var isActive = state.activeLedgerFilter === filter;
                var label = 'Semua Tipe';
                if (filter === 'MASUK') label = '+ MASUK (Supplier)';
                if (filter === 'KELUAR') label = '- KELUAR (Sales Order)';
                if (filter === 'PENYESUAIAN') label = 'PENYESUAIAN (Opname)';
                if (filter === 'RETUR') label = 'RETUR (Klien)';

                return `
                  <button
                    class="btn-ledger-filter px-3 py-1.5 rounded-lg font-label-md text-label-md text-xs transition-colors cursor-pointer border-0 ${
                      isActive
                        ? 'bg-primary text-white font-semibold shadow-xs'
                        : 'bg-surface-container-low hover:bg-surface-container text-on-surface'
                    }"
                    data-filter="${filter}"
                    type="button"
                  >
                    ${label}
                  </button>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Ledger Table -->
          <div class="overflow-x-auto rounded-xl border border-border-subtle/30">
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="bg-surface-container-low/60 text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                  <th class="py-3 px-4">ID Transaksi &amp; Waktu</th>
                  <th class="py-3 px-3">Ref Dokumen</th>
                  <th class="py-3 px-3">SKU &amp; Batch Terkait</th>
                  <th class="py-3 px-3 text-center">Tipe Mutasi</th>
                  <th class="py-3 px-3 text-right">Kuantitas</th>
                  <th class="py-3 px-3 text-right">Saldo Akhir</th>
                  <th class="py-3 px-3">Petugas / Operator</th>
                  <th class="py-3 px-4">Checksum / Hash</th>
                </tr>
              </thead>
              <tbody class="font-body-md text-body-md divide-y divide-border-subtle/30">
                ${filteredLedger.map(function (entry) {
                  var badgeClass = 'bg-status-success-bg text-status-success-text';
                  var typeIcon = 'arrow_downward';
                  var typeText = '+ MASUK';
                  var qtyClass = 'text-emerald-700 font-bold';

                  if (entry.type === 'KELUAR') {
                    badgeClass = 'bg-status-danger-bg text-status-danger-text';
                    typeIcon = 'arrow_upward';
                    typeText = '- KELUAR';
                    qtyClass = 'text-rose-600 font-bold';
                  } else if (entry.type === 'PENYESUAIAN') {
                    badgeClass = 'bg-secondary-fixed text-on-secondary-fixed';
                    typeIcon = 'tune';
                    typeText = 'PENYESUAIAN';
                    qtyClass = 'text-secondary font-bold';
                  } else if (entry.type === 'RETUR') {
                    badgeClass = 'bg-surface-container-high text-on-surface';
                    typeIcon = 'assignment_return';
                    typeText = 'RETUR';
                    qtyClass = 'text-primary font-bold';
                  }

                  return `
                    <tr class="hover:bg-surface-container-low/40 transition-colors">
                      <td class="py-3 px-4">
                        <div class="font-code-table text-code-table font-bold text-on-surface font-mono">${entry.id}</div>
                        <div class="font-label-sm text-label-sm text-on-surface-variant text-[11px]">${entry.timestamp}</div>
                      </td>
                      <td class="py-3 px-3 font-code-table text-code-table text-secondary font-medium font-mono">
                        ${entry.docRef}
                      </td>
                      <td class="py-3 px-3">
                        <div class="font-label-md text-label-md text-on-surface font-semibold">${entry.skuName}</div>
                        <div class="font-code-table text-code-table text-on-surface-variant font-mono text-[11px]">${entry.batch}</div>
                      </td>
                      <td class="py-3 px-3 text-center">
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded font-label-sm text-label-sm font-bold ${badgeClass}">
                          <span class="material-symbols-outlined text-[14px]">${typeIcon}</span> ${typeText}
                        </span>
                      </td>
                      <td class="py-3 px-3 text-right font-code-table text-code-table ${qtyClass}">
                        ${entry.quantity > 0 ? '+' + entry.quantity : entry.quantity} unit
                      </td>
                      <td class="py-3 px-3 text-right font-code-table text-code-table font-bold text-on-surface">
                        ${window.ArbaUtils.formatNumber(entry.finalStock)} unit
                      </td>
                      <td class="py-3 px-3">
                        <div class="font-label-md text-label-md text-on-surface font-semibold">${entry.operator}</div>
                        <div class="font-label-sm text-label-sm text-on-surface-variant text-[11px]">${entry.operatorRole}</div>
                      </td>
                      <td class="py-3 px-4 font-code-table text-code-table text-on-surface-variant">
                        <span class="bg-surface-container px-2 py-0.5 rounded text-[11px] font-mono text-on-surface-variant" title="Verified SHA-256 Ledger Node">
                          ${entry.hash}
                        </span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <!-- Ledger Integrity Footer Indicator -->
          <div class="flex flex-col sm:flex-row items-center justify-between p-space-md bg-surface-container-low rounded-xl">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-status-success-bg flex items-center justify-center text-status-success-text shadow-xs" style="width:32px; height:32px; border-radius:50%; background:#dcfce7; display:flex; align-items:center; justify-content:center;">
                <span class="material-symbols-outlined text-[18px]">lock</span>
              </div>
              <div>
                <div class="font-label-lg text-label-lg text-on-surface font-bold text-sm">
                  Buku Besar Stok Terkunci Secara Kriptografis
                </div>
                <div class="font-body-sm text-body-sm text-on-surface-variant text-xs">
                  Tidak ada selisih mutasi fisik dan catatan digital sejak audit terakhir (24 Feb 2026, 08:00 WIB).
                </div>
              </div>
            </div>
            <div class="mt-2 sm:mt-0 font-code-table text-code-table text-primary font-bold text-xs font-mono">
              Blok Hash: 9d8f...3e2a1 (Status Sinkron)
            </div>
          </div>
        </section>
      </div>
    `;

    container.innerHTML = html;
    bindEvents(container);
  }

  function bindEvents(container) {
    // Inbound Batch Button
    var btnInbound = container.querySelector('#btn-inbound-batch');
    if (btnInbound) {
      btnInbound.addEventListener('click', function () {
        openInboundModal();
      });
    }

    // Adjust Opname Button
    var btnAdjust = container.querySelector('#btn-adjust-opname');
    if (btnAdjust) {
      btnAdjust.addEventListener('click', function () {
        openAdjustModal();
      });
    }

    // Supplier PO List Button
    var btnPoList = container.querySelector('#btn-supplier-po-list');
    if (btnPoList) {
      btnPoList.addEventListener('click', function () {
        openPoListModal();
      });
    }

    // Import Products / Initial Stock CSV
    var btnImportCsv = container.querySelector('#btn-import-ledger-csv');
    if (btnImportCsv) {
      btnImportCsv.addEventListener('click', function () {
        openImportProductsModal();
      });
    }

    // Export Ledger CSV
    var btnCsv = container.querySelector('#btn-export-ledger-csv');
    if (btnCsv) {
      btnCsv.addEventListener('click', function () {
        var ledger = window.ArbaStore.getState().ledger;
        window.ArbaUtils.exportStockLedgerToCsv(ledger);
        window.ArbaApp.showToast("Berhasil mengunduh mutasi Stock Ledger (.CSV)", 'table_chart');
      });
    }

    // Print Opname Sheet
    var btnPrint = container.querySelector('#btn-print-opname');
    if (btnPrint) {
      btnPrint.addEventListener('click', function () {
        openPrintModal();
      });
    }

    // Catalog Search Input
    var catSearch = container.querySelector('#catalog-search');
    if (catSearch) {
      catSearch.addEventListener('input', function (e) {
        state.searchQuery = e.target.value;
        renderInventoryLedger(container);
        var inputNow = container.querySelector('#catalog-search');
        if (inputNow) {
          inputNow.focus();
          inputNow.setSelectionRange(inputNow.value.length, inputNow.value.length);
        }
      });
    }

    // Catalog Category Select
    var catSelect = container.querySelector('#catalog-category-select');
    if (catSelect) {
      catSelect.addEventListener('change', function (e) {
        state.selectedCategory = e.target.value;
        renderInventoryLedger(container);
      });
    }

    // Catalog ROP Select
    var ropSelect = container.querySelector('#catalog-rop-select');
    if (ropSelect) {
      ropSelect.addEventListener('change', function (e) {
        state.selectedRopStatus = e.target.value;
        renderInventoryLedger(container);
      });
    }

    // Trigger Restock / PO buttons
    var poBtns = container.querySelectorAll('.btn-trigger-po');
    poBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sku = btn.getAttribute('data-sku');
        var products = window.ArbaStore.getState().products;
        var prod = products.find(function (p) { return p.sku === sku; });
        if (prod) {
          openCreatePoModal(prod);
        }
      });
    });

    // Ledger filter buttons
    var filterBtns = container.querySelectorAll('.btn-ledger-filter');
    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.activeLedgerFilter = btn.getAttribute('data-filter');
        renderInventoryLedger(container);
      });
    });

    // Sales Warehouse Loading Button (Catat Pengambilan Barang Sales)
    var btnNewLoad = container.querySelector('#btn-new-sales-load');
    if (btnNewLoad) {
      btnNewLoad.addEventListener('click', function () {
        openSalesLoadingModal();
      });
    }

    // Reconcile Sales Return to Warehouse (Anti-Fraud Klop / Hitung Fisik Sore)
    var reconcileBtns = container.querySelectorAll('.btn-reconcile-load');
    reconcileBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var loadId = btn.getAttribute('data-load-id');
        openReconcileLoadingModal(loadId);
      });
    });

    // Catalog Pagination
    var catPrev = container.querySelector('#btn-catalog-prev');
    var catNext = container.querySelector('#btn-catalog-next');
    var catPages = container.querySelectorAll('.btn-catalog-page');
    if (catPrev) {
      catPrev.addEventListener('click', function () {
        if (state.catalogPage > 1) {
          state.catalogPage--;
          renderInventoryLedger(container);
        }
      });
    }
    if (catNext) {
      catNext.addEventListener('click', function () {
        state.catalogPage++;
        renderInventoryLedger(container);
      });
    }
    catPages.forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.catalogPage = Number(btn.getAttribute('data-page')) || 1;
        renderInventoryLedger(container);
      });
    });
  }

  // Modal Rekonsiliasi Hitung Fisik Barang Bawaan Sales Sore Hari (Anti-Fraud)
  function openReconcileLoadingModal(loadId) {
    var appState = window.ArbaStore.getState();
    var loadRec = (appState.salesLoadings || []).find(function (l) { return l.id === loadId; });
    if (!loadRec) return;

    var modalHtml = `
      <div class="modal-dialog max-w-xl">
        <div class="modal-header">
          <div class="flex items-center gap-2.5">
            <span class="material-symbols-outlined text-primary text-[22px]">fact_check</span>
            <div>
              <h3 class="font-bold text-sm text-on-surface">Rekonsiliasi Sisa Barang Bawaan Sales (Anti-Fraud Sore)</h3>
              <p class="text-[11px] text-on-surface-variant">${loadRec.salesRep} (${loadRec.division}) • ${loadRec.id}</p>
            </div>
          </div>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form id="form-reconcile-loading">
          <div class="modal-body text-xs space-y-3">
            <div class="p-2.5 rounded-lg bg-surface-container-low border border-border-subtle/50 text-on-surface-variant">
              Masukkan jumlah fisik barang yang dikembalikan sales ke gudang sore ini. Jika jumlah fisik yang kembali kurang dari <b>Wajib Kembali (Bawa Pagi - Laku Apotek)</b>, sistem otomatis menandai <b>SELISIH AUDIT</b>.
            </div>

            <div class="overflow-x-auto rounded-lg border border-border-subtle/50">
              <table class="w-full text-left border-collapse text-xs">
                <thead>
                  <tr class="bg-surface-container-low text-on-surface-variant text-[10px] uppercase">
                    <th class="p-2">Produk Herbal</th>
                    <th class="p-2 text-center">Bawa Pagi</th>
                    <th class="p-2 text-center">Laku Apotek</th>
                    <th class="p-2 text-center">Wajib Kembali</th>
                    <th class="p-2 text-center">Fisik Kembali (Unit)</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border-subtle/40">
                  ${loadRec.items.map(function (it) {
                    var expected = Math.max(0, it.loadedQty - it.droppedQty);
                    return `
                      <tr>
                        <td class="p-2 font-semibold text-on-surface">
                          <div>${it.name}</div>
                          <div class="text-[10px] font-mono text-on-surface-variant">${it.sku} • ${it.batch}</div>
                        </td>
                        <td class="p-2 text-center font-mono font-bold">${it.loadedQty}</td>
                        <td class="p-2 text-center font-mono font-bold text-primary">${it.droppedQty}</td>
                        <td class="p-2 text-center font-mono font-bold text-emerald-700">${expected}</td>
                        <td class="p-2 text-center">
                          <input
                            type="number"
                            class="reconcile-return-input w-20 p-1.5 rounded border border-border-subtle text-center font-mono font-bold text-on-surface bg-surface"
                            data-sku="${it.sku}"
                            data-expected="${expected}"
                            min="0"
                            max="${it.loadedQty}"
                            value="${it.returnedQty !== undefined ? it.returnedQty : expected}"
                          />
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div class="modal-footer flex items-center justify-between">
            <button
              type="button"
              id="btn-reconcile-auto-klop"
              class="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer border-0"
            >
              Set Semua Sesuai &amp; Klop 100%
            </button>
            <div class="flex items-center gap-2">
              <button type="button" class="btn btn-outline" onclick="window.ArbaApp.closeModal()">Batal</button>
              <button type="submit" class="btn btn-primary">Simpan Hasil Hitung Fisik</button>
            </div>
          </div>
        </form>
      </div>
    `;

    window.ArbaApp.openModal(modalHtml);

    var btnAutoKlop = document.getElementById('btn-reconcile-auto-klop');
    if (btnAutoKlop) {
      btnAutoKlop.onclick = function () {
        window.ArbaStore.reconcileSalesLoading(loadId);
        window.ArbaApp.closeModal();
      };
    }

    var form = document.getElementById('form-reconcile-loading');
    if (form) {
      form.onsubmit = function (e) {
        e.preventDefault();
        var map = {};
        document.querySelectorAll('.reconcile-return-input').forEach(function (inp) {
          var sku = inp.getAttribute('data-sku');
          map[sku] = Number(inp.value) || 0;
        });
        window.ArbaStore.reconcileSalesLoading(loadId, map);
        window.ArbaApp.closeModal();
      };
    }
  }

  // Modal Kontrol Pengambilan Barang Bawaan Sales dari Gudang (Anti-Fraud)
  function openSalesLoadingModal() {
    var appState = window.ArbaStore.getState();
    var salesTeam = appState.salesTeam || [];
    var products = appState.products || [];

    var modalHtml = `
      <div class="modal-dialog max-w-lg">
        <div class="modal-header">
          <div class="flex items-center gap-2.5">
            <span class="material-symbols-outlined text-primary text-[20px]">local_shipping</span>
            <div>
              <h3 class="font-bold text-sm text-on-surface">Catat Pengambilan Barang Sales dari Gudang</h3>
              <p class="text-[11px] text-on-surface-variant">Pencatatan stok yang dibawa sales keliling (wajib klop saat kembali sore)</p>
            </div>
          </div>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div class="modal-body text-xs space-y-3">
          <div class="space-y-1">
            <label class="font-semibold text-on-surface block">Pilih Sales Keliling</label>
            <select id="load-sales-select" class="w-full p-2.5 rounded-lg border border-border-subtle bg-surface text-on-surface">
              ${salesTeam.map(function (s) {
                return `<option value="${s.name}">${s.name} (${s.division} · ${s.area})</option>`;
              }).join('')}
            </select>
          </div>

          <div class="space-y-1">
            <label class="font-semibold text-on-surface block">Pilih Produk yang Dibawa dari Gudang</label>
            <select id="load-sku-select" class="w-full p-2.5 rounded-lg border border-border-subtle bg-surface text-on-surface">
              ${products.map(function (p) {
                return `<option value="${p.sku}">${p.name} (Stok Gudang: ${p.stock} unit)</option>`;
              }).join('')}
            </select>
          </div>

          <div class="space-y-1">
            <label class="font-semibold text-on-surface block">Jumlah Unit yang Dibawa Keliling</label>
            <input type="number" id="load-qty-input" value="15" min="1" max="500" class="w-full p-2.5 rounded-lg border border-border-subtle bg-surface text-on-surface font-mono font-bold" />
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button type="button" class="px-3.5 py-2 rounded-lg bg-surface-container text-on-surface font-semibold cursor-pointer border-0" onclick="window.ArbaApp.closeModal()">Batal</button>
            <button type="button" id="btn-save-sales-load" class="px-4 py-2 rounded-lg bg-primary text-white font-semibold cursor-pointer border-0">Simpan Bawaan Sales</button>
          </div>
        </div>
      </div>
    `;

    window.ArbaApp.openModal(modalHtml);
    setTimeout(function () {
      var btnSave = document.getElementById('btn-save-sales-load');
      if (btnSave) {
        btnSave.onclick = function () {
          var repEl = document.getElementById('load-sales-select');
          var skuEl = document.getElementById('load-sku-select');
          var qtyEl = document.getElementById('load-qty-input');
          window.ArbaStore.recordSalesWarehouseLoad({
            salesRep: repEl ? repEl.value : 'Budi Santoso',
            sku: skuEl ? skuEl.value : 'SKU-ARB-MDR500',
            loadedQty: qtyEl ? Number(qtyEl.value) : 15
          });
          window.ArbaApp.closeModal();
        };
      }
    }, 30);
  }

  // Modal 0: Migrasi / Impor Master Produk & Saldo Stok Awal (CSV)
  function openImportProductsModal() {
    var sampleCsv = [
      'sku,nama_produk,kategori,stok,safety_stock,rop,harga_satuan,batch_aktif,tanggal_ed',
      'SKU-ARB-KLM250,Madu Klanceng Asli Lawu 250g,Madu Herbal,260,60,110,92000,BATCH-2026-051,22 Nov 2027',
      'SKU-ARB-SRB100,Serbuk Jahe Merah Instan 100g,Serbuk,380,80,145,35000,BATCH-2026-060,10 Des 2027'
    ].join('\n');

    var modalHtml = `
      <div class="modal-dialog max-w-2xl">
        <div class="modal-header">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <span class="material-symbols-outlined text-[20px]">upload_file</span>
            </div>
            <div>
              <h3 class="font-bold text-sm text-on-surface">Migrasi Master SKU &amp; Saldo Stok Awal (.CSV)</h3>
              <p class="text-[11px] text-on-surface-variant">Setiap SKU yang diimpor otomatis tercatat ke Buku Besar Stok (SALDO-AWAL / MIGRASI-CSV)</p>
            </div>
          </div>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div class="modal-body text-xs space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2 bg-surface-container-low p-3 rounded-lg border border-border-subtle/50">
            <div class="text-on-surface-variant">
              Format Kolom: <code class="font-mono text-primary font-semibold">sku, nama_produk, kategori, stok, safety_stock, rop, harga_satuan, batch_aktif, tanggal_ed</code>
            </div>
            <button type="button" id="btn-download-prod-template" class="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold cursor-pointer border border-border-subtle/50 flex items-center gap-1">
              <span class="material-symbols-outlined text-[15px]">download</span>
              <span>Unduh Template CSV</span>
            </button>
          </div>

          <div class="space-y-1">
            <label class="font-semibold text-on-surface block">Pilih Berkas CSV dari Komputer (.csv):</label>
            <input type="file" id="input-prod-csv-file" accept=".csv,text/csv" class="w-full p-2 rounded-lg border border-border-subtle bg-surface text-xs" />
          </div>

          <div class="space-y-1">
            <label class="font-semibold text-on-surface block">Atau Tempel / Edit Baris CSV Secara Langsung:</label>
            <textarea id="textarea-prod-csv" rows="5" class="w-full p-2.5 rounded-lg border border-border-subtle bg-surface font-mono text-[11px] text-on-surface">${sampleCsv}</textarea>
          </div>

          <div class="flex items-center justify-end gap-2 pt-2">
            <button type="button" class="px-3.5 py-2 rounded-lg bg-surface-container text-on-surface font-semibold cursor-pointer border-0" onclick="window.ArbaApp.closeModal()">
              Batal
            </button>
            <button type="button" id="btn-exec-prod-import" class="px-4 py-2 rounded-lg bg-primary text-white font-semibold cursor-pointer border-0 flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[16px]">cloud_upload</span>
              <span>Proses Migrasi Stok</span>
            </button>
          </div>
        </div>
      </div>
    `;

    window.ArbaApp.openModal(modalHtml);

    setTimeout(function () {
      var btnDl = document.getElementById('btn-download-prod-template');
      var fileInput = document.getElementById('input-prod-csv-file');
      var txtArea = document.getElementById('textarea-prod-csv');
      var btnExec = document.getElementById('btn-exec-prod-import');

      if (btnDl) {
        btnDl.onclick = function () {
          window.ArbaUtils.downloadCsv('Template_Migrasi_Stok_Produk_ArbaConnect.csv', sampleCsv);
        };
      }
      if (fileInput && txtArea) {
        fileInput.onchange = function (e) {
          var f = e.target.files && e.target.files[0];
          if (!f) return;
          var reader = new FileReader();
          reader.onload = function (ev) {
            txtArea.value = String(ev.target.result || '');
          };
          reader.readAsText(f);
        };
      }
      if (btnExec && txtArea) {
        btnExec.onclick = function () {
          var rows = window.ArbaUtils.parseCsv(txtArea.value);
          if (!rows.length) {
            window.ArbaApp.showToast('Format CSV kosong atau tidak valid', 'warning');
            return;
          }
          window.ArbaStore.importProducts(rows);
          window.ArbaApp.closeModal();
        };
      }
    }, 30);
  }

  // Modal 1: Penerimaan Batch Masuk
  function openInboundModal() {
    var products = window.ArbaStore.getState().products;
    var nextBatch = 'BATCH-2026-0' + Math.floor(50 + Math.random() * 40);

    var modalHtml = `
      <div class="modal-dialog max-w-lg">
        <div class="modal-header">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[24px]">input</span>
            <h3 class="modal-title">Penerimaan Barang (Batch Masuk)</h3>
          </div>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form id="form-inbound-batch">
          <div class="modal-body text-xs">
            <p class="text-on-surface-variant">
              Masukkan data batch manufaktur produk herbal baru CV Arba'in untuk dimasukkan langsung ke Stock Ledger.
            </p>

            <div class="flex flex-col gap-1">
              <label class="font-semibold text-on-surface">Pilih Produk SKU Herbal</label>
              <select id="inbound-sku" class="p-2.5 rounded-lg bg-surface-container-low border border-border-subtle/50 text-on-surface cursor-pointer">
                ${products.map(function (p) {
                  return `<option value="${p.sku}">${p.name} (${p.sku})</option>`;
                }).join('')}
              </select>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1">
                <label class="font-semibold text-on-surface">Nomor Batch Baru</label>
                <input id="inbound-batch" value="${nextBatch}" required type="text" class="p-2 rounded-lg bg-surface-container-low border border-border-subtle/50 font-mono text-on-surface" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="font-semibold text-on-surface">Kuantitas Masuk (Unit)</label>
                <input id="inbound-qty" value="250" min="1" required type="number" class="p-2 rounded-lg bg-surface-container-low border border-border-subtle/50 font-mono font-bold text-on-surface" />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1">
                <label class="font-semibold text-on-surface">Tanggal Kedaluwarsa (ED)</label>
                <input id="inbound-exp" value="2028-02-28" required type="date" class="p-2 rounded-lg bg-surface-container-low border border-border-subtle/50 text-on-surface cursor-pointer" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="font-semibold text-on-surface">Referensi Dokumen PO</label>
                <input id="inbound-ref" value="PO-2026-092" required type="text" class="p-2 rounded-lg bg-surface-container-low border border-border-subtle/50 font-mono text-on-surface" />
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button onclick="window.ArbaApp.closeModal()" class="btn btn-outline" type="button">
              Batal
            </button>
            <button type="submit" class="btn btn-primary">
              Simpan Mutasi Masuk
            </button>
          </div>
        </form>
      </div>
    `;

    window.ArbaApp.openModal(modalHtml);

    setTimeout(function () {
      var form = document.getElementById('form-inbound-batch');
      if (form) {
        form.onsubmit = function (e) {
          e.preventDefault();
          var sku = document.getElementById('inbound-sku').value;
          var batch = document.getElementById('inbound-batch').value;
          var qty = Number(document.getElementById('inbound-qty').value);
          var exp = document.getElementById('inbound-exp').value;
          var ref = document.getElementById('inbound-ref').value;

          window.ArbaStore.addInboundBatch({
            sku: sku,
            batch: batch,
            qty: qty,
            expiryDate: exp,
            docRef: ref
          });

          window.ArbaApp.closeModal();
        };
      }
    }, 50);
  }

  // Modal 2: Penyesuaian Selisih Opname Fisik
  function openAdjustModal() {
    var products = window.ArbaStore.getState().products;

    var modalHtml = `
      <div class="modal-dialog max-w-lg">
        <div class="modal-header">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-secondary text-[24px]">tune</span>
            <h3 class="modal-title">Penyesuaian Stok (Stock Opname Reconciliation)</h3>
          </div>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form id="form-adjust-opname">
          <div class="modal-body text-xs">
            <p class="text-on-surface-variant">
              Gunakan formulir ini untuk rekonsiliasi selisih hitung fisik saat audit opname berkala gudang. Setiap perubahan akan dicatat permanen dalam Stock Ledger.
            </p>

            <div class="flex flex-col gap-1">
              <label class="font-semibold text-on-surface">Pilih Produk SKU</label>
              <select id="adj-sku" class="p-2.5 rounded-lg bg-surface-container-low border border-border-subtle/50 text-on-surface cursor-pointer">
                ${products.map(function (p) {
                  return `<option value="${p.sku}">${p.name} (${p.sku}) — Stok saat ini: ${p.stock}</option>`;
                }).join('')}
              </select>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1">
                <label class="font-semibold text-on-surface">Batch Terkait</label>
                <input id="adj-batch" value="${products[0].activeBatch}" required type="text" class="p-2 rounded-lg bg-surface-container-low border border-border-subtle/50 font-mono text-on-surface" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="font-semibold text-on-surface">Selisih (+ / - Unit)</label>
                <input id="adj-delta" value="5" required type="number" class="p-2 rounded-lg bg-surface-container-low border border-border-subtle/50 font-mono font-bold text-on-surface" />
              </div>
            </div>

            <div class="flex flex-col gap-1">
              <label class="font-semibold text-on-surface">Alasan Penyesuaian Audit</label>
              <select id="adj-reason" class="p-2 rounded-lg bg-surface-container-low border border-border-subtle/50 text-on-surface cursor-pointer">
                <option value="Selisih fisik opname berkala gudang">Selisih fisik opname berkala gudang</option>
                <option value="Kerusakan kemasan / segel saat handling transit">Kerusakan kemasan / segel saat handling transit</option>
                <option value="Pengambilan sampel uji laboratorium QC">Pengambilan sampel uji laboratorium QC</option>
                <option value="Koreksi salah input nomor batch sebelumnya">Koreksi salah input nomor batch sebelumnya</option>
              </select>
            </div>

            <div class="flex flex-col gap-1">
              <label class="font-semibold text-on-surface">Nama Auditor / Penanggung Jawab</label>
              <input id="adj-auditor" value="Dewi Lestari (Chief Auditor)" required type="text" class="p-2 rounded-lg bg-surface-container-low border border-border-subtle/50 text-on-surface" />
            </div>
          </div>

          <div class="modal-footer">
            <button onclick="window.ArbaApp.closeModal()" class="btn btn-outline" type="button">
              Batal
            </button>
            <button type="submit" class="btn btn-secondary">
              Simpan Penyesuaian ke Ledger
            </button>
          </div>
        </form>
      </div>
    `;

    window.ArbaApp.openModal(modalHtml);

    setTimeout(function () {
      var selectSku = document.getElementById('adj-sku');
      if (selectSku) {
        selectSku.onchange = function (e) {
          var p = products.find(function (pr) { return pr.sku === e.target.value; });
          if (p) {
            document.getElementById('adj-batch').value = p.activeBatch;
          }
        };
      }

      var form = document.getElementById('form-adjust-opname');
      if (form) {
        form.onsubmit = function (e) {
          e.preventDefault();
          window.ArbaStore.adjustStock({
            sku: document.getElementById('adj-sku').value,
            batch: document.getElementById('adj-batch').value,
            quantityDelta: Number(document.getElementById('adj-delta').value),
            reason: document.getElementById('adj-reason').value,
            auditorName: document.getElementById('adj-auditor').value
          });
          window.ArbaApp.closeModal();
        };
      }
    }, 50);
  }

  // Modal 3: Monitoring PO Supplier Aktif
  function openPoListModal() {
    var supplierPOs = window.ArbaStore.getState().supplierPOs;

    var modalHtml = `
      <div class="modal-dialog max-w-2xl">
        <div class="modal-header">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[24px]">local_mall</span>
            <h3 class="modal-title">Daftar Purchase Order (PO) Supplier Vendor CV Arba'in</h3>
          </div>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div class="modal-body text-xs">
          <div class="divide-y divide-border-subtle/30 border border-border-subtle/40 rounded-xl overflow-hidden">
            ${supplierPOs.map(function (po) {
              return `
                <div class="p-3 bg-surface-container-low/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="font-bold font-mono text-primary">${po.id}</span>
                      <span class="px-2 py-0.5 rounded-full ${po.status === 'DITERIMA' ? 'bg-status-success-bg text-status-success-text' : 'bg-status-warning-bg text-status-warning-text'} font-semibold">
                        ${po.status}
                      </span>
                    </div>
                    <div class="font-semibold text-on-surface mt-0.5">${po.productName}</div>
                    <div class="text-on-surface-variant">Vendor: ${po.vendorName} • Lead time: ${po.leadTimeDays} hari (Est: ${po.expectedDate})</div>
                  </div>
                  <div class="text-right">
                    <div class="font-bold text-sm text-on-surface">${po.quantity} Unit</div>
                    <div class="text-on-surface-variant font-mono">${window.ArbaUtils.formatRupiah(po.totalCost)}</div>
                    ${po.status === 'DITERIMA' ? `
                      <span class="inline-flex items-center gap-1 mt-1 px-2.5 py-1 rounded bg-status-success-bg text-status-success-text font-bold text-[11px]">
                        <span class="material-symbols-outlined text-[14px]">verified</span> Telah Masuk Gudang
                      </span>
                    ` : `
                      <button
                        class="btn-receive-po mt-1 px-2.5 py-1 rounded bg-primary text-white font-semibold text-[11px] cursor-pointer shadow-xs active:scale-95 border-0"
                        data-po-id="${po.id}"
                        data-po-sku="${po.sku}"
                        data-po-qty="${po.quantity}"
                        type="button"
                      >
                        Terima Barang Sekarang
                      </button>
                    `}
                  </div>
                </div>
              `;
            }).join('')}
            ${supplierPOs.length === 0 ? `
              <div class="p-8 text-center text-on-surface-variant">
                Tidak ada PO supplier aktif saat ini.
              </div>
            ` : ''}
          </div>
        </div>

        <div class="modal-footer">
          <button onclick="window.ArbaApp.closeModal()" class="btn btn-outline" type="button">
            Tutup
          </button>
        </div>
      </div>
    `;

    window.ArbaApp.openModal(modalHtml);

    setTimeout(function () {
      var btns = document.querySelectorAll('.btn-receive-po');
      btns.forEach(function (btn) {
        btn.onclick = function () {
          var poId = btn.getAttribute('data-po-id');
          var sku = btn.getAttribute('data-po-sku');
          var qty = Number(btn.getAttribute('data-po-qty'));

          window.ArbaStore.addInboundBatch({
            sku: sku,
            batch: 'BATCH-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 900),
            qty: qty,
            expiryDate: '2028-06-30',
            docRef: poId
          });

          window.ArbaApp.showToast(`PO ${poId} telah diterima di loading dock & stok bertambah!`, 'inventory');
          window.ArbaApp.closeModal();
        };
      });
    }, 50);
  }

  // Modal 4: Terbitkan PO Restock ke Vendor
  function openCreatePoModal(product) {
    var defaultQty = Math.max(100, (product.rop - product.stock) + product.safetyStock);
    var unitPurchaseCost = Math.round(product.unitPrice * 0.65);

    var modalHtml = `
      <div class="modal-dialog max-w-lg">
        <div class="modal-header">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[24px]">shopping_cart_checkout</span>
            <h3 class="modal-title">Terbitkan PO Supplier (Vendor Restock)</h3>
          </div>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form id="form-create-po">
          <div class="modal-body text-xs">
            <div class="p-3 bg-surface-container-low rounded-lg text-xs space-y-1 border border-border-subtle/30">
              <div class="font-bold text-sm text-on-surface">${product.name}</div>
              <div class="text-on-surface-variant font-mono">${product.sku} • Saldo Fisik: ${product.stock} unit (ROP: ${product.rop})</div>
              <div class="text-rose-600 font-semibold">Defisit Buffer: ${Math.max(0, product.rop - product.stock)} unit</div>
            </div>

            <div class="flex flex-col gap-1">
              <label class="font-semibold text-on-surface">Pilih Vendor Mitra Pabrik / Peternak</label>
              <select id="po-vendor" class="w-full bg-surface-container-low p-2.5 rounded-lg border border-border-subtle/40 font-medium cursor-pointer text-on-surface">
                <option value="CV Sumber Herbal Barokah Solo">CV Sumber Herbal Barokah Solo (Pabrik Ekstrak)</option>
                <option value="Kelompok Tani Lebah Rimba Boyolali">Kelompok Tani Lebah Rimba Boyolali (Madu Murni)</option>
                <option value="PT Kapsulindo Ekstrak Alami Karanganyar">PT Kapsulindo Ekstrak Alami Karanganyar</option>
                <option value="Importir Minyak Zaitun Al-Barokah Jakarta">Importir Minyak Zaitun Al-Barokah Jakarta</option>
              </select>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1">
                <label class="font-semibold text-on-surface">Kuantitas Pesan (Unit)</label>
                <input id="po-qty" value="${defaultQty}" min="10" required type="number" class="w-full bg-surface-container-low p-2 rounded-lg font-mono font-bold border border-border-subtle/40 text-on-surface" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="font-semibold text-on-surface">Lead Time Produksi &amp; Kirim</label>
                <select id="po-leadtime" class="w-full bg-surface-container-low p-2 rounded-lg cursor-pointer border border-border-subtle/40 text-on-surface">
                  <option value="3">3 Hari (Express)</option>
                  <option value="7" selected>7 Hari (Standar L=7)</option>
                  <option value="14">14 Hari (Batch Besar)</option>
                </select>
              </div>
            </div>

            <div class="p-2.5 bg-surface-container-low rounded-lg flex items-center justify-between font-semibold border border-border-subtle/30">
              <span class="text-on-surface-variant">Estimasi Nilai PO Supplier:</span>
              <span id="po-total-est" class="text-primary font-bold text-sm">
                ${window.ArbaUtils.formatRupiah(defaultQty * unitPurchaseCost)}
              </span>
            </div>
          </div>

          <div class="modal-footer">
            <button onclick="window.ArbaApp.closeModal()" class="btn btn-outline" type="button">
              Batal
            </button>
            <button type="submit" class="btn btn-primary">
              Kirim PO ke Vendor
            </button>
          </div>
        </form>
      </div>
    `;

    window.ArbaApp.openModal(modalHtml);

    setTimeout(function () {
      var qtyInput = document.getElementById('po-qty');
      var estSpan = document.getElementById('po-total-est');
      if (qtyInput && estSpan) {
        qtyInput.oninput = function () {
          var q = Number(qtyInput.value) || 0;
          estSpan.textContent = window.ArbaUtils.formatRupiah(q * unitPurchaseCost);
        };
      }

      var form = document.getElementById('form-create-po');
      if (form) {
        form.onsubmit = function (e) {
          e.preventDefault();
          window.ArbaStore.createSupplierPO({
            sku: product.sku,
            productName: product.name,
            vendorName: document.getElementById('po-vendor').value,
            quantity: Number(document.getElementById('po-qty').value),
            unitPrice: unitPurchaseCost,
            leadTimeDays: Number(document.getElementById('po-leadtime').value)
          });
          window.ArbaApp.closeModal();
        };
      }
    }, 50);
  }

  // Modal 5: Printable Opname Sheet
  function openPrintModal() {
    var appState = window.ArbaStore.getState();
    var products = appState.products;
    var totalUnits = products.reduce(function (acc, p) { return acc + p.stock; }, 0);

    var modalHtml = `
      <div class="modal-dialog max-w-2xl">
        <div class="modal-header">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[24px]">print</span>
            <h3 class="modal-title">Pratinjau Berkas Cetak Laporan Opname Stok CV Arba'in</h3>
          </div>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div class="modal-body">
          <div class="p-4 bg-surface-container-low/50 rounded-xl space-y-3 border border-border-subtle/40 text-on-surface">
            <div class="flex justify-between items-center border-b pb-2">
              <div>
                <h4 class="font-bold text-lg text-primary">CV ARBA'IN SURAKARTA</h4>
                <p class="text-xs text-on-surface-variant">Gudang Utama Kartasura • Sertifikasi CDOB &amp; ISO 9001:2015</p>
              </div>
              <div class="text-right text-xs">
                <p class="font-semibold">Kode Audit: OPN-2026-Q1-B</p>
                <p class="text-on-surface-variant">Tanggal: 28 Maret 2026</p>
              </div>
            </div>

            <div class="text-xs space-y-1">
              <p><strong>Total SKU Aktif:</strong> ${products.length} SKU</p>
              <p><strong>Total Saldo Fisik:</strong> ${window.ArbaUtils.formatNumber(totalUnits)} unit</p>
              <p><strong>Tingkat Kepatuhan FEFO:</strong> 99.4% Kepatuhan Strict</p>
            </div>

            <table class="w-full text-xs text-left border-collapse border border-slate-300">
              <thead>
                <tr class="bg-slate-200 text-slate-800">
                  <th class="border border-slate-300 p-1.5">SKU</th>
                  <th class="border border-slate-300 p-1.5">Nama Produk</th>
                  <th class="border border-slate-300 p-1.5 text-right">Saldo</th>
                  <th class="border border-slate-300 p-1.5 text-right">ROP</th>
                  <th class="border border-slate-300 p-1.5">Batch</th>
                  <th class="border border-slate-300 p-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                ${products.map(function (p) {
                  return `
                    <tr class="border-b border-slate-200">
                      <td class="border border-slate-300 p-1.5 font-mono">${p.sku}</td>
                      <td class="border border-slate-300 p-1.5">${p.name}</td>
                      <td class="border border-slate-300 p-1.5 text-right font-bold">${p.stock}</td>
                      <td class="border border-slate-300 p-1.5 text-right">${p.rop}</td>
                      <td class="border border-slate-300 p-1.5 font-mono">${p.activeBatch}</td>
                      <td class="border border-slate-300 p-1.5">${p.status === 'optimal' ? 'Aman' : 'Perlu PO'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>

            <div class="pt-3 text-[11px] text-on-surface-variant flex justify-between">
              <div>Petugas Pemeriksa: <b>Dewi Lestari (Chief Auditor)</b></div>
              <div>Disetujui Oleh: <b>Direktur Operasional CV Arba'in</b></div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button onclick="window.ArbaApp.closeModal()" class="btn btn-outline" type="button">
            Tutup
          </button>
          <button onclick="window.print(); window.ArbaApp.closeModal();" class="btn btn-primary" type="button">
            <span class="material-symbols-outlined text-[18px]">print</span>
            <span>Cetak Lembar Dokumen</span>
          </button>
        </div>
      </div>
    `;

    window.ArbaApp.openModal(modalHtml);
  }

  window.ArbaViews.renderInventoryLedger = renderInventoryLedger;
})();
