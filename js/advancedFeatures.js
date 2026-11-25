/**
 * ArbaConnect ERP - Operational Modals (QR Batch, Consignment Transfer, Route Map, Credit Score, Ledger Audit)
 */

(function () {
  'use strict';

  var activeCameraStream = null;

  function stopActiveCamera() {
    if (activeCameraStream) {
      try {
        activeCameraStream.getTracks().forEach(function (t) { t.stop(); });
      } catch (e) {}
      activeCameraStream = null;
    }
  }

  function generateQrSvg(text, size) {
    size = size || 128;
    var grid = 21;
    var matrix = [];
    for (var r = 0; r < grid; r++) {
      matrix[r] = [];
      for (var c = 0; c < grid; c++) {
        matrix[r][c] = 0;
      }
    }

    function drawFinder(rowOffset, colOffset) {
      for (var r = 0; r < 7; r++) {
        for (var c = 0; c < 7; c++) {
          if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
            matrix[rowOffset + r][colOffset + c] = 1;
          } else {
            matrix[rowOffset + r][colOffset + c] = 2;
          }
        }
      }
    }

    drawFinder(0, 0);
    drawFinder(0, grid - 7);
    drawFinder(grid - 7, 0);

    for (var i = 8; i < grid - 8; i++) {
      matrix[6][i] = i % 2 === 0 ? 1 : 2;
      matrix[i][6] = i % 2 === 0 ? 1 : 2;
    }

    var str = String(text || 'ARBACONNECT-FEFO');
    var seed = 2166136261;
    for (var k = 0; k < str.length; k++) {
      seed ^= str.charCodeAt(k);
      seed = Math.imul(seed, 16777619) >>> 0;
    }

    for (var rr = 0; rr < grid; rr++) {
      for (var cc = 0; cc < grid; cc++) {
        if (matrix[rr][cc] !== 0) continue;
        if ((rr < 8 && cc < 8) || (rr < 8 && cc >= grid - 8) || (rr >= grid - 8 && cc < 8)) continue;
        seed ^= (rr * 31 + cc * 17 + str.charCodeAt((rr + cc) % str.length));
        seed = Math.imul(seed, 1664525) + 1013904223;
        seed = seed >>> 0;
        matrix[rr][cc] = (seed & 3) !== 0 ? 1 : 0;
      }
    }

    var rects = '';
    for (var y = 0; y < grid; y++) {
      for (var x = 0; x < grid; x++) {
        if (matrix[y][x] === 1) {
          rects += '<rect x="' + (x + 2) + '" y="' + (y + 2) + '" width="1" height="1" fill="#0f172a"/>';
        }
      }
    }

    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (grid + 4) + ' ' + (grid + 4) + '" width="' + size + '" height="' + size + '" shape-rendering="crispEdges" style="background:#ffffff; border-radius:8px; border:1px solid #cbd5e1;">' +
      '<rect width="100%" height="100%" fill="#ffffff"/>' +
      rects +
      '</svg>'
    );
  }

  // 1. QR Batch Scanner & Label Printer
  function openQrBatchModal(options) {
    options = options || {};
    var st = window.ArbaStore.getState();
    var products = st.products || [];
    var initialTab = options.initialTab || 'scanner';
    var selectedSku = options.initialSku || (products[0] && products[0].sku) || 'SKU-ARB-MDR500';

    function renderModalContent(activeTab, scannedProd) {
      var html = `
        <div class="modal-dialog p-6" style="max-width: 780px; width: 95vw;">
          <div class="flex items-start justify-between gap-4 pb-4 border-b border-border-subtle">
            <h3 class="modal-title">QR Batch Produk</h3>
            <button id="qr-modal-close" class="icon-btn" type="button" title="Tutup">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>

          <div class="flex items-center gap-2 my-4 bg-surface-container-low p-1 rounded-xl border border-border-subtle">
            <button id="qr-tab-scanner" type="button" class="flex-1 py-2 px-3 rounded-lg text-xs font-bold cursor-pointer border-0 ${activeTab === 'scanner' ? 'bg-primary text-white' : 'bg-transparent text-on-surface-variant'}">
              Pindai Kamera
            </button>
            <button id="qr-tab-labels" type="button" class="flex-1 py-2 px-3 rounded-lg text-xs font-bold cursor-pointer border-0 ${activeTab === 'labels' ? 'bg-primary text-white' : 'bg-transparent text-on-surface-variant'}">
              Label Batch (${products.length})
            </button>
          </div>

          ${activeTab === 'scanner' ? `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="rounded-xl border border-border-subtle bg-slate-950 text-white p-4 flex flex-col justify-between" style="min-height: 260px;">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-mono text-emerald-400">Kamera QR</span>
                  <button id="qr-start-camera-btn" type="button" class="btn btn-sm btn-primary">Aktifkan Kamera</button>
                </div>

                <div class="my-3 relative flex items-center justify-center rounded-lg overflow-hidden border border-emerald-500/40" style="height: 170px; background: #020617;">
                  <video id="qr-camera-video" autoplay playsinline muted style="width:100%; height:100%; object-fit:cover; display:none;"></video>
                  <div id="qr-viewfinder-placeholder" class="text-center p-4">
                    <span class="material-symbols-outlined text-[42px] text-emerald-400 mb-1">qr_code_scanner</span>
                    <div class="text-xs text-slate-300">Arahkan kamera ke label QR batch</div>
                  </div>
                </div>

                <div class="text-[11px] text-slate-400">Format: ARBA|SKU|BATCH|EXP</div>
              </div>

              <div class="flex flex-col justify-between gap-3">
                <div class="rounded-xl border border-border-subtle bg-surface-container-low p-3">
                  <div class="text-xs font-bold text-on-surface mb-2">Pilih Batch Produk</div>
                  <div class="grid grid-cols-1 gap-1.5 max-h-44 overflow-y-auto pr-1">
                    ${products.map(function (p) {
                      var isSelected = scannedProd && scannedProd.sku === p.sku;
                      return `
                        <button
                          type="button"
                          class="qr-sim-scan-btn flex items-center justify-between p-2 rounded-lg text-left text-xs cursor-pointer border ${
                            isSelected ? 'bg-primary/10 border-primary text-primary font-bold' : 'bg-surface border-border-subtle text-on-surface'
                          }"
                          data-sku="${p.sku}"
                        >
                          <div class="truncate pr-2">
                            <div class="font-semibold truncate">${window.ArbaUtils.escapeHtml(p.name)}</div>
                            <div class="text-[10px] font-mono text-on-surface-variant">${window.ArbaUtils.escapeHtml(p.sku)} · ${window.ArbaUtils.escapeHtml(p.activeBatch)}</div>
                          </div>
                          <span class="badge badge-success">Pilih</span>
                        </button>
                      `;
                    }).join('')}
                  </div>
                </div>

                ${scannedProd ? `
                  <div class="rounded-xl border border-border-subtle bg-surface-container-low p-3 text-xs">
                    <div class="font-bold text-sm text-on-surface">${window.ArbaUtils.escapeHtml(scannedProd.name)}</div>
                    <div class="grid grid-cols-2 gap-1.5 mt-1.5 text-[11px] text-on-surface-variant">
                      <div>SKU: <b class="font-mono text-on-surface">${window.ArbaUtils.escapeHtml(scannedProd.sku)}</b></div>
                      <div>Stok: <b class="text-on-surface">${scannedProd.stock}</b></div>
                      <div>Batch: <b class="font-mono text-on-surface">${window.ArbaUtils.escapeHtml(scannedProd.activeBatch)}</b></div>
                      <div>ED: <b class="text-on-surface">${window.ArbaUtils.escapeHtml(scannedProd.fefoDate)}</b></div>
                    </div>
                    <div class="mt-3">
                      ${typeof options.onSelectProduct === 'function' ? `
                        <button id="qr-add-to-pwa-cart-btn" type="button" class="btn btn-primary w-full">Tambah ke Nota</button>
                      ` : `
                        <button id="qr-goto-pwa-order-btn" type="button" class="btn btn-primary w-full">Buka di Aplikasi Sales</button>
                      `}
                    </div>
                  </div>
                ` : ''}
              </div>
            </div>
          ` : `
            <div>
              <div class="flex items-center justify-between mb-3">
                <span class="text-xs text-on-surface-variant">${products.length} Label Batch</span>
                <button id="qr-print-labels-btn" type="button" class="btn btn-primary btn-sm">Cetak Label</button>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                ${products.map(function (p) {
                  var qrPayload = 'ARBA|' + p.sku + '|' + p.activeBatch + '|' + p.fefoDate;
                  return `
                    <div class="p-3 rounded-xl border border-border-subtle bg-surface flex items-center gap-3">
                      <div class="shrink-0">${generateQrSvg(qrPayload, 72)}</div>
                      <div class="min-w-0 flex-1 text-xs">
                        <div class="font-bold text-on-surface truncate">${window.ArbaUtils.escapeHtml(p.name)}</div>
                        <div class="font-mono text-[10px] text-on-surface-variant mt-0.5">${window.ArbaUtils.escapeHtml(p.sku)}</div>
                        <div class="font-mono text-[11px] font-bold text-primary mt-0.5">${window.ArbaUtils.escapeHtml(p.activeBatch)}</div>
                        <div class="text-[10px] text-on-surface-variant">ED: ${window.ArbaUtils.escapeHtml(p.fefoDate)}</div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `}
        </div>
      `;

      window.ArbaApp.openModal(html);

      var closeBtn = document.getElementById('qr-modal-close');
      if (closeBtn) {
        closeBtn.onclick = function () {
          stopActiveCamera();
          window.ArbaApp.closeModal();
        };
      }

      var tabScanner = document.getElementById('qr-tab-scanner');
      var tabLabels = document.getElementById('qr-tab-labels');
      if (tabScanner) tabScanner.onclick = function () { stopActiveCamera(); renderModalContent('scanner', scannedProd); };
      if (tabLabels) tabLabels.onclick = function () { stopActiveCamera(); renderModalContent('labels', scannedProd); };

      var startCamBtn = document.getElementById('qr-start-camera-btn');
      if (startCamBtn) {
        startCamBtn.onclick = function () {
          var videoEl = document.getElementById('qr-camera-video');
          var placeholderEl = document.getElementById('qr-viewfinder-placeholder');
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
              .then(function (stream) {
                activeCameraStream = stream;
                if (videoEl) {
                  videoEl.srcObject = stream;
                  videoEl.style.display = 'block';
                }
                if (placeholderEl) placeholderEl.style.display = 'none';
              })
              .catch(function () {
                window.ArbaApp.showToast('Kamera tidak tersedia — pilih batch di daftar', 'info');
              });
          } else {
            window.ArbaApp.showToast('Kamera tidak didukung browser ini', 'info');
          }
        };
      }

      document.querySelectorAll('.qr-sim-scan-btn').forEach(function (btn) {
        btn.onclick = function () {
          var found = products.find(function (p) { return p.sku === btn.getAttribute('data-sku'); });
          if (found) {
            selectedSku = found.sku;
            renderModalContent('scanner', found);
          }
        };
      });

      var addCartBtn = document.getElementById('qr-add-to-pwa-cart-btn');
      if (addCartBtn && scannedProd && typeof options.onSelectProduct === 'function') {
        addCartBtn.onclick = function () {
          stopActiveCamera();
          window.ArbaApp.closeModal();
          options.onSelectProduct(scannedProd);
        };
      }

      var gotoPwaBtn = document.getElementById('qr-goto-pwa-order-btn');
      if (gotoPwaBtn && scannedProd) {
        gotoPwaBtn.onclick = function () {
          stopActiveCamera();
          window.ArbaApp.closeModal();
          window.ArbaApp.navigate('field-sales-pwa-preview');
        };
      }

      var printLabelsBtn = document.getElementById('qr-print-labels-btn');
      if (printLabelsBtn) printLabelsBtn.onclick = function () { window.print(); };
    }

    var defaultScanned = products.find(function (p) { return p.sku === selectedSku; }) || products[0];
    renderModalContent(initialTab, defaultScanned);
  }

  // 2. Consignment Rebalancer
  function openConsignmentRebalancerModal() {
    var recs = window.ArbaStore.getConsignmentRebalanceRecommendations();
    var totalSavedValue = recs.reduce(function (s, r) { return s + r.savedValueRp; }, 0);
    var totalUnits = recs.reduce(function (s, r) { return s + r.transferQty; }, 0);

    var html = `
      <div class="modal-dialog p-6" style="max-width: 840px; width: 95vw;">
        <div class="flex items-start justify-between gap-4 pb-4 border-b border-border-subtle">
          <div>
            <h3 class="modal-title">Mutasi Stok Konsinyasi</h3>
            <p class="text-xs text-on-surface-variant">Pemindahan stok lambat laku antar apotek mitra</p>
          </div>
          <button id="rebalance-modal-close" class="icon-btn" type="button" title="Tutup">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
          <div class="p-3 rounded-xl bg-surface-container-low border border-border-subtle">
            <div class="text-[11px] font-bold uppercase text-on-surface-variant">Rekomendasi</div>
            <div class="text-lg font-bold text-on-surface mt-0.5">${recs.length} Mutasi (${totalUnits} unit)</div>
          </div>
          <div class="p-3 rounded-xl bg-surface-container-low border border-border-subtle">
            <div class="text-[11px] font-bold uppercase text-on-surface-variant">Estimasi Nilai</div>
            <div class="text-lg font-bold text-primary mt-0.5">${window.ArbaUtils.formatRupiah(totalSavedValue)}</div>
          </div>
          <div class="p-3 rounded-xl bg-surface-container-low border border-border-subtle flex items-center justify-center">
            ${recs.length > 0 ? `
              <button id="rebalance-exec-all-btn" type="button" class="btn btn-primary w-full">Jalankan Semua (${recs.length})</button>
            ` : `
              <span class="text-xs font-bold text-emerald-700">Semua Optimal</span>
            `}
          </div>
        </div>

        ${recs.length === 0 ? `
          <div class="p-8 text-center rounded-xl border border-border-subtle bg-surface-container-low text-xs text-on-surface-variant">
            Tidak ada stok konsinyasi yang perlu dipindahkan saat ini.
          </div>
        ` : `
          <div class="flex flex-col gap-3">
            ${recs.map(function (r) {
              return `
                <div class="p-4 rounded-xl border border-border-subtle bg-surface flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap mb-1">
                      <span class="font-bold text-sm text-on-surface">${window.ArbaUtils.escapeHtml(r.productName)}</span>
                      <span class="badge badge-neutral font-mono">${window.ArbaUtils.escapeHtml(r.batch)} · ED ${window.ArbaUtils.escapeHtml(r.expiry)}</span>
                      <span class="badge ${r.nearExpiry ? 'badge-danger' : 'badge-warning'}">${r.nearExpiry ? 'Dekat ED' : 'Lambat Laku'}</span>
                    </div>
                    <div class="text-xs text-on-surface-variant mt-1">
                      <b>${window.ArbaUtils.escapeHtml(r.sourceOutletName)}</b> (sisa ${r.sourceRemainingQty}) → <b>${window.ArbaUtils.escapeHtml(r.targetOutletName)}</b>
                    </div>
                    <div class="text-[11px] text-on-surface-variant mt-1">${window.ArbaUtils.escapeHtml(r.reason)}</div>
                  </div>

                  <div class="flex flex-col items-end gap-2 shrink-0 w-full md:w-auto">
                    <div class="text-right text-xs">
                      <span class="font-bold text-primary">${window.ArbaUtils.formatRupiah(r.savedValueRp)}</span>
                    </div>
                    <button
                      type="button"
                      class="rebalance-single-btn btn btn-sm btn-primary w-full md:w-auto"
                      data-src="${r.sourceOutletId}"
                      data-dst="${r.targetOutletId}"
                      data-sku="${r.sku}"
                      data-qty="${r.transferQty}"
                    >
                      Pindahkan ${r.transferQty} Unit
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;

    window.ArbaApp.openModal(html);

    var closeBtn = document.getElementById('rebalance-modal-close');
    if (closeBtn) closeBtn.onclick = function () { window.ArbaApp.closeModal(); };

    document.querySelectorAll('.rebalance-single-btn').forEach(function (btn) {
      btn.onclick = function () {
        window.ArbaStore.executeConsignmentRebalance({
          sourceOutletId: btn.getAttribute('data-src'),
          targetOutletId: btn.getAttribute('data-dst'),
          sku: btn.getAttribute('data-sku'),
          transferQty: Number(btn.getAttribute('data-qty'))
        });
        openConsignmentRebalancerModal();
      };
    });

    var execAllBtn = document.getElementById('rebalance-exec-all-btn');
    if (execAllBtn) {
      execAllBtn.onclick = function () {
        recs.forEach(function (r) {
          window.ArbaStore.executeConsignmentRebalance({
            sourceOutletId: r.sourceOutletId,
            targetOutletId: r.targetOutletId,
            sku: r.sku,
            transferQty: r.transferQty
          });
        });
        openConsignmentRebalancerModal();
      };
    }
  }

  // 3. Route Optimizer
  function openTspRouteOptimizerModal(initialSalesRep, onSelectStopCallback) {
    var st = window.ArbaStore.getState();
    var salesTeam = st.salesTeam || [];
    var chosenRep = initialSalesRep || st.currentSalesRep || 'ALL';

    function renderRouteModal(repFilter) {
      var plan = window.ArbaStore.getOptimizedSalesRoute(repFilter);
      var stops = plan.stops || [];

      var allPts = [{ lat: plan.warehouse.lat, lng: plan.warehouse.lng }].concat(stops);
      var minLat = Math.min.apply(null, allPts.map(function (p) { return p.lat; })) - 0.02;
      var maxLat = Math.max.apply(null, allPts.map(function (p) { return p.lat; })) + 0.02;
      var minLng = Math.min.apply(null, allPts.map(function (p) { return p.lng; })) - 0.03;
      var maxLng = Math.max.apply(null, allPts.map(function (p) { return p.lng; })) + 0.03;

      function toX(lng) { return Math.round(50 + ((lng - minLng) / Math.max(0.001, maxLng - minLng)) * 600); }
      function toY(lat) { return Math.round(300 - ((lat - minLat) / Math.max(0.001, maxLat - minLat)) * 250); }

      var hqX = toX(plan.warehouse.lng);
      var hqY = toY(plan.warehouse.lat);
      var polyPoints = [hqX + ',' + hqY].concat(stops.map(function (s) {
        return toX(s.lng) + ',' + toY(s.lat);
      })).join(' ');

      var svgNodes = stops.map(function (s) {
        var cx = toX(s.lng);
        var cy = toY(s.lat);
        var color = s.creditStatus === 'Overdue' ? '#ef4444' : (s.creditStatus === 'Perhatian' ? '#f59e0b' : '#10b981');
        return `
          <g class="tsp-map-node" data-code="${s.code}" style="cursor:pointer;">
            <circle cx="${cx}" cy="${cy}" r="14" fill="${color}" fill-opacity="0.18" />
            <circle cx="${cx}" cy="${cy}" r="10" fill="${color}" stroke="#ffffff" stroke-width="2" />
            <text x="${cx}" y="${cy + 3.5}" text-anchor="middle" fill="#ffffff" font-size="10" font-weight="800">${s.stopNumber}</text>
            <rect x="${cx - 58}" y="${cy - 32}" width="116" height="17" rx="4" fill="#0f172a" fill-opacity="0.88" />
            <text x="${cx}" y="${cy - 20}" text-anchor="middle" fill="#f8fafc" font-size="9.5" font-weight="700">${window.ArbaUtils.escapeHtml(s.name.slice(0, 18))}</text>
          </g>
        `;
      }).join('');

      var html = `
        <div class="modal-dialog p-6" style="max-width: 880px; width: 95vw;">
          <div class="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border-subtle">
            <h3 class="modal-title">Rute Kunjungan (${stops.length} Outlet)</h3>
            <div class="flex items-center gap-2">
              <select id="tsp-rep-filter" class="form-select w-auto">
                <option value="ALL" ${repFilter === 'ALL' ? 'selected' : ''}>Semua Sales (${st.outlets.length} Outlet)</option>
                ${salesTeam.map(function (sr) {
                  return `<option value="${sr.name}" ${repFilter === sr.name ? 'selected' : ''}>${sr.name} (${sr.area})</option>`;
                }).join('')}
              </select>
              <button id="tsp-modal-close" class="icon-btn" type="button" title="Tutup">
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
            <div class="p-3 rounded-xl bg-surface-container-low border border-border-subtle">
              <div class="text-[10px] font-bold uppercase text-on-surface-variant">Jarak Optimal</div>
              <div class="text-lg font-bold text-primary mt-0.5">${plan.optimizedKm} km</div>
            </div>
            <div class="p-3 rounded-xl bg-surface-container-low border border-border-subtle">
              <div class="text-[10px] font-bold uppercase text-on-surface-variant">Hemat Jarak</div>
              <div class="text-lg font-bold text-emerald-700 mt-0.5">${plan.savedKm} km (${plan.savedPct}%)</div>
            </div>
            <div class="p-3 rounded-xl bg-surface-container-low border border-border-subtle">
              <div class="text-[10px] font-bold uppercase text-on-surface-variant">Estimasi Durasi</div>
              <div class="text-lg font-bold text-on-surface mt-0.5">${Math.floor(plan.totalDurationMinutes / 60)}j ${plan.totalDurationMinutes % 60}m</div>
            </div>
            <div class="p-3 rounded-xl bg-surface-container-low border border-border-subtle">
              <div class="text-[10px] font-bold uppercase text-on-surface-variant">Estimasi BBM</div>
              <div class="text-lg font-bold text-amber-700 mt-0.5">${plan.estimatedFuelLitres} L</div>
            </div>
          </div>

          <div class="rounded-xl overflow-hidden border border-border-subtle mb-4" style="background:#0f172a;">
            <svg viewBox="0 0 700 330" width="100%" height="280" style="display:block;">
              <g stroke="#1e293b" stroke-width="1">
                <line x1="0" y1="65" x2="700" y2="65" />
                <line x1="0" y1="130" x2="700" y2="130" />
                <line x1="0" y1="195" x2="700" y2="195" />
                <line x1="0" y1="260" x2="700" y2="260" />
                <line x1="140" y1="0" x2="140" y2="330" />
                <line x1="280" y1="0" x2="280" y2="330" />
                <line x1="420" y1="0" x2="420" y2="330" />
                <line x1="560" y1="0" x2="560" y2="330" />
              </g>
              <polyline points="${polyPoints}" fill="none" stroke="#2dd4bf" stroke-width="3" stroke-dasharray="7 5" stroke-linecap="round" stroke-linejoin="round" />
              <g>
                <rect x="${hqX - 12}" y="${hqY - 12}" width="24" height="24" rx="6" fill="#0284c7" stroke="#ffffff" stroke-width="2" />
                <text x="${hqX}" y="${hqY + 4}" text-anchor="middle" fill="#ffffff" font-size="10" font-weight="900">HQ</text>
              </g>
              ${svgNodes}
            </svg>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            ${stops.map(function (s) {
              return `
                <div class="p-3 rounded-xl border border-border-subtle bg-surface flex items-center justify-between gap-3">
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="w-8 h-8 rounded-lg bg-primary text-white font-bold text-xs flex items-center justify-center shrink-0">#${s.stopNumber}</div>
                    <div class="min-w-0">
                      <div class="font-bold text-xs text-on-surface truncate">${window.ArbaUtils.escapeHtml(s.name)}</div>
                      <div class="text-[11px] text-on-surface-variant truncate">${window.ArbaUtils.escapeHtml(s.city)} · +${s.legKm} km (${s.legMin} mnt)</div>
                    </div>
                  </div>
                  <button type="button" class="tsp-select-stop-btn btn btn-sm btn-outline shrink-0" data-code="${s.code}">Pilih</button>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;

      window.ArbaApp.openModal(html);

      var closeBtn = document.getElementById('tsp-modal-close');
      if (closeBtn) closeBtn.onclick = function () { window.ArbaApp.closeModal(); };

      var repSelect = document.getElementById('tsp-rep-filter');
      if (repSelect) repSelect.onchange = function (e) { renderRouteModal(e.target.value); };

      function selectStop(code) {
        window.ArbaApp.closeModal();
        window.ArbaStore.setSelectedOutletId(code);
        if (typeof onSelectStopCallback === 'function') {
          onSelectStopCallback(code);
        } else {
          window.ArbaApp.navigate('field-sales-pwa-preview');
        }
      }

      document.querySelectorAll('.tsp-select-stop-btn, .tsp-map-node').forEach(function (el) {
        el.onclick = function () {
          var code = el.getAttribute('data-code');
          if (code) selectStop(code);
        };
      });
    }

    renderRouteModal(chosenRep);
  }

  // 4. Credit Health Scoring
  function openCreditScoringModal() {
    var scores = window.ArbaStore.getOutletCreditScoring();

    var html = `
      <div class="modal-dialog p-6" style="max-width: 840px; width: 95vw;">
        <div class="flex items-start justify-between gap-4 pb-4 border-b border-border-subtle">
          <div>
            <h3 class="modal-title">Skor Kredit Outlet</h3>
            <p class="text-xs text-on-surface-variant">Evaluasi utilisasi plafon dan kecepatan penjualan konsinyasi</p>
          </div>
          <button id="credit-score-modal-close" class="icon-btn" type="button" title="Tutup">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <div class="flex flex-col gap-3 mt-4">
          ${scores.map(function (sc) {
            var limitChanged = sc.suggestedLimit !== sc.currentLimit || sc.suggestedTerms !== sc.currentTerms;
            return `
              <div class="p-4 rounded-xl border border-border-subtle bg-surface flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div class="flex items-center gap-3.5 flex-1 min-w-0">
                  <div style="width:48px; height:48px; border-radius:12px; background:${sc.badgeBg}; color:${sc.badgeColor}; display:flex; flex-direction:column; align-items:center; justify-content:center; flex-shrink:0; border:1px solid ${sc.badgeColor};">
                    <span style="font-size:15px; font-weight:800; line-height:1;">${sc.score}</span>
                    <span style="font-size:9px; font-weight:700;">/100</span>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="font-bold text-sm text-on-surface">${window.ArbaUtils.escapeHtml(sc.outletName)}</span>
                      <span class="badge" style="background:${sc.badgeBg}; color:${sc.badgeColor};">${window.ArbaUtils.escapeHtml(sc.tier)}</span>
                    </div>
                    <div class="text-xs text-on-surface-variant mt-1">
                      Utilisasi: <b>${sc.utilizationPct}%</b> · Sell-Through: <b>${sc.sellThroughPct}%</b> · Plafon: <b>${window.ArbaUtils.formatRupiah(sc.currentLimit)}</b> (${window.ArbaUtils.escapeHtml(sc.currentTerms)})
                    </div>
                    <div class="text-[11px] text-primary font-medium mt-1">${window.ArbaUtils.escapeHtml(sc.recommendation)}</div>
                  </div>
                </div>

                <div class="shrink-0 w-full md:w-auto flex flex-col items-end gap-1.5">
                  <div class="text-xs text-on-surface-variant">Saran: <b class="text-on-surface">${window.ArbaUtils.formatRupiah(sc.suggestedLimit)}</b></div>
                  <button
                    type="button"
                    class="apply-ai-credit-btn btn btn-sm ${limitChanged ? 'btn-primary' : 'btn-outline'}"
                    data-outlet-id="${sc.outletId}"
                  >
                    ${limitChanged ? 'Terapkan Plafon' : 'Optimal'}
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    window.ArbaApp.openModal(html);

    var closeBtn = document.getElementById('credit-score-modal-close');
    if (closeBtn) closeBtn.onclick = function () { window.ArbaApp.closeModal(); };

    document.querySelectorAll('.apply-ai-credit-btn').forEach(function (btn) {
      btn.onclick = function () {
        window.ArbaStore.applyRecommendedCreditPolicy(btn.getAttribute('data-outlet-id'));
        openCreditScoringModal();
      };
    });
  }

  // 5. Ledger Chain Audit
  function openLedgerChainAuditModal() {
    var audit = window.ArbaStore.verifyLedgerChainIntegrity();

    var html = `
      <div class="modal-dialog p-6" style="max-width: 860px; width: 95vw;">
        <div class="flex items-start justify-between gap-4 pb-4 border-b border-border-subtle">
          <div>
            <h3 class="modal-title">Audit Rantai Buku Besar Stok</h3>
            <p class="text-xs text-on-surface-variant">${audit.totalBlocks} transaksi terverifikasi · Masuk: +${audit.inboundUnits} · Keluar: -${audit.outboundUnits}</p>
          </div>
          <div class="flex items-center gap-2">
            <button id="chain-audit-print-btn" type="button" class="btn btn-sm btn-primary">Cetak</button>
            <button id="chain-audit-close" class="icon-btn" type="button" title="Tutup">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        <div class="my-4 p-3 rounded-xl bg-surface-container-low border border-border-subtle text-xs flex flex-wrap items-center justify-between gap-2">
          <span>Root Hash: <b class="font-mono text-primary">${audit.merkleRoot}</b></span>
          <span class="badge badge-success">Valid</span>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Dokumen</th>
                <th>Produk &amp; Batch</th>
                <th>Mutasi</th>
                <th>Prev Hash</th>
                <th>Block Hash</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${audit.blocks.slice(0, 25).map(function (b) {
                return `
                  <tr>
                    <td class="font-mono font-bold text-primary">#${b.blockIndex}</td>
                    <td>
                      <div class="font-bold text-on-surface">${window.ArbaUtils.escapeHtml(b.docRef)}</div>
                      <div class="text-[10px] text-on-surface-variant">${window.ArbaUtils.escapeHtml(b.timestamp)}</div>
                    </td>
                    <td>
                      <div class="font-semibold">${window.ArbaUtils.escapeHtml(b.skuName)}</div>
                      <div class="font-mono text-[10px] text-on-surface-variant">${window.ArbaUtils.escapeHtml(b.batch)}</div>
                    </td>
                    <td class="font-bold ${b.quantity >= 0 ? 'text-emerald-700' : 'text-rose-700'}">
                      ${b.type} (${b.quantity >= 0 ? '+' : ''}${b.quantity}) → ${b.finalStock}
                    </td>
                    <td class="font-mono text-[10px] text-on-surface-variant">${b.prevHash}...</td>
                    <td class="font-mono text-[11px] font-bold text-emerald-700">${b.blockHash}</td>
                    <td><span class="badge badge-success">Valid</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    window.ArbaApp.openModal(html);

    var closeBtn = document.getElementById('chain-audit-close');
    if (closeBtn) closeBtn.onclick = function () { window.ArbaApp.closeModal(); };

    var printBtn = document.getElementById('chain-audit-print-btn');
    if (printBtn) printBtn.onclick = function () { window.print(); };
  }

  window.ArbaAdvanced = {
    generateQrSvg: generateQrSvg,
    openQrBatchModal: openQrBatchModal,
    openConsignmentRebalancerModal: openConsignmentRebalancerModal,
    openTspRouteOptimizerModal: openTspRouteOptimizerModal,
    openCreditScoringModal: openCreditScoringModal,
    openLedgerChainAuditModal: openLedgerChainAuditModal
  };
})();
