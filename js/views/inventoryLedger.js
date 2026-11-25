/**
 * ArbaConnect ERP - Inventory & Stock Ledger View
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
    var products = appState.products || [];
    var ledger = appState.ledger || [];
    var supplierPOs = appState.supplierPOs || [];
    var salesLoadings = appState.salesLoadings || [];

    var totalPhysicalUnits = products.reduce(function (acc, p) { return acc + p.stock; }, 0);
    var belowRopCount = products.filter(function (p) { return p.stock <= p.rop; }).length;
    var criticalExpiryCount = products.filter(function (p) { return p.fefoStatus === 'Kritis (<30 Hari)'; }).length;
    var warningExpiryCount = products.filter(function (p) { return p.fefoStatus === 'Mendekati ED (<3 Bulan)'; }).length;
    var inboundLedgerCount = ledger.filter(function (l) { return l.type === 'MASUK'; }).length;
    var outboundLedgerCount = ledger.filter(function (l) { return l.type === 'KELUAR'; }).length;

    var filteredProducts = products.filter(function (p) {
      var q = state.searchQuery.toLowerCase();
      var matchesSearch =
        !q ||
        p.name.toLowerCase().indexOf(q) !== -1 ||
        p.sku.toLowerCase().indexOf(q) !== -1;

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

    var filteredLedger = ledger.filter(function (entry) {
      if (state.activeLedgerFilter === 'ALL') return true;
      return entry.type === state.activeLedgerFilter;
    });

    var html = `
      <div class="flex flex-col w-full gap-space-lg pb-space-xl">
        <!-- Page Header -->
        <div class="page-header">
          <div>
            <h1 class="page-title">Stok &amp; Buku Besar</h1>
            <p class="page-meta">Gudang Kartasura · Kontrol Batch FEFO &amp; ROP</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button id="btn-inbound-batch" class="btn btn-primary" type="button">
              <span class="material-symbols-outlined text-[16px]">add_box</span>
              <span>Barang Masuk</span>
            </button>
            <button id="btn-adjust-opname" class="btn btn-outline" type="button">
              <span class="material-symbols-outlined text-[16px]">tune</span>
              <span>Opname</span>
            </button>
            <button id="btn-supplier-po-list" class="btn btn-outline" type="button">
              <span class="material-symbols-outlined text-[16px]">local_mall</span>
              <span>PO Supplier (${supplierPOs.length})</span>
            </button>
            <button id="btn-qr-batch-modal" class="btn btn-outline" type="button">
              <span class="material-symbols-outlined text-[16px]">qr_code_scanner</span>
              <span>QR Batch</span>
            </button>
            <button id="btn-chain-audit-modal" class="btn btn-outline" type="button">
              <span class="material-symbols-outlined text-[16px]">verified_user</span>
              <span>Audit Ledger</span>
            </button>
            <button id="btn-import-ledger-csv" class="btn btn-outline" type="button">
              <span class="material-symbols-outlined text-[16px]">upload_file</span>
              <span>Impor CSV</span>
            </button>
            <button id="btn-export-ledger-csv" class="btn btn-outline" type="button">
              <span class="material-symbols-outlined text-[16px]">table_chart</span>
              <span>Ekspor CSV</span>
            </button>
            <button id="btn-print-opname" class="btn btn-outline" type="button">
              <span class="material-symbols-outlined text-[16px]">print</span>
              <span>Cetak</span>
            </button>
          </div>
        </div>

        <!-- KPI Cards (100% Live) -->
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div class="kpi-card">
            <div>
              <div class="kpi-header">
                <span class="kpi-title">Total SKU</span>
                <span class="material-symbols-outlined text-primary text-[20px]">medication</span>
              </div>
              <div class="kpi-value">${products.length} <span class="text-sm font-normal text-on-surface-variant">SKU</span></div>
            </div>
            <div class="kpi-footer">
              <span class="text-on-surface-variant">Total Saldo Fisik</span>
              <span class="font-mono font-semibold text-primary">${window.ArbaUtils.formatNumber(totalPhysicalUnits)} unit</span>
            </div>
          </div>

          <div class="kpi-card">
            <div>
              <div class="kpi-header">
                <span class="kpi-title">Di Bawah ROP</span>
                <span class="badge ${belowRopCount > 0 ? 'badge-warning' : 'badge-success'}">${belowRopCount > 0 ? 'Reorder' : 'Aman'}</span>
              </div>
              <div class="kpi-value ${belowRopCount > 0 ? 'text-amber-700' : 'text-emerald-700'}">${belowRopCount} <span class="text-sm font-normal text-on-surface-variant">SKU</span></div>
            </div>
            <div class="kpi-footer">
              <span class="text-on-surface-variant">Status Gudang</span>
              <span class="font-semibold ${belowRopCount > 0 ? 'text-amber-700' : 'text-emerald-700'}">${belowRopCount > 0 ? 'Perlu PO Restock' : 'Semua Di Atas ROP'}</span>
            </div>
          </div>

          <div class="kpi-card">
            <div>
              <div class="kpi-header">
                <span class="kpi-title">Kedaluwarsa (FEFO)</span>
                <span class="badge ${criticalExpiryCount > 0 ? 'badge-danger' : 'badge-neutral'}">${criticalExpiryCount} Kritis</span>
              </div>
              <div class="kpi-value ${criticalExpiryCount > 0 ? 'text-rose-700' : 'text-on-surface'}">${criticalExpiryCount + warningExpiryCount} <span class="text-sm font-normal text-on-surface-variant">Batch</span></div>
            </div>
            <div class="kpi-footer">
              <span class="text-on-surface-variant">Kritis &lt;30 hari: ${criticalExpiryCount}</span>
              <span class="text-amber-700 font-semibold">&lt;90 hari: ${warningExpiryCount}</span>
            </div>
          </div>

          <div class="kpi-card">
            <div>
              <div class="kpi-header">
                <span class="kpi-title">Mutasi Ledger</span>
                <span class="material-symbols-outlined text-primary text-[20px]">receipt_long</span>
              </div>
              <div class="kpi-value">${ledger.length} <span class="text-sm font-normal text-on-surface-variant">Baris</span></div>
            </div>
            <div class="kpi-footer">
              <span class="text-emerald-700 font-semibold">+${inboundLedgerCount} Masuk</span>
              <span class="text-rose-600 font-semibold">-${outboundLedgerCount} Keluar</span>
            </div>
          </div>
        </div>

        <!-- Katalog Stok Gudang & ROP -->
        <section class="section-card flex flex-col gap-4">
          <div class="section-header">
            <h2 class="section-title">Katalog Stok Gudang</h2>
            <div class="flex flex-wrap items-center gap-2">
              <div class="relative">
                <span class="material-symbols-outlined text-on-surface-variant absolute left-2.5 top-2 text-[18px] pointer-events-none">search</span>
                <input
                  id="catalog-search"
                  value="${window.ArbaUtils.escapeHtml(state.searchQuery)}"
                  class="pl-8 pr-3 py-2 bg-surface-container-low rounded-lg text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none w-52 sm:w-60 border border-border-subtle/50"
                  placeholder="Cari SKU / produk..."
                  type="text"
                />
              </div>
              <select id="catalog-category-select" class="bg-surface-container-low text-on-surface px-3 py-2 rounded-lg cursor-pointer text-xs border border-border-subtle/50">
                <option value="all" ${state.selectedCategory === 'all' ? 'selected' : ''}>Semua Kategori</option>
                <option value="madu" ${state.selectedCategory === 'madu' ? 'selected' : ''}>Madu Herbal</option>
                <option value="kapsul" ${state.selectedCategory === 'kapsul' ? 'selected' : ''}>Kapsul Herbal</option>
                <option value="minyak" ${state.selectedCategory === 'minyak' ? 'selected' : ''}>Minyak &amp; Cairan</option>
                <option value="kosmetik" ${state.selectedCategory === 'kosmetik' ? 'selected' : ''}>Kosmetik Herbal</option>
                <option value="serbuk" ${state.selectedCategory === 'serbuk' ? 'selected' : ''}>Serbuk</option>
              </select>
              <select id="catalog-rop-select" class="bg-surface-container-low text-on-surface px-3 py-2 rounded-lg cursor-pointer text-xs border border-border-subtle/50">
                <option value="all" ${state.selectedRopStatus === 'all' ? 'selected' : ''}>Semua Status</option>
                <option value="safe" ${state.selectedRopStatus === 'safe' ? 'selected' : ''}>Stok Aman</option>
                <option value="below-rop" ${state.selectedRopStatus === 'below-rop' ? 'selected' : ''}>Di Bawah ROP</option>
                <option value="empty" ${state.selectedRopStatus === 'empty' ? 'selected' : ''}>Stok Habis</option>
              </select>
            </div>
          </div>

          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Produk</th>
                  <th>Kategori</th>
                  <th class="text-right">Stok</th>
                  <th class="text-right">Safety Stock</th>
                  <th class="text-right">ROP</th>
                  <th>Batch Aktif</th>
                  <th>Kedaluwarsa</th>
                  <th class="text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                ${paginatedProducts.map(function (p) {
                  var isBelowRop = p.stock <= p.rop;
                  var isCriticalExp = p.fefoStatus === 'Kritis (<30 Hari)';
                  var isWarningExp = p.fefoStatus === 'Mendekati ED (<3 Bulan)';

                  return `
                    <tr>
                      <td>
                        <div class="font-semibold text-on-surface">${window.ArbaUtils.escapeHtml(p.name)}</div>
                        <div class="font-mono text-[11px] text-on-surface-variant">${window.ArbaUtils.escapeHtml(p.sku)}</div>
                      </td>
                      <td><span class="badge badge-neutral">${window.ArbaUtils.escapeHtml(p.category)}</span></td>
                      <td class="text-right font-mono font-bold ${isCriticalExp ? 'text-rose-600' : isBelowRop ? 'text-amber-700' : 'text-on-surface'}">
                        ${window.ArbaUtils.formatNumber(p.stock)}
                      </td>
                      <td class="text-right font-mono text-on-surface-variant">${p.safetyStock}</td>
                      <td class="text-right font-mono font-semibold ${isBelowRop ? 'text-amber-700' : 'text-primary'}">${p.rop}</td>
                      <td class="font-mono"><span class="badge ${isCriticalExp ? 'badge-danger' : 'badge-neutral'}">${window.ArbaUtils.escapeHtml(p.activeBatch)}</span></td>
                      <td>
                        <div class="font-mono ${isCriticalExp ? 'text-rose-600 font-bold' : 'text-on-surface'}">${window.ArbaUtils.escapeHtml(p.fefoDate)}</div>
                        <div class="text-[10px] ${isCriticalExp ? 'text-rose-600 font-bold' : isWarningExp ? 'text-amber-700 font-semibold' : 'text-emerald-700'}">${window.ArbaUtils.escapeHtml(p.fefoStatus)}</div>
                      </td>
                      <td class="text-center">
                        ${(isCriticalExp || isBelowRop) ? `
                          <button class="btn-trigger-po btn btn-sm ${isCriticalExp ? 'btn-danger' : 'btn-primary'}" data-sku="${p.sku}" type="button">
                            Restock PO
                          </button>
                        ` : `
                          <span class="badge badge-success">Aman</span>
                        `}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <div class="flex flex-col sm:flex-row items-center justify-between text-xs text-on-surface-variant gap-2">
            <div>Menampilkan ${paginatedProducts.length} dari ${filteredProducts.length} SKU (Hal ${state.catalogPage}/${totalCatalogPages})</div>
            <div class="flex items-center gap-1">
              <button id="btn-catalog-prev" type="button" class="btn btn-sm btn-outline ${state.catalogPage <= 1 ? 'opacity-40' : ''}">Sebelumnya</button>
              ${Array.from({ length: totalCatalogPages }, function (_, idx) {
                var pNum = idx + 1;
                var active = pNum === state.catalogPage;
                return `<button type="button" class="btn-catalog-page btn btn-sm ${active ? 'btn-primary' : 'btn-outline'}" data-page="${pNum}">${pNum}</button>`;
              }).join('')}
              <button id="btn-catalog-next" type="button" class="btn btn-sm btn-outline ${state.catalogPage >= totalCatalogPages ? 'opacity-40' : ''}">Berikutnya</button>
            </div>
          </div>
        </section>

        <!-- Barang Bawaan Sales -->
        <section class="section-card flex flex-col gap-4">
          <div class="section-header">
            <h2 class="section-title">Barang Bawaan Sales</h2>
            <button id="btn-new-sales-load" type="button" class="btn btn-primary btn-sm">
              <span class="material-symbols-outlined text-[16px]">local_shipping</span>
              <span>Catat Pengambilan</span>
            </button>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            ${salesLoadings.map(function (ld) {
              var hasDiscrepancy = ld.status === 'SELISIH_AUDIT' || (ld.items || []).some(function (i) { return i.discrepancy > 0; });
              var isKlop = ld.status === 'TERVERIFIKASI_KLOP' && !hasDiscrepancy;
              var badgeClass = hasDiscrepancy ? 'badge-danger' : (isKlop ? 'badge-success' : 'badge-warning');
              var badgeLabel = hasDiscrepancy ? 'Selisih' : (isKlop ? 'Klop' : 'Keliling');

              return `
                <div class="p-4 rounded-xl border border-border-subtle bg-surface-container-low/50 flex flex-col justify-between gap-3">
                  <div>
                    <div class="flex items-center justify-between gap-2 mb-2">
                      <div>
                        <div class="font-bold text-sm text-on-surface">${window.ArbaUtils.escapeHtml(ld.salesRep)}</div>
                        <div class="text-[11px] text-on-surface-variant">${window.ArbaUtils.escapeHtml(ld.division)} · ${window.ArbaUtils.escapeHtml(ld.routeArea)}</div>
                      </div>
                      <span class="badge badge-round ${badgeClass}">${badgeLabel}</span>
                    </div>

                    ${ld.auditNote ? `
                      <div class="p-2 rounded-lg text-[11px] font-semibold mb-2 bg-status-danger-bg text-status-danger-text">
                        ${window.ArbaUtils.escapeHtml(ld.auditNote)}
                      </div>
                    ` : ''}

                    <div class="bg-surface-container-lowest rounded-lg p-2.5 space-y-1.5 border border-border-subtle/60 text-xs">
                      <div class="grid grid-cols-12 text-[10px] font-bold text-on-surface-variant uppercase pb-1 border-b border-border-subtle">
                        <span class="col-span-5">Produk</span>
                        <span class="col-span-2 text-center">Ambil</span>
                        <span class="col-span-2 text-center">Drop</span>
                        <span class="col-span-3 text-right">Sisa</span>
                      </div>
                      ${(ld.items || []).map(function (it) {
                        return `
                          <div class="grid grid-cols-12 items-center text-[11px] text-on-surface">
                            <span class="col-span-5 font-medium truncate" title="${window.ArbaUtils.escapeHtml(it.name)}">${window.ArbaUtils.escapeHtml(it.name)}</span>
                            <span class="col-span-2 text-center font-mono font-semibold">${it.loadedQty}</span>
                            <span class="col-span-2 text-center font-mono text-emerald-700 font-semibold">${it.droppedQty}</span>
                            <span class="col-span-3 text-right font-mono font-bold ${it.discrepancy > 0 ? 'text-rose-600' : 'text-on-surface'}">
                              ${it.returnedQty}${it.discrepancy > 0 ? ' (-' + it.discrepancy + ')' : ''}
                            </span>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  </div>

                  <div class="flex items-center justify-between pt-1 text-xs">
                    <span class="text-on-surface-variant">Setoran: <b class="text-on-surface">${window.ArbaUtils.formatRupiah(ld.cashCollected)}</b></span>
                    <button type="button" class="btn-reconcile-load btn btn-sm btn-primary" data-load-id="${ld.id}">
                      Verifikasi
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </section>

        <!-- Buku Besar Mutasi Stok -->
        <section class="section-card flex flex-col gap-4">
          <div class="section-header">
            <h2 class="section-title">Buku Besar Mutasi Stok</h2>
            <div class="flex flex-wrap items-center gap-1.5">
              ${['ALL', 'MASUK', 'KELUAR', 'PENYESUAIAN', 'RETUR'].map(function (filter) {
                var isActive = state.activeLedgerFilter === filter;
                var label = filter === 'ALL' ? 'Semua' : filter;
                return `
                  <button
                    class="btn-ledger-filter btn btn-sm ${isActive ? 'btn-primary' : 'btn-outline'}"
                    data-filter="${filter}"
                    type="button"
                  >
                    ${label}
                  </button>
                `;
              }).join('')}
            </div>
          </div>

          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ID &amp; Waktu</th>
                  <th>Referensi</th>
                  <th>Produk &amp; Batch</th>
                  <th class="text-center">Tipe</th>
                  <th class="text-right">Qty</th>
                  <th class="text-right">Saldo Akhir</th>
                  <th>Petugas</th>
                  <th>Checksum</th>
                </tr>
              </thead>
              <tbody>
                ${filteredLedger.map(function (entry) {
                  var badgeClass = 'badge-success';
                  var qtyClass = 'text-emerald-700 font-bold';
                  if (entry.type === 'KELUAR') {
                    badgeClass = 'badge-danger';
                    qtyClass = 'text-rose-600 font-bold';
                  } else if (entry.type === 'PENYESUAIAN') {
                    badgeClass = 'badge-warning';
                    qtyClass = 'text-amber-700 font-bold';
                  } else if (entry.type === 'RETUR') {
                    badgeClass = 'badge-neutral';
                    qtyClass = 'text-primary font-bold';
                  }

                  return `
                    <tr>
                      <td>
                        <div class="font-mono font-bold text-on-surface">${window.ArbaUtils.escapeHtml(entry.id)}</div>
                        <div class="text-[11px] text-on-surface-variant">${window.ArbaUtils.escapeHtml(entry.timestamp)}</div>
                      </td>
                      <td class="font-mono text-secondary font-medium">${window.ArbaUtils.escapeHtml(entry.docRef)}</td>
                      <td>
                        <div class="font-semibold text-on-surface">${window.ArbaUtils.escapeHtml(entry.skuName)}</div>
                        <div class="font-mono text-[11px] text-on-surface-variant">${window.ArbaUtils.escapeHtml(entry.batch)}</div>
                      </td>
                      <td class="text-center"><span class="badge ${badgeClass}">${window.ArbaUtils.escapeHtml(entry.type)}</span></td>
                      <td class="text-right font-mono ${qtyClass}">${entry.quantity > 0 ? '+' + entry.quantity : entry.quantity}</td>
                      <td class="text-right font-mono font-bold text-on-surface">${window.ArbaUtils.formatNumber(entry.finalStock)}</td>
                      <td>
                        <div class="font-semibold text-on-surface">${window.ArbaUtils.escapeHtml(entry.operator)}</div>
                        <div class="text-[11px] text-on-surface-variant">${window.ArbaUtils.escapeHtml(entry.operatorRole)}</div>
                      </td>
                      <td class="font-mono text-[11px] text-on-surface-variant">${window.ArbaUtils.escapeHtml(entry.hash)}</td>
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
    var btnInbound = container.querySelector('#btn-inbound-batch');
    if (btnInbound) btnInbound.addEventListener('click', openInboundModal);

    var btnAdjust = container.querySelector('#btn-adjust-opname');
    if (btnAdjust) btnAdjust.addEventListener('click', openAdjustModal);

    var btnPoList = container.querySelector('#btn-supplier-po-list');
    if (btnPoList) btnPoList.addEventListener('click', openPoListModal);

    var btnImportCsv = container.querySelector('#btn-import-ledger-csv');
    if (btnImportCsv) btnImportCsv.addEventListener('click', openImportProductsModal);

    var btnCsv = container.querySelector('#btn-export-ledger-csv');
    if (btnCsv) {
      btnCsv.addEventListener('click', function () {
        window.ArbaUtils.exportStockLedgerToCsv(window.ArbaStore.getState().ledger);
        window.ArbaApp.showToast('Mutasi Stock Ledger (.CSV) diunduh', 'table_chart');
      });
    }

    var btnPrint = container.querySelector('#btn-print-opname');
    if (btnPrint) btnPrint.addEventListener('click', openPrintModal);

    var btnQrBatch = container.querySelector('#btn-qr-batch-modal');
    if (btnQrBatch && window.ArbaAdvanced) {
      btnQrBatch.addEventListener('click', function () {
        window.ArbaAdvanced.openQrBatchModal({ initialTab: 'labels' });
      });
    }

    var btnChainAudit = container.querySelector('#btn-chain-audit-modal');
    if (btnChainAudit && window.ArbaAdvanced) {
      btnChainAudit.addEventListener('click', function () {
        window.ArbaAdvanced.openLedgerChainAuditModal();
      });
    }

    var catSearch = container.querySelector('#catalog-search');
    if (catSearch) {
      catSearch.addEventListener('input', function (e) {
        state.searchQuery = e.target.value;
        state.catalogPage = 1;
        renderInventoryLedger(container);
        var inputNow = container.querySelector('#catalog-search');
        if (inputNow) {
          inputNow.focus();
          inputNow.setSelectionRange(inputNow.value.length, inputNow.value.length);
        }
      });
    }

    var catSelect = container.querySelector('#catalog-category-select');
    if (catSelect) {
      catSelect.addEventListener('change', function (e) {
        state.selectedCategory = e.target.value;
        state.catalogPage = 1;
        renderInventoryLedger(container);
      });
    }

    var ropSelect = container.querySelector('#catalog-rop-select');
    if (ropSelect) {
      ropSelect.addEventListener('change', function (e) {
        state.selectedRopStatus = e.target.value;
        state.catalogPage = 1;
        renderInventoryLedger(container);
      });
    }

    container.querySelectorAll('.btn-trigger-po').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sku = btn.getAttribute('data-sku');
        var prod = window.ArbaStore.getState().products.find(function (p) { return p.sku === sku; });
        if (prod) openCreatePoModal(prod);
      });
    });

    container.querySelectorAll('.btn-ledger-filter').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.activeLedgerFilter = btn.getAttribute('data-filter');
        renderInventoryLedger(container);
      });
    });

    var btnNewLoad = container.querySelector('#btn-new-sales-load');
    if (btnNewLoad) btnNewLoad.addEventListener('click', openSalesLoadingModal);

    container.querySelectorAll('.btn-reconcile-load').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openReconcileLoadingModal(btn.getAttribute('data-load-id'));
      });
    });

    var catPrev = container.querySelector('#btn-catalog-prev');
    var catNext = container.querySelector('#btn-catalog-next');
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
    container.querySelectorAll('.btn-catalog-page').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.catalogPage = Number(btn.getAttribute('data-page')) || 1;
        renderInventoryLedger(container);
      });
    });
  }

  function openReconcileLoadingModal(loadId) {
    var appState = window.ArbaStore.getState();
    var loadRec = (appState.salesLoadings || []).find(function (l) { return l.id === loadId; });
    if (!loadRec) return;

    var modalHtml = `
      <div class="modal-dialog max-w-xl">
        <div class="modal-header">
          <div>
            <h3 class="modal-title">Verifikasi Barang Bawaan Sales</h3>
            <p class="text-xs text-on-surface-variant">${window.ArbaUtils.escapeHtml(loadRec.salesRep)} · ${window.ArbaUtils.escapeHtml(loadRec.id)}</p>
          </div>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()" type="button">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form id="form-reconcile-loading">
          <div class="modal-body text-xs space-y-3">
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th class="text-center">Ambil</th>
                    <th class="text-center">Drop</th>
                    <th class="text-center">Wajib Kembali</th>
                    <th class="text-center">Fisik Kembali</th>
                  </tr>
                </thead>
                <tbody>
                  ${loadRec.items.map(function (it) {
                    var expected = Math.max(0, it.loadedQty - it.droppedQty);
                    return `
                      <tr>
                        <td>
                          <div class="font-semibold text-on-surface">${window.ArbaUtils.escapeHtml(it.name)}</div>
                          <div class="text-[10px] font-mono text-on-surface-variant">${window.ArbaUtils.escapeHtml(it.sku)}</div>
                        </td>
                        <td class="text-center font-mono font-bold">${it.loadedQty}</td>
                        <td class="text-center font-mono font-bold text-primary">${it.droppedQty}</td>
                        <td class="text-center font-mono font-bold text-emerald-700">${expected}</td>
                        <td class="text-center">
                          <input
                            type="number"
                            class="reconcile-return-input w-20 p-1.5 rounded border border-border-subtle text-center font-mono font-bold text-on-surface bg-surface"
                            data-sku="${it.sku}"
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
            <button type="button" id="btn-reconcile-auto-klop" class="btn btn-secondary">Sesuaikan Semua</button>
            <div class="flex items-center gap-2">
              <button type="button" class="btn btn-outline" onclick="window.ArbaApp.closeModal()">Batal</button>
              <button type="submit" class="btn btn-primary">Simpan</button>
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
          map[inp.getAttribute('data-sku')] = Number(inp.value) || 0;
        });
        window.ArbaStore.reconcileSalesLoading(loadId, map);
        window.ArbaApp.closeModal();
      };
    }
  }

  function openSalesLoadingModal() {
    var appState = window.ArbaStore.getState();
    var salesTeam = appState.salesTeam || [];
    var products = appState.products || [];

    var modalHtml = `
      <div class="modal-dialog max-w-lg">
        <div class="modal-header">
          <h3 class="modal-title">Catat Pengambilan Barang Sales</h3>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()" type="button">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div class="modal-body text-xs space-y-3">
          <div class="form-group">
            <label class="form-label">Sales Rep</label>
            <select id="load-sales-select" class="form-select">
              ${salesTeam.map(function (s) {
                return `<option value="${s.name}">${s.name} (${s.area})</option>`;
              }).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Produk</label>
            <select id="load-sku-select" class="form-select">
              ${products.map(function (p) {
                return `<option value="${p.sku}">${p.name} (Stok: ${p.stock})</option>`;
              }).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Jumlah (Unit)</label>
            <input type="number" id="load-qty-input" value="15" min="1" max="500" class="form-input font-mono font-bold" />
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="window.ArbaApp.closeModal()">Batal</button>
          <button type="button" id="btn-save-sales-load" class="btn btn-primary">Simpan</button>
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

  function openImportProductsModal() {
    var sampleCsv = [
      'sku,nama_produk,kategori,stok,safety_stock,rop,harga_satuan,batch_aktif,tanggal_ed',
      'SKU-ARB-KLM250,Madu Klanceng Asli Lawu 250g,Madu Herbal,260,60,110,92000,BATCH-2026-051,22 Nov 2027',
      'SKU-ARB-SRB100,Serbuk Jahe Merah Instan 100g,Serbuk,380,80,145,35000,BATCH-2026-060,10 Des 2027'
    ].join('\n');

    var modalHtml = `
      <div class="modal-dialog max-w-2xl">
        <div class="modal-header">
          <h3 class="modal-title">Impor Produk (.CSV)</h3>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()" type="button">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div class="modal-body text-xs space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2 bg-surface-container-low p-3 rounded-lg border border-border-subtle/50">
            <code class="font-mono text-primary text-[11px]">sku, nama_produk, kategori, stok, safety_stock, rop, harga_satuan, batch_aktif, tanggal_ed</code>
            <button type="button" id="btn-download-prod-template" class="btn btn-sm btn-outline">Unduh Template</button>
          </div>
          <div class="form-group">
            <label class="form-label">Berkas CSV</label>
            <input type="file" id="input-prod-csv-file" accept=".csv,text/csv" class="form-input" />
          </div>
          <div class="form-group">
            <label class="form-label">Data CSV</label>
            <textarea id="textarea-prod-csv" rows="5" class="form-textarea font-mono text-[11px]">${sampleCsv}</textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="window.ArbaApp.closeModal()">Batal</button>
          <button type="button" id="btn-exec-prod-import" class="btn btn-primary">Impor</button>
        </div>
      </div>
    `;

    window.ArbaApp.openModal(modalHtml);

    setTimeout(function () {
      var btnDl = document.getElementById('btn-download-prod-template');
      var fileInput = document.getElementById('input-prod-csv-file');
      var txtArea = document.getElementById('textarea-prod-csv');
      var btnExec = document.getElementById('btn-exec-prod-import');

      if (btnDl) btnDl.onclick = function () { window.ArbaUtils.downloadCsv('Template_Produk_ArbaConnect.csv', sampleCsv); };
      if (fileInput && txtArea) {
        fileInput.onchange = function (e) {
          var f = e.target.files && e.target.files[0];
          if (!f) return;
          var reader = new FileReader();
          reader.onload = function (ev) { txtArea.value = String(ev.target.result || ''); };
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

  function openInboundModal() {
    var products = window.ArbaStore.getState().products;
    var nextBatch = 'BATCH-2026-0' + Math.floor(50 + Math.random() * 40);

    var modalHtml = `
      <div class="modal-dialog max-w-lg">
        <div class="modal-header">
          <h3 class="modal-title">Catat Barang Masuk</h3>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()" type="button">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form id="form-inbound-batch">
          <div class="modal-body text-xs">
            <div class="form-group">
              <label class="form-label">Produk SKU</label>
              <select id="inbound-sku" class="form-select">
                ${products.map(function (p) {
                  return `<option value="${p.sku}">${p.name} (${p.sku})</option>`;
                }).join('')}
              </select>
            </div>
            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Nomor Batch</label>
                <input id="inbound-batch" value="${nextBatch}" required type="text" class="form-input font-mono" />
              </div>
              <div class="form-group">
                <label class="form-label">Kuantitas (Unit)</label>
                <input id="inbound-qty" value="250" min="1" required type="number" class="form-input font-mono font-bold" />
              </div>
            </div>
            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Tanggal Kedaluwarsa</label>
                <input id="inbound-exp" value="2028-02-28" required type="date" class="form-input" />
              </div>
              <div class="form-group">
                <label class="form-label">Referensi PO</label>
                <input id="inbound-ref" value="PO-2026-092" required type="text" class="form-input font-mono" />
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button onclick="window.ArbaApp.closeModal()" class="btn btn-outline" type="button">Batal</button>
            <button type="submit" class="btn btn-primary">Simpan</button>
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
          window.ArbaStore.addInboundBatch({
            sku: document.getElementById('inbound-sku').value,
            batch: document.getElementById('inbound-batch').value,
            qty: Number(document.getElementById('inbound-qty').value),
            expiryDate: document.getElementById('inbound-exp').value,
            docRef: document.getElementById('inbound-ref').value
          });
          window.ArbaApp.closeModal();
        };
      }
    }, 50);
  }

  function openAdjustModal() {
    var products = window.ArbaStore.getState().products;

    var modalHtml = `
      <div class="modal-dialog max-w-lg">
        <div class="modal-header">
          <h3 class="modal-title">Koreksi Stok Opname</h3>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()" type="button">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form id="form-adjust-opname">
          <div class="modal-body text-xs">
            <div class="form-group">
              <label class="form-label">Produk SKU</label>
              <select id="adj-sku" class="form-select">
                ${products.map(function (p) {
                  return `<option value="${p.sku}">${p.name} (Stok: ${p.stock})</option>`;
                }).join('')}
              </select>
            </div>
            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Batch</label>
                <input id="adj-batch" value="${products[0] ? products[0].activeBatch : ''}" required type="text" class="form-input font-mono" />
              </div>
              <div class="form-group">
                <label class="form-label">Selisih (+ / - Unit)</label>
                <input id="adj-delta" value="5" required type="number" class="form-input font-mono font-bold" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Alasan</label>
              <select id="adj-reason" class="form-select">
                <option value="Selisih fisik opname berkala gudang">Selisih fisik opname berkala</option>
                <option value="Kerusakan kemasan saat transit">Kerusakan kemasan saat transit</option>
                <option value="Pengambilan sampel uji QC">Pengambilan sampel uji QC</option>
                <option value="Koreksi input batch">Koreksi input batch</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Petugas / Auditor</label>
              <input id="adj-auditor" value="${window.ArbaUtils.escapeHtml((window.ArbaStore.getState().currentUser && window.ArbaStore.getState().currentUser.name) || 'Admin Gudang')}" required type="text" class="form-input" />
            </div>
          </div>

          <div class="modal-footer">
            <button onclick="window.ArbaApp.closeModal()" class="btn btn-outline" type="button">Batal</button>
            <button type="submit" class="btn btn-primary">Simpan</button>
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
          if (p) document.getElementById('adj-batch').value = p.activeBatch;
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

  function openPoListModal() {
    var supplierPOs = window.ArbaStore.getState().supplierPOs;

    var modalHtml = `
      <div class="modal-dialog max-w-2xl">
        <div class="modal-header">
          <h3 class="modal-title">Daftar PO Supplier</h3>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()" type="button">
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
                      <span class="badge ${po.status === 'DITERIMA' ? 'badge-success' : 'badge-warning'}">${window.ArbaUtils.escapeHtml(po.status)}</span>
                    </div>
                    <div class="font-semibold text-on-surface mt-0.5">${window.ArbaUtils.escapeHtml(po.productName)}</div>
                    <div class="text-on-surface-variant">${window.ArbaUtils.escapeHtml(po.vendorName)} · Est: ${window.ArbaUtils.escapeHtml(po.expectedDate)}</div>
                  </div>
                  <div class="text-right">
                    <div class="font-bold text-sm text-on-surface">${po.quantity} Unit</div>
                    <div class="text-on-surface-variant font-mono">${window.ArbaUtils.formatRupiah(po.totalCost)}</div>
                    ${po.status === 'DITERIMA' ? `
                      <span class="badge badge-success mt-1">Diterima</span>
                    ` : `
                      <button
                        class="btn-receive-po btn btn-sm btn-primary mt-1"
                        data-po-id="${po.id}"
                        data-po-sku="${po.sku}"
                        data-po-qty="${po.quantity}"
                        type="button"
                      >
                        Terima Barang
                      </button>
                    `}
                  </div>
                </div>
              `;
            }).join('')}
            ${supplierPOs.length === 0 ? `<div class="p-8 text-center text-on-surface-variant">Tidak ada PO supplier.</div>` : ''}
          </div>
        </div>

        <div class="modal-footer">
          <button onclick="window.ArbaApp.closeModal()" class="btn btn-outline" type="button">Tutup</button>
        </div>
      </div>
    `;

    window.ArbaApp.openModal(modalHtml);

    setTimeout(function () {
      document.querySelectorAll('.btn-receive-po').forEach(function (btn) {
        btn.onclick = function () {
          var poId = btn.getAttribute('data-po-id');
          window.ArbaStore.addInboundBatch({
            sku: btn.getAttribute('data-po-sku'),
            batch: 'BATCH-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 900),
            qty: Number(btn.getAttribute('data-po-qty')),
            expiryDate: '2028-06-30',
            docRef: poId
          });
          window.ArbaApp.closeModal();
        };
      });
    }, 50);
  }

  function openCreatePoModal(product) {
    var defaultQty = Math.max(100, (product.rop - product.stock) + product.safetyStock);
    var unitPurchaseCost = Math.round(product.unitPrice * 0.65);

    var modalHtml = `
      <div class="modal-dialog max-w-lg">
        <div class="modal-header">
          <h3 class="modal-title">Buat PO Supplier</h3>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()" type="button">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form id="form-create-po">
          <div class="modal-body text-xs">
            <div class="p-3 bg-surface-container-low rounded-lg space-y-1 border border-border-subtle/30">
              <div class="font-bold text-sm text-on-surface">${window.ArbaUtils.escapeHtml(product.name)}</div>
              <div class="text-on-surface-variant font-mono">${window.ArbaUtils.escapeHtml(product.sku)} · Stok: ${product.stock} (ROP: ${product.rop})</div>
            </div>
            <div class="form-group">
              <label class="form-label">Vendor</label>
              <select id="po-vendor" class="form-select">
                <option value="CV Sumber Herbal Barokah Solo">CV Sumber Herbal Barokah Solo</option>
                <option value="Kelompok Tani Lebah Rimba Boyolali">Kelompok Tani Lebah Rimba Boyolali</option>
                <option value="PT Kapsulindo Ekstrak Alami Karanganyar">PT Kapsulindo Ekstrak Alami Karanganyar</option>
                <option value="Importir Minyak Zaitun Al-Barokah Jakarta">Importir Minyak Zaitun Al-Barokah Jakarta</option>
              </select>
            </div>
            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Kuantitas (Unit)</label>
                <input id="po-qty" value="${defaultQty}" min="10" required type="number" class="form-input font-mono font-bold" />
              </div>
              <div class="form-group">
                <label class="form-label">Lead Time</label>
                <select id="po-leadtime" class="form-select">
                  <option value="3">3 Hari</option>
                  <option value="7" selected>7 Hari</option>
                  <option value="14">14 Hari</option>
                </select>
              </div>
            </div>
            <div class="p-2.5 bg-surface-container-low rounded-lg flex items-center justify-between font-semibold border border-border-subtle/30">
              <span class="text-on-surface-variant">Estimasi Nilai PO:</span>
              <span id="po-total-est" class="text-primary font-bold text-sm">${window.ArbaUtils.formatRupiah(defaultQty * unitPurchaseCost)}</span>
            </div>
          </div>

          <div class="modal-footer">
            <button onclick="window.ArbaApp.closeModal()" class="btn btn-outline" type="button">Batal</button>
            <button type="submit" class="btn btn-primary">Kirim PO</button>
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
          estSpan.textContent = window.ArbaUtils.formatRupiah((Number(qtyInput.value) || 0) * unitPurchaseCost);
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

  function openPrintModal() {
    var products = window.ArbaStore.getState().products;
    var totalUnits = products.reduce(function (acc, p) { return acc + p.stock; }, 0);

    var modalHtml = `
      <div class="modal-dialog max-w-2xl">
        <div class="modal-header">
          <h3 class="modal-title">Laporan Opname Stok</h3>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()" type="button">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div class="modal-body">
          <div class="p-4 bg-white rounded-xl border border-slate-200 text-slate-800 space-y-3">
            <div class="flex justify-between items-center border-b pb-2">
              <div>
                <h4 class="font-bold text-lg text-teal-800">CV ARBA'IN SURAKARTA</h4>
                <p class="text-xs text-slate-500">Gudang Utama Kartasura</p>
              </div>
              <div class="text-right text-xs text-slate-500">
                <div>Tanggal: ${new Date().toLocaleDateString('id-ID')}</div>
                <div>${products.length} SKU · ${window.ArbaUtils.formatNumber(totalUnits)} unit</div>
              </div>
            </div>

            <table class="w-full text-xs text-left border-collapse border border-slate-300">
              <thead>
                <tr class="bg-slate-200 text-slate-800">
                  <th class="border border-slate-300 p-1.5">SKU</th>
                  <th class="border border-slate-300 p-1.5">Nama Produk</th>
                  <th class="border border-slate-300 p-1.5 text-right">Stok</th>
                  <th class="border border-slate-300 p-1.5 text-right">ROP</th>
                  <th class="border border-slate-300 p-1.5">Batch</th>
                  <th class="border border-slate-300 p-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                ${products.map(function (p) {
                  return `
                    <tr>
                      <td class="border border-slate-300 p-1.5 font-mono">${window.ArbaUtils.escapeHtml(p.sku)}</td>
                      <td class="border border-slate-300 p-1.5">${window.ArbaUtils.escapeHtml(p.name)}</td>
                      <td class="border border-slate-300 p-1.5 text-right font-bold">${p.stock}</td>
                      <td class="border border-slate-300 p-1.5 text-right">${p.rop}</td>
                      <td class="border border-slate-300 p-1.5 font-mono">${window.ArbaUtils.escapeHtml(p.activeBatch)}</td>
                      <td class="border border-slate-300 p-1.5">${p.stock > p.rop ? 'Aman' : 'Perlu PO'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="modal-footer">
          <button onclick="window.ArbaApp.closeModal()" class="btn btn-outline" type="button">Tutup</button>
          <button onclick="window.print(); window.ArbaApp.closeModal();" class="btn btn-primary" type="button">
            <span class="material-symbols-outlined text-[18px]">print</span>
            <span>Cetak</span>
          </button>
        </div>
      </div>
    `;

    window.ArbaApp.openModal(modalHtml);
  }

  window.ArbaViews.renderInventoryLedger = renderInventoryLedger;
})();
