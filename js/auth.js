/**
 * =============================================================================
 * ArbaConnect ERP - Production Authentication & RBAC Session Manager (js/auth.js)
 * CV Arba'in Solo Raya
 * =============================================================================
 *
 * Fitur Utama (Production-Ready):
 * 1. Halaman Login Resmi (Clean Enterprise Login Portal) tanpa tampilan prototipe.
 * 2. Strict RBAC (Role-Based Access Control): Hanya menampilkan halaman yang
 *    diizinkan sesuai role user yang sedang login.
 * 3. Beroperasi 100% baik saat ONLINE (verifikasi via `/api/auth/login` SQL Server)
 *    maupun saat OFFLINE di lapangan (verifikasi kredensial ter-cache lokal).
 * 4. Untuk seluruh user selain Super Admin, klik tombol profil di pojok kanan atas
 *    langsung mengarahkan ke halaman `user-profile-settings`.
 */

(function () {
  'use strict';

  var ROLE_META = {
    'super-admin': {
      label: 'Super Administrator (Akses Penuh)',
      sqlRole: 'super_admin',
      icon: 'shield_person',
      badgeBg: '#f3e8ff',
      badgeText: '#6d28d9',
      desc: 'Kendali penuh seluruh 7 halaman sistem, pengelolaan semua akun pegawai, reset password & pengaturan izin akses divisi'
    },
    'executive': {
      label: 'Direktur & Manajemen Puncak',
      sqlRole: 'direktur',
      icon: 'monitoring',
      badgeBg: '#e6f4f1',
      badgeText: '#005c55',
      desc: 'Pemantauan omset bulanan, perkiraan produksi pabrik, peringatan stok menipis & barang hampir kedaluwarsa'
    },
    'inventory': {
      label: 'Admin Gudang & Logistik FEFO',
      sqlRole: 'admin_gudang',
      icon: 'warehouse',
      badgeBg: '#e0f2fe',
      badgeText: '#0369a1',
      desc: 'Pencatatan stok fisik Gudang Kartasura, urutan keluar kedaluwarsa terdekat (FEFO), & cek barang bawaan sales'
    },
    'sales-ops': {
      label: 'Admin Penjualan & Piutang Apotek',
      sqlRole: 'admin_penjualan',
      icon: 'fact_check',
      badgeBg: '#ede9fe',
      badgeText: '#5b21b6',
      desc: 'Pemeriksaan faktur pesanan sales, evaluasi batas plafon kredit apotek, & tagihan barang titip jual (konsinyasi)'
    },
    'field-sales': {
      label: 'Sales Lapangan (Aplikasi HP)',
      sqlRole: 'sales',
      icon: 'smartphone',
      badgeBg: '#fef3c7',
      badgeText: '#b45309',
      desc: 'Absen lokasi GPS di apotek, hitung barang titipan yang laku, tanda tangan apoteker & buat nota meski tanpa sinyal'
    }
  };

  var MODULE_LABELS = {
    'executive-dashboard': { name: 'Dasbor Direksi & Omset', icon: 'dashboard' },
    'inventory-stock-ledger': { name: 'Gudang & Buku Besar Stok FEFO', icon: 'inventory_2' },
    'b2b-crm-directory': { name: 'Data Apotek & Konsinyasi', icon: 'store' },
    'order-approval-queue': { name: 'Verifikasi Faktur & Kirim', icon: 'fact_check' },
    'field-sales-pwa-preview': { name: 'Aplikasi Sales Lapangan', icon: 'smartphone' },
    'user-management': { name: 'Kelola Semua Akun Pegawai', icon: 'manage_accounts' },
    'user-profile-settings': { name: 'Profil Saya & Ganti Password', icon: 'person_edit' }
  };

  function getUsers() {
    var st = window.ArbaStore ? window.ArbaStore.getState() : null;
    if (st && Array.isArray(st.users) && st.users.length > 0) return st.users;
    return (window.ArbaData && window.ArbaData.users) || [];
  }

  function findUserByCredentials(identifier, password) {
    var q = String(identifier || '').trim().toLowerCase();
    var pw = String(password || '').trim();
    if (!q || !pw) return { ok: false, message: 'Username/Email dan Password wajib diisi.' };

    var users = getUsers();
    var user = users.find(function (u) {
      return (
        String(u.username || '').toLowerCase() === q ||
        String(u.email || '').toLowerCase() === q ||
        String(u.id || '').toLowerCase() === q ||
        String(u.name || '').toLowerCase() === q
      );
    });

    if (!user) {
      return {
        ok: false,
        message: 'Username/Email atau Kata Sandi tidak sesuai.'
      };
    }

    if (user.active === false) {
      return {
        ok: false,
        message: 'Akun "' + user.name + '" sedang dinonaktifkan. Silakan hubungi Administrator.'
      };
    }

    var hashFn = (window.ArbaData && window.ArbaData.hashCredential) ||
      (window.ArbaUtils && window.ArbaUtils.hashCredential) ||
      function (s) { return String(s || ''); };
    var candidateHash = hashFn(pw);
    var seedUsers = (window.ArbaData && window.ArbaData.users) || [];
    var seedMatch = (!user.passwordChangedOnServer) ? seedUsers.find(function (su) {
      return su && (su.id === user.id || String(su.username || '').toLowerCase() === String(user.username || '').toLowerCase());
    }) : null;
    var expectedPwHash = user.passwordHash || (user.password ? hashFn(user.password) : '') || (seedMatch && seedMatch.passwordHash) || '';
    var expectedPinHash = user.pinHash || (user.pin ? hashFn(user.pin) : '') || (seedMatch && seedMatch.pinHash) || '';

    if (expectedPwHash && (candidateHash === expectedPwHash || (expectedPinHash && candidateHash === expectedPinHash))) {
      return { ok: true, user: user };
    }

    return {
      ok: false,
      message: 'Username/Email atau Kata Sandi tidak sesuai.'
    };
  }

  var localFailedAttempts = {};
  var MAX_LOCAL_ATTEMPTS = 5;
  var LOCAL_LOCKOUT_MS = 30 * 1000;

  function checkLocalRateLimit(identifier) {
    var key = String(identifier || '').trim().toLowerCase() || 'global';
    var rec = localFailedAttempts[key];
    if (rec && rec.count >= MAX_LOCAL_ATTEMPTS && (Date.now() - rec.lastAttempt) < LOCAL_LOCKOUT_MS) {
      var waitSec = Math.ceil((LOCAL_LOCKOUT_MS - (Date.now() - rec.lastAttempt)) / 1000);
      return {
        locked: true,
        message: 'Terlalu banyak percobaan login gagal. Akun dikunci sementara selama ' + waitSec + ' detik.'
      };
    }
    return { locked: false };
  }

  function recordLocalFailure(identifier) {
    var key = String(identifier || '').trim().toLowerCase() || 'global';
    var prev = localFailedAttempts[key] || { count: 0 };
    localFailedAttempts[key] = { count: prev.count + 1, lastAttempt: Date.now() };
  }

  function clearLocalFailure(identifier) {
    var key = String(identifier || '').trim().toLowerCase() || 'global';
    delete localFailedAttempts[key];
  }

  async function authenticate(identifier, password) {
    var rateCheck = checkLocalRateLimit(identifier);
    if (rateCheck.locked) {
      return { ok: false, message: rateCheck.message };
    }

    var st = window.ArbaStore ? window.ArbaStore.getState() : { isOnline: false };
    var browserOnline = typeof navigator === 'undefined' || navigator.onLine !== false;

    // 1. Bila sedang ONLINE, verifikasi ke Server Pusat SQLite (/api/auth/login) terlebih dahulu
    if (st.isOnline && browserOnline && typeof fetch === 'function') {
      try {
        var res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ identifier: identifier, password: password })
        });
        if (res.ok) {
          var data = await res.json();
          if (data && data.status === 'ok' && data.user) {
            clearLocalFailure(identifier);
            if (data.token && window.ArbaOfflineSync && typeof window.ArbaOfflineSync.setAuthToken === 'function') {
              window.ArbaOfflineSync.setAuthToken(data.token);
            }
            return { ok: true, user: data.user, token: data.token, mode: 'ONLINE_SQL' };
          }
        } else if (res.status === 401 || res.status === 403 || res.status === 429) {
          recordLocalFailure(identifier);
          var errData = await res.json().catch(function () { return {}; });
          return {
            ok: false,
            message: errData.message || 'Username/Email atau Kata Sandi tidak sesuai.'
          };
        }
      } catch (e) {
        // Jika fetch gagal karena server tidak terjangkau / jaringan terputus, lanjutkan ke verifikasi Offline-First di bawah
      }
    }

    // 2. Fallback OFFLINE-FIRST: Verifikasi terhadap kredensial ter-cache lokal (mendukung Password & PIN Offline)
    var localCheck = findUserByCredentials(identifier, password);
    if (localCheck.ok && localCheck.user) {
      clearLocalFailure(identifier);
      return { ok: true, user: localCheck.user, mode: 'OFFLINE_CACHE' };
    }

    recordLocalFailure(identifier);
    return {
      ok: false,
      message: localCheck.message || 'Username/Email atau Password tidak sesuai.'
    };
  }

  function ensureOverlayContainer() {
    var el = document.getElementById('arba-login-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'arba-login-overlay';
      document.body.appendChild(el);
    }
    return el;
  }

  function updateAppShellVisibility() {
    var st = window.ArbaStore ? window.ArbaStore.getState() : null;
    var appWrapper = document.querySelector('.app-wrapper');
    if (!appWrapper) return;
    if (!st || !st.currentUser) {
      appWrapper.style.display = 'none';
    } else {
      appWrapper.style.display = '';
    }
  }

  function hideLoginPortal() {
    var el = document.getElementById('arba-login-overlay');
    if (el) {
      el.style.display = 'none';
      el.innerHTML = '';
    }
    updateAppShellVisibility();
  }

  function showLoginPortal() {
    var overlay = ensureOverlayContainer();
    var st = window.ArbaStore.getState();

    updateAppShellVisibility();

    overlay.style.cssText = 'position:fixed; inset:0; z-index:9999; background:linear-gradient(135deg, #042f2e 0%, #0f172a 100%); display:flex; align-items:center; justify-content:center; padding:20px; overflow-y:auto;';

    overlay.innerHTML = `
      <div style="width:100%; max-width:440px; background:#ffffff; color:#0f172a; border-radius:22px; box-shadow:0 25px 60px -15px rgba(0,0,0,0.65); overflow:hidden; border:1px solid rgba(255,255,255,0.15); margin:auto;">
        <div style="padding:36px 32px; display:flex; flex-direction:column; justify-content:space-between; background:#ffffff;">
          <div>
            <!-- Brand Header -->
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:24px;">
              <div style="display:flex; align-items:center; gap:11px;">
                <div style="width:44px; height:44px; border-radius:12px; background:linear-gradient(135deg, #005c55, #0f766e); display:flex; align-items:center; justify-content:center; color:#ffffff; font-weight:800; font-size:18px; box-shadow:0 6px 14px rgba(0,92,85,0.28);">
                  <span class="material-symbols-outlined" style="font-size:24px;">medication_liquid</span>
                </div>
                <div>
                  <div style="font-size:19px; font-weight:800; color:#0f172a; letter-spacing:-0.02em; line-height:1.1;">ArbaConnect</div>
                  <div style="font-size:11.5px; font-weight:600; color:#005c55; margin-top:2px;">CV Arba'in Solo Raya</div>
                </div>
              </div>
              <span style="display:inline-flex; align-items:center; gap:5px; padding:4px 10px; border-radius:999px; font-size:11px; font-weight:700; background:${st.isOnline ? '#dcfce7' : '#fef3c7'}; color:${st.isOnline ? '#166534' : '#92400e'};">
                <span style="width:7px; height:7px; border-radius:50%; background:${st.isOnline ? '#16a34a' : '#d97706'}; display:inline-block;"></span>
                ${st.isOnline ? 'Server Online' : 'Mode Offline'}
              </span>
            </div>

            <h1 style="font-size:21px; font-weight:800; color:#0f172a; margin:0 0 6px 0;">Masuk ke Akun Anda</h1>
            <p style="font-size:12.5px; color:#64748b; margin:0 0 22px 0; line-height:1.5;">
              Masukkan username atau email resmi CV Arba'in beserta kata sandi Anda untuk mengakses sistem.
            </p>

            <!-- Error Alert -->
            <div id="auth-error-msg" style="display:none; padding:11px 13px; border-radius:10px; background:#fef2f2; border:1px solid #fecaca; color:#b91c1c; font-size:12px; font-weight:600; margin-bottom:16px;"></div>

            <!-- Form Login Resmi -->
            <form id="arba-login-form" style="display:flex; flex-direction:column; gap:16px;">
              <div>
                <label for="auth-identifier-input" style="display:block; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:#475569; margin-bottom:6px;">
                  Username atau Email
                </label>
                <div style="position:relative;">
                  <span class="material-symbols-outlined" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); font-size:18px; color:#64748b;">person</span>
                  <input
                    id="auth-identifier-input"
                    type="text"
                    required
                    autocomplete="username"
                    placeholder="Masukkan username atau email"
                    style="width:100%; padding:11px 12px 11px 40px; border-radius:10px; border:1.5px solid #cbd5e1; font-size:13.5px; color:#0f172a; background:#f8fafc; outline:none; box-sizing:border-box;"
                  />
                </div>
              </div>

              <div>
                <label for="auth-password-input" style="display:block; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:#475569; margin-bottom:6px;">
                  Kata Sandi / PIN Offline
                </label>
                <div style="position:relative;">
                  <span class="material-symbols-outlined" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); font-size:18px; color:#64748b;">lock</span>
                  <input
                    id="auth-password-input"
                    type="password"
                    required
                    autocomplete="current-password"
                    placeholder="Masukkan kata sandi"
                    style="width:100%; padding:11px 40px 11px 40px; border-radius:10px; border:1.5px solid #cbd5e1; font-size:13.5px; color:#0f172a; background:#f8fafc; outline:none; box-sizing:border-box;"
                  />
                  <button
                    id="auth-toggle-pw"
                    type="button"
                    title="Tampilkan / Sembunyikan Kata Sandi"
                    style="position:absolute; right:8px; top:50%; transform:translateY(-50%); background:transparent; border:0; color:#64748b; cursor:pointer; display:flex; align-items:center; padding:4px;"
                  >
                    <span class="material-symbols-outlined" id="auth-toggle-pw-icon" style="font-size:18px;">visibility</span>
                  </button>
                </div>
              </div>

              <div style="display:flex; align-items:center; justify-content:space-between; font-size:12px; color:#475569;">
                <label style="display:flex; align-items:center; gap:7px; cursor:pointer;">
                  <input type="checkbox" checked style="accent-color:#005c55; width:15px; height:15px;" />
                  <span>Simpan sesi untuk akses Offline</span>
                </label>
              </div>

              <button
                id="auth-submit-btn"
                type="submit"
                style="width:100%; padding:12px 16px; border-radius:10px; border:0; background:linear-gradient(135deg, #005c55, #0f766e); color:#ffffff; font-size:13.5px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; box-shadow:0 8px 18px rgba(0,92,85,0.28); margin-top:4px;"
              >
                <span class="material-symbols-outlined" style="font-size:18px;">login</span>
                <span>Masuk</span>
              </button>
            </form>
          </div>

          <!-- Footer Info -->
          <div style="margin-top:24px; padding-top:14px; border-top:1px solid #f1f5f9; display:flex; align-items:center; justify-content:space-between; font-size:11px; color:#64748b;">
            <span>🔒 Standar Distribusi CDOB &amp; FEFO</span>
            <span>CV Arba'in Solo Raya</span>
          </div>
        </div>
      </div>
    `;

    var idInput = document.getElementById('auth-identifier-input');
    if (idInput) {
      setTimeout(function () { idInput.focus(); }, 40);
    }

    var pwInput = document.getElementById('auth-password-input');
    var pwToggle = document.getElementById('auth-toggle-pw');
    var pwIcon = document.getElementById('auth-toggle-pw-icon');
    if (pwToggle && pwInput) {
      pwToggle.onclick = function () {
        if (pwInput.type === 'password') {
          pwInput.type = 'text';
          if (pwIcon) pwIcon.textContent = 'visibility_off';
        } else {
          pwInput.type = 'password';
          if (pwIcon) pwIcon.textContent = 'visibility';
        }
      };
    }

    var form = document.getElementById('arba-login-form');
    var errBox = document.getElementById('auth-error-msg');
    if (form) {
      form.onsubmit = async function (e) {
        e.preventDefault();
        var idVal = document.getElementById('auth-identifier-input').value;
        var pwVal = document.getElementById('auth-password-input').value;
        var res = await authenticate(idVal, pwVal);
        if (!res.ok) {
          if (errBox) {
            errBox.textContent = res.message;
            errBox.style.display = 'block';
          }
          return;
        }
        window.ArbaStore.loginUser(res.user);
        hideLoginPortal();
      };
    }
  }

  /**
   * Sesuai instruksi:
   * - Untuk semua user SELAIN super-admin, menekan tombol profil di pojok kanan atas
   *   langsung mengarahkan ke halaman `user-profile-settings` (tanpa modal prototipe).
   * - Untuk Super Admin, modal ini berfungsi sebagai panel cepat menuju Manajemen Semua User
   *   atau Pengaturan Profil Super Admin.
   */
  function openProfileModal() {
    var st = window.ArbaStore.getState();
    var user = st.currentUser;
    if (!user) {
      showLoginPortal();
      return;
    }

    // Jika user bukan Super Admin, langsung masuk ke halaman user-profile-settings
    if (user.role !== 'super-admin') {
      window.ArbaApp.navigate('user-profile-settings');
      return;
    }

    var users = getUsers();
    var roleMeta = ROLE_META[user.role] || ROLE_META['super-admin'];
    var allowedPaths = window.ArbaStore.getAllowedPathsForUser(user);
    var qLen = (st.offlineQueue && st.offlineQueue.length) || 0;

    var html = `
      <div class="modal-card p-6" style="max-width: 540px;">
        <!-- Header Profil Super Admin -->
        <div class="flex items-start justify-between gap-4 pb-4 border-b border-border-subtle">
          <div class="flex items-center gap-3.5">
            <div style="width:52px; height:52px; border-radius:14px; background:${window.ArbaUtils.safeHexColor(user.badgeColor, '#6d28d9')}; color:#ffffff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:18px; box-shadow:0 6px 14px rgba(109,40,217,0.25);">
              ${window.ArbaUtils.escapeHtml(user.avatarInitials || 'SA')}
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="font-bold text-base text-on-surface">${window.ArbaUtils.escapeHtml(user.name)}</h3>
                <span style="padding:2px 8px; border-radius:999px; font-size:10px; font-weight:800; background:${roleMeta.badgeBg}; color:${roleMeta.badgeText};">
                  ${window.ArbaUtils.escapeHtml(roleMeta.label.toUpperCase())}
                </span>
              </div>
              <div class="text-xs text-on-surface-variant font-medium mt-0.5">${window.ArbaUtils.escapeHtml(user.title)} • ${window.ArbaUtils.escapeHtml(user.division)}</div>
              <div class="text-[11px] font-mono text-primary mt-0.5">Username: ${window.ArbaUtils.escapeHtml(user.username)} • ${window.ArbaUtils.escapeHtml(user.email)}</div>
            </div>
          </div>
          <button id="profile-modal-close" class="icon-btn" type="button" title="Tutup">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <!-- Aksi Cepat Super Admin -->
        <div class="py-3.5 border-b border-border-subtle flex flex-wrap gap-2">
          <button
            id="profile-goto-edit-btn"
            type="button"
            class="flex-1 px-3.5 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer border-0 shadow-xs"
          >
            <span class="material-symbols-outlined text-[18px]">person_edit</span>
            <span>Edit Profil &amp; Ganti Password</span>
          </button>
          <button
            id="profile-goto-usermgmt-btn"
            type="button"
            class="flex-1 px-3.5 py-2.5 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer border-0 shadow-xs"
            style="background:#6d28d9;"
          >
            <span class="material-symbols-outlined text-[18px]">manage_accounts</span>
            <span>Kelola Semua User (${users.length})</span>
          </button>
        </div>

        <!-- Navigasi Modul Super Admin -->
        <div class="py-4 border-b border-border-subtle">
          <div class="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
            Akses Seluruh Modul Sistem (${allowedPaths.length} Halaman)
          </div>
          <div class="flex flex-wrap gap-2">
            ${allowedPaths.map(function (pathKey) {
              var m = MODULE_LABELS[pathKey];
              if (!m) return '';
              return `
                <button
                  type="button"
                  class="profile-nav-chip flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all bg-surface-container-low hover:bg-primary hover:text-white text-on-surface cursor-pointer border border-border-subtle"
                  data-path="${pathKey}"
                >
                  <span class="material-symbols-outlined text-[16px]">${m.icon}</span>
                  <span>${m.name}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Status Sinkronisasi Database Pusat -->
        <div class="py-3.5 border-b border-border-subtle flex items-center justify-between gap-3">
          <div class="flex items-center gap-2.5">
            <span class="material-symbols-outlined text-[20px] ${st.isOnline ? 'text-emerald-600' : 'text-amber-600'}">
              ${st.isOnline ? 'cloud_done' : 'cloud_off'}
            </span>
            <div class="text-xs">
              <div class="font-bold text-on-surface">
                Status Server: ${st.isOnline ? 'Online (Tersambung ke SQLite Pusat)' : 'Offline (Penyimpanan Lokal IndexedDB)'}
              </div>
              <div class="text-[11px] text-on-surface-variant">
                Antrean sinkronisasi lokal: <b>${qLen} transaksi</b>
              </div>
            </div>
          </div>
          <button
            id="profile-sync-now-btn"
            type="button"
            class="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs font-bold text-primary cursor-pointer border border-border-subtle"
          >
            Sinkronkan
          </button>
        </div>

        <!-- Tombol Logout Super Admin -->
        <div class="pt-4 flex items-center justify-end gap-2">
          <button
            id="profile-logout-btn"
            type="button"
            class="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer border-0 shadow-xs"
          >
            <span class="material-symbols-outlined text-[16px]">logout</span>
            <span>Keluar (Logout)</span>
          </button>
        </div>
      </div>
    `;

    window.ArbaApp.openModal(html);

    var closeBtn = document.getElementById('profile-modal-close');
    if (closeBtn) closeBtn.onclick = function () { window.ArbaApp.closeModal(); };

    var gotoEditBtn = document.getElementById('profile-goto-edit-btn');
    if (gotoEditBtn) {
      gotoEditBtn.onclick = function () {
        window.ArbaApp.closeModal();
        window.ArbaApp.navigate('user-profile-settings');
      };
    }

    var gotoUserMgmtBtn = document.getElementById('profile-goto-usermgmt-btn');
    if (gotoUserMgmtBtn) {
      gotoUserMgmtBtn.onclick = function () {
        window.ArbaApp.closeModal();
        window.ArbaApp.navigate('user-management');
      };
    }

    document.querySelectorAll('.profile-nav-chip').forEach(function (chip) {
      chip.onclick = function () {
        var p = chip.getAttribute('data-path');
        if (p) {
          window.ArbaApp.closeModal();
          window.ArbaApp.navigate(p);
        }
      };
    });

    var syncBtn = document.getElementById('profile-sync-now-btn');
    if (syncBtn) {
      syncBtn.onclick = function () {
        window.ArbaStore.syncNow();
        window.ArbaApp.closeModal();
      };
    }

    var logoutBtn = document.getElementById('profile-logout-btn');
    if (logoutBtn) {
      logoutBtn.onclick = function () {
        window.ArbaApp.closeModal();
        window.ArbaStore.logoutUser();
        showLoginPortal();
      };
    }
  }

  function init() {
    var st = window.ArbaStore.getState();
    updateAppShellVisibility();
    if (!st.currentUser) {
      showLoginPortal();
    }
  }

  window.ArbaAuth = {
    init: init,
    authenticate: authenticate,
    showLoginPortal: showLoginPortal,
    hideLoginPortal: hideLoginPortal,
    openProfileModal: openProfileModal,
    updateAppShellVisibility: updateAppShellVisibility,
    getUsers: getUsers
  };
})();
