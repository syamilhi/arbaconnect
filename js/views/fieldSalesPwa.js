/**
 * ArbaConnect ERP - Field Sales PWA Preview View
 * Features:
 * - Viewport Switcher: 390px Smartphone Frame vs Fullscreen layout
 * - Mobile Top Bar: Budi Santoso Profile, Network Status toggle (Online / Offline Queue)
 * - Step 1: Outdoor GPS Check-In (radius calculation & geofence verification) & Outlet Selector
 * - Step 2: Touch-friendly Product Order Catalog with big steppers (- and +) and category tabs
 * - Step 3: Payment terms & apoteker notes
 * - Sticky Bottom Checkout Bar (Total items & amount, submit button)
 * - 58mm Bluetooth Mobile Thermal Receipt Modal with WhatsApp sharing & print support
 */

(function () {
  'use strict';

  window.ArbaViews = window.ArbaViews || {};

  var state = {
    isPhoneFrame: true,
    selectedOutletCode: 'AP-SLO-001',
    activeCategory: 'all',
    productSearch: '',
    cart: {
      'SKU-ARB-MDR500': 6,
      'SKU-ARB-HBT100': 4
    },
    selectedTerm: 'Konsinyasi (Titip Jual)',
    orderNotes: '',
    isSubmitting: false,
    gpsCheckedIn: true,
    gpsDistance: 12,
    checkinTime: '10:15 WIB'
  };

  function renderFieldSalesPwa(container) {
    // Allow URL query override: ?pwa=full or ?pwa=phone
    var urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('pwa') === 'full') {
      state.isPhoneFrame = false;
    } else if (urlParams.get('pwa') === 'phone') {
      state.isPhoneFrame = true;
    }

    var appState = window.ArbaStore.getState();
    var products = appState.products;
    var outlets = appState.outlets;
    var isOnline = appState.isOnline;
    var offlineQueue = appState.offlineQueue;
    var selectedOutletId = appState.selectedOutletId;

    // Match initial outlet code from appState if not manually chosen
    if (selectedOutletId) {
      var matchOutlet = outlets.find(function (o) { return o.id === selectedOutletId || o.code === selectedOutletId; });
      if (matchOutlet && (!state.selectedOutletCode || state.selectedOutletCode === 'AP-SLO-001')) {
        state.selectedOutletCode = matchOutlet.code;
      }
    }

    var currentOutlet = outlets.find(function (o) { return o.code === state.selectedOutletCode; }) || outlets[0];

    // Sales rep aktif & progres harian (dihitung live dari log kunjungan)
    var salesTeam = appState.salesTeam || [];
    var currentRep = appState.currentSalesRep || 'Budi Santoso';
    var repInitials = currentRep.split(' ').map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase();
    var analytics = window.ArbaStore.getAnalytics();
    var repPerf = analytics.salesPerformance.find(function (s) { return s.name === currentRep; }) ||
      { visitsToday: 0, dailyVisitTarget: 0, ordersToday: 0, revenuePct: 0 };

    // GPS check-in berlaku per outlet
    var isCheckedInHere = state.gpsCheckedIn && state.gpsOutletCode === currentOutlet.code;

    // Riwayat order terakhir outlet (untuk fitur Repeat Order 1-tap)
    var lastOutletOrder = appState.orders.find(function (o) {
      return (o.outletId === currentOutlet.code || o.outletId === currentOutlet.id) && o.status !== 'REJECTED';
    });

    // Filter products
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

    // Cart totals
    var totalQuantity = Object.keys(state.cart).reduce(function (sum, sku) {
      return sum + (state.cart[sku] || 0);
    }, 0);

    var totalAmount = Object.keys(state.cart).reduce(function (sum, sku) {
      var prod = products.find(function (p) { return p.sku === sku; });
      var qty = state.cart[sku] || 0;
      return sum + (prod ? prod.unitPrice * qty : 0);
    }, 0);

    // Validasi plafon kredit outlet (hanya untuk termin Jatuh Tempo non-Konsinyasi & non-COD)
    var isCreditTerm = /Net|Jatuh Tempo/i.test(state.selectedTerm);
    var overCredit = isCreditTerm && totalAmount > (currentOutlet.creditRemaining || 0);

    var html = `
      <div class="flex flex-col items-center w-full pb-12">
        <!-- Viewport Control Bar -->
        <div class="w-full max-w-xl flex items-center justify-between mb-4 bg-surface-container-lowest p-3 rounded-xl border border-border-subtle/50 text-xs text-on-surface-variant">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[18px]">smartphone</span>
            <span class="font-semibold text-on-surface">Field Sales Mobile App</span>
            <span class="hidden sm:inline">· PWA Lapangan</span>
          </div>
          <div class="flex items-center gap-1.5">
            <button
              id="btn-viewport-phone"
              class="px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors border-0 text-xs ${
                state.isPhoneFrame
                  ? 'bg-primary text-white font-semibold'
                  : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
              }"
              type="button"
            >
              Smartphone (390px)
            </button>
            <button
              id="btn-viewport-full"
              class="px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors border-0 text-xs ${
                !state.isPhoneFrame
                  ? 'bg-primary text-white font-semibold'
                  : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
              }"
              type="button"
            >
              Layar Penuh
            </button>
          </div>
        </div>

        <!-- Smartphone Body Simulation Container -->
        <div
          class="w-full transition-all duration-200 ${
            state.isPhoneFrame
              ? 'max-w-[420px] rounded-3xl border border-border-subtle/70 bg-surface shadow-xl overflow-hidden'
              : 'max-w-2xl bg-surface rounded-2xl border border-border-subtle/60 p-4'
          }"
          style="${state.isPhoneFrame ? 'max-width: 420px; border-radius: 28px;' : ''}"
        >
          <!-- Smartphone App Frame -->
          <div class="flex flex-col min-h-[680px] bg-white text-slate-900 relative rounded-2xl overflow-hidden" style="position:relative; background:#fff; min-height:680px;">
            <!-- Top Bar - Sales Profile & Offline Switch -->
            <div class="bg-[#005c55] text-white px-4 py-3 sticky top-0 z-30 shadow-xs flex items-center justify-between" style="background:#005c55; color:#fff;">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs text-white" style="width:32px; height:32px; border-radius:50%; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center;">
                  ${repInitials}
                </div>
                <div class="flex flex-col">
                  <select
                    id="pwa-rep-select"
                    aria-label="Pilih akun sales"
                    class="font-bold text-xs leading-tight cursor-pointer border-0"
                    style="background:transparent; color:#fff; padding:0; max-width:150px;"
                  >
                    ${salesTeam.map(function (s) {
                      return `<option value="${s.name}" style="color:#0f172a;" ${s.name === currentRep ? 'selected' : ''}>${s.name}</option>`;
                    }).join('')}
                  </select>
                  <span class="text-[11px] text-teal-100 font-medium">Sales Rep · Solo Raya</span>
                </div>
              </div>

              <!-- Offline/Online Network Indicator Button -->
              <button
                id="btn-pwa-online-toggle"
                title="Klik untuk simulasi mode Online/Offline"
                class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors border-0 ${
                  isOnline
                    ? 'bg-white/15 text-white hover:bg-white/25'
                    : 'bg-amber-400 text-slate-950 font-bold'
                }"
                style="${isOnline ? 'background:rgba(255,255,255,0.18); color:#fff;' : 'background:#fbbf24; color:#0f172a;'}"
                type="button"
              >
                <span
                  class="w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-300' : 'bg-amber-950'}"
                  style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${isOnline ? '#6ee7b7' : '#451a03'};"
                ></span>
                <span>${isOnline ? 'Online' : 'Offline'}</span>
                ${!isOnline && offlineQueue.length > 0 ? `
                  <span class="ml-1 px-1 bg-amber-900 text-amber-200 text-[10px] rounded">
                    ${offlineQueue.length}
                  </span>
                ` : ''}
              </button>
            </div>

            <!-- Daily Target Progress Strip (live dari log kunjungan) -->
            <div class="px-4 py-2 flex items-center justify-between text-[11px]" style="background:#e6f4f2; color:#004d47; padding:0.45rem 1rem; border-bottom:1px solid #cce7e3;">
              <span class="flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px]">directions_walk</span>
                Kunjungan hari ini: <b>${repPerf.visitsToday}/${repPerf.dailyVisitTarget}</b>
              </span>
              <span>Order: <b>${repPerf.ordersToday}</b></span>
              <span>Omset: <b>${repPerf.revenuePct}%</b> target</span>
            </div>

            <!-- Main App Body -->
            <div class="flex-1 p-3.5 space-y-3 pb-24 overflow-y-auto" style="padding: 0.875rem; padding-bottom: 6rem; overflow-y:auto; max-height:580px;">
              <!-- Step 1: Outdoor GPS Check-In & Outlet Card -->
              <div class="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2.5 mb-3" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:0.75rem;">
                <div class="flex items-center justify-between mb-2">
                  <label class="text-[11px] uppercase tracking-wider font-bold text-slate-600">
                    Target Outlet Mitra
                  </label>
                  <!-- 1-Tap GPS Geofence Check-in Button -->
                  <button
                    type="button"
                    id="btn-gps-checkin"
                    class="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors border-0 ${
                      isCheckedInHere
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-900'
                    }"
                    style="background:${isCheckedInHere ? '#d1fae5' : '#fef3c7'}; color:${isCheckedInHere ? '#065f46' : '#92400e'};"
                  >
                    <span class="material-symbols-outlined text-[14px]">
                      ${isCheckedInHere ? 'pin_drop' : 'location_searching'}
                    </span>
                    <span>${isCheckedInHere ? `GPS Valid (${state.gpsDistance}m)` : 'Check-in Lokasi'}</span>
                  </button>
                </div>

                <!-- Outlet Selector Dropdown -->
                <select
                  id="pwa-outlet-select"
                  aria-label="Pilih Outlet Mitra"
                  class="w-full bg-white p-2.5 rounded-lg text-xs font-semibold text-slate-900 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#005c55] cursor-pointer mb-2"
                  style="border:1px solid #e2e8f0; width:100%;"
                >
                  ${outlets.map(function (o) {
                    return `
                      <option value="${o.code}" ${o.code === state.selectedOutletCode ? 'selected' : ''}>
                        ${o.name} (${o.cityName})
                      </option>
                    `;
                  }).join('')}
                </select>

                <!-- Outlet Metadata & Status Konsinyasi (Apotek Pasif >90% Titip Jual) -->
                <div class="flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-slate-200/60" style="border-top:1px solid #e2e8f0; padding-top:0.35rem;">
                  <div class="truncate max-w-[200px]">
                    <span>PIC: <b>${currentOutlet.picName}</b></span>
                    <span class="text-slate-400 mx-1">·</span>
                    <span class="text-[11px] font-semibold text-teal-800">${currentOutlet.terms}</span>
                  </div>
                  <div class="text-right">
                    <span class="text-[10px] text-slate-500 block">Tagihan Barang Laku</span>
                    <span class="font-bold text-emerald-700 text-xs">
                      ${window.ArbaUtils.formatRupiah(currentOutlet.consignmentBillableAmount || 0)}
                    </span>
                  </div>
                </div>

                <!-- Ringkasan Stok Titipan di Apotek Ini & Alarm Pink Expired -->
                ${(currentOutlet.consignmentItems && currentOutlet.consignmentItems.length > 0) ? `
                  <div class="p-2 rounded-lg text-[11px] space-y-1" style="background:#fdf2f8; border:1px solid #f472b6; color:#831843; margin-top:0.35rem;">
                    <div class="font-bold flex items-center justify-between">
                      <span>📦 Stok Titipan di Apotek: ${currentOutlet.consignmentTotalUnits || 0} unit</span>
                      <span>Laku: ${currentOutlet.consignmentItems.reduce(function (s, c) { return s + c.soldQty; }, 0)} unit</span>
                    </div>
                    ${currentOutlet.consignmentItems.filter(function (c) { return c.nearExpiry; }).map(function (c) {
                      return `<div class="text-[10px] font-semibold" style="color:#be185d;">🩷 Alarm Pink: <b>${c.name}</b> (${c.remainingQty} btl, ED ${c.expiry}) — Minta apotek jual dulu!</div>`;
                    }).join('')}
                  </div>
                ` : ''}

                <!-- Quick Actions: Tagih & Isi Ulang Konsinyasi (1-Tap) & Kunjungan Tanpa Order -->
                <div class="flex gap-2" style="display:flex; gap:0.5rem; margin-top:0.5rem;">
                  <button
                    type="button"
                    id="btn-pwa-repeat-order"
                    class="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-semibold cursor-pointer border-0"
                    style="flex:1; background:#e0f2fe; color:#075985; border-radius:8px; padding:0.5rem;"
                    title="Otomatis isi jumlah barang konsinyasi yang laku terjual di apotek ini untuk ditagih & diganti stok baru"
                  >
                    <span class="material-symbols-outlined text-[15px]">sync_saved_locally</span>
                    <span>Tagih Laku &amp; Isi Ulang</span>
                  </button>
                  <button
                    type="button"
                    id="btn-pwa-visit-only"
                    class="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-semibold cursor-pointer border-0"
                    style="flex:1; background:#f1f5f9; color:#334155; border-radius:8px; padding:0.5rem;"
                  >
                    <span class="material-symbols-outlined text-[15px]">where_to_vote</span>
                    <span>Cek / Tanpa Nota</span>
                  </button>
                </div>
              </div>

              <!-- Step 2: Simplified Product Order Catalog -->
              <div class="space-y-2 mb-3">
                <div class="flex items-center justify-between mb-1.5">
                  <span class="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Ambil Order Produk Herbal
                  </span>
                  <span class="text-[11px] text-teal-800 font-semibold" style="color:#005c55;">
                    ${totalQuantity} item dipilih
                  </span>
                </div>

                <!-- Quick Category Filter Bar -->
                <div class="flex items-center gap-1 overflow-x-auto pb-1 text-xs mb-2">
                  ${[
                    { id: 'all', label: 'Semua' },
                    { id: 'madu', label: 'Madu' },
                    { id: 'kapsul', label: 'Kapsul' },
                    { id: 'minyak', label: 'Minyak' },
                    { id: 'kosmetik', label: 'Kosmetik' }
                  ].map(function (cat) {
                    var isCatActive = state.activeCategory === cat.id;
                    return `
                      <button
                        class="btn-pwa-cat px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap border-0 ${
                          isCatActive
                            ? 'bg-slate-900 text-white font-semibold'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }"
                        style="${isCatActive ? 'background:#0f172a; color:#fff;' : 'background:#f1f5f9; color:#475569;'}"
                        data-cat="${cat.id}"
                        type="button"
                      >
                        ${cat.label}
                      </button>
                    `;
                  }).join('')}
                </div>

                <!-- Quick Search -->
                <div class="relative mb-2" style="position:relative;">
                  <span class="material-symbols-outlined text-slate-400 absolute left-2.5 top-2 text-[16px] pointer-events-none" style="position:absolute; left:0.6rem; top:0.5rem; color:#94a3b8;">
                    search
                  </span>
                  <input
                    id="pwa-search-input"
                    type="text"
                    placeholder="Cari nama produk / SKU..."
                    value="${window.ArbaUtils.escapeHtml(state.productSearch)}"
                    class="w-full pl-8 pr-3 py-1.5 bg-slate-100 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none border-0"
                    style="background:#f1f5f9; padding-left:2rem; width:100%; border-radius:8px;"
                  />
                </div>

                <!-- Product List with Big Touch Steppers -->
                <div class="space-y-2 max-h-[300px] overflow-y-auto pr-0.5" style="max-height:260px; overflow-y:auto;">
                  ${filteredProducts.map(function (prod) {
                    var qty = state.cart[prod.sku] || 0;
                    var isLow = prod.stock <= prod.rop;
                    var atMax = qty >= prod.stock;
                    var consItem = (currentOutlet.consignmentItems || []).find(function (c) { return c.sku === prod.sku; });

                    return `
                      <div
                        class="p-2.5 rounded-xl border transition-colors flex items-center justify-between gap-2.5 mb-2 ${
                          qty > 0
                            ? 'bg-teal-50/50 border-teal-200'
                            : 'bg-white border-slate-200'
                        }"
                        style="border: 1px solid ${qty > 0 ? '#99f6e4' : '#e2e8f0'}; background:${qty > 0 ? '#f0fdfa' : '#fff'}; border-radius:12px; padding:0.65rem;"
                      >
                        <div class="min-w-0 flex-1">
                          <div class="font-semibold text-xs text-slate-900 truncate">
                            ${prod.name}
                          </div>
                          <div class="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                            <span class="font-mono font-semibold text-slate-800">
                              ${window.ArbaUtils.formatRupiah(prod.unitPrice)}
                            </span>
                            <span>·</span>
                            <span class="font-mono text-slate-500">Gudang: ${prod.stock}</span>
                          </div>
                          ${consItem ? `
                            <div class="text-[10px] font-semibold mt-0.5" style="color:${consItem.nearExpiry ? '#be185d' : '#0f766e'};">
                              Di Apotek: Titip ${consItem.consignedQty} · Laku <b>${consItem.soldQty}</b> · Sisa ${consItem.remainingQty}${consItem.nearExpiry ? ' · 🩷 Hampir ED!' : ''}
                            </div>
                          ` : ''}
                          ${prod.stock === 0 ? `
                            <div class="text-[10px] font-semibold mt-0.5" style="color:#be123c;">
                              Stok gudang habis — tidak dapat dipesan
                            </div>
                          ` : isLow ? `
                            <div class="text-[10px] font-semibold mt-0.5" style="color:#ea580c;">
                              🟧 Alarm Oranye: Stok Gudang &le; ROP (${prod.rop})${atMax && qty > 0 ? ' · batas stok' : ''}
                            </div>
                          ` : (atMax && qty > 0 ? `
                            <div class="text-[10px] text-amber-700 font-medium mt-0.5">Batas stok gudang tercapai</div>
                          ` : '')}
                        </div>

                        <!-- Touch-Friendly Steppers (>= 44px hit area) -->
                        <div class="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 shrink-0" style="background:#f1f5f9; border-radius:8px; padding:2px;">
                          <button
                            type="button"
                            class="btn-stepper-minus w-10 h-10 rounded-md bg-white text-slate-700 flex items-center justify-center font-bold text-base shadow-2xs hover:bg-slate-200 active:scale-95 disabled:opacity-30 cursor-pointer border-0"
                            style="width:36px; height:36px; background:#fff; border-radius:6px; cursor:pointer;"
                            data-sku="${prod.sku}"
                            ${qty === 0 ? 'disabled' : ''}
                          >
                            -
                          </button>
                          <span class="w-8 text-center font-bold text-xs font-mono text-slate-900" style="width:28px; text-align:center;">
                            ${qty}
                          </span>
                          <button
                            type="button"
                            class="btn-stepper-plus w-10 h-10 rounded-md bg-[#005c55] text-white flex items-center justify-center font-bold text-base shadow-2xs hover:bg-teal-800 active:scale-95 cursor-pointer border-0"
                            style="width:36px; height:36px; background:#005c55; color:#fff; border-radius:6px; cursor:pointer;"
                            data-sku="${prod.sku}"
                            ${atMax ? 'disabled' : ''}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>

              <!-- Step 3: Payment Terms & Simple Notes -->
              <div class="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2 mb-2" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:0.75rem;">
                <div class="flex items-center justify-between text-xs mb-1.5">
                  <span class="font-semibold text-slate-700">Skema Nota:</span>
                  <select
                    id="pwa-term-select"
                    class="bg-white px-2.5 py-1 rounded-md text-xs font-semibold text-slate-800 border border-slate-200 cursor-pointer focus:outline-none"
                    style="border:1px solid #cbd5e1;"
                  >
                    <option value="Konsinyasi (Titip Jual)" ${state.selectedTerm === 'Konsinyasi (Titip Jual)' ? 'selected' : ''}>Konsinyasi / Titip Jual (&gt;90%)</option>
                    <option value="Jatuh Tempo (Net 14 Hari)" ${state.selectedTerm === 'Jatuh Tempo (Net 14 Hari)' ? 'selected' : ''}>Jatuh Tempo (Net 14 Hari)</option>
                    <option value="Cash / Tunai di Awal" ${state.selectedTerm === 'Cash / Tunai di Awal' ? 'selected' : ''}>Cash / Tunai di Awal</option>
                  </select>
                </div>
                <input
                  id="pwa-notes-input"
                  type="text"
                  value="${window.ArbaUtils.escapeHtml(state.orderNotes)}"
                  placeholder="Catatan tambahan apoteker (opsional)..."
                  class="w-full bg-white px-2.5 py-1.5 rounded-lg text-xs text-slate-800 border border-slate-200 placeholder:text-slate-400 focus:outline-none"
                  style="border:1px solid #cbd5e1; width:100%; border-radius:8px;"
                />
              </div>
            </div>

            <!-- Sticky Bottom Action Bar - Mobile Friendly -->
            <div class="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-3.5 py-2.5 shadow-lg flex items-center justify-between gap-3 z-20" style="position:absolute; bottom:0; left:0; right:0; background:#fff; border-top:1px solid #e2e8f0; padding:0.65rem 0.85rem; z-index:20;">
              <div>
                <span class="text-[10px] text-slate-500 uppercase tracking-wider block font-medium">
                  Total ${totalQuantity} Item
                </span>
                <span class="font-bold text-sm text-[#005c55]" style="color:${overCredit ? '#be123c' : '#005c55'};">
                  ${window.ArbaUtils.formatRupiah(totalAmount)}
                </span>
                ${overCredit ? `
                  <span class="text-[10px] font-semibold block" style="color:#be123c;">Melebihi sisa plafon</span>
                ` : ''}
              </div>

              <button
                id="btn-pwa-checkout"
                ${state.isSubmitting || totalQuantity === 0 ? 'disabled' : ''}
                class="flex-1 py-3 px-4 rounded-xl bg-[#005c55] hover:bg-teal-800 text-white font-bold text-xs shadow-md active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5 transition-colors border-0"
                style="background:#005c55; color:#fff; border-radius:12px; padding:0.75rem 1rem; cursor:pointer;"
                type="button"
              >
                <span class="material-symbols-outlined text-[16px]">send</span>
                <span>${state.isSubmitting ? 'Mengirim...' : 'Simpan Tagihan &amp; Ganti Nota Baru'}</span>
              </button>
            </div>
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

    // Sales rep account switch
    var repSelect = container.querySelector('#pwa-rep-select');
    if (repSelect) {
      repSelect.addEventListener('change', function (e) {
        state.gpsCheckedIn = false;
        window.ArbaStore.setCurrentSalesRep(e.target.value);
        window.ArbaApp.showToast('Masuk sebagai ' + e.target.value, 'badge');
      });
    }

    // Tagih Laku & Isi Ulang Konsinyasi (1-tap)
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
        window.ArbaApp.showToast('Keranjang diisi sesuai barang konsinyasi yang terjual di ' + currentOutlet.name, 'sync_saved_locally');
        renderFieldSalesPwa(container);
      });
    }

    // Visit-only (canvassing) log
    var btnVisitOnly = container.querySelector('#btn-pwa-visit-only');
    if (btnVisitOnly) {
      btnVisitOnly.addEventListener('click', function () {
        openVisitOnlyModal(currentOutlet, ctx.currentRep, ctx.isCheckedInHere);
      });
    }
    // Viewport Toggle
    var btnPhone = container.querySelector('#btn-viewport-phone');
    var btnFull = container.querySelector('#btn-viewport-full');

    if (btnPhone) {
      btnPhone.addEventListener('click', function () {
        state.isPhoneFrame = true;
        renderFieldSalesPwa(container);
      });
    }
    if (btnFull) {
      btnFull.addEventListener('click', function () {
        state.isPhoneFrame = false;
        renderFieldSalesPwa(container);
      });
    }

    // Online / Offline toggle
    var btnOnline = container.querySelector('#btn-pwa-online-toggle');
    if (btnOnline) {
      btnOnline.addEventListener('click', function () {
        window.ArbaStore.toggleOnlineStatus();
      });
    }

    // 1-Tap GPS Check-in
    var btnGps = container.querySelector('#btn-gps-checkin');
    if (btnGps) {
      btnGps.addEventListener('click', function () {
        var dist = Math.floor(8 + Math.random() * 12);
        var now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        state.gpsDistance = dist;
        state.gpsCheckedIn = true;
        state.gpsOutletCode = currentOutlet.code;
        state.checkinTime = now + ' WIB';
        window.ArbaApp.showToast(`GPS Check-in: ${dist}m dari ${currentOutlet.name} (${now} WIB)`, 'pin_drop');
        renderFieldSalesPwa(container);
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
    var catBtns = container.querySelectorAll('.btn-pwa-cat');
    catBtns.forEach(function (btn) {
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
    var minusBtns = container.querySelectorAll('.btn-stepper-minus');
    minusBtns.forEach(function (btn) {
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
    var plusBtns = container.querySelectorAll('.btn-stepper-plus');
    plusBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sku = btn.getAttribute('data-sku');
        var prodPlus = products.find(function (p) { return p.sku === sku; });
        var next = (state.cart[sku] || 0) + 1;
        if (prodPlus && next > prodPlus.stock) {
          window.ArbaApp.showToast('Stok gudang ' + prodPlus.name + ' hanya tersisa ' + prodPlus.stock + ' unit', 'inventory_2');
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
          window.ArbaApp.showToast('Pilih minimal satu produk herbal untuk dipesan', 'warning');
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
          var activeRep = window.ArbaStore.getState().currentSalesRep || 'Budi Santoso';
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
            notes: state.orderNotes,
            items: items
          });

          state.isSubmitting = false;
          state.orderNotes = '';
          openThermalReceiptModal(currentOutlet, items, totalAmount);
        }, 400);
      });
    }
  }

  // Modal Pencatatan Kunjungan Tanpa Order (Canvassing / Visit-Only Log)
  function openVisitOnlyModal(outlet, salesRep, isCheckedIn) {
    var labels = window.ArbaStore.visitOutcomeLabels || {
      NO_ORDER_STOCK_FULL: 'Stok Outlet Masih Penuh',
      COLLECTION: 'Penagihan Faktur Jatuh Tempo',
      FOLLOW_UP: 'Follow-up Minggu Depan',
      PIC_ABSENT: 'PIC/Apoteker Sedang Tidak di Tempat',
      DISPLAY_CHECK: 'Cek Display & Merchandising'
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
            <h3 class="font-bold text-sm">Catat Kunjungan Tanpa Order (Canvassing)</h3>
          </div>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div class="modal-body text-xs space-y-3">
          <div class="bg-surface-container-low p-3 rounded-lg border border-border-subtle/60 space-y-1">
            <div class="font-semibold text-on-surface">${outlet.name} (${outlet.cityName})</div>
            <div class="text-on-surface-variant">Sales Rep: <b>${salesRep}</b> · GPS: <b>${isCheckedIn ? state.gpsDistance + 'm (Terverifikasi)' : 'Check-in Otomatis'}</b></div>
          </div>

          <div class="space-y-1">
            <label class="font-semibold text-on-surface block">Hasil Kunjungan Lapangan</label>
            <select id="visit-only-outcome" class="w-full p-2.5 rounded-lg border border-border-subtle bg-surface text-on-surface text-xs font-medium">
              ${optionsHtml}
            </select>
          </div>

          <div class="space-y-1">
            <label class="font-semibold text-on-surface block">Catatan Kunjungan / Temuan Rak &amp; Faktur</label>
            <textarea
              id="visit-only-notes"
              rows="3"
              placeholder="Contoh: Stok Madu Randu di etalase masih 18 botol, jadwal repeat order 5 hari lagi..."
              class="w-full p-2.5 rounded-lg border border-border-subtle bg-surface text-on-surface text-xs"
            ></textarea>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button type="button" class="px-3.5 py-2 rounded-lg bg-surface-container text-on-surface text-xs font-semibold cursor-pointer border-0" onclick="window.ArbaApp.closeModal()">
              Batal
            </button>
            <button type="button" id="btn-save-visit-only" class="px-4 py-2 rounded-lg bg-primary text-white text-xs font-semibold cursor-pointer border-0 flex items-center gap-1">
              <span class="material-symbols-outlined text-[15px]">check</span>
              <span>Simpan Log Kunjungan</span>
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
          var dist = isCheckedIn ? state.gpsDistance : Math.floor(8 + Math.random() * 12);
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

  // 58mm Mobile Thermal Receipt Modal
  function openThermalReceiptModal(outlet, items, totalAmount) {
    var isOnline = window.ArbaStore.getState().isOnline;

    var modalHtml = `
      <div class="modal-dialog max-w-sm" style="max-width:380px;">
        <div class="modal-header">
          <div class="flex items-center gap-2 text-slate-900">
            <span class="material-symbols-outlined text-emerald-600 text-[20px]">check_circle</span>
            <h3 class="font-bold text-xs">Pesanan Berhasil Disimpan</h3>
          </div>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div class="modal-body text-xs">
          <!-- Clean Monospace Thermal Receipt Simulation -->
          <div class="bg-slate-50 p-3.5 rounded-xl border border-dashed border-slate-300 font-mono text-[11px] text-slate-800 space-y-1.5 leading-tight" style="background:#f8fafc; border:1px dashed #cbd5e1; font-family:monospace; padding:0.875rem;">
            <div class="text-center pb-1 border-b border-dashed border-slate-300 text-center" style="border-bottom:1px dashed #cbd5e1; padding-bottom:0.35rem;">
              <div class="font-bold text-xs">CV ARBA'IN SURAKARTA</div>
              <div class="text-[10px] text-slate-500">Distributor Logistik Farmasi Herbal</div>
            </div>

            <div class="text-[10px] py-1 border-b border-dashed border-slate-300 space-y-0.5 text-slate-600" style="border-bottom:1px dashed #cbd5e1; padding:0.35rem 0;">
              <div>Outlet: <b>${outlet.name}</b></div>
              <div>Sales: Budi Santoso (${state.checkinTime})</div>
              <div>Status: ${isOnline ? 'Tersinkron ke Pusat' : 'Tersimpan Offline'}</div>
              <div>Termin: ${state.selectedTerm}</div>
            </div>

            <div class="py-1 space-y-1" style="padding:0.35rem 0;">
              ${items.map(function (it) {
                return `
                  <div class="flex justify-between" style="display:flex; justify-content:space-between;">
                    <span class="truncate max-w-[170px]">${it.name} x${it.quantity}</span>
                    <span class="font-semibold">${window.ArbaUtils.formatRupiah(it.subtotal)}</span>
                  </div>
                `;
              }).join('')}
            </div>

            <div class="pt-1.5 border-t border-dashed border-slate-300 flex justify-between font-bold text-xs text-slate-900" style="border-top:1px dashed #cbd5e1; padding-top:0.35rem; display:flex; justify-content:space-between;">
              <span>TOTAL:</span>
              <span>${window.ArbaUtils.formatRupiah(totalAmount)}</span>
            </div>
          </div>

          <!-- Action buttons: WhatsApp Share + Thermal Print -->
          <div class="flex flex-col gap-2 pt-1">
            <button
              id="btn-thermal-share-wa"
              type="button"
              class="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs border-0"
              style="background:#059669; color:#fff;"
            >
              <span class="material-symbols-outlined text-[16px]">share</span>
              <span>Kirim Bukti via WhatsApp Apotek</span>
            </button>
            <div class="flex gap-2">
              <button
                id="btn-thermal-print"
                type="button"
                class="flex-1 py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer border-0"
              >
                <span class="material-symbols-outlined text-[15px]">print</span>
                <span>Cetak Struk</span>
              </button>
              <button
                id="btn-thermal-done"
                type="button"
                class="flex-1 py-2 px-3 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-semibold cursor-pointer border-0"
                style="background:#0f172a; color:#fff;"
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
            return `• ${it.name}: ${it.quantity} unit (${window.ArbaUtils.formatRupiah(it.subtotal)})`;
          }).join('%0A');

          var msg = `*SURAT PESANAN B2B - CV ARBA'IN*%0AOutlet: ${outlet.name}%0ATanggal: ${new Date().toLocaleDateString('id-ID')}%0ASales: Budi Santoso%0ATermin: ${state.selectedTerm}%0A%0A*Rincian Produk:*%0A${itemsText}%0A%0A*Total: ${window.ArbaUtils.formatRupiah(totalAmount)}*%0A_Garansi resmi CDOB & FEFO CV Arba'in_`;
          window.open(`https://wa.me/?text=${msg}`, '_blank');
        };
      }

      var btnPrint = document.getElementById('btn-thermal-print');
      if (btnPrint) {
        btnPrint.onclick = function () {
          window.ArbaApp.showToast('Struk dicetak ke printer Bluetooth 58mm', 'print');
          window.print();
        };
      }

      var btnDone = document.getElementById('btn-thermal-done');
      if (btnDone) {
        btnDone.onclick = function () {
          state.cart = {};
          window.ArbaApp.closeModal();
          var container = document.getElementById('main-view-container');
          if (container) renderFieldSalesPwa(container);
        };
      }
    }, 50);
  }

  window.ArbaViews.renderFieldSalesPwa = renderFieldSalesPwa;
})();
