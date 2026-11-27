/**
 * ArbaConnect ERP - Order Approval Queue View
 * Features:
 * - 4 Status Tabs (Perlu Otorisasi, Diproses Hari Ini, Manifest Armada, Ditolak/Void)
 * - Batch Selection & Batch Approve with atomic stock deductions and ledger logging
 * - Fleet Logistics Manifest Tab with Driver POD confirmation
 * - Expanded Detail Inspection View with Geofence coordinates, SKU breakdown, and action dropdown
 * - Summary cards with batch shortage alert
 * - Modals:
 *   1. Surat Jalan & Faktur Penjualan B2B (Rangkap 3 with CDOB signatures)
 *   2. Batch Replacement Dialog (Alternative Gudang B allocation)
 *   3. Adjust SKU Quantity Modal
 *   4. Reject Order Modal with CDOB audit justification
 */

(function () {
  'use strict';

  window.ArbaViews = window.ArbaViews || {};

  var state = {
    activeTab: 'pending', // 'pending' | 'approved' | 'manifest' | 'rejected'
    selectedSalesRep: 'all',
    selectedSort: 'latest',
    selectedOrderIds: ['ord-7f3b89-20260328'],
    openActionMenuId: null
  };

  function renderOrderApproval(container) {
    var appState = window.ArbaStore.getState();
    var orders = appState.orders;
    var driverManifests = appState.driverManifests;

    var pendingOrders = orders.filter(function (o) { return o.status === 'PENDING'; });
    var approvedOrders = orders.filter(function (o) { return o.status === 'APPROVED'; });
    var rejectedOrders = orders.filter(function (o) { return o.status === 'REJECTED'; });

    // Filter based on active tab and filters
    var displayedOrders = orders.filter(function (o) {
      if (state.activeTab === 'pending') return o.status === 'PENDING';
      if (state.activeTab === 'approved') return o.status === 'APPROVED';
      if (state.activeTab === 'rejected') return o.status === 'REJECTED';
      return true;
    });

    if (state.selectedSalesRep !== 'all') {
      displayedOrders = displayedOrders.filter(function (o) {
        return o.salesRep.toLowerCase().indexOf(state.selectedSalesRep.toLowerCase()) !== -1;
      });
    }

    // Sort displayedOrders based on state.selectedSort
    displayedOrders = displayedOrders.slice().sort(function (a, b) {
      if (state.selectedSort === 'highest_val') {
        return (b.totalAmount || 0) - (a.totalAmount || 0);
      }
      if (state.selectedSort === 'urgency') {
        var scoreA = (a.priority === 'High' ? 2 : 0) + (a.stockWarning ? 1 : 0);
        var scoreB = (b.priority === 'High' ? 2 : 0) + (b.stockWarning ? 1 : 0);
        return scoreB - scoreA || ((b.totalAmount || 0) - (a.totalAmount || 0));
      }
      if (state.selectedSort === 'credit_risk') {
        var ratioA = a.limitMax ? (a.limitRemaining / a.limitMax) : 1;
        var ratioB = b.limitMax ? (b.limitRemaining / b.limitMax) : 1;
        return ratioA - ratioB;
      }
      // default: 'latest'
      return (b.orderTimestamp || 0) - (a.orderTimestamp || 0);
    });

    var activeRole = (appState.currentUser && appState.currentUser.role === 'super-admin')
      ? (appState.currentRole || 'super-admin')
      : (appState.currentUser ? appState.currentUser.role : 'sales-ops');
    var isWarehouseRole = activeRole === 'inventory';
    var isSalesOpsRole = activeRole === 'sales-ops';

    var pageTitle = isWarehouseRole
      ? 'Penyiapan Barang Gudang, Alokasi Nomor Batch FEFO & Surat Jalan Armada'
      : isSalesOpsRole
      ? 'Meja Verifikasi Faktur Pesanan Sales, Plafon Kredit & Tanda Tangan Apoteker'
      : 'Verifikasi Faktur Pesanan Masuk, Alokasi Stok FEFO & Pengiriman Armada';

    var pageSubtitle = isWarehouseRole
      ? 'Siapkan fisik botol/karton dari Gudang Kartasura sesuai urutan kedaluwarsa terdekat (FEFO), alihkan nomor batch bila stok kurang, dan terbitkan Surat Jalan untuk sopir armada.'
      : isSalesOpsRole
      ? 'Periksa faktur pesanan yang dikirim dari HP Sales, pastikan nilai nota tidak melewati sisa plafon kredit apotek, cek tanda tangan apoteker & foto rak, lalu setujui faktur.'
      : 'Pusat persetujuan faktur pesanan dari lapangan, pemotongan otomatis stok gudang berstandar FEFO, dan pemantauan pengiriman sopir armada.';

    var html = `
      <div class="flex flex-col w-full">
        <!-- Top Section: Metric Ribbon & Audit Integrity Indicator -->
        <div class="flex flex-col gap-space-lg mb-space-lg">
          <div class="flex items-center justify-between gap-4 bg-surface-container-lowest p-5 rounded-xl border border-border-subtle/60">
            <h1 class="text-xl text-on-surface font-bold tracking-tight">
              Verifikasi Order
            </h1>
          </div>

          <!-- Status Tabs Grid -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              id="tab-pending"
              class="flex flex-col p-4 rounded-xl text-left transition-colors cursor-pointer border ${
                state.activeTab === 'pending'
                  ? 'bg-primary text-white border-primary shadow-xs'
                  : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-low border-border-subtle/60'
              }"
              type="button"
            >
              <div class="flex items-center justify-between w-full mb-1">
                <span class="text-xs uppercase tracking-wider font-semibold opacity-90">
                  ${isWarehouseRole ? 'Perlu Disiapkan Gudang' : 'Perlu Verifikasi Faktur'}
                </span>
                <span class="material-symbols-outlined text-[18px]">pending_actions</span>
              </div>
              <div class="flex items-baseline gap-1.5">
                <span class="text-2xl font-bold">${pendingOrders.length}</span>
                <span class="text-xs font-medium opacity-90">Faktur</span>
              </div>
              <span class="text-xs mt-1 opacity-80">${isWarehouseRole ? 'Siapkan Batch &amp; Cetak Surat Jalan' : 'Menunggu Persetujuan Admin'}</span>
            </button>

            <button
              id="tab-approved"
              class="flex flex-col p-4 rounded-xl text-left transition-colors cursor-pointer border ${
                state.activeTab === 'approved'
                  ? 'bg-primary text-white border-primary shadow-xs'
                  : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-low border-border-subtle/60'
              }"
              type="button"
            >
              <div class="flex items-center justify-between w-full mb-1">
                <span class="text-xs uppercase tracking-wider font-semibold">
                  ${isWarehouseRole ? 'Barang Sudah Disiapkan' : 'Faktur Disetujui Hari Ini'}
                </span>
                <span class="material-symbols-outlined text-[18px]">task_alt</span>
              </div>
              <div class="flex items-baseline gap-1.5">
                <span class="text-2xl font-bold">
                  ${approvedOrders.length}
                </span>
                <span class="text-xs">Faktur</span>
              </div>
              <span class="text-xs mt-1 opacity-80">Stok Batch FEFO Telah Dipotong</span>
            </button>

            <button
              id="tab-manifest"
              class="flex flex-col p-4 rounded-xl text-left transition-colors cursor-pointer border ${
                state.activeTab === 'manifest'
                  ? 'bg-primary text-white border-primary shadow-xs'
                  : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-low border-border-subtle/60'
              }"
              type="button"
            >
              <div class="flex items-center justify-between w-full mb-1">
                <span class="text-xs uppercase tracking-wider font-semibold">
                  Surat Jalan &amp; Armada
                </span>
                <span class="material-symbols-outlined text-[18px]">local_shipping</span>
              </div>
              <div class="flex items-baseline gap-1.5">
                <span class="text-2xl font-bold">${(appState.driverManifests || []).length}</span>
                <span class="text-xs">Armada</span>
              </div>
              <span class="text-xs mt-1 opacity-80">Dibawa Sopir Pengiriman</span>
            </button>

            <button
              id="tab-rejected"
              class="flex flex-col p-4 rounded-xl text-left transition-colors cursor-pointer border ${
                state.activeTab === 'rejected'
                  ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
                  : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-low border-border-subtle/60'
              }"
              type="button"
            >
              <div class="flex items-center justify-between w-full mb-1">
                <span class="text-xs uppercase tracking-wider font-semibold">
                  Faktur Ditolak / Retur
                </span>
                <span class="material-symbols-outlined text-[18px]">cancel</span>
              </div>
              <div class="flex items-baseline gap-1.5">
                <span class="text-2xl font-bold">
                  ${rejectedOrders.length}
                </span>
                <span class="text-xs">Kasus</span>
              </div>
              <span class="text-xs mt-1 opacity-80">Kredit / Kuota Terlampaui</span>
            </button>
          </div>
        </div>

        <!-- Batch Action Header & Filter Controls -->
        <div class="bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-border-subtle/40 mb-space-lg flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-md p-4">
          <!-- Filter Segments -->
          <div class="flex flex-wrap items-center gap-space-sm gap-2">
            <div class="relative min-w-[220px]">
              <span class="material-symbols-outlined text-on-surface-variant absolute left-3 top-2.5 text-[18px] pointer-events-none" style="position:absolute; left:0.75rem; top:0.6rem;" aria-hidden="true">
                badge
              </span>
              <select
                id="select-sales-rep"
                aria-label="Filter berdasarkan Sales Representative"
                class="w-full bg-surface-container-low font-body-md text-body-md text-on-surface pl-9 pr-8 py-2 rounded-lg border-0 cursor-pointer focus:outline-none text-xs"
                style="padding-left: 2.25rem;"
              >
                <option value="all" ${state.selectedSalesRep === 'all' ? 'selected' : ''}>Semua Sales Rep (Aktif)</option>
                ${(appState.salesTeam || []).map(function (rep) {
                  var first = (rep.name || '').split(' ')[0].toLowerCase();
                  return '<option value="' + window.ArbaUtils.escapeHtml(first) + '" ' + (state.selectedSalesRep === first ? 'selected' : '') + '>' + window.ArbaUtils.escapeHtml(rep.name) + ' (' + window.ArbaUtils.escapeHtml(rep.territory || '') + ')</option>';
                }).join('')}
              </select>
            </div>

            <div class="relative min-w-[210px]">
              <span class="material-symbols-outlined text-on-surface-variant absolute left-3 top-2.5 text-[18px] pointer-events-none" style="position:absolute; left:0.75rem; top:0.6rem;" aria-hidden="true">
                sort
              </span>
              <select
                id="select-sort-order"
                aria-label="Urutkan daftar faktur pesanan"
                class="w-full bg-surface-container-low font-body-md text-body-md text-on-surface pl-9 pr-8 py-2 rounded-lg border-0 cursor-pointer focus:outline-none text-xs"
                style="padding-left: 2.25rem;"
              >
                <option value="latest" ${state.selectedSort === 'latest' ? 'selected' : ''}>Waktu Masuk (Terbaru)</option>
                <option value="urgency" ${state.selectedSort === 'urgency' ? 'selected' : ''}>Tingkat Urgensi Outlet</option>
                <option value="highest_val" ${state.selectedSort === 'highest_val' ? 'selected' : ''}>Nilai Pesanan Tertinggi</option>
                <option value="credit_risk" ${state.selectedSort === 'credit_risk' ? 'selected' : ''}>Limit Kredit Mendekati Batas</option>
              </select>
            </div>

            <div class="flex items-center gap-2 pl-2">
              <label class="inline-flex items-center gap-2 cursor-pointer text-xs">
                <input
                  id="checkbox-select-all"
                  ${state.selectedOrderIds.length === displayedOrders.length && displayedOrders.length > 0 ? 'checked' : ''}
                  class="w-4 h-4 rounded text-primary border-0 bg-surface-container cursor-pointer"
                  type="checkbox"
                />
                <span class="font-label-md text-label-md text-on-surface-variant">
                  Pilih Semua (${displayedOrders.length} Pesanan)
                </span>
              </label>
            </div>
          </div>

          <!-- Collective Action Buttons -->
          <div class="flex items-center gap-space-sm gap-2 flex-wrap sm:flex-nowrap">
            <button
              id="btn-batch-print"
              class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-space-md py-2.5 bg-surface-container hover:bg-surface-container-high text-primary font-label-lg text-label-lg rounded-lg shadow-xs transition-all active:scale-[0.98] cursor-pointer text-xs font-semibold border-0"
              type="button"
            >
              <span class="material-symbols-outlined text-[18px]">print</span>
              <span>Cetak Surat Jalan Kolektif</span>
            </button>
            <button
              id="btn-batch-approve"
              class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-space-lg py-2.5 bg-primary text-white font-label-lg text-label-lg rounded-lg shadow-sm transition-all hover:bg-primary-container active:scale-[0.98] cursor-pointer text-xs font-semibold border-0"
              type="button"
            >
              <span class="material-symbols-outlined text-[20px]">checklist</span>
              <span>Setujui Pesanan Terpilih (Batch Approve)</span>
            </button>
          </div>
        </div>

        <!-- Verification Queue (Cards & Rows) -->
        <div class="flex flex-col gap-space-lg mb-space-xl">
          ${state.activeTab === 'manifest' ? `
            <!-- MANIFEST TAB -->
            <div class="flex flex-col gap-space-md">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container-low p-4 rounded-xl border border-border-subtle/40">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-bold" style="width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center;">
                    <span class="material-symbols-outlined text-[24px]">local_shipping</span>
                  </div>
                  <div>
                    <h3 class="font-title-sm text-title-sm text-on-surface font-bold text-sm">
                      Manifest Armada Logistik CV Arba'in Solo Raya
                    </h3>
                    <p class="text-xs text-on-surface-variant">
                      Pengawalan pengantaran pesanan B2B, verifikasi serah terima (POD), dan surat jalan resmi rangkap 3.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  id="btn-print-manifests"
                  class="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm hover:bg-primary-container cursor-pointer border-0"
                >
                  <span class="material-symbols-outlined text-[16px]">print</span>
                  <span>Cetak Lembar Manifest Rute</span>
                </button>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-space-md gap-4">
                ${driverManifests.map(function (manifest, mIdx) {
                  return `
                    <div class="bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-border-subtle/50 flex flex-col justify-between p-4">
                      <div>
                        <div class="flex items-center justify-between pb-3 border-b border-border-subtle/30">
                          <div>
                            <div class="flex items-center gap-2">
                              <span class="material-symbols-outlined text-secondary text-[20px]">directions_car</span>
                              <h4 class="font-title-sm text-title-sm text-on-surface font-bold text-sm">
                                ${manifest.vehiclePlate}
                              </h4>
                            </div>
                            <span class="text-xs text-on-surface-variant">Driver: <b>${manifest.driverName}</b> • ${manifest.wave}</span>
                          </div>
                          <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary">
                            ${manifest.routeArea}
                          </span>
                        </div>

                        <div class="py-3 space-y-2">
                          <span class="text-xs uppercase tracking-wider font-semibold text-on-surface-variant block mb-2">
                            Daftar Titik Kirim Outlet:
                          </span>
                          ${manifest.orders.map(function (ord, oIdx) {
                            return `
                              <div class="p-3 rounded-lg bg-surface-container-low border border-border-subtle/30 flex items-center justify-between text-xs mb-2">
                                <div>
                                  <div class="font-bold text-on-surface">${window.ArbaUtils.escapeHtml(ord.outletName)}</div>
                                  <div class="text-slate-500">${window.ArbaUtils.escapeHtml(ord.address)}</div>
                                  <div class="text-[11px] font-mono text-primary font-semibold mt-0.5">
                                    Nilai: ${window.ArbaUtils.formatRupiah(ord.amount)}
                                  </div>
                                </div>
                                <div>
                                  ${ord.delivered ? `
                                    <span class="px-2.5 py-1 rounded-full bg-status-success-bg text-status-success-text font-bold text-[11px] flex items-center gap-1">
                                      <span class="material-symbols-outlined text-[14px]">check_circle</span>
                                      Terkirim (${ord.deliveredTime})
                                    </span>
                                  ` : `
                                    <button
                                      type="button"
                                      class="btn-pod-confirm px-3 py-1.5 rounded-lg bg-secondary text-white font-semibold hover:bg-on-secondary-fixed-variant shadow-xs flex items-center gap-1 cursor-pointer active:scale-95 text-[11px] border-0"
                                      data-order-id="${ord.orderId}"
                                      data-driver-name="${manifest.driverName}"
                                    >
                                      <span class="material-symbols-outlined text-[14px]">done_all</span>
                                      <span>Konfirmasi POD</span>
                                    </button>
                                  `}
                                </div>
                              </div>
                            `;
                          }).join('')}
                        </div>
                      </div>

                      <div class="pt-3 border-t border-border-subtle/30 flex items-center justify-between text-xs text-on-surface-variant">
                        <span>Target Penyelesaian: 100% Hari Ini</span>
                        <span class="font-semibold text-primary">Status Armada: Beroperasi di Rute</span>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : state.activeTab === 'rejected' ? `
            <!-- REJECTED / VOID TAB -->
            <div class="bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-border-subtle/40 p-4">
              <h3 class="font-title-sm text-title-sm font-bold text-rose-600 mb-3 flex items-center gap-2 text-sm">
                <span class="material-symbols-outlined text-[20px]">cancel</span>
                <span>Daftar Pesanan Dibatalkan / Void (Audit CDOB)</span>
              </h3>
              ${rejectedOrders.length === 0 ? `
                <div class="p-8 text-center text-on-surface-variant text-xs">
                  Tidak ada pesanan yang berstatus ditolak / void saat ini.
                </div>
              ` : `
                <div class="divide-y divide-border-subtle/30">
                  ${rejectedOrders.map(function (ord) {
                    return `
                      <div class="py-3 flex items-center justify-between text-xs">
                        <div>
                          <div class="font-bold text-on-surface text-sm">${window.ArbaUtils.escapeHtml(ord.outletName)}</div>
                          <div class="text-slate-500 font-mono">${window.ArbaUtils.escapeHtml(ord.clientUuid)} • ${window.ArbaUtils.formatRupiah(ord.totalAmount)} • ${window.ArbaUtils.escapeHtml(ord.salesRep)}</div>
                        </div>
                        <div class="flex items-center gap-3">
                          <span class="px-2.5 py-1 rounded bg-status-danger-bg text-rose-600 font-semibold">
                            Dibatalkan
                          </span>
                          <button
                            type="button"
                            class="btn-restore-order px-3 py-1.5 bg-surface-container hover:bg-surface-container-high rounded text-xs font-semibold cursor-pointer border-0"
                            data-order-id="${ord.id}"
                          >
                            Pulihkan &amp; Setujui
                          </button>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              `}
            </div>
          ` : displayedOrders.length === 0 ? `
            <div class="bg-surface-container-lowest p-12 rounded-xl text-center shadow-xs border border-border-subtle/40">
              <span class="material-symbols-outlined text-4xl text-on-surface-variant mb-2">inbox</span>
              <h3 class="font-bold text-on-surface text-base">Tidak ada antrean pesanan dalam status ini</h3>
              <p class="text-xs text-on-surface-variant mt-1">Semua pesanan B2B pada kriteria ini telah diproses.</p>
            </div>
          ` : `
            <!-- EXPANDED DETAIL INSPECTION VIEW FOR FIRST / SELECTED ORDER -->
            ${displayedOrders
              .filter(function (o) { return o.id === (state.selectedOrderIds[0] || displayedOrders[0]?.id); })
              .slice(0, 1)
              .map(function (order) {
                return `
                  <div class="bg-surface-container-lowest rounded-xl shadow-md border border-border-subtle/50 overflow-hidden relative">
                    <div class="h-1.5 w-full bg-primary-container" style="height:6px; background:#0f766e;"></div>
                    <div class="p-space-lg p-5">
                      <!-- Header Info Ribbon -->
                      <div class="flex flex-col xl:flex-row xl:items-start justify-between gap-space-md pb-space-md border-b border-border-subtle/30 pb-4">
                        <div class="flex items-start gap-space-md gap-3">
                          <input
                            class="order-checkbox mt-1 w-5 h-5 rounded text-primary cursor-pointer"
                            type="checkbox"
                            data-order-id="${order.id}"
                            aria-label="Pilih pesanan ${window.ArbaUtils.escapeHtml(order.outletName)} (${window.ArbaUtils.escapeHtml(order.clientUuid)})"
                            ${state.selectedOrderIds.indexOf(order.id) !== -1 ? 'checked' : ''}
                          />
                          <div>
                            <div class="flex flex-wrap items-center gap-2 mb-1">
                              <span class="font-code-table text-code-table font-semibold px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface font-mono text-xs">
                                ${window.ArbaUtils.escapeHtml(order.clientUuid)}
                              </span>
                              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-status-success-bg text-status-success-text font-label-sm text-label-sm font-semibold text-xs">
                                <span class="w-1.5 h-1.5 rounded-full bg-badge-green" style="display:inline-block; width:6px; height:6px;"></span>
                                Idempotent Verified &amp; Signed
                              </span>
                              <span class="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm font-semibold text-xs">
                                Priority: High (Apotek Inti)
                              </span>
                            </div>
                            <h2 class="font-headline-lg text-headline-lg text-on-surface font-bold text-xl">
                              ${window.ArbaUtils.escapeHtml(order.outletName)}
                            </h2>
                            <div class="flex flex-wrap items-center gap-y-1 gap-x-space-md mt-1 text-on-surface-variant font-body-sm text-body-sm text-xs gap-3">
                              <span class="flex items-center gap-1">
                                <span class="material-symbols-outlined text-[16px] text-primary">location_on</span>
                                ${window.ArbaUtils.escapeHtml(order.address)}
                              </span>
                              <span class="flex items-center gap-1">
                                <span class="material-symbols-outlined text-[16px] text-on-surface-variant">schedule</span>
                                ${window.ArbaUtils.escapeHtml(order.orderTime)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <!-- Total Value & Term Gauge -->
                        <div class="flex flex-row xl:flex-col items-end justify-between xl:justify-center bg-surface-container-low p-space-md rounded-xl min-w-[280px] border border-border-subtle/30 p-3">
                          <div class="flex flex-col text-left xl:text-right">
                            <span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-[10px]">
                              Total Nilai Pesanan
                            </span>
                            <span class="font-headline-lg text-headline-lg text-primary font-bold text-xl">
                              ${window.ArbaUtils.formatRupiah(order.totalAmount)}
                            </span>
                          </div>
                          <div class="flex flex-col text-right mt-1 text-xs">
                            <div class="flex items-center justify-end gap-1.5 font-label-md text-label-md text-emerald-700 font-semibold">
                              <span class="material-symbols-outlined text-[16px]">credit_score</span>
                              <span>Termin: ${order.terms} (Plafon ${window.ArbaUtils.formatRupiah(order.limitMax)})</span>
                            </div>
                            <span class="font-body-sm text-body-sm text-on-surface-variant">
                              Sisa Limit: ${window.ArbaUtils.formatRupiah(order.limitRemaining)} (Aman)
                            </span>
                            ${(function () {
                              var sc = window.ArbaStore.getOutletCreditScoring ? window.ArbaStore.getOutletCreditScoring(order.outletId) : null;
                              if (!sc) return '';
                              return `<span class="mt-1 inline-flex items-center justify-end gap-1 text-[11px] font-bold" style="color:${sc.badgeColor};">📊 Skor Kelayakan Kredit: ${sc.score}/100 (${sc.tier})</span>`;
                            })()}
                          </div>
                        </div>
                      </div>

                      <!-- Bukti Tanda Tangan Digital Apoteker & Foto Audit Etalase (Bila Ada dari PWA) -->
                      ${(window.ArbaUtils.safeImageDataUrl(order.signatureDataUrl) || window.ArbaUtils.safeImageDataUrl(order.shelfPhotoDataUrl)) ? `
                        <div class="my-3 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div class="flex items-center gap-3">
                            <span class="material-symbols-outlined text-emerald-700 text-[22px]">verified</span>
                            <div>
                              <div class="font-bold text-emerald-950">Bukti Serah Terima Digital Terlampir dari PWA Sales</div>
                              <div class="text-[11px] text-emerald-800">Ditandatangani oleh: <b>${window.ArbaUtils.escapeHtml(order.signerName || 'Apoteker Penanggung Jawab')}</b></div>
                            </div>
                          </div>
                          <div class="flex items-center gap-3">
                            ${window.ArbaUtils.safeImageDataUrl(order.signatureDataUrl) ? `
                              <div class="bg-white px-2.5 py-1 rounded-lg border border-emerald-300 text-center">
                                <div class="text-[9px] uppercase font-bold text-slate-500">E-Signature Apoteker</div>
                                <img src="${window.ArbaUtils.safeImageDataUrl(order.signatureDataUrl)}" alt="E-Signature" style="height:34px; display:block;" />
                              </div>
                            ` : ''}
                            ${window.ArbaUtils.safeImageDataUrl(order.shelfPhotoDataUrl) ? `
                              <div class="bg-white p-1 rounded-lg border border-emerald-300 text-center">
                                <img src="${window.ArbaUtils.safeImageDataUrl(order.shelfPhotoDataUrl)}" alt="Foto Etalase" style="height:42px; width:84px; object-fit:cover; border-radius:4px; display:block;" />
                              </div>
                            ` : ''}
                          </div>
                        </div>
                      ` : ''}

                      <!-- Sales Origin & Geofence Verification Metadata Box -->
                      <div class="grid grid-cols-1 md:grid-cols-3 gap-space-md my-space-md p-space-md bg-surface-container-low rounded-xl border border-border-subtle/30 p-3 my-3 gap-3">
                        <div class="flex items-center gap-3">
                          <div class="w-10 h-10 rounded-full bg-surface-container-lowest flex items-center justify-center text-primary shadow-xs" style="width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center;">
                            <span class="material-symbols-outlined text-[20px]">person_pin</span>
                          </div>
                          <div class="flex flex-col min-w-0 text-xs">
                            <span class="font-label-sm text-label-sm text-on-surface-variant text-[11px]">
                              Sales Lapangan (PWA App)
                            </span>
                            <span class="font-title-sm text-title-sm text-on-surface truncate font-semibold">
                              ${order.salesRep}
                            </span>
                            <span class="font-code-table text-code-table text-on-surface-variant font-mono">
                              ID: ${order.salesRepId}
                            </span>
                          </div>
                        </div>

                        <div class="flex items-center gap-3">
                          <div class="w-10 h-10 rounded-full bg-surface-container-lowest flex items-center justify-center text-emerald-600 shadow-xs" style="width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center;">
                            <span class="material-symbols-outlined text-[20px]">pin_drop</span>
                          </div>
                          <div class="flex flex-col min-w-0 text-xs">
                            <span class="font-label-sm text-label-sm text-on-surface-variant text-[11px]">
                              Validasi GPS Geofence (Radius 12m)
                            </span>
                            <span class="font-code-table text-code-table text-on-surface truncate font-semibold font-mono">
                              ${order.geofenceCoords}
                            </span>
                            <div class="flex items-center gap-2 mt-0.5">
                              <span class="font-body-sm text-body-sm text-emerald-700 font-semibold text-[11px]">
                                Lokasi Terotentikasi
                              </span>
                              ${(function () {
                                var m = /(-?\d+\.\d+)\s*,\s*(\d+\.\d+)/.exec(order.geofenceCoords || '');
                                var coordQ = m ? (m[1] + ',' + m[2]) : encodeURIComponent(order.outletName + ' ' + order.city);
                                return `<a href="https://www.google.com/maps/search/?api=1&query=${coordQ}" target="_blank" rel="noreferrer" class="text-[11px] font-bold text-primary hover:underline flex items-center gap-0.5"><span class="material-symbols-outlined text-[13px]">map</span><span>Lihat Peta</span></a>`;
                              })()}
                            </div>
                          </div>
                        </div>

                        <div class="flex items-center gap-3">
                          <div class="w-10 h-10 rounded-full bg-surface-container-lowest flex items-center justify-center text-secondary shadow-xs" style="width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center;">
                            <span class="material-symbols-outlined text-[20px]">receipt_long</span>
                          </div>
                          <div class="flex flex-col min-w-0 text-xs">
                            <span class="font-label-sm text-label-sm text-on-surface-variant text-[11px]">
                              Status Faktur &amp; Pajak
                            </span>
                            <span class="font-title-sm text-title-sm text-on-surface truncate font-semibold">
                              Faktur Pajak Standar B2B
                            </span>
                            <span class="font-code-table text-code-table text-on-surface-variant font-mono">
                              NPWP: ${order.npwp}
                            </span>
                          </div>
                        </div>
                      </div>

                      <!-- SKU Breakdown Table -->
                      <div class="overflow-x-auto rounded-xl bg-surface-container-lowest shadow-xs border border-border-subtle/30 mt-space-md">
                        <table class="w-full text-left border-collapse text-xs">
                          <thead class="bg-surface-container-high text-on-surface-variant font-semibold">
                            <tr>
                              <th class="py-3 px-4">Produk &amp; Kemasan</th>
                              <th class="py-3 px-4">Batch &amp; Kadaluarsa (FEFO)</th>
                              <th class="py-3 px-4 text-center">Kuantitas</th>
                              <th class="py-3 px-4 text-right">Harga Satuan</th>
                              <th class="py-3 px-4 text-right">Subtotal</th>
                              <th class="py-3 px-4 text-center">Status Alokasi Gudang</th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-border-subtle/30 text-on-surface">
                            ${order.items.map(function (it) {
                              return `
                                <tr class="hover:bg-surface-container-low transition-colors">
                                  <td class="py-3 px-4">
                                    <div class="flex items-center gap-3">
                                      <div class="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-primary font-bold" style="width:32px; height:32px; border-radius:8px; display:inline-flex; align-items:center; justify-content:center;">
                                        <span class="material-symbols-outlined text-[18px]">
                                          ${it.sku.indexOf('MDR') !== -1 ? 'medication' : it.sku.indexOf('HBT') !== -1 ? 'vaccines' : 'science'}
                                        </span>
                                      </div>
                                      <div class="flex flex-col">
                                        <span class="font-semibold">${window.ArbaUtils.escapeHtml(it.name)}</span>
                                        <span class="font-code-table text-code-table text-on-surface-variant font-mono text-[11px]">
                                          SKU: ${window.ArbaUtils.escapeHtml(it.sku)}
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                  <td class="py-3 px-4">
                                    <div class="flex flex-col">
                                      <span class="font-code-table text-code-table font-semibold text-primary font-mono">
                                        ${window.ArbaUtils.escapeHtml(it.batch)}
                                      </span>
                                      <span class="font-label-sm text-label-sm text-on-surface-variant text-[11px]">
                                        Exp: ${window.ArbaUtils.escapeHtml(it.expiry)} (${window.ArbaUtils.escapeHtml(it.fefoPriority)})
                                      </span>
                                    </div>
                                  </td>
                                  <td class="py-3 px-4 text-center font-bold">
                                    ${it.quantity} botol
                                  </td>
                                  <td class="py-3 px-4 text-right font-code-table font-mono">
                                    ${window.ArbaUtils.formatRupiah(it.unitPrice)}
                                  </td>
                                  <td class="py-3 px-4 text-right font-code-table font-semibold font-mono">
                                    ${window.ArbaUtils.formatRupiah(it.subtotal)}
                                  </td>
                                  <td class="py-3 px-4 text-center">
                                    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-status-success-bg text-status-success-text font-semibold text-[11px]">
                                      <span class="w-1.5 h-1.5 rounded-full bg-badge-green" style="display:inline-block; width:6px; height:6px;"></span>
                                      Tersedia &amp; Siap Potong (Sisa: ${it.remainingBatchStock})
                                    </span>
                                  </td>
                                </tr>
                              `;
                            }).join('')}
                          </tbody>
                        </table>
                      </div>

                      <!-- Action Call-To-Action Toolbar -->
                      <div class="flex flex-col sm:flex-row items-center justify-between gap-space-md pt-space-lg mt-space-md pt-4">
                        <div class="flex items-center gap-2 text-on-surface-variant font-body-sm text-body-sm text-xs">
                          <span class="material-symbols-outlined text-primary text-[18px]">lock</span>
                          <span>Alokasi stok otomatis akan mengunci kuantitas dalam sistem secara instan.</span>
                        </div>
                        <div class="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                          <!-- Dropdown Actions -->
                          <div class="relative" style="position:relative;">
                            <button
                              id="btn-action-dropdown"
                              class="px-space-md py-2.5 px-3 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-lg text-label-lg flex items-center gap-2 transition-all cursor-pointer text-xs font-semibold border-0"
                              type="button"
                            >
                              <span>Opsi Tindakan</span>
                              <span class="material-symbols-outlined text-[18px]">arrow_drop_down</span>
                            </button>
                            <div id="action-dropdown-menu" class="hidden absolute right-0 bottom-full mb-1 bg-surface-container-lowest shadow-xl rounded-xl p-1.5 min-w-[220px] z-20 border border-border-subtle/50" style="position:absolute; right:0; bottom:calc(100% + 4px); z-index:30;">
                              <button
                                class="btn-adjust-qty-trigger w-full text-left flex items-center gap-2.5 px-3 py-2 text-on-surface hover:bg-surface-container-low rounded-lg text-xs cursor-pointer border-0 bg-transparent font-medium"
                                data-order-id="${order.id}"
                                type="button"
                              >
                                <span class="material-symbols-outlined text-amber-600 text-[18px]">tune</span>
                                <span>Sesuaikan Kuantitas SKU</span>
                              </button>
                              <button
                                class="btn-substitute-batch-trigger w-full text-left flex items-center gap-2.5 px-3 py-2 text-on-surface hover:bg-surface-container-low rounded-lg text-xs cursor-pointer border-0 bg-transparent font-medium"
                                data-order-id="${order.id}"
                                type="button"
                              >
                                <span class="material-symbols-outlined text-secondary text-[18px]">swap_horiz</span>
                                <span>Alihkan ke Batch Alternatif</span>
                              </button>
                              <button
                                class="btn-reject-order-trigger w-full text-left flex items-center gap-2.5 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-lg text-xs cursor-pointer border-0 bg-transparent font-medium"
                                data-order-id="${order.id}"
                                type="button"
                              >
                                <span class="material-symbols-outlined text-rose-600 text-[18px]">block</span>
                                <span>Tolak Pesanan Ini</span>
                              </button>
                            </div>
                          </div>

                          <!-- Print Secondary -->
                          <button
                            class="btn-print-surat-jalan px-space-md py-2.5 px-3 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-primary font-label-lg text-label-lg flex items-center gap-2 transition-all cursor-pointer text-xs font-semibold border-0"
                            data-order-id="${order.id}"
                            type="button"
                          >
                            <span class="material-symbols-outlined text-[18px]">print</span>
                            <span>Cetak Surat Jalan &amp; Faktur B2B</span>
                          </button>

                          <!-- Primary Approve -->
                          ${order.status === 'PENDING' ? `
                            <button
                              class="btn-approve-single px-space-lg py-2.5 px-4 rounded-lg bg-primary text-white hover:bg-primary-container font-label-lg text-label-lg flex items-center gap-2 shadow-sm hover:shadow-md transition-all active:scale-[0.98] cursor-pointer text-xs font-semibold border-0"
                              data-order-id="${order.id}"
                              type="button"
                            >
                              <span class="material-symbols-outlined text-[20px]">check_circle</span>
                              <span>Konfirmasi Pesanan (Potong Stok Otomatis)</span>
                            </button>
                          ` : `
                            <span class="px-4 py-2.5 rounded-lg bg-status-success-bg text-status-success-text font-semibold text-xs flex items-center gap-1.5">
                              <span class="material-symbols-outlined text-[18px]">task_alt</span>
                              Telah Dikonfirmasi Gudang
                            </span>
                          `}
                        </div>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}

            <!-- SUMMARY ROWS FOR OTHER ORDERS -->
            ${displayedOrders
              .filter(function (o) { return o.id !== (state.selectedOrderIds[0] || displayedOrders[0]?.id); })
              .map(function (order) {
                var isWarningState = !!order.stockWarning;
                var isChecked = state.selectedOrderIds.indexOf(order.id) !== -1;

                return `
                  <div class="bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-border-subtle/40 hover:shadow-md transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-space-md relative overflow-hidden p-4 mb-3 ${
                    isWarningState ? 'border-l-4 border-l-badge-amber' : ''
                  }" style="${isWarningState ? 'border-left: 4px solid #f59e0b;' : ''}">
                    <div class="flex items-center gap-space-md gap-3">
                      <input
                        class="order-checkbox w-5 h-5 rounded text-primary cursor-pointer"
                        type="checkbox"
                        data-order-id="${order.id}"
                        aria-label="Pilih pesanan ${window.ArbaUtils.escapeHtml(order.outletName)} (${window.ArbaUtils.escapeHtml(order.clientUuid)})"
                        ${isChecked ? 'checked' : ''}
                      />
                      <div class="flex flex-col">
                        <div class="flex items-center gap-2 mb-1 flex-wrap text-xs">
                          <span class="font-code-table text-code-table font-semibold px-2 py-0.5 rounded bg-surface-container-high text-on-surface font-mono">
                            ${order.clientUuid.slice(0, 10)}
                          </span>
                          ${order.status === 'APPROVED' ? `
                            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-status-success-bg text-status-success-text font-semibold">
                              <span class="w-1.5 h-1.5 rounded-full bg-badge-green" style="display:inline-block; width:6px; height:6px;"></span> Telah Disetujui
                            </span>
                          ` : isWarningState ? `
                            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-status-warning-bg text-amber-700 font-semibold">
                              <span class="w-1.5 h-1.5 rounded-full bg-badge-amber" style="display:inline-block; width:6px; height:6px;"></span> Menunggu Alokasi Sebagian
                            </span>
                          ` : `
                            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-status-success-bg text-status-success-text font-semibold">
                              <span class="w-1.5 h-1.5 rounded-full bg-badge-green" style="display:inline-block; width:6px; height:6px;"></span> Siap Potong
                            </span>
                          `}
                          <span class="font-label-sm text-label-sm text-on-surface-variant">
                            ${window.ArbaUtils.escapeHtml(order.orderTime)} • Sales: ${window.ArbaUtils.escapeHtml(order.salesRep)}
                          </span>
                        </div>
                        <div class="flex flex-wrap items-center gap-2 text-xs">
                          <h3
                            class="btn-focus-order font-title-sm text-title-sm font-bold text-on-surface hover:text-primary cursor-pointer text-sm"
                            data-order-id="${window.ArbaUtils.escapeHtml(order.id)}"
                            title="Klik untuk membuka panel inspeksi utama"
                          >
                            ${window.ArbaUtils.escapeHtml(order.outletName)}
                          </h3>
                          <span class="text-on-surface-variant">•</span>
                          <span class="${isWarningState ? 'text-amber-700 font-semibold' : 'text-on-surface-variant'}">
                            ${window.ArbaUtils.escapeHtml(order.stockWarning || `${order.items.length} SKU (${order.items.map(function(i){return i.name;}).join(', ')})`)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div class="flex items-center justify-between lg:justify-end gap-space-lg gap-4">
                      <div class="flex flex-col text-left lg:text-right">
                        <span class="font-headline-md text-headline-md font-bold text-primary text-base font-mono">
                          ${window.ArbaUtils.formatRupiah(order.totalAmount)}
                        </span>
                        <span class="font-label-sm text-label-sm text-emerald-700 font-medium text-[11px]">
                          Termin ${order.terms}
                        </span>
                      </div>
                      <div class="flex items-center gap-2">
                        ${isWarningState ? `
                          <button
                            class="btn-substitute-batch-trigger px-space-md py-2 px-3 rounded-lg bg-status-warning-bg text-amber-900 hover:bg-badge-amber hover:text-white font-label-md text-label-md flex items-center gap-1.5 transition-all cursor-pointer font-semibold shadow-xs text-xs border-0"
                            data-order-id="${order.id}"
                            type="button"
                          >
                            <span class="material-symbols-outlined text-[18px]">alt_route</span>
                            <span>Pilih Batch Pengganti</span>
                          </button>
                        ` : `
                          <button
                            class="btn-print-surat-jalan p-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors cursor-pointer border-0"
                            data-order-id="${order.id}"
                            title="Periksa Detil Lengkap"
                            type="button"
                          >
                            <span class="material-symbols-outlined text-[20px]">visibility</span>
                          </button>
                          ${order.status === 'PENDING' ? `
                            <button
                              class="btn-approve-single px-space-md py-2 px-3 rounded-lg bg-primary-container text-white font-label-md text-label-md flex items-center gap-1.5 shadow-xs hover:bg-primary transition-all cursor-pointer font-semibold active:scale-95 text-xs border-0"
                              data-order-id="${order.id}"
                              type="button"
                            >
                              <span class="material-symbols-outlined text-[18px]">done</span>
                              <span>Konfirmasi Cepat</span>
                            </button>
                          ` : ''}
                        `}
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
          `}
        </div>

        <!-- Operational Real-time Logistics & Warehouse Feed Footer Section -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-space-md gap-4">
          <!-- Left 7 Cols: Live Stock Ledger Stream -->
          <div class="lg:col-span-7 bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-border-subtle/40 flex flex-col justify-between p-4">
            <div>
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-primary text-[20px]" aria-hidden="true">history_edu</span>
                  <h3 class="font-title-sm text-title-sm font-bold text-on-surface text-sm">
                    Mutasi Stok Terbaru
                  </h3>
                </div>
                <span class="font-code-table text-code-table text-on-surface-variant font-medium text-xs font-mono">
                  ${(appState.ledger || []).length} Entri
                </span>
              </div>
              <div class="flex flex-col gap-2">
                ${(appState.ledger || []).slice(0, 3).map(function (entry) {
                  return `
                    <div class="flex items-center justify-between p-2 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm text-xs">
                      <div class="flex items-center gap-2 min-w-0">
                        <span class="font-code-table text-code-table font-semibold text-primary font-mono shrink-0">${window.ArbaUtils.escapeHtml(entry.time || entry.date || '-')}</span>
                        <span class="truncate">${window.ArbaUtils.escapeHtml(entry.type || '')} <b>${entry.qty || 0}</b> ${window.ArbaUtils.escapeHtml(entry.sku || entry.productName || '')}</span>
                      </div>
                      <span class="font-label-sm text-label-sm px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-semibold text-[10px] shrink-0">
                        ${window.ArbaUtils.escapeHtml(entry.batch || entry.ref || '-')}
                      </span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
            <div class="pt-3 mt-3 flex items-center justify-end text-on-surface-variant font-label-sm text-label-sm border-t border-border-subtle/30 text-xs">
              <button
                id="btn-goto-stock-ledger"
                class="text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0"
                type="button"
              >
                Buka Buku Besar <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>

          <!-- Right 5 Cols: Live Driver Manifests -->
          <div class="lg:col-span-5 bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-border-subtle/40 flex flex-col justify-between p-4">
            <div>
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-secondary text-[20px]" aria-hidden="true">local_shipping</span>
                  <h3 class="font-title-sm text-title-sm font-bold text-on-surface text-sm">
                    Armada Pengiriman
                  </h3>
                </div>
                <span class="font-label-sm text-label-sm px-2 py-0.5 rounded bg-surface-container-high text-on-surface font-medium text-xs">
                  ${(appState.driverManifests || []).length} Armada
                </span>
              </div>
              <div class="grid grid-cols-2 gap-space-sm gap-2 mb-3 text-xs">
                ${(appState.driverManifests || []).slice(0, 2).map(function (m) {
                  var cnt = (m.orderIds && m.orderIds.length) || 0;
                  return `
                    <div class="p-space-sm p-2.5 bg-surface-container-low rounded-lg border border-border-subtle/30">
                      <span class="font-label-sm text-label-sm text-on-surface-variant block text-[11px] truncate">
                        ${window.ArbaUtils.escapeHtml(m.vehicle || m.driverName || 'Armada')}
                      </span>
                      <span class="font-headline-md text-headline-md font-bold text-on-surface text-lg">${cnt} Order</span>
                      <span class="font-body-sm text-body-sm text-primary font-semibold block text-[11px] truncate">
                        ${window.ArbaUtils.escapeHtml(m.route || m.status || '-')}
                      </span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
            <div class="flex items-center justify-end gap-space-sm pt-2 border-t border-border-subtle/30 text-xs">
              <button
                id="btn-manifest-pwa"
                class="px-space-md py-2 px-3 bg-secondary text-white hover:bg-secondary-container font-label-md text-label-md rounded-lg flex items-center gap-1.5 transition-all cursor-pointer font-semibold shadow-xs border-0 text-xs"
                type="button"
              >
                <span class="material-symbols-outlined text-[18px]">share_location</span>
                <span>Manifest Driver</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
    bindEvents(container);
  }

  function bindEvents(container) {
    // Tabs
    var tabPending = container.querySelector('#tab-pending');
    var tabApproved = container.querySelector('#tab-approved');
    var tabManifest = container.querySelector('#tab-manifest');
    var tabRejected = container.querySelector('#tab-rejected');

    if (tabPending) {
      tabPending.addEventListener('click', function () {
        state.activeTab = 'pending';
        renderOrderApproval(container);
      });
    }
    if (tabApproved) {
      tabApproved.addEventListener('click', function () {
        state.activeTab = 'approved';
        renderOrderApproval(container);
      });
    }
    if (tabManifest) {
      tabManifest.addEventListener('click', function () {
        state.activeTab = 'manifest';
        window.ArbaApp.showToast("Membuka 14 Manifest Faktur Pengiriman Armada Hari Ini", 'local_shipping');
        renderOrderApproval(container);
      });
    }
    if (tabRejected) {
      tabRejected.addEventListener('click', function () {
        state.activeTab = 'rejected';
        renderOrderApproval(container);
      });
    }

    // Sales rep select
    var repSelect = container.querySelector('#select-sales-rep');
    if (repSelect) {
      repSelect.addEventListener('change', function (e) {
        state.selectedSalesRep = e.target.value;
        renderOrderApproval(container);
      });
    }

    // Sort select
    var sortSelect = container.querySelector('#select-sort-order');
    if (sortSelect) {
      sortSelect.addEventListener('change', function (e) {
        state.selectedSort = e.target.value;
        renderOrderApproval(container);
      });
    }

    // Focus order into main expanded inspection view
    var focusBtns = container.querySelectorAll('.btn-focus-order');
    focusBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var oid = btn.getAttribute('data-order-id');
        if (oid) {
          state.selectedOrderIds = [oid];
          renderOrderApproval(container);
        }
      });
    });

    // Select all checkbox
    var selectAll = container.querySelector('#checkbox-select-all');
    if (selectAll) {
      selectAll.addEventListener('change', function (e) {
        var orders = window.ArbaStore.getState().orders;
        if (e.target.checked) {
          state.selectedOrderIds = orders.map(function (o) { return o.id; });
        } else {
          state.selectedOrderIds = [];
        }
        renderOrderApproval(container);
      });
    }

    // Order checkboxes
    var orderCheckboxes = container.querySelectorAll('.order-checkbox');
    orderCheckboxes.forEach(function (cb) {
      cb.addEventListener('change', function () {
        var orderId = cb.getAttribute('data-order-id');
        var idx = state.selectedOrderIds.indexOf(orderId);
        if (cb.checked && idx === -1) {
          state.selectedOrderIds.push(orderId);
        } else if (!cb.checked && idx !== -1) {
          state.selectedOrderIds.splice(idx, 1);
        }
        renderOrderApproval(container);
      });
    });

    // Batch Print
    var btnBatchPrint = container.querySelector('#btn-batch-print');
    if (btnBatchPrint) {
      btnBatchPrint.addEventListener('click', function () {
        var orders = window.ArbaStore.getState().orders;
        var targetOrder = orders.find(function (o) { return state.selectedOrderIds.indexOf(o.id) !== -1; }) || orders[0];
        if (targetOrder) {
          openSuratJalanModal(targetOrder);
        }
        window.ArbaApp.showToast(`Membuka pratinjau cetak Surat Jalan Kolektif (${state.selectedOrderIds.length || 1} faktur dipilih)...`, 'print');
      });
    }

    // Batch Approve
    var btnBatchApprove = container.querySelector('#btn-batch-approve');
    if (btnBatchApprove) {
      btnBatchApprove.addEventListener('click', function () {
        if (state.selectedOrderIds.length === 0) {
          window.ArbaApp.showToast('Pilih setidaknya satu pesanan untuk disetujui', 'warning');
          return;
        }
        window.ArbaStore.batchApproveOrders(state.selectedOrderIds);
        state.selectedOrderIds = [];
      });
    }

    // Single Approve dengan Guardrail Kepatuhan CDOB (FEFO Kritis, Kredit Overdue, Legalitas SIPA)
    var approveBtns = container.querySelectorAll('.btn-approve-single');
    approveBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var orderId = btn.getAttribute('data-order-id');
        if (window.ArbaStore && typeof window.ArbaStore.validateOrderCompliance === 'function') {
          var check = window.ArbaStore.validateOrderCompliance(orderId);
          if (!check.ok && check.blockers.length > 0) {
            var proceed = window.confirm(
              'PERINGATAN GUARDRAIL CDOB & KREDIT B2B:\n\n- ' +
              check.blockers.join('\n- ') +
              '\n\nApakah Anda yakin ingin tetap melakukan override otorisasi (akan dicatat pada Audit Trail)?'
            );
            if (!proceed) {
              window.ArbaApp.showToast('Otorisasi ditahan oleh Guardrail CDOB — silakan lakukan substitusi batch / verifikasi kredit terlebih dahulu.', 'gpp_maybe');
              return;
            }
          } else if (check.warnings && check.warnings.length > 0) {
            window.ArbaApp.showToast('Catatan Kepatuhan: ' + check.warnings[0], 'warning');
          }
        }
        window.ArbaStore.approveOrder(orderId);
      });
    });

    // Print Surat Jalan & Faktur B2B
    var printBtns = container.querySelectorAll('.btn-print-surat-jalan');
    printBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var orderId = btn.getAttribute('data-order-id');
        var order = window.ArbaStore.getState().orders.find(function (o) { return o.id === orderId; });
        if (order) openSuratJalanModal(order);
      });
    });

    // Action Dropdown Toggle
    var btnActionDrop = container.querySelector('#btn-action-dropdown');
    var menuActionDrop = container.querySelector('#action-dropdown-menu');
    if (btnActionDrop && menuActionDrop) {
      btnActionDrop.addEventListener('click', function (e) {
        e.stopPropagation();
        menuActionDrop.classList.toggle('hidden');
      });
      document.addEventListener('click', function () {
        menuActionDrop.classList.add('hidden');
      });
    }

    // Adjust Qty Trigger
    var adjBtns = container.querySelectorAll('.btn-adjust-qty-trigger');
    adjBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var orderId = btn.getAttribute('data-order-id');
        var order = window.ArbaStore.getState().orders.find(function (o) { return o.id === orderId; });
        if (order) openAdjustQtyModal(order);
      });
    });

    // Substitute Batch Trigger
    var subBtns = container.querySelectorAll('.btn-substitute-batch-trigger');
    subBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var orderId = btn.getAttribute('data-order-id');
        var order = window.ArbaStore.getState().orders.find(function (o) { return o.id === orderId; });
        if (order) openSubstituteBatchModal(order);
      });
    });

    // Reject Order Trigger
    var rejBtns = container.querySelectorAll('.btn-reject-order-trigger');
    rejBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var orderId = btn.getAttribute('data-order-id');
        var order = window.ArbaStore.getState().orders.find(function (o) { return o.id === orderId; });
        if (order) openRejectOrderModal(order);
      });
    });

    // Restore Order Trigger
    var restoreBtns = container.querySelectorAll('.btn-restore-order');
    restoreBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var orderId = btn.getAttribute('data-order-id');
        window.ArbaStore.approveOrder(orderId);
        window.ArbaApp.showToast(`Pesanan dipulihkan dan disetujui!`, 'restore');
      });
    });

    // POD Confirm buttons in Manifest Tab
    var podBtns = container.querySelectorAll('.btn-pod-confirm');
    podBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var orderId = btn.getAttribute('data-order-id');
        var driverName = btn.getAttribute('data-driver-name');
        window.ArbaStore.markOrderDelivered(orderId, driverName);
      });
    });

    // Print Manifests button
    var btnPrintMan = container.querySelector('#btn-print-manifests');
    if (btnPrintMan) {
      btnPrintMan.addEventListener('click', function () {
        window.ArbaApp.showToast('Mencetak seluruh berkas Manifest Armada Solo Raya hari ini', 'print');
        window.print();
      });
    }

    // Go to Stock Ledger
    var btnGoLedger = container.querySelector('#btn-goto-stock-ledger');
    if (btnGoLedger) {
      btnGoLedger.addEventListener('click', function () {
        window.ArbaApp.navigate('inventory-stock-ledger');
      });
    }

    // Manifest driver PWA toast
    var btnManPwa = container.querySelector('#btn-manifest-pwa');
    if (btnManPwa) {
      btnManPwa.addEventListener('click', function () {
        window.ArbaApp.showToast('Manifest Driver terkirim ke PWA driver pengiriman (Joko & Hartono)', 'share_location');
      });
    }
  }

  // Modal 1: Surat Jalan Rangkap 3 & Faktur Penjualan B2B
  function openSuratJalanModal(order) {
    var modalHtml = `
      <div class="modal-dialog max-w-2xl">
        <div class="modal-header">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[24px]">local_shipping</span>
            <h3 class="modal-title">Surat Jalan &amp; Faktur Penjualan B2B CV Arba'in</h3>
          </div>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div class="modal-body">
          <div class="p-4 bg-surface-container-low/50 rounded-xl space-y-3 border border-border-subtle/40 text-on-surface">
            <div class="flex justify-between items-start border-b pb-2">
              <div>
                <h4 class="font-bold text-lg text-primary">CV ARBA'IN SURAKARTA</h4>
                <p class="text-xs text-on-surface-variant">Pusat Distribusi Produk Herbal Solo Raya</p>
                <p class="text-xs text-on-surface-variant">Izin PBF / Penyalur Obat Herbal Terdaftar</p>
              </div>
              <div class="text-right text-xs">
                <p class="font-bold text-sm">SURAT JALAN / FAKTUR</p>
                <p class="font-mono text-primary font-semibold">${window.ArbaUtils.escapeHtml(order.clientUuid)}</p>
                <p class="text-on-surface-variant">Tanggal: 28 Maret 2026</p>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4 text-xs bg-white p-3 rounded-lg border border-slate-200 text-slate-800">
              <div>
                <p class="text-slate-500 font-semibold">Tujuan Pengiriman:</p>
                <p class="font-bold text-slate-800 text-sm">${window.ArbaUtils.escapeHtml(order.outletName)}</p>
                <p class="text-slate-600">${window.ArbaUtils.escapeHtml(order.address)}</p>
                <p class="text-slate-600">Kota: ${window.ArbaUtils.escapeHtml(order.city)}</p>
              </div>
              <div>
                <p class="text-slate-500 font-semibold">Ketentuan Pembayaran:</p>
                <p class="font-bold text-slate-800">${window.ArbaUtils.escapeHtml(order.terms)}</p>
                <p class="text-slate-600">NPWP: ${window.ArbaUtils.escapeHtml(order.npwp)}</p>
                <p class="text-slate-600">Sales Lapangan: ${window.ArbaUtils.escapeHtml(order.salesRep)}</p>
              </div>
            </div>

            <table class="w-full text-xs text-left border-collapse border border-slate-300">
              <thead>
                <tr class="bg-slate-200 text-slate-700">
                  <th class="border border-slate-300 p-2">No</th>
                  <th class="border border-slate-300 p-2">Nama Produk Herbal</th>
                  <th class="border border-slate-300 p-2">Batch / FEFO Exp</th>
                  <th class="border border-slate-300 p-2 text-center">Qty</th>
                  <th class="border border-slate-300 p-2 text-right">Harga</th>
                  <th class="border border-slate-300 p-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${order.items.map(function (it, idx) {
                  var prodRef = (window.ArbaStore.getState().products || []).find(function (p) { return p.sku === it.sku; });
                  var nieTag = (prodRef && prodRef.nieBpom) ? `<div class="text-[10px] font-mono text-slate-500">NIE: ${window.ArbaUtils.escapeHtml(prodRef.nieBpom)}</div>` : '';
                  return `
                    <tr class="border-b border-slate-200 bg-white text-slate-800">
                      <td class="border border-slate-300 p-2">${idx + 1}</td>
                      <td class="border border-slate-300 p-2 font-medium">${window.ArbaUtils.escapeHtml(it.name)}${nieTag}</td>
                      <td class="border border-slate-300 p-2 font-mono text-[11px]">${window.ArbaUtils.escapeHtml(it.batch)} (${window.ArbaUtils.escapeHtml(it.expiry)})</td>
                      <td class="border border-slate-300 p-2 text-center font-bold">${it.quantity}</td>
                      <td class="border border-slate-300 p-2 text-right font-mono">${window.ArbaUtils.formatRupiah(it.unitPrice)}</td>
                      <td class="border border-slate-300 p-2 text-right font-mono font-bold">${window.ArbaUtils.formatRupiah(it.subtotal)}</td>
                    </tr>
                  `;
                }).join('')}
                <tr class="bg-slate-100 font-bold text-slate-800">
                  <td colspan="5" class="border border-slate-300 p-2 text-right">TOTAL NILAI PEMESANAN:</td>
                  <td class="border border-slate-300 p-2 text-right font-mono text-primary text-sm">
                    ${window.ArbaUtils.formatRupiah(order.totalAmount)}
                  </td>
                </tr>
              </tbody>
            </table>

            <div class="grid grid-cols-3 gap-2 pt-4 text-center text-xs text-slate-600">
              <div class="border-t border-slate-300 pt-8">Penerima Outlet (Stempel)</div>
              <div class="border-t border-slate-300 pt-8">Driver Ekspedisi CV Arba'in</div>
              <div class="border-t border-slate-300 pt-8">Kepala Gudang Kartasura</div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button onclick="window.ArbaApp.closeModal()" class="btn btn-outline" type="button">
            Tutup
          </button>
          <button onclick="window.print(); window.ArbaApp.closeModal();" class="btn btn-primary" type="button">
            <span class="material-symbols-outlined text-[18px]">print</span>
            <span>Cetak Lembar Surat Jalan</span>
          </button>
        </div>
      </div>
    `;

    window.ArbaApp.openModal(modalHtml);
  }

  // Modal 2: Batch Replacement
  function openSubstituteBatchModal(order) {
    var modalHtml = `
      <div class="modal-dialog max-w-lg">
        <div class="modal-header">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-secondary text-[24px]">alt_route</span>
            <h3 class="modal-title">Alihkan Batch Cadangan Gudang B</h3>
          </div>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div class="modal-body text-xs">
          <p class="text-on-surface-variant">
            Alihkan pemenuhan pesanan <b>${window.ArbaUtils.escapeHtml(order.id)}</b> untuk <b>${window.ArbaUtils.escapeHtml(order.outletName)}</b> ke batch cadangan Gudang B.
          </p>
        </div>

        <div class="modal-footer">
          <button onclick="window.ArbaApp.closeModal()" class="btn btn-outline" type="button">
            Batal
          </button>
          <button id="btn-confirm-substitute" class="btn btn-primary" type="button">
            Konfirmasi &amp; Alokasikan
          </button>
        </div>
      </div>
    `;

    window.ArbaApp.openModal(modalHtml);

    setTimeout(function () {
      var btnConfirm = document.getElementById('btn-confirm-substitute');
      if (btnConfirm) {
        btnConfirm.onclick = function () {
          window.ArbaStore.approveOrder(order.id);
          window.ArbaApp.showToast('Batch pengganti Gudang B berhasil dialokasikan & pesanan disetujui!', 'task_alt');
          window.ArbaApp.closeModal();
        };
      }
    }, 50);
  }

  // Modal 3: Sesuaikan Kuantitas SKU
  function openAdjustQtyModal(order) {
    var modalHtml = `
      <div class="modal-dialog max-w-md">
        <div class="modal-header">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-amber-600 text-[24px]">tune</span>
            <h3 class="modal-title">Koreksi Kuantitas SKU Pesanan</h3>
          </div>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form id="form-adjust-order-qty">
          <div class="modal-body text-xs">
            <div class="bg-surface-container-low p-3 rounded-lg text-xs space-y-1">
              <span class="text-on-surface-variant">Outlet:</span>
              <span class="font-bold text-on-surface block">${window.ArbaUtils.escapeHtml(order.outletName)}</span>
              <span class="text-slate-500 font-mono">Invoice Ref: ${window.ArbaUtils.escapeHtml(order.clientUuid)}</span>
            </div>

            <div class="flex flex-col gap-1">
              <label class="font-semibold text-on-surface-variant">Pilih SKU yang Disesuaikan:</label>
              <select id="adj-order-sku" class="p-2 bg-surface-container-low rounded-lg border border-border-subtle/40 text-on-surface cursor-pointer">
                ${order.items.map(function (it) {
                  return `<option value="${window.ArbaUtils.escapeHtml(it.sku)}">${window.ArbaUtils.escapeHtml(it.name)} (Saat ini: ${it.quantity} botol)</option>`;
                }).join('')}
              </select>
            </div>

            <div class="flex flex-col gap-1">
              <label class="font-semibold text-on-surface-variant">Kuantitas Baru Disetujui (Botol):</label>
              <input id="adj-order-qty" type="number" min="1" value="${order.items[0]?.quantity || 10}" required class="p-2 bg-surface-container-low rounded-lg border border-border-subtle/40 text-on-surface font-bold text-sm" />
            </div>
          </div>

          <div class="modal-footer">
            <button onclick="window.ArbaApp.closeModal()" class="btn btn-outline" type="button">
              Batal
            </button>
            <button type="submit" class="btn btn-primary">
              Simpan Perubahan
            </button>
          </div>
        </form>
      </div>
    `;

    window.ArbaApp.openModal(modalHtml);

    setTimeout(function () {
      var selectSku = document.getElementById('adj-order-sku');
      var inputQty = document.getElementById('adj-order-qty');
      if (selectSku && inputQty) {
        selectSku.onchange = function (e) {
          var it = order.items.find(function (item) { return item.sku === e.target.value; });
          if (it) inputQty.value = it.quantity;
        };
      }

      var form = document.getElementById('form-adjust-order-qty');
      if (form) {
        form.onsubmit = function (e) {
          e.preventDefault();
          window.ArbaStore.adjustOrderQuantity({
            orderId: order.id,
            sku: selectSku.value,
            newQty: Number(inputQty.value)
          });
          window.ArbaApp.closeModal();
        };
      }
    }, 50);
  }

  // Modal 4: Reject Order Modal
  function openRejectOrderModal(order) {
    var modalHtml = `
      <div class="modal-dialog max-w-md">
        <div class="modal-header">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-rose-600 text-[24px]">block</span>
            <h3 class="modal-title">Konfirmasi Pembatalan / Rejeksi Pesanan</h3>
          </div>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form id="form-reject-order">
          <div class="modal-body text-xs">
            <div class="bg-surface-container-low p-3 rounded-lg text-xs space-y-1">
              <span class="text-on-surface-variant">Pesanan:</span>
              <span class="font-bold text-on-surface block">${window.ArbaUtils.escapeHtml(order.outletName)}</span>
              <span class="text-slate-500 font-mono">${window.ArbaUtils.escapeHtml(order.clientUuid)} • ${window.ArbaUtils.formatRupiah(order.totalAmount)}</span>
            </div>

            <div class="flex flex-col gap-1">
              <label class="font-semibold text-on-surface-variant">Alasan Rejeksi / Pembatalan:</label>
              <select id="reject-reason" class="p-2 bg-surface-container-low rounded-lg border border-border-subtle/40 text-on-surface cursor-pointer">
                <option value="Plafon kredit mitra terlampaui">Plafon kredit mitra terlampaui</option>
                <option value="Legalitas SIPA / Izin Apotek Kadaluarsa">Legalitas SIPA / Izin Apotek Kadaluarsa</option>
                <option value="Permintaan pembatalan oleh Apoteker / PIC Outlet">Permintaan pembatalan oleh Apoteker / PIC Outlet</option>
                <option value="Alokasi batch fisik di gudang habis">Alokasi batch fisik di gudang habis</option>
                <option value="Alamat pengiriman di luar jangkauan armada Solo Raya">Alamat pengiriman di luar jangkauan armada Solo Raya</option>
              </select>
            </div>

            <div class="p-2.5 bg-status-danger-bg text-rose-600 rounded-lg text-[11px] font-semibold flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[16px]">info</span>
              <span>Pesanan yang ditolak akan dipindahkan ke tab Void/Rejeksi untuk audit CDOB.</span>
            </div>
          </div>

          <div class="modal-footer">
            <button onclick="window.ArbaApp.closeModal()" class="btn btn-outline" type="button">
              Batal
            </button>
            <button type="submit" class="btn btn-danger">
              Tolak Pesanan Ini
            </button>
          </div>
        </form>
      </div>
    `;

    window.ArbaApp.openModal(modalHtml);

    setTimeout(function () {
      var form = document.getElementById('form-reject-order');
      if (form) {
        form.onsubmit = function (e) {
          e.preventDefault();
          var reason = document.getElementById('reject-reason').value;
          window.ArbaStore.rejectOrder(order.id, reason);
          window.ArbaApp.closeModal();
        };
      }
    }, 50);
  }

  window.ArbaViews.renderOrderApproval = renderOrderApproval;
})();
