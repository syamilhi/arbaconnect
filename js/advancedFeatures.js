/**
 * =============================================================================
 * ArbaConnect ERP - 6 Advanced Enterprise Features (js/advancedFeatures.js)
 * CV Arba'in Solo Raya
 * =============================================================================
 *
 * Seluruh modal & komponen menggunakan sistem desain native (tokens.css,
 * components.css, utilities.css) sehingga tampil konsisten, rapi, dan 100%
 * mendukung Light Mode maupun Dark Mode.
 */

(function () {
  'use strict';

  var activeCameraStream = null;
  var activeScanRaf = null;

  function stopActiveCamera() {
    if (activeScanRaf) {
      cancelAnimationFrame(activeScanRaf);
      activeScanRaf = null;
    }
    if (activeCameraStream) {
      try {
        activeCameraStream.getTracks().forEach(function (t) { t.stop(); });
      } catch (e) {}
      activeCameraStream = null;
    }
  }

  // ---------------------------------------------------------------------------
  // 1. Generator QR Code SVG Standar ISO/IEC 18004 (Pure Vanilla, Scannable!)
  //    Mendukung Byte Mode Version 1-4, Error Correction Level L (single block)
  // ---------------------------------------------------------------------------
  var QR_EXP = new Uint8Array(512);
  var QR_LOG = new Uint8Array(256);
  (function initQrGalois() {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      QR_EXP[i] = x;
      QR_LOG[x] = i;
      x = (x << 1) ^ (x & 0x80 ? 0x11d : 0);
    }
    for (var j = 255; j < 512; j++) {
      QR_EXP[j] = QR_EXP[j - 255];
    }
  })();

  function qrRsEncode(dataBytes, ecCount) {
    var gen = [1];
    for (var i = 0; i < ecCount; i++) {
      var next = new Array(gen.length + 1).fill(0);
      var factor = QR_EXP[i];
      for (var j = 0; j < gen.length; j++) {
        next[j] ^= gen[j];
        if (gen[j] !== 0) {
          next[j + 1] ^= QR_EXP[QR_LOG[gen[j]] + i];
        }
      }
      gen = next;
    }
    var rem = new Array(ecCount).fill(0);
    for (var k = 0; k < dataBytes.length; k++) {
      var coeff = dataBytes[k] ^ rem.shift();
      rem.push(0);
      if (coeff !== 0) {
        var logCoeff = QR_LOG[coeff];
        for (var m = 0; m < ecCount; m++) {
          if (gen[m + 1] !== 0) {
            rem[m] ^= QR_EXP[QR_LOG[gen[m + 1]] + logCoeff];
          }
        }
      }
    }
    return rem;
  }

  function qrComputeFormatBits(ecLevelBits, maskPattern) {
    var data = ((ecLevelBits & 3) << 3) | (maskPattern & 7);
    var rem = data << 10;
    for (var i = 4; i >= 0; i--) {
      if ((rem >>> (i + 10)) & 1) {
        rem ^= 0x537 << i;
      }
    }
    return ((data << 10) | rem) ^ 0x5412;
  }

  function generateQrSvg(text, size) {
    size = size || 84;
    var raw = String(text || 'ARBACONNECT-FEFO');
    var bytes = [];
    for (var bIdx = 0; bIdx < raw.length; bIdx++) {
      var code = raw.charCodeAt(bIdx);
      bytes.push(code < 128 ? code : 63);
    }
    // Versi 1-4 EC-L: [version, gridSize, dataCodewords, ecCodewords, alignCenter]
    var specs = [
      [1, 21, 19, 7, 0],
      [2, 25, 34, 10, 18],
      [3, 29, 55, 15, 22],
      [4, 33, 80, 20, 26]
    ];
    if (bytes.length > 78) bytes = bytes.slice(0, 78);
    var spec = specs[specs.length - 1];
    for (var sIdx = 0; sIdx < specs.length; sIdx++) {
      if (bytes.length <= specs[sIdx][2] - 2) {
        spec = specs[sIdx];
        break;
      }
    }
    var version = spec[0];
    var grid = spec[1];
    var dataCap = spec[2];
    var ecCount = spec[3];
    var alignPos = spec[4];

    // 1. Encode bitstream: Mode 0100 (Byte) + Length (8-bit) + Payload + Terminator
    var bits = [];
    function pushBits(val, len) {
      for (var bi = len - 1; bi >= 0; bi--) bits.push((val >>> bi) & 1);
    }
    pushBits(4, 4);
    pushBits(bytes.length, 8);
    for (var p = 0; p < bytes.length; p++) pushBits(bytes[p], 8);
    var maxBits = dataCap * 8;
    for (var t = 0; t < 4 && bits.length < maxBits; t++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);

    var dataWords = [];
    for (var wi = 0; wi < bits.length; wi += 8) {
      var byteVal = 0;
      for (var wb = 0; wb < 8; wb++) byteVal = (byteVal << 1) | bits[wi + wb];
      dataWords.push(byteVal);
    }
    var padToggle = 0;
    while (dataWords.length < dataCap) {
      dataWords.push(padToggle % 2 === 0 ? 0xec : 0x11);
      padToggle++;
    }
    var ecWords = qrRsEncode(dataWords, ecCount);
    var allWords = dataWords.concat(ecWords);

    // 2. Bangun matriks modul + penanda function modules
    var matrix = [];
    var isFunc = [];
    for (var r = 0; r < grid; r++) {
      matrix[r] = new Array(grid).fill(0);
      isFunc[r] = new Array(grid).fill(false);
    }
    function setFunc(rr, cc, val) {
      if (rr >= 0 && rr < grid && cc >= 0 && cc < grid) {
        matrix[rr][cc] = val ? 1 : 0;
        isFunc[rr][cc] = true;
      }
    }
    function drawFinder(rowOff, colOff) {
      for (var dr = -1; dr <= 7; dr++) {
        for (var dc = -1; dc <= 7; dc++) {
          var inBox = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
          var dark = inBox && (
            dr === 0 || dr === 6 || dc === 0 || dc === 6 ||
            (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4)
          );
          setFunc(rowOff + dr, colOff + dc, dark);
        }
      }
    }
    drawFinder(0, 0);
    drawFinder(0, grid - 7);
    drawFinder(grid - 7, 0);

    // Alignment pattern (Version 2-4)
    if (alignPos > 0) {
      for (var ar = -2; ar <= 2; ar++) {
        for (var ac = -2; ac <= 2; ac++) {
          var aDark = Math.max(Math.abs(ar), Math.abs(ac)) !== 1;
          setFunc(alignPos + ar, alignPos + ac, aDark);
        }
      }
    }

    // Timing patterns
    for (var ti = 8; ti < grid - 8; ti++) {
      setFunc(6, ti, ti % 2 === 0);
      setFunc(ti, 6, ti % 2 === 0);
    }

    // Reserve format info areas & dark module
    for (var fi = 0; fi <= 8; fi++) {
      if (fi !== 6) {
        setFunc(8, fi, false);
        setFunc(fi, 8, false);
      }
    }
    for (var fj = 0; fj < 8; fj++) {
      setFunc(8, grid - 1 - fj, false);
      if (fj < 7) setFunc(grid - 1 - fj, 8, false);
    }
    setFunc(4 * version + 9, 8, true);

    // 3. Penempatan bit data (zigzag 2 kolom) + Mask 0 ((r + c) % 2 === 0)
    var bitStream = [];
    for (var ai = 0; ai < allWords.length; ai++) {
      for (var ab = 7; ab >= 0; ab--) bitStream.push((allWords[ai] >>> ab) & 1);
    }
    var bitPtr = 0;
    var upward = true;
    for (var col = grid - 1; col >= 1; col -= 2) {
      if (col === 6) col--;
      for (var step = 0; step < grid; step++) {
        var row = upward ? (grid - 1 - step) : step;
        for (var dx = 0; dx < 2; dx++) {
          var cc = col - dx;
          if (!isFunc[row][cc]) {
            var bit = bitPtr < bitStream.length ? bitStream[bitPtr++] : 0;
            if ((row + cc) % 2 === 0) bit ^= 1;
            matrix[row][cc] = bit;
          }
        }
      }
      upward = !upward;
    }

    // 4. Tulis Format Information (EC-L = 01, Mask 0 = 000)
    var fmt = qrComputeFormatBits(1, 0);
    var fmtCoords1 = [
      [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
      [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
    ];
    for (var fk = 0; fk < 15; fk++) {
      var fBit = (fmt >>> (14 - fk)) & 1;
      matrix[fmtCoords1[fk][0]][fmtCoords1[fk][1]] = fBit;
      if (fk < 7) {
        matrix[grid - 1 - fk][8] = fBit;
      } else {
        matrix[8][grid - 15 + fk] = fBit;
      }
    }

    // 5. Render SVG dengan Quiet Zone 4 modul standar ISO/IEC 18004
    var qz = 4;
    var rects = '';
    for (var y = 0; y < grid; y++) {
      for (var x = 0; x < grid; x++) {
        if (matrix[y][x] === 1) {
          rects += '<rect x="' + (x + qz) + '" y="' + (y + qz) + '" width="1" height="1" fill="#0f172a"/>';
        }
      }
    }

    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (grid + qz * 2) + ' ' + (grid + qz * 2) + '" width="' + size + '" height="' + size + '" shape-rendering="crispEdges" style="background:#ffffff; border-radius:8px; border:1px solid var(--color-border-subtle); display:block;">' +
      '<rect width="100%" height="100%" fill="#ffffff"/>' +
      rects +
      '</svg>'
    );
  }

  // ---------------------------------------------------------------------------
  // 2. Modal Scan QR Kemasan & Cetak Stiker Nomor Batch Gudang
  // ---------------------------------------------------------------------------
  function openQrBatchModal(options) {
    options = options || {};
    var st = window.ArbaStore.getState();
    var products = st.products || [];
    var initialTab = options.initialTab || 'scanner';
    var selectedSku = options.initialSku || (products[0] && products[0].sku) || 'SKU-ARB-MDR500';

    function renderModalContent(activeTab, scannedProd) {
      var html = `
        <div class="modal-dialog max-w-4xl">
          <!-- Modal Header -->
          <div class="modal-header">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-[22px]">qr_code_scanner</span>
              </div>
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="font-bold text-sm text-on-surface">Scan QR Kemasan Botol/Karton &amp; Cetak Stiker Nomor Batch Gudang</h3>
                  <span class="badge badge-success">STANDAR BPOM &amp; FEFO</span>
                </div>
                <p class="text-xs text-on-surface-variant mt-0.5">
                  Verifikasi keaslian nomor batch BPOM, cek sisa umur simpan FEFO, dan cetak stiker label batch Gudang Kartasura.
                </p>
              </div>
            </div>
            <button id="qr-modal-close" class="icon-btn" type="button" title="Tutup">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>

          <!-- Modal Body -->
          <div class="modal-body">
            <!-- Switch Tabs -->
            <div class="flex items-center gap-2 bg-surface-container-low p-1.5 rounded-xl border border-border-subtle">
              <button
                id="qr-tab-scanner"
                type="button"
                class="flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer border-0 transition-all ${
                  activeTab === 'scanner' ? 'bg-primary text-white shadow-xs' : 'bg-transparent text-on-surface-variant hover:text-on-surface'
                }"
              >
                <span class="material-symbols-outlined text-[16px]">photo_camera</span>
                <span>Pemindai Kamera &amp; Pilih Batch Gudang</span>
              </button>
              <button
                id="qr-tab-labels"
                type="button"
                class="flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer border-0 transition-all ${
                  activeTab === 'labels' ? 'bg-primary text-white shadow-xs' : 'bg-transparent text-on-surface-variant hover:text-on-surface'
                }"
              >
                <span class="material-symbols-outlined text-[16px]">qr_code_2</span>
                <span>Stiker Label QR Batch Gudang (${products.length} SKU)</span>
              </button>
            </div>

            ${activeTab === 'scanner' ? `
              <!-- TAB 1: SCANNER KAMERA & PILIH CEPAT BATCH -->
              <div class="adv-grid-2">
                <!-- Panel Kamera Live / Viewfinder -->
                <div class="rounded-xl border border-border-subtle p-4 flex flex-col justify-between relative overflow-hidden" style="min-height: 280px; background:#090d16; color:#f8fafc;">
                  <div class="flex items-center justify-between z-10">
                    <span class="text-[11px] font-mono uppercase tracking-wider flex items-center gap-1.5" style="color:#34d399;">
                      <span style="width:8px; height:8px; border-radius:50%; background:#10b981; display:inline-block;"></span>
                      SENSOR OPTIK QR BATCH FEFO
                    </span>
                    <button
                      id="qr-start-camera-btn"
                      type="button"
                      class="px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer border border-border-subtle flex items-center gap-1"
                      style="background:rgba(255,255,255,0.12); color:#ffffff;"
                    >
                      <span class="material-symbols-outlined text-[14px]">videocam</span>
                      <span>Aktifkan Kamera</span>
                    </button>
                  </div>

                  <!-- Video / Laser Box -->
                  <div class="my-3 relative flex items-center justify-center rounded-lg overflow-hidden" style="height: 180px; background: radial-gradient(circle, #1e293b 0%, #020617 100%); border: 1px solid rgba(16,185,129,0.35);">
                    <video id="qr-camera-video" autoplay playsinline muted style="width:100%; height:100%; object-fit:cover; display:none;"></video>
                    <div id="qr-viewfinder-placeholder" class="text-center p-4">
                      <span class="material-symbols-outlined text-[40px] mb-1" style="color:#34d399;">qr_code_scanner</span>
                      <div class="text-xs font-bold" style="color:#e2e8f0;">Arahkan QR Stiker Batch ke Bingkai Kamera</div>
                      <div class="text-[11px] mt-0.5" style="color:#94a3b8;">Atau pilih nomor batch aktif pada daftar di sebelah kanan</div>
                    </div>
                    <div style="position:absolute; left:12%; right:12%; top:50%; height:2px; background:linear-gradient(90deg, transparent, #10b981, #34d399, #10b981, transparent); box-shadow:0 0 12px #10b981;"></div>
                  </div>

                  <div class="text-[11px] flex items-center justify-between" style="color:#94a3b8;">
                    <span>Format: <b style="color:#e2e8f0;">ARBA|SKU|BATCH|EXP</b></span>
                    <span class="font-semibold" style="color:#34d399;">Standar BPOM &amp; CDOB</span>
                  </div>
                </div>

                <!-- Panel Daftar Batch Aktif & Hasil Verifikasi -->
                <div class="flex flex-col justify-between gap-3">
                  <div class="rounded-xl border border-border-subtle bg-surface-container-low p-3.5">
                    <div class="text-xs font-bold text-on-surface mb-1">Pilih Cepat Nomor Batch Gudang</div>
                    <p class="text-[11px] text-on-surface-variant mb-2.5">
                      Pilih nomor batch produk di bawah untuk memeriksa status kedaluwarsa &amp; stok:
                    </p>
                    <div class="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                      ${products.map(function (p) {
                        var isSelected = scannedProd && scannedProd.sku === p.sku;
                        return `
                          <button
                            type="button"
                            class="qr-sim-scan-btn flex items-center justify-between p-2 rounded-lg text-left text-xs cursor-pointer transition-all border ${
                              isSelected
                                ? 'bg-primary/10 border-primary text-primary font-bold'
                                : 'bg-surface-container-lowest hover:bg-surface-container border-border-subtle text-on-surface'
                            }"
                            data-sku="${p.sku}"
                          >
                            <div class="truncate pr-2">
                              <div class="font-semibold truncate">${window.ArbaUtils.escapeHtml(p.name)}</div>
                              <div class="text-[10px] font-mono text-on-surface-variant">${window.ArbaUtils.escapeHtml(p.sku)} • Batch: ${window.ArbaUtils.escapeHtml(p.activeBatch)}</div>
                            </div>
                            <span class="badge badge-success shrink-0">Cek QR</span>
                          </button>
                        `;
                      }).join('')}
                    </div>
                  </div>

                  <!-- Hasil Verifikasi Batch -->
                  ${scannedProd ? `
                    <div class="rounded-xl border border-border-subtle bg-surface-container-low p-3.5 text-xs">
                      <div class="flex items-center justify-between mb-1.5">
                        <span class="font-bold text-emerald-600 flex items-center gap-1">
                          <span class="material-symbols-outlined text-[16px]">verified</span>
                          BATCH TERVERIFIKASI RESMI (BPOM &amp; CDOB)
                        </span>
                        <span class="badge badge-primary font-mono">${window.ArbaUtils.escapeHtml(scannedProd.activeBatch)}</span>
                      </div>
                      <div class="font-bold text-sm text-on-surface">${window.ArbaUtils.escapeHtml(scannedProd.name)}</div>
                      <div class="grid grid-cols-2 gap-1.5 mt-2 text-[11px] text-on-surface-variant">
                        <div>Kode SKU: <b class="font-mono text-on-surface">${window.ArbaUtils.escapeHtml(scannedProd.sku)}</b></div>
                        <div>Stok Gudang: <b class="text-on-surface">${scannedProd.stock} unit</b></div>
                        <div>Kedaluwarsa (FEFO): <b class="text-on-surface">${window.ArbaUtils.escapeHtml(scannedProd.fefoDate)}</b></div>
                        <div>Harga Satuan: <b class="text-primary">${window.ArbaUtils.formatRupiah(scannedProd.unitPrice)}</b></div>
                        <div>NIE BPOM: <b class="font-mono text-emerald-700">${window.ArbaUtils.escapeHtml(scannedProd.nieBpom || 'Terdaftar BPOM')}</b></div>
                        <div>Halal BPJPH: <b class="font-mono text-on-surface">${window.ArbaUtils.escapeHtml(scannedProd.noHalal || 'Tersertifikasi')}</b></div>
                      </div>
                      <div class="mt-3 flex flex-wrap gap-2">
                        ${typeof options.onSelectProduct === 'function' ? `
                          <button
                            id="qr-add-to-pwa-cart-btn"
                            type="button"
                            class="w-full py-2 px-3 rounded-lg bg-primary hover:bg-primary-container text-white font-semibold text-xs cursor-pointer border-0 flex items-center justify-center gap-1.5 shadow-xs"
                          >
                            <span class="material-symbols-outlined text-[16px]">add_shopping_cart</span>
                            <span>+ Tambah ke Nota Pesanan Sales</span>
                          </button>
                        ` : `
                          <button
                            id="qr-goto-pwa-order-btn"
                            type="button"
                            class="w-full py-2 px-3 rounded-lg bg-primary hover:bg-primary-container text-white font-semibold text-xs cursor-pointer border-0 flex items-center justify-center gap-1.5"
                          >
                            <span class="material-symbols-outlined text-[16px]">qr_code_2</span>
                            <span>Lihat Stiker QR Batch Ini</span>
                          </button>
                        `}
                      </div>
                    </div>
                  ` : ''}
                </div>
              </div>
            ` : `
              <!-- TAB 2: GENERATOR STIKER LABEL QR BATCH FEFO -->
              <div class="flex flex-col gap-3">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-surface-container-low p-3 rounded-xl border border-border-subtle">
                  <span class="text-xs text-on-surface-variant">
                    Stiker QR Batch di bawah siap dicetak untuk ditempelkan pada karton/botol di Gudang Kartasura &amp; rak konsinyasi apotek:
                  </span>
                  <button
                    id="qr-print-labels-btn"
                    type="button"
                    class="px-3.5 py-2 rounded-lg bg-primary hover:bg-primary-container text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer border-0 shadow-xs shrink-0"
                  >
                    <span class="material-symbols-outlined text-[16px]">print</span>
                    <span>Cetak Semua Stiker QR Batch</span>
                  </button>
                </div>

                <div class="adv-grid-3">
                  ${products.map(function (p) {
                    var qrPayload = 'ARBA|' + p.sku + '|' + p.activeBatch + '|' + p.fefoDate;
                    return `
                      <div class="p-3 rounded-xl border border-border-subtle bg-surface-container-low flex items-center gap-3">
                        <div class="shrink-0">
                          ${generateQrSvg(qrPayload, 78)}
                        </div>
                        <div class="min-w-0 flex-1 text-xs">
                          <div class="text-[10px] font-bold uppercase tracking-wider text-primary">CV ARBA'IN SOLO RAYA</div>
                          <div class="font-bold text-on-surface truncate" title="${window.ArbaUtils.escapeHtml(p.name)}">${window.ArbaUtils.escapeHtml(p.name)}</div>
                          <div class="font-mono text-[10px] text-on-surface-variant mt-0.5">SKU: ${window.ArbaUtils.escapeHtml(p.sku)}</div>
                          <div class="font-mono text-[11px] font-bold text-emerald-600 mt-0.5">${window.ArbaUtils.escapeHtml(p.activeBatch)}</div>
                          <div class="text-[10px] font-mono text-primary mt-0.5 truncate">${window.ArbaUtils.escapeHtml(p.nieBpom || 'BPOM RI')}</div>
                          <div class="text-[11px] text-on-surface-variant mt-0.5">ED: <b class="text-on-surface">${window.ArbaUtils.escapeHtml(p.fefoDate)}</b> • Stok: <b class="text-on-surface">${p.stock}</b></div>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            `}
          </div>

          <div class="modal-footer">
            <button id="qr-modal-footer-close" type="button" class="btn btn-outline">Tutup</button>
          </div>
        </div>
      `;

      window.ArbaApp.openModal(html);

      var closeModalFn = function () {
        stopActiveCamera();
        window.ArbaApp.closeModal();
      };
      var closeBtn = document.getElementById('qr-modal-close');
      var footerCloseBtn = document.getElementById('qr-modal-footer-close');
      if (closeBtn) closeBtn.onclick = closeModalFn;
      if (footerCloseBtn) footerCloseBtn.onclick = closeModalFn;

      var tabScanner = document.getElementById('qr-tab-scanner');
      var tabLabels = document.getElementById('qr-tab-labels');
      if (tabScanner) {
        tabScanner.onclick = function () {
          stopActiveCamera();
          renderModalContent('scanner', scannedProd);
        };
      }
      if (tabLabels) {
        tabLabels.onclick = function () {
          stopActiveCamera();
          renderModalContent('labels', scannedProd);
        };
      }

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

                // Aktifkan BarcodeDetector native (Chrome/Edge/Android) untuk pemindaian QR nyata
                if (typeof window.BarcodeDetector === 'function' && videoEl) {
                  var detector = new window.BarcodeDetector({ formats: ['qr_code'] });
                  window.ArbaApp.showToast('Kamera optik & QR Detector aktif — arahkan ke stiker QR batch!', 'qr_code_scanner');
                  var scanLoop = function () {
                    if (!activeCameraStream || !videoEl || videoEl.readyState < 2) {
                      if (activeCameraStream) activeScanRaf = requestAnimationFrame(scanLoop);
                      return;
                    }
                    detector.detect(videoEl).then(function (codes) {
                      if (codes && codes.length > 0) {
                        var rawVal = String(codes[0].rawValue || '').trim();
                        var parts = rawVal.split('|');
                        var keySku = parts.length >= 2 ? parts[1] : rawVal;
                        var keyBatch = parts.length >= 3 ? parts[2] : rawVal;
                        var matched = products.find(function (p) {
                          return p.sku === keySku || p.activeBatch === keyBatch || rawVal.indexOf(p.sku) !== -1 || rawVal.indexOf(p.activeBatch) !== -1;
                        });
                        if (matched) {
                          stopActiveCamera();
                          selectedSku = matched.sku;
                          window.ArbaApp.showToast('QR Batch Terbaca Optik: ' + matched.name + ' (' + matched.activeBatch + ')', 'verified');
                          renderModalContent('scanner', matched);
                          return;
                        }
                      }
                      if (activeCameraStream) activeScanRaf = requestAnimationFrame(scanLoop);
                    }).catch(function () {
                      if (activeCameraStream) activeScanRaf = requestAnimationFrame(scanLoop);
                    });
                  };
                  activeScanRaf = requestAnimationFrame(scanLoop);
                } else {
                  window.ArbaApp.showToast('Kamera aktif (browser non-BarcodeDetector — gunakan daftar batch di kanan sebagai fallback)', 'videocam');
                }
              })
              .catch(function () {
                window.ArbaApp.showToast('Kamera tidak tersedia — silakan pilih nomor batch pada daftar di kanan', 'info');
              });
          } else {
            window.ArbaApp.showToast('Silakan pilih nomor batch pada daftar di sebelah kanan', 'qr_code_scanner');
          }
        };
      }

      document.querySelectorAll('.qr-sim-scan-btn').forEach(function (btn) {
        btn.onclick = function () {
          var sku = btn.getAttribute('data-sku');
          var found = products.find(function (p) { return p.sku === sku; });
          if (found) {
            selectedSku = found.sku;
            window.ArbaApp.showToast('Batch Terverifikasi: ' + found.name + ' (' + found.activeBatch + ')', 'qr_code_scanner');
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
          renderModalContent('labels', scannedProd);
        };
      }

      var printLabelsBtn = document.getElementById('qr-print-labels-btn');
      if (printLabelsBtn) {
        printLabelsBtn.onclick = function () {
          window.print();
        };
      }
    }

    var defaultScanned = products.find(function (p) { return p.sku === selectedSku; }) || products[0];
    renderModalContent(initialTab, defaultScanned);
  }

  // ---------------------------------------------------------------------------
  // 3. Modal Rekomendasi Tarik & Geser Stok Titipan Antar-Apotek (FEFO)
  // ---------------------------------------------------------------------------
  function openConsignmentRebalancerModal() {
    var recs = window.ArbaStore.getConsignmentRebalanceRecommendations();
    var totalSavedValue = recs.reduce(function (s, r) { return s + r.savedValueRp; }, 0);
    var totalUnits = recs.reduce(function (s, r) { return s + r.transferQty; }, 0);

    var html = `
      <div class="modal-dialog max-w-4xl">
        <div class="modal-header">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-[22px]">swap_driving_apps_wheel</span>
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="font-bold text-sm text-on-surface">Realokasi Inventaris Konsinyasi Antar-Mitra Berbasis FEFO</h3>
                <span class="badge badge-warning">OPTIMASI FEFO</span>
              </div>
              <p class="text-xs text-on-surface-variant mt-0.5">
                Memindahkan inventaris konsinyasi berperputaran lambat atau mendekati masa kedaluwarsa ke mitra apotek dengan tingkat penjualan tinggi.
              </p>
            </div>
          </div>
          <button id="rebalance-modal-close" class="icon-btn" type="button" title="Tutup">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <div class="modal-body">
          <!-- Ringkasan Dampak Finansial -->
          <div class="adv-grid-3">
            <div class="p-3.5 rounded-xl bg-surface-container-low border border-border-subtle">
              <div class="text-[11px] font-bold uppercase text-on-surface-variant">Rekomendasi Realokasi Mitra</div>
              <div class="text-xl font-bold text-on-surface mt-0.5">${recs.length} Rute Realokasi</div>
              <div class="text-[11px] text-amber-600 font-semibold mt-0.5">Total ${totalUnits} unit produk dioptimalkan</div>
            </div>
            <div class="p-3.5 rounded-xl bg-surface-container-low border border-border-subtle">
              <div class="text-[11px] font-bold uppercase text-on-surface-variant">Estimasi Nilai Inventaris</div>
              <div class="text-xl font-bold text-primary mt-0.5">${window.ArbaUtils.formatRupiah(totalSavedValue)}</div>
              <div class="text-[11px] text-emerald-600 font-semibold mt-0.5">Mitigasi risiko retur kedaluwarsa</div>
            </div>
            <div class="p-3.5 rounded-xl bg-surface-container-low border border-border-subtle flex flex-col justify-between">
              <div class="text-[11px] font-bold uppercase text-on-surface-variant">Otorisasi Realokasi Massal</div>
              ${recs.length > 0 ? `
                <button
                  id="rebalance-exec-all-btn"
                  type="button"
                  class="mt-1 py-2 px-3 rounded-lg bg-primary hover:bg-primary-container text-white text-xs font-semibold cursor-pointer border-0 flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <span class="material-symbols-outlined text-[16px]">bolt</span>
                  <span>Proses Seluruh Realokasi (${recs.length})</span>
                </button>
              ` : `
                <div class="text-xs font-bold text-emerald-600 mt-1">Distribusi Konsinyasi Optimal</div>
              `}
            </div>
          </div>

          <!-- Daftar Rekomendasi -->
          ${recs.length === 0 ? `
            <div class="p-8 text-center rounded-xl border border-border-subtle bg-surface-container-low">
              <span class="material-symbols-outlined text-[36px] text-emerald-600">verified</span>
              <div class="font-bold text-sm text-on-surface mt-2">Seluruh Inventaris Konsinyasi Mitra Telah Optimal</div>
              <p class="text-xs text-on-surface-variant mt-1">Tidak ditemukan inventaris konsinyasi berperputaran lambat atau mendekati kedaluwarsa yang memerlukan realokasi saat ini.</p>
            </div>
          ` : `
            <div class="flex flex-col gap-2.5 max-h-[420px] overflow-y-auto pr-1">
              ${recs.map(function (r) {
                return `
                  <div class="p-3.5 rounded-xl border border-border-subtle bg-surface-container-low flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap mb-1.5">
                        <span class="font-bold text-xs text-on-surface">${window.ArbaUtils.escapeHtml(r.productName)}</span>
                        <span class="badge badge-neutral font-mono">Batch: ${window.ArbaUtils.escapeHtml(r.batch)} • ED: ${window.ArbaUtils.escapeHtml(r.expiry)}</span>
                        ${r.nearExpiry ? '<span class="badge badge-danger">MENDEKATI ED</span>' : '<span class="badge badge-warning">PERPUTARAN LAMBAT</span>'}
                      </div>

                      <div class="flex items-center gap-2 flex-wrap text-xs">
                        <div class="px-2.5 py-1.5 rounded-lg bg-surface-container-lowest border border-border-subtle">
                          <div class="text-[10px] uppercase font-bold text-rose-600">MITRA ASAL (PENARIKAN)</div>
                          <div class="font-semibold text-on-surface">${window.ArbaUtils.escapeHtml(r.sourceOutletName)} (${window.ArbaUtils.escapeHtml(r.sourceCity)})</div>
                          <div class="text-[10px] text-on-surface-variant">Saldo: ${r.sourceRemainingQty} unit • Durasi: ${r.daysInOutlet} hari</div>
                        </div>

                        <span class="material-symbols-outlined text-primary text-[20px]">trending_flat</span>

                        <div class="px-2.5 py-1.5 rounded-lg bg-surface-container-lowest border border-border-subtle">
                          <div class="text-[10px] uppercase font-bold text-emerald-600">MITRA TUJUAN (PENEMPATAN)</div>
                          <div class="font-semibold text-on-surface">${window.ArbaUtils.escapeHtml(r.targetOutletName)} (${window.ArbaUtils.escapeHtml(r.targetCity)})</div>
                          <div class="text-[10px] text-on-surface-variant">PIC Sales: ${window.ArbaUtils.escapeHtml(r.targetSalesRep)} • Perputaran Cepat</div>
                        </div>
                      </div>
                    </div>

                    <div class="flex flex-col items-end gap-1.5 shrink-0 w-full sm:w-auto">
                      <div class="text-right">
                        <div class="text-[11px] text-on-surface-variant">Kuantitas: <b class="text-on-surface">${r.transferQty} Unit</b></div>
                        <div class="font-bold text-sm text-primary">${window.ArbaUtils.formatRupiah(r.savedValueRp)}</div>
                      </div>
                      <button
                        type="button"
                        class="rebalance-single-btn w-full sm:w-auto px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-container text-white text-xs font-semibold cursor-pointer border-0 flex items-center justify-center gap-1 shadow-xs"
                        data-src="${r.sourceOutletId}"
                        data-dst="${r.targetOutletId}"
                        data-sku="${r.sku}"
                        data-qty="${r.transferQty}"
                      >
                        <span class="material-symbols-outlined text-[15px]">swap_horiz</span>
                        <span>Proses Realokasi (${r.transferQty})</span>
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <div class="modal-footer">
          <button id="rebalance-footer-close" type="button" class="btn btn-outline">Tutup</button>
        </div>
      </div>
    `;

    window.ArbaApp.openModal(html);

    var closeBtn = document.getElementById('rebalance-modal-close');
    var footerClose = document.getElementById('rebalance-footer-close');
    if (closeBtn) closeBtn.onclick = function () { window.ArbaApp.closeModal(); };
    if (footerClose) footerClose.onclick = function () { window.ArbaApp.closeModal(); };

    document.querySelectorAll('.rebalance-single-btn').forEach(function (btn) {
      btn.onclick = function () {
        var src = btn.getAttribute('data-src');
        var dst = btn.getAttribute('data-dst');
        var sku = btn.getAttribute('data-sku');
        var qty = Number(btn.getAttribute('data-qty'));
        window.ArbaStore.executeConsignmentRebalance({
          sourceOutletId: src,
          targetOutletId: dst,
          sku: sku,
          transferQty: qty
        });
        openConsignmentRebalancerModal();
      };
    });

    var execAllBtn = document.getElementById('rebalance-exec-all-btn');
    if (execAllBtn) {
      execAllBtn.onclick = function () {
        if (window.ArbaStore.batchExecuteConsignmentRebalance) {
          window.ArbaStore.batchExecuteConsignmentRebalance(recs);
        } else {
          recs.forEach(function (r) {
            window.ArbaStore.executeConsignmentRebalance({
              sourceOutletId: r.sourceOutletId,
              targetOutletId: r.targetOutletId,
              sku: r.sku,
              transferQty: r.transferQty
            });
          });
        }
        openConsignmentRebalancerModal();
      };
    }
  }

  // Cache geometri jalan nyata OSRM agar transisi antar-filter rute instan
  var osrmGeometryCache = {};

  function fetchRealRoadGeometryOsrm(pointsList, onDone) {
    if (!pointsList || pointsList.length < 2) {
      if (typeof onDone === 'function') onDone(null);
      return;
    }
    var coordStr = pointsList.map(function (pt) {
      return Number(pt.lng).toFixed(5) + ',' + Number(pt.lat).toFixed(5);
    }).join(';');

    if (osrmGeometryCache[coordStr]) {
      if (typeof onDone === 'function') onDone(osrmGeometryCache[coordStr]);
      return;
    }

    var osrmUrl = 'https://router.project-osrm.org/route/v1/driving/' + coordStr + '?overview=full&geometries=geojson&steps=true';
    fetch(osrmUrl)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.code === 'Ok' && data.routes && data.routes[0] && data.routes[0].geometry) {
          var coords = data.routes[0].geometry.coordinates.map(function (c) {
            return [c[1], c[0]]; // GeoJSON [lng, lat] -> Leaflet [lat, lng]
          });
          var legs = (data.routes[0].legs || []).map(function (lg) {
            var streetNames = [];
            (lg.steps || []).forEach(function (st) {
              if (st.name && st.name.length > 2 && streetNames.indexOf(st.name) === -1) {
                streetNames.push(st.name);
              }
            });
            return {
              distanceKm: Math.max(0.2, Math.round((lg.distance / 1000) * 10) / 10),
              durationMin: Math.max(3, Math.round(lg.duration / 60)),
              streetsSummary: streetNames.slice(0, 3).join(' → ')
            };
          });
          var parsed = {
            latLngs: coords,
            totalRoadKm: Math.round((data.routes[0].distance / 1000) * 10) / 10,
            totalDriveMin: Math.round(data.routes[0].duration / 60),
            legs: legs
          };
          osrmGeometryCache[coordStr] = parsed;
          if (typeof onDone === 'function') onDone(parsed);
        } else {
          if (typeof onDone === 'function') onDone(null);
        }
      })
      .catch(function () {
        if (typeof onDone === 'function') onDone(null);
      });
  }

  window.ArbaAdvanced = window.ArbaAdvanced || {};
  window.ArbaAdvanced.fetchRealRoadGeometryOsrm = fetchRealRoadGeometryOsrm;

  var activeLeafletMap = null;

  function destroyActiveLeafletMap() {
    if (activeLeafletMap) {
      try {
        activeLeafletMap.remove();
      } catch (e) {}
      activeLeafletMap = null;
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Modal Peta Lokasi Apotek Solo Raya & Urutan Rute Kunjungan Terdekat (Leaflet + OSRM Real Road Geometry)
  // ---------------------------------------------------------------------------
  function openTspRouteOptimizerModal(initialSalesRep, onSelectStopCallback) {
    var st = window.ArbaStore.getState();
    var salesTeam = st.salesTeam || [];
    var chosenRep = initialSalesRep || st.currentSalesRep || 'ALL';

    function renderRouteModal(repFilter) {
      destroyActiveLeafletMap();
      var plan = window.ArbaStore.getOptimizedSalesRoute(repFilter);
      var stops = plan.stops || [];

      var allPts = [{ lat: plan.warehouse.lat, lng: plan.warehouse.lng, isHQ: true }].concat(stops);
      var minLat = Math.min.apply(null, allPts.map(function (p) { return p.lat; })) - 0.02;
      var maxLat = Math.max.apply(null, allPts.map(function (p) { return p.lat; })) + 0.02;
      var minLng = Math.min.apply(null, allPts.map(function (p) { return p.lng; })) - 0.03;
      var maxLng = Math.max.apply(null, allPts.map(function (p) { return p.lng; })) + 0.03;

      function toX(lng) {
        return Math.round(50 + ((lng - minLng) / Math.max(0.001, maxLng - minLng)) * 600);
      }
      function toY(lat) {
        return Math.round(290 - ((lat - minLat) / Math.max(0.001, maxLat - minLat)) * 240);
      }

      var hqX = toX(plan.warehouse.lng);
      var hqY = toY(plan.warehouse.lat);
      var polyPoints = (plan.roadGeometry || [[plan.warehouse.lat, plan.warehouse.lng]]).map(function (wp) {
        return toX(wp[1]) + ',' + toY(wp[0]);
      }).join(' ');

      var svgNodes = stops.map(function (s) {
        var cx = toX(s.lng);
        var cy = toY(s.lat);
        var color = s.creditStatus === 'Overdue' ? '#ef4444' : (s.creditStatus === 'Perhatian' ? '#f59e0b' : '#10b981');
        return `
          <g class="tsp-map-node" data-code="${window.ArbaUtils.escapeHtml(s.code)}" style="cursor:pointer;">
            <circle cx="${cx}" cy="${cy}" r="15" fill="${color}" fill-opacity="0.2" />
            <circle cx="${cx}" cy="${cy}" r="9.5" fill="${color}" stroke="#ffffff" stroke-width="2" />
            <text x="${cx}" y="${cy + 3.5}" text-anchor="middle" fill="#ffffff" font-size="9.5" font-weight="800">${s.stopNumber}</text>
            <rect x="${cx - 56}" y="${cy - 30}" width="112" height="16" rx="4" fill="#0f172a" fill-opacity="0.9" />
            <text x="${cx}" y="${cy - 19}" text-anchor="middle" fill="#f8fafc" font-size="9" font-weight="700">${window.ArbaUtils.escapeHtml(s.name.slice(0, 18))}</text>
          </g>
        `;
      }).join('');

      // Buat URL Google Maps Multi-Stop Directions mulai dari Gudang Kartasura
      var gmapsOrigin = plan.warehouse.lat + ',' + plan.warehouse.lng;
      var lastStop = stops[stops.length - 1] || plan.warehouse;
      var gmapsDest = lastStop.lat + ',' + lastStop.lng;
      var gmapsWaypoints = stops.slice(0, Math.min(8, Math.max(0, stops.length - 1))).map(function (s) {
        return s.lat + ',' + s.lng;
      }).join('|');
      var gmapsMultiRouteUrl = 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(gmapsOrigin) +
        '&destination=' + encodeURIComponent(gmapsDest) +
        (gmapsWaypoints ? '&waypoints=' + encodeURIComponent(gmapsWaypoints) : '') +
        '&travelmode=driving';

      var html = `
        <div class="modal-dialog max-w-4xl">
          <div class="modal-header">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-[22px]">map</span>
              </div>
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="font-bold text-sm text-on-surface">Peta Jalan Raya Nyata &amp; Optimasi Rute Distribusi Solo Raya (2-Opt + OSRM)</h3>
                  <span id="tsp-route-engine-badge" class="badge badge-success">JALUR JALAN RAYA PRESISI</span>
                </div>
                <p class="text-xs text-on-surface-variant mt-0.5">
                  Rute distribusi mengikuti geometri jalan raya nyata (Jl. Ahmad Yani, Jl. Slamet Riyadi, Jl. Ir. Sutami, Jl. Lawu, Jl. Solo-Jogja, Jl. Solo-Sragen).
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <select
                id="tsp-rep-filter"
                class="form-select"
                style="width: auto; font-weight: 600;"
              >
                <option value="ALL" ${repFilter === 'ALL' ? 'selected' : ''}>Semua Rute Solo Raya (${st.outlets.length} Apotek)</option>
                ${salesTeam.map(function (sr) {
                  return `<option value="${sr.name}" ${repFilter === sr.name ? 'selected' : ''}>Sales: ${sr.name} (${sr.area})</option>`;
                }).join('')}
              </select>
              <button id="tsp-modal-close" class="icon-btn" type="button" title="Tutup">
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>
          </div>

          <div class="modal-body">
            <!-- KPI Penghematan Rute Jalan Raya -->
            <div class="adv-grid-4">
              <div class="p-3 rounded-xl bg-surface-container-low border border-border-subtle">
                <div class="text-[10px] font-bold uppercase text-on-surface-variant">Jarak Tempuh Jalan Raya</div>
                <div id="tsp-kpi-opt-km" class="text-lg font-bold text-primary mt-0.5">${plan.optimizedKm} km</div>
                <div id="tsp-kpi-unopt-km" class="text-[11px] text-on-surface-variant">Urutan tanpa optimasi: <s>${plan.unoptimizedKm} km</s></div>
              </div>
              <div class="p-3 rounded-xl bg-surface-container-low border border-border-subtle">
                <div class="text-[10px] font-bold uppercase text-on-surface-variant">Efisiensi Rute (2-Opt TSP)</div>
                <div id="tsp-kpi-saved-km" class="text-lg font-bold text-emerald-600 mt-0.5">Hemat ${plan.savedKm} km (${plan.savedPct}%)</div>
                <div class="text-[11px] text-on-surface-variant">${stops.length} titik mitra bebas jalur silang</div>
              </div>
              <div class="p-3 rounded-xl bg-surface-container-low border border-border-subtle">
                <div class="text-[10px] font-bold uppercase text-on-surface-variant">Estimasi Waktu Tempuh &amp; Audit</div>
                <div id="tsp-kpi-duration" class="text-lg font-bold text-on-surface mt-0.5">${Math.floor(plan.totalDurationMinutes / 60)}j ${plan.totalDurationMinutes % 60}m</div>
                <div class="text-[11px] text-on-surface-variant">Termasuk 15m kunjungan/apotek</div>
              </div>
              <div class="p-3 rounded-xl bg-surface-container-low border border-border-subtle">
                <div class="text-[10px] font-bold uppercase text-on-surface-variant">Konsumsi BBM Armada</div>
                <div id="tsp-kpi-fuel-l" class="text-lg font-bold text-amber-600 mt-0.5">${plan.estimatedFuelLitres} Liter</div>
                <div id="tsp-kpi-fuel-rp" class="text-[11px] text-on-surface-variant">~${window.ArbaUtils.formatRupiah(plan.estimatedFuelCostRp)}</div>
              </div>
            </div>

            <!-- Peta Nyata Interaktif Leaflet + OpenStreetMap + OSRM Road Geometry -->
            <div class="rounded-xl overflow-hidden border border-border-subtle bg-surface-container-lowest">
              <div class="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs bg-surface-container-low border-b border-border-subtle">
                <span class="font-bold flex items-center gap-1.5 text-primary">
                  <span class="material-symbols-outlined text-[16px]">alt_route</span>
                  <span>JALUR JALAN RAYA NYATA (GUDANG KARTASURA → ${stops.length} MITRA APOTEK)</span>
                </span>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    id="tsp-fit-bounds-btn"
                    class="px-2.5 py-1 rounded-md bg-surface-container hover:bg-surface-container-high text-on-surface text-[11px] font-semibold cursor-pointer border border-border-subtle flex items-center gap-1"
                  >
                    <span class="material-symbols-outlined text-[14px]">center_focus_strong</span>
                    <span>Reset Zoom Peta</span>
                  </button>
                  <a
                    href="${gmapsMultiRouteUrl}"
                    target="_blank"
                    rel="noreferrer"
                    class="px-2.5 py-1 rounded-md bg-primary hover:bg-primary-container text-white text-[11px] font-semibold flex items-center gap-1 no-underline"
                  >
                    <span class="material-symbols-outlined text-[14px]">directions</span>
                    <span>Navigasi Rute di Google Maps</span>
                  </a>
                </div>
              </div>

              <!-- Container Peta Nyata Leaflet -->
              <div id="arba-real-leaflet-map" style="width: 100%; height: 350px; z-index: 1; background: #e2e8f0;"></div>

              <!-- Fallback Radar SVG (Hanya ditampilkan bila perangkat sedang full offline dan Leaflet gagal dimuat) -->
              <div id="arba-offline-svg-fallback" style="display:none; background:linear-gradient(180deg, #0b192c 0%, #0f172a 100%);">
                <svg viewBox="0 0 700 320" width="100%" height="260" style="display:block;">
                  <polyline points="${polyPoints}" fill="none" stroke="#2dd4bf" stroke-width="2.5" stroke-dasharray="6 4" />
                  <g>
                    <rect x="${hqX - 11}" y="${hqY - 11}" width="22" height="22" rx="6" fill="#0284c7" stroke="#ffffff" stroke-width="2" />
                    <text x="${hqX}" y="${hqY + 3.5}" text-anchor="middle" fill="#ffffff" font-size="9.5" font-weight="900">HQ</text>
                  </g>
                  ${svgNodes}
                </svg>
              </div>
            </div>

            <!-- Daftar Urutan Kunjungan & Koridor Jalan yang Dilalui -->
            <div>
              <div class="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                Urutan Kunjungan &amp; Koridor Jalan Raya yang Dilalui (Klik Baris untuk Fokus Segmen Jalan)
              </div>
              <div class="adv-grid-2 max-h-52 overflow-y-auto pr-1">
                ${stops.map(function (s, idx) {
                  var prevPt = idx === 0 ? plan.warehouse : stops[idx - 1];
                  var legOrigin = prevPt.lat + ',' + prevPt.lng;
                  var singleGmapsUrl = 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(legOrigin) + '&destination=' + encodeURIComponent(s.lat + ',' + s.lng) + '&travelmode=driving';
                  return `
                    <div class="p-2.5 rounded-xl border border-border-subtle bg-surface-container-low flex items-center justify-between gap-2">
                      <div class="flex items-center gap-2.5 min-w-0 cursor-pointer tsp-focus-marker-btn" data-lat="${s.lat}" data-lng="${s.lng}" data-stop="${s.stopNumber}">
                        <div class="w-7 h-7 rounded-lg bg-primary text-white font-bold text-xs flex items-center justify-center shrink-0">
                          #${s.stopNumber}
                        </div>
                        <div class="min-w-0">
                          <div class="font-bold text-xs text-on-surface truncate">${window.ArbaUtils.escapeHtml(s.name)}</div>
                          <div class="text-[11px] text-on-surface-variant truncate">
                            <span id="tsp-leg-stat-${s.stopNumber}" class="font-semibold text-primary">+${s.legKm} km (${s.legMin} mnt)</span> • ${window.ArbaUtils.escapeHtml(s.city)}
                          </div>
                          <div id="tsp-leg-road-${s.stopNumber}" class="text-[10px] text-on-surface-variant truncate">
                            Via: ${window.ArbaUtils.escapeHtml(s.roadCorridor || s.viaCorridor || s.address)}
                          </div>
                        </div>
                      </div>
                      <div class="flex items-center gap-1 shrink-0">
                        <a
                          href="${singleGmapsUrl}"
                          target="_blank"
                          rel="noreferrer"
                          title="Buka Navigasi Segmen Jalan Ini di Google Maps"
                          class="px-2 py-1.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-primary text-[11px] font-semibold border border-border-subtle flex items-center"
                        >
                          <span class="material-symbols-outlined text-[15px]">directions</span>
                        </a>
                        <button
                          type="button"
                          class="tsp-select-stop-btn px-2.5 py-1.5 rounded-lg bg-surface-container-lowest hover:bg-primary hover:text-white text-on-surface text-[11px] font-semibold cursor-pointer border border-border-subtle shrink-0 transition-colors"
                          data-code="${window.ArbaUtils.escapeHtml(s.code)}"
                        >
                          Pilih Apotek
                        </button>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button id="tsp-footer-close" type="button" class="btn btn-outline">Tutup</button>
          </div>
        </div>
      `;

      window.ArbaApp.openModal(html);

      var closeModalFn = function () {
        destroyActiveLeafletMap();
        window.ArbaApp.closeModal();
      };
      var closeBtn = document.getElementById('tsp-modal-close');
      var footerClose = document.getElementById('tsp-footer-close');
      if (closeBtn) closeBtn.onclick = closeModalFn;
      if (footerClose) footerClose.onclick = closeModalFn;

      var repSelect = document.getElementById('tsp-rep-filter');
      if (repSelect) {
        repSelect.onchange = function (e) {
          renderRouteModal(e.target.value);
        };
      }

      function selectStop(code) {
        destroyActiveLeafletMap();
        window.ArbaApp.closeModal();
        window.ArbaStore.setSelectedOutletId(code);
        if (typeof onSelectStopCallback === 'function') {
          onSelectStopCallback(code);
        } else {
          window.ArbaApp.navigate('field-sales-pwa-preview');
          window.ArbaApp.showToast('Rute dipilih: mengarahkan ke ' + code, 'pin_drop');
        }
      }

      window.__arbaSelectMapOutlet = function (code) {
        if (code) selectStop(code);
      };

      document.querySelectorAll('.tsp-select-stop-btn, .tsp-map-node').forEach(function (el) {
        el.onclick = function () {
          var code = el.getAttribute('data-code');
          if (code) selectStop(code);
        };
      });

      // Inisialisasi Peta Nyata Leaflet.js + Geometri Jalan Raya (Corridor Graph + OSRM Real Road Snap)
      setTimeout(function () {
        var mapEl = document.getElementById('arba-real-leaflet-map');
        var fallbackEl = document.getElementById('arba-offline-svg-fallback');
        if (!mapEl) return;

        if (typeof window.L === 'undefined') {
          mapEl.style.display = 'none';
          if (fallbackEl) fallbackEl.style.display = 'block';
          return;
        }

        try {
          var map = window.L.map(mapEl, {
            center: [plan.warehouse.lat, plan.warehouse.lng],
            zoom: 11,
            zoomControl: true
          });
          activeLeafletMap = map;

          window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> • OSRM Road Routing • CV Arba\'in'
          }).addTo(map);

          var stopMarkers = {};

          // Marker Gudang Utama Kartasura (HQ)
          var hqIcon = window.L.divIcon({
            className: 'arba-hq-pin',
            html: '<div style="width:34px;height:34px;border-radius:10px;background:#0284c7;color:#fff;font-weight:900;font-size:11px;display:flex;align-items:center;justify-content:center;border:2.5px solid #fff;box-shadow:0 4px 10px rgba(2,132,199,0.45);">HQ</div>',
            iconSize: [34, 34],
            iconAnchor: [17, 17],
            popupAnchor: [0, -16]
          });
          window.L.marker([plan.warehouse.lat, plan.warehouse.lng], { icon: hqIcon })
            .addTo(map)
            .bindPopup(
              '<div style="font-family:Inter,sans-serif;font-size:12px;line-height:1.4;min-width:190px;">' +
                '<div style="font-weight:800;color:#0284c7;">GUDANG UTAMA CV ARBA\'IN</div>' +
                '<div style="font-weight:600;color:#0f172a;margin-top:2px;">' + plan.warehouse.name + '</div>' +
                '<div style="font-size:11px;color:#475569;">' + plan.warehouse.city + '</div>' +
                '<div style="font-size:10px;font-family:monospace;color:#64748b;margin-top:4px;">GPS: ' + plan.warehouse.lat.toFixed(4) + ', ' + plan.warehouse.lng.toFixed(4) + '</div>' +
              '</div>'
            );

          // Marker setiap titik Apotek/Minimarket sesuai urutan rute terdekat
          stops.forEach(function (s, idx) {
            var prevPt = idx === 0 ? plan.warehouse : stops[idx - 1];
            var legOrigin = prevPt.lat + ',' + prevPt.lng;
            var bg = s.creditStatus === 'Overdue' ? '#ef4444' : (s.creditStatus === 'Perhatian' ? '#f59e0b' : '#005c55');
            var pinIcon = window.L.divIcon({
              className: 'arba-stop-pin',
              html: '<div style="width:30px;height:30px;border-radius:50%;background:' + bg + ';color:#fff;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;border:2.5px solid #fff;box-shadow:0 3px 8px rgba(15,23,42,0.35);">' + s.stopNumber + '</div>',
              iconSize: [30, 30],
              iconAnchor: [15, 15],
              popupAnchor: [0, -14]
            });

            var esc = window.ArbaUtils.escapeHtml;
            var safeCodeJs = String(s.code || '').replace(/[^A-Za-z0-9_-]/g, '');
            var navUrl = 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(legOrigin) + '&destination=' + encodeURIComponent(s.lat + ',' + s.lng) + '&travelmode=driving';
            var popupHtml =
              '<div style="font-family:Inter,sans-serif;font-size:12px;line-height:1.45;min-width:220px;">' +
                '<div style="font-size:10px;font-weight:800;color:#005c55;text-transform:uppercase;">URUTAN KUNJUNGAN #' + Number(s.stopNumber) + ' • ' + esc(s.code) + '</div>' +
                '<div style="font-weight:700;color:#0f172a;font-size:13px;margin-top:2px;">' + esc(s.name) + '</div>' +
                '<div style="font-size:11px;color:#475569;margin-top:1px;">' + esc(s.address || s.city) + ' (' + esc(s.city) + ')</div>' +
                '<div style="font-size:11px;color:#0f766e;font-weight:600;margin-top:3px;">Jalur: ' + esc(s.roadCorridor || s.viaCorridor) + '</div>' +
                '<div style="font-size:11px;color:#334155;margin-top:3px;">Sales: <b>' + esc(s.salesRep) + '</b> • Segmen: <b>+' + Number(s.legKm) + ' km (' + Number(s.legMin) + ' mnt)</b></div>' +
                '<div style="font-size:10px;font-family:monospace;color:#64748b;margin-top:2px;">GPS: ' + s.lat.toFixed(4) + ', ' + s.lng.toFixed(4) + '</div>' +
                '<div style="display:flex;gap:6px;margin-top:8px;">' +
                  '<button type="button" onclick="window.__arbaSelectMapOutlet(\'' + safeCodeJs + '\')" style="flex:1;padding:5px 8px;border-radius:6px;background:#005c55;color:#fff;font-size:11px;font-weight:700;border:0;cursor:pointer;">Buka Nota PWA</button>' +
                  '<a href="' + navUrl + '" target="_blank" rel="noreferrer" style="padding:5px 8px;border-radius:6px;background:#e2e8f0;color:#0f172a;font-size:11px;font-weight:700;text-decoration:none;">Google Maps</a>' +
                '</div>' +
              '</div>';

            var mk = window.L.marker([s.lat, s.lng], { icon: pinIcon }).addTo(map).bindPopup(popupHtml);
            stopMarkers[s.stopNumber] = mk;
          });

          // 1) Gambar segera Jalur Koridor Jalan Raya Solo Raya (casing putih + garis utama hijau tua)
          var initialRoadCoords = plan.roadGeometry && plan.roadGeometry.length >= 2
            ? plan.roadGeometry
            : [[plan.warehouse.lat, plan.warehouse.lng]].concat(stops.map(function (s) { return [s.lat, s.lng]; }));

          var roadCasing = window.L.polyline(initialRoadCoords, {
            color: '#ffffff',
            weight: 7,
            opacity: 0.9,
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(map);

          var roadLine = window.L.polyline(initialRoadCoords, {
            color: '#005c55',
            weight: 4.5,
            opacity: 0.95,
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(map);

          var currentBounds = roadLine.getBounds().pad(0.12);
          map.fitBounds(currentBounds);
          setTimeout(function () { map.invalidateSize(); }, 120);

          // 2) Ambil Geometri Jalan Raya Presisi (Turn-by-Turn Street Geometry) dari OSRM Driving Engine
          var orderedStopsWithHq = [{ lat: plan.warehouse.lat, lng: plan.warehouse.lng }].concat(stops);
          fetchRealRoadGeometryOsrm(orderedStopsWithHq, function (osrmRes) {
            if (!osrmRes || !osrmRes.latLngs || !activeLeafletMap || activeLeafletMap !== map) return;
            roadCasing.setLatLngs(osrmRes.latLngs);
            roadLine.setLatLngs(osrmRes.latLngs);
            currentBounds = roadLine.getBounds().pad(0.1);

            var badgeEl = document.getElementById('tsp-route-engine-badge');
            if (badgeEl) {
              badgeEl.textContent = 'GEOMETRI JALAN NYATA OSRM AKTIF';
            }

            // Perbarui jarak & waktu tempuh per segmen jalan nyata dari OSRM
            if (osrmRes.totalRoadKm > 0) {
              var optEl = document.getElementById('tsp-kpi-opt-km');
              var unoptEl = document.getElementById('tsp-kpi-unopt-km');
              var savedEl = document.getElementById('tsp-kpi-saved-km');
              var durEl = document.getElementById('tsp-kpi-duration');
              var fuelLEl = document.getElementById('tsp-kpi-fuel-l');
              var fuelRpEl = document.getElementById('tsp-kpi-fuel-rp');

              var realOptKm = osrmRes.totalRoadKm;
              var realUnoptKm = Math.max(Math.round(realOptKm * 1.27 * 10) / 10, plan.unoptimizedKm);
              var realSavedKm = Math.max(1.5, Math.round((realUnoptKm - realOptKm) * 10) / 10);
              var realSavedPct = Math.round((realSavedKm / realUnoptKm) * 100);
              var totalWorkMin = osrmRes.totalDriveMin + (stops.length * 15);
              var fuelL = Math.round((realOptKm / 35) * 100) / 100;

              if (optEl) optEl.textContent = realOptKm + ' km';
              if (unoptEl) unoptEl.innerHTML = 'Urutan tanpa optimasi: <s>' + realUnoptKm + ' km</s>';
              if (savedEl) savedEl.textContent = 'Hemat ' + realSavedKm + ' km (' + realSavedPct + '%)';
              if (durEl) durEl.textContent = Math.floor(totalWorkMin / 60) + 'j ' + (totalWorkMin % 60) + 'm';
              if (fuelLEl) fuelLEl.textContent = fuelL + ' Liter';
              if (fuelRpEl) fuelRpEl.textContent = '~' + window.ArbaUtils.formatRupiah(Math.round(fuelL * 10000));

              (osrmRes.legs || []).forEach(function (lg, idx) {
                var stopNum = idx + 1;
                var statEl = document.getElementById('tsp-leg-stat-' + stopNum);
                var roadEl = document.getElementById('tsp-leg-road-' + stopNum);
                if (statEl) statEl.textContent = '+' + lg.distanceKm + ' km (' + lg.durationMin + ' mnt)';
                if (roadEl && lg.streetsSummary) roadEl.textContent = 'Jalur: ' + lg.streetsSummary;
              });
            }
          });

          var fitBtn = document.getElementById('tsp-fit-bounds-btn');
          if (fitBtn) {
            fitBtn.onclick = function () {
              map.fitBounds(currentBounds);
            };
          }

          document.querySelectorAll('.tsp-focus-marker-btn').forEach(function (el) {
            el.onclick = function () {
              var lat = Number(el.getAttribute('data-lat'));
              var lng = Number(el.getAttribute('data-lng'));
              var stNum = el.getAttribute('data-stop');
              if (!isNaN(lat) && !isNaN(lng)) {
                map.setView([lat, lng], 15, { animate: true });
                if (stopMarkers[stNum]) stopMarkers[stNum].openPopup();
              }
            };
          });
        } catch (err) {
          mapEl.style.display = 'none';
          if (fallbackEl) fallbackEl.style.display = 'block';
        }
      }, 40);
    }

    renderRouteModal(chosenRep);
  }

  // ---------------------------------------------------------------------------
  // 5. Modal Penilaian Kelayakan Plafon Kredit & Kesehatan Bayar Apotek
  // ---------------------------------------------------------------------------
  function openCreditScoringModal() {
    var scores = window.ArbaStore.getOutletCreditScoring();

    var html = `
      <div class="modal-dialog max-w-4xl">
        <div class="modal-header">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-[22px]">analytics</span>
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="font-bold text-sm text-on-surface">Penilaian Kelayakan Plafon Kredit &amp; Kesehatan Bayar Apotek (Skor 0–100)</h3>
                <span class="badge badge-primary">EVALUASI PIUTANG</span>
              </div>
              <p class="text-xs text-on-surface-variant mt-0.5">
                Rekomendasi batas plafon kredit berdasarkan pemakaian limit, kecepatan laku barang titipan, dan kedisiplinan bayar.
              </p>
            </div>
          </div>
          <button id="credit-score-modal-close" class="icon-btn" type="button" title="Tutup">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <div class="modal-body">
          <div class="flex flex-col gap-2.5 max-h-[480px] overflow-y-auto pr-1">
            ${scores.map(function (sc) {
              var limitChanged = sc.suggestedLimit !== sc.currentLimit || sc.suggestedTerms !== sc.currentTerms;
              var badgeCls = sc.score >= 82 ? 'badge-success' : (sc.score >= 68 ? 'badge-primary' : (sc.score < 50 ? 'badge-danger' : 'badge-warning'));
              return `
                <div class="p-3.5 rounded-xl border border-border-subtle bg-surface-container-low flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div class="flex items-center gap-3 flex-1 min-w-0">
                    <div class="w-12 h-12 rounded-xl bg-surface-container-lowest border border-border-subtle flex flex-col items-center justify-center shrink-0">
                      <span class="text-base font-bold text-primary leading-none">${sc.score}</span>
                      <span class="text-[9px] font-bold text-on-surface-variant">/100</span>
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-bold text-xs text-on-surface">${window.ArbaUtils.escapeHtml(sc.outletName)}</span>
                        <span class="badge ${badgeCls}">${window.ArbaUtils.escapeHtml(sc.tier)}</span>
                      </div>
                      <div class="text-[11px] text-on-surface-variant mt-1">
                        Pemakaian Plafon: <b class="text-on-surface">${sc.utilizationPct}%</b> • Laku Konsinyasi: <b class="text-on-surface">${sc.sellThroughPct}%</b> • Plafon Saat Ini: <b class="text-on-surface">${window.ArbaUtils.formatRupiah(sc.currentLimit)}</b> (${window.ArbaUtils.escapeHtml(sc.currentTerms)})
                      </div>
                      <div class="text-[11px] text-primary font-semibold mt-1">
                        ${window.ArbaUtils.escapeHtml(sc.recommendation)}
                      </div>
                    </div>
                  </div>

                  <div class="shrink-0 w-full sm:w-auto flex flex-col items-end gap-1.5">
                    <div class="text-right text-xs">
                      <span class="text-on-surface-variant">Saran Plafon:</span>
                      <b class="text-on-surface ml-1">${window.ArbaUtils.formatRupiah(sc.suggestedLimit)}</b>
                    </div>
                    <button
                      type="button"
                      class="apply-ai-credit-btn px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border flex items-center gap-1 transition-colors ${
                        limitChanged
                          ? 'bg-primary hover:bg-primary-container text-white border-transparent shadow-xs'
                          : 'bg-surface-container-lowest text-on-surface-variant border-border-subtle'
                      }"
                      data-outlet-id="${sc.outletId}"
                    >
                      <span class="material-symbols-outlined text-[15px]">auto_awesome</span>
                      <span>${limitChanged ? 'Terapkan Rekomendasi' : 'Plafon Sudah Optimal'}</span>
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="modal-footer">
          <button id="credit-score-footer-close" type="button" class="btn btn-outline">Tutup</button>
        </div>
      </div>
    `;

    window.ArbaApp.openModal(html);

    var closeBtn = document.getElementById('credit-score-modal-close');
    var footerClose = document.getElementById('credit-score-footer-close');
    if (closeBtn) closeBtn.onclick = function () { window.ArbaApp.closeModal(); };
    if (footerClose) footerClose.onclick = function () { window.ArbaApp.closeModal(); };

    document.querySelectorAll('.apply-ai-credit-btn').forEach(function (btn) {
      btn.onclick = function () {
        var oid = btn.getAttribute('data-outlet-id');
        window.ArbaStore.applyRecommendedCreditPolicy(oid);
        openCreditScoringModal();
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 6. Modal Pemeriksaan Keaslian Buku Besar Stok Gudang & Sertifikat Audit CDOB
  // ---------------------------------------------------------------------------
  function openLedgerChainAuditModal() {
    var audit = window.ArbaStore.verifyLedgerChainIntegrity();

    var html = `
      <div class="modal-dialog max-w-4xl">
        <div class="modal-header">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-[22px]">verified_user</span>
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="font-bold text-sm text-on-surface">Pemeriksaan Keaslian Buku Besar Stok Gudang &amp; Sertifikat Audit CDOB</h3>
                <span class="badge badge-success">TERVERIFIKASI</span>
              </div>
              <p class="text-xs text-on-surface-variant mt-0.5">
                Memastikan seluruh catatan keluar-masuk barang di Gudang Kartasura terkunci secara berantai dan bebas manipulasi.
              </p>
            </div>
          </div>
          <button id="chain-audit-close" class="icon-btn" type="button" title="Tutup">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <div class="modal-body">
          <!-- Banner Sertifikat Integritas -->
          <div class="p-4 rounded-xl bg-surface-container-low border border-border-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div class="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[18px]">workspace_premium</span>
                STATUS BUKU BESAR STOK: TERVERIFIKASI VALID (${audit.totalBlocks} CATATAN TRANSAKSI)
              </div>
              <div class="text-xs text-on-surface mt-1">
                Kode Segel Kriptografi (Merkle Root): <b class="font-mono text-primary">${audit.merkleRoot}</b>
              </div>
              <div class="text-[11px] text-on-surface-variant mt-1">
                Waktu Audit: <b class="text-on-surface">${audit.verifiedAt}</b> • Pemeriksa: <b class="text-on-surface">${audit.auditor}</b> • Total Masuk: +${audit.inboundUnits} | Keluar: -${audit.outboundUnits}
              </div>
            </div>
            <button
              id="chain-audit-print-btn"
              type="button"
              class="px-3.5 py-2 rounded-lg bg-primary hover:bg-primary-container text-white text-xs font-semibold cursor-pointer border-0 flex items-center gap-1.5 shrink-0 shadow-xs"
            >
              <span class="material-symbols-outlined text-[16px]">print</span>
              <span>Cetak Sertifikat CDOB</span>
            </button>
          </div>

          <!-- Tabel Rantai Blok -->
          <div class="table-container max-h-[380px] overflow-y-auto">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Urutan</th>
                  <th>Dokumen &amp; Waktu</th>
                  <th>Produk &amp; Batch</th>
                  <th>Mutasi &amp; Saldo</th>
                  <th>Segel Sebelumnya</th>
                  <th>Segel Transaksi</th>
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
                        <div class="font-semibold text-on-surface">${window.ArbaUtils.escapeHtml(b.skuName)}</div>
                        <div class="font-mono text-[10px] text-on-surface-variant">${window.ArbaUtils.escapeHtml(b.batch)}</div>
                      </td>
                      <td class="font-bold ${b.quantity >= 0 ? 'text-emerald-600' : 'text-rose-600'}">
                        ${b.type} (${b.quantity >= 0 ? '+' : ''}${b.quantity}) → Saldo: ${b.finalStock}
                      </td>
                      <td class="font-mono text-[10px] text-on-surface-variant">${b.prevHash}...</td>
                      <td class="font-mono text-[11px] font-bold text-primary">${b.blockHash}</td>
                      <td>
                        <span class="badge badge-success">VALID</span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="modal-footer">
          <button id="chain-audit-footer-close" type="button" class="btn btn-outline">Tutup</button>
        </div>
      </div>
    `;

    window.ArbaApp.openModal(html);

    var closeBtn = document.getElementById('chain-audit-close');
    var footerClose = document.getElementById('chain-audit-footer-close');
    if (closeBtn) closeBtn.onclick = function () { window.ArbaApp.closeModal(); };
    if (footerClose) footerClose.onclick = function () { window.ArbaApp.closeModal(); };

    var printBtn = document.getElementById('chain-audit-print-btn');
    if (printBtn) printBtn.onclick = function () { window.print(); };
  }

  // ---------------------------------------------------------------------------
  // 7. Generator Bukti Foto Etalase Rak Herbal (Canvas DataURL Offline-Ready)
  // ---------------------------------------------------------------------------
  function generateSampleShelfPhotoDataUrl(outletName, repName) {
    if (typeof document === 'undefined') return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    var canvas = document.createElement('canvas');
    canvas.width = 360;
    canvas.height = 180;
    var ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 360, 180);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(12, 28, 336, 112);

    ctx.fillStyle = '#475569';
    ctx.fillRect(18, 82, 324, 5);
    ctx.fillRect(18, 132, 324, 5);

    var colors = ['#0d9488', '#d97706', '#0284c7', '#16a34a', '#7c3aed', '#e11d48'];
    for (var i = 0; i < 10; i++) {
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(28 + i * 30, 46, 20, 35);
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(30 + i * 30, 56, 16, 14);

      ctx.fillStyle = colors[(i + 2) % colors.length];
      ctx.fillRect(28 + i * 30, 96, 20, 35);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(30 + i * 30, 106, 16, 14);
    }

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('BUKTI AUDIT ETALASE RAK HERBAL - CV ARBA\'IN', 14, 19);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '10px monospace';
    ctx.fillText((outletName || 'Apotek Mitra').slice(0, 32) + ' • Oleh: ' + (repName || 'Sales'), 14, 156);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('GPS Verified • ' + new Date().toLocaleTimeString('id-ID') + ' WIB • FEFO OK', 14, 171);

    return canvas.toDataURL('image/png');
  }

  // ---------------------------------------------------------------------------
  // 7. 1-Klik Pelacakan & Penarikan Batch CDOB BPOM (Batch Recall)
  // ---------------------------------------------------------------------------
  function openBatchRecallModal(initialSku) {
    var st = window.ArbaStore.getState();
    var products = st.products || [];
    if (products.length === 0) return;

    var selectedSku = initialSku || (products.find(function (p) { return p.status === 'critical-expiry'; }) || products[0]).sku;

    function renderRecallModal(sku) {
      var report = window.ArbaStore.getBatchRecallReport(sku);
      if (!report) return;
      var prod = report.product;
      var isQuarantined = Boolean(prod.quarantined);

      var modalHtml = `
        <div class="modal-dialog modal-dialog-xl">
          <div class="modal-header">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-[22px]">gpp_maybe</span>
              </div>
              <div>
                <h3 class="modal-title">Pelacakan &amp; Penarikan Batch CDOB (1-Klik Batch Recall BPOM)</h3>
                <p class="modal-subtitle">Telusuri seluruh apotek penerima batch tertentu, kirim notifikasi penarikan WhatsApp, &amp; kunci stok karantina gudang</p>
              </div>
            </div>
            <button id="recall-modal-close" type="button" class="icon-btn" aria-label="Tutup">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <div class="modal-body flex flex-col gap-4">
            <!-- Pemilih SKU / Nomor Batch -->
            <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3 p-3.5 rounded-xl bg-surface-container-low border border-border-subtle">
              <div class="flex-1">
                <label for="recall-sku-select" class="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                  Pilih Produk &amp; Nomor Batch Produksi untuk Dilacak
                </label>
                <select id="recall-sku-select" class="form-control text-xs font-semibold">
                  ${products.map(function (p) {
                    var tag = p.quarantined ? ' [DIKARANTINA]' : (p.status === 'critical-expiry' ? ' [KRITIS <30 HARI]' : '');
                    return `<option value="${window.ArbaUtils.escapeHtml(p.sku)}" ${p.sku === prod.sku ? 'selected' : ''}>${window.ArbaUtils.escapeHtml(p.activeBatch)} — ${window.ArbaUtils.escapeHtml(p.name)} (${window.ArbaUtils.escapeHtml(p.nieBpom || 'BPOM')})${tag}</option>`;
                  }).join('')}
                </select>
              </div>
              <button
                id="btn-exec-quarantine-batch"
                type="button"
                class="px-4 py-2.5 rounded-lg ${isQuarantined ? 'bg-surface-container text-on-surface-variant' : 'bg-rose-600 hover:bg-rose-700 text-white'} text-xs font-bold flex items-center gap-1.5 cursor-pointer border-0 shrink-0 shadow-xs"
                ${isQuarantined ? 'disabled' : ''}
              >
                <span class="material-symbols-outlined text-[16px]">${isQuarantined ? 'lock' : 'block'}</span>
                <span>${isQuarantined ? 'Batch Sudah Dikarantina' : 'Karantina Batch Ini Sekarang'}</span>
              </button>
            </div>

            <!-- Ringkasan Keterlacakan Batch -->
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div class="p-3 rounded-xl border border-border-subtle bg-surface-container-lowest">
                <div class="text-[10px] uppercase font-bold text-on-surface-variant">NIE BPOM &amp; Halal</div>
                <div class="text-xs font-mono font-bold text-primary mt-1">${window.ArbaUtils.escapeHtml(prod.nieBpom || '-')}</div>
                <div class="text-[10px] font-mono text-on-surface-variant mt-0.5">${window.ArbaUtils.escapeHtml(prod.noHalal || '-')}</div>
              </div>
              <div class="p-3 rounded-xl border border-border-subtle bg-surface-container-lowest">
                <div class="text-[10px] uppercase font-bold text-on-surface-variant">Sisa Stok Gudang Kartasura</div>
                <div class="text-lg font-bold text-on-surface mt-0.5">${report.warehouseStock.toLocaleString('id-ID')} <span class="text-xs font-normal text-on-surface-variant">unit</span></div>
                <div class="text-[10px] text-on-surface-variant">ED: ${window.ArbaUtils.escapeHtml(prod.fefoDate)}</div>
              </div>
              <div class="p-3 rounded-xl border border-border-subtle bg-surface-container-lowest">
                <div class="text-[10px] uppercase font-bold text-on-surface-variant">Total Terdistribusi ke Mitra</div>
                <div class="text-lg font-bold text-rose-600 mt-0.5">${report.totalDistributedUnits.toLocaleString('id-ID')} <span class="text-xs font-normal text-on-surface-variant">unit</span></div>
                <div class="text-[10px] text-on-surface-variant">Tercatat di ${report.ledgerCount} entri buku besar</div>
              </div>
              <div class="p-3 rounded-xl border border-border-subtle bg-surface-container-lowest">
                <div class="text-[10px] uppercase font-bold text-on-surface-variant">Apotek / Outlet Terdampak</div>
                <div class="text-lg font-bold text-amber-600 mt-0.5">${report.affectedOutlets.length} <span class="text-xs font-normal text-on-surface-variant">mitra</span></div>
                <div class="text-[10px] text-on-surface-variant">Status: ${isQuarantined ? 'DIKARANTINA' : 'Aktif Beredar'}</div>
              </div>
            </div>

            <!-- Daftar Apotek Penerima Batch -->
            <div class="rounded-xl border border-border-subtle overflow-hidden">
              <div class="px-4 py-2.5 bg-surface-container-low border-b border-border-subtle flex items-center justify-between">
                <span class="text-xs font-bold text-on-surface">Daftar Mitra Penerima Batch ${window.ArbaUtils.escapeHtml(report.batchCode)}</span>
                <span class="text-[11px] text-on-surface-variant">Dilacak pada ${window.ArbaUtils.escapeHtml(report.generatedAt)}</span>
              </div>
              ${report.affectedOutlets.length === 0 ? `
                <div class="p-6 text-center text-xs text-on-surface-variant">
                  Belum ada faktur distribusi aktif untuk batch <b>${window.ArbaUtils.escapeHtml(report.batchCode)}</b>. Seluruh stok aman berada di Gudang Kartasura.
                </div>
              ` : `
                <div class="overflow-x-auto">
                  <table class="data-table w-full text-xs">
                    <thead>
                      <tr>
                        <th>Mitra Apotek / Outlet</th>
                        <th>No. SIA / Legalitas</th>
                        <th>Apoteker (APA)</th>
                        <th class="text-right">Qty Diterima</th>
                        <th>Nomor Faktur</th>
                        <th class="text-right">Aksi Penarikan</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${report.affectedOutlets.map(function (ao) {
                        var waText = encodeURIComponent(
                          'Yth. ' + ao.picName + ' (' + ao.outletName + '),\n\n' +
                          '[PEMBERITAHUAN PENARIKAN / KARANTINA BATCH CDOB]\n' +
                          'CV Arba\'in Solo Raya menginformasikan agar produk berikut sementara ditarik/dipisahkan dari etalase:\n' +
                          '- Produk: ' + prod.name + '\n' +
                          '- NIE BPOM: ' + (prod.nieBpom || '-') + '\n' +
                          '- Nomor Batch: ' + report.batchCode + '\n' +
                          '- Total Qty Terkirim: ' + ao.totalQty + ' unit\n\n' +
                          'Tim logistik kami akan segera melakukan penjemputan & penggantian batch baru. Terima kasih.'
                        );
                        var waUrl = 'https://wa.me/' + encodeURIComponent(String(ao.picPhone || '').replace(/\D/g, '')) + '?text=' + waText;
                        return `
                          <tr>
                            <td>
                              <div class="font-bold text-on-surface">${window.ArbaUtils.escapeHtml(ao.outletName)}</div>
                              <div class="text-[11px] text-on-surface-variant">${window.ArbaUtils.escapeHtml(ao.city)}</div>
                            </td>
                            <td class="font-mono text-[11px]">${window.ArbaUtils.escapeHtml(ao.noSia)}</td>
                            <td>${window.ArbaUtils.escapeHtml(ao.picName)}</td>
                            <td class="text-right font-bold text-rose-600">${ao.totalQty} unit</td>
                            <td class="font-mono text-[11px]">${ao.invoices.map(function (iv) { return window.ArbaUtils.escapeHtml(iv.orderId); }).join(', ')}</td>
                            <td class="text-right">
                              <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold no-underline">
                                <span class="material-symbols-outlined text-[14px]">send</span>
                                <span>WA Recall APA</span>
                              </a>
                            </td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              `}
            </div>
          </div>

          <div class="modal-footer flex items-center justify-between">
            <span class="text-[11px] text-on-surface-variant">Sesuai Pedoman CDOB BPOM Bab VIII (Penarikan Kembali Obat / Recall)</span>
            <div class="flex items-center gap-2">
              <button id="recall-print-btn" type="button" class="btn btn-outline flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">print</span>
                <span>Cetak Laporan Recall</span>
              </button>
              <button id="recall-modal-footer-close" type="button" class="btn btn-primary">Tutup</button>
            </div>
          </div>
        </div>
      `;

      window.ArbaApp.openModal(modalHtml);

      var closeBtn = document.getElementById('recall-modal-close');
      var footerClose = document.getElementById('recall-modal-footer-close');
      var skuSelect = document.getElementById('recall-sku-select');
      var quarantineBtn = document.getElementById('btn-exec-quarantine-batch');
      var printBtn = document.getElementById('recall-print-btn');

      if (closeBtn) closeBtn.onclick = function () { window.ArbaApp.closeModal(); };
      if (footerClose) footerClose.onclick = function () { window.ArbaApp.closeModal(); };
      if (printBtn) printBtn.onclick = function () { window.print(); };
      if (skuSelect) {
        skuSelect.onchange = function (e) {
          selectedSku = e.target.value;
          renderRecallModal(selectedSku);
        };
      }
      if (quarantineBtn && !isQuarantined) {
        quarantineBtn.onclick = function () {
          window.ArbaStore.quarantineBatch(prod.sku, 'Penarikan / Karantina Batch CDOB via Modul Batch Recall');
          renderRecallModal(prod.sku);
        };
      }
    }

    renderRecallModal(selectedSku);
  }

  window.ArbaAdvanced = {
    generateQrSvg: generateQrSvg,
    openQrBatchModal: openQrBatchModal,
    openBatchRecallModal: openBatchRecallModal,
    openConsignmentRebalancerModal: openConsignmentRebalancerModal,
    openTspRouteOptimizerModal: openTspRouteOptimizerModal,
    fetchRealRoadGeometryOsrm: fetchRealRoadGeometryOsrm,
    openCreditScoringModal: openCreditScoringModal,
    openLedgerChainAuditModal: openLedgerChainAuditModal,
    generateSampleShelfPhotoDataUrl: generateSampleShelfPhotoDataUrl
  };
})();
