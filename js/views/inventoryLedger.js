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
    auditSearchQuery: '',
    activeAuditFilter: 'ALL',
    catalogPage: 1,
    catalogPageSize: 6
  };

  function renderInventoryLedger(container) {
    var appState = window.ArbaStore.getState();
    var products = appState.products;
    var ledger = appState.ledger;
    var auditLogs = appState.auditLogs || [];
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

    // Filter Audit Log Terpisah (Pelacakan 1 barang dari masuk hingga terjual)
    var auditQ = (state.auditSearchQuery || '').trim().toLowerCase();
    var filteredAuditLogs = auditLogs.filter(function (al) {
      if (state.activeAuditFilter !== 'ALL' && al.action !== state.activeAuditFilter) return false;
      if (!auditQ) return true;
      return [al.id, al.action, al.actor, al.outletName, al.outletId, al.sku, al.productName, al.batch, al.docRef, al.details]
        .some(function (v) { return String(v || '').toLowerCase().indexOf(auditQ) !== -1; });
    });

    var activeRole = (appState.currentUser && appState.currentUser.role === 'super-admin')
      ? (appState.currentRole || 'super-admin')
      : (appState.currentUser ? appState.currentUser.role : 'inventory');
    var isWarehouseRole = activeRole === 'inventory';

    var html = `
      <div class="flex flex-col w-full gap-space-lg">
        <!-- Top Bar / Action Center (Disesuaikan dengan Role Gudang vs Direksi) -->
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-container-lowest p-5 rounded-xl border border-border-subtle/60">
          <div class="flex flex-col gap-1">
            <h1 class="text-xl text-on-surface tracking-tight font-bold">
              Stok &amp; Buku Besar
            </h1>
            <div class="flex items-center gap-2 flex-wrap text-[11px] text-on-surface-variant">
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200/60">
                <span class="material-symbols-outlined text-[13px]">thermostat</span>
                <span>Gudang Kartasura: 22,4°C • RH 52% (Normal CDOB)</span>
              </span>
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                <span class="material-symbols-outlined text-[13px]">verified</span>
                <span>NIE BPOM &amp; Halal BPJPH Terverifikasi</span>
              </span>
            </div>
          </div>

          <!-- Compact Action Cluster -->
          <div class="flex items-center gap-1.5 flex-wrap">
            <button
              id="btn-inbound-batch"
              class="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-container text-white text-xs font-semibold whitespace-nowrap transition-colors shadow-xs active:scale-95 cursor-pointer border-0"
              type="button"
            >
              <span class="material-symbols-outlined text-[16px]">add_box</span>
              <span>+ Barang Masuk</span>
            </button>

            <button
              id="btn-adjust-opname"
              class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border border-border-subtle/50"
              type="button"
            >
              <span class="material-symbols-outlined text-[15px] text-on-surface-variant">tune</span>
              <span>Opname</span>
            </button>

            <button
              id="btn-supplier-po-list"
              class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-primary text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border border-border-subtle/50"
              type="button"
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
              id="btn-qr-batch-modal"
              class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border border-border-subtle/50"
              type="button"
            >
              <span class="material-symbols-outlined text-[15px] text-primary">qr_code_scanner</span>
              <span>QR Batch</span>
            </button>

            <button
              id="btn-chain-audit-modal"
              class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border border-border-subtle/50"
              type="button"
            >
              <span class="material-symbols-outlined text-[15px] text-emerald-600">verified_user</span>
              <span>Audit CDOB</span>
            </button>

            <button
              id="btn-batch-recall-modal"
              class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border border-rose-200/70"
              type="button"
              title="1-Klik Pelacakan &amp; Penarikan Batch CDOB BPOM (Batch Recall)"
            >
              <span class="material-symbols-outlined text-[15px]">gpp_maybe</span>
              <span>Batch Recall</span>
            </button>

            <button
              id="btn-import-ledger-csv"
              class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-primary text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border border-border-subtle/50"
              type="button"
            >
              <span class="material-symbols-outlined text-[15px]">upload_file</span>
              <span>Impor CSV</span>
            </button>

            <button
              id="btn-export-ledger-csv"
              class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border border-border-subtle/50"
              type="button"
            >
              <span class="material-symbols-outlined text-[15px] text-on-surface-variant">table_chart</span>
              <span>Ekspor CSV</span>
            </button>

            <button
              id="btn-print-opname"
              class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border border-border-subtle/50"
              type="button"
            >
              <span class="material-symbols-outlined text-[15px] text-on-surface-variant">print</span>
              <span>Cetak</span>
            </button>
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
              <span class="font-semibold text-rose-700">Prioritas FEFO</span>
            </div>
          </div>

          <!-- Card 4: Total Mutasi Ledger -->
          <div class="bg-surface-container-lowest p-5 rounded-xl border border-border-subtle/60 flex flex-col justify-between">
            <div class="flex items-start justify-between">
              <div>
                <span class="text-xs text-primary uppercase tracking-wider font-semibold">
                  Mutasi Buku Besar
                </span>
                <div class="text-2xl text-primary mt-1 tracking-tight font-bold">
                  ${ledger.length} <span class="text-xs text-on-surface-variant font-normal">Entri</span>
                </div>
              </div>
              <div class="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700" style="background:#dcfce7;">
                <span class="material-symbols-outlined text-[20px]">receipt_long</span>
              </div>
            </div>
            <div class="mt-4 pt-2.5 border-t border-border-subtle/40 flex items-center justify-between text-xs text-on-surface-variant">
              <span>Catatan Stok Aktif</span>
              <span class="font-semibold text-primary">Tersinkronisasi</span>
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
                <span class="material-symbols-outlined text-on-surface-variant absolute left-2.5 top-2.5 text-[18px]" aria-hidden="true">
                  search
                </span>
                <input
                  id="catalog-search"
                  value="${window.ArbaUtils.escapeHtml(state.searchQuery)}"
                  aria-label="Cari SKU atau Nama Produk Herbal"
                  class="pl-8 pr-3 py-2 bg-surface-container-low rounded-lg font-body-sm text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:bg-surface-container w-52 sm:w-60 text-xs border-0"
                  placeholder="Cari SKU / Nama Herbal..."
                  type="text"
                />
              </div>
              <select
                id="catalog-category-select"
                aria-label="Filter Kategori Produk Herbal"
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
                aria-label="Filter Status Reorder Point (ROP)"
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
                            <div class="font-semibold text-on-surface">${window.ArbaUtils.escapeHtml(p.name)}</div>
                            <div class="font-code-table text-code-table text-on-surface-variant font-mono text-[11px]">${window.ArbaUtils.escapeHtml(p.sku)}</div>
                          </div>
                        </div>
                      </td>
                      <td class="py-3 px-3">
                        <span class="px-2 py-0.5 rounded bg-surface-container font-label-sm text-label-sm text-on-surface">
                          ${window.ArbaUtils.escapeHtml(p.category)}
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
                        ${p.nieBpom ? `<div class="text-[10px] font-mono text-on-surface-variant mt-1">${window.ArbaUtils.escapeHtml(p.nieBpom)}</div>` : ''}
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

        <!-- SECTION 1B: Rekonsiliasi Manifest Barang Bawaan Armada Sales -->
        <section class="flex flex-col gap-space-md bg-surface-container-lowest p-space-lg rounded-xl shadow-xs border border-border-subtle/40">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
            <div>
              <div class="flex items-center gap-2">
                <h2 class="font-headline-md text-headline-md text-on-surface font-bold text-lg">
                  Rekonsiliasi Manifest Barang Bawaan Armada Sales (Pengambilan vs Penyerahan vs Pengembalian)
                </h2>
                <span class="badge badge-warning">
                  Audit Manifest Kanvas
                </span>
              </div>
              <p class="font-body-sm text-body-sm text-on-surface-variant text-xs">
                Memverifikasi kesesuaian kuantitas fisik produk yang dibawa personel sales saat keberangkatan dengan bukti penyerahan outlet dan sisa pengembalian ke gudang.
              </p>
            </div>
            <button
              id="btn-new-sales-load"
              type="button"
              class="px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-semibold cursor-pointer border-0 flex items-center gap-1.5 shrink-0"
            >
              <span class="material-symbols-outlined text-[16px]">local_shipping</span>
              <span>+ Catat Pengeluaran Manifest Sales</span>
            </button>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            ${salesLoadings.map(function (ld) {
              var hasDiscrepancy = ld.status === 'SELISIH_AUDIT' || (ld.items || []).some(function (i) { return i.discrepancy > 0; });
              var isKlop = ld.status === 'TERVERIFIKASI_KLOP' && !hasDiscrepancy;
              var badgeCls = hasDiscrepancy ? 'badge-danger' : (isKlop ? 'badge-success' : 'badge-warning');
              var badgeLabel = hasDiscrepancy ? '⚠ SELISIH AUDIT' : (isKlop ? '✓ TERVERIFIKASI SESUAI' : 'DALAM PERJALANAN');

              return `
                <div class="rounded-xl p-4 flex flex-col justify-between gap-3 bg-surface-container-low border border-border-subtle">
                  <div>
                    <div class="flex items-center justify-between gap-2 mb-2">
                      <div>
                        <div class="font-bold text-sm text-on-surface">${window.ArbaUtils.escapeHtml(ld.salesRep)}</div>
                        <div class="text-[11px] text-on-surface-variant">${window.ArbaUtils.escapeHtml(ld.division)} · ${window.ArbaUtils.escapeHtml(ld.routeArea)}</div>
                      </div>
                      <span class="badge ${badgeCls}">
                        ${badgeLabel}
                      </span>
                    </div>

                    ${ld.auditNote ? `
                      <div class="p-2 rounded-lg text-[11px] font-semibold mb-2 bg-status-danger-bg text-status-danger-text">
                        ${window.ArbaUtils.escapeHtml(ld.auditNote)}
                      </div>
                    ` : ''}

                    <div class="bg-surface-container-lowest rounded-lg p-2.5 space-y-1.5 border border-border-subtle text-xs">
                      <div class="grid grid-cols-12 text-[10px] font-bold text-on-surface-variant uppercase pb-1 border-b border-border-subtle">
                        <span class="col-span-5">SKU Produk</span>
                        <span class="col-span-2 text-center">Kuota</span>
                        <span class="col-span-2 text-center">Diserahkan</span>
                        <span class="col-span-3 text-right">Kembali</span>
                      </div>
                      ${(ld.items || []).map(function (it) {
                        return `
                          <div class="grid grid-cols-12 items-center text-[11px] text-on-surface">
                            <span class="col-span-5 font-semibold truncate" title="${window.ArbaUtils.escapeHtml(it.name)}">${window.ArbaUtils.escapeHtml(it.name)}</span>
                            <span class="col-span-2 text-center font-mono font-bold">${it.loadedQty}</span>
                            <span class="col-span-2 text-center font-mono text-emerald-600 font-bold">${it.droppedQty}</span>
                            <span class="col-span-3 text-right font-mono font-bold ${it.discrepancy > 0 ? 'text-rose-600' : 'text-on-surface'}">
                              ${it.returnedQty}${it.discrepancy > 0 ? ` (-${it.discrepancy}!)` : ''}
                            </span>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  </div>

                  <div class="flex items-center justify-between pt-1 text-xs">
                    <span class="text-on-surface-variant">Nilai Penagihan: <b class="text-on-surface">${window.ArbaUtils.formatRupiah(ld.cashCollected)}</b></span>
                    <button
                      type="button"
                      class="btn-reconcile-load px-2.5 py-1.5 rounded-lg bg-primary hover:bg-primary-container text-white text-[11px] font-semibold cursor-pointer border-0"
                      data-load-id="${ld.id}"
                    >
                      ${hasDiscrepancy ? 'Rekonsiliasi Selisih Fisik' : 'Verifikasi Pengembalian'}
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
                        <div class="font-code-table text-code-table font-bold text-on-surface font-mono">${window.ArbaUtils.escapeHtml(entry.id)}</div>
                        <div class="font-label-sm text-label-sm text-on-surface-variant text-[11px]">${window.ArbaUtils.escapeHtml(entry.timestamp)}</div>
                      </td>
                      <td class="py-3 px-3 font-code-table text-code-table text-secondary font-medium font-mono">
                        ${window.ArbaUtils.escapeHtml(entry.docRef)}
                      </td>
                      <td class="py-3 px-3">
                        <div class="font-label-md text-label-md text-on-surface font-semibold">${window.ArbaUtils.escapeHtml(entry.skuName)}</div>
                        <div class="font-code-table text-code-table text-on-surface-variant font-mono text-[11px]">${window.ArbaUtils.escapeHtml(entry.batch)}</div>
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
                        <div class="font-label-md text-label-md text-on-surface font-semibold">${window.ArbaUtils.escapeHtml(entry.operator)}</div>
                        <div class="font-label-sm text-label-sm text-on-surface-variant text-[11px]">${window.ArbaUtils.escapeHtml(entry.operatorRole)}</div>
                      </td>
                      <td class="py-3 px-4 font-code-table text-code-table text-on-surface-variant">
                        <span class="bg-surface-container px-2 py-0.5 rounded text-[11px] font-mono text-on-surface-variant" title="Verified SHA-256 Ledger Node">
                          ${window.ArbaUtils.escapeHtml(entry.hash)}
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
              Total Entri: ${ledger.length}
            </div>
          </div>
        </section>

        <!-- SECTION 3: Audit Log Terpisah (Pelacakan Siklus Hidup Barang & Jejak Audit CDOB/BPOM) -->
        <section class="flex flex-col gap-space-md bg-surface-container-lowest p-space-lg rounded-xl shadow-xs border border-border-subtle/40">
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h2 class="font-headline-md text-headline-md text-on-surface font-bold text-lg">
                  Audit Log Terpisah &amp; Pelacakan Jejak Barang (Traceability)
                </h2>
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                  <span class="material-symbols-outlined text-[13px]">policy</span>
                  Tabel Terpisah (audit_logs)
                </span>
              </div>
              <p class="font-body-sm text-body-sm text-on-surface-variant text-xs mt-0.5">
                Lacak riwayat lengkap 1 barang/batch dari masuk gudang hingga terjual ke outlet (pelaku, outlet, tanggal &amp; jam) terpisah dari tabel transaksi utama.
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <div class="relative min-w-[220px]">
                <span class="material-symbols-outlined text-on-surface-variant absolute left-2.5 top-2 text-[16px] pointer-events-none" style="position:absolute; left:0.65rem; top:0.5rem;">search</span>
                <input
                  id="audit-log-search"
                  type="text"
                  value="${window.ArbaUtils.escapeHtml(state.auditSearchQuery)}"
                  placeholder="Cari SKU, Batch, Sales, Outlet..."
                  class="w-full pl-8 pr-3 py-1.5 rounded-lg bg-surface-container-low text-xs text-on-surface border border-border-subtle/50 focus:outline-none"
                  style="padding-left:2rem;"
                />
              </div>
              <select
                id="audit-log-action-filter"
                aria-label="Filter tipe aksi audit log"
                class="px-3 py-1.5 rounded-lg bg-surface-container-low text-xs font-semibold text-on-surface border border-border-subtle/50 cursor-pointer"
              >
                <option value="ALL" ${state.activeAuditFilter === 'ALL' ? 'selected' : ''}>Semua Aktivitas (${auditLogs.length})</option>
                <option value="INBOUND_BATCH" ${state.activeAuditFilter === 'INBOUND_BATCH' ? 'selected' : ''}>Barang Masuk (Inbound)</option>
                <option value="ORDER_CREATED" ${state.activeAuditFilter === 'ORDER_CREATED' ? 'selected' : ''}>Penjualan / Order Baru</option>
                <option value="ORDER_NEAR_ED_HELD" ${state.activeAuditFilter === 'ORDER_NEAR_ED_HELD' ? 'selected' : ''}>Order Near-ED Ditahan</option>
                <option value="NEAR_EXPIRY_OVERRIDE" ${state.activeAuditFilter === 'NEAR_EXPIRY_OVERRIDE' ? 'selected' : ''}>Override Mendesak Near-ED</option>
                <option value="ORDER_APPROVED" ${state.activeAuditFilter === 'ORDER_APPROVED' ? 'selected' : ''}>Faktur Disetujui</option>
                <option value="ORDER_DELIVERED" ${state.activeAuditFilter === 'ORDER_DELIVERED' ? 'selected' : ''}>Terkirim / POD Armada</option>
                <option value="ORDER_REJECTED" ${state.activeAuditFilter === 'ORDER_REJECTED' ? 'selected' : ''}>Order Ditolak / Retur</option>
                <option value="BATCH_RECALL_QUARANTINE" ${state.activeAuditFilter === 'BATCH_RECALL_QUARANTINE' ? 'selected' : ''}>Karantina / Batch Recall</option>
              </select>
            </div>
          </div>

          <div class="overflow-x-auto rounded-xl border border-border-subtle/30">
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="bg-surface-container-low/60 text-on-surface-variant font-label-sm uppercase tracking-wider">
                  <th class="py-2.5 px-3">ID &amp; Waktu (WIB)</th>
                  <th class="py-2.5 px-3">Aksi Audit</th>
                  <th class="py-2.5 px-3">Pelaku &amp; Peran</th>
                  <th class="py-2.5 px-3">Barang / SKU &amp; Batch</th>
                  <th class="py-2.5 px-3">Outlet Tujuan</th>
                  <th class="py-2.5 px-3">Detail &amp; Ref Dokumen</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border-subtle/30">
                ${filteredAuditLogs.length === 0 ? `
                  <tr>
                    <td colspan="6" class="py-6 text-center text-on-surface-variant text-xs">
                      Tidak ada entri audit log yang cocok dengan filter pencarian.
                    </td>
                  </tr>
                ` : filteredAuditLogs.slice(0, 40).map(function (al) {
                  var actStyle = 'background:#e2e8f0; color:#334155;';
                  if (al.action === 'INBOUND_BATCH') actStyle = 'background:#dcfce7; color:#166534;';
                  else if (al.action === 'ORDER_CREATED' || al.action === 'ORDER_APPROVED') actStyle = 'background:#ccfbf1; color:#0f766e;';
                  else if (al.action === 'NEAR_EXPIRY_OVERRIDE' || al.action === 'ORDER_NEAR_ED_HELD') actStyle = 'background:#fef3c7; color:#92400e;';
                  else if (al.action === 'ORDER_REJECTED' || al.action === 'BATCH_RECALL_QUARANTINE') actStyle = 'background:#ffe4e6; color:#9f1239;';
                  else if (al.action === 'ORDER_DELIVERED') actStyle = 'background:#dbeafe; color:#1e40af;';
                  return `
                    <tr class="hover:bg-surface-container-low/40 transition-colors">
                      <td class="py-2.5 px-3 whitespace-nowrap">
                        <div class="font-mono font-bold text-on-surface text-[11px]">${window.ArbaUtils.escapeHtml(al.id)}</div>
                        <div class="text-[10px] text-on-surface-variant">${window.ArbaUtils.escapeHtml(al.timestamp || al.isoTime)}</div>
                      </td>
                      <td class="py-2.5 px-3 whitespace-nowrap">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold" style="${actStyle}">
                          ${window.ArbaUtils.escapeHtml(al.action)}
                        </span>
                      </td>
                      <td class="py-2.5 px-3">
                        <div class="font-semibold text-on-surface">${window.ArbaUtils.escapeHtml(al.actor)}</div>
                        <div class="text-[10px] text-on-surface-variant">${window.ArbaUtils.escapeHtml(al.actorRole)}</div>
                      </td>
                      <td class="py-2.5 px-3">
                        <div class="font-semibold text-on-surface">${window.ArbaUtils.escapeHtml(al.productName || al.sku || '-')}</div>
                        <div class="font-mono text-[10px] text-on-surface-variant">
                          ${al.batch ? 'Batch: ' + window.ArbaUtils.escapeHtml(al.batch) : '-'}
                          ${al.qty !== null && al.qty !== undefined ? ' • Qty: ' + window.ArbaUtils.escapeHtml(al.qty) : ''}
                        </div>
                      </td>
                      <td class="py-2.5 px-3">
                        <div class="font-medium text-on-surface">${window.ArbaUtils.escapeHtml(al.outletName || '-')}</div>
                        ${al.outletId ? `<div class="font-mono text-[10px] text-on-surface-variant">${window.ArbaUtils.escapeHtml(al.outletId)}</div>` : ''}
                      </td>
                      <td class="py-2.5 px-3 max-w-[300px]">
                        <div class="text-on-surface text-[11px]">${window.ArbaUtils.escapeHtml(al.details || '-')}</div>
                        <div class="font-mono text-[10px] text-primary mt-0.5">Ref: ${window.ArbaUtils.escapeHtml(al.docRef || '-')} • #${window.ArbaUtils.escapeHtml(al.checksum || '')}</div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
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

    // Advance: QR Batch Scanner & Label Generator Modal
    var btnQrBatch = container.querySelector('#btn-qr-batch-modal');
    if (btnQrBatch && window.ArbaAdvanced) {
      btnQrBatch.addEventListener('click', function () {
        window.ArbaAdvanced.openQrBatchModal({ initialTab: 'labels' });
      });
    }

    // Advance: Blockchain-Style SHA-256 Chain Audit Modal
    var btnChainAudit = container.querySelector('#btn-chain-audit-modal');
    if (btnChainAudit && window.ArbaAdvanced) {
      btnChainAudit.addEventListener('click', function () {
        window.ArbaAdvanced.openLedgerChainAuditModal();
      });
    }

    // Advance: 1-Klik Batch Recall CDOB BPOM Modal
    var btnBatchRecall = container.querySelector('#btn-batch-recall-modal');
    if (btnBatchRecall && window.ArbaAdvanced && typeof window.ArbaAdvanced.openBatchRecallModal === 'function') {
      btnBatchRecall.addEventListener('click', function () {
        window.ArbaAdvanced.openBatchRecallModal();
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

    // Audit Log Terpisah Search & Filter
    var auditSearch = container.querySelector('#audit-log-search');
    if (auditSearch) {
      auditSearch.addEventListener('input', function (e) {
        state.auditSearchQuery = e.target.value;
        renderInventoryLedger(container);
        var inputNow = container.querySelector('#audit-log-search');
        if (inputNow) {
          inputNow.focus();
          inputNow.setSelectionRange(inputNow.value.length, inputNow.value.length);
        }
      });
    }
    var auditFilterSel = container.querySelector('#audit-log-action-filter');
    if (auditFilterSel) {
      auditFilterSel.addEventListener('change', function (e) {
        state.activeAuditFilter = e.target.value;
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
              <h3 class="font-bold text-sm text-on-surface">Formulir Rekonsiliasi Pengembalian Manifest Sales</h3>
              <p class="text-[11px] text-on-surface-variant">${window.ArbaUtils.escapeHtml(loadRec.salesRep)} (${window.ArbaUtils.escapeHtml(loadRec.division)}) • ${window.ArbaUtils.escapeHtml(loadRec.id)}</p>
            </div>
          </div>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form id="form-reconcile-loading">
          <div class="modal-body text-xs space-y-3">
            <div class="p-2.5 rounded-lg bg-surface-container-low border border-border-subtle/50 text-on-surface-variant">
              Masukkan kuantitas fisik produk yang dikembalikan ke gudang. Apabila terdapat perbedaan terhadap saldo seharusnya (<b>Kuota Awal dikurangi Penyerahan Outlet</b>), sistem secara otomatis mencatat status <b>Selisih Audit</b>.
            </div>

            <div class="overflow-x-auto rounded-lg border border-border-subtle/50">
              <table class="w-full text-left border-collapse text-xs">
                <thead>
                  <tr class="bg-surface-container-low text-on-surface-variant text-[10px] uppercase">
                    <th class="p-2">Produk Herbal</th>
                    <th class="p-2 text-center">Kuota Awal</th>
                    <th class="p-2 text-center">Diserahkan ke Outlet</th>
                    <th class="p-2 text-center">Saldo Seharusnya</th>
                    <th class="p-2 text-center">Fisik Kembali (Unit)</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border-subtle/40">
                  ${loadRec.items.map(function (it) {
                    var expected = Math.max(0, it.loadedQty - it.droppedQty);
                    return `
                      <tr>
                        <td class="p-2 font-semibold text-on-surface">
                          <div>${window.ArbaUtils.escapeHtml(it.name)}</div>
                          <div class="text-[10px] font-mono text-on-surface-variant">${window.ArbaUtils.escapeHtml(it.sku)} • ${window.ArbaUtils.escapeHtml(it.batch)}</div>
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
              Verifikasi Seluruh Kuantitas Sesuai (100%)
            </button>
            <div class="flex items-center gap-2">
              <button type="button" class="btn btn-outline" onclick="window.ArbaApp.closeModal()">Batal</button>
              <button type="submit" class="btn btn-primary">Simpan Hasil Rekonsiliasi</button>
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
              <h3 class="font-bold text-sm text-on-surface">Pencatatan Pengeluaran Manifest Sales dari Gudang</h3>
              <p class="text-[11px] text-on-surface-variant">Pencatatan inventaris gudang yang dibawa personel sales untuk distribusi lapangan</p>
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
                      <span class="font-bold font-mono text-primary">${window.ArbaUtils.escapeHtml(po.id)}</span>
                      <span class="px-2 py-0.5 rounded-full ${po.status === 'DITERIMA' ? 'bg-status-success-bg text-status-success-text' : 'bg-status-warning-bg text-status-warning-text'} font-semibold">
                        ${window.ArbaUtils.escapeHtml(po.status)}
                      </span>
                    </div>
                    <div class="font-semibold text-on-surface mt-0.5">${window.ArbaUtils.escapeHtml(po.productName)}</div>
                    <div class="text-on-surface-variant">Vendor: ${window.ArbaUtils.escapeHtml(po.vendorName)} • Lead time: ${po.leadTimeDays} hari (Est: ${window.ArbaUtils.escapeHtml(po.expectedDate)})</div>
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
              <div class="font-bold text-sm text-on-surface">${window.ArbaUtils.escapeHtml(product.name)}</div>
              <div class="text-on-surface-variant font-mono">${window.ArbaUtils.escapeHtml(product.sku)} • Saldo Fisik: ${product.stock} unit (ROP: ${product.rop})</div>
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
                      <td class="border border-slate-300 p-1.5 font-mono">${window.ArbaUtils.escapeHtml(p.sku)}</td>
                      <td class="border border-slate-300 p-1.5">${window.ArbaUtils.escapeHtml(p.name)}</td>
                      <td class="border border-slate-300 p-1.5 text-right font-bold">${p.stock}</td>
                      <td class="border border-slate-300 p-1.5 text-right">${p.rop}</td>
                      <td class="border border-slate-300 p-1.5 font-mono">${window.ArbaUtils.escapeHtml(p.activeBatch)}</td>
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
