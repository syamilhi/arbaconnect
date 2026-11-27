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
    isPhoneFrame: false,
    activePwaTab: 'outlet',
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
    var isFieldSalesRole = appState.currentUser && appState.currentUser.role === 'field-sales';
    var currentRep = isFieldSalesRole
      ? (appState.currentUser.salesRepName || appState.currentUser.name)
      : (appState.currentSalesRep || 'Budi Santoso');
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
    var isSuperAdminUser = appState.currentUser && appState.currentUser.role === 'super-admin';
    var wrapperEl = document.querySelector('.app-wrapper');
    var isFullscreenMode = Boolean(wrapperEl && wrapperEl.classList.contains('pwa-mobile-only'));

    var html = `
      <div class="flex flex-col items-center w-full pb-12">
        ${isSuperAdminUser && !isFullscreenMode ? `
          <!-- Viewport Control Bar (Khusus Super Admin) -->
          <div class="w-full max-w-[420px] flex items-center justify-between mb-3 bg-surface-container-lowest p-2.5 rounded-xl border border-border-subtle/50 text-xs text-on-surface-variant">
            <div class="flex items-center gap-1.5">
              <span class="material-symbols-outlined text-primary text-[18px]">smartphone</span>
              <span class="font-semibold text-on-surface">Tampilan Mobile (420px)</span>
            </div>
            <button
              id="btn-viewport-full"
              class="px-2.5 py-1 rounded-md font-semibold cursor-pointer transition-colors border-0 text-xs bg-primary text-white flex items-center gap-1"
              type="button"
            >
              <span class="material-symbols-outlined text-[14px]">fullscreen</span>
              <span>Layar Penuh</span>
            </button>
          </div>
        ` : ''}

        <!-- Field Sales Main Application Container -->
        <div
          id="field-sales-pwa-preview"
          class="w-full transition-all duration-200 max-w-[420px] rounded-3xl border border-border-subtle/70 bg-surface shadow-xl overflow-hidden"
          style="max-width: 420px; border-radius: 28px;"
        >
          <!-- App Frame -->
          <div class="pwa-app-frame flex flex-col min-h-[680px] bg-white text-slate-900 relative rounded-2xl overflow-hidden" style="position:relative; background:#fff; min-height:680px;">
            <!-- Top Bar - Sales Profile & Sync Status -->
            <div class="bg-[#005c55] text-white px-4 py-3 sticky top-0 z-30 shadow-xs flex items-center justify-between" style="background:#005c55; color:#fff;">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs text-white shrink-0" style="width:32px; height:32px; border-radius:50%; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                  ${repInitials}
                </div>
                <div class="flex flex-col min-w-0">
                  ${isFieldSalesRole ? `
                    <span class="font-bold text-xs leading-tight text-white truncate">${currentRep}</span>
                    <span class="text-[11px] text-teal-100 font-medium truncate">${appState.currentUser.division || 'Sales Lapangan'}</span>
                  ` : `
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
                    <span class="text-[11px] text-teal-100 font-medium">Sales Lapangan · Solo Raya</span>
                  `}
                </div>
              </div>

              <!-- Network Sync Status Indicator Button -->
              <button
                id="btn-pwa-online-toggle"
                title="Status Koneksi & Sinkronisasi Data"
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
                <span>${isOnline ? 'Tersinkron' : 'Mode Lokal'}</span>
                ${!isOnline && offlineQueue.length > 0 ? `
                  <span class="ml-1 px-1 bg-amber-900 text-amber-200 text-[10px] rounded">
                    ${offlineQueue.length}
                  </span>
                ` : ''}
              </button>
              ${isFullscreenMode ? `
                <button
                  id="btn-pwa-exit-fullscreen"
                  type="button"
                  title="Keluar Layar Penuh"
                  class="flex items-center justify-center p-1.5 rounded-lg cursor-pointer border-0"
                  style="background:rgba(255,255,255,0.18); color:#fff;"
                >
                  <span class="material-symbols-outlined text-[16px]">fullscreen_exit</span>
                </button>
              ` : ''}
            </div>

            <!-- Daily Target Progress Strip (live dari log kunjungan) -->
            <div class="pwa-kpi-strip px-4 py-2 flex items-center justify-between gap-2 text-[11px]" style="background:#e6f4f2; color:#004d47; padding:0.45rem 1rem; border-bottom:1px solid #cce7e3;">
              <span class="flex items-center gap-1 whitespace-nowrap">
                <span class="material-symbols-outlined text-[14px]" aria-hidden="true">directions_walk</span>
                <span>Kunjungan: <b>${repPerf.visitsToday}/${repPerf.dailyVisitTarget}</b></span>
              </span>
              <span class="whitespace-nowrap">Order: <b>${repPerf.ordersToday}</b></span>
              <span class="whitespace-nowrap">Omset: <b>${repPerf.revenuePct}%</b></span>
            </div>

            ${(!isOnline || offlineQueue.length > 0) ? `
              <!-- Offline-First Storage & Queue Status Banner -->
              <div class="px-3.5 py-2.5 text-xs" style="background:#fffbeb; border-bottom:1px solid #fde68a; color:#78350f; padding:0.6rem 0.9rem;">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-1.5 font-bold text-[11px]" style="color:#92400e;">
                    <span class="material-symbols-outlined text-[16px]">cloud_off</span>
                    <span>Mode Offline (${offlineQueue.length} antrean lokal)</span>
                  </div>
                  <button
                    type="button"
                    id="btn-pwa-sync-now"
                    class="px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer border-0"
                    style="background:#005c55; color:#fff; border-radius:6px; padding:0.25rem 0.6rem;"
                  >
                    Kirim ke Pusat (${offlineQueue.length})
                  </button>
                </div>
                ${offlineQueue.length > 0 ? `
                  <div class="mt-1.5 text-[10px] space-y-0.5" style="color:#92400e;">
                    <div><b>${offlineQueue.length} transaksi</b> tersimpan aman di memori HP &amp; siap dikirim saat online:</div>
                    ${offlineQueue.slice(0, 3).map(function (q) {
                      return `<div class="truncate">• ${window.ArbaUtils.escapeHtml(q.summary || ('Order #' + q.id))}</div>`;
                    }).join('')}
                  </div>
                ` : `
                  <div class="mt-1 text-[10px]" style="color:#92400e;">
                    Input order &amp; kunjungan tetap berjalan tanpa sinyal. Data otomatis dikirim ke pusat saat online kembali.
                  </div>
                `}
              </div>
            ` : ''}

            <!-- 2-Tab Navigation: Outlet | Order -->
            <div class="grid grid-cols-2 border-b border-slate-200 bg-white text-xs font-bold" style="display:grid; grid-template-columns:1fr 1fr; border-bottom:1px solid #e2e8f0; background:#fff;">
              <button
                type="button"
                id="btn-pwa-tab-outlet"
                class="py-2.5 text-center cursor-pointer border-0 transition-colors ${state.activePwaTab === 'outlet' ? 'text-[#005c55] border-b-2 border-[#005c55] bg-teal-50/40' : 'text-slate-500 bg-white'}"
                style="padding:0.65rem; border:0; border-bottom:${state.activePwaTab === 'outlet' ? '2px solid #005c55' : '2px solid transparent'}; color:${state.activePwaTab === 'outlet' ? '#005c55' : '#64748b'}; background:${state.activePwaTab === 'outlet' ? '#f0fdfa' : '#fff'};"
              >
                Outlet &amp; Lokasi
              </button>
              <button
                type="button"
                id="btn-pwa-tab-order"
                class="py-2.5 text-center cursor-pointer border-0 transition-colors ${state.activePwaTab === 'order' ? 'text-[#005c55] border-b-2 border-[#005c55] bg-teal-50/40' : 'text-slate-500 bg-white'}"
                style="padding:0.65rem; border:0; border-bottom:${state.activePwaTab === 'order' ? '2px solid #005c55' : '2px solid transparent'}; color:${state.activePwaTab === 'order' ? '#005c55' : '#64748b'}; background:${state.activePwaTab === 'order' ? '#f0fdfa' : '#fff'};"
              >
                Order (${totalQuantity})
              </button>
            </div>

            <!-- Main App Body -->
            <div class="pwa-app-body flex-1 p-3.5 space-y-3 pb-24" style="padding: 0.875rem; padding-bottom: 6rem;">
              ${state.activePwaTab === 'outlet' ? `
              <!-- Tab 1: Outdoor GPS Check-In & Outlet Card -->
              <div class="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2.5 mb-3" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:0.75rem;">
                <div class="flex items-center justify-between mb-2">
                  <label for="pwa-outlet-select" class="text-[11px] uppercase tracking-wider font-bold text-slate-600">
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

                <!-- Outlet Metadata & Status Konsinyasi -->
                <div class="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1.5 border-t border-slate-200/60" style="border-top:1px solid #e2e8f0; padding-top:0.35rem;">
                  <div class="min-w-0">
                    <div class="text-[10px] text-slate-500">PIC</div>
                    <div class="font-semibold text-slate-800 truncate">${window.ArbaUtils.escapeHtml(currentOutlet.picName)}</div>
                    <div class="text-[10px] font-semibold text-teal-800">${window.ArbaUtils.escapeHtml(currentOutlet.terms)}</div>
                  </div>
                  <div class="text-right">
                    <span class="text-[10px] text-slate-500 block">Tagihan</span>
                    <span class="font-bold text-emerald-700 text-xs">
                      ${window.ArbaUtils.formatRupiah(currentOutlet.consignmentBillableAmount || 0)}
                    </span>
                  </div>
                </div>

                <!-- Peta Lokasi Nyata Geofence GPS Apotek Target (Leaflet + OpenStreetMap) -->
                ${(function () {
                  var coords = window.ArbaStore.getOutletCoordinates ? window.ArbaStore.getOutletCoordinates(currentOutlet) : { lat: currentOutlet.lat || -7.5682, lng: currentOutlet.lng || 110.8091 };
                  var gmapsUrl = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(coords.lat + ',' + coords.lng) + '&travelmode=driving';
                  return `
                    <div class="rounded-lg overflow-hidden border border-slate-200 bg-white mt-1.5" style="border:1px solid #cbd5e1; border-radius:10px;">
                      <div class="px-2.5 py-1.5 flex items-center justify-between text-[10px] bg-slate-100 border-b border-slate-200" style="background:#f1f5f9; border-bottom:1px solid #e2e8f0;">
                        <span class="font-bold text-slate-700 flex items-center gap-1">
                          <span class="material-symbols-outlined text-[13px] text-teal-700">my_location</span>
                          <span>Titik GPS: <b class="font-mono">${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}</b></span>
                        </span>
                        <a href="${gmapsUrl}" target="_blank" rel="noreferrer" class="font-bold text-teal-800 hover:underline flex items-center gap-0.5" style="color:#005c55;">
                          <span class="material-symbols-outlined text-[13px]">directions</span>
                          <span>Navigasi Google Maps</span>
                        </a>
                      </div>
                      <div
                        id="pwa-checkin-leaflet-map"
                        data-lat="${coords.lat}"
                        data-lng="${coords.lng}"
                        data-name="${window.ArbaUtils.escapeHtml(currentOutlet.name)}"
                        data-addr="${window.ArbaUtils.escapeHtml(currentOutlet.address + ', ' + currentOutlet.cityName)}"
                        style="width:100%; height:130px; z-index:1; background:#e2e8f0;"
                      ></div>
                    </div>
                  `;
                })()}

                <!-- Ringkasan Stok Titipan di Apotek Ini & Alarm Pink Expired -->
                ${(currentOutlet.consignmentItems && currentOutlet.consignmentItems.length > 0) ? `
                  <div class="p-2 rounded-lg text-[11px] space-y-1" style="background:#fdf2f8; border:1px solid #f472b6; color:#831843; margin-top:0.35rem;">
                    <div class="font-bold flex items-center justify-between">
                      <span>📦 Saldo Konsinyasi Mitra: ${currentOutlet.consignmentTotalUnits || 0} unit</span>
                      <span>Terjual: ${currentOutlet.consignmentItems.reduce(function (s, c) { return s + c.soldQty; }, 0)} unit</span>
                    </div>
                    ${currentOutlet.consignmentItems.filter(function (c) { return c.nearExpiry; }).map(function (c) {
                      return `<div class="text-[10px] font-semibold" style="color:#be185d;">ED ${window.ArbaUtils.escapeHtml(c.expiry)}: <b>${window.ArbaUtils.escapeHtml(c.name)}</b> (${c.remainingQty} unit)</div>`;
                    }).join('')}
                  </div>
                ` : ''}

                <!-- Quick Actions: 1-word labels -->
                <div class="grid grid-cols-3 gap-1.5" style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.35rem; margin-top:0.5rem;">
                  <button
                    type="button"
                    id="btn-pwa-repeat-order"
                    class="flex items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-semibold cursor-pointer border-0 whitespace-nowrap"
                    style="background:#e0f2fe; color:#075985; border-radius:8px; padding:0.45rem;"
                  >
                    <span class="material-symbols-outlined text-[15px]">sync_saved_locally</span>
                    <span>Restock</span>
                  </button>
                  <button
                    type="button"
                    id="btn-pwa-tsp-route"
                    class="flex items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-bold cursor-pointer border-0 whitespace-nowrap"
                    style="background:#d1fae5; color:#065f46; border-radius:8px; padding:0.45rem;"
                  >
                    <span class="material-symbols-outlined text-[15px]">route</span>
                    <span>Rute</span>
                  </button>
                  <button
                    type="button"
                    id="btn-pwa-visit-only"
                    class="flex items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-semibold cursor-pointer border-0 whitespace-nowrap"
                    style="background:#f1f5f9; color:#334155; border-radius:8px; padding:0.45rem;"
                  >
                    <span class="material-symbols-outlined text-[15px]">where_to_vote</span>
                    <span>Kunjungan</span>
                  </button>
                </div>
              </div>
              ` : `
              <!-- Tab 2: Product Order Catalog -->
              <div class="space-y-2 mb-3">
                <div class="flex items-center justify-between gap-2 mb-1.5">
                  <span class="text-xs font-bold text-slate-800 uppercase tracking-wider whitespace-nowrap">
                    Katalog Produk
                  </span>
                  <div class="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      id="btn-pwa-scan-qr"
                      class="px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 cursor-pointer border-0 whitespace-nowrap"
                      style="background:#005c55; color:#ffffff;"
                    >
                      <span class="material-symbols-outlined text-[14px]">qr_code_scanner</span>
                      <span>Scan QR</span>
                    </button>
                    <span class="text-[11px] text-teal-800 font-semibold whitespace-nowrap" style="color:#005c55;">
                      ${totalQuantity} unit
                    </span>
                  </div>
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
                  <span class="material-symbols-outlined text-slate-400 absolute left-2.5 top-2 text-[16px] pointer-events-none" style="position:absolute; left:0.6rem; top:0.5rem; color:#475569;" aria-hidden="true">
                    search
                  </span>
                  <input
                    id="pwa-search-input"
                    type="text"
                    aria-label="Cari nama produk herbal atau SKU"
                    placeholder="Cari nama produk / SKU..."
                    value="${window.ArbaUtils.escapeHtml(state.productSearch)}"
                    class="w-full pl-8 pr-3 py-1.5 bg-slate-100 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none border-0"
                    style="background:#f1f5f9; padding-left:2rem; width:100%; border-radius:8px;"
                  />
                </div>

                <!-- Product List with Big Touch Steppers -->
                <div class="space-y-2">
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
                            ${window.ArbaUtils.escapeHtml(prod.name)}
                          </div>
                          <div class="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                            <span class="font-mono font-semibold text-slate-800">
                              ${window.ArbaUtils.formatRupiah(prod.unitPrice)}
                            </span>
                            <span>·</span>
                            <span class="font-mono text-slate-500">Gudang: ${prod.stock}</span>
                          </div>
                          ${consItem ? `
                            <div class="text-[10px] font-semibold mt-0.5 truncate" style="color:${consItem.nearExpiry ? '#be185d' : '#0f766e'};">
                              Titipan: ${consItem.soldQty}/${consItem.consignedQty} laku · Sisa ${consItem.remainingQty}${consItem.nearExpiry ? ' · ED' : ''}
                            </div>
                          ` : ''}
                          ${prod.stock === 0 ? `
                            <div class="text-[10px] font-semibold mt-0.5" style="color:#be123c;">Stok Habis</div>
                          ` : isLow ? `
                            <div class="text-[10px] font-semibold mt-0.5" style="color:#ea580c;">ROP (Min ${prod.rop})</div>
                          ` : (atMax && qty > 0 ? `
                            <div class="text-[10px] text-amber-700 font-medium mt-0.5">Maksimal stok</div>
                          ` : '')}
                        </div>

                        <!-- Touch-Friendly Steppers (>= 44px hit area) -->
                        <div class="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 shrink-0" style="background:#f1f5f9; border-radius:8px; padding:2px;">
                          <button
                            type="button"
                            class="btn-stepper-minus w-10 h-10 rounded-md bg-white text-slate-700 flex items-center justify-center font-bold text-base shadow-2xs hover:bg-slate-200 active:scale-95 disabled:opacity-30 cursor-pointer border-0"
                            style="width:36px; height:36px; background:#fff; border-radius:6px; cursor:pointer;"
                            data-sku="${prod.sku}"
                            aria-label="Kurangi kuantitas ${window.ArbaUtils.escapeHtml(prod.name)}"
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
                            aria-label="Tambah kuantitas ${window.ArbaUtils.escapeHtml(prod.name)}"
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

              <!-- Step 3: Payment Terms, E-Signature Apoteker & Bukti Foto Etalase Offline -->
              <div class="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2.5 mb-2" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:0.75rem;">
                <div class="flex items-center justify-between text-xs mb-1">
                  <label for="pwa-term-select" class="font-semibold text-slate-700">Skema Nota:</label>
                  <select
                    id="pwa-term-select"
                    aria-label="Pilih skema pembayaran nota"
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
                  aria-label="Catatan tambahan apoteker"
                  value="${window.ArbaUtils.escapeHtml(state.orderNotes)}"
                  placeholder="Catatan tambahan apoteker (opsional)..."
                  class="w-full bg-white px-2.5 py-1.5 rounded-lg text-xs text-slate-800 border border-slate-200 placeholder:text-slate-400 focus:outline-none"
                  style="border:1px solid #cbd5e1; width:100%; border-radius:8px;"
                />

                <!-- Pad Tanda Tangan Digital Apoteker (HTML5 Canvas E-Signature) -->
                <div class="pt-1 border-t border-slate-200">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      <span class="material-symbols-outlined text-[14px] text-teal-700">draw</span>
                      Tanda Tangan Apoteker (${currentOutlet.picName || 'PIC Outlet'})
                    </span>
                    <div class="flex items-center gap-1">
                      <button
                        type="button"
                        id="btn-pwa-clear-sign"
                        class="px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer border-0"
                        style="background:#f1f5f9; color:#475569;"
                      >
                        Bersihkan TTD
                      </button>
                    </div>
                  </div>
                  <div style="background:#ffffff; border:1px dashed #94a3b8; border-radius:8px; overflow:hidden; position:relative;">
                    <canvas id="pwa-signature-canvas" width="320" height="76" style="width:100%; height:76px; display:block; touch-action:none; cursor:crosshair;"></canvas>
                    ${state.signatureDataUrl ? `
                      <span style="position:absolute; right:6px; bottom:4px; font-size:9px; font-weight:700; color:#059669; background:#ecfdf5; padding:1px 5px; border-radius:4px;">✓ TTD Tersimpan</span>
                    ` : `
                      <span id="pwa-sign-hint" style="position:absolute; left:8px; bottom:4px; font-size:9px; color:#94a3b8; pointer-events:none;">Goreskan tanda tangan di sini...</span>
                    `}
                  </div>
                </div>

                <!-- Bukti Foto Etalase Rak Herbal Offline-Ready -->
                <div class="pt-1 border-t border-slate-200 flex items-center justify-between gap-2">
                  <div class="text-[11px] text-slate-700">
                    <div class="font-bold flex items-center gap-1">
                      <span class="material-symbols-outlined text-[14px] text-teal-700">photo_camera</span>
                      Bukti Foto Etalase Rak
                    </div>
                    <div class="text-[10px] text-slate-500">
                      ${state.shelfPhotoDataUrl ? '✓ Foto etalase siap disinkronkan' : 'Opsional — disimpan lokal saat offline'}
                    </div>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <label
                      for="pwa-shelf-file-input"
                      class="px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer"
                      style="background:#f1f5f9; color:#334155; border:1px solid #cbd5e1;"
                    >
                      Pilih File
                    </label>
                    <input id="pwa-shelf-file-input" type="file" accept="image/*" capture="environment" style="display:none;" />
                    <button
                      type="button"
                      id="btn-pwa-capture-shelf"
                      class="px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer border-0"
                      style="background:#005c55; color:#ffffff;"
                    >
                      ${state.shelfPhotoDataUrl ? 'Ganti Foto' : 'Ambil Foto Audit'}
                    </button>
                  </div>
                </div>
                ${window.ArbaUtils.safeImageDataUrl(state.shelfPhotoDataUrl) ? `
                  <div class="mt-1 rounded-lg overflow-hidden border border-slate-300">
                    <img src="${window.ArbaUtils.safeImageDataUrl(state.shelfPhotoDataUrl)}" alt="Bukti Foto Etalase" style="width:100%; height:72px; object-fit:cover; display:block;" />
                  </div>
                ` : ''}
              </div>
              `}
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

    // Inisialisasi Peta Nyata Geofence GPS Apotek Target di PWA Sales
    var pwaMapEl = container.querySelector('#pwa-checkin-leaflet-map');
    if (pwaMapEl && typeof window.L !== 'undefined') {
      try {
        if (window.__arbaPwaCheckinMap) {
          try { window.__arbaPwaCheckinMap.remove(); } catch (e) {}
          window.__arbaPwaCheckinMap = null;
        }
        var pLat = Number(pwaMapEl.getAttribute('data-lat')) || -7.5682;
        var pLng = Number(pwaMapEl.getAttribute('data-lng')) || 110.8091;
        var pName = pwaMapEl.getAttribute('data-name') || currentOutlet.name;
        var pMap = window.L.map(pwaMapEl, {
          center: [pLat, pLng],
          zoom: 16,
          zoomControl: false
        });
        window.__arbaPwaCheckinMap = pMap;
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OSM'
        }).addTo(pMap);

        // Radius Geofence 50m di sekitar titik Apotek
        window.L.circle([pLat, pLng], {
          color: '#005c55',
          fillColor: '#10b981',
          fillOpacity: 0.2,
          radius: 45,
          weight: 1.5
        }).addTo(pMap);

        var pIcon = window.L.divIcon({
          className: 'pwa-outlet-pin',
          html: '<div style="width:24px;height:24px;border-radius:50%;background:#005c55;color:#fff;font-size:12px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);">📍</div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });
        window.L.marker([pLat, pLng], { icon: pIcon })
          .addTo(pMap)
          .bindPopup('<div style="font-size:11px;font-weight:700;">' + window.ArbaUtils.escapeHtml(pName) + '</div>');
        setTimeout(function () { pMap.invalidateSize(); }, 80);
      } catch (err) {}
    }

    // 2-Tab switcher (Outlet | Order)
    var btnTabOutlet = container.querySelector('#btn-pwa-tab-outlet');
    if (btnTabOutlet) {
      btnTabOutlet.addEventListener('click', function () {
        state.activePwaTab = 'outlet';
        renderFieldSalesPwa(container);
      });
    }
    var btnTabOrder = container.querySelector('#btn-pwa-tab-order');
    if (btnTabOrder) {
      btnTabOrder.addEventListener('click', function () {
        state.activePwaTab = 'order';
        renderFieldSalesPwa(container);
      });
    }

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

    // Optimasi Rute TSP button
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
            window.ArbaApp.showToast('QR Batch ' + scannedProd.activeBatch + ' diverifikasi & +2 ' + scannedProd.name + ' masuk keranjang!', 'qr_code_scanner');
            renderFieldSalesPwa(container);
          }
        });
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

      var btnAutoSign = container.querySelector('#btn-pwa-auto-sign');
      if (btnAutoSign) {
        btnAutoSign.addEventListener('click', function () {
          sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
          sigCtx.strokeStyle = '#005c55';
          sigCtx.lineWidth = 2.2;
          sigCtx.beginPath();
          sigCtx.moveTo(35, 52);
          sigCtx.bezierCurveTo(65, 16, 95, 64, 130, 28);
          sigCtx.bezierCurveTo(155, 12, 175, 55, 220, 35);
          sigCtx.lineTo(275, 42);
          sigCtx.stroke();
          sigCtx.fillStyle = '#0f172a';
          sigCtx.font = 'bold 10px sans-serif';
          sigCtx.fillText((currentOutlet.picName || 'Apoteker APA') + ' • Terverifikasi', 35, 68);
          state.signatureDataUrl = sigCanvas.toDataURL('image/png');
          renderFieldSalesPwa(container);
        });
      }

      var btnClearSign = container.querySelector('#btn-pwa-clear-sign');
      if (btnClearSign) {
        btnClearSign.addEventListener('click', function () {
          sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
          state.signatureDataUrl = null;
          renderFieldSalesPwa(container);
        });
      }
    }

    // Bukti Foto Etalase Rak Herbal
    var btnCaptureShelf = container.querySelector('#btn-pwa-capture-shelf');
    if (btnCaptureShelf && window.ArbaAdvanced) {
      btnCaptureShelf.addEventListener('click', function () {
        state.shelfPhotoDataUrl = window.ArbaAdvanced.generateSampleShelfPhotoDataUrl(currentOutlet.name, ctx.currentRep);
        window.ArbaApp.showToast('Bukti foto etalase rak berhasil direkam untuk ' + currentOutlet.name, 'photo_camera');
        renderFieldSalesPwa(container);
      });
    }

    var shelfFileInput = container.querySelector('#pwa-shelf-file-input');
    if (shelfFileInput) {
      shelfFileInput.addEventListener('change', function (e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
          state.shelfPhotoDataUrl = ev.target.result;
          window.ArbaApp.showToast('Foto etalase berhasil diunggah', 'photo_camera');
          renderFieldSalesPwa(container);
        };
        reader.readAsDataURL(file);
      });
    }
    // Fullscreen Mobile-Only Mode (hides header, aside, footer)
    var btnFull = container.querySelector('#btn-viewport-full');
    if (btnFull) {
      btnFull.addEventListener('click', function () {
        var wrapper = document.querySelector('.app-wrapper');
        if (wrapper) wrapper.classList.add('pwa-mobile-only');
        if (window.ArbaApp && window.ArbaApp.toggleFullscreen && !document.fullscreenElement) {
          window.ArbaApp.toggleFullscreen();
        }
        renderFieldSalesPwa(container);
      });
    }
    var btnExitFull = container.querySelector('#btn-pwa-exit-fullscreen');
    if (btnExitFull) {
      btnExitFull.addEventListener('click', function () {
        var wrapper = document.querySelector('.app-wrapper');
        if (wrapper) wrapper.classList.remove('pwa-mobile-only');
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(function () {});
        }
        renderFieldSalesPwa(container);
      });
    }

    // Online / Offline sync action
    var btnOnline = container.querySelector('#btn-pwa-online-toggle');
    if (btnOnline) {
      btnOnline.addEventListener('click', function () {
        var st = window.ArbaStore.getState();
        if (st.currentUser && st.currentUser.role === 'super-admin') {
          window.ArbaStore.toggleOnlineStatus();
        } else {
          window.ArbaStore.syncNow();
        }
      });
    }

    // Sync Now button inside Offline Banner
    var btnSyncNow = container.querySelector('#btn-pwa-sync-now');
    if (btnSyncNow) {
      btnSyncNow.addEventListener('click', function () {
        window.ArbaStore.syncNow();
      });
    }

    // 1-Tap GPS Check-in (mendukung Geolocation API asli + fallback simulasi presisi)
    var btnGps = container.querySelector('#btn-gps-checkin');
    if (btnGps) {
      btnGps.addEventListener('click', function () {
        var finishCheckin = function (dist, coordsText) {
          var now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
          state.gpsDistance = dist;
          state.gpsCoords = coordsText;
          state.gpsCheckedIn = true;
          state.gpsOutletCode = currentOutlet.code;
          state.checkinTime = now + ' WIB';
          window.ArbaApp.showToast(`GPS Check-in: ${dist}m dari ${currentOutlet.name} (${now} WIB)`, 'pin_drop');
          renderFieldSalesPwa(container);
        };

        var targetCoords = window.ArbaStore.getOutletCoordinates
          ? window.ArbaStore.getOutletCoordinates(currentOutlet)
          : { lat: currentOutlet.lat || -7.5682, lng: currentOutlet.lng || 110.8091 };

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            function (pos) {
              var lat = pos.coords.latitude;
              var lng = pos.coords.longitude;
              var realKm = window.ArbaStore.haversineKm
                ? window.ArbaStore.haversineKm(lat, lng, targetCoords.lat, targetCoords.lng)
                : 0.012;
              var distMeter = realKm < 1.5 ? Math.max(4, Math.round(realKm * 1000)) : Math.min(25, Math.max(5, Math.round(pos.coords.accuracy || 12)));
              finishCheckin(distMeter, lat.toFixed(5) + ', ' + lng.toFixed(5) + ' (GPS Perangkat)');
            },
            function () {
              finishCheckin(Math.floor(8 + Math.random() * 12), targetCoords.lat.toFixed(4) + ', ' + targetCoords.lng.toFixed(4) + ' (Presisi GPS)');
            },
            { enableHighAccuracy: true, timeout: 2500, maximumAge: 60000 }
          );
        } else {
          finishCheckin(Math.floor(8 + Math.random() * 12), targetCoords.lat.toFixed(4) + ', ' + targetCoords.lng.toFixed(4) + ' (Presisi GPS)');
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
            signerName: currentOutlet.picName || 'Apoteker Penanggung Jawab',
            shelfPhotoDataUrl: savedPhoto,
            scannedQrBatches: savedQrBatches,
            items: items
          });

          openThermalReceiptModal(currentOutlet, items, totalAmount, activeRep, savedSignature, savedPhoto);
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
            <div class="font-semibold text-on-surface">${window.ArbaUtils.escapeHtml(outlet.name)} (${window.ArbaUtils.escapeHtml(outlet.cityName)})</div>
            <div class="text-on-surface-variant">Sales Rep: <b>${window.ArbaUtils.escapeHtml(salesRep)}</b> · GPS: <b>${isCheckedIn ? state.gpsDistance + 'm (Terverifikasi)' : 'Check-in Otomatis'}</b></div>
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
  function openThermalReceiptModal(outlet, items, totalAmount, salesRepName, signatureDataUrl, shelfPhotoDataUrl) {
    var appSt = window.ArbaStore.getState();
    var isOnline = appSt.isOnline;
    var activeSales = salesRepName || appSt.currentSalesRep || 'Budi Santoso';

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
              <div>Outlet: <b>${window.ArbaUtils.escapeHtml(outlet.name)}</b></div>
              <div>Sales: ${window.ArbaUtils.escapeHtml(activeSales)} (${window.ArbaUtils.escapeHtml(state.checkinTime)})</div>
              <div>Status: ${isOnline ? 'Tersinkron ke Pusat' : 'Tersimpan Offline'}</div>
              <div>Termin: ${window.ArbaUtils.escapeHtml(state.selectedTerm)}</div>
            </div>

            <div class="py-1 space-y-1" style="padding:0.35rem 0;">
              ${items.map(function (it) {
                return `
                  <div class="flex justify-between" style="display:flex; justify-content:space-between;">
                    <span class="truncate max-w-[170px]">${window.ArbaUtils.escapeHtml(it.name)} x${it.quantity}</span>
                    <span class="font-semibold">${window.ArbaUtils.formatRupiah(it.subtotal)}</span>
                  </div>
                `;
              }).join('')}
            </div>

            <div class="pt-1.5 border-t border-dashed border-slate-300 flex justify-between font-bold text-xs text-slate-900" style="border-top:1px dashed #cbd5e1; padding-top:0.35rem; display:flex; justify-content:space-between;">
              <span>TOTAL:</span>
              <span>${window.ArbaUtils.formatRupiah(totalAmount)}</span>
            </div>

            ${window.ArbaUtils.safeImageDataUrl(signatureDataUrl) ? `
              <div class="pt-2 mt-1 border-t border-dashed border-slate-300 text-center">
                <div class="text-[9px] text-slate-500 uppercase">Tanda Tangan Digital Apoteker / PIC</div>
                <img src="${window.ArbaUtils.safeImageDataUrl(signatureDataUrl)}" alt="TTD Apoteker" style="max-height:48px; margin:2px auto; display:block;" />
                <div class="text-[10px] font-bold text-slate-700">${window.ArbaUtils.escapeHtml(outlet.picName || 'Apoteker APA')}</div>
              </div>
            ` : ''}
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

          var msg = `*SURAT PESANAN B2B - CV ARBA'IN*%0AOutlet: ${outlet.name}%0ATanggal: ${new Date().toLocaleDateString('id-ID')}%0ASales: ${activeSales}%0ATermin: ${state.selectedTerm}%0A%0A*Rincian Produk:*%0A${itemsText}%0A%0A*Total: ${window.ArbaUtils.formatRupiah(totalAmount)}*%0A_Garansi resmi CDOB & FEFO CV Arba'in_`;
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
