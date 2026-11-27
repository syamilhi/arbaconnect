/**
 * ArbaConnect ERP - B2B CRM & Directory View
 * Features:
 * - 4 CRM KPI Cards
 * - Multi-criteria filter bar (Search, Region Solo Raya, Type, Credit Status, Sales Route chips)
 * - 8-Col Interactive Master Table with credit gauge bar & click-to-select
 * - 4-Col Side Drawer with SVG Sparkline, credit line, PIC block, and field log
 * - Modals:
 *   1. + Daftarkan Outlet Baru (Registration with auto code)
 *   2. WhatsApp PIC Communication Assistant (3 Templates + wa.me)
 *   3. Schedule Sales Rep Visit (Rencana Kunjungan)
 *   4. Invoice & Order History Modal with print preview
 * - CSV Export
 */

(function () {
  'use strict';

  window.ArbaViews = window.ArbaViews || {};

  var state = {
    searchQuery: '',
    selectedRegion: 'ALL',
    selectedType: 'ALL',
    selectedCredit: 'ALL',
    activeRouteFilter: 'all',
    crmPage: 1,
    crmPageSize: 6
  };

  function renderB2bCrm(container) {
    var appState = window.ArbaStore.getState();
    var outlets = appState.outlets;
    var selectedOutletId = appState.selectedOutletId;

    var selectedOutlet = outlets.find(function (o) { return o.id === selectedOutletId; }) || outlets[0];

    // Filter outlets
    var filteredOutlets = outlets.filter(function (outlet) {
      var matchesSearch =
        outlet.name.toLowerCase().indexOf(state.searchQuery.toLowerCase()) !== -1 ||
        outlet.code.toLowerCase().indexOf(state.searchQuery.toLowerCase()) !== -1 ||
        outlet.picName.toLowerCase().indexOf(state.searchQuery.toLowerCase()) !== -1 ||
        outlet.address.toLowerCase().indexOf(state.searchQuery.toLowerCase()) !== -1;

      var matchesRegion = state.selectedRegion === 'ALL' || outlet.city === state.selectedRegion;
      var matchesType = state.selectedType === 'ALL' || outlet.type === state.selectedType;
      var matchesCredit = state.selectedCredit === 'ALL' || outlet.creditStatus === state.selectedCredit;
      var matchesRoute =
        state.activeRouteFilter === 'all' ||
        outlet.salesRep.toLowerCase().indexOf(state.activeRouteFilter.toLowerCase()) !== -1;

      return matchesSearch && matchesRegion && matchesType && matchesCredit && matchesRoute;
    });

    var totalCrmPages = Math.max(1, Math.ceil(filteredOutlets.length / state.crmPageSize));
    if (state.crmPage > totalCrmPages) state.crmPage = totalCrmPages;
    var paginatedOutlets = filteredOutlets.slice(
      (state.crmPage - 1) * state.crmPageSize,
      state.crmPage * state.crmPageSize
    );

    var percentRemaining = selectedOutlet
      ? Math.round((selectedOutlet.creditRemaining / selectedOutlet.creditLimit) * 100)
      : 100;

    var activeRole = (appState.currentUser && appState.currentUser.role === 'super-admin')
      ? (appState.currentRole || 'super-admin')
      : (appState.currentUser ? appState.currentUser.role : 'executive');
    var isSalesRole = activeRole === 'field-sales';
    var isSalesOpsRole = activeRole === 'sales-ops';

    var crmTitle = isSalesRole
      ? 'Direktori Mitra Apotek & Rute Distribusi Wilayah (' + window.ArbaUtils.escapeHtml(appState.currentUser ? appState.currentUser.name : 'Sales') + ')'
      : isSalesOpsRole
      ? 'Manajemen Kemitraan Apotek, Evaluasi Plafon Kredit & Piutang Konsinyasi'
      : 'Direktori Kemitraan Apotek B2B, Plafon Kredit & Inventaris Konsinyasi Solo Raya';

    var crmSubtitle = isSalesRole
      ? 'Pantau saldo inventaris konsinyasi pada apotek wilayah tugas Anda, hubungi Apoteker Penanggung Jawab, optimalkan rute kunjungan, atau buat faktur pesanan baru.'
      : isSalesOpsRole
      ? 'Kelola kolektibilitas pembayaran mitra apotek, evaluasi skor kelayakan plafon kredit, rekonsiliasi penjualan konsinyasi, dan lakukan realokasi stok berperputaran lambat.'
      : 'Basis data terpadu seluruh jaringan apotek dan ritel mitra CV Arba\'in, pengendalian eksposur plafon kredit, serta pemantauan perputaran inventaris konsinyasi.';

    var html = `
      <div class="flex flex-col w-full gap-space-lg">
        <!-- Header Title & Action Toolbar -->
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-surface-container-lowest p-5 rounded-xl border border-border-subtle/60">
          <h1 class="text-xl text-on-surface tracking-tight font-bold">
            Mitra Outlet
          </h1>
          <div class="flex items-center gap-1.5 flex-wrap">
            <button
              id="btn-new-outlet"
              class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-white hover:bg-primary-container text-xs font-semibold transition-colors shadow-xs cursor-pointer active:scale-95 border-0"
              type="button"
            >
              <span class="material-symbols-outlined text-[16px]">add_business</span>
              <span>+ Tambah Outlet</span>
            </button>
            <button
              id="btn-crm-rebalancer"
              class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold transition-colors cursor-pointer border border-border-subtle/50"
              type="button"
            >
              <span class="material-symbols-outlined text-[15px] text-amber-600">swap_driving_apps_wheel</span>
              <span>Realokasi</span>
              <span class="px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold">${(window.ArbaStore.getConsignmentRebalanceRecommendations() || []).length}</span>
            </button>
            ${!isSalesRole ? `
              <button
                id="btn-crm-credit-score"
                class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold transition-colors cursor-pointer border border-border-subtle/50"
                type="button"
              >
                <span class="material-symbols-outlined text-[15px] text-primary">analytics</span>
                <span>Skor Kredit</span>
              </button>
            ` : ''}
            <button
              id="btn-crm-tsp-map"
              class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold transition-colors cursor-pointer border border-border-subtle/50"
              type="button"
            >
              <span class="material-symbols-outlined text-[15px] text-emerald-600">route</span>
              <span>Rute</span>
            </button>
            ${!isSalesRole ? `
              <button
                id="btn-import-crm-csv"
                class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-container-low text-primary hover:bg-surface-container text-xs font-semibold transition-colors border border-border-subtle/50 cursor-pointer"
                type="button"
              >
                <span class="material-symbols-outlined text-[15px]">upload_file</span>
                <span>Impor CSV</span>
              </button>
            ` : ''}
            <button
              id="btn-export-crm-csv"
              class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container text-xs font-semibold transition-colors border border-border-subtle/50 cursor-pointer"
              type="button"
            >
              <span class="material-symbols-outlined text-[15px]">file_download</span>
              <span>Ekspor CSV</span>
            </button>
          </div>
        </div>

        <!-- Summary Metrics Cards (4 Metrics Grid) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- Card 1 -->
          <div class="bg-surface-container-lowest p-5 rounded-xl border border-border-subtle/60 flex flex-col justify-between">
            <div class="flex items-start justify-between">
              <div class="flex flex-col">
                <span class="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
                  Total Mitra Terdaftar
                </span>
                <div class="flex items-baseline gap-1.5 mt-1">
                  <span class="text-2xl text-on-surface font-bold">
                    ${outlets.length}
                  </span>
                  <span class="text-xs text-on-surface-variant font-medium">Outlet</span>
                </div>
              </div>
              <div class="w-9 h-9 rounded-lg bg-surface-container-low flex items-center justify-center text-primary">
                <span class="material-symbols-outlined text-[20px]">storefront</span>
              </div>
            </div>
            <div class="mt-4 pt-2.5 flex items-center justify-between text-xs text-on-surface-variant border-t border-border-subtle/40">
              <div class="flex items-center gap-1.5 text-emerald-700 font-semibold">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-600" style="display:inline-block; width:6px; height:6px;"></span>
                <span>${outlets.filter(function (o) { return o.creditStatus === 'Lancar'; }).length} Lancar</span>
              </div>
              <span class="text-on-surface-variant">${outlets.filter(function (o) { return o.creditStatus !== 'Lancar'; }).length} Perhatian</span>
            </div>
          </div>

          <!-- Card 2 -->
          <div class="bg-surface-container-lowest p-5 rounded-xl border border-border-subtle/60 flex flex-col justify-between">
            <div class="flex items-start justify-between">
              <div class="flex flex-col">
                <span class="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
                  Jaringan Apotek
                </span>
                <div class="flex items-baseline gap-1.5 mt-1">
                  <span class="text-2xl text-primary font-bold">${outlets.filter(function (o) { return o.type === 'Apotek'; }).length}</span>
                  <span class="text-xs text-on-surface-variant font-medium">Outlet</span>
                </div>
              </div>
              <div class="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center text-primary" style="background:#ccfbf1;">
                <span class="material-symbols-outlined text-[20px]">medication</span>
              </div>
            </div>
            <div class="mt-4 pt-2.5 flex items-center justify-between text-xs border-t border-border-subtle/40 text-on-surface-variant">
              <span>Termin standar:</span>
              <span class="font-semibold text-primary">Net 30 Hari</span>
            </div>
          </div>

          <!-- Card 3 -->
          <div class="bg-surface-container-lowest p-5 rounded-xl border border-border-subtle/60 flex flex-col justify-between">
            <div class="flex items-start justify-between">
              <div class="flex flex-col">
                <span class="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
                  Minimarket &amp; Ritel
                </span>
                <div class="flex items-baseline gap-1.5 mt-1">
                  <span class="text-2xl text-on-surface font-bold">${outlets.filter(function (o) { return o.type !== 'Apotek'; }).length}</span>
                  <span class="text-xs text-on-surface-variant font-medium">Toko</span>
                </div>
              </div>
              <div class="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant">
                <span class="material-symbols-outlined text-[20px]">shopping_cart</span>
              </div>
            </div>
            <div class="mt-4 pt-2.5 flex items-center justify-between text-xs border-t border-border-subtle/40 text-on-surface-variant">
              <span>Termin standar:</span>
              <span class="font-semibold text-on-surface">Net 14 Hari</span>
            </div>
          </div>

          <!-- Card 4 -->
          <div class="bg-surface-container-lowest p-5 rounded-xl border border-border-subtle/60 flex flex-col justify-between">
            <div class="flex items-start justify-between">
              <div class="flex flex-col">
                <span class="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
                  Kesehatan Kredit
                </span>
                <div class="flex items-baseline gap-1.5 mt-1">
                  <span class="text-2xl text-emerald-700 font-bold">${outlets.length ? Math.round((outlets.filter(function (o) { return o.creditStatus === 'Lancar'; }).length / outlets.length) * 100) : 100}%</span>
                  <span class="text-xs font-semibold text-emerald-700">Lancar</span>
                </div>
              </div>
              <div class="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700" style="background:#dcfce7;">
                <span class="material-symbols-outlined text-[20px]">verified_user</span>
              </div>
            </div>
            <div class="mt-4 pt-2.5 flex items-center justify-between text-xs border-t border-border-subtle/40 text-on-surface-variant">
              <span class="text-amber-700 font-medium flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px]">warning</span>
                ${outlets.filter(function (o) { return o.creditStatus === 'Overdue'; }).length} Overdue
              </span>
              <span class="text-on-surface-variant font-code-table font-mono">${outlets.filter(function (o) { return o.creditStatus === 'Warning'; }).length} Warning</span>
            </div>
          </div>
        </div>

        <!-- Search, Filter & Segmentation Bar -->
        <div class="bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-border-subtle/40 flex flex-col gap-space-sm">
          <div class="grid grid-cols-1 md:grid-cols-12 gap-space-sm">
            <!-- Search Field -->
            <div class="md:col-span-5 relative flex items-center" style="grid-column: span 5 / span 12; position:relative;">
              <span class="material-symbols-outlined absolute left-3 text-on-surface-variant text-[20px] pointer-events-none" style="position:absolute; left:0.75rem;" aria-hidden="true">
                search
              </span>
              <input
                id="crm-search-input"
                value="${window.ArbaUtils.escapeHtml(state.searchQuery)}"
                class="w-full bg-surface-container-low text-on-surface placeholder:text-on-surface-variant pl-10 pr-4 py-2.5 rounded-lg text-body-md font-body-md focus:outline-none focus:bg-surface-container transition-all text-xs border-0"
                style="padding-left: 2.25rem;"
                aria-label="Cari nama apotek, kode outlet, atau nama apoteker"
                placeholder="Cari nama apotek, kode outlet, atau nama apoteker..."
                type="text"
              />
            </div>

            <!-- Filter Wilayah Solo Raya -->
            <div class="md:col-span-3 relative flex items-center" style="grid-column: span 3 / span 12; position:relative;">
              <span class="material-symbols-outlined absolute left-3 text-on-surface-variant text-[18px] pointer-events-none" style="position:absolute; left:0.75rem;" aria-hidden="true">
                location_city
              </span>
              <select
                id="crm-region-select"
                aria-label="Filter wilayah kota Solo Raya"
                class="w-full bg-surface-container-low text-on-surface pl-9 pr-8 py-2.5 rounded-lg text-body-md font-body-md appearance-none cursor-pointer focus:outline-none focus:bg-surface-container text-xs border-0"
                style="padding-left: 2.25rem;"
              >
                <option value="ALL" ${state.selectedRegion === 'ALL' ? 'selected' : ''}>Semua Kota (Solo Raya)</option>
                <option value="Solo" ${state.selectedRegion === 'Solo' ? 'selected' : ''}>Surakarta / Solo Kota</option>
                <option value="Sukoharjo" ${state.selectedRegion === 'Sukoharjo' ? 'selected' : ''}>Sukoharjo &amp; Kartasura</option>
                <option value="Karanganyar" ${state.selectedRegion === 'Karanganyar' ? 'selected' : ''}>Karanganyar &amp; Palur</option>
                <option value="Klaten" ${state.selectedRegion === 'Klaten' ? 'selected' : ''}>Klaten Kota &amp; Delanggu</option>
                <option value="Boyolali" ${state.selectedRegion === 'Boyolali' ? 'selected' : ''}>Boyolali</option>
                <option value="Sragen" ${state.selectedRegion === 'Sragen' ? 'selected' : ''}>Sragen</option>
              </select>
            </div>

            <!-- Filter Tipe Outlet -->
            <div class="md:col-span-2 relative flex items-center" style="grid-column: span 2 / span 12; position:relative;">
              <select
                id="crm-type-select"
                aria-label="Filter tipe outlet mitra"
                class="w-full bg-surface-container-low text-on-surface px-3 py-2.5 rounded-lg text-body-md font-body-md appearance-none cursor-pointer focus:outline-none focus:bg-surface-container text-xs border-0"
              >
                <option value="ALL" ${state.selectedType === 'ALL' ? 'selected' : ''}>Semua Tipe</option>
                <option value="Apotek Mandiri" ${state.selectedType === 'Apotek Mandiri' ? 'selected' : ''}>Apotek Mandiri</option>
                <option value="Jaringan Farmasi" ${state.selectedType === 'Jaringan Farmasi' ? 'selected' : ''}>Jaringan Farmasi</option>
                <option value="Minimarket" ${state.selectedType === 'Minimarket' ? 'selected' : ''}>Minimarket / Ritel</option>
              </select>
            </div>

            <!-- Filter Status Kredit -->
            <div class="md:col-span-2 relative flex items-center" style="grid-column: span 2 / span 12; position:relative;">
              <select
                id="crm-credit-select"
                aria-label="Filter status plafon kredit"
                class="w-full bg-surface-container-low text-on-surface px-3 py-2.5 rounded-lg text-body-md font-body-md appearance-none cursor-pointer focus:outline-none focus:bg-surface-container text-xs border-0"
              >
                <option value="ALL" ${state.selectedCredit === 'ALL' ? 'selected' : ''}>Semua Status Kredit</option>
                <option value="Lancar" ${state.selectedCredit === 'Lancar' ? 'selected' : ''}>Lancar (&gt;50% Sisa)</option>
                <option value="Perhatian" ${state.selectedCredit === 'Perhatian' ? 'selected' : ''}>Menjelang Jatuh Tempo</option>
                <option value="Overdue" ${state.selectedCredit === 'Overdue' ? 'selected' : ''}>Overdue / Limit Habis</option>
              </select>
            </div>
          </div>

          <!-- Active Segment Chips / Quick Filters -->
          <div class="flex items-center justify-between pt-2">
            <div class="flex items-center gap-space-xs flex-wrap">
              <span class="text-on-surface-variant font-label-sm text-label-sm mr-1 font-semibold text-xs">
                Rute Sales Aktif:
              </span>
              ${[
                { id: 'all', label: 'Semua Rute' },
                { id: 'Budi', label: 'Solo Tengah (Budi Santoso)' },
                { id: 'Tri', label: 'Sukoharjo-Solo Baru (Tri Wahyuni)' },
                { id: 'Agus', label: 'Karanganyar-Palur (Agus Hermawan)' },
                { id: 'Rian', label: 'Klaten-Boyolali (Rian Pratama)' }
              ].map(function (r) {
                var isSelected = state.activeRouteFilter === r.id;
                return `
                  <button
                    class="btn-route-chip px-2.5 py-1 rounded-full text-label-sm font-label-sm text-xs transition-colors cursor-pointer border-0 ${
                      isSelected
                        ? 'bg-primary text-white font-semibold shadow-xs'
                        : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                    }"
                    data-route="${r.id}"
                    type="button"
                  >
                    ${r.label}
                  </button>
                `;
              }).join('')}
            </div>
            <div class="text-on-surface-variant font-code-table text-code-table hidden lg:block text-xs font-mono">
              Menampilkan ${filteredOutlets.length} dari ${outlets.length} outlet
            </div>
          </div>
        </div>

        <!-- Main Directory Table & Drawer Container -->
        <div class="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
          <!-- Main Interactive Table (8 cols) -->
          <div class="xl:col-span-8 bg-surface-container-lowest rounded-xl shadow-xs border border-border-subtle/40 overflow-hidden flex flex-col">
            <div class="px-space-md py-space-sm bg-surface-container-low flex items-center justify-between border-b border-border-subtle/30 p-3">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-primary text-[20px]">table_rows</span>
                <span class="font-title-sm text-title-sm text-on-surface font-bold text-sm">
                  Daftar Mitra B2B Wilayah Solo Raya
                </span>
              </div>
              <span class="font-label-sm text-label-sm text-on-surface-variant text-xs">
                Klik baris outlet untuk detail performa &amp; riwayat
              </span>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs">
                <thead>
                  <tr class="bg-surface-container-low/70 text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                    <th class="py-3 px-space-md">Kode &amp; Nama Outlet</th>
                    <th class="py-3 px-3">Tipe</th>
                    <th class="py-3 px-3">Penanggung Jawab</th>
                    <th class="py-3 px-3">Kota</th>
                    <th class="py-3 px-3">Termin</th>
                    <th class="py-3 px-3">Plafon / Sisa Limit</th>
                    <th class="py-3 px-3">Sales Lapangan</th>
                    <th class="py-3 px-3">Order Terakhir</th>
                    <th class="py-3 px-space-md text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody class="text-on-surface text-body-md font-body-md divide-y divide-border-subtle/30">
                  ${paginatedOutlets.map(function (outlet) {
                    var isSelected = outlet.id === selectedOutletId;
                    var pRemaining = Math.round((outlet.creditRemaining / outlet.creditLimit) * 100);

                    return `
                      <tr
                        class="crm-outlet-row cursor-pointer transition-colors ${
                          isSelected ? 'bg-surface-container' : 'hover:bg-surface-container-low/70'
                        }"
                        data-outlet-id="${window.ArbaUtils.escapeHtml(outlet.id)}"
                      >
                        <td class="py-3.5 px-space-md">
                          <div class="flex flex-col">
                            <span class="font-label-sm text-label-sm text-primary font-semibold font-mono text-[11px]">
                              ${window.ArbaUtils.escapeHtml(outlet.code)}
                            </span>
                            <span class="font-label-lg text-label-lg font-semibold text-on-surface leading-snug">
                              ${window.ArbaUtils.escapeHtml(outlet.name)}
                            </span>
                            <span class="font-body-sm text-body-sm text-on-surface-variant truncate max-w-xs text-[11px]">
                              ${window.ArbaUtils.escapeHtml(outlet.address)}
                            </span>
                          </div>
                        </td>

                        <td class="py-3.5 px-3 whitespace-nowrap">
                          <span
                            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-label-sm font-label-sm font-semibold text-[11px] ${
                              outlet.type === 'Minimarket'
                                ? 'bg-surface-container text-primary'
                                : 'bg-secondary-fixed text-on-secondary-fixed'
                            }"
                          >
                            <span class="material-symbols-outlined text-[14px]">
                              ${outlet.type === 'Minimarket' ? 'store' : 'local_pharmacy'}
                            </span>
                            ${outlet.type === 'Minimarket' ? 'Minimarket' : 'Apotek'}
                          </span>
                        </td>

                        <td class="py-3.5 px-3">
                          <div class="flex flex-col">
                            <span class="font-label-md text-label-md text-on-surface font-medium">
                              ${window.ArbaUtils.escapeHtml(outlet.picName)}
                            </span>
                            <a
                              href="https://wa.me/${encodeURIComponent(String(outlet.picPhone || '').replace(/[^0-9]/g, ''))}"
                              target="_blank"
                              rel="noreferrer"
                              class="font-label-sm text-label-sm text-primary hover:underline flex items-center gap-1 mt-0.5 text-[11px]"
                              onclick="event.stopPropagation()"
                            >
                              <span class="material-symbols-outlined text-[13px]">chat</span>
                              ${window.ArbaUtils.escapeHtml(String(outlet.picPhone || '').replace(/^62/, '0'))}
                            </a>
                          </div>
                        </td>

                        <td class="py-3.5 px-3 whitespace-nowrap">
                          <span class="font-label-md text-label-md text-on-surface">${window.ArbaUtils.escapeHtml(outlet.cityName)}</span>
                        </td>

                        <td class="py-3.5 px-3 whitespace-nowrap">
                          <span class="px-2 py-0.5 rounded bg-surface-container text-on-surface text-label-sm font-label-sm font-semibold">
                            ${window.ArbaUtils.escapeHtml(outlet.terms)}
                          </span>
                        </td>

                        <td class="py-3.5 px-3 whitespace-nowrap">
                          <div class="flex flex-col">
                            <span class="font-code-table text-code-table font-semibold text-on-surface font-mono">
                              ${window.ArbaUtils.formatRupiah(outlet.creditLimit)}
                            </span>
                            <span
                              class="font-label-sm text-label-sm font-medium text-[11px] ${
                                outlet.creditStatus === 'Overdue'
                                  ? 'text-rose-600 font-bold'
                                  : outlet.creditStatus === 'Perhatian'
                                  ? 'text-amber-700 font-semibold'
                                  : 'text-emerald-700'
                              }"
                            >
                              Sisa: ${window.ArbaUtils.formatRupiah(outlet.creditRemaining)} (${pRemaining}%)
                            </span>
                            <div class="w-24 h-1.5 bg-surface-container rounded-full overflow-hidden mt-1" style="width:96px; height:6px;">
                              <div
                                class="h-full ${
                                  outlet.creditStatus === 'Overdue'
                                    ? 'bg-rose-500'
                                    : outlet.creditStatus === 'Perhatian'
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-600'
                                }"
                                style="width: ${pRemaining}%;"
                              ></div>
                            </div>
                          </div>
                        </td>

                        <td class="py-3.5 px-3">
                          <div class="flex flex-col">
                            <span class="font-label-md text-label-md text-on-surface font-semibold">
                              ${window.ArbaUtils.escapeHtml(outlet.salesRep)}
                            </span>
                            <span class="font-label-sm text-label-sm text-on-surface-variant text-[11px]">
                              ${window.ArbaUtils.escapeHtml(outlet.salesArea)}
                            </span>
                          </div>
                        </td>

                        <td class="py-3.5 px-3 whitespace-nowrap">
                          <div class="flex flex-col">
                            <span class="font-label-md text-label-md text-on-surface">
                              ${window.ArbaUtils.escapeHtml(outlet.lastOrderDate)}
                            </span>
                            <span
                              class="font-label-sm text-label-sm text-[11px] ${
                                outlet.creditStatus === 'Overdue'
                                  ? 'text-rose-600 font-bold'
                                  : outlet.creditStatus === 'Perhatian'
                                  ? 'text-amber-700 font-semibold'
                                  : 'text-on-surface-variant'
                              }"
                            >
                              ${window.ArbaUtils.escapeHtml(outlet.orderFrequency)}
                            </span>
                          </div>
                        </td>

                        <td class="py-3.5 px-space-md text-right whitespace-nowrap">
                          <div class="flex items-center justify-end gap-1.5">
                            <button
                              class="btn-outlet-history p-1.5 rounded-lg text-primary hover:bg-surface-container transition-colors cursor-pointer border-0 bg-transparent"
                              title="Profil &amp; Riwayat Transaksi"
                              data-outlet-id="${window.ArbaUtils.escapeHtml(outlet.id)}"
                              type="button"
                              onclick="event.stopPropagation()"
                            >
                              <span class="material-symbols-outlined text-[18px]">receipt_long</span>
                            </button>
                            <button
                              class="btn-outlet-visit p-1.5 rounded-lg text-primary hover:bg-surface-container transition-colors cursor-pointer border-0 bg-transparent"
                              title="Jadwalkan Kunjungan"
                              data-outlet-id="${window.ArbaUtils.escapeHtml(outlet.id)}"
                              type="button"
                              onclick="event.stopPropagation()"
                            >
                              <span class="material-symbols-outlined text-[18px]">event_available</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>

            <!-- Pagination / Table Footer -->
            <div class="px-space-md py-3 bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-border-subtle/30 text-xs p-3">
              <span class="font-label-sm text-label-sm text-on-surface-variant">
                Menampilkan ${paginatedOutlets.length} dari ${filteredOutlets.length} outlet terfilter (Hal ${state.crmPage}/${totalCrmPages})
              </span>
              <div class="flex items-center gap-1">
                <button
                  id="btn-crm-prev"
                  class="w-8 h-8 rounded flex items-center justify-center text-on-surface-variant bg-surface-container-lowest hover:bg-surface-container transition-colors cursor-pointer border-0 ${state.crmPage <= 1 ? 'opacity-40' : ''}"
                  type="button"
                >
                  <span class="material-symbols-outlined text-[16px]">chevron_left</span>
                </button>
                ${Array.from({ length: totalCrmPages }, function (_, idx) {
                  var pNum = idx + 1;
                  var active = pNum === state.crmPage;
                  return `
                    <button
                      type="button"
                      class="btn-crm-page w-8 h-8 rounded flex items-center justify-center font-label-sm text-label-sm font-semibold cursor-pointer border-0 ${
                        active ? 'bg-primary text-white' : 'text-on-surface-variant bg-surface-container-lowest hover:bg-surface-container'
                      }"
                      data-page="${pNum}"
                    >
                      ${pNum}
                    </button>
                  `;
                }).join('')}
                <button
                  id="btn-crm-next"
                  class="w-8 h-8 rounded flex items-center justify-center text-on-surface-variant bg-surface-container-lowest hover:bg-surface-container transition-colors cursor-pointer border-0 ${state.crmPage >= totalCrmPages ? 'opacity-40' : ''}"
                  type="button"
                >
                  <span class="material-symbols-outlined text-[16px]">chevron_right</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Side Drawer / Detail Pane: Ringkasan Performa Outlet Terpilih (4 cols) -->
          <div class="xl:col-span-4 flex flex-col gap-space-md">
            ${selectedOutlet ? `
              <div class="bg-surface-container-lowest rounded-xl shadow-xs border border-border-subtle/40 p-space-md flex flex-col gap-space-md p-4">
                <!-- Drawer Header with Outlet Badge -->
                <div class="flex items-start justify-between">
                  <div class="flex flex-col">
                    <div class="flex items-center gap-2">
                      <span class="px-2 py-0.5 rounded bg-primary text-white font-code-table text-code-table font-semibold text-xs font-mono">
                        ${window.ArbaUtils.escapeHtml(selectedOutlet.code)}
                      </span>
                      <span
                        class="px-2 py-0.5 rounded font-label-sm text-label-sm font-semibold text-xs ${
                          selectedOutlet.creditStatus === 'Overdue'
                            ? 'bg-status-danger-bg text-status-danger-text'
                            : selectedOutlet.creditStatus === 'Perhatian'
                            ? 'bg-status-warning-bg text-status-warning-text'
                            : 'bg-status-success-bg text-status-success-text'
                        }"
                      >
                        ${selectedOutlet.creditStatus === 'Overdue' ? 'Overdue' : 'Akun Aktif'}
                      </span>
                    </div>
                    <h2 class="font-headline-md text-headline-md text-on-surface mt-2 font-bold leading-snug text-lg">
                      ${window.ArbaUtils.escapeHtml(selectedOutlet.name)}
                    </h2>
                    <p class="font-body-sm text-body-sm text-on-surface-variant text-xs">
                      ${window.ArbaUtils.escapeHtml(selectedOutlet.address)}, ${window.ArbaUtils.escapeHtml(selectedOutlet.cityName)}
                    </p>
                  </div>
                </div>

                <!-- Peta Lokasi Nyata Mitra Apotek (Leaflet + OpenStreetMap + Google Maps Directions) -->
                ${(function () {
                  var coords = window.ArbaStore.getOutletCoordinates ? window.ArbaStore.getOutletCoordinates(selectedOutlet) : { lat: selectedOutlet.lat || -7.5682, lng: selectedOutlet.lng || 110.8091 };
                  var hq = window.ArbaStore.warehouseHq || { lat: -7.5561, lng: 110.7422 };
                  var gmapsDirUrl = 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(hq.lat + ',' + hq.lng) + '&destination=' + encodeURIComponent(coords.lat + ',' + coords.lng) + '&travelmode=driving';
                  var gmapsPlaceUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(coords.lat + ',' + coords.lng);
                  return `
                    <div class="rounded-xl overflow-hidden border border-border-subtle bg-surface-container-low">
                      <div class="px-3 py-2 flex items-center justify-between text-[11px] border-b border-border-subtle">
                        <span class="font-bold text-on-surface flex items-center gap-1">
                          <span class="material-symbols-outlined text-[15px] text-primary">location_on</span>
                          <span>Peta Lokasi Mitra (<span class="font-mono">${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}</span>)</span>
                        </span>
                        <div class="flex items-center gap-1.5">
                          <a href="${gmapsPlaceUrl}" target="_blank" rel="noreferrer" class="text-primary hover:underline font-semibold">Google Maps</a>
                          <span>·</span>
                          <a href="${gmapsDirUrl}" target="_blank" rel="noreferrer" class="text-emerald-700 hover:underline font-bold flex items-center gap-0.5">
                            <span class="material-symbols-outlined text-[13px]">directions</span>
                            <span>Rute</span>
                          </a>
                        </div>
                      </div>
                      <div id="crm-drawer-leaflet-map" data-lat="${coords.lat}" data-lng="${coords.lng}" data-name="${window.ArbaUtils.escapeHtml(selectedOutlet.name)}" data-addr="${window.ArbaUtils.escapeHtml(selectedOutlet.address + ', ' + selectedOutlet.cityName)}" style="width:100%; height:165px; z-index:1; background:#e2e8f0;"></div>
                    </div>
                  `;
                })()}

                <!-- Omset Performa Snapshot & Chart Widget -->
                <div class="bg-surface-container-low p-space-md rounded-lg flex flex-col gap-space-sm border border-border-subtle/30 p-3">
                  <div class="flex items-center justify-between">
                    <span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-xs">
                      Performa Omset YTD 2026
                    </span>
                    <span class="font-code-table text-code-table font-semibold text-primary font-mono text-xs">
                      ${window.ArbaUtils.formatRupiah(selectedOutlet.ytdTotal)}
                    </span>
                  </div>
                </div>

                <!-- Credit Line & Terms Visualizer + Skor Kelayakan Kredit Apotek -->
                ${(function () {
                  var aiSc = window.ArbaStore.getOutletCreditScoring ? window.ArbaStore.getOutletCreditScoring(selectedOutlet.id) : null;
                  if (!aiSc) return '';
                  var badgeCls = aiSc.score >= 82 ? 'badge-success' : (aiSc.score >= 68 ? 'badge-primary' : (aiSc.score < 50 ? 'badge-danger' : 'badge-warning'));
                  return `
                    <div class="p-3 rounded-xl bg-surface-container-low border border-border-subtle/60 text-xs mb-1">
                      <div class="flex items-center justify-between mb-1.5">
                        <span class="font-bold text-on-surface flex items-center gap-1">
                          <span class="material-symbols-outlined text-[15px] text-primary">auto_awesome</span>
                          Skor Kelayakan Kredit: <b class="text-primary">${aiSc.score}/100</b>
                        </span>
                        <span class="badge ${badgeCls}">${aiSc.tier}</span>
                      </div>
                      <div class="text-[11px] text-on-surface-variant leading-snug ${isSalesRole ? '' : 'mb-2.5'}">${aiSc.recommendation}</div>
                      ${!isSalesRole ? `
                        <button
                          id="btn-drawer-apply-ai-credit"
                          type="button"
                          class="w-full py-1.5 px-3 rounded-lg bg-primary hover:bg-primary-container text-[11px] font-bold text-white cursor-pointer border-0 flex items-center justify-center gap-1 transition-colors"
                        >
                          <span class="material-symbols-outlined text-[14px]">bolt</span>
                          <span>Sesuaikan Plafon ke Rekomendasi (${window.ArbaUtils.formatRupiah(aiSc.suggestedLimit)})</span>
                        </button>
                      ` : ''}
                    </div>
                  `;
                })()}
                <div class="space-y-2 text-xs">
                  <div class="flex justify-between items-center text-body-sm font-body-sm">
                    <span class="text-on-surface-variant">Plafon Kredit Disetujui:</span>
                    <span class="font-semibold text-on-surface font-code-table font-mono">
                      ${window.ArbaUtils.formatRupiah(selectedOutlet.creditLimit)}
                    </span>
                  </div>
                  <div class="flex justify-between items-center text-body-sm font-body-sm">
                    <span class="text-on-surface-variant">Pemakaian Berjalan:</span>
                    <span class="font-semibold text-amber-700 font-code-table font-mono">
                      ${window.ArbaUtils.formatRupiah(selectedOutlet.creditUsed)}
                    </span>
                  </div>
                  <div class="flex justify-between items-center text-body-sm font-body-sm">
                    <span class="text-on-surface-variant">Sisa Plafon Aman:</span>
                    <span class="font-semibold text-emerald-700 font-code-table font-mono">
                      ${window.ArbaUtils.formatRupiah(selectedOutlet.creditRemaining)}
                    </span>
                  </div>
                  <!-- Limit Progress Bar -->
                  <div class="w-full h-2 bg-surface-container rounded-full overflow-hidden" style="height:8px;">
                    <div
                      class="h-full bg-primary"
                      style="width: ${Math.round((selectedOutlet.creditUsed / selectedOutlet.creditLimit) * 100)}%;"
                    ></div>
                  </div>
                </div>

                <!-- PIC & Sales Contact Block -->
                <div class="bg-surface-container-low p-space-sm rounded-lg flex flex-col gap-2 border border-border-subtle/30 p-2.5 text-xs">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold shadow-xs" style="width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center;">
                      <span class="material-symbols-outlined text-[20px]">person</span>
                    </div>
                    <div class="flex flex-col">
                      <span class="font-label-md text-label-md text-on-surface font-semibold">
                        ${window.ArbaUtils.escapeHtml(selectedOutlet.picName)}
                      </span>
                      <span class="font-body-sm text-body-sm text-on-surface-variant text-[11px]">
                        ${window.ArbaUtils.escapeHtml(selectedOutlet.picRole)}
                      </span>
                    </div>
                  </div>
                  <div class="flex items-center justify-between pt-1 border-t border-border-subtle/30 text-[11px]">
                    <span class="font-label-sm text-label-sm text-on-surface-variant">Sales Dedikasi:</span>
                    <span class="font-label-sm text-label-sm text-on-surface font-semibold">
                      ${window.ArbaUtils.escapeHtml(selectedOutlet.salesRep)} (${window.ArbaUtils.escapeHtml(selectedOutlet.salesArea)})
                    </span>
                  </div>
                  ${selectedOutlet.noSia ? `
                    <div class="flex flex-col gap-1 pt-1.5 border-t border-border-subtle/30 text-[11px]">
                      <div class="flex items-center justify-between">
                        <span class="text-on-surface-variant">No. SIA / NIB:</span>
                        <span class="font-mono font-semibold text-on-surface">${window.ArbaUtils.escapeHtml(selectedOutlet.noSia)}</span>
                      </div>
                      <div class="flex items-center justify-between">
                        <span class="text-on-surface-variant">No. SIPA APA:</span>
                        <span class="font-mono font-semibold text-primary">${window.ArbaUtils.escapeHtml(selectedOutlet.noSipa || '-')}</span>
                      </div>
                      <div class="flex items-center justify-between">
                        <span class="text-on-surface-variant">Status Legalitas CDOB:</span>
                        <span class="px-1.5 py-0.2 rounded text-[10px] font-bold ${selectedOutlet.sipaStatus === 'Aktif' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}">
                          ${window.ArbaUtils.escapeHtml(selectedOutlet.sipaStatus || 'Aktif')} (${window.ArbaUtils.escapeHtml(selectedOutlet.sipaExpiry || '-')})
                        </span>
                      </div>
                    </div>
                  ` : ''}
                </div>

                <!-- Rincian Inventaris Konsinyasi Mitra -->
                <div class="flex flex-col gap-2">
                  <div class="flex items-center justify-between">
                    <span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-[11px]">
                      Rincian Inventaris Konsinyasi Mitra
                    </span>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                      ${window.ArbaUtils.escapeHtml(selectedOutlet.terms)}
                    </span>
                  </div>
                  <div class="space-y-1.5">
                    ${(selectedOutlet.consignmentItems || []).map(function (ci) {
                      var isSlow = ci.velocity === 'LAMA_TIDAK_LAKU';
                      var isPink = ci.nearExpiry;
                      return `
                        <div class="p-2.5 rounded-lg border border-border-subtle bg-surface-container-low text-xs flex flex-col gap-1">
                          <div class="flex items-center justify-between gap-1">
                            <span class="font-bold text-on-surface truncate">${window.ArbaUtils.escapeHtml(ci.name)}</span>
                            <div class="flex items-center gap-1 shrink-0">
                              ${isPink ? `<span class="badge badge-danger">Mendekati ED</span>` : ''}
                              <span class="badge ${isSlow ? 'badge-warning' : 'badge-success'}">
                                ${isSlow ? 'Perputaran Lambat' : 'Perputaran Cepat'}
                              </span>
                            </div>
                          </div>
                          <div class="flex items-center justify-between text-[11px] text-on-surface-variant">
                            <span>Kuota: <b>${ci.consignedQty}</b> · Terjual: <b class="text-emerald-600">${ci.soldQty}</b> · Saldo: <b class="text-on-surface">${ci.remainingQty}</b></span>
                            <span>ED: <b class="${isPink ? 'text-rose-600' : 'text-on-surface'}">${window.ArbaUtils.escapeHtml(ci.expiry)}</b></span>
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>

                <!-- Catatan Kunjungan Terakhir (Field Log) -->
                <div class="flex flex-col gap-2">
                  <div class="flex items-center justify-between">
                    <span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-[11px]">
                      Log Kunjungan Sales Terakhir
                    </span>
                    <span class="font-label-sm text-label-sm text-primary font-medium text-xs">
                      ${window.ArbaUtils.escapeHtml(selectedOutlet.lastVisitDate)}
                    </span>
                  </div>
                  <div class="bg-surface-container-low/60 p-3 rounded-lg text-body-sm font-body-sm text-on-surface leading-relaxed border border-border-subtle/30 text-xs">
                    <p class="m-0">${window.ArbaUtils.escapeHtml(selectedOutlet.visitNotes)}</p>
                  </div>
                </div>

                <!-- Fast Actions inside Drawer -->
                <div class="grid grid-cols-2 gap-2 pt-1">
                  <button
                    id="btn-drawer-whatsapp"
                    class="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container text-xs font-semibold transition-colors cursor-pointer shadow-xs active:scale-95 border border-border-subtle/40"
                    type="button"
                  >
                    <span class="material-symbols-outlined text-[16px] text-emerald-600">chat</span>
                    <span>Chat WhatsApp PIC</span>
                  </button>
                  <button
                    id="btn-drawer-visit"
                    class="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-primary text-white hover:bg-primary-container text-xs font-semibold transition-colors shadow-xs cursor-pointer active:scale-95 border-0"
                    type="button"
                  >
                    <span class="material-symbols-outlined text-[16px]">add_task</span>
                    <span>Jadwal Kunjungan</span>
                  </button>
                  <button
                    id="btn-drawer-history"
                    class="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-semibold transition-colors cursor-pointer shadow-xs active:scale-95 border-0"
                    type="button"
                  >
                    <span class="material-symbols-outlined text-[16px] text-primary">receipt_long</span>
                    <span>Riwayat Faktur</span>
                  </button>
                  <button
                    id="btn-drawer-pwa"
                    class="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-secondary text-white hover:bg-secondary-container text-xs font-semibold transition-colors shadow-xs cursor-pointer active:scale-95 border-0"
                    type="button"
                  >
                    <span class="material-symbols-outlined text-[16px]">point_of_sale</span>
                    <span>Buat Order PWA</span>
                  </button>
                </div>
              </div>
            ` : ''}

            <!-- Quick Delivery Coverage Indicator (Solo Raya) -->
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
    bindEvents(container, selectedOutlet);
  }

  function bindEvents(container, selectedOutlet) {
    // Import / Migrasi CRM CSV
    var btnImportCsv = container.querySelector('#btn-import-crm-csv');
    if (btnImportCsv) {
      btnImportCsv.addEventListener('click', function () {
        openImportOutletsModal();
      });
    }

    // Export CRM CSV
    var btnCsv = container.querySelector('#btn-export-crm-csv');
    if (btnCsv) {
      btnCsv.addEventListener('click', function () {
        var outlets = window.ArbaStore.getState().outlets;
        window.ArbaUtils.exportCrmToCsv(outlets);
        window.ArbaApp.showToast(`Berhasil mengunduh data ${outlets.length} mitra B2B Solo Raya (.CSV)`, 'file_download');
      });
    }

    // New Outlet Registration
    var btnNew = container.querySelector('#btn-new-outlet');
    if (btnNew) {
      btnNew.addEventListener('click', function () {
        openNewOutletModal();
      });
    }

    // Advance Buttons: Consignment Rebalancer, AI Credit Scoring, & TSP Map
    var btnRebalancer = container.querySelector('#btn-crm-rebalancer');
    if (btnRebalancer && window.ArbaAdvanced) {
      btnRebalancer.addEventListener('click', function () {
        window.ArbaAdvanced.openConsignmentRebalancerModal();
      });
    }

    var btnCreditScore = container.querySelector('#btn-crm-credit-score');
    if (btnCreditScore && window.ArbaAdvanced) {
      btnCreditScore.addEventListener('click', function () {
        window.ArbaAdvanced.openCreditScoringModal();
      });
    }

    var btnTspMap = container.querySelector('#btn-crm-tsp-map');
    if (btnTspMap && window.ArbaAdvanced) {
      btnTspMap.addEventListener('click', function () {
        window.ArbaAdvanced.openTspRouteOptimizerModal();
      });
    }

    var btnDrawerAiCredit = container.querySelector('#btn-drawer-apply-ai-credit');
    if (btnDrawerAiCredit && selectedOutlet) {
      btnDrawerAiCredit.addEventListener('click', function () {
        window.ArbaStore.applyRecommendedCreditPolicy(selectedOutlet.id);
      });
    }

    // Search input
    var searchInput = container.querySelector('#crm-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', function (e) {
        state.searchQuery = e.target.value;
        renderB2bCrm(container);
        var inputNow = container.querySelector('#crm-search-input');
        if (inputNow) {
          inputNow.focus();
          inputNow.setSelectionRange(inputNow.value.length, inputNow.value.length);
        }
      });
    }

    // Region select
    var regionSelect = container.querySelector('#crm-region-select');
    if (regionSelect) {
      regionSelect.addEventListener('change', function (e) {
        state.selectedRegion = e.target.value;
        renderB2bCrm(container);
      });
    }

    // Type select
    var typeSelect = container.querySelector('#crm-type-select');
    if (typeSelect) {
      typeSelect.addEventListener('change', function (e) {
        state.selectedType = e.target.value;
        renderB2bCrm(container);
      });
    }

    // Credit select
    var creditSelect = container.querySelector('#crm-credit-select');
    if (creditSelect) {
      creditSelect.addEventListener('change', function (e) {
        state.selectedCredit = e.target.value;
        renderB2bCrm(container);
      });
    }

    // Route chips
    var routeChips = container.querySelectorAll('.btn-route-chip');
    routeChips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        state.activeRouteFilter = chip.getAttribute('data-route');
        renderB2bCrm(container);
      });
    });

    // Row selection click
    var rows = container.querySelectorAll('.crm-outlet-row');
    rows.forEach(function (row) {
      row.addEventListener('click', function () {
        var outletId = row.getAttribute('data-outlet-id');
        window.ArbaStore.setSelectedOutletId(outletId);
      });
    });

    // Action buttons inside table rows
    var historyBtns = container.querySelectorAll('.btn-outlet-history');
    historyBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var outletId = btn.getAttribute('data-outlet-id');
        var outlet = window.ArbaStore.getState().outlets.find(function (o) { return o.id === outletId; });
        if (outlet) openHistoryModal(outlet);
      });
    });

    var visitBtns = container.querySelectorAll('.btn-outlet-visit');
    visitBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var outletId = btn.getAttribute('data-outlet-id');
        var outlet = window.ArbaStore.getState().outlets.find(function (o) { return o.id === outletId; });
        if (outlet) openVisitModal(outlet);
      });
    });

    // Drawer buttons & Real Leaflet Mini-Map with Road Route from Gudang Kartasura
    if (selectedOutlet) {
      var drawerMapEl = container.querySelector('#crm-drawer-leaflet-map');
      if (drawerMapEl && typeof window.L !== 'undefined') {
        try {
          if (window.__arbaCrmDrawerMap) {
            try { window.__arbaCrmDrawerMap.remove(); } catch (e) {}
            window.__arbaCrmDrawerMap = null;
          }
          var dLat = Number(drawerMapEl.getAttribute('data-lat')) || -7.5682;
          var dLng = Number(drawerMapEl.getAttribute('data-lng')) || 110.8091;
          var dName = drawerMapEl.getAttribute('data-name') || selectedOutlet.name;
          var dAddr = drawerMapEl.getAttribute('data-addr') || selectedOutlet.address;
          var hq = window.ArbaStore.warehouseHq || { lat: -7.5561, lng: 110.7422, name: 'Gudang Kartasura' };

          var dMap = window.L.map(drawerMapEl, {
            center: [dLat, dLng],
            zoom: 14,
            zoomControl: true
          });
          window.__arbaCrmDrawerMap = dMap;
          window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap'
          }).addTo(dMap);

          var hqPin = window.L.divIcon({
            className: 'crm-hq-pin',
            html: '<div style="width:24px;height:24px;border-radius:6px;background:#0284c7;color:#fff;font-size:9px;font-weight:900;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);">HQ</div>',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });
          window.L.marker([hq.lat, hq.lng], { icon: hqPin }).addTo(dMap).bindPopup('<b>Gudang Utama Kartasura</b>');

          var pin = window.L.divIcon({
            className: 'crm-drawer-pin',
            html: '<div style="width:28px;height:28px;border-radius:50%;background:#005c55;color:#fff;display:flex;align-items:center;justify-content:center;border:2.5px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.35);font-size:14px;">📍</div>',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          });
          window.L.marker([dLat, dLng], { icon: pin })
            .addTo(dMap)
            .bindPopup('<div style="font-size:11px;font-family:Inter,sans-serif;"><b>' + window.ArbaUtils.escapeHtml(dName) + '</b><br/>' + window.ArbaUtils.escapeHtml(dAddr) + '</div>');

          var corridor = window.ArbaStore.computeCorridorRoadPath
            ? window.ArbaStore.computeCorridorRoadPath(hq, { lat: dLat, lng: dLng })
            : { waypoints: [[hq.lat, hq.lng], [dLat, dLng]] };

          var dLineCasing = window.L.polyline(corridor.waypoints, { color: '#ffffff', weight: 6, opacity: 0.9 }).addTo(dMap);
          var dLine = window.L.polyline(corridor.waypoints, { color: '#005c55', weight: 3.5, opacity: 0.92 }).addTo(dMap);
          dMap.fitBounds(dLine.getBounds().pad(0.18));

          if (window.ArbaAdvanced && window.ArbaAdvanced.fetchRealRoadGeometryOsrm) {
            window.ArbaAdvanced.fetchRealRoadGeometryOsrm([hq, { lat: dLat, lng: dLng }], function (osrmRes) {
              if (osrmRes && osrmRes.latLngs && window.__arbaCrmDrawerMap === dMap) {
                dLineCasing.setLatLngs(osrmRes.latLngs);
                dLine.setLatLngs(osrmRes.latLngs);
                dMap.fitBounds(dLine.getBounds().pad(0.15));
              }
            });
          }

          setTimeout(function () { dMap.invalidateSize(); }, 80);
        } catch (err) {}
      }

      var btnWa = container.querySelector('#btn-drawer-whatsapp');
      if (btnWa) {
        btnWa.addEventListener('click', function () {
          openWhatsAppModal(selectedOutlet);
        });
      }

      var btnDrawerVisit = container.querySelector('#btn-drawer-visit');
      if (btnDrawerVisit) {
        btnDrawerVisit.addEventListener('click', function () {
          openVisitModal(selectedOutlet);
        });
      }

      var btnDrawerHist = container.querySelector('#btn-drawer-history');
      if (btnDrawerHist) {
        btnDrawerHist.addEventListener('click', function () {
          openHistoryModal(selectedOutlet);
        });
      }

      var btnDrawerPwa = container.querySelector('#btn-drawer-pwa');
      if (btnDrawerPwa) {
        btnDrawerPwa.addEventListener('click', function () {
          window.ArbaStore.setSelectedOutletId(selectedOutlet.id);
          window.ArbaApp.navigate('field-sales-pwa-preview');
          window.ArbaApp.showToast(`Beralih ke Field Sales PWA untuk ${selectedOutlet.name}`, 'smartphone');
        });
      }
    }

    // CRM Pagination buttons
    var crmPrev = container.querySelector('#btn-crm-prev');
    var crmNext = container.querySelector('#btn-crm-next');
    var crmPages = container.querySelectorAll('.btn-crm-page');
    if (crmPrev) {
      crmPrev.addEventListener('click', function () {
        if (state.crmPage > 1) {
          state.crmPage--;
          renderB2bCrm(container);
        }
      });
    }
    if (crmNext) {
      crmNext.addEventListener('click', function () {
        state.crmPage++;
        renderB2bCrm(container);
      });
    }
    crmPages.forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.crmPage = Number(btn.getAttribute('data-page')) || 1;
        renderB2bCrm(container);
      });
    });
  }

  // Modal 0: Migrasi / Impor Data Awal Outlet B2B (CSV)
  function openImportOutletsModal() {
    var sampleCsv = [
      'kode_outlet,nama_outlet,tipe,kota,alamat,nama_pic,telepon_pic,sales_rep,termin,limit_kredit,omset_ytd',
      'AP-SLO-190,Apotek Muhamadiyah Pabelan UMS,Apotek Mandiri,Solo,"Jl. Ahmad Yani No. 157, Pabelan",apt. Siti Aminah S.Farm,6281329001122,Budi Santoso,Net 30 Hari,12000000,18500000',
      'MM-SKH-191,Swalayan Assalaam Hypermarket,Minimarket,Sukoharjo,"Jl. Ahmad Yani KM 6, Kartasura",H. Agus Santoso,6281228003344,Anita Rahmawati,Net 14 Hari,25000000,42000000',
      'AP-KLT-192,Apotek Sehat Delanggu,Apotek Mandiri,Klaten,"Jl. Raya Solo-Jogja KM 22, Delanggu",apt. Wahyu Nugroho S.Farm,6285725009988,Rian Pratama,Net 30 Hari,10000000,14200000'
    ].join('\n');

    var modalHtml = `
      <div class="modal-dialog max-w-2xl">
        <div class="modal-header">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <span class="material-symbols-outlined text-[20px]">upload_file</span>
            </div>
            <div>
              <h3 class="font-bold text-sm text-on-surface">Skema Migrasi &amp; Impor Data Awal Pelanggan B2B (.CSV)</h3>
              <p class="text-[11px] text-on-surface-variant">Unggah berkas CSV dari Excel lama CV Arba'in atau gunakan template standar</p>
            </div>
          </div>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div class="modal-body text-xs space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2 bg-surface-container-low p-3 rounded-lg border border-border-subtle/50">
            <div class="text-on-surface-variant">
              Format Kolom: <code class="font-mono text-primary font-semibold">kode_outlet, nama_outlet, tipe, kota, alamat, nama_pic, telepon_pic, sales_rep, termin, limit_kredit</code>
            </div>
            <div class="flex items-center gap-2">
              <button type="button" id="btn-download-outlet-template" class="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold cursor-pointer border border-border-subtle/50 flex items-center gap-1">
                <span class="material-symbols-outlined text-[15px]">download</span>
                <span>Unduh Template CSV</span>
              </button>
              <button type="button" id="btn-load-outlet-sample" class="px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-semibold cursor-pointer border-0">
                Isi Contoh Data Mitra
              </button>
            </div>
          </div>

          <div class="space-y-1">
            <label class="font-semibold text-on-surface block">Pilih Berkas CSV dari Komputer (.csv):</label>
            <input type="file" id="input-outlet-csv-file" accept=".csv,text/csv" class="w-full p-2 rounded-lg border border-border-subtle bg-surface text-xs" />
          </div>

          <div class="space-y-1">
            <label class="font-semibold text-on-surface block">Atau Tempel / Edit Baris CSV Secara Langsung:</label>
            <textarea id="textarea-outlet-csv" rows="6" class="w-full p-2.5 rounded-lg border border-border-subtle bg-surface font-mono text-[11px] text-on-surface">${sampleCsv}</textarea>
          </div>

          <div class="flex items-center justify-end gap-2 pt-2">
            <button type="button" class="px-3.5 py-2 rounded-lg bg-surface-container text-on-surface font-semibold cursor-pointer border-0" onclick="window.ArbaApp.closeModal()">
              Batal
            </button>
            <button type="button" id="btn-exec-outlet-import" class="px-4 py-2 rounded-lg bg-primary text-white font-semibold cursor-pointer border-0 flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[16px]">cloud_upload</span>
              <span>Proses Migrasi Data Outlet</span>
            </button>
          </div>
        </div>
      </div>
    `;

    window.ArbaApp.openModal(modalHtml);

    setTimeout(function () {
      var btnDl = document.getElementById('btn-download-outlet-template');
      var btnSample = document.getElementById('btn-load-outlet-sample');
      var fileInput = document.getElementById('input-outlet-csv-file');
      var txtArea = document.getElementById('textarea-outlet-csv');
      var btnExec = document.getElementById('btn-exec-outlet-import');

      if (btnDl) {
        btnDl.onclick = function () {
          window.ArbaUtils.downloadCsv('Template_Migrasi_Outlet_B2B_ArbaConnect.csv', sampleCsv);
        };
      }
      if (btnSample && txtArea) {
        btnSample.onclick = function () {
          txtArea.value = sampleCsv;
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
          window.ArbaStore.importOutlets(rows);
          window.ArbaApp.closeModal();
        };
      }
    }, 30);
  }

  // Modal 1: Register Outlet Baru
  function openNewOutletModal() {
    var outlets = window.ArbaStore.getState().outlets;
    var autoCode = 'AP-SLO-' + String(168 + outlets.length + 1).padStart(3, '0');

    var modalHtml = `
      <div class="modal-dialog max-w-2xl">
        <div class="modal-header">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[24px]">add_business</span>
            <h2 class="modal-title">Registrasi Outlet B2B Baru</h2>
          </div>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form id="form-new-outlet">
          <div class="modal-body text-xs">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div class="flex flex-col gap-1">
                <label class="font-semibold text-on-surface">Kode Outlet (Auto Generated)</label>
                <input readOnly type="text" value="${autoCode}" class="bg-surface-container-low text-on-surface px-3 py-2 rounded-lg font-mono text-xs border border-border-subtle/50 cursor-not-allowed" />
              </div>

              <div class="flex flex-col gap-1">
                <label class="font-semibold text-on-surface">Tipe Outlet *</label>
                <select id="new-type" required class="bg-surface-container-low text-on-surface px-3 py-2 rounded-lg text-xs border border-border-subtle/50 cursor-pointer">
                  <option value="Apotek Mandiri">Apotek Mandiri</option>
                  <option value="Jaringan Farmasi">Jaringan Farmasi (Kimia Farma / K-24 / Roxy)</option>
                  <option value="Minimarket">Minimarket / Supermarket Ritel</option>
                </select>
              </div>

              <div class="md:col-span-2 flex flex-col gap-1" style="grid-column: span 2 / span 2;">
                <label class="font-semibold text-on-surface">Nama Resmi Outlet / Toko *</label>
                <input id="new-name" required type="text" placeholder="Contoh: Apotek K-24 Nusukan Solo" class="bg-surface-container-low text-on-surface px-3 py-2 rounded-lg text-xs border border-border-subtle/50" />
              </div>

              <div class="flex flex-col gap-1">
                <label class="font-semibold text-on-surface">Apoteker / Penanggung Jawab *</label>
                <input id="new-pic" required type="text" placeholder="Nama lengkap &amp; gelar" class="bg-surface-container-low text-on-surface px-3 py-2 rounded-lg text-xs border border-border-subtle/50" />
              </div>

              <div class="flex flex-col gap-1">
                <label class="font-semibold text-on-surface">No. WhatsApp Aktif *</label>
                <input id="new-phone" required type="tel" placeholder="08xxxxxxxxxx" class="bg-surface-container-low text-on-surface px-3 py-2 rounded-lg text-xs border border-border-subtle/50" />
              </div>

              <div class="flex flex-col gap-1">
                <label class="font-semibold text-on-surface">Kota / Kabupaten (Solo Raya) *</label>
                <select id="new-city" required class="bg-surface-container-low text-on-surface px-3 py-2 rounded-lg text-xs border border-border-subtle/50 cursor-pointer">
                  <option value="Solo">Surakarta / Solo</option>
                  <option value="Sukoharjo">Sukoharjo</option>
                  <option value="Karanganyar">Karanganyar</option>
                  <option value="Klaten">Klaten</option>
                  <option value="Boyolali">Boyolali</option>
                  <option value="Sragen">Sragen</option>
                </select>
              </div>

              <div class="flex flex-col gap-1">
                <label class="font-semibold text-on-surface">Sales Dedikasi Lapangan *</label>
                <select id="new-sales" required class="bg-surface-container-low text-on-surface px-3 py-2 rounded-lg text-xs border border-border-subtle/50 cursor-pointer">
                  <option value="Budi Santoso">Budi Santoso (Solo Tengah)</option>
                  <option value="Tri Wahyuni">Tri Wahyuni (Sukoharjo - Solo Baru)</option>
                  <option value="Agus Hermawan">Agus Hermawan (Karanganyar - Sragen)</option>
                  <option value="Rian Pratama">Rian Pratama (Klaten - Boyolali)</option>
                </select>
              </div>

              <div class="md:col-span-2 flex flex-col gap-1" style="grid-column: span 2 / span 2;">
                <label class="font-semibold text-on-surface">Alamat Lengkap Outlet &amp; Patokan Pengiriman *</label>
                <textarea id="new-address" required rows="2" placeholder="Jl. Raya No. XX, Kelurahan, Kecamatan..." class="bg-surface-container-low text-on-surface px-3 py-2 rounded-lg text-xs border border-border-subtle/50"></textarea>
              </div>

              <!-- Peta Nyata Pemilihan Titik Koordinat GPS Apotek Baru (Leaflet + OpenStreetMap) -->
              <div class="md:col-span-2 flex flex-col gap-1.5" style="grid-column: span 2 / span 2;">
                <div class="flex items-center justify-between">
                  <label class="font-semibold text-on-surface flex items-center gap-1">
                    <span class="material-symbols-outlined text-[16px] text-primary">pin_drop</span>
                    <span>Titik Lokasi Peta Nyata (Klik pada Peta untuk Menentukan Lokasi Apotek)</span>
                  </label>
                  <span class="text-[11px] font-mono text-primary font-semibold" id="new-coords-display">-7.5682, 110.8091</span>
                </div>
                <div id="new-outlet-picker-map" style="width:100%; height:190px; border-radius:10px; border:1px solid var(--color-border-subtle); z-index:1; background:#e2e8f0;"></div>
                <div class="grid grid-cols-2 gap-2 mt-1">
                  <div class="flex items-center gap-1.5">
                    <span class="text-[11px] text-on-surface-variant">Latitude:</span>
                    <input id="new-lat" type="number" step="0.00001" value="-7.56820" class="flex-1 bg-surface-container-low text-on-surface px-2.5 py-1.5 rounded-lg font-mono text-xs border border-border-subtle/50" />
                  </div>
                  <div class="flex items-center gap-1.5">
                    <span class="text-[11px] text-on-surface-variant">Longitude:</span>
                    <input id="new-lng" type="number" step="0.00001" value="110.80910" class="flex-1 bg-surface-container-low text-on-surface px-2.5 py-1.5 rounded-lg font-mono text-xs border border-border-subtle/50" />
                  </div>
                </div>
              </div>

              <div class="flex flex-col gap-1">
                <label class="font-semibold text-on-surface">Termin Pembayaran Disepakati *</label>
                <select id="new-terms" required class="bg-surface-container-low text-on-surface px-3 py-2 rounded-lg text-xs border border-border-subtle/50 cursor-pointer">
                  <option value="Net 30 Hari">Net 30 Hari (Standar Apotek)</option>
                  <option value="Net 14 Hari">Net 14 Hari (Minimarket)</option>
                  <option value="COD Cash">COD / Cash On Delivery (Mitra Baru)</option>
                </select>
              </div>

              <div class="flex flex-col gap-1">
                <label class="font-semibold text-on-surface">Plafon Kredit Awal (IDR)</label>
                <input id="new-limit" type="number" value="10000000" class="bg-surface-container-low text-on-surface px-3 py-2 rounded-lg font-mono font-bold text-xs border border-border-subtle/50" />
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button onclick="window.ArbaApp.closeModal()" class="btn btn-outline" type="button">
              Batal
            </button>
            <button type="submit" class="btn btn-primary">
              Simpan &amp; Daftarkan Kemitraan
            </button>
          </div>
        </form>
      </div>
    `;

    window.ArbaApp.openModal(modalHtml);

    setTimeout(function () {
      var form = document.getElementById('form-new-outlet');
      var latInput = document.getElementById('new-lat');
      var lngInput = document.getElementById('new-lng');
      var citySelect = document.getElementById('new-city');
      var coordsLabel = document.getElementById('new-coords-display');
      var pickerMapEl = document.getElementById('new-outlet-picker-map');
      var pickerMap = null;
      var pickerMarker = null;

      var cityCoords = {
        Solo: { lat: -7.5682, lng: 110.8091 },
        Sukoharjo: { lat: -7.6819, lng: 110.8408 },
        Karanganyar: { lat: -7.5965, lng: 110.9461 },
        Klaten: { lat: -7.7056, lng: 110.6015 },
        Boyolali: { lat: -7.5305, lng: 110.5964 },
        Sragen: { lat: -7.4272, lng: 111.0221 }
      };

      function updatePickerCoords(lat, lng, panMap) {
        var fLat = Number(lat).toFixed(5);
        var fLng = Number(lng).toFixed(5);
        if (latInput) latInput.value = fLat;
        if (lngInput) lngInput.value = fLng;
        if (coordsLabel) coordsLabel.textContent = fLat + ', ' + fLng;
        if (pickerMarker) pickerMarker.setLatLng([Number(fLat), Number(fLng)]);
        if (panMap && pickerMap) pickerMap.setView([Number(fLat), Number(fLng)], 14);
      }

      if (pickerMapEl && typeof window.L !== 'undefined') {
        try {
          pickerMap = window.L.map(pickerMapEl, {
            center: [-7.5682, 110.8091],
            zoom: 13
          });
          window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap'
          }).addTo(pickerMap);
          pickerMarker = window.L.marker([-7.5682, 110.8091], { draggable: true }).addTo(pickerMap);
          pickerMarker.on('dragend', function (ev) {
            var pos = ev.target.getLatLng();
            updatePickerCoords(pos.lat, pos.lng, false);
          });
          pickerMap.on('click', function (ev) {
            updatePickerCoords(ev.latlng.lat, ev.latlng.lng, false);
          });
          setTimeout(function () { pickerMap.invalidateSize(); }, 90);
        } catch (err) {}
      }

      if (citySelect) {
        citySelect.onchange = function (e) {
          var c = cityCoords[e.target.value];
          if (c) updatePickerCoords(c.lat, c.lng, true);
        };
      }

      if (form) {
        form.onsubmit = function (e) {
          e.preventDefault();
          var cityVal = document.getElementById('new-city').value;
          var limitVal = Number(document.getElementById('new-limit').value);
          var latVal = latInput ? Number(latInput.value) : undefined;
          var lngVal = lngInput ? Number(lngInput.value) : undefined;

          if (pickerMap) {
            try { pickerMap.remove(); } catch (err) {}
          }

          window.ArbaStore.addOutlet({
            name: document.getElementById('new-name').value,
            type: document.getElementById('new-type').value,
            picName: document.getElementById('new-pic').value,
            picPhone: document.getElementById('new-phone').value,
            city: cityVal,
            cityName: cityVal === 'Solo' ? 'Surakarta' : cityVal,
            lat: latVal,
            lng: lngVal,
            salesRep: document.getElementById('new-sales').value,
            address: document.getElementById('new-address').value,
            terms: document.getElementById('new-terms').value,
            creditLimit: limitVal,
            creditRemaining: limitVal
          });

          window.ArbaApp.closeModal();
        };
      }
    }, 50);
  }

  // Modal 2: WhatsApp Assistant
  function openWhatsAppModal(outlet) {
    var template = 'delivery';

    function getMessage(tpl) {
      if (tpl === 'delivery') {
        return `Halo Ibu/Bapak ${outlet.picName}, menginformasikan bahwa pesanan produk herbal CV Arba'in untuk ${outlet.name} telah diproses gudang Kartasura dan siap dikirim dengan armada hari ini. Mohon stempel penerimaan disiapkan.`;
      } else if (tpl === 'invoice') {
        return `Halo Ibu/Bapak ${outlet.picName}, menginformasikan jatuh tempo faktur termin ${outlet.terms} untuk ${outlet.name}. Pemakaian kredit saat ini ${window.ArbaUtils.formatRupiah(outlet.creditUsed)} dari plafon ${window.ArbaUtils.formatRupiah(outlet.creditLimit)}. Terima kasih atas kerjasamanya.`;
      } else {
        return `Halo Ibu/Bapak ${outlet.picName}, penawaran spesial CV Arba'in Solo Raya: Diskon bundling 12% untuk Madu Randu 500g dan Habbatussauda Oil Softgel 100s bagi apotek mitra minggu ini!`;
      }
    }

    var modalHtml = `
      <div class="modal-dialog max-w-lg">
        <div class="modal-header">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-emerald-600 text-[24px]">chat</span>
            <h3 class="modal-title">Asisten Komunikasi WhatsApp PIC</h3>
          </div>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div class="modal-body text-xs">
          <div class="bg-surface-container-low p-3 rounded-lg flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold" style="width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center;">
              <span class="material-symbols-outlined text-[20px]">person</span>
            </div>
            <div class="flex flex-col">
              <span class="font-bold text-sm text-on-surface">${window.ArbaUtils.escapeHtml(outlet.picName)}</span>
              <span class="text-xs text-on-surface-variant font-mono">${window.ArbaUtils.escapeHtml(outlet.picPhone)} • ${window.ArbaUtils.escapeHtml(outlet.name)}</span>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <label class="font-semibold text-on-surface-variant">Pilih Template Pesan Cepat:</label>
            <div class="grid grid-cols-3 gap-2">
              <button id="wa-tpl-delivery" type="button" class="px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer text-center bg-primary text-white border-primary">
                Jadwal Kirim
              </button>
              <button id="wa-tpl-invoice" type="button" class="px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer text-center bg-surface-container text-on-surface border-border-subtle/50">
                Tagihan Tempo
              </button>
              <button id="wa-tpl-promo" type="button" class="px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer text-center bg-surface-container text-on-surface border-border-subtle/50">
                Promo Bundling
              </button>
            </div>

            <div class="mt-2">
              <label class="font-semibold text-on-surface-variant block mb-1">Pratinjau Pesan:</label>
              <textarea id="wa-msg-preview" rows="4" readonly class="w-full p-2.5 bg-surface-container-low rounded-lg text-xs text-on-surface border border-border-subtle/40 focus:outline-none">${window.ArbaUtils.escapeHtml(getMessage('delivery'))}</textarea>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button onclick="window.ArbaApp.closeModal()" class="btn btn-outline" type="button">
            Batal
          </button>
          <button id="btn-send-wa" class="btn btn-primary" style="background:#059669;" type="button">
            <span class="material-symbols-outlined text-[16px]">send</span>
            <span>Kirim via WhatsApp Web</span>
          </button>
        </div>
      </div>
    `;

    window.ArbaApp.openModal(modalHtml);

    setTimeout(function () {
      var btnDeliv = document.getElementById('wa-tpl-delivery');
      var btnInv = document.getElementById('wa-tpl-invoice');
      var btnPromo = document.getElementById('wa-tpl-promo');
      var preview = document.getElementById('wa-msg-preview');
      var btnSend = document.getElementById('btn-send-wa');

      function setTemplate(tpl) {
        template = tpl;
        preview.value = getMessage(tpl);
        [btnDeliv, btnInv, btnPromo].forEach(function (b) {
          b.className = 'px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer text-center bg-surface-container text-on-surface border-border-subtle/50';
        });
        if (tpl === 'delivery') btnDeliv.className = 'px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer text-center bg-primary text-white border-primary';
        if (tpl === 'invoice') btnInv.className = 'px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer text-center bg-primary text-white border-primary';
        if (tpl === 'promo') btnPromo.className = 'px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer text-center bg-primary text-white border-primary';
      }

      if (btnDeliv) btnDeliv.onclick = function () { setTemplate('delivery'); };
      if (btnInv) btnInv.onclick = function () { setTemplate('invoice'); };
      if (btnPromo) btnPromo.onclick = function () { setTemplate('promo'); };

      if (btnSend) {
        btnSend.onclick = function () {
          var cleanPhone = outlet.picPhone.replace(/\D/g, '');
          window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(preview.value)}`, '_blank');
          window.ArbaApp.showToast(`Membuka WhatsApp untuk ${outlet.picName}`, 'chat');
          window.ArbaApp.closeModal();
        };
      }
    }, 50);
  }

  // Modal 3: Jadwalkan Kunjungan Sales
  function openVisitModal(outlet) {
    var modalHtml = `
      <div class="modal-dialog max-w-lg">
        <div class="modal-header">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[24px]">calendar_month</span>
            <h3 class="modal-title">Jadwalkan Kunjungan Sales Rep</h3>
          </div>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form id="form-schedule-visit">
          <div class="modal-body text-xs">
            <div class="bg-surface-container-low p-3 rounded-lg space-y-1">
              <span class="text-on-surface-variant block">Outlet Mitra:</span>
              <span class="font-bold text-sm text-on-surface block">${window.ArbaUtils.escapeHtml(outlet.name)}</span>
              <span class="text-slate-500">${window.ArbaUtils.escapeHtml(outlet.address)} • Wilayah: ${window.ArbaUtils.escapeHtml(outlet.cityName)}</span>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1">
                <label class="font-semibold text-on-surface-variant">Sales Dedikasi</label>
                <input type="text" readOnly value="${window.ArbaUtils.escapeHtml(outlet.salesRep)}" class="p-2 bg-surface-container-low rounded-lg text-xs font-semibold text-on-surface border border-border-subtle/50" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="font-semibold text-on-surface-variant">Tujuan Kunjungan *</label>
                <select id="visit-purpose" class="p-2 bg-surface-container-low rounded-lg text-xs text-on-surface cursor-pointer border border-border-subtle/50">
                  <option value="Kunjungan Rutin">Kunjungan Rutin</option>
                  <option value="Penagihan Tempo">Penagihan Tempo</option>
                  <option value="Promosi Bundling">Promosi Bundling</option>
                  <option value="Follow Up At-Risk">Follow Up At-Risk</option>
                </select>
              </div>
            </div>

            <div class="flex flex-col gap-1">
              <label class="font-semibold text-on-surface-variant">Waktu Rencana Kunjungan *</label>
              <input id="visit-date" type="datetime-local" required value="2026-04-02T10:00" class="p-2 bg-surface-container-low rounded-lg text-xs text-on-surface border border-border-subtle/50" />
            </div>

            <div class="flex flex-col gap-1">
              <label class="font-semibold text-on-surface-variant">Catatan Instruksi Sales *</label>
              <textarea id="visit-notes" rows="2" required class="p-2 bg-surface-container-low rounded-lg text-xs text-on-surface border border-border-subtle/50">Pengecekan display produk dan pengambilan pesanan baru</textarea>
            </div>
          </div>

          <div class="modal-footer">
            <button onclick="window.ArbaApp.closeModal()" class="btn btn-outline" type="button">
              Batal
            </button>
            <button type="submit" class="btn btn-primary">
              <span class="material-symbols-outlined text-[16px]">event_available</span>
              <span>Simpan Agenda Kunjungan</span>
            </button>
          </div>
        </form>
      </div>
    `;

    window.ArbaApp.openModal(modalHtml);

    setTimeout(function () {
      var form = document.getElementById('form-schedule-visit');
      if (form) {
        form.onsubmit = function (e) {
          e.preventDefault();
          window.ArbaStore.scheduleSalesVisit({
            outletId: outlet.id,
            outletName: outlet.name,
            salesRep: outlet.salesRep,
            scheduledDate: document.getElementById('visit-date').value,
            purpose: document.getElementById('visit-purpose').value,
            notes: document.getElementById('visit-notes').value
          });
          window.ArbaApp.closeModal();
        };
      }
    }, 50);
  }

  // Modal 4: Riwayat Transaksi & Audit Faktur
  function openHistoryModal(outlet) {
    var orders = window.ArbaStore.getState().orders;
    var outletOrders = orders.filter(function (o) {
      return o.outletName.toLowerCase().indexOf(outlet.name.toLowerCase()) !== -1 ||
             o.outletId === outlet.code;
    });

    var modalHtml = `
      <div class="modal-dialog max-w-2xl">
        <div class="modal-header">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[24px]">receipt_long</span>
            <div>
              <h3 class="modal-title">Riwayat Transaksi &amp; Audit Faktur</h3>
              <span class="text-xs text-on-surface-variant">${window.ArbaUtils.escapeHtml(outlet.name)} (${window.ArbaUtils.escapeHtml(outlet.code)})</span>
            </div>
          </div>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div class="modal-body text-xs">
          <!-- Credit Gauge Summary -->
          <div class="grid grid-cols-3 gap-3 p-3 bg-surface-container-low rounded-xl text-center">
            <div>
              <span class="text-[11px] text-on-surface-variant block uppercase font-medium">Plafon Disetujui</span>
              <span class="font-bold text-sm text-on-surface font-mono">${window.ArbaUtils.formatRupiah(outlet.creditLimit)}</span>
            </div>
            <div>
              <span class="text-[11px] text-on-surface-variant block uppercase font-medium">Pemakaian Berjalan</span>
              <span class="font-bold text-sm text-amber-700 font-mono">${window.ArbaUtils.formatRupiah(outlet.creditUsed)}</span>
            </div>
            <div>
              <span class="text-[11px] text-on-surface-variant block uppercase font-medium">Sisa Plafon Tersedia</span>
              <span class="font-bold text-sm text-emerald-700 font-mono">${window.ArbaUtils.formatRupiah(outlet.creditRemaining)}</span>
            </div>
          </div>

          <!-- History Table -->
          <div>
            <h4 class="font-semibold text-xs text-on-surface mb-2">Faktur Terbit &amp; Pemesanan Lapangan:</h4>
            <div class="overflow-x-auto rounded-lg border border-border-subtle/40">
              <table class="w-full text-left border-collapse text-xs">
                <thead class="bg-surface-container-high text-on-surface-variant font-semibold">
                  <tr>
                    <th class="p-2.5">No. Faktur</th>
                    <th class="p-2.5">Waktu</th>
                    <th class="p-2.5">Nilai Transaksi</th>
                    <th class="p-2.5">Termin</th>
                    <th class="p-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border-subtle/30">
                  ${outletOrders.map(function (ord) {
                    return `
                      <tr class="hover:bg-surface-container-low">
                        <td class="p-2.5 font-mono font-semibold text-primary">${window.ArbaUtils.escapeHtml(ord.clientUuid)}</td>
                        <td class="p-2.5 text-slate-500">${window.ArbaUtils.escapeHtml(ord.orderTime)}</td>
                        <td class="p-2.5 font-semibold font-mono">${window.ArbaUtils.formatRupiah(ord.totalAmount)}</td>
                        <td class="p-2.5">${window.ArbaUtils.escapeHtml(ord.terms)}</td>
                        <td class="p-2.5 text-center">
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-success-bg text-status-success-text">
                            ${window.ArbaUtils.escapeHtml(ord.status)}
                          </span>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                  ${outletOrders.length === 0 ? `
                    <tr>
                      <td colspan="5" class="p-4 text-center text-slate-400">
                        Belum ada transaksi historis terekam pada periode ini.
                      </td>
                    </tr>
                  ` : ''}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="modal-footer flex items-center justify-between">
          <span class="text-xs text-slate-500">Kepatuhan Audit: Sesuai Buku Besar Piutang Solo Raya</span>
          <button
            type="button"
            data-outlet-name="${window.ArbaUtils.escapeHtml(outlet.name)}"
            onclick="window.ArbaApp.showToast('Mencetak rekening koran mitra ' + (this.getAttribute('data-outlet-name') || ''), 'print'); window.print();"
            class="btn btn-outline text-primary text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <span class="material-symbols-outlined text-[16px]">print</span>
            <span>Cetak Rekap Piutang</span>
          </button>
        </div>
      </div>
    `;

    window.ArbaApp.openModal(modalHtml);
  }

  window.ArbaViews.renderB2bCrm = renderB2bCrm;
})();
