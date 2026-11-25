/**
 * ArbaConnect ERP - B2B CRM & Outlet Directory View
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
    var outlets = appState.outlets || [];
    var salesTeam = appState.salesTeam || [];
    var selectedOutletId = appState.selectedOutletId;

    var selectedOutlet = outlets.find(function (o) { return o.id === selectedOutletId; }) || outlets[0];

    var filteredOutlets = outlets.filter(function (outlet) {
      var q = state.searchQuery.toLowerCase();
      var matchesSearch =
        !q ||
        outlet.name.toLowerCase().indexOf(q) !== -1 ||
        outlet.code.toLowerCase().indexOf(q) !== -1 ||
        outlet.picName.toLowerCase().indexOf(q) !== -1 ||
        outlet.address.toLowerCase().indexOf(q) !== -1;

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

    // Live KPI computations
    var minimarketCount = outlets.filter(function (o) { return o.type === 'Minimarket'; }).length;
    var apotekCount = outlets.length - minimarketCount;
    var lancarCount = outlets.filter(function (o) { return o.creditStatus === 'Lancar'; }).length;
    var attentionCount = outlets.filter(function (o) { return o.creditStatus === 'Perhatian'; }).length;
    var overdueCount = outlets.filter(function (o) { return o.creditStatus === 'Overdue'; }).length;
    var creditHealthPct = outlets.length ? Math.round((lancarCount / outlets.length) * 1000) / 10 : 100;

    var activeRole = (appState.currentUser && appState.currentUser.role === 'super-admin')
      ? (appState.currentRole || 'super-admin')
      : (appState.currentUser ? appState.currentUser.role : 'executive');
    var isSalesRole = activeRole === 'field-sales';

    var routeReps = salesTeam.slice(0, 4);

    var html = `
      <div class="flex flex-col w-full gap-space-lg pb-space-xl">
        <!-- Page Header -->
        <div class="page-header">
          <div>
            <h1 class="page-title">Mitra Outlet</h1>
            <p class="page-meta">Direktori apotek, minimarket, kredit &amp; konsinyasi Solo Raya</p>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <button id="btn-crm-rebalancer" class="btn btn-outline" type="button">
              <span class="material-symbols-outlined text-[16px]">swap_horiz</span>
              <span>Mutasi Konsinyasi (${(window.ArbaStore.getConsignmentRebalanceRecommendations() || []).length})</span>
            </button>
            ${!isSalesRole ? `
              <button id="btn-crm-credit-score" class="btn btn-outline" type="button">
                <span class="material-symbols-outlined text-[16px]">analytics</span>
                <span>Skor Kredit</span>
              </button>
            ` : ''}
            <button id="btn-crm-tsp-map" class="btn btn-outline" type="button">
              <span class="material-symbols-outlined text-[16px]">route</span>
              <span>Peta Rute</span>
            </button>
            ${!isSalesRole ? `
              <button id="btn-import-crm-csv" class="btn btn-outline" type="button">
                <span class="material-symbols-outlined text-[16px]">upload_file</span>
                <span>Impor CSV</span>
              </button>
            ` : ''}
            <button id="btn-export-crm-csv" class="btn btn-outline" type="button">
              <span class="material-symbols-outlined text-[16px]">file_download</span>
              <span>Ekspor CSV</span>
            </button>
            <button id="btn-new-outlet" class="btn btn-primary" type="button">
              <span class="material-symbols-outlined text-[16px]">add_business</span>
              <span>Tambah Outlet</span>
            </button>
          </div>
        </div>

        <!-- Live KPI Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="kpi-card">
            <div>
              <div class="kpi-header">
                <span class="kpi-title">Outlet Terkelola</span>
                <span class="material-symbols-outlined text-primary text-[20px]">storefront</span>
              </div>
              <div class="kpi-value">${outlets.length} <span class="text-sm font-normal text-on-surface-variant">Outlet</span></div>
            </div>
            <div class="kpi-footer">
              <span class="text-emerald-700 font-semibold">${lancarCount} Kredit Lancar</span>
              <span class="text-on-surface-variant">${attentionCount + overdueCount} Perhatian</span>
            </div>
          </div>

          <div class="kpi-card">
            <div>
              <div class="kpi-header">
                <span class="kpi-title">Apotek &amp; Farmasi</span>
                <span class="material-symbols-outlined text-primary text-[20px]">medication</span>
              </div>
              <div class="kpi-value text-primary">${apotekCount} <span class="text-sm font-normal text-on-surface-variant">Apotek</span></div>
            </div>
            <div class="kpi-footer">
              <span class="text-on-surface-variant">Porsi Mitra</span>
              <span class="font-semibold text-primary">${outlets.length ? Math.round((apotekCount / outlets.length) * 100) : 0}%</span>
            </div>
          </div>

          <div class="kpi-card">
            <div>
              <div class="kpi-header">
                <span class="kpi-title">Minimarket &amp; Ritel</span>
                <span class="material-symbols-outlined text-on-surface-variant text-[20px]">shopping_cart</span>
              </div>
              <div class="kpi-value">${minimarketCount} <span class="text-sm font-normal text-on-surface-variant">Toko</span></div>
            </div>
            <div class="kpi-footer">
              <span class="text-on-surface-variant">Porsi Mitra</span>
              <span class="font-semibold text-on-surface">${outlets.length ? Math.round((minimarketCount / outlets.length) * 100) : 0}%</span>
            </div>
          </div>

          <div class="kpi-card">
            <div>
              <div class="kpi-header">
                <span class="kpi-title">Kesehatan Kredit</span>
                <span class="material-symbols-outlined text-emerald-700 text-[20px]">verified_user</span>
              </div>
              <div class="kpi-value text-emerald-700">${creditHealthPct}%</div>
            </div>
            <div class="kpi-footer">
              <span class="text-amber-700 font-medium">${attentionCount} Perhatian</span>
              <span class="text-rose-600 font-semibold">${overdueCount} Overdue</span>
            </div>
          </div>
        </div>

        <!-- Search & Filters -->
        <div class="section-card flex flex-col gap-3">
          <div class="grid grid-cols-1 md:grid-cols-12 gap-2.5">
            <div class="md:col-span-5 relative flex items-center">
              <span class="material-symbols-outlined absolute left-3 text-on-surface-variant text-[18px] pointer-events-none">search</span>
              <input
                id="crm-search-input"
                value="${window.ArbaUtils.escapeHtml(state.searchQuery)}"
                class="form-input pl-9"
                placeholder="Cari outlet, kode, atau PIC..."
                type="text"
              />
            </div>

            <div class="md:col-span-3">
              <select id="crm-region-select" class="form-select">
                <option value="ALL" ${state.selectedRegion === 'ALL' ? 'selected' : ''}>Semua Kota</option>
                <option value="Solo" ${state.selectedRegion === 'Solo' ? 'selected' : ''}>Surakarta / Solo</option>
                <option value="Sukoharjo" ${state.selectedRegion === 'Sukoharjo' ? 'selected' : ''}>Sukoharjo</option>
                <option value="Karanganyar" ${state.selectedRegion === 'Karanganyar' ? 'selected' : ''}>Karanganyar</option>
                <option value="Klaten" ${state.selectedRegion === 'Klaten' ? 'selected' : ''}>Klaten</option>
                <option value="Boyolali" ${state.selectedRegion === 'Boyolali' ? 'selected' : ''}>Boyolali</option>
                <option value="Sragen" ${state.selectedRegion === 'Sragen' ? 'selected' : ''}>Sragen</option>
              </select>
            </div>

            <div class="md:col-span-2">
              <select id="crm-type-select" class="form-select">
                <option value="ALL" ${state.selectedType === 'ALL' ? 'selected' : ''}>Semua Tipe</option>
                <option value="Apotek Mandiri" ${state.selectedType === 'Apotek Mandiri' ? 'selected' : ''}>Apotek Mandiri</option>
                <option value="Jaringan Farmasi" ${state.selectedType === 'Jaringan Farmasi' ? 'selected' : ''}>Jaringan Farmasi</option>
                <option value="Minimarket" ${state.selectedType === 'Minimarket' ? 'selected' : ''}>Minimarket</option>
              </select>
            </div>

            <div class="md:col-span-2">
              <select id="crm-credit-select" class="form-select">
                <option value="ALL" ${state.selectedCredit === 'ALL' ? 'selected' : ''}>Semua Kredit</option>
                <option value="Lancar" ${state.selectedCredit === 'Lancar' ? 'selected' : ''}>Lancar</option>
                <option value="Perhatian" ${state.selectedCredit === 'Perhatian' ? 'selected' : ''}>Perhatian</option>
                <option value="Overdue" ${state.selectedCredit === 'Overdue' ? 'selected' : ''}>Overdue</option>
              </select>
            </div>
          </div>

          <div class="flex items-center justify-between flex-wrap gap-2 pt-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-xs text-on-surface-variant font-semibold mr-1">Sales:</span>
              <button
                class="btn-route-chip btn btn-sm ${state.activeRouteFilter === 'all' ? 'btn-primary' : 'btn-outline'}"
                data-route="all"
                type="button"
              >Semua</button>
              ${routeReps.map(function (rep) {
                var key = rep.name.split(' ')[0];
                var isSelected = state.activeRouteFilter === key;
                return `
                  <button
                    class="btn-route-chip btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline'}"
                    data-route="${window.ArbaUtils.escapeHtml(key)}"
                    type="button"
                  >
                    ${window.ArbaUtils.escapeHtml(rep.name)}
                  </button>
                `;
              }).join('')}
            </div>
            <div class="text-xs font-mono text-on-surface-variant">
              ${filteredOutlets.length} dari ${outlets.length} outlet
            </div>
          </div>
        </div>

        <!-- Main Directory Table & Detail Pane -->
        <div class="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          <div class="xl:col-span-8 section-card p-0 overflow-hidden flex flex-col">
            <div class="table-container border-0 rounded-none">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Outlet</th>
                    <th>Tipe</th>
                    <th>PIC</th>
                    <th>Kota</th>
                    <th>Termin</th>
                    <th>Plafon &amp; Sisa</th>
                    <th>Sales</th>
                    <th class="text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  ${paginatedOutlets.length === 0 ? `
                    <tr><td colspan="8" class="text-center text-on-surface-variant py-6">Tidak ada outlet yang cocok.</td></tr>
                  ` : paginatedOutlets.map(function (outlet) {
                    var isSelected = outlet.id === selectedOutletId;
                    var pRemaining = outlet.creditLimit ? Math.round((outlet.creditRemaining / outlet.creditLimit) * 100) : 0;

                    return `
                      <tr class="crm-outlet-row cursor-pointer ${isSelected ? 'bg-surface-container' : ''}" data-outlet-id="${outlet.id}">
                        <td>
                          <div class="font-mono text-[11px] text-primary font-semibold">${window.ArbaUtils.escapeHtml(outlet.code)}</div>
                          <div class="font-semibold text-on-surface">${window.ArbaUtils.escapeHtml(outlet.name)}</div>
                          <div class="text-[11px] text-on-surface-variant truncate max-w-xs">${window.ArbaUtils.escapeHtml(outlet.address)}</div>
                        </td>
                        <td>
                          <span class="badge ${outlet.type === 'Minimarket' ? 'badge-neutral' : 'badge-primary'}">
                            ${outlet.type === 'Minimarket' ? 'Minimarket' : 'Apotek'}
                          </span>
                        </td>
                        <td>
                          <div class="font-medium text-on-surface">${window.ArbaUtils.escapeHtml(outlet.picName)}</div>
                          <a
                            href="https://wa.me/${outlet.picPhone}"
                            target="_blank"
                            rel="noreferrer"
                            class="text-primary hover:underline flex items-center gap-1 mt-0.5 text-[11px]"
                            onclick="event.stopPropagation()"
                          >
                            ${window.ArbaUtils.escapeHtml(outlet.picPhone.replace(/^62/, '0'))}
                          </a>
                        </td>
                        <td>${window.ArbaUtils.escapeHtml(outlet.cityName)}</td>
                        <td><span class="badge badge-neutral">${window.ArbaUtils.escapeHtml(outlet.terms)}</span></td>
                        <td>
                          <div class="font-mono font-semibold text-on-surface">${window.ArbaUtils.formatRupiah(outlet.creditLimit)}</div>
                          <div class="text-[11px] ${outlet.creditStatus === 'Overdue' ? 'text-rose-600 font-bold' : outlet.creditStatus === 'Perhatian' ? 'text-amber-700 font-semibold' : 'text-emerald-700'}">
                            Sisa ${pRemaining}%
                          </div>
                        </td>
                        <td>
                          <div class="font-semibold text-on-surface">${window.ArbaUtils.escapeHtml(outlet.salesRep)}</div>
                          <div class="text-[11px] text-on-surface-variant">${window.ArbaUtils.escapeHtml(outlet.salesArea)}</div>
                        </td>
                        <td class="text-right whitespace-nowrap">
                          <div class="flex items-center justify-end gap-1">
                            <button class="btn-outlet-history icon-btn" title="Riwayat Faktur" data-outlet-id="${outlet.id}" type="button" onclick="event.stopPropagation()">
                              <span class="material-symbols-outlined text-[18px]">receipt_long</span>
                            </button>
                            <button class="btn-outlet-visit icon-btn" title="Jadwal Kunjungan" data-outlet-id="${outlet.id}" type="button" onclick="event.stopPropagation()">
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

            <div class="px-4 py-3 bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-border-subtle text-xs text-on-surface-variant">
              <span>Menampilkan ${paginatedOutlets.length} dari ${filteredOutlets.length} outlet (Hal ${state.crmPage}/${totalCrmPages})</span>
              <div class="flex items-center gap-1">
                <button id="btn-crm-prev" class="btn btn-sm btn-outline ${state.crmPage <= 1 ? 'opacity-40' : ''}" type="button">
                  <span class="material-symbols-outlined text-[16px]">chevron_left</span>
                </button>
                ${Array.from({ length: totalCrmPages }, function (_, idx) {
                  var pNum = idx + 1;
                  var active = pNum === state.crmPage;
                  return `<button type="button" class="btn-crm-page btn btn-sm ${active ? 'btn-primary' : 'btn-outline'}" data-page="${pNum}">${pNum}</button>`;
                }).join('')}
                <button id="btn-crm-next" class="btn btn-sm btn-outline ${state.crmPage >= totalCrmPages ? 'opacity-40' : ''}" type="button">
                  <span class="material-symbols-outlined text-[16px]">chevron_right</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Outlet Detail Drawer -->
          <div class="xl:col-span-4 flex flex-col gap-4">
            ${selectedOutlet ? `
              <div class="section-card flex flex-col gap-4">
                <div>
                  <div class="flex items-center justify-between gap-2">
                    <span class="badge badge-primary font-mono">${window.ArbaUtils.escapeHtml(selectedOutlet.code)}</span>
                    <span class="badge ${selectedOutlet.creditStatus === 'Overdue' ? 'badge-danger' : selectedOutlet.creditStatus === 'Perhatian' ? 'badge-warning' : 'badge-success'}">
                      ${window.ArbaUtils.escapeHtml(selectedOutlet.creditStatus)}
                    </span>
                  </div>
                  <h2 class="text-lg font-bold text-on-surface mt-2">${window.ArbaUtils.escapeHtml(selectedOutlet.name)}</h2>
                  <p class="text-xs text-on-surface-variant">${window.ArbaUtils.escapeHtml(selectedOutlet.address)}, ${window.ArbaUtils.escapeHtml(selectedOutlet.cityName)}</p>
                </div>

                <div class="p-3 rounded-lg bg-surface-container-low border border-border-subtle/50 flex items-center justify-between text-xs">
                  <span class="text-on-surface-variant font-semibold">Omset YTD</span>
                  <span class="font-mono font-bold text-primary text-sm">${window.ArbaUtils.formatRupiah(selectedOutlet.ytdTotal)}</span>
                </div>

                ${(function () {
                  var aiSc = window.ArbaStore.getOutletCreditScoring ? window.ArbaStore.getOutletCreditScoring(selectedOutlet.id) : null;
                  if (!aiSc) return '';
                  return `
                    <div class="p-3 rounded-lg border text-xs" style="background:${aiSc.badgeBg}; border-color:${aiSc.badgeColor}40;">
                      <div class="flex items-center justify-between mb-1">
                        <span class="font-bold" style="color:${aiSc.badgeColor};">Skor Kredit: ${aiSc.score}/100</span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/80" style="color:${aiSc.badgeColor};">${aiSc.tier}</span>
                      </div>
                      <div class="text-[11px] text-slate-700 ${isSalesRole ? '' : 'mb-2'}">${aiSc.recommendation}</div>
                      ${!isSalesRole ? `
                        <button id="btn-drawer-apply-ai-credit" type="button" class="btn btn-sm w-full text-white border-0" style="background:${aiSc.badgeColor};">
                          Terapkan Plafon (${window.ArbaUtils.formatRupiah(aiSc.suggestedLimit)})
                        </button>
                      ` : ''}
                    </div>
                  `;
                })()}

                <div class="space-y-2 text-xs">
                  <div class="flex justify-between">
                    <span class="text-on-surface-variant">Plafon Kredit</span>
                    <span class="font-mono font-semibold text-on-surface">${window.ArbaUtils.formatRupiah(selectedOutlet.creditLimit)}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-on-surface-variant">Terpakai</span>
                    <span class="font-mono font-semibold text-amber-700">${window.ArbaUtils.formatRupiah(selectedOutlet.creditUsed)}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-on-surface-variant">Sisa Plafon</span>
                    <span class="font-mono font-semibold text-emerald-700">${window.ArbaUtils.formatRupiah(selectedOutlet.creditRemaining)}</span>
                  </div>
                  <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${selectedOutlet.creditLimit ? Math.round((selectedOutlet.creditUsed / selectedOutlet.creditLimit) * 100) : 0}%;"></div>
                  </div>
                </div>

                <div class="p-3 rounded-lg bg-surface-container-low border border-border-subtle/50 text-xs space-y-1">
                  <div class="font-semibold text-on-surface">${window.ArbaUtils.escapeHtml(selectedOutlet.picName)}</div>
                  <div class="text-on-surface-variant">${window.ArbaUtils.escapeHtml(selectedOutlet.picRole)} · Sales: ${window.ArbaUtils.escapeHtml(selectedOutlet.salesRep)}</div>
                  ${selectedOutlet.lastOrderDate ? `<div class="text-on-surface-variant">Order terakhir: ${window.ArbaUtils.escapeHtml(selectedOutlet.lastOrderDate)}</div>` : ''}
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <button id="btn-drawer-whatsapp" class="btn btn-outline" type="button">
                    <span class="material-symbols-outlined text-[16px]">chat</span>
                    <span>WhatsApp</span>
                  </button>
                  <button id="btn-drawer-visit" class="btn btn-primary" type="button">
                    <span class="material-symbols-outlined text-[16px]">add_task</span>
                    <span>Kunjungan</span>
                  </button>
                  <button id="btn-drawer-history" class="btn btn-outline" type="button">
                    <span class="material-symbols-outlined text-[16px]">receipt_long</span>
                    <span>Riwayat</span>
                  </button>
                  <button id="btn-drawer-pwa" class="btn btn-secondary" type="button">
                    <span class="material-symbols-outlined text-[16px]">point_of_sale</span>
                    <span>Buat Order</span>
                  </button>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
    bindEvents(container, selectedOutlet);
  }

  function bindEvents(container, selectedOutlet) {
    var btnImportCsv = container.querySelector('#btn-import-crm-csv');
    if (btnImportCsv) btnImportCsv.addEventListener('click', openImportOutletsModal);

    var btnCsv = container.querySelector('#btn-export-crm-csv');
    if (btnCsv) {
      btnCsv.addEventListener('click', function () {
        var outlets = window.ArbaStore.getState().outlets;
        window.ArbaUtils.exportCrmToCsv(outlets);
        window.ArbaApp.showToast('Data outlet (.CSV) berhasil diunduh', 'file_download');
      });
    }

    var btnNew = container.querySelector('#btn-new-outlet');
    if (btnNew) btnNew.addEventListener('click', openNewOutletModal);

    var btnRebalancer = container.querySelector('#btn-crm-rebalancer');
    if (btnRebalancer && window.ArbaAdvanced) {
      btnRebalancer.addEventListener('click', window.ArbaAdvanced.openConsignmentRebalancerModal);
    }

    var btnCreditScore = container.querySelector('#btn-crm-credit-score');
    if (btnCreditScore && window.ArbaAdvanced) {
      btnCreditScore.addEventListener('click', window.ArbaAdvanced.openCreditScoringModal);
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

    var searchInput = container.querySelector('#crm-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', function (e) {
        state.searchQuery = e.target.value;
        state.crmPage = 1;
        renderB2bCrm(container);
        var inputNow = container.querySelector('#crm-search-input');
        if (inputNow) {
          inputNow.focus();
          inputNow.setSelectionRange(inputNow.value.length, inputNow.value.length);
        }
      });
    }

    var regionSelect = container.querySelector('#crm-region-select');
    if (regionSelect) {
      regionSelect.addEventListener('change', function (e) {
        state.selectedRegion = e.target.value;
        state.crmPage = 1;
        renderB2bCrm(container);
      });
    }

    var typeSelect = container.querySelector('#crm-type-select');
    if (typeSelect) {
      typeSelect.addEventListener('change', function (e) {
        state.selectedType = e.target.value;
        state.crmPage = 1;
        renderB2bCrm(container);
      });
    }

    var creditSelect = container.querySelector('#crm-credit-select');
    if (creditSelect) {
      creditSelect.addEventListener('change', function (e) {
        state.selectedCredit = e.target.value;
        state.crmPage = 1;
        renderB2bCrm(container);
      });
    }

    container.querySelectorAll('.btn-route-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        state.activeRouteFilter = chip.getAttribute('data-route');
        state.crmPage = 1;
        renderB2bCrm(container);
      });
    });

    container.querySelectorAll('.crm-outlet-row').forEach(function (row) {
      row.addEventListener('click', function () {
        window.ArbaStore.setSelectedOutletId(row.getAttribute('data-outlet-id'));
      });
    });

    container.querySelectorAll('.btn-outlet-history').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var outlet = window.ArbaStore.getState().outlets.find(function (o) { return o.id === btn.getAttribute('data-outlet-id'); });
        if (outlet) openHistoryModal(outlet);
      });
    });

    container.querySelectorAll('.btn-outlet-visit').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var outlet = window.ArbaStore.getState().outlets.find(function (o) { return o.id === btn.getAttribute('data-outlet-id'); });
        if (outlet) openVisitModal(outlet);
      });
    });

    if (selectedOutlet) {
      var btnWa = container.querySelector('#btn-drawer-whatsapp');
      if (btnWa) btnWa.addEventListener('click', function () { openWhatsAppModal(selectedOutlet); });

      var btnDrawerVisit = container.querySelector('#btn-drawer-visit');
      if (btnDrawerVisit) btnDrawerVisit.addEventListener('click', function () { openVisitModal(selectedOutlet); });

      var btnDrawerHist = container.querySelector('#btn-drawer-history');
      if (btnDrawerHist) btnDrawerHist.addEventListener('click', function () { openHistoryModal(selectedOutlet); });

      var btnDrawerPwa = container.querySelector('#btn-drawer-pwa');
      if (btnDrawerPwa) {
        btnDrawerPwa.addEventListener('click', function () {
          window.ArbaStore.setSelectedOutletId(selectedOutlet.id);
          window.ArbaApp.navigate('field-sales-pwa-preview');
        });
      }
    }

    var crmPrev = container.querySelector('#btn-crm-prev');
    var crmNext = container.querySelector('#btn-crm-next');
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
    container.querySelectorAll('.btn-crm-page').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.crmPage = Number(btn.getAttribute('data-page')) || 1;
        renderB2bCrm(container);
      });
    });
  }

  function openImportOutletsModal() {
    var sampleCsv = [
      'kode_outlet,nama_outlet,tipe,kota,alamat,nama_pic,telepon_pic,sales_rep,termin,limit_kredit,omset_ytd',
      'AP-SLO-190,Apotek Muhamadiyah Pabelan UMS,Apotek Mandiri,Solo,"Jl. Ahmad Yani No. 157, Pabelan",apt. Siti Aminah S.Farm,6281329001122,Budi Santoso,Net 30 Hari,12000000,18500000',
      'MM-SKH-191,Swalayan Assalaam Hypermarket,Minimarket,Sukoharjo,"Jl. Ahmad Yani KM 6, Kartasura",H. Agus Santoso,6281228003344,Tri Wahyuni,Net 14 Hari,25000000,42000000'
    ].join('\n');

    var modalHtml = `
      <div class="modal-dialog max-w-2xl">
        <div class="modal-header">
          <h3 class="modal-title">Impor Outlet (.CSV)</h3>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()" type="button">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div class="modal-body text-xs space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2 bg-surface-container-low p-3 rounded-lg border border-border-subtle/50">
            <code class="font-mono text-primary text-[11px]">kode_outlet, nama_outlet, tipe, kota, alamat, nama_pic, telepon_pic, sales_rep, termin, limit_kredit</code>
            <button type="button" id="btn-download-outlet-template" class="btn btn-sm btn-outline">Unduh Template</button>
          </div>
          <div class="form-group">
            <label class="form-label">Berkas CSV</label>
            <input type="file" id="input-outlet-csv-file" accept=".csv,text/csv" class="form-input" />
          </div>
          <div class="form-group">
            <label class="form-label">Data CSV</label>
            <textarea id="textarea-outlet-csv" rows="6" class="form-textarea font-mono text-[11px]">${sampleCsv}</textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="window.ArbaApp.closeModal()">Batal</button>
          <button type="button" id="btn-exec-outlet-import" class="btn btn-primary">Impor</button>
        </div>
      </div>
    `;

    window.ArbaApp.openModal(modalHtml);

    setTimeout(function () {
      var btnDl = document.getElementById('btn-download-outlet-template');
      var fileInput = document.getElementById('input-outlet-csv-file');
      var txtArea = document.getElementById('textarea-outlet-csv');
      var btnExec = document.getElementById('btn-exec-outlet-import');

      if (btnDl) btnDl.onclick = function () { window.ArbaUtils.downloadCsv('Template_Outlet_ArbaConnect.csv', sampleCsv); };
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
          window.ArbaStore.importOutlets(rows);
          window.ArbaApp.closeModal();
        };
      }
    }, 30);
  }

  function openNewOutletModal() {
    var outlets = window.ArbaStore.getState().outlets;
    var salesTeam = window.ArbaStore.getState().salesTeam || [];
    var autoCode = 'AP-SLO-' + String(168 + outlets.length + 1).padStart(3, '0');

    var modalHtml = `
      <div class="modal-dialog max-w-2xl">
        <div class="modal-header">
          <h3 class="modal-title">Tambah Outlet Baru</h3>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()" type="button">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form id="form-new-outlet">
          <div class="modal-body text-xs">
            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Kode Outlet</label>
                <input readOnly type="text" value="${autoCode}" class="form-input font-mono cursor-not-allowed" />
              </div>
              <div class="form-group">
                <label class="form-label">Tipe Outlet *</label>
                <select id="new-type" required class="form-select">
                  <option value="Apotek Mandiri">Apotek Mandiri</option>
                  <option value="Jaringan Farmasi">Jaringan Farmasi</option>
                  <option value="Minimarket">Minimarket</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Nama Outlet *</label>
              <input id="new-name" required type="text" placeholder="Nama apotek atau toko" class="form-input" />
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Penanggung Jawab *</label>
                <input id="new-pic" required type="text" placeholder="Nama apoteker / PIC" class="form-input" />
              </div>
              <div class="form-group">
                <label class="form-label">No. WhatsApp *</label>
                <input id="new-phone" required type="tel" placeholder="08xxxxxxxxxx" class="form-input" />
              </div>
              <div class="form-group">
                <label class="form-label">Kota / Kabupaten *</label>
                <select id="new-city" required class="form-select">
                  <option value="Solo">Surakarta / Solo</option>
                  <option value="Sukoharjo">Sukoharjo</option>
                  <option value="Karanganyar">Karanganyar</option>
                  <option value="Klaten">Klaten</option>
                  <option value="Boyolali">Boyolali</option>
                  <option value="Sragen">Sragen</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Sales Rep *</label>
                <select id="new-sales" required class="form-select">
                  ${salesTeam.map(function (s) {
                    return `<option value="${s.name}">${s.name} (${s.area})</option>`;
                  }).join('')}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Alamat *</label>
              <textarea id="new-address" required rows="2" placeholder="Alamat lengkap" class="form-textarea"></textarea>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Termin Pembayaran *</label>
                <select id="new-terms" required class="form-select">
                  <option value="Net 30 Hari">Net 30 Hari</option>
                  <option value="Net 14 Hari">Net 14 Hari</option>
                  <option value="COD Cash">COD Cash</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Plafon Kredit (IDR)</label>
                <input id="new-limit" type="number" value="10000000" class="form-input font-mono font-bold" />
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

  function openWhatsAppModal(outlet) {
    function getMessage(tpl) {
      if (tpl === 'delivery') {
        return `Halo ${outlet.picName}, pesanan CV Arba'in untuk ${outlet.name} siap dikirim hari ini.`;
      }
      if (tpl === 'invoice') {
        return `Halo ${outlet.picName}, pengingat faktur ${outlet.terms} untuk ${outlet.name}. Pemakaian kredit: ${window.ArbaUtils.formatRupiah(outlet.creditUsed)}.`;
      }
      return `Halo ${outlet.picName}, penawaran bundling CV Arba'in tersedia untuk ${outlet.name}.`;
    }

    var modalHtml = `
      <div class="modal-dialog max-w-lg">
        <div class="modal-header">
          <h3 class="modal-title">Pesan WhatsApp PIC</h3>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()" type="button">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div class="modal-body text-xs space-y-3">
          <div class="bg-surface-container-low p-3 rounded-lg">
            <div class="font-bold text-sm text-on-surface">${window.ArbaUtils.escapeHtml(outlet.picName)}</div>
            <div class="text-xs text-on-surface-variant font-mono">${window.ArbaUtils.escapeHtml(outlet.picPhone)} · ${window.ArbaUtils.escapeHtml(outlet.name)}</div>
          </div>

          <div class="grid grid-cols-3 gap-2">
            <button id="wa-tpl-delivery" type="button" class="btn btn-sm btn-primary">Jadwal Kirim</button>
            <button id="wa-tpl-invoice" type="button" class="btn btn-sm btn-outline">Tagihan</button>
            <button id="wa-tpl-promo" type="button" class="btn btn-sm btn-outline">Promo</button>
          </div>

          <div class="form-group">
            <label class="form-label">Pesan</label>
            <textarea id="wa-msg-preview" rows="4" class="form-textarea">${getMessage('delivery')}</textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button onclick="window.ArbaApp.closeModal()" class="btn btn-outline" type="button">Batal</button>
          <button id="btn-send-wa" class="btn btn-primary" type="button">Buka WhatsApp</button>
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
        preview.value = getMessage(tpl);
        [btnDeliv, btnInv, btnPromo].forEach(function (b) { b.className = 'btn btn-sm btn-outline'; });
        if (tpl === 'delivery') btnDeliv.className = 'btn btn-sm btn-primary';
        if (tpl === 'invoice') btnInv.className = 'btn btn-sm btn-primary';
        if (tpl === 'promo') btnPromo.className = 'btn btn-sm btn-primary';
      }

      if (btnDeliv) btnDeliv.onclick = function () { setTemplate('delivery'); };
      if (btnInv) btnInv.onclick = function () { setTemplate('invoice'); };
      if (btnPromo) btnPromo.onclick = function () { setTemplate('promo'); };

      if (btnSend) {
        btnSend.onclick = function () {
          var cleanPhone = outlet.picPhone.replace(/\D/g, '');
          window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(preview.value)}`, '_blank');
          window.ArbaApp.closeModal();
        };
      }
    }, 50);
  }

  function openVisitModal(outlet) {
    var modalHtml = `
      <div class="modal-dialog max-w-lg">
        <div class="modal-header">
          <h3 class="modal-title">Jadwalkan Kunjungan</h3>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()" type="button">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form id="form-schedule-visit">
          <div class="modal-body text-xs">
            <div class="bg-surface-container-low p-3 rounded-lg space-y-1">
              <div class="font-bold text-sm text-on-surface">${window.ArbaUtils.escapeHtml(outlet.name)}</div>
              <div class="text-on-surface-variant">${window.ArbaUtils.escapeHtml(outlet.address)} · ${window.ArbaUtils.escapeHtml(outlet.cityName)}</div>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Sales Rep</label>
                <input type="text" readOnly value="${window.ArbaUtils.escapeHtml(outlet.salesRep)}" class="form-input font-semibold" />
              </div>
              <div class="form-group">
                <label class="form-label">Tujuan</label>
                <select id="visit-purpose" class="form-select">
                  <option value="Kunjungan Rutin">Kunjungan Rutin</option>
                  <option value="Penagihan Tempo">Penagihan Tempo</option>
                  <option value="Promosi Bundling">Promosi Bundling</option>
                  <option value="Follow Up At-Risk">Follow Up</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Waktu Kunjungan *</label>
              <input id="visit-date" type="datetime-local" required value="2026-04-02T10:00" class="form-input" />
            </div>

            <div class="form-group">
              <label class="form-label">Catatan *</label>
              <textarea id="visit-notes" rows="2" required class="form-textarea">Cek display dan ambil order</textarea>
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

  function openHistoryModal(outlet) {
    var orders = window.ArbaStore.getState().orders;
    var outletOrders = orders.filter(function (o) {
      return o.outletName.toLowerCase().indexOf(outlet.name.toLowerCase()) !== -1 ||
             o.outletId === outlet.code || o.outletId === outlet.id;
    });

    var modalHtml = `
      <div class="modal-dialog max-w-2xl">
        <div class="modal-header">
          <div>
            <h3 class="modal-title">Riwayat Transaksi</h3>
            <span class="text-xs text-on-surface-variant">${window.ArbaUtils.escapeHtml(outlet.name)} (${window.ArbaUtils.escapeHtml(outlet.code)})</span>
          </div>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()" type="button">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div class="modal-body text-xs">
          <div class="grid grid-cols-3 gap-3 p-3 bg-surface-container-low rounded-xl text-center">
            <div>
              <span class="text-[11px] text-on-surface-variant block uppercase font-medium">Plafon</span>
              <span class="font-bold text-sm text-on-surface font-mono">${window.ArbaUtils.formatRupiah(outlet.creditLimit)}</span>
            </div>
            <div>
              <span class="text-[11px] text-on-surface-variant block uppercase font-medium">Terpakai</span>
              <span class="font-bold text-sm text-amber-700 font-mono">${window.ArbaUtils.formatRupiah(outlet.creditUsed)}</span>
            </div>
            <div>
              <span class="text-[11px] text-on-surface-variant block uppercase font-medium">Sisa</span>
              <span class="font-bold text-sm text-emerald-700 font-mono">${window.ArbaUtils.formatRupiah(outlet.creditRemaining)}</span>
            </div>
          </div>

          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Faktur</th>
                  <th>Waktu</th>
                  <th class="text-right">Total</th>
                  <th>Termin</th>
                  <th class="text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                ${outletOrders.map(function (ord) {
                  return `
                    <tr>
                      <td class="font-mono font-semibold text-primary">${window.ArbaUtils.escapeHtml(ord.clientUuid)}</td>
                      <td class="text-on-surface-variant">${window.ArbaUtils.escapeHtml(ord.orderTime)}</td>
                      <td class="text-right font-semibold font-mono">${window.ArbaUtils.formatRupiah(ord.totalAmount)}</td>
                      <td>${window.ArbaUtils.escapeHtml(ord.terms)}</td>
                      <td class="text-center"><span class="badge badge-success">${window.ArbaUtils.escapeHtml(ord.status)}</span></td>
                    </tr>
                  `;
                }).join('')}
                ${outletOrders.length === 0 ? `
                  <tr><td colspan="5" class="p-4 text-center text-on-surface-variant">Belum ada transaksi.</td></tr>
                ` : ''}
              </tbody>
            </table>
          </div>
        </div>

        <div class="modal-footer">
          <button onclick="window.ArbaApp.closeModal()" class="btn btn-outline" type="button">Tutup</button>
          <button type="button" onclick="window.print();" class="btn btn-primary">
            <span class="material-symbols-outlined text-[16px]">print</span>
            <span>Cetak</span>
          </button>
        </div>
      </div>
    `;

    window.ArbaApp.openModal(modalHtml);
  }

  window.ArbaViews.renderB2bCrm = renderB2bCrm;
})();
