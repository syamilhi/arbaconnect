/**
 * ArbaConnect ERP - Executive Dashboard View
 */

(function () {
  'use strict';

  window.ArbaViews = window.ArbaViews || {};

  var state = {
    streamFilter: 'ALL',
    streamSearch: '',
    streamPage: 1,
    streamPageSize: 5
  };

  function renderExecutiveDashboard(container) {
    var appState = window.ArbaStore.getState();
    var orders = appState.orders || [];
    var analytics = window.ArbaStore.getAnalytics();

    var filteredOrders = orders.filter(function (order) {
      var q = state.streamSearch.toLowerCase();
      var matchesSearch =
        !q ||
        order.outletName.toLowerCase().indexOf(q) !== -1 ||
        order.clientUuid.toLowerCase().indexOf(q) !== -1 ||
        order.city.toLowerCase().indexOf(q) !== -1;

      var matchesStatus =
        state.streamFilter === 'ALL' ||
        (state.streamFilter === 'SYNCED' && order.syncStatus === 'SYNCED_DEDUCTED') ||
        (state.streamFilter === 'PENDING' && order.syncStatus === 'PENDING_WAREHOUSE');

      return matchesSearch && matchesStatus;
    });

    var totalStreamPages = Math.max(1, Math.ceil(filteredOrders.length / state.streamPageSize));
    if (state.streamPage > totalStreamPages) state.streamPage = totalStreamPages;
    var paginatedStreamOrders = filteredOrders.slice(
      (state.streamPage - 1) * state.streamPageSize,
      state.streamPage * state.streamPageSize
    );

    var html = `
      <div class="flex flex-col w-full gap-space-lg pb-space-xl">
        <!-- Page Header -->
        <div class="page-header">
          <div>
            <h1 class="page-title">Dasbor Eksekutif</h1>
            <p class="page-meta">Ringkasan operasional distribusi Solo Raya</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button id="btn-export-excel" class="btn btn-outline" type="button">
              <span class="material-symbols-outlined text-[16px]">table_chart</span>
              <span>Ekspor CSV</span>
            </button>
            <button id="btn-download-pdf" class="btn btn-primary" type="button">
              <span class="material-symbols-outlined text-[16px]">print</span>
              <span>Cetak Laporan</span>
            </button>
          </div>
        </div>

        <!-- KPI Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <!-- Omset Bulanan -->
          <div class="kpi-card">
            <div>
              <div class="kpi-header">
                <span class="kpi-title">Omset Bulan Ini</span>
                <span class="badge badge-primary">${analytics.revenuePct}%</span>
              </div>
              <div class="kpi-value">${window.ArbaUtils.formatRupiah(analytics.revenueMonth)}</div>
              <div class="kpi-subtext mt-1">Target: ${window.ArbaUtils.formatRupiah(analytics.revenueTarget)}</div>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: ${Math.min(100, analytics.revenuePct)}%;"></div>
            </div>
          </div>

          <!-- Mitra Outlet -->
          <div class="kpi-card">
            <div>
              <div class="kpi-header">
                <span class="kpi-title">Mitra Outlet</span>
                <span class="text-xs font-semibold text-primary">+${analytics.newOutlets} Baru</span>
              </div>
              <div class="kpi-value">${window.ArbaUtils.formatNumber(analytics.totalOutlets)}</div>
              <div class="kpi-subtext mt-1">
                ${analytics.apotekCount} Apotek (${analytics.apotekPct}%) · ${analytics.minimarketCount} Minimarket
              </div>
            </div>
            <div class="w-full flex rounded-full h-1.5 overflow-hidden bg-surface-container-high mt-2">
              <div class="bg-primary h-full" style="width: ${analytics.apotekPct}%;"></div>
              <div class="bg-secondary h-full" style="width: ${100 - analytics.apotekPct}%;"></div>
            </div>
          </div>

          <!-- Kunjungan Sales Hari Ini -->
          <div class="kpi-card">
            <div>
              <div class="kpi-header">
                <span class="kpi-title">Kunjungan Hari Ini</span>
                <span class="badge badge-success">${analytics.visitPct}%</span>
              </div>
              <div class="kpi-value">
                ${analytics.visitsToday} <span class="text-sm font-normal text-on-surface-variant">/ ${analytics.visitTargetToday}</span>
              </div>
              <div class="kpi-subtext mt-1">
                EC: ${analytics.effectiveCallRate}% · ${analytics.activeReps}/${analytics.totalReps} Sales aktif
              </div>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: ${Math.min(100, analytics.visitPct)}%; background-color: #059669;"></div>
            </div>
          </div>

          <!-- SKU Perlu Perhatian -->
          <div class="kpi-card">
            <div>
              <div class="kpi-header">
                <span class="kpi-title">Stok &amp; Kedaluwarsa</span>
                <span class="badge ${analytics.criticalSkuCount > 0 ? 'badge-warning' : 'badge-success'}">
                  ${analytics.criticalSkuCount > 0 ? 'Perhatian' : 'Aman'}
                </span>
              </div>
              <div class="kpi-value ${analytics.criticalSkuCount > 0 ? 'text-rose-600' : 'text-emerald-600'}">
                ${analytics.criticalSkuCount} <span class="text-sm font-normal text-on-surface-variant">SKU</span>
              </div>
              <div class="kpi-subtext mt-1">
                ${analytics.belowRop.length} di bawah ROP · ${analytics.nearExpiry.length} mendekati ED
              </div>
            </div>
            <button
              id="btn-goto-inventory"
              class="mt-2 flex items-center justify-between bg-surface-container-low px-2.5 py-1.5 rounded-lg text-left hover:bg-surface-container transition-colors cursor-pointer border border-border-subtle/50"
              type="button"
            >
              <span class="text-xs text-on-surface font-medium truncate">
                ${analytics.belowRop[0] ? 'Prioritas: ' + analytics.belowRop[0].name : 'Lihat Stok Gudang'}
              </span>
              <span class="material-symbols-outlined text-primary text-[16px]">chevron_right</span>
            </button>
          </div>
        </div>

        <!-- Alerts: Stok Menipis & Mendekati Kedaluwarsa -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div class="section-card flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <h2 class="section-title">Stok Menipis (ROP)</h2>
              <span class="badge badge-warning">${analytics.orangeStockAlarms.length} SKU</span>
            </div>
            <div class="space-y-2 max-h-56 overflow-y-auto pr-1">
              ${analytics.orangeStockAlarms.length === 0 ? `
                <div class="p-4 text-center text-xs text-on-surface-variant bg-surface-container-low rounded-lg">
                  Seluruh stok produk di atas batas ROP.
                </div>
              ` : analytics.orangeStockAlarms.map(function (al) {
                return `
                  <div class="p-2.5 rounded-lg bg-surface-container-low flex items-center justify-between gap-2 border border-border-subtle/50">
                    <div class="min-w-0">
                      <div class="font-semibold text-xs text-on-surface truncate">${window.ArbaUtils.escapeHtml(al.name)}</div>
                      <div class="text-[11px] text-on-surface-variant">
                        Sisa: <b class="text-amber-700">${al.stock}</b> · ROP: <b>${al.rop}</b> (Kurang ${al.shortage})
                      </div>
                    </div>
                    <button
                      type="button"
                      class="btn-orange-alarm-restock btn btn-sm btn-outline shrink-0"
                      data-sku="${window.ArbaUtils.escapeHtml(al.sku)}"
                      data-name="${window.ArbaUtils.escapeHtml(al.name)}"
                    >
                      Restock
                    </button>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <div class="section-card flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <h2 class="section-title">Mendekati Kedaluwarsa (FEFO)</h2>
              <span class="badge badge-danger">${analytics.pinkExpiryAlarms.length} Titik</span>
            </div>
            <div class="space-y-2 max-h-56 overflow-y-auto pr-1">
              ${analytics.pinkExpiryAlarms.length === 0 ? `
                <div class="p-4 text-center text-xs text-on-surface-variant bg-surface-container-low rounded-lg">
                  Tidak ada batch mendekati kedaluwarsa.
                </div>
              ` : analytics.pinkExpiryAlarms.slice(0, 6).map(function (pk) {
                var isApotek = pk.locationType === 'APOTEK_MITRA';
                return `
                  <div class="p-2.5 rounded-lg bg-surface-container-low flex items-center justify-between gap-2 border border-border-subtle/50">
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span class="badge ${isApotek ? 'badge-warning' : 'badge-danger'} text-[10px]">
                          ${isApotek ? 'Apotek' : 'Gudang'}
                        </span>
                        <span class="font-semibold text-xs text-on-surface truncate">${window.ArbaUtils.escapeHtml(pk.locationName)}</span>
                      </div>
                      <div class="text-[11px] text-on-surface-variant mt-0.5 truncate">
                        ${window.ArbaUtils.escapeHtml(pk.productName)} (${window.ArbaUtils.escapeHtml(pk.batch)}) · ED: <b class="text-rose-600">${window.ArbaUtils.escapeHtml(pk.expiry)}</b> · ${pk.qty} unit
                      </div>
                    </div>
                    <button
                      type="button"
                      class="btn-pink-alarm-notify btn btn-sm btn-outline shrink-0"
                      data-location="${window.ArbaUtils.escapeHtml(pk.locationName)}"
                      data-product="${window.ArbaUtils.escapeHtml(pk.productName)}"
                      data-batch="${window.ArbaUtils.escapeHtml(pk.batch)}"
                      data-sales="${window.ArbaUtils.escapeHtml(pk.salesRep)}"
                    >
                      Instruksikan
                    </button>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- Performa Tim Sales & Ketahanan Stok -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div class="lg:col-span-7 section-card flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <h2 class="section-title">Performa Tim Sales</h2>
              <span class="badge badge-neutral">Effective Call: ${analytics.effectiveCallRate}%</span>
            </div>
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Sales Rep</th>
                    <th class="text-center">Kunjungan</th>
                    <th class="text-center">Order</th>
                    <th class="text-right">Realisasi Bulan Ini</th>
                    <th class="text-right">Capaian</th>
                  </tr>
                </thead>
                <tbody>
                  ${analytics.salesPerformance.map(function (rep) {
                    var badgeClass = rep.revenuePct >= 85
                      ? 'badge-success'
                      : (rep.revenuePct >= 70 ? 'badge-warning' : 'badge-danger');
                    return `
                      <tr>
                        <td>
                          <div class="font-semibold text-on-surface">${window.ArbaUtils.escapeHtml(rep.name)}</div>
                          <div class="text-[11px] text-on-surface-variant">${window.ArbaUtils.escapeHtml(rep.area)}</div>
                        </td>
                        <td class="text-center font-mono">${rep.visitsToday} / ${rep.dailyVisitTarget}</td>
                        <td class="text-center">
                          <span class="font-semibold text-primary">${rep.ordersToday}</span>
                          <span class="text-[11px] text-on-surface-variant">(${rep.effectiveCallRate}%)</span>
                        </td>
                        <td class="text-right font-mono">
                          <div class="font-semibold text-on-surface">${window.ArbaUtils.formatRupiah(rep.revenueMonth)}</div>
                          <div class="text-[10px] text-on-surface-variant">Target: ${window.ArbaUtils.formatRupiah(rep.monthlyRevenueTarget)}</div>
                        </td>
                        <td class="text-right">
                          <span class="badge ${badgeClass}">${rep.revenuePct}%</span>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div class="lg:col-span-5 section-card flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <h2 class="section-title">Ketahanan Stok</h2>
              <span class="text-xs text-on-surface-variant">Days of Cover</span>
            </div>
            <div class="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              ${analytics.stockTurnover.map(function (st) {
                var isCritical = st.belowRop;
                var barWidth = Math.min(100, Math.round((st.daysOfCover / 60) * 100));
                return `
                  <div class="p-2.5 rounded-lg bg-surface-container-low border border-border-subtle/40">
                    <div class="flex items-center justify-between text-xs mb-1">
                      <span class="font-semibold text-on-surface truncate max-w-[200px]">${window.ArbaUtils.escapeHtml(st.name)}</span>
                      <span class="font-mono font-bold ${isCritical ? 'text-rose-600' : 'text-primary'}">
                        ${st.stock} unit · ~${st.daysOfCover} hari
                      </span>
                    </div>
                    <div class="w-full bg-surface-container-high rounded-full h-1.5 overflow-hidden mb-1">
                      <div class="${isCritical ? 'bg-rose-600' : 'bg-primary'} h-full rounded-full" style="width:${barWidth}%;"></div>
                    </div>
                    <div class="flex items-center justify-between text-[11px] text-on-surface-variant">
                      <span>Permintaan: ${st.dailyDemand}/hari (ROP ${st.rop})</span>
                      <span>ITR: <b>${st.turnoverRatio}x</b></span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- Proyeksi Produksi & Stok Konsinyasi Mengendap -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div class="lg:col-span-7 section-card flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <h2 class="section-title">Proyeksi Produksi Bulan Depan</h2>
              <span class="text-xs text-on-surface-variant">${analytics.productForecasting.length} SKU</span>
            </div>
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th>Divisi</th>
                    <th class="text-right">Terjual Bulan Ini</th>
                    <th class="text-right">Proyeksi</th>
                    <th class="text-right">Saran Produksi</th>
                  </tr>
                </thead>
                <tbody>
                  ${analytics.productForecasting.map(function (pf) {
                    return `
                      <tr>
                        <td>
                          <div class="font-semibold text-on-surface">${window.ArbaUtils.escapeHtml(pf.name)}</div>
                          <div class="text-[11px] text-on-surface-variant font-mono">${window.ArbaUtils.escapeHtml(pf.sku)}</div>
                        </td>
                        <td><span class="badge badge-neutral">${window.ArbaUtils.escapeHtml(pf.division)}</span></td>
                        <td class="text-right font-mono font-semibold text-primary">${window.ArbaUtils.formatNumber(pf.soldMonth)}</td>
                        <td class="text-right font-mono">${window.ArbaUtils.formatNumber(pf.forecastUnits)}</td>
                        <td class="text-right font-mono font-bold ${pf.productionNeeded > 1000 ? 'text-rose-600' : 'text-emerald-700'}">
                          +${window.ArbaUtils.formatNumber(pf.productionNeeded)}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div class="lg:col-span-5 section-card flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <h2 class="section-title">Stok Konsinyasi Mengendap</h2>
              <button id="btn-exec-open-rebalance" type="button" class="btn btn-sm btn-outline">
                Mutasi Silang (${(window.ArbaStore.getConsignmentRebalanceRecommendations() || []).length})
              </button>
            </div>
            <div class="space-y-2 max-h-72 overflow-y-auto pr-1">
              ${analytics.outletSlowMoving.length === 0 ? `
                <div class="p-4 text-center text-xs text-on-surface-variant bg-surface-container-low rounded-lg">
                  Tidak ada stok konsinyasi yang mengendap.
                </div>
              ` : analytics.outletSlowMoving.slice(0, 6).map(function (sm) {
                return `
                  <div class="p-2.5 rounded-lg bg-surface-container-low border border-border-subtle/50 flex items-center justify-between gap-2 text-xs">
                    <div class="min-w-0">
                      <div class="font-semibold text-on-surface truncate">${window.ArbaUtils.escapeHtml(sm.outletName)} (${window.ArbaUtils.escapeHtml(sm.city)})</div>
                      <div class="text-[11px] text-on-surface-variant truncate">
                        ${window.ArbaUtils.escapeHtml(sm.productName)} · Sisa <b>${sm.remainingQty}</b> (${sm.daysInOutlet} hari)
                      </div>
                    </div>
                    <button
                      type="button"
                      class="btn-slow-moving-rotate btn btn-sm btn-outline shrink-0"
                      data-outlet="${window.ArbaUtils.escapeHtml(sm.outletName)}"
                      data-product="${window.ArbaUtils.escapeHtml(sm.productName)}"
                      data-sales="${window.ArbaUtils.escapeHtml(sm.salesRep)}"
                      data-qty="${sm.remainingQty}"
                    >
                      Rotasi
                    </button>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- Pesanan Terbaru -->
        <div class="section-card flex flex-col gap-4">
          <div class="section-header">
            <h2 class="section-title">Pesanan Terbaru</h2>
            <div class="flex flex-wrap items-center gap-2">
              <div class="flex items-center bg-surface-container-low px-2.5 py-1.5 rounded-lg border border-border-subtle/50">
                <span class="material-symbols-outlined text-on-surface-variant text-[18px] mr-1.5">search</span>
                <input
                  id="input-stream-search"
                  value="${window.ArbaUtils.escapeHtml(state.streamSearch)}"
                  class="bg-transparent text-xs text-on-surface focus:outline-none w-36 sm:w-44 placeholder:text-on-surface-variant border-0"
                  placeholder="Cari faktur / outlet..."
                  type="text"
                />
              </div>
              <div class="flex items-center bg-surface-container-low rounded-lg p-0.5 border border-border-subtle/40">
                <button
                  id="filter-stream-all"
                  class="px-2.5 py-1 rounded text-xs cursor-pointer border-0 ${state.streamFilter === 'ALL' ? 'bg-surface-container-lowest text-primary font-bold shadow-xs' : 'bg-transparent text-on-surface-variant'}"
                  type="button"
                >Semua</button>
                <button
                  id="filter-stream-synced"
                  class="px-2.5 py-1 rounded text-xs cursor-pointer border-0 ${state.streamFilter === 'SYNCED' ? 'bg-surface-container-lowest text-primary font-bold shadow-xs' : 'bg-transparent text-on-surface-variant'}"
                  type="button"
                >Tersinkron</button>
                <button
                  id="filter-stream-pending"
                  class="px-2.5 py-1 rounded text-xs cursor-pointer border-0 ${state.streamFilter === 'PENDING' ? 'bg-surface-container-lowest text-primary font-bold shadow-xs' : 'bg-transparent text-on-surface-variant'}"
                  type="button"
                >Menunggu</button>
              </div>
            </div>
          </div>

          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Faktur</th>
                  <th>Outlet</th>
                  <th>Sales Rep</th>
                  <th>Waktu</th>
                  <th class="text-right">Total</th>
                  <th>Termin</th>
                  <th>Status</th>
                  <th class="text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                ${paginatedStreamOrders.length === 0 ? `
                  <tr>
                    <td colspan="8" class="text-center text-on-surface-variant py-6">Tidak ada pesanan sesuai filter.</td>
                  </tr>
                ` : paginatedStreamOrders.map(function (order) {
                  var isSynced = order.syncStatus === 'SYNCED_DEDUCTED';
                  return `
                    <tr>
                      <td class="font-mono text-primary font-semibold">${window.ArbaUtils.escapeHtml(order.clientUuid)}</td>
                      <td>
                        <div class="font-semibold text-on-surface">${window.ArbaUtils.escapeHtml(order.outletName)}</div>
                        <div class="text-[11px] text-on-surface-variant">${window.ArbaUtils.escapeHtml(order.city)}</div>
                      </td>
                      <td>${window.ArbaUtils.escapeHtml(order.salesRep)}</td>
                      <td class="text-on-surface-variant">${window.ArbaUtils.escapeHtml(order.orderTime)}</td>
                      <td class="text-right font-mono font-semibold">${window.ArbaUtils.formatRupiah(order.totalAmount)}</td>
                      <td><span class="badge badge-neutral">${window.ArbaUtils.escapeHtml(order.terms)}</span></td>
                      <td>
                        <span class="badge badge-round ${isSynced ? 'badge-success' : 'badge-warning'}">
                          ${isSynced ? 'Tersinkron' : 'Menunggu Gudang'}
                        </span>
                      </td>
                      <td class="text-center">
                        <div class="flex items-center justify-center gap-1">
                          <button class="btn-inspect-order icon-btn" title="Detail Pesanan" data-order-id="${order.id}" type="button">
                            <span class="material-symbols-outlined text-[18px]">visibility</span>
                          </button>
                          <button class="btn-goto-ledger-row icon-btn" title="Buku Besar" type="button">
                            <span class="material-symbols-outlined text-[18px]">receipt_long</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <div class="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-on-surface-variant">
            <span>Menampilkan ${paginatedStreamOrders.length} dari ${filteredOrders.length} pesanan (Hal ${state.streamPage}/${totalStreamPages})</span>
            <div class="flex items-center gap-1">
              <button id="btn-stream-prev" class="btn btn-sm btn-outline ${state.streamPage <= 1 ? 'opacity-40' : ''}" type="button">Sebelumnya</button>
              ${Array.from({ length: totalStreamPages }, function (_, idx) {
                var pNum = idx + 1;
                var active = pNum === state.streamPage;
                return `<button class="btn-stream-page btn btn-sm ${active ? 'btn-primary' : 'btn-outline'}" data-page="${pNum}" type="button">${pNum}</button>`;
              }).join('')}
              <button id="btn-stream-next" class="btn btn-sm btn-outline ${state.streamPage >= totalStreamPages ? 'opacity-40' : ''}" type="button">Berikutnya</button>
            </div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
    bindEvents(container);
  }

  function bindEvents(container) {
    var btnReb = container.querySelector('#btn-exec-open-rebalance');
    if (btnReb && window.ArbaAdvanced) {
      btnReb.addEventListener('click', function () {
        window.ArbaAdvanced.openConsignmentRebalancerModal();
      });
    }

    container.querySelectorAll('.btn-orange-alarm-restock').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var name = btn.getAttribute('data-name');
        window.ArbaApp.navigate('inventory-stock-ledger');
        window.ArbaApp.showToast('Membuka Stok & Gudang untuk restock: ' + name, 'local_mall');
      });
    });

    container.querySelectorAll('.btn-slow-moving-rotate').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (window.ArbaAdvanced && typeof window.ArbaAdvanced.openConsignmentRebalancerModal === 'function') {
          window.ArbaAdvanced.openConsignmentRebalancerModal();
          return;
        }
        var outlet = btn.getAttribute('data-outlet');
        var prod = btn.getAttribute('data-product');
        var sales = btn.getAttribute('data-sales');
        var qty = btn.getAttribute('data-qty');
        window.ArbaStore.scheduleSalesVisit({
          outletId: 'AP-SLO-001',
          outletName: outlet,
          salesRep: sales,
          scheduledDate: 'Besok Pagi',
          purpose: 'Rotasi Stok Konsinyasi',
          notes: 'Tarik ' + qty + ' unit ' + prod
        });
      });
    });

    container.querySelectorAll('.btn-pink-alarm-notify').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var loc = btn.getAttribute('data-location');
        var prod = btn.getAttribute('data-product');
        var batch = btn.getAttribute('data-batch');
        var sales = btn.getAttribute('data-sales');
        window.ArbaApp.showToast(
          'Instruksi FEFO dikirim ke ' + sales + ' (' + loc + '): ' + prod + ' (' + batch + ')',
          'notifications_active'
        );
      });
    });

    var btnExcel = container.querySelector('#btn-export-excel');
    if (btnExcel) {
      btnExcel.addEventListener('click', function () {
        var appState = window.ArbaStore.getState();
        window.ArbaUtils.exportExecutiveReportToCsv(appState.orders, appState.products, appState.outlets);
        window.ArbaApp.showToast('Laporan eksekutif (.CSV) berhasil diunduh', 'table_chart');
      });
    }

    var btnPdf = container.querySelector('#btn-download-pdf');
    if (btnPdf) {
      btnPdf.addEventListener('click', function () {
        openReportModal();
      });
    }

    var btnInventory = container.querySelector('#btn-goto-inventory');
    if (btnInventory) {
      btnInventory.addEventListener('click', function () {
        window.ArbaApp.navigate('inventory-stock-ledger');
      });
    }

    var searchInput = container.querySelector('#input-stream-search');
    if (searchInput) {
      searchInput.addEventListener('input', function (e) {
        state.streamSearch = e.target.value;
        state.streamPage = 1;
        renderExecutiveDashboard(container);
        var inputNow = container.querySelector('#input-stream-search');
        if (inputNow) {
          inputNow.focus();
          inputNow.setSelectionRange(inputNow.value.length, inputNow.value.length);
        }
      });
    }

    var btnAll = container.querySelector('#filter-stream-all');
    var btnSynced = container.querySelector('#filter-stream-synced');
    var btnPending = container.querySelector('#filter-stream-pending');
    if (btnAll) {
      btnAll.addEventListener('click', function () {
        state.streamFilter = 'ALL';
        state.streamPage = 1;
        renderExecutiveDashboard(container);
      });
    }
    if (btnSynced) {
      btnSynced.addEventListener('click', function () {
        state.streamFilter = 'SYNCED';
        state.streamPage = 1;
        renderExecutiveDashboard(container);
      });
    }
    if (btnPending) {
      btnPending.addEventListener('click', function () {
        state.streamFilter = 'PENDING';
        state.streamPage = 1;
        renderExecutiveDashboard(container);
      });
    }

    container.querySelectorAll('.btn-inspect-order').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var orderId = btn.getAttribute('data-order-id');
        var order = window.ArbaStore.getState().orders.find(function (o) { return o.id === orderId; });
        if (order) openDetailModal(order);
      });
    });

    container.querySelectorAll('.btn-goto-ledger-row').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.ArbaApp.navigate('inventory-stock-ledger');
      });
    });

    var prevBtn = container.querySelector('#btn-stream-prev');
    var nextBtn = container.querySelector('#btn-stream-next');
    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        if (state.streamPage > 1) {
          state.streamPage--;
          renderExecutiveDashboard(container);
        }
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        state.streamPage++;
        renderExecutiveDashboard(container);
      });
    }
    container.querySelectorAll('.btn-stream-page').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.streamPage = Number(btn.getAttribute('data-page')) || 1;
        renderExecutiveDashboard(container);
      });
    });
  }

  function openDetailModal(order) {
    var modalHtml = `
      <div class="modal-dialog max-w-xl">
        <div class="modal-header">
          <div>
            <span class="font-mono text-xs text-primary font-semibold">${window.ArbaUtils.escapeHtml(order.clientUuid)}</span>
            <h3 class="modal-title">${window.ArbaUtils.escapeHtml(order.outletName)}</h3>
          </div>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()" type="button">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div class="modal-body">
          <div class="grid grid-cols-2 gap-2 p-3 bg-surface-container-low rounded-lg text-xs">
            <div>
              <span class="text-on-surface-variant">Sales Rep:</span>
              <p class="font-semibold text-on-surface">${window.ArbaUtils.escapeHtml(order.salesRep)} (${window.ArbaUtils.escapeHtml(order.salesRepId)})</p>
            </div>
            <div>
              <span class="text-on-surface-variant">Termin:</span>
              <p class="font-semibold text-on-surface">${window.ArbaUtils.escapeHtml(order.terms)}</p>
            </div>
            <div>
              <span class="text-on-surface-variant">Koordinat:</span>
              <p class="font-mono text-on-surface">${window.ArbaUtils.escapeHtml(order.geofenceCoords)}</p>
            </div>
            <div>
              <span class="text-on-surface-variant">Total Faktur:</span>
              <p class="font-bold text-primary text-sm">${window.ArbaUtils.formatRupiah(order.totalAmount)}</p>
            </div>
          </div>

          <div class="divide-y divide-border-subtle/40 border border-border-subtle/40 rounded-lg overflow-hidden">
            ${order.items.map(function (it) {
              return `
                <div class="p-2.5 flex items-center justify-between text-xs bg-surface-container-lowest">
                  <div>
                    <div class="font-semibold text-on-surface">${window.ArbaUtils.escapeHtml(it.name)}</div>
                    <div class="text-[11px] text-on-surface-variant font-mono">${window.ArbaUtils.escapeHtml(it.batch)}</div>
                  </div>
                  <div class="text-right">
                    <div class="font-bold text-on-surface">${it.quantity} unit</div>
                    <div class="text-[11px] text-on-surface-variant">${window.ArbaUtils.formatRupiah(it.subtotal)}</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="modal-footer">
          <button onclick="window.ArbaApp.closeModal()" class="btn btn-outline" type="button">Tutup</button>
          <button onclick="window.ArbaApp.closeModal(); window.ArbaApp.navigate('order-approval-queue');" class="btn btn-primary" type="button">
            Buka Verifikasi Order
          </button>
        </div>
      </div>
    `;
    window.ArbaApp.openModal(modalHtml);
  }

  function openReportModal() {
    var analytics = window.ArbaStore.getAnalytics();
    var modalHtml = `
      <div class="modal-dialog max-w-2xl">
        <div class="modal-header">
          <h3 class="modal-title">Ringkasan Laporan Eksekutif</h3>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()" type="button">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div class="modal-body">
          <div class="p-4 bg-white rounded-xl border border-slate-200 text-slate-800 space-y-4">
            <div class="flex justify-between items-start border-b pb-3">
              <div>
                <h2 class="text-xl font-bold text-teal-800">CV ARBA'IN SURAKARTA</h2>
                <p class="text-xs text-slate-500">Laporan Distribusi &amp; Stok Solo Raya</p>
              </div>
              <div class="text-right text-xs text-slate-500">
                Dicetak: ${new Date().toLocaleDateString('id-ID')}
              </div>
            </div>

            <div class="grid grid-cols-3 gap-3 text-center">
              <div class="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span class="text-[11px] text-slate-500 uppercase font-semibold">Omset Bulan Ini</span>
                <div class="text-lg font-bold text-teal-700">${window.ArbaUtils.formatRupiah(analytics.revenueMonth)}</div>
                <span class="text-[10px] text-emerald-600 font-semibold">${analytics.revenuePct}% dari target</span>
              </div>
              <div class="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span class="text-[11px] text-slate-500 uppercase font-semibold">Mitra Outlet</span>
                <div class="text-lg font-bold text-slate-800">${window.ArbaUtils.formatNumber(analytics.totalOutlets)}</div>
                <span class="text-[10px] text-slate-500">${analytics.apotekCount} Apotek · ${analytics.minimarketCount} Minimarket</span>
              </div>
              <div class="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span class="text-[11px] text-slate-500 uppercase font-semibold">SKU Kritis</span>
                <div class="text-lg font-bold text-rose-600">${analytics.criticalSkuCount}</div>
                <span class="text-[10px] text-slate-500">${analytics.belowRop.length} ROP · ${analytics.nearExpiry.length} ED</span>
              </div>
            </div>

            <div>
              <h4 class="text-xs font-bold text-slate-700 mb-2 uppercase">Capaian Tim Sales</h4>
              <div class="space-y-1.5 text-xs">
                ${analytics.salesPerformance.slice(0, 5).map(function (rep) {
                  return `
                    <div class="flex justify-between items-center p-2 bg-slate-50 rounded">
                      <span>${window.ArbaUtils.escapeHtml(rep.name)} (${window.ArbaUtils.escapeHtml(rep.area)})</span>
                      <span class="font-bold">${window.ArbaUtils.formatRupiah(rep.revenueMonth)} (${rep.revenuePct}%)</span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button onclick="window.ArbaApp.closeModal()" class="btn btn-outline" type="button">Tutup</button>
          <button onclick="window.print(); window.ArbaApp.closeModal();" class="btn btn-primary" type="button">
            <span class="material-symbols-outlined text-[16px]">print</span>
            <span>Cetak</span>
          </button>
        </div>
      </div>
    `;
    window.ArbaApp.openModal(modalHtml);
  }

  window.ArbaViews.renderExecutiveDashboard = renderExecutiveDashboard;
})();
