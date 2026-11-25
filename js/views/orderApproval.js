/**
 * ArbaConnect ERP - Order Approval Queue View
 */

(function () {
  'use strict';

  window.ArbaViews = window.ArbaViews || {};

  var state = {
    activeTab: 'pending',
    selectedSalesRep: 'all',
    selectedSort: 'latest',
    selectedOrderIds: []
  };

  function renderOrderApproval(container) {
    var appState = window.ArbaStore.getState();
    var orders = appState.orders || [];
    var driverManifests = appState.driverManifests || [];
    var salesTeam = appState.salesTeam || [];
    var ledger = appState.ledger || [];

    var pendingOrders = orders.filter(function (o) { return o.status === 'PENDING'; });
    var approvedOrders = orders.filter(function (o) { return o.status === 'APPROVED'; });
    var rejectedOrders = orders.filter(function (o) { return o.status === 'REJECTED'; });
    var manifestOrderCount = driverManifests.reduce(function (sum, m) { return sum + (m.orders ? m.orders.length : 0); }, 0);

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
      return (b.orderTimestamp || 0) - (a.orderTimestamp || 0);
    });

    var focusedOrder = displayedOrders.find(function (o) {
      return state.selectedOrderIds.indexOf(o.id) !== -1;
    }) || displayedOrders[0];

    var html = `
      <div class="flex flex-col w-full gap-space-lg pb-space-xl">
        <!-- Page Header -->
        <div class="page-header">
          <div>
            <h1 class="page-title">Verifikasi Order &amp; Pengiriman</h1>
            <p class="page-meta">Persetujuan faktur, alokasi batch FEFO, dan surat jalan armada</p>
          </div>
        </div>

        <!-- Status Tabs (Live Counts) -->
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
              <span class="text-xs uppercase tracking-wider font-semibold opacity-90">Menunggu</span>
              <span class="material-symbols-outlined text-[18px]">pending_actions</span>
            </div>
            <div class="text-2xl font-bold">${pendingOrders.length} <span class="text-xs font-normal opacity-80">Faktur</span></div>
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
              <span class="text-xs uppercase tracking-wider font-semibold opacity-90">Disetujui</span>
              <span class="material-symbols-outlined text-[18px]">task_alt</span>
            </div>
            <div class="text-2xl font-bold">${approvedOrders.length} <span class="text-xs font-normal opacity-80">Faktur</span></div>
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
              <span class="text-xs uppercase tracking-wider font-semibold opacity-90">Pengiriman</span>
              <span class="material-symbols-outlined text-[18px]">local_shipping</span>
            </div>
            <div class="text-2xl font-bold">${manifestOrderCount} <span class="text-xs font-normal opacity-80">Titik</span></div>
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
              <span class="text-xs uppercase tracking-wider font-semibold opacity-90">Ditolak</span>
              <span class="material-symbols-outlined text-[18px]">cancel</span>
            </div>
            <div class="text-2xl font-bold">${rejectedOrders.length} <span class="text-xs font-normal opacity-80">Faktur</span></div>
          </button>
        </div>

        <!-- Filter & Collective Action Bar -->
        <div class="section-card flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-2">
            <select id="select-sales-rep" class="form-select w-auto min-w-[210px]">
              <option value="all" ${state.selectedSalesRep === 'all' ? 'selected' : ''}>Semua Sales Rep</option>
              ${salesTeam.map(function (rep) {
                var selected = state.selectedSalesRep.toLowerCase() === rep.name.toLowerCase();
                return `<option value="${window.ArbaUtils.escapeHtml(rep.name)}" ${selected ? 'selected' : ''}>${window.ArbaUtils.escapeHtml(rep.name)} (${window.ArbaUtils.escapeHtml(rep.area)})</option>`;
              }).join('')}
            </select>

            <select id="select-sort-order" class="form-select w-auto min-w-[210px]">
              <option value="latest" ${state.selectedSort === 'latest' ? 'selected' : ''}>Terbaru</option>
              <option value="urgency" ${state.selectedSort === 'urgency' ? 'selected' : ''}>Urgensi</option>
              <option value="highest_val" ${state.selectedSort === 'highest_val' ? 'selected' : ''}>Nilai Tertinggi</option>
              <option value="credit_risk" ${state.selectedSort === 'credit_risk' ? 'selected' : ''}>Sisa Plafon Terkecil</option>
            </select>

            <label class="inline-flex items-center gap-2 cursor-pointer text-xs pl-2">
              <input
                id="checkbox-select-all"
                ${state.selectedOrderIds.length === displayedOrders.length && displayedOrders.length > 0 ? 'checked' : ''}
                class="w-4 h-4 rounded accent-primary cursor-pointer"
                type="checkbox"
              />
              <span class="text-on-surface-variant font-semibold">Pilih Semua (${displayedOrders.length})</span>
            </label>
          </div>

          <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button id="btn-batch-print" class="btn btn-outline" type="button">
              <span class="material-symbols-outlined text-[16px]">print</span>
              <span>Cetak Surat Jalan</span>
            </button>
            <button id="btn-batch-approve" class="btn btn-primary" type="button">
              <span class="material-symbols-outlined text-[18px]">checklist</span>
              <span>Setujui Terpilih</span>
            </button>
          </div>
        </div>

        <!-- Main Tab Content -->
        <div class="flex flex-col gap-4">
          ${state.activeTab === 'manifest' ? `
            <div class="section-card flex flex-col gap-4">
              <div class="section-header">
                <div>
                  <h2 class="section-title">Manifest Pengiriman Armada</h2>
                  <p class="text-xs text-on-surface-variant">Konfirmasi serah terima pengiriman (POD)</p>
                </div>
                <button type="button" id="btn-print-manifests" class="btn btn-primary">
                  <span class="material-symbols-outlined text-[16px]">print</span>
                  <span>Cetak Manifest</span>
                </button>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${driverManifests.map(function (manifest) {
                  return `
                    <div class="p-4 rounded-xl border border-border-subtle bg-surface-container-low/40 flex flex-col justify-between gap-3">
                      <div class="flex items-center justify-between pb-3 border-b border-border-subtle">
                        <div>
                          <div class="font-bold text-sm text-on-surface">${window.ArbaUtils.escapeHtml(manifest.vehiclePlate)}</div>
                          <div class="text-xs text-on-surface-variant">Sopir: <b>${window.ArbaUtils.escapeHtml(manifest.driverName)}</b> · ${window.ArbaUtils.escapeHtml(manifest.wave)}</div>
                        </div>
                        <span class="badge badge-primary">${window.ArbaUtils.escapeHtml(manifest.routeArea)}</span>
                      </div>

                      <div class="space-y-2">
                        ${manifest.orders.map(function (ord) {
                          return `
                            <div class="p-3 rounded-lg bg-surface-container-lowest border border-border-subtle/50 flex items-center justify-between gap-2 text-xs">
                              <div>
                                <div class="font-bold text-on-surface">${window.ArbaUtils.escapeHtml(ord.outletName)}</div>
                                <div class="text-on-surface-variant">${window.ArbaUtils.escapeHtml(ord.address)}</div>
                                <div class="font-mono text-primary font-semibold mt-0.5">${window.ArbaUtils.formatRupiah(ord.amount)}</div>
                              </div>
                              <div>
                                ${ord.delivered ? `
                                  <span class="badge badge-success">Terkirim (${window.ArbaUtils.escapeHtml(ord.deliveredTime)})</span>
                                ` : `
                                  <button
                                    type="button"
                                    class="btn-pod-confirm btn btn-sm btn-secondary"
                                    data-order-id="${ord.orderId}"
                                    data-driver-name="${window.ArbaUtils.escapeHtml(manifest.driverName)}"
                                  >
                                    Konfirmasi POD
                                  </button>
                                `}
                              </div>
                            </div>
                          `;
                        }).join('')}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : state.activeTab === 'rejected' ? `
            <div class="section-card">
              <h2 class="section-title text-rose-600 mb-3">Pesanan Ditolak / Void</h2>
              ${rejectedOrders.length === 0 ? `
                <div class="p-8 text-center text-on-surface-variant text-xs">Tidak ada pesanan yang ditolak.</div>
              ` : `
                <div class="divide-y divide-border-subtle/40">
                  ${rejectedOrders.map(function (ord) {
                    return `
                      <div class="py-3 flex items-center justify-between text-xs">
                        <div>
                          <div class="font-bold text-on-surface text-sm">${window.ArbaUtils.escapeHtml(ord.outletName)}</div>
                          <div class="text-on-surface-variant font-mono">${window.ArbaUtils.escapeHtml(ord.clientUuid)} · ${window.ArbaUtils.formatRupiah(ord.totalAmount)} · ${window.ArbaUtils.escapeHtml(ord.salesRep)}</div>
                        </div>
                        <div class="flex items-center gap-2">
                          <span class="badge badge-danger">Ditolak</span>
                          <button type="button" class="btn-restore-order btn btn-sm btn-outline" data-order-id="${ord.id}">
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
            <div class="section-card p-12 text-center">
              <span class="material-symbols-outlined text-4xl text-on-surface-variant mb-2">inbox</span>
              <h3 class="font-bold text-on-surface text-base">Tidak ada pesanan dalam status ini</h3>
            </div>
          ` : `
            <!-- Focused Order Detail Card -->
            ${focusedOrder ? `
              <div class="section-card flex flex-col gap-4">
                <div class="flex flex-col xl:flex-row xl:items-start justify-between gap-4 pb-4 border-b border-border-subtle">
                  <div class="flex items-start gap-3">
                    <input
                      class="order-checkbox mt-1 w-5 h-5 rounded accent-primary cursor-pointer"
                      type="checkbox"
                      data-order-id="${focusedOrder.id}"
                      ${state.selectedOrderIds.indexOf(focusedOrder.id) !== -1 ? 'checked' : ''}
                    />
                    <div>
                      <div class="flex flex-wrap items-center gap-2 mb-1">
                        <span class="badge badge-neutral font-mono">${window.ArbaUtils.escapeHtml(focusedOrder.clientUuid)}</span>
                        <span class="badge ${focusedOrder.status === 'APPROVED' ? 'badge-success' : 'badge-warning'}">${window.ArbaUtils.escapeHtml(focusedOrder.status)}</span>
                        ${focusedOrder.priority === 'High' ? `<span class="badge badge-danger">Prioritas</span>` : ''}
                      </div>
                      <h2 class="text-xl font-bold text-on-surface">${window.ArbaUtils.escapeHtml(focusedOrder.outletName)}</h2>
                      <div class="text-xs text-on-surface-variant mt-1">
                        ${window.ArbaUtils.escapeHtml(focusedOrder.address)} · ${window.ArbaUtils.escapeHtml(focusedOrder.orderTime)} · Sales: <b>${window.ArbaUtils.escapeHtml(focusedOrder.salesRep)}</b>
                      </div>
                    </div>
                  </div>

                  <div class="bg-surface-container-low p-3 rounded-xl border border-border-subtle/50 min-w-[260px] text-xs">
                    <div class="text-on-surface-variant uppercase font-semibold text-[10px]">Total Faktur</div>
                    <div class="text-xl font-bold text-primary font-mono">${window.ArbaUtils.formatRupiah(focusedOrder.totalAmount)}</div>
                    <div class="text-on-surface-variant mt-1">
                      Termin: <b>${window.ArbaUtils.escapeHtml(focusedOrder.terms)}</b> · Sisa Limit: <b>${window.ArbaUtils.formatRupiah(focusedOrder.limitRemaining)}</b>
                    </div>
                  </div>
                </div>

                ${(focusedOrder.signatureDataUrl || focusedOrder.shelfPhotoDataUrl) ? `
                  <div class="p-3 rounded-xl bg-surface-container-low border border-border-subtle flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div>
                      <div class="font-bold text-on-surface">Lampiran Serah Terima</div>
                      <div class="text-on-surface-variant">PIC: ${window.ArbaUtils.escapeHtml(focusedOrder.signerName || 'Apoteker')}</div>
                    </div>
                    <div class="flex items-center gap-3">
                      ${focusedOrder.signatureDataUrl ? `<img src="${focusedOrder.signatureDataUrl}" alt="TTD" style="height:36px; background:#fff; padding:2px 6px; border-radius:6px; border:1px solid #cbd5e1;" />` : ''}
                      ${focusedOrder.shelfPhotoDataUrl ? `<img src="${focusedOrder.shelfPhotoDataUrl}" alt="Foto Etalase" style="height:40px; width:80px; object-fit:cover; border-radius:6px; border:1px solid #cbd5e1;" />` : ''}
                    </div>
                  </div>
                ` : ''}

                <div class="table-container">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Produk</th>
                        <th>Batch &amp; Kedaluwarsa</th>
                        <th class="text-center">Qty</th>
                        <th class="text-right">Harga</th>
                        <th class="text-right">Subtotal</th>
                        <th class="text-center">Stok</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${focusedOrder.items.map(function (it) {
                        return `
                          <tr>
                            <td>
                              <div class="font-semibold text-on-surface">${window.ArbaUtils.escapeHtml(it.name)}</div>
                              <div class="font-mono text-[11px] text-on-surface-variant">${window.ArbaUtils.escapeHtml(it.sku)}</div>
                            </td>
                            <td>
                              <div class="font-mono font-semibold text-primary">${window.ArbaUtils.escapeHtml(it.batch)}</div>
                              <div class="text-[11px] text-on-surface-variant">${window.ArbaUtils.escapeHtml(it.expiry)}</div>
                            </td>
                            <td class="text-center font-bold">${it.quantity}</td>
                            <td class="text-right font-mono">${window.ArbaUtils.formatRupiah(it.unitPrice)}</td>
                            <td class="text-right font-mono font-semibold">${window.ArbaUtils.formatRupiah(it.subtotal)}</td>
                            <td class="text-center"><span class="badge badge-success">Sisa ${it.remainingBatchStock}</span></td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>

                <div class="flex flex-wrap items-center justify-end gap-2 pt-2">
                  <div class="relative">
                    <button id="btn-action-dropdown" class="btn btn-outline" type="button">
                      <span>Opsi</span>
                      <span class="material-symbols-outlined text-[18px]">arrow_drop_down</span>
                    </button>
                    <div id="action-dropdown-menu" class="hidden absolute right-0 bottom-full mb-1 bg-surface-container-lowest shadow-xl rounded-xl p-1.5 min-w-[200px] z-30 border border-border-subtle">
                      <button class="btn-adjust-qty-trigger w-full text-left flex items-center gap-2 px-3 py-2 text-on-surface hover:bg-surface-container-low rounded-lg text-xs cursor-pointer border-0 bg-transparent" data-order-id="${focusedOrder.id}" type="button">
                        <span class="material-symbols-outlined text-[18px]">tune</span>
                        <span>Ubah Kuantitas</span>
                      </button>
                      <button class="btn-substitute-batch-trigger w-full text-left flex items-center gap-2 px-3 py-2 text-on-surface hover:bg-surface-container-low rounded-lg text-xs cursor-pointer border-0 bg-transparent" data-order-id="${focusedOrder.id}" type="button">
                        <span class="material-symbols-outlined text-[18px]">swap_horiz</span>
                        <span>Alihkan Batch</span>
                      </button>
                      <button class="btn-reject-order-trigger w-full text-left flex items-center gap-2 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-lg text-xs cursor-pointer border-0 bg-transparent" data-order-id="${focusedOrder.id}" type="button">
                        <span class="material-symbols-outlined text-[18px]">block</span>
                        <span>Tolak Pesanan</span>
                      </button>
                    </div>
                  </div>

                  <button class="btn-print-surat-jalan btn btn-outline" data-order-id="${focusedOrder.id}" type="button">
                    <span class="material-symbols-outlined text-[18px]">print</span>
                    <span>Surat Jalan</span>
                  </button>

                  ${focusedOrder.status === 'PENDING' ? `
                    <button class="btn-approve-single btn btn-primary" data-order-id="${focusedOrder.id}" type="button">
                      <span class="material-symbols-outlined text-[18px]">check_circle</span>
                      <span>Setujui Pesanan</span>
                    </button>
                  ` : `
                    <span class="badge badge-success">Sudah Disetujui</span>
                  `}
                </div>
              </div>
            ` : ''}

            <!-- Other Orders in Queue -->
            <div class="space-y-2.5">
              ${displayedOrders.filter(function (o) { return !focusedOrder || o.id !== focusedOrder.id; }).map(function (order) {
                var isWarningState = !!order.stockWarning;
                var isChecked = state.selectedOrderIds.indexOf(order.id) !== -1;

                return `
                  <div class="section-card p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${isWarningState ? 'border-l-4 border-l-badge-amber' : ''}">
                    <div class="flex items-center gap-3">
                      <input class="order-checkbox w-4 h-4 rounded accent-primary cursor-pointer" type="checkbox" data-order-id="${order.id}" ${isChecked ? 'checked' : ''} />
                      <div>
                        <div class="flex items-center gap-2 flex-wrap text-xs mb-1">
                          <span class="badge badge-neutral font-mono">${window.ArbaUtils.escapeHtml(order.clientUuid.slice(0, 12))}</span>
                          <span class="badge ${order.status === 'APPROVED' ? 'badge-success' : isWarningState ? 'badge-warning' : 'badge-primary'}">
                            ${order.status === 'APPROVED' ? 'Disetujui' : isWarningState ? 'Kurang Stok' : 'Siap Potong'}
                          </span>
                          <span class="text-on-surface-variant">${window.ArbaUtils.escapeHtml(order.orderTime)} · ${window.ArbaUtils.escapeHtml(order.salesRep)}</span>
                        </div>
                        <button type="button" class="btn-focus-order text-left font-bold text-sm text-on-surface hover:text-primary cursor-pointer bg-transparent border-0 p-0" data-order-id="${order.id}">
                          ${window.ArbaUtils.escapeHtml(order.outletName)}
                        </button>
                        <div class="text-xs text-on-surface-variant">
                          ${window.ArbaUtils.escapeHtml(order.stockWarning || (order.items.length + ' SKU'))}
                        </div>
                      </div>
                    </div>

                    <div class="flex items-center justify-between lg:justify-end gap-4">
                      <div class="text-left lg:text-right">
                        <div class="font-bold text-primary font-mono">${window.ArbaUtils.formatRupiah(order.totalAmount)}</div>
                        <div class="text-[11px] text-on-surface-variant">${window.ArbaUtils.escapeHtml(order.terms)}</div>
                      </div>
                      <div class="flex items-center gap-2">
                        ${isWarningState ? `
                          <button class="btn-substitute-batch-trigger btn btn-sm btn-outline" data-order-id="${order.id}" type="button">Alihkan Batch</button>
                        ` : `
                          <button class="btn-print-surat-jalan icon-btn" data-order-id="${order.id}" title="Surat Jalan" type="button">
                            <span class="material-symbols-outlined text-[18px]">print</span>
                          </button>
                          ${order.status === 'PENDING' ? `
                            <button class="btn-approve-single btn btn-sm btn-primary" data-order-id="${order.id}" type="button">Setujui</button>
                          ` : ''}
                        `}
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <!-- Live Ledger & Fleet Summary -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div class="lg:col-span-7 section-card flex flex-col justify-between gap-3">
            <div>
              <div class="flex items-center justify-between mb-3">
                <h3 class="section-title">Mutasi Stok Terbaru</h3>
                <button id="btn-goto-stock-ledger" class="text-xs text-primary font-semibold hover:underline cursor-pointer bg-transparent border-0" type="button">
                  Lihat Semua →
                </button>
              </div>
              <div class="space-y-2">
                ${ledger.slice(0, 3).map(function (entry) {
                  return `
                    <div class="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low text-xs">
                      <div class="min-w-0 pr-2">
                        <div class="font-semibold text-on-surface truncate">${window.ArbaUtils.escapeHtml(entry.skuName)} (${entry.quantity > 0 ? '+' + entry.quantity : entry.quantity})</div>
                        <div class="text-[11px] text-on-surface-variant font-mono">${window.ArbaUtils.escapeHtml(entry.docRef)} · ${window.ArbaUtils.escapeHtml(entry.timestamp)}</div>
                      </div>
                      <span class="badge ${entry.type === 'KELUAR' ? 'badge-danger' : 'badge-success'}">${window.ArbaUtils.escapeHtml(entry.type)}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>

          <div class="lg:col-span-5 section-card flex flex-col justify-between gap-3">
            <div>
              <div class="flex items-center justify-between mb-3">
                <h3 class="section-title">Armada Pengiriman</h3>
                <span class="badge badge-neutral">${driverManifests.length} Rute</span>
              </div>
              <div class="grid grid-cols-2 gap-2 text-xs">
                ${driverManifests.map(function (m) {
                  return `
                    <div class="p-2.5 bg-surface-container-low rounded-lg border border-border-subtle/40">
                      <div class="text-[11px] text-on-surface-variant font-mono">${window.ArbaUtils.escapeHtml(m.vehiclePlate)}</div>
                      <div class="font-bold text-on-surface text-base">${m.orders ? m.orders.length : 0} Outlet</div>
                      <div class="text-[11px] text-primary font-semibold truncate">${window.ArbaUtils.escapeHtml(m.routeArea)}</div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
    bindEvents(container);
  }

  function bindEvents(container) {
    var tabPending = container.querySelector('#tab-pending');
    var tabApproved = container.querySelector('#tab-approved');
    var tabManifest = container.querySelector('#tab-manifest');
    var tabRejected = container.querySelector('#tab-rejected');

    if (tabPending) tabPending.addEventListener('click', function () { state.activeTab = 'pending'; renderOrderApproval(container); });
    if (tabApproved) tabApproved.addEventListener('click', function () { state.activeTab = 'approved'; renderOrderApproval(container); });
    if (tabManifest) tabManifest.addEventListener('click', function () { state.activeTab = 'manifest'; renderOrderApproval(container); });
    if (tabRejected) tabRejected.addEventListener('click', function () { state.activeTab = 'rejected'; renderOrderApproval(container); });

    var repSelect = container.querySelector('#select-sales-rep');
    if (repSelect) {
      repSelect.addEventListener('change', function (e) {
        state.selectedSalesRep = e.target.value;
        renderOrderApproval(container);
      });
    }

    var sortSelect = container.querySelector('#select-sort-order');
    if (sortSelect) {
      sortSelect.addEventListener('change', function (e) {
        state.selectedSort = e.target.value;
        renderOrderApproval(container);
      });
    }

    container.querySelectorAll('.btn-focus-order').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var oid = btn.getAttribute('data-order-id');
        if (oid) {
          state.selectedOrderIds = [oid];
          renderOrderApproval(container);
        }
      });
    });

    var selectAll = container.querySelector('#checkbox-select-all');
    if (selectAll) {
      selectAll.addEventListener('change', function (e) {
        var orders = window.ArbaStore.getState().orders;
        state.selectedOrderIds = e.target.checked ? orders.map(function (o) { return o.id; }) : [];
        renderOrderApproval(container);
      });
    }

    container.querySelectorAll('.order-checkbox').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var orderId = cb.getAttribute('data-order-id');
        var idx = state.selectedOrderIds.indexOf(orderId);
        if (cb.checked && idx === -1) state.selectedOrderIds.push(orderId);
        else if (!cb.checked && idx !== -1) state.selectedOrderIds.splice(idx, 1);
        renderOrderApproval(container);
      });
    });

    var btnBatchPrint = container.querySelector('#btn-batch-print');
    if (btnBatchPrint) {
      btnBatchPrint.addEventListener('click', function () {
        var orders = window.ArbaStore.getState().orders;
        var targetOrder = orders.find(function (o) { return state.selectedOrderIds.indexOf(o.id) !== -1; }) || orders[0];
        if (targetOrder) openSuratJalanModal(targetOrder);
      });
    }

    var btnBatchApprove = container.querySelector('#btn-batch-approve');
    if (btnBatchApprove) {
      btnBatchApprove.addEventListener('click', function () {
        if (state.selectedOrderIds.length === 0) {
          window.ArbaApp.showToast('Pilih minimal satu pesanan', 'warning');
          return;
        }
        window.ArbaStore.batchApproveOrders(state.selectedOrderIds);
        state.selectedOrderIds = [];
      });
    }

    container.querySelectorAll('.btn-approve-single').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.ArbaStore.approveOrder(btn.getAttribute('data-order-id'));
      });
    });

    container.querySelectorAll('.btn-print-surat-jalan').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var order = window.ArbaStore.getState().orders.find(function (o) { return o.id === btn.getAttribute('data-order-id'); });
        if (order) openSuratJalanModal(order);
      });
    });

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

    container.querySelectorAll('.btn-adjust-qty-trigger').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var order = window.ArbaStore.getState().orders.find(function (o) { return o.id === btn.getAttribute('data-order-id'); });
        if (order) openAdjustQtyModal(order);
      });
    });

    container.querySelectorAll('.btn-substitute-batch-trigger').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var order = window.ArbaStore.getState().orders.find(function (o) { return o.id === btn.getAttribute('data-order-id'); });
        if (order) openSubstituteBatchModal(order);
      });
    });

    container.querySelectorAll('.btn-reject-order-trigger').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var order = window.ArbaStore.getState().orders.find(function (o) { return o.id === btn.getAttribute('data-order-id'); });
        if (order) openRejectOrderModal(order);
      });
    });

    container.querySelectorAll('.btn-restore-order').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.ArbaStore.approveOrder(btn.getAttribute('data-order-id'));
      });
    });

    container.querySelectorAll('.btn-pod-confirm').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.ArbaStore.markOrderDelivered(btn.getAttribute('data-order-id'), btn.getAttribute('data-driver-name'));
      });
    });

    var btnPrintMan = container.querySelector('#btn-print-manifests');
    if (btnPrintMan) btnPrintMan.addEventListener('click', function () { window.print(); });

    var btnGoLedger = container.querySelector('#btn-goto-stock-ledger');
    if (btnGoLedger) btnGoLedger.addEventListener('click', function () { window.ArbaApp.navigate('inventory-stock-ledger'); });
  }

  function openSuratJalanModal(order) {
    var modalHtml = `
      <div class="modal-dialog max-w-2xl">
        <div class="modal-header">
          <h3 class="modal-title">Surat Jalan &amp; Faktur</h3>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()" type="button">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div class="modal-body">
          <div class="p-4 bg-white rounded-xl space-y-3 border border-slate-200 text-slate-800">
            <div class="flex justify-between items-start border-b pb-2">
              <div>
                <h4 class="font-bold text-lg text-teal-800">CV ARBA'IN SURAKARTA</h4>
                <p class="text-xs text-slate-500">Gudang Utama Kartasura</p>
              </div>
              <div class="text-right text-xs">
                <p class="font-bold text-sm">SURAT JALAN</p>
                <p class="font-mono text-teal-800 font-semibold">${window.ArbaUtils.escapeHtml(order.clientUuid)}</p>
                <p class="text-slate-500">${window.ArbaUtils.escapeHtml(order.orderTime)}</p>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <p class="text-slate-500 font-semibold">Tujuan:</p>
                <p class="font-bold text-slate-800 text-sm">${window.ArbaUtils.escapeHtml(order.outletName)}</p>
                <p class="text-slate-600">${window.ArbaUtils.escapeHtml(order.address)}, ${window.ArbaUtils.escapeHtml(order.city)}</p>
              </div>
              <div>
                <p class="text-slate-500 font-semibold">Pembayaran:</p>
                <p class="font-bold text-slate-800">${window.ArbaUtils.escapeHtml(order.terms)}</p>
                <p class="text-slate-600">Sales: ${window.ArbaUtils.escapeHtml(order.salesRep)}</p>
              </div>
            </div>

            <table class="w-full text-xs text-left border-collapse border border-slate-300">
              <thead>
                <tr class="bg-slate-200 text-slate-700">
                  <th class="border border-slate-300 p-2">No</th>
                  <th class="border border-slate-300 p-2">Produk</th>
                  <th class="border border-slate-300 p-2">Batch</th>
                  <th class="border border-slate-300 p-2 text-center">Qty</th>
                  <th class="border border-slate-300 p-2 text-right">Harga</th>
                  <th class="border border-slate-300 p-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${order.items.map(function (it, idx) {
                  return `
                    <tr>
                      <td class="border border-slate-300 p-2">${idx + 1}</td>
                      <td class="border border-slate-300 p-2 font-medium">${window.ArbaUtils.escapeHtml(it.name)}</td>
                      <td class="border border-slate-300 p-2 font-mono text-[11px]">${window.ArbaUtils.escapeHtml(it.batch)} (${window.ArbaUtils.escapeHtml(it.expiry)})</td>
                      <td class="border border-slate-300 p-2 text-center font-bold">${it.quantity}</td>
                      <td class="border border-slate-300 p-2 text-right font-mono">${window.ArbaUtils.formatRupiah(it.unitPrice)}</td>
                      <td class="border border-slate-300 p-2 text-right font-mono font-bold">${window.ArbaUtils.formatRupiah(it.subtotal)}</td>
                    </tr>
                  `;
                }).join('')}
                <tr class="bg-slate-100 font-bold">
                  <td colspan="5" class="border border-slate-300 p-2 text-right">TOTAL:</td>
                  <td class="border border-slate-300 p-2 text-right font-mono text-teal-800 text-sm">${window.ArbaUtils.formatRupiah(order.totalAmount)}</td>
                </tr>
              </tbody>
            </table>

            <div class="grid grid-cols-3 gap-2 pt-4 text-center text-xs text-slate-600">
              <div class="border-t border-slate-300 pt-8">Penerima Outlet</div>
              <div class="border-t border-slate-300 pt-8">Sopir</div>
              <div class="border-t border-slate-300 pt-8">Gudang Kartasura</div>
            </div>
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

  function openSubstituteBatchModal(order) {
    var firstItem = (order.items && order.items[0]) || { sku: '', name: 'Produk', batch: '-' };

    var modalHtml = `
      <div class="modal-dialog max-w-lg">
        <div class="modal-header">
          <h3 class="modal-title">Alihkan Batch Cadangan</h3>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()" type="button">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form id="form-substitute-batch">
          <div class="modal-body text-xs">
            <div class="p-3 bg-surface-container-low rounded-lg">
              <div class="font-bold text-on-surface">${window.ArbaUtils.escapeHtml(order.outletName)}</div>
              <div class="text-on-surface-variant font-mono">${window.ArbaUtils.escapeHtml(order.clientUuid)}</div>
            </div>

            <div class="form-group">
              <label class="form-label">Item Pesanan</label>
              <select id="sub-sku" class="form-select">
                ${order.items.map(function (it) {
                  return `<option value="${window.ArbaUtils.escapeHtml(it.sku)}">${window.ArbaUtils.escapeHtml(it.name)} (${window.ArbaUtils.escapeHtml(it.batch)})</option>`;
                }).join('')}
              </select>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Batch Pengganti</label>
                <input id="sub-batch" type="text" required value="BATCH-CADANGAN-B" class="form-input font-mono" />
              </div>
              <div class="form-group">
                <label class="form-label">Gudang Sumber</label>
                <select id="sub-warehouse" class="form-select">
                  <option value="Gudang B Solo Baru">Gudang B Solo Baru</option>
                  <option value="Gudang Kartasura Rak 2">Gudang Kartasura Rak 2</option>
                </select>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button onclick="window.ArbaApp.closeModal()" class="btn btn-outline" type="button">Batal</button>
            <button type="submit" class="btn btn-primary">Alihkan &amp; Setujui</button>
          </div>
        </form>
      </div>
    `;

    window.ArbaApp.openModal(modalHtml);

    setTimeout(function () {
      var form = document.getElementById('form-substitute-batch');
      if (form) {
        form.onsubmit = function (e) {
          e.preventDefault();
          var sku = document.getElementById('sub-sku').value || firstItem.sku;
          var newBatch = document.getElementById('sub-batch').value;
          var sourceWarehouse = document.getElementById('sub-warehouse').value;
          window.ArbaStore.substituteOrderBatch({
            orderId: order.id,
            sku: sku,
            newBatch: newBatch,
            sourceWarehouse: sourceWarehouse
          });
          window.ArbaStore.approveOrder(order.id);
          window.ArbaApp.closeModal();
        };
      }
    }, 50);
  }

  function openAdjustQtyModal(order) {
    var modalHtml = `
      <div class="modal-dialog max-w-md">
        <div class="modal-header">
          <h3 class="modal-title">Ubah Kuantitas Pesanan</h3>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()" type="button">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form id="form-adjust-order-qty">
          <div class="modal-body text-xs">
            <div class="bg-surface-container-low p-3 rounded-lg">
              <div class="font-bold text-on-surface">${window.ArbaUtils.escapeHtml(order.outletName)}</div>
              <div class="text-on-surface-variant font-mono">${window.ArbaUtils.escapeHtml(order.clientUuid)}</div>
            </div>

            <div class="form-group">
              <label class="form-label">Produk</label>
              <select id="adj-order-sku" class="form-select">
                ${order.items.map(function (it) {
                  return `<option value="${it.sku}">${it.name} (${it.quantity})</option>`;
                }).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Kuantitas Baru</label>
              <input id="adj-order-qty" type="number" min="1" value="${order.items[0] ? order.items[0].quantity : 10}" required class="form-input font-bold" />
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

  function openRejectOrderModal(order) {
    var modalHtml = `
      <div class="modal-dialog max-w-md">
        <div class="modal-header">
          <h3 class="modal-title">Tolak Pesanan</h3>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()" type="button">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form id="form-reject-order">
          <div class="modal-body text-xs">
            <div class="bg-surface-container-low p-3 rounded-lg">
              <div class="font-bold text-on-surface">${window.ArbaUtils.escapeHtml(order.outletName)}</div>
              <div class="text-on-surface-variant font-mono">${window.ArbaUtils.escapeHtml(order.clientUuid)} · ${window.ArbaUtils.formatRupiah(order.totalAmount)}</div>
            </div>

            <div class="form-group">
              <label class="form-label">Alasan Penolakan</label>
              <select id="reject-reason" class="form-select">
                <option value="Plafon kredit mitra terlampaui">Plafon kredit terlampaui</option>
                <option value="Legalitas SIPA / Izin Apotek Kadaluarsa">Izin apotek kadaluarsa</option>
                <option value="Permintaan pembatalan oleh PIC Outlet">Permintaan pembatalan outlet</option>
                <option value="Stok batch di gudang habis">Stok batch gudang habis</option>
                <option value="Di luar jangkauan rute armada">Di luar rute pengiriman</option>
              </select>
            </div>
          </div>

          <div class="modal-footer">
            <button onclick="window.ArbaApp.closeModal()" class="btn btn-outline" type="button">Batal</button>
            <button type="submit" class="btn btn-danger">Tolak Pesanan</button>
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
          window.ArbaStore.rejectOrder(order.id, document.getElementById('reject-reason').value);
          window.ArbaApp.closeModal();
        };
      }
    }, 50);
  }

  window.ArbaViews.renderOrderApproval = renderOrderApproval;
})();
