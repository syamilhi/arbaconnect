/**
 * ArbaConnect ERP - Field Sales Mobile View
 */

(function () {
  'use strict';

  window.ArbaViews = window.ArbaViews || {};

  var state = {
    activeTab: 'outlet', // 'outlet' | 'produk' | 'nota'
    selectedOutletCode: 'AP-SLO-001',
    activeCategory: 'all',
    productSearch: '',
    cart: {
      'SKU-ARB-MDR500': 6,
      'SKU-ARB-HBT100': 4
    },
    selectedTerm: 'Konsinyasi (Titip Jual)',
    orderNotes: '',
    signatureDataUrl: null,
    shelfPhotoDataUrl: null,
    scannedQrBatches: [],
    isSubmitting: false,
    gpsCheckedIn: false,
    gpsOutletCode: null,
    gpsDistance: null,
    gpsSource: null,
    gpsCoords: null,
    checkinTime: ''
  };

  function shortTerm(term) {
    if (!term) return '-';
    if (/konsinyasi/i.test(term)) return 'Konsinyasi';
    if (/net\s*14/i.test(term)) return 'Net 14 Hari';
    if (/cash|tunai/i.test(term)) return 'Tunai';
    return term;
  }

  function shortDivision(division) {
    if (!division) return 'Sales Lapangan';
    return division
      .replace(/^Divisi\s+/i, '')
      .replace(/\s*\(([^)]+)\)/, ' · $1')
      .trim();
  }

  function getCartItems(products) {
    return Object.keys(state.cart)
      .filter(function (sku) { return (state.cart[sku] || 0) > 0; })
      .map(function (sku) {
        var prod = products.find(function (p) { return p.sku === sku; });
        var qty = state.cart[sku] || 0;
        if (!prod) return null;
        return {
          sku: sku,
          product: prod,
          quantity: qty,
          subtotal: prod.unitPrice * qty
        };
      })
      .filter(Boolean);
  }

  function renderTopBar(appState, isFieldSalesRole, currentRep, repInitials, salesTeam, isOnline, offlineQueue) {
    var divisionLabel = shortDivision(appState.currentUser && appState.currentUser.division);
    var fullDivision = (appState.currentUser && appState.currentUser.division) || 'Sales Lapangan';

    return `
      <div class="pwa-header">
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <div class="pwa-avatar">${repInitials}</div>
          <div class="min-w-0 flex-1">
            ${isFieldSalesRole ? `
              <div class="font-bold text-xs leading-tight text-white truncate">${window.ArbaUtils.escapeHtml(currentRep)}</div>
              <div class="text-[11px] text-teal-100 truncate" title="${window.ArbaUtils.escapeHtml(fullDivision)}">${window.ArbaUtils.escapeHtml(divisionLabel)}</div>
            ` : `
              <select
                id="pwa-rep-select"
                aria-label="Pilih akun sales"
                class="font-bold text-xs leading-tight cursor-pointer border-0 w-full truncate"
                style="background:transparent; color:#fff; padding:0;"
              >
                ${salesTeam.map(function (s) {
                  return `<option value="${window.ArbaUtils.escapeHtml(s.name)}" style="color:#0f172a;" ${s.name === currentRep ? 'selected' : ''}>${window.ArbaUtils.escapeHtml(s.name)}</option>`;
                }).join('')}
              </select>
              <div class="text-[11px] text-teal-100 truncate">Sales Lapangan · Solo Raya</div>
            `}
          </div>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <button
            id="btn-pwa-online-toggle"
            title="Simulasi mode Online/Offline"
            class="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold cursor-pointer border-0"
            style="${isOnline ? 'background:rgba(255,255,255,0.18); color:#fff;' : 'background:#fbbf24; color:#0f172a;'}"
            type="button"
          >
            <span
              class="w-2 h-2 rounded-full"
              style="display:inline-block; background:${isOnline ? '#6ee7b7' : '#451a03'};"
            ></span>
            <span>${isOnline ? 'Online' : 'Offline'}${!isOnline && offlineQueue.length > 0 ? ' (' + offlineQueue.length + ')' : ''}</span>
          </button>
          <button
            id="btn-pwa-logout"
            title="Keluar"
            aria-label="Keluar"
            class="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold cursor-pointer border-0"
            style="background:rgba(255,255,255,0.14); color:#fff;"
            type="button"
          >
            <span class="material-symbols-outlined text-[15px]">logout</span>
            <span>Keluar</span>
          </button>
        </div>
      </div>
    `;
  }

  function renderOutletTab(currentOutlet, outlets, isCheckedInHere) {
    var consItems = currentOutlet.consignmentItems || [];
    var consSold = consItems.reduce(function (s, c) { return s + (c.soldQty || 0); }, 0);
    var nearExpiryItems = consItems.filter(function (c) { return c.nearExpiry; });

    return `
      <div class="pwa-panel">
        <div class="flex items-center justify-between gap-2">
          <label for="pwa-outlet-select" class="text-[11px] uppercase tracking-wider font-bold text-on-surface-variant">
            Outlet Aktif
          </label>
          <button
            type="button"
            id="btn-gps-checkin"
            class="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer border-0 ${
              isCheckedInHere ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
            }"
          >
            <span class="material-symbols-outlined text-[14px]">
              ${isCheckedInHere ? 'pin_drop' : 'location_searching'}
            </span>
            <span>${isCheckedInHere ? (state.gpsDistance !== null ? 'GPS ' + state.gpsDistance + 'm' : 'Check-in Manual') : 'Check-in'}</span>
          </button>
        </div>

        <select
          id="pwa-outlet-select"
          aria-label="Pilih Outlet Mitra"
          class="form-select text-xs font-semibold"
        >
          ${outlets.map(function (o) {
            return `<option value="${window.ArbaUtils.escapeHtml(o.code)}" ${o.code === state.selectedOutletCode ? 'selected' : ''}>${window.ArbaUtils.escapeHtml(o.name)} (${window.ArbaUtils.escapeHtml(o.cityName)})</option>`;
          }).join('')}
        </select>

        ${isCheckedInHere && state.checkinTime ? `
          <div class="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
            <span class="material-symbols-outlined text-[13px]">check_circle</span>
            <span>Check-in pukul ${window.ArbaUtils.escapeHtml(state.checkinTime)}</span>
          </div>
        ` : ''}

        <div class="pwa-kpi-grid">
          <div class="pwa-kpi-cell">
            <div class="pwa-kpi-label">PIC</div>
            <div class="pwa-kpi-val" title="${window.ArbaUtils.escapeHtml(currentOutlet.picName || '-')}">${window.ArbaUtils.escapeHtml(currentOutlet.picName || '-')}</div>
          </div>
          <div class="pwa-kpi-cell">
            <div class="pwa-kpi-label">Termin</div>
            <div class="pwa-kpi-val text-primary" title="${window.ArbaUtils.escapeHtml(currentOutlet.terms || '-')}">${window.ArbaUtils.escapeHtml(shortTerm(currentOutlet.terms))}</div>
          </div>
          <div class="pwa-kpi-cell">
            <div class="pwa-kpi-label">Tagihan</div>
            <div class="pwa-kpi-val font-mono text-emerald-700">${window.ArbaUtils.formatRupiah(currentOutlet.consignmentBillableAmount || 0)}</div>
          </div>
          <div class="pwa-kpi-cell">
            <div class="pwa-kpi-label">Konsinyasi</div>
            <div class="pwa-kpi-val">${currentOutlet.consignmentTotalUnits || 0} titip · ${consSold} laku</div>
          </div>
        </div>

        ${nearExpiryItems.length > 0 ? `
          <div class="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] space-y-1">
            <div class="font-bold flex items-center gap-1">
              <span class="material-symbols-outlined text-[14px]">warning</span>
              <span>Dekat ED (${nearExpiryItems.length})</span>
            </div>
            ${nearExpiryItems.map(function (c) {
              return `<div class="text-[11px]"><b>${window.ArbaUtils.escapeHtml(c.name)}</b> (${c.remainingQty} btl · ED ${window.ArbaUtils.escapeHtml(c.expiry)})</div>`;
            }).join('')}
          </div>
        ` : ''}
      </div>

      <div class="grid grid-cols-3 gap-2">
        <button
          type="button"
          id="btn-pwa-repeat-order"
          class="btn btn-outline flex-col py-2.5 px-2 text-[11px]"
          style="white-space:normal; line-height:1.2; gap:0.25rem;"
        >
          <span class="material-symbols-outlined text-[18px] text-primary">sync_saved_locally</span>
          <span>Isi Laku</span>
        </button>
        <button
          type="button"
          id="btn-pwa-tsp-route"
          class="btn btn-outline flex-col py-2.5 px-2 text-[11px]"
          style="white-space:normal; line-height:1.2; gap:0.25rem;"
        >
          <span class="material-symbols-outlined text-[18px] text-emerald-700">route</span>
          <span>Rute</span>
        </button>
        <button
          type="button"
          id="btn-pwa-visit-only"
          class="btn btn-outline flex-col py-2.5 px-2 text-[11px]"
          style="white-space:normal; line-height:1.2; gap:0.25rem;"
        >
          <span class="material-symbols-outlined text-[18px] text-on-surface-variant">where_to_vote</span>
          <span>Kunjungan</span>
        </button>
      </div>
    `;
  }

  function renderProdukTab(currentOutlet, filteredProducts) {
    var categories = [
      { id: 'all', label: 'Semua' },
      { id: 'madu', label: 'Madu' },
      { id: 'kapsul', label: 'Kapsul' },
      { id: 'minyak', label: 'Minyak' },
      { id: 'kosmetik', label: 'Kosmetik' }
    ];

    return `
      <div class="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-surface-container-low border border-border-subtle text-[11px]">
        <div class="truncate font-semibold text-on-surface">${window.ArbaUtils.escapeHtml(currentOutlet.name)}</div>
        <button type="button" class="btn-pwa-goto-tab text-primary font-bold text-[11px] bg-transparent border-0 cursor-pointer shrink-0" data-tab="outlet">
          Ganti
        </button>
      </div>

      <div class="flex items-center gap-2">
        <div class="relative flex-1 min-w-0">
          <span class="material-symbols-outlined text-on-surface-variant absolute left-2.5 top-2 text-[16px] pointer-events-none">search</span>
          <input
            id="pwa-search-input"
            type="text"
            placeholder="Cari produk atau SKU..."
            value="${window.ArbaUtils.escapeHtml(state.productSearch)}"
            class="form-input pl-8 py-1.5 text-xs"
          />
        </div>
        <button
          type="button"
          id="btn-pwa-scan-qr"
          class="btn btn-primary btn-sm shrink-0"
          title="Scan QR Batch"
        >
          <span class="material-symbols-outlined text-[15px]">qr_code_scanner</span>
          <span>QR</span>
        </button>
      </div>

      <div class="flex items-center gap-1 overflow-x-auto pb-1 shrink-0">
        ${categories.map(function (cat) {
          var isCatActive = state.activeCategory === cat.id;
          return `
            <button
              class="btn-pwa-cat px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap border-0 ${
                isCatActive ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant'
              }"
              data-cat="${cat.id}"
              type="button"
            >
              ${cat.label}
            </button>
          `;
        }).join('')}
      </div>

      <div class="space-y-2">
        ${filteredProducts.length === 0 ? `
          <div class="pwa-panel items-center text-center py-6">
            <span class="material-symbols-outlined text-on-surface-variant text-[24px]">inventory_2</span>
            <div class="text-xs font-semibold text-on-surface">Produk tidak ditemukan</div>
            <button type="button" id="btn-pwa-reset-filter" class="btn btn-outline btn-sm">Reset Filter</button>
          </div>
        ` : filteredProducts.map(function (prod) {
          var qty = state.cart[prod.sku] || 0;
          var isLow = prod.stock <= prod.rop;
          var atMax = qty >= prod.stock;
          var consItem = (currentOutlet.consignmentItems || []).find(function (c) { return c.sku === prod.sku; });

          return `
            <div class="pwa-product-card ${qty > 0 ? 'in-cart' : ''}">
              <div class="min-w-0 flex-1">
                <div class="font-semibold text-xs text-on-surface leading-snug">${window.ArbaUtils.escapeHtml(prod.name)}</div>
                <div class="flex items-center gap-1.5 text-[11px] text-on-surface-variant mt-0.5">
                  <span class="font-mono font-semibold text-on-surface">${window.ArbaUtils.formatRupiah(prod.unitPrice)}</span>
                  <span>·</span>
                  <span class="font-mono">Stok ${prod.stock}</span>
                </div>
                ${consItem ? `
                  <div class="text-[10px] font-semibold mt-0.5 ${consItem.nearExpiry ? 'text-rose-700' : 'text-teal-700'}">
                    Titip ${consItem.consignedQty} · Laku ${consItem.soldQty} · Sisa ${consItem.remainingQty}${consItem.nearExpiry ? ' · Dekat ED' : ''}
                  </div>
                ` : ''}
                ${prod.stock === 0 ? `
                  <div class="text-[10px] font-semibold text-rose-700 mt-0.5">Stok habis</div>
                ` : isLow ? `
                  <div class="text-[10px] font-semibold text-amber-700 mt-0.5">Stok rendah (&le; ${prod.rop})</div>
                ` : (atMax && qty > 0 ? `
                  <div class="text-[10px] font-medium text-amber-700 mt-0.5">Maksimal stok</div>
                ` : '')}
              </div>

              <div class="pwa-stepper">
                <button
                  type="button"
                  class="btn-stepper-minus pwa-stepper-btn pwa-stepper-minus"
                  data-sku="${prod.sku}"
                  aria-label="Kurangi ${window.ArbaUtils.escapeHtml(prod.name)}"
                  ${qty === 0 ? 'disabled' : ''}
                >
                  -
                </button>
                <span class="w-7 text-center font-bold text-xs font-mono text-on-surface">${qty}</span>
                <button
                  type="button"
                  class="btn-stepper-plus pwa-stepper-btn pwa-stepper-plus"
                  data-sku="${prod.sku}"
                  aria-label="Tambah ${window.ArbaUtils.escapeHtml(prod.name)}"
                  ${atMax ? 'disabled' : ''}
                >
                  +
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderNotaTab(currentOutlet, cartItems, totalQuantity, overCredit) {
    if (totalQuantity === 0) {
      return `
        <div class="pwa-panel items-center text-center py-6">
          <span class="material-symbols-outlined text-on-surface-variant text-[36px]">shopping_bag</span>
          <div class="text-xs font-bold text-on-surface">Keranjang masih kosong</div>
          <div class="text-[11px] text-on-surface-variant">Pilih produk atau gunakan Isi Laku dari tab Outlet.</div>
          <button type="button" class="btn btn-primary btn-sm btn-pwa-goto-tab" data-tab="produk">
            Pilih Produk
          </button>
        </div>
      `;
    }

    return `
      <div class="pwa-panel">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-on-surface">${window.ArbaUtils.escapeHtml(currentOutlet.name)} (${totalQuantity} unit)</span>
          <button type="button" class="btn-pwa-goto-tab text-primary font-bold text-[11px] bg-transparent border-0 cursor-pointer" data-tab="produk">
            Ubah
          </button>
        </div>
        <div class="divide-y divide-border-subtle/40 text-xs">
          ${cartItems.map(function (item) {
            return `
              <div class="flex items-center justify-between gap-2 py-1.5">
                <span class="truncate text-on-surface">${window.ArbaUtils.escapeHtml(item.product.name)} <b class="font-mono">x${item.quantity}</b></span>
                <span class="font-mono font-semibold text-on-surface shrink-0">${window.ArbaUtils.formatRupiah(item.subtotal)}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="pwa-panel">
        <div class="form-group">
          <label for="pwa-term-select" class="form-label text-[11px]">Termin Pembayaran</label>
          <select id="pwa-term-select" class="form-select text-xs font-semibold">
            <option value="Konsinyasi (Titip Jual)" ${state.selectedTerm === 'Konsinyasi (Titip Jual)' ? 'selected' : ''}>Konsinyasi (Titip Jual)</option>
            <option value="Jatuh Tempo (Net 14 Hari)" ${state.selectedTerm === 'Jatuh Tempo (Net 14 Hari)' ? 'selected' : ''}>Jatuh Tempo (Net 14 Hari)</option>
            <option value="Cash / Tunai di Awal" ${state.selectedTerm === 'Cash / Tunai di Awal' ? 'selected' : ''}>Cash / Tunai</option>
          </select>
          ${overCredit ? `
            <span class="text-[11px] font-semibold text-rose-700">Melebihi sisa plafon (${window.ArbaUtils.formatRupiah(currentOutlet.creditRemaining || 0)})</span>
          ` : ''}
        </div>

        <input
          id="pwa-notes-input"
          type="text"
          value="${window.ArbaUtils.escapeHtml(state.orderNotes)}"
          placeholder="Catatan apoteker (opsional)..."
          class="form-input text-xs"
        />
      </div>

      <div class="pwa-panel">
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-bold text-on-surface flex items-center gap-1">
            <span class="material-symbols-outlined text-[15px] text-primary">draw</span>
            <span>Tanda Tangan (${window.ArbaUtils.escapeHtml(currentOutlet.picName || 'PIC')})</span>
          </span>
          <button
            type="button"
            id="btn-pwa-clear-sign"
            class="px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer border-0 bg-surface-container text-on-surface-variant"
          >
            Hapus
          </button>
        </div>

        <div class="rounded-lg border border-dashed border-slate-300 bg-white overflow-hidden relative">
          <canvas id="pwa-signature-canvas" width="340" height="96" style="width:100%; height:96px; display:block; touch-action:none; cursor:crosshair;"></canvas>
          ${state.signatureDataUrl ? `
            <span style="position:absolute; right:6px; bottom:4px; font-size:9px; font-weight:700; color:#059669; background:#ecfdf5; padding:1px 5px; border-radius:4px;">Tersimpan</span>
          ` : `
            <span id="pwa-sign-hint" style="position:absolute; left:8px; bottom:6px; font-size:10px; color:#94a3b8; pointer-events:none;">Tanda tangan di sini</span>
          `}
        </div>

        <div class="flex items-center justify-between gap-2 pt-1 border-t border-border-subtle">
          <div class="text-[11px] text-on-surface flex items-center gap-1 font-semibold">
            <span class="material-symbols-outlined text-[15px] text-primary">photo_camera</span>
            <span>${state.shelfPhotoDataUrl ? 'Foto etalase terlampir' : 'Foto Etalase (opsional)'}</span>
          </div>
          <label
            for="pwa-shelf-file-input"
            class="btn btn-outline btn-sm cursor-pointer"
          >
            ${state.shelfPhotoDataUrl ? 'Ganti' : 'Ambil Foto'}
          </label>
          <input id="pwa-shelf-file-input" type="file" accept="image/*" capture="environment" class="hidden" />
        </div>

        ${state.shelfPhotoDataUrl ? `
          <div class="rounded-lg overflow-hidden border border-border-subtle">
            <img src="${state.shelfPhotoDataUrl}" alt="Foto Etalase" style="width:100%; height:76px; object-fit:cover; display:block;" />
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderFooterBar(currentOutlet, totalQuantity, totalAmount, overCredit) {
    if (state.activeTab === 'outlet') {
      return `
        <div class="pwa-footer-bar">
          <div class="min-w-0">
            <span class="text-[10px] text-on-surface-variant uppercase tracking-wider block font-semibold">Keranjang</span>
            <span class="font-bold text-xs text-on-surface">${totalQuantity > 0 ? totalQuantity + ' item · ' + window.ArbaUtils.formatRupiah(totalAmount) : 'Belum ada item'}</span>
          </div>
          <button
            type="button"
            class="btn btn-primary btn-pwa-goto-tab shrink-0"
            data-tab="${totalQuantity > 0 ? 'nota' : 'produk'}"
          >
            <span>${totalQuantity > 0 ? 'Lanjut Nota' : 'Pilih Produk'}</span>
            <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>
      `;
    }

    if (state.activeTab === 'produk') {
      return `
        <div class="pwa-footer-bar">
          <div>
            <span class="text-[10px] text-on-surface-variant uppercase tracking-wider block font-semibold">${totalQuantity} Item</span>
            <span class="font-bold text-sm font-mono text-primary">${window.ArbaUtils.formatRupiah(totalAmount)}</span>
          </div>
          <button
            type="button"
            class="btn btn-primary btn-pwa-goto-tab flex-1"
            data-tab="nota"
            ${totalQuantity === 0 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}
          >
            <span>Lanjut Nota</span>
            <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>
      `;
    }

    return `
      <div class="pwa-footer-bar">
        <div>
          <span class="text-[10px] text-on-surface-variant uppercase tracking-wider block font-semibold">${totalQuantity} Item · ${window.ArbaUtils.escapeHtml(shortTerm(state.selectedTerm))}</span>
          <span class="font-bold text-sm font-mono ${overCredit ? 'text-rose-700' : 'text-primary'}">
            ${window.ArbaUtils.formatRupiah(totalAmount)}
          </span>
        </div>

        <button
          id="btn-pwa-checkout"
          ${state.isSubmitting || totalQuantity === 0 ? 'disabled' : ''}
          class="btn btn-primary flex-1 py-2.5"
          style="${state.isSubmitting || totalQuantity === 0 ? 'opacity:0.5; cursor:not-allowed;' : ''}"
          type="button"
        >
          <span class="material-symbols-outlined text-[16px]">send</span>
          <span>${state.isSubmitting ? 'Menyimpan...' : 'Simpan Nota'}</span>
        </button>
      </div>
    `;
  }

  function renderFieldSalesPwa(container) {
    var appState = window.ArbaStore.getState();
    var products = appState.products;
    var outlets = appState.outlets;
    var isOnline = appState.isOnline;
    var offlineQueue = appState.offlineQueue;
    var selectedOutletId = appState.selectedOutletId;

    if (selectedOutletId) {
      var matchOutlet = outlets.find(function (o) { return o.id === selectedOutletId || o.code === selectedOutletId; });
      if (matchOutlet && (!state.selectedOutletCode || state.selectedOutletCode === 'AP-SLO-001')) {
        state.selectedOutletCode = matchOutlet.code;
      }
    }

    var currentOutlet = outlets.find(function (o) { return o.code === state.selectedOutletCode; }) || outlets[0];

    var salesTeam = appState.salesTeam || [];
    var isFieldSalesRole = appState.currentUser && appState.currentUser.role === 'field-sales';
    var currentRep = isFieldSalesRole
      ? (appState.currentUser.salesRepName || appState.currentUser.name)
      : (appState.currentSalesRep || 'Budi Santoso');
    var repInitials = currentRep.split(' ').map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase();
    var analytics = window.ArbaStore.getAnalytics();
    var repPerf = analytics.salesPerformance.find(function (s) { return s.name === currentRep; }) ||
      { visitsToday: 0, dailyVisitTarget: 0, ordersToday: 0, revenuePct: 0 };

    var isCheckedInHere = state.gpsCheckedIn && state.gpsOutletCode === currentOutlet.code;

    var lastOutletOrder = appState.orders.find(function (o) {
      return (o.outletId === currentOutlet.code || o.outletId === currentOutlet.id) && o.status !== 'REJECTED';
    });

    var filteredProducts = products.filter(function (prod) {
      var matchesCategory =
        state.activeCategory === 'all' ||
        (state.activeCategory === 'madu' && prod.category === 'Madu Herbal') ||
        (state.activeCategory === 'kapsul' && prod.category === 'Kapsul Herbal') ||
        (state.activeCategory === 'minyak' && prod.category === 'Minyak & Cairan') ||
        (state.activeCategory === 'kosmetik' && prod.category === 'Kosmetik Herbal') ||
        (state.activeCategory === 'serbuk' && prod.category === 'Serbuk');

      var matchesSearch =
        prod.name.toLowerCase().indexOf(state.productSearch.toLowerCase()) !== -1 ||
        prod.sku.toLowerCase().indexOf(state.productSearch.toLowerCase()) !== -1;

      return matchesCategory && matchesSearch;
    });

    var cartItems = getCartItems(products);
    var totalQuantity = cartItems.reduce(function (sum, item) { return sum + item.quantity; }, 0);
    var totalAmount = cartItems.reduce(function (sum, item) { return sum + item.subtotal; }, 0);

    var isCreditTerm = /Net|Jatuh Tempo/i.test(state.selectedTerm);
    var overCredit = isCreditTerm && totalAmount > (currentOutlet.creditRemaining || 0);

    var activeBodyHtml = '';
    if (state.activeTab === 'outlet') {
      activeBodyHtml = renderOutletTab(currentOutlet, outlets, isCheckedInHere);
    } else if (state.activeTab === 'produk') {
      activeBodyHtml = renderProdukTab(currentOutlet, filteredProducts);
    } else {
      activeBodyHtml = renderNotaTab(currentOutlet, cartItems, totalQuantity, overCredit);
    }

    var html = `
      <div class="flex flex-col items-center w-full pb-4">
        <div
          class="w-full transition-all duration-200 max-w-[420px] rounded-3xl border border-border-subtle/70 bg-surface shadow-xl overflow-hidden"
          style="max-width: 420px; border-radius: 28px;"
        >
          <div class="pwa-frame">
            ${renderTopBar(appState, isFieldSalesRole, currentRep, repInitials, salesTeam, isOnline, offlineQueue)}

            <div class="pwa-progress-strip">
              <span class="flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px]">directions_walk</span>
                Kunjungan <b>${repPerf.visitsToday}/${repPerf.dailyVisitTarget}</b>
              </span>
              <span>Order <b>${repPerf.ordersToday}</b></span>
              <span>Target <b>${repPerf.revenuePct}%</b></span>
            </div>

            ${(!isOnline || offlineQueue.length > 0) ? `
              <div class="px-3.5 py-2 flex items-center justify-between gap-2 bg-amber-50 border-b border-amber-200 text-amber-900 text-[11px] shrink-0">
                <div class="flex items-center gap-1.5 font-bold">
                  <span class="material-symbols-outlined text-[15px]">cloud_off</span>
                  <span>${offlineQueue.length > 0 ? offlineQueue.length + ' antrean sync' : 'Mode Offline'}</span>
                </div>
                <button
                  type="button"
                  id="btn-pwa-sync-now"
                  class="btn btn-primary btn-sm"
                >
                  Sinkron (${offlineQueue.length})
                </button>
              </div>
            ` : ''}

            <div class="pwa-tabbar" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected="${state.activeTab === 'outlet'}"
                class="pwa-tab ${state.activeTab === 'outlet' ? 'active' : ''}"
                data-tab="outlet"
              >
                <span class="material-symbols-outlined text-[16px]">storefront</span>
                <span>Outlet</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected="${state.activeTab === 'produk'}"
                class="pwa-tab ${state.activeTab === 'produk' ? 'active' : ''}"
                data-tab="produk"
              >
                <span class="material-symbols-outlined text-[16px]">inventory_2</span>
                <span>Produk</span>
                ${totalQuantity > 0 ? `<span class="pwa-tab-badge">${totalQuantity}</span>` : ''}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected="${state.activeTab === 'nota'}"
                class="pwa-tab ${state.activeTab === 'nota' ? 'active' : ''}"
                data-tab="nota"
              >
                <span class="material-symbols-outlined text-[16px]">receipt_long</span>
                <span>Nota</span>
              </button>
            </div>

            <div class="pwa-body">
              ${activeBodyHtml}
            </div>

            ${renderFooterBar(currentOutlet, totalQuantity, totalAmount, overCredit)}
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
    bindEvents(container, currentOutlet, products, totalAmount, {
      overCredit: overCredit,
      isCheckedInHere: isCheckedInHere,
      lastOutletOrder: lastOutletOrder,
      currentRep: currentRep
    });
  }

  function bindEvents(container, currentOutlet, products, totalAmount, ctx) {
    ctx = ctx || {};

    // Tabs & tab jump buttons
    container.querySelectorAll('.pwa-tab, .btn-pwa-goto-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var nextTab = btn.getAttribute('data-tab');
        if (!nextTab) return;
        state.activeTab = nextTab;
        renderFieldSalesPwa(container);
      });
    });

    // Sales rep account switch
    var repSelect = container.querySelector('#pwa-rep-select');
    if (repSelect) {
      repSelect.addEventListener('change', function (e) {
        state.gpsCheckedIn = false;
        window.ArbaStore.setCurrentSalesRep(e.target.value);
        window.ArbaApp.showToast('Masuk sebagai ' + e.target.value, 'badge');
      });
    }

    // Tagih Laku & Isi Ulang Konsinyasi (1-tap -> langsung ke Produk)
    var btnRepeat = container.querySelector('#btn-pwa-repeat-order');
    if (btnRepeat) {
      btnRepeat.addEventListener('click', function () {
        var newCart = {};
        if (currentOutlet.consignmentItems && currentOutlet.consignmentItems.length > 0) {
          currentOutlet.consignmentItems.forEach(function (ci) {
            var prod = products.find(function (p) { return p.sku === ci.sku; });
            if (prod && prod.stock > 0 && ci.soldQty > 0) {
              newCart[prod.sku] = Math.min(ci.soldQty, prod.stock);
            }
          });
        } else if (ctx.lastOutletOrder) {
          ctx.lastOutletOrder.items.forEach(function (it) {
            var norm = String(it.sku).toUpperCase().replace(/SKU-|ARB-|-/g, '');
            var prod = products.find(function (p) { return p.sku.toUpperCase().replace(/SKU-|ARB-|-/g, '') === norm; });
            if (prod && prod.stock > 0) newCart[prod.sku] = Math.min(it.quantity, prod.stock);
          });
        }
        state.cart = newCart;
        state.activeTab = 'produk';
        window.ArbaApp.showToast('Keranjang diisi sesuai barang laku di ' + currentOutlet.name, 'sync_saved_locally');
        renderFieldSalesPwa(container);
      });
    }

    // Visit-only log
    var btnVisitOnly = container.querySelector('#btn-pwa-visit-only');
    if (btnVisitOnly) {
      btnVisitOnly.addEventListener('click', function () {
        openVisitOnlyModal(currentOutlet, ctx.currentRep, ctx.isCheckedInHere);
      });
    }

    // Route optimizer
    var btnTspRoute = container.querySelector('#btn-pwa-tsp-route');
    if (btnTspRoute && window.ArbaAdvanced) {
      btnTspRoute.addEventListener('click', function () {
        window.ArbaAdvanced.openTspRouteOptimizerModal(ctx.currentRep, function (selectedCode) {
          state.selectedOutletCode = selectedCode;
          renderFieldSalesPwa(container);
        });
      });
    }

    // Scan QR Batch button
    var btnScanQr = container.querySelector('#btn-pwa-scan-qr');
    if (btnScanQr && window.ArbaAdvanced) {
      btnScanQr.addEventListener('click', function () {
        window.ArbaAdvanced.openQrBatchModal({
          initialTab: 'scanner',
          onSelectProduct: function (scannedProd) {
            var currQty = state.cart[scannedProd.sku] || 0;
            state.cart[scannedProd.sku] = Math.min(scannedProd.stock, currQty + 2);
            if (state.scannedQrBatches.indexOf(scannedProd.activeBatch) === -1) {
              state.scannedQrBatches.push(scannedProd.activeBatch);
            }
            window.ArbaApp.showToast('QR ' + scannedProd.activeBatch + ' (+2 ' + scannedProd.name + ')', 'qr_code_scanner');
            renderFieldSalesPwa(container);
          }
        });
      });
    }

    // Reset filter on empty search
    var btnResetFilter = container.querySelector('#btn-pwa-reset-filter');
    if (btnResetFilter) {
      btnResetFilter.addEventListener('click', function () {
        state.activeCategory = 'all';
        state.productSearch = '';
        renderFieldSalesPwa(container);
      });
    }

    // HTML5 Canvas E-Signature Pad Apoteker
    var sigCanvas = container.querySelector('#pwa-signature-canvas');
    if (sigCanvas && sigCanvas.getContext) {
      var sigCtx = sigCanvas.getContext('2d');
      sigCtx.strokeStyle = '#0f172a';
      sigCtx.lineWidth = 2;
      sigCtx.lineCap = 'round';

      if (state.signatureDataUrl) {
        var img = new Image();
        img.onload = function () {
          sigCtx.drawImage(img, 0, 0);
        };
        img.src = state.signatureDataUrl;
      }

      var drawing = false;
      function getPos(evt) {
        var rect = sigCanvas.getBoundingClientRect();
        var clientX = evt.touches && evt.touches[0] ? evt.touches[0].clientX : evt.clientX;
        var clientY = evt.touches && evt.touches[0] ? evt.touches[0].clientY : evt.clientY;
        return {
          x: (clientX - rect.left) * (sigCanvas.width / rect.width),
          y: (clientY - rect.top) * (sigCanvas.height / rect.height)
        };
      }
      function startDraw(evt) {
        drawing = true;
        var p = getPos(evt);
        sigCtx.beginPath();
        sigCtx.moveTo(p.x, p.y);
        var hint = container.querySelector('#pwa-sign-hint');
        if (hint) hint.style.display = 'none';
      }
      function moveDraw(evt) {
        if (!drawing) return;
        if (evt.cancelable) evt.preventDefault();
        var p = getPos(evt);
        sigCtx.lineTo(p.x, p.y);
        sigCtx.stroke();
      }
      function endDraw() {
        if (!drawing) return;
        drawing = false;
        state.signatureDataUrl = sigCanvas.toDataURL('image/png');
      }

      sigCanvas.addEventListener('mousedown', startDraw);
      sigCanvas.addEventListener('mousemove', moveDraw);
      window.addEventListener('mouseup', endDraw);
      sigCanvas.addEventListener('touchstart', startDraw, { passive: false });
      sigCanvas.addEventListener('touchmove', moveDraw, { passive: false });
      sigCanvas.addEventListener('touchend', endDraw);

      var btnClearSign = container.querySelector('#btn-pwa-clear-sign');
      if (btnClearSign) {
        btnClearSign.addEventListener('click', function () {
          sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
          state.signatureDataUrl = null;
          renderFieldSalesPwa(container);
        });
      }
    }

    var shelfFileInput = container.querySelector('#pwa-shelf-file-input');
    if (shelfFileInput) {
      shelfFileInput.addEventListener('change', function (e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
          state.shelfPhotoDataUrl = ev.target.result;
          window.ArbaApp.showToast('Foto etalase terlampir', 'photo_camera');
          renderFieldSalesPwa(container);
        };
        reader.readAsDataURL(file);
      });
    }

    // Logout
    var btnPwaLogout = container.querySelector('#btn-pwa-logout');
    if (btnPwaLogout) {
      btnPwaLogout.addEventListener('click', function () {
        if (window.ArbaStore && typeof window.ArbaStore.logoutUser === 'function') {
          window.ArbaStore.logoutUser();
        }
      });
    }

    // Online / Offline toggle
    var btnOnline = container.querySelector('#btn-pwa-online-toggle');
    if (btnOnline) {
      btnOnline.addEventListener('click', function () {
        window.ArbaStore.toggleOnlineStatus();
      });
    }

    // Sync Now button
    var btnSyncNow = container.querySelector('#btn-pwa-sync-now');
    if (btnSyncNow) {
      btnSyncNow.addEventListener('click', function () {
        window.ArbaStore.syncNow();
      });
    }

    // GPS Check-in
    var btnGps = container.querySelector('#btn-gps-checkin');
    if (btnGps) {
      btnGps.addEventListener('click', function () {
        var finishCheckin = function (dist, coordsText, sourceLabel) {
          var now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
          state.gpsDistance = dist;
          state.gpsCoords = coordsText;
          state.gpsSource = sourceLabel;
          state.gpsCheckedIn = true;
          state.gpsOutletCode = currentOutlet.code;
          state.checkinTime = now + ' WIB';
          window.ArbaApp.showToast(
            dist !== null
              ? 'Check-in GPS: ' + dist + 'm (' + now + ' WIB)'
              : 'Check-in manual dicatat (' + now + ' WIB)',
            'pin_drop'
          );
          renderFieldSalesPwa(container);
        };

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            function (pos) {
              var lat = pos.coords.latitude.toFixed(5);
              var lng = pos.coords.longitude.toFixed(5);
              var acc = Math.round(pos.coords.accuracy || 12);
              finishCheckin(acc, lat + ', ' + lng, 'GPS');
            },
            function () {
              finishCheckin(null, 'Check-in Manual', 'Manual');
            },
            { enableHighAccuracy: true, timeout: 2500, maximumAge: 60000 }
          );
        } else {
          finishCheckin(null, 'Check-in Manual', 'Manual');
        }
      });
    }

    // Outlet Select
    var outletSelect = container.querySelector('#pwa-outlet-select');
    if (outletSelect) {
      outletSelect.addEventListener('change', function (e) {
        state.selectedOutletCode = e.target.value;
        renderFieldSalesPwa(container);
      });
    }

    // Category Tabs
    container.querySelectorAll('.btn-pwa-cat').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.activeCategory = btn.getAttribute('data-cat');
        renderFieldSalesPwa(container);
      });
    });

    // Product Search Input
    var searchInput = container.querySelector('#pwa-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', function (e) {
        state.productSearch = e.target.value;
        renderFieldSalesPwa(container);
        var inputNow = container.querySelector('#pwa-search-input');
        if (inputNow) {
          inputNow.focus();
          inputNow.setSelectionRange(inputNow.value.length, inputNow.value.length);
        }
      });
    }

    // Steppers Minus
    container.querySelectorAll('.btn-stepper-minus').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sku = btn.getAttribute('data-sku');
        var curr = state.cart[sku] || 0;
        if (curr > 1) {
          state.cart[sku] = curr - 1;
        } else {
          delete state.cart[sku];
        }
        renderFieldSalesPwa(container);
      });
    });

    // Steppers Plus
    container.querySelectorAll('.btn-stepper-plus').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sku = btn.getAttribute('data-sku');
        var prodPlus = products.find(function (p) { return p.sku === sku; });
        var next = (state.cart[sku] || 0) + 1;
        if (prodPlus && next > prodPlus.stock) {
          window.ArbaApp.showToast('Stok tersisa ' + prodPlus.stock + ' unit', 'inventory_2');
          return;
        }
        state.cart[sku] = next;
        renderFieldSalesPwa(container);
      });
    });

    // Terms Select
    var termSelect = container.querySelector('#pwa-term-select');
    if (termSelect) {
      termSelect.addEventListener('change', function (e) {
        state.selectedTerm = e.target.value;
        renderFieldSalesPwa(container);
      });
    }

    // Notes Input
    var notesInput = container.querySelector('#pwa-notes-input');
    if (notesInput) {
      notesInput.addEventListener('input', function (e) {
        state.orderNotes = e.target.value;
      });
    }

    // Checkout Submit Button
    var btnCheckout = container.querySelector('#btn-pwa-checkout');
    if (btnCheckout) {
      btnCheckout.addEventListener('click', function () {
        var totalQty = Object.keys(state.cart).reduce(function (s, sku) { return s + (state.cart[sku] || 0); }, 0);
        if (totalQty === 0) {
          window.ArbaApp.showToast('Pilih minimal satu produk terlebih dahulu', 'warning');
          return;
        }

        state.isSubmitting = true;
        renderFieldSalesPwa(container);

        var items = Object.keys(state.cart).map(function (sku) {
          var prod = products.find(function (p) { return p.sku === sku; });
          var qty = state.cart[sku];
          return {
            sku: prod.sku.replace('SKU-', ''),
            name: prod.name,
            batch: 'Batch: ' + prod.activeBatch,
            expiry: prod.fefoDate,
            fefoPriority: 'FEFO Prioritas 1',
            quantity: qty,
            unitPrice: prod.unitPrice,
            subtotal: prod.unitPrice * qty,
            allocated: true,
            remainingBatchStock: prod.stock
          };
        });

        setTimeout(function () {
          var activeRep = ctx.currentRep || window.ArbaStore.getState().currentSalesRep || 'Budi Santoso';
          var savedSignature = state.signatureDataUrl;
          var savedPhoto = state.shelfPhotoDataUrl;
          var savedNotes = state.orderNotes;
          var savedQrBatches = (state.scannedQrBatches || []).slice();

          state.isSubmitting = false;
          state.orderNotes = '';
          state.cart = {};
          state.signatureDataUrl = null;
          state.shelfPhotoDataUrl = null;
          state.scannedQrBatches = [];
          state.activeTab = 'outlet';

          window.ArbaStore.submitFieldSalesOrder({
            outletId: currentOutlet.code,
            outletName: currentOutlet.name,
            address: currentOutlet.address,
            city: currentOutlet.cityName,
            salesRep: activeRep,
            terms: state.selectedTerm,
            totalAmount: totalAmount,
            gpsDistance: state.gpsDistance,
            geofenceValid: Boolean(ctx.isCheckedInHere),
            notes: savedNotes,
            signatureDataUrl: savedSignature,
            signerName: currentOutlet.picName || 'PIC Outlet',
            shelfPhotoDataUrl: savedPhoto,
            scannedQrBatches: savedQrBatches,
            items: items
          });

          openThermalReceiptModal(currentOutlet, items, totalAmount, activeRep, savedSignature, savedPhoto);
        }, 300);
      });
    }
  }

  function openVisitOnlyModal(outlet, salesRep, isCheckedIn) {
    var labels = window.ArbaStore.visitOutcomeLabels || {
      NO_ORDER_STOCK_FULL: 'Stok Outlet Masih Penuh',
      COLLECTION: 'Penagihan Faktur',
      FOLLOW_UP: 'Follow-up Minggu Depan',
      PIC_ABSENT: 'PIC Tidak di Tempat',
      DISPLAY_CHECK: 'Cek Display'
    };

    var optionsHtml = Object.keys(labels)
      .filter(function (k) { return k !== 'ORDER'; })
      .map(function (k) {
        return `<option value="${k}">${labels[k]}</option>`;
      })
      .join('');

    var modalHtml = `
      <div class="modal-dialog max-w-md" style="max-width:420px;">
        <div class="modal-header">
          <div class="flex items-center gap-2 text-on-surface">
            <span class="material-symbols-outlined text-primary text-[20px]">where_to_vote</span>
            <h3 class="font-bold text-sm">Catat Kunjungan</h3>
          </div>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div class="modal-body text-xs space-y-3">
          <div class="bg-surface-container-low p-3 rounded-lg border border-border-subtle/60 space-y-1">
            <div class="font-semibold text-on-surface">${window.ArbaUtils.escapeHtml(outlet.name)} (${window.ArbaUtils.escapeHtml(outlet.cityName)})</div>
            <div class="text-on-surface-variant">Sales: <b>${window.ArbaUtils.escapeHtml(salesRep)}</b> · ${isCheckedIn && state.gpsDistance !== null ? 'GPS: <b>' + state.gpsDistance + 'm</b>' : 'Check-in Manual'}</div>
          </div>

          <div class="space-y-1">
            <label for="visit-only-outcome" class="form-label">Hasil Kunjungan</label>
            <select id="visit-only-outcome" class="form-select text-xs font-medium">
              ${optionsHtml}
            </select>
          </div>

          <div class="space-y-1">
            <label for="visit-only-notes" class="form-label">Catatan (opsional)</label>
            <textarea
              id="visit-only-notes"
              rows="3"
              placeholder="Ringkasan hasil kunjungan..."
              class="form-textarea text-xs"
            ></textarea>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button type="button" class="btn btn-outline btn-sm" onclick="window.ArbaApp.closeModal()">
              Batal
            </button>
            <button type="button" id="btn-save-visit-only" class="btn btn-primary btn-sm">
              <span class="material-symbols-outlined text-[15px]">check</span>
              <span>Simpan</span>
            </button>
          </div>
        </div>
      </div>
    `;

    window.ArbaApp.openModal(modalHtml);

    setTimeout(function () {
      var btnSave = document.getElementById('btn-save-visit-only');
      if (btnSave) {
        btnSave.onclick = function () {
          var outcomeEl = document.getElementById('visit-only-outcome');
          var notesEl = document.getElementById('visit-only-notes');
          var dist = isCheckedIn ? state.gpsDistance : null;
          state.gpsCheckedIn = true;
          state.gpsOutletCode = outlet.code;
          state.gpsDistance = dist;

          window.ArbaStore.logFieldVisit({
            salesRep: salesRep,
            outletId: outlet.code,
            outletName: outlet.name,
            outcome: outcomeEl ? outcomeEl.value : 'NO_ORDER_STOCK_FULL',
            gpsDistance: dist,
            notes: notesEl ? notesEl.value.trim() : ''
          });

          window.ArbaApp.closeModal();
          var mainContainer = document.getElementById('main-view-container');
          if (mainContainer) renderFieldSalesPwa(mainContainer);
        };
      }
    }, 30);
  }

  function openThermalReceiptModal(outlet, items, totalAmount, salesRepName, signatureDataUrl) {
    var appSt = window.ArbaStore.getState();
    var isOnline = appSt.isOnline;
    var activeSales = salesRepName || appSt.currentSalesRep || 'Budi Santoso';
    var timeLabel = state.checkinTime ? ' (' + state.checkinTime + ')' : '';

    var modalHtml = `
      <div class="modal-dialog max-w-sm" style="max-width:380px;">
        <div class="modal-header">
          <div class="flex items-center gap-2 text-on-surface">
            <span class="material-symbols-outlined text-emerald-600 text-[20px]">check_circle</span>
            <h3 class="font-bold text-xs">Nota Tersimpan</h3>
          </div>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div class="modal-body text-xs">
          <div class="bg-slate-50 p-3.5 rounded-xl border border-dashed border-slate-300 font-mono text-[11px] text-slate-800 space-y-1.5 leading-tight">
            <div class="text-center pb-1 border-b border-dashed border-slate-300">
              <div class="font-bold text-xs">CV ARBA'IN SURAKARTA</div>
              <div class="text-[10px] text-slate-500">Distributor Farmasi Herbal</div>
            </div>

            <div class="text-[10px] py-1 border-b border-dashed border-slate-300 space-y-0.5 text-slate-600">
              <div>Outlet: <b>${window.ArbaUtils.escapeHtml(outlet.name)}</b></div>
              <div>Sales: ${window.ArbaUtils.escapeHtml(activeSales)}${window.ArbaUtils.escapeHtml(timeLabel)}</div>
              <div>Status: ${isOnline ? 'Tersinkron' : 'Antrean Offline'}</div>
              <div>Termin: ${window.ArbaUtils.escapeHtml(shortTerm(state.selectedTerm))}</div>
            </div>

            <div class="py-1 space-y-1">
              ${items.map(function (it) {
                return `
                  <div class="flex justify-between gap-2">
                    <span class="truncate">${window.ArbaUtils.escapeHtml(it.name)} x${it.quantity}</span>
                    <span class="font-semibold shrink-0">${window.ArbaUtils.formatRupiah(it.subtotal)}</span>
                  </div>
                `;
              }).join('')}
            </div>

            <div class="pt-1.5 border-t border-dashed border-slate-300 flex justify-between font-bold text-xs text-slate-900">
              <span>TOTAL</span>
              <span>${window.ArbaUtils.formatRupiah(totalAmount)}</span>
            </div>

            ${signatureDataUrl ? `
              <div class="pt-2 mt-1 border-t border-dashed border-slate-300 text-center">
                <div class="text-[9px] text-slate-500 uppercase">Tanda Tangan PIC</div>
                <img src="${signatureDataUrl}" alt="TTD PIC" style="max-height:48px; margin:2px auto; display:block;" />
                <div class="text-[10px] font-bold text-slate-700">${window.ArbaUtils.escapeHtml(outlet.picName || 'PIC Outlet')}</div>
              </div>
            ` : ''}
          </div>

          <div class="flex flex-col gap-2 pt-1">
            <button
              id="btn-thermal-share-wa"
              type="button"
              class="btn w-full"
              style="background:#059669; color:#fff;"
            >
              <span class="material-symbols-outlined text-[16px]">share</span>
              <span>Kirim via WhatsApp</span>
            </button>
            <div class="flex gap-2">
              <button
                id="btn-thermal-print"
                type="button"
                class="btn btn-outline flex-1"
              >
                <span class="material-symbols-outlined text-[15px]">print</span>
                <span>Cetak</span>
              </button>
              <button
                id="btn-thermal-done"
                type="button"
                class="btn btn-primary flex-1"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    window.ArbaApp.openModal(modalHtml);

    setTimeout(function () {
      var btnWa = document.getElementById('btn-thermal-share-wa');
      if (btnWa) {
        btnWa.onclick = function () {
          var itemsText = items.map(function (it) {
            return '• ' + it.name + ': ' + it.quantity + ' unit (' + window.ArbaUtils.formatRupiah(it.subtotal) + ')';
          }).join('%0A');

          var msg = '*SURAT PESANAN B2B - CV ARBA\'IN*%0AOutlet: ' + outlet.name + '%0ATanggal: ' + new Date().toLocaleDateString('id-ID') + '%0ASales: ' + activeSales + '%0ATermin: ' + shortTerm(state.selectedTerm) + '%0A%0A*Rincian:*%0A' + itemsText + '%0A%0A*Total: ' + window.ArbaUtils.formatRupiah(totalAmount) + '*';
          window.open('https://wa.me/?text=' + msg, '_blank');
        };
      }

      var btnPrint = document.getElementById('btn-thermal-print');
      if (btnPrint) {
        btnPrint.onclick = function () {
          window.ArbaApp.showToast('Mencetak struk 58mm', 'print');
          window.print();
        };
      }

      var btnDone = document.getElementById('btn-thermal-done');
      if (btnDone) {
        btnDone.onclick = function () {
          state.cart = {};
          state.activeTab = 'outlet';
          window.ArbaApp.closeModal();
          var mainContainer = document.getElementById('main-view-container');
          if (mainContainer) renderFieldSalesPwa(mainContainer);
        };
      }
    }, 50);
  }

  window.ArbaViews.renderFieldSalesPwa = renderFieldSalesPwa;
})();
