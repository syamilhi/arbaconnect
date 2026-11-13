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
    activeRouteFilter: 'all'
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

    var percentRemaining = selectedOutlet
      ? Math.round((selectedOutlet.creditRemaining / selectedOutlet.creditLimit) * 100)
      : 100;

    var html = `
      <div class="flex flex-col w-full gap-space-lg">
        <!-- Header Title & Action Toolbar -->
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div class="flex flex-col">
            <div class="flex items-center gap-2 text-on-surface-variant text-xs mb-1 font-medium">
              <span>Sistem Distribusi Solo Raya</span>
              <span aria-hidden="true">·</span>
              <span class="text-primary font-semibold">Direktori B2B CRM</span>
              <span aria-hidden="true">·</span>
              <span>Relasi Apotek &amp; Ritel</span>
            </div>
            <h1 class="text-2xl text-on-surface tracking-tight font-bold">
              Direktori CRM Pelanggan B2B &amp; Kemitraan Outlet
            </h1>
            <p class="text-sm text-on-surface-variant max-w-4xl mt-0.5">
              Basis data kemitraan apotek, minimarket, plafon kredit, dan rute sales lapangan CV Arba'in di Solo Raya.
            </p>
          </div>
          <div class="flex items-center gap-2.5 flex-wrap">
            <button
              id="btn-import-crm-csv"
              class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface-container-low text-primary hover:bg-surface-container text-xs font-semibold transition-colors border border-border-subtle/50 cursor-pointer"
              type="button"
              title="Impor / Migrasi Data Awal Pelanggan B2B dari CSV"
            >
              <span class="material-symbols-outlined text-[16px]">upload_file</span>
              <span>Migrasi / Impor CSV</span>
            </button>
            <button
              id="btn-export-crm-csv"
              class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container text-xs font-semibold transition-colors border border-border-subtle/50 cursor-pointer"
              type="button"
            >
              <span class="material-symbols-outlined text-[16px]">file_download</span>
              <span>Ekspor Data CRM</span>
            </button>
            <button
              id="btn-new-outlet"
              class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-container text-xs font-semibold transition-colors shadow-xs cursor-pointer active:scale-95 border-0"
              type="button"
            >
              <span class="material-symbols-outlined text-[16px]">add_business</span>
              <span>+ Daftarkan Outlet Baru</span>
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
                    ${168 + (outlets.length - 6)}
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
                <span>148 Aktif</span>
              </div>
              <span class="text-on-surface-variant">20 Baru / Evaluasi</span>
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
                  <span class="text-2xl text-primary font-bold">104</span>
                  <span class="text-xs text-on-surface-variant font-medium">Titik Relasi</span>
                </div>
              </div>
              <div class="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center text-primary" style="background:#ccfbf1;">
                <span class="material-symbols-outlined text-[20px]">medication</span>
              </div>
            </div>
            <div class="mt-4 pt-2.5 flex items-center justify-between text-xs border-t border-border-subtle/40 text-on-surface-variant">
              <span>Rata-rata termin:</span>
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
                  <span class="text-2xl text-on-surface font-bold">64</span>
                  <span class="text-xs text-on-surface-variant font-medium">Toko</span>
                </div>
              </div>
              <div class="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant">
                <span class="material-symbols-outlined text-[20px]">shopping_cart</span>
              </div>
            </div>
            <div class="mt-4 pt-2.5 flex items-center justify-between text-xs border-t border-border-subtle/40 text-on-surface-variant">
              <span>Rata-rata termin:</span>
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
                  <span class="text-2xl text-emerald-700 font-bold">94.2%</span>
                  <span class="text-xs font-semibold text-emerald-700">Optimal</span>
                </div>
              </div>
              <div class="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700" style="background:#dcfce7;">
                <span class="material-symbols-outlined text-[20px]">verified_user</span>
              </div>
            </div>
            <div class="mt-4 pt-2.5 flex items-center justify-between text-xs border-t border-border-subtle/40 text-on-surface-variant">
              <span class="text-amber-700 font-medium flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px]">warning</span>
                5.8% Jatuh Tempo &lt;7 hari
              </span>
              <span class="text-on-surface-variant font-code-table font-mono">0 Bad Debt</span>
            </div>
          </div>
        </div>

        <!-- Search, Filter & Segmentation Bar -->
        <div class="bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-border-subtle/40 flex flex-col gap-space-sm">
          <div class="grid grid-cols-1 md:grid-cols-12 gap-space-sm">
            <!-- Search Field -->
            <div class="md:col-span-5 relative flex items-center" style="grid-column: span 5 / span 12; position:relative;">
              <span class="material-symbols-outlined absolute left-3 text-on-surface-variant text-[20px] pointer-events-none" style="position:absolute; left:0.75rem;">
                search
              </span>
              <input
                id="crm-search-input"
                value="${window.ArbaUtils.escapeHtml(state.searchQuery)}"
                class="w-full bg-surface-container-low text-on-surface placeholder:text-on-surface-variant pl-10 pr-4 py-2.5 rounded-lg text-body-md font-body-md focus:outline-none focus:bg-surface-container transition-all text-xs border-0"
                style="padding-left: 2.25rem;"
                placeholder="Cari nama apotek, kode outlet, atau nama apoteker..."
                type="text"
              />
            </div>

            <!-- Filter Wilayah Solo Raya -->
            <div class="md:col-span-3 relative flex items-center" style="grid-column: span 3 / span 12; position:relative;">
              <span class="material-symbols-outlined absolute left-3 text-on-surface-variant text-[18px] pointer-events-none" style="position:absolute; left:0.75rem;">
                location_city
              </span>
              <select
                id="crm-region-select"
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
              Menampilkan ${filteredOutlets.length} dari ${168 + (outlets.length - 6)} outlet
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
                  ${filteredOutlets.map(function (outlet) {
                    var isSelected = outlet.id === selectedOutletId;
                    var pRemaining = Math.round((outlet.creditRemaining / outlet.creditLimit) * 100);

                    return `
                      <tr
                        class="crm-outlet-row cursor-pointer transition-colors ${
                          isSelected ? 'bg-surface-container' : 'hover:bg-surface-container-low/70'
                        }"
                        data-outlet-id="${outlet.id}"
                      >
                        <td class="py-3.5 px-space-md">
                          <div class="flex flex-col">
                            <span class="font-label-sm text-label-sm text-primary font-semibold font-mono text-[11px]">
                              ${outlet.code}
                            </span>
                            <span class="font-label-lg text-label-lg font-semibold text-on-surface leading-snug">
                              ${outlet.name}
                            </span>
                            <span class="font-body-sm text-body-sm text-on-surface-variant truncate max-w-xs text-[11px]">
                              ${outlet.address}
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
                              ${outlet.picName}
                            </span>
                            <a
                              href="https://wa.me/${outlet.picPhone}"
                              target="_blank"
                              rel="noreferrer"
                              class="font-label-sm text-label-sm text-primary hover:underline flex items-center gap-1 mt-0.5 text-[11px]"
                              onclick="event.stopPropagation()"
                            >
                              <span class="material-symbols-outlined text-[13px]">chat</span>
                              ${outlet.picPhone.replace(/^62/, '0')}
                            </a>
                          </div>
                        </td>

                        <td class="py-3.5 px-3 whitespace-nowrap">
                          <span class="font-label-md text-label-md text-on-surface">${outlet.cityName}</span>
                        </td>

                        <td class="py-3.5 px-3 whitespace-nowrap">
                          <span class="px-2 py-0.5 rounded bg-surface-container text-on-surface text-label-sm font-label-sm font-semibold">
                            ${outlet.terms}
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
                              ${outlet.salesRep}
                            </span>
                            <span class="font-label-sm text-label-sm text-on-surface-variant text-[11px]">
                              ${outlet.salesArea}
                            </span>
                          </div>
                        </td>

                        <td class="py-3.5 px-3 whitespace-nowrap">
                          <div class="flex flex-col">
                            <span class="font-label-md text-label-md text-on-surface">
                              ${outlet.lastOrderDate}
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
                              ${outlet.orderFrequency}
                            </span>
                          </div>
                        </td>

                        <td class="py-3.5 px-space-md text-right whitespace-nowrap">
                          <div class="flex items-center justify-end gap-1.5">
                            <button
                              class="btn-outlet-history p-1.5 rounded-lg text-primary hover:bg-surface-container transition-colors cursor-pointer border-0 bg-transparent"
                              title="Profil &amp; Riwayat Transaksi"
                              data-outlet-id="${outlet.id}"
                              type="button"
                              onclick="event.stopPropagation()"
                            >
                              <span class="material-symbols-outlined text-[18px]">receipt_long</span>
                            </button>
                            <button
                              class="btn-outlet-visit p-1.5 rounded-lg text-primary hover:bg-surface-container transition-colors cursor-pointer border-0 bg-transparent"
                              title="Jadwalkan Kunjungan"
                              data-outlet-id="${outlet.id}"
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
                Menampilkan ${filteredOutlets.length} dari ${168 + (outlets.length - 6)} outlet terdaftar CV Arba'in
              </span>
              <div class="flex items-center gap-1">
                <button class="w-8 h-8 rounded flex items-center justify-center text-on-surface-variant bg-surface-container-lowest hover:bg-surface-container transition-colors cursor-pointer border-0" type="button">
                  <span class="material-symbols-outlined text-[16px]">chevron_left</span>
                </button>
                <span class="w-8 h-8 rounded bg-primary text-white flex items-center justify-center font-label-sm text-label-sm font-semibold">
                  1
                </span>
                <button class="w-8 h-8 rounded flex items-center justify-center text-on-surface-variant bg-surface-container-lowest hover:bg-surface-container transition-colors cursor-pointer border-0" type="button">
                  2
                </button>
                <button class="w-8 h-8 rounded flex items-center justify-center text-on-surface-variant bg-surface-container-lowest hover:bg-surface-container transition-colors cursor-pointer border-0" type="button">
                  3
                </button>
                <button class="w-8 h-8 rounded flex items-center justify-center text-on-surface-variant bg-surface-container-lowest hover:bg-surface-container transition-colors cursor-pointer border-0" type="button">
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
                        ${selectedOutlet.code}
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
                      ${selectedOutlet.name}
                    </h2>
                    <p class="font-body-sm text-body-sm text-on-surface-variant text-xs">
                      ${selectedOutlet.address}, ${selectedOutlet.cityName}
                    </p>
                  </div>
                </div>

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
                  <!-- Mini SVG Trend Sparkline -->
                  <div class="h-20 w-full flex items-end pt-2" style="height:64px;">
                    <svg class="w-full h-full text-primary" fill="none" preserveAspectRatio="none" viewBox="0 0 240 60">
                      <line stroke="var(--color-border-subtle)" stroke-dasharray="2 2" stroke-opacity="0.6" x1="0" x2="240" y1="15" y2="15"></line>
                      <line stroke="var(--color-border-subtle)" stroke-dasharray="2 2" stroke-opacity="0.6" x1="0" x2="240" y1="35" y2="35"></line>
                      <line stroke="var(--color-border-subtle)" stroke-opacity="0.4" x1="0" x2="240" y1="55" y2="55"></line>
                      <path
                        d="M0,45 C40,48 60,32 90,26 C120,20 150,28 180,12 C210,-2 230,8 240,4 L240,60 L0,60 Z"
                        fill="currentColor"
                        fill-opacity="0.15"
                      ></path>
                      <path
                        d="M0,45 C40,48 60,32 90,26 C120,20 150,28 180,12 C210,-2 230,8 240,4"
                        stroke="currentColor"
                        stroke-linecap="round"
                        stroke-width="2.5"
                      ></path>
                    </svg>
                  </div>
                  <div class="flex justify-between font-label-sm text-label-sm text-on-surface-variant text-[10px]">
                    <span>Jan: 16.2 Jt</span>
                    <span>Feb: 19.8 Jt</span>
                    <span>Mar: 22.5 Jt</span>
                    <span class="font-semibold text-primary">Apr: 26.0 Jt (▲15%)</span>
                  </div>
                </div>

                <!-- Credit Line & Terms Visualizer -->
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
                        ${selectedOutlet.picName}
                      </span>
                      <span class="font-body-sm text-body-sm text-on-surface-variant text-[11px]">
                        ${selectedOutlet.picRole}
                      </span>
                    </div>
                  </div>
                  <div class="flex items-center justify-between pt-1 border-t border-border-subtle/30 text-[11px]">
                    <span class="font-label-sm text-label-sm text-on-surface-variant">Sales Dedikasi:</span>
                    <span class="font-label-sm text-label-sm text-on-surface font-semibold">
                      ${selectedOutlet.salesRep} (${selectedOutlet.salesArea})
                    </span>
                  </div>
                </div>

                <!-- Rincian Stok Titipan (Konsinyasi) di Apotek Ini: Barang Laku vs Lama Tidak Laku & Alarm Pink Expired -->
                <div class="flex flex-col gap-2">
                  <div class="flex items-center justify-between">
                    <span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-[11px]">
                      Stok Titipan (Konsinyasi) di Apotek Ini
                    </span>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                      ${selectedOutlet.terms}
                    </span>
                  </div>
                  <div class="space-y-1.5">
                    ${(selectedOutlet.consignmentItems || []).map(function (ci) {
                      var isSlow = ci.velocity === 'LAMA_TIDAK_LAKU';
                      var isPink = ci.nearExpiry;
                      return `
                        <div class="p-2.5 rounded-lg border text-xs flex flex-col gap-1" style="background:${isPink ? '#fdf2f8' : 'var(--color-surface-container-low)'}; border-color:${isPink ? '#f472b6' : 'var(--color-border-subtle)'};">
                          <div class="flex items-center justify-between gap-1">
                            <span class="font-bold text-on-surface truncate">${ci.name}</span>
                            <div class="flex items-center gap-1 shrink-0">
                              ${isPink ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold" style="background:#db2777; color:#fff;">🩷 Hampir ED</span>` : ''}
                              <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${isSlow ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'}">
                                ${isSlow ? 'Lama Tak Laku' : 'Laris'}
                              </span>
                            </div>
                          </div>
                          <div class="flex items-center justify-between text-[11px] text-on-surface-variant">
                            <span>Titip: <b>${ci.consignedQty}</b> · Laku: <b class="text-emerald-700">${ci.soldQty}</b> · Sisa di Apotek: <b class="text-on-surface">${ci.remainingQty}</b></span>
                            <span>ED: <b style="${isPink ? 'color:#be185d;' : ''}">${ci.expiry}</b></span>
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
                      ${selectedOutlet.lastVisitDate}
                    </span>
                  </div>
                  <div class="bg-surface-container-low/60 p-3 rounded-lg text-body-sm font-body-sm text-on-surface leading-relaxed border border-border-subtle/30 text-xs">
                    <p class="m-0">${selectedOutlet.visitNotes}</p>
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
            <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-xs border border-border-subtle/40 flex flex-col gap-space-sm p-4 text-xs">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-secondary text-[20px]">local_shipping</span>
                  <span class="font-title-sm text-title-sm text-on-surface font-bold text-sm">
                    Armada Pengiriman Hari Ini
                  </span>
                </div>
                <span class="font-label-sm text-label-sm text-status-success-text font-semibold bg-status-success-bg px-2 py-0.5 rounded text-[11px]">
                  Rute Terjadwal
                </span>
              </div>
              <p class="font-body-sm text-body-sm text-on-surface-variant">
                Pemesanan outlet sebelum pukul 13:00 WIB dikirim pada slot sore (15:00 - 18:00 WIB) armada van gudang Solo Baru.
              </p>
              <div class="grid grid-cols-2 gap-2 pt-1 font-label-sm text-label-sm">
                <div class="bg-surface-container-low p-2 rounded flex flex-col">
                  <span class="text-on-surface-variant text-[11px]">Slot Pagi (08:00 - 12:00)</span>
                  <span class="font-semibold text-on-surface mt-0.5">34 Outlet Solo &amp; Sukoharjo</span>
                </div>
                <div class="bg-surface-container-low p-2 rounded flex flex-col">
                  <span class="text-on-surface-variant text-[11px]">Slot Sore (13:00 - 17:00)</span>
                  <span class="font-semibold text-on-surface mt-0.5">28 Outlet Karanganyar &amp; Klaten</span>
                </div>
              </div>
            </div>
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

    // Drawer buttons
    if (selectedOutlet) {
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
      if (form) {
        form.onsubmit = function (e) {
          e.preventDefault();
          var cityVal = document.getElementById('new-city').value;
          var limitVal = Number(document.getElementById('new-limit').value);

          window.ArbaStore.addOutlet({
            name: document.getElementById('new-name').value,
            type: document.getElementById('new-type').value,
            picName: document.getElementById('new-pic').value,
            picPhone: document.getElementById('new-phone').value,
            city: cityVal,
            cityName: cityVal === 'Solo' ? 'Surakarta' : cityVal,
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
              <span class="font-bold text-sm text-on-surface">${outlet.picName}</span>
              <span class="text-xs text-on-surface-variant font-mono">${outlet.picPhone} • ${outlet.name}</span>
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
              <textarea id="wa-msg-preview" rows="4" readonly class="w-full p-2.5 bg-surface-container-low rounded-lg text-xs text-on-surface border border-border-subtle/40 focus:outline-none">${getMessage('delivery')}</textarea>
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
              <span class="font-bold text-sm text-on-surface block">${outlet.name}</span>
              <span class="text-slate-500">${outlet.address} • Wilayah: ${outlet.cityName}</span>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1">
                <label class="font-semibold text-on-surface-variant">Sales Dedikasi</label>
                <input type="text" readOnly value="${outlet.salesRep}" class="p-2 bg-surface-container-low rounded-lg text-xs font-semibold text-on-surface border border-border-subtle/50" />
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
              <span class="text-xs text-on-surface-variant">${outlet.name} (${outlet.code})</span>
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
                        <td class="p-2.5 font-mono font-semibold text-primary">${ord.clientUuid}</td>
                        <td class="p-2.5 text-slate-500">${ord.orderTime}</td>
                        <td class="p-2.5 font-semibold font-mono">${window.ArbaUtils.formatRupiah(ord.totalAmount)}</td>
                        <td class="p-2.5">${ord.terms}</td>
                        <td class="p-2.5 text-center">
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-success-bg text-status-success-text">
                            ${ord.status}
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
            onclick="window.ArbaApp.showToast('Mencetak rekening koran mitra ${window.ArbaUtils.escapeHtml(outlet.name)}', 'print'); window.print();"
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
