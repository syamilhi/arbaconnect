/**
 * =============================================================================
 * ArbaConnect ERP - Multi-Role Authentication & RBAC Session Manager (js/auth.js)
 * CV Arba'in Solo Raya
 * =============================================================================
 *
 * Fitur Utama:
 * 1. Halaman Login Khusus (Dedicated Login Page) untuk Super Admin, Direktur,
 *    Admin Gudang, Admin Penjualan, & 8 Sales Lapangan.
 * 2. Strict RBAC (Role-Based Access Control): Hanya menampilkan halaman yang
 *    diizinkan sesuai role user yang sedang login.
 * 3. Beroperasi 100% baik saat ONLINE (verifikasi via `/api/auth/login` SQL Server)
 *    maupun saat OFFLINE di lapangan (verifikasi kredensial ter-cache lokal).
 * 4. Mendukung perubahan detail profil, ganti password & PIN offline secara live.
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
        message: 'Akun tidak ditemukan. Periksa kembali Username/Email/ID Anda atau pilih kartu akun di sebelah kanan.'
      };
    }

    if (user.active === false) {
      return {
        ok: false,
        message: 'Akun "' + user.name + '" sedang dinonaktifkan oleh Super Admin. Hubungi Administrator.'
      };
    }

    // Validasi ketat terhadap password atau PIN offline milik user di state
    if (pw === String(user.password) || (user.pin && pw === String(user.pin))) {
      return { ok: true, user: user };
    }

    return {
      ok: false,
      message: 'Password atau PIN Offline salah untuk akun "' + user.name + '". Silakan coba lagi.'
    };
  }

  async function authenticate(identifier, password) {
    // 1. Cek di state lokal terlebih dahulu (karena perubahan password/user baru langsung tersimpan di state lokal & disinkronkan ke server)
    var localCheck = findUserByCredentials(identifier, password);
    if (localCheck.ok && localCheck.user) {
      // Bila online, kirim juga request verifikasi/audit login ke server SQL
      var st = window.ArbaStore ? window.ArbaStore.getState() : { isOnline: false };
      if (st.isOnline && typeof fetch === 'function') {
        try {
          var res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: identifier, password: password })
          });
          if (res.ok) {
            var data = await res.json();
            if (data && data.status === 'ok' && data.user) {
              // Gunakan data user terbaru dari state lokal bila ada pembaruan lokal
              return { ok: true, user: localCheck.user, mode: 'ONLINE_SQL' };
            }
          }
        } catch (e) {
          // Abaikan error jaringan & gunakan sesi lokal
        }
      }
      return { ok: true, user: localCheck.user, mode: 'LOCAL_RBAC' };
    }

    return {
      ok: false,
      message: localCheck.message || 'Username/Email atau Password/PIN tidak sesuai.'
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

  function showLoginPortal(options) {
    options = options || {};
    var overlay = ensureOverlayContainer();
    var st = window.ArbaStore.getState();
    var users = getUsers().filter(function (u) { return u.active !== false; });
    var salesUsers = users.filter(function (u) { return u.role === 'field-sales'; });
    var currentUser = st.currentUser;

    // Jika belum ada user yang login, sembunyikan seluruh shell aplikasi utama agar murni tampil halaman login
    updateAppShellVisibility();

    overlay.className = 'auth-overlay';
    overlay.removeAttribute('style');

    var superAdminUser = users.find(function (u) { return u.role === 'super-admin'; }) || users[0];
    var dirUser = users.find(function (u) { return u.role === 'executive'; });
    var whUser = users.find(function (u) { return u.role === 'inventory'; });
    var opsUser = users.find(function (u) { return u.role === 'sales-ops'; });

    overlay.innerHTML = `
      <div class="auth-card">
        
        <!-- KOLOM KIRI: HALAMAN LOGIN UTAMA (FORM KREDENSIAL & STATUS OFFLINE-FIRST) -->
        <div class="auth-col-left">
          <div>
            <!-- Brand Header -->
            <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:20px;">
              <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:42px; height:42px; border-radius:11px; background:linear-gradient(135deg, #005c55, #0f766e); display:flex; align-items:center; justify-content:center; color:#ffffff; font-weight:800; font-size:18px; box-shadow:0 4px 12px rgba(0,92,85,0.25);">
                  <span class="material-symbols-outlined" style="font-size:24px;">medication_liquid</span>
                </div>
                <div>
                  <div style="font-size:18px; font-weight:800; color:#0f172a; letter-spacing:-0.02em; line-height:1.1;">ArbaConnect ERP</div>
                  <div style="font-size:11px; font-weight:600; color:#005c55;">CV Arba'in Solo Raya • Distribusi Herbal</div>
                </div>
              </div>
              <span style="display:inline-flex; align-items:center; gap:5px; padding:4px 10px; border-radius:999px; font-size:11px; font-weight:700; background:${st.isOnline ? '#dcfce7' : '#fef3c7'}; color:${st.isOnline ? '#166534' : '#92400e'};">
                <span style="width:7px; height:7px; border-radius:50%; background:${st.isOnline ? '#16a34a' : '#d97706'}; display:inline-block;"></span>
                ${st.isOnline ? 'Server SQL Online' : 'Offline-First Ready'}
              </span>
            </div>

            <h1 style="font-size:20px; font-weight:800; color:#0f172a; margin:0 0 6px 0;">Masuk ke ArbaConnect</h1>
            <p style="font-size:12px; color:#64748b; margin:0 0 18px 0; line-height:1.5;">
              Masukkan kredensial akun atau pilih akun akses cepat.
            </p>

            <!-- Error Alert -->
            <div id="auth-error-msg" style="display:none; padding:10px 12px; border-radius:10px; background:#fef2f2; border:1px solid #fecaca; color:#b91c1c; font-size:12px; font-weight:600; margin-bottom:14px;"></div>

            <!-- Form Login Manual -->
            <form id="arba-login-form" style="display:flex; flex-direction:column; gap:14px;">
              <div>
                <label style="display:block; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:#475569; margin-bottom:5px;">
                  Username atau Email
                </label>
                <div style="position:relative;">
                  <span class="material-symbols-outlined" style="position:absolute; left:11px; top:50%; transform:translateY(-50%); font-size:18px; color:#64748b;">badge</span>
                  <input
                    id="auth-identifier-input"
                    type="text"
                    required
                    placeholder="Username atau email"
                    value="${currentUser ? currentUser.username : ''}"
                    style="width:100%; padding:10px 12px 10px 38px; border-radius:10px; border:1.5px solid #cbd5e1; font-size:13px; color:#0f172a; background:#f8fafc; outline:none; box-sizing:border-box;"
                  />
                </div>
              </div>

              <div>
                <label style="display:block; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:#475569; margin-bottom:5px;">
                  Password atau PIN
                </label>
                <div style="position:relative;">
                  <span class="material-symbols-outlined" style="position:absolute; left:11px; top:50%; transform:translateY(-50%); font-size:18px; color:#64748b;">lock</span>
                  <input
                    id="auth-password-input"
                    type="password"
                    required
                    placeholder="Password atau PIN"
                    value=""
                    style="width:100%; padding:10px 38px 10px 38px; border-radius:10px; border:1.5px solid #cbd5e1; font-size:13px; color:#0f172a; background:#f8fafc; outline:none; box-sizing:border-box;"
                  />
                  <button
                    id="auth-toggle-pw"
                    type="button"
                    title="Tampilkan / Sembunyikan Password"
                    style="position:absolute; right:8px; top:50%; transform:translateY(-50%); background:transparent; border:0; color:#64748b; cursor:pointer; display:flex; align-items:center; padding:4px;"
                  >
                    <span class="material-symbols-outlined" id="auth-toggle-pw-icon" style="font-size:18px;">visibility</span>
                  </button>
                </div>
              </div>

              <button
                id="auth-submit-btn"
                type="submit"
                style="width:100%; padding:11px 16px; border-radius:10px; border:0; background:linear-gradient(135deg, #005c55, #0f766e); color:#ffffff; font-size:13px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; box-shadow:0 6px 16px rgba(0,92,85,0.28);"
              >
                <span class="material-symbols-outlined" style="font-size:18px;">login</span>
                <span>Masuk</span>
              </button>
            </form>
          </div>

          <div style="margin-top:18px; padding-top:12px; border-top:1px solid #f1f5f9; display:flex; align-items:center; justify-content:space-between; font-size:11px; color:#64748b;">
            <span>CV Arba'in Solo Raya</span>
            ${currentUser ? `
              <button id="auth-cancel-close-btn" type="button" style="background:transparent; border:1px solid #cbd5e1; padding:4px 10px; border-radius:6px; font-size:11px; font-weight:700; color:#334155; cursor:pointer;">
                Kembali (${currentUser.name.split(' ')[0]})
              </button>
            ` : '<span>v3.0.0</span>'}
          </div>
        </div>

        <!-- KOLOM KANAN: AKSES CEPAT AKUN DEMO -->
        <div class="auth-col-right">
          <div>
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
              <span style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:#005c55;">
                Akses Cepat (${users.length} Akun)
              </span>
            </div>

            <div style="display:flex; flex-direction:column; gap:8px;">
              ${superAdminUser ? `
              <div
                class="quick-role-card"
                data-user-id="${superAdminUser.id}"
                style="background:#ffffff; border:1.5px solid #c4b5fd; border-radius:12px; padding:10px 14px; cursor:pointer; transition:all 0.15s; display:flex; align-items:center; justify-content:space-between; gap:10px;"
              >
                <div style="display:flex; align-items:center; gap:11px;">
                  <div style="width:36px; height:36px; border-radius:10px; background:#6d28d9; color:#ffffff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:12px; flex-shrink:0;">
                    ${superAdminUser.avatarInitials || 'SA'}
                  </div>
                  <div>
                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                      <span style="font-size:13px; font-weight:700; color:#0f172a;">${superAdminUser.name}</span>
                      <span style="font-size:10px; font-weight:700; padding:2px 7px; border-radius:999px; background:#f3e8ff; color:#6d28d9;">SUPER ADMIN</span>
                    </div>
                    <div style="font-size:11px; color:#475569; margin-top:1px;">@${superAdminUser.username} · ${superAdminUser.title}</div>
                  </div>
                </div>
                <span class="material-symbols-outlined" style="color:#6d28d9; font-size:20px;">arrow_forward</span>
              </div>
              ` : ''}

              ${dirUser ? `
              <div
                class="quick-role-card"
                data-user-id="${dirUser.id}"
                style="background:#ffffff; border:1.5px solid #cbd5e1; border-radius:12px; padding:10px 14px; cursor:pointer; transition:all 0.15s; display:flex; align-items:center; justify-content:space-between; gap:10px;"
              >
                <div style="display:flex; align-items:center; gap:11px;">
                  <div style="width:36px; height:36px; border-radius:10px; background:#e6f4f1; color:#005c55; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:12px; flex-shrink:0;">
                    ${dirUser.avatarInitials}
                  </div>
                  <div>
                    <div style="display:flex; align-items:center; gap:6px;">
                      <span style="font-size:13px; font-weight:700; color:#0f172a;">${dirUser.name}</span>
                      <span style="font-size:10px; font-weight:700; padding:2px 7px; border-radius:999px; background:#e6f4f1; color:#005c55;">DIREKTUR</span>
                    </div>
                    <div style="font-size:11px; color:#475569; margin-top:1px;">@${dirUser.username} · ${dirUser.title}</div>
                  </div>
                </div>
                <span class="material-symbols-outlined" style="color:#005c55; font-size:20px;">arrow_forward</span>
              </div>
              ` : ''}

              ${whUser ? `
              <div
                class="quick-role-card"
                data-user-id="${whUser.id}"
                style="background:#ffffff; border:1.5px solid #cbd5e1; border-radius:12px; padding:10px 14px; cursor:pointer; transition:all 0.15s; display:flex; align-items:center; justify-content:space-between; gap:10px;"
              >
                <div style="display:flex; align-items:center; gap:11px;">
                  <div style="width:36px; height:36px; border-radius:10px; background:#e0f2fe; color:#0369a1; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:12px; flex-shrink:0;">
                    ${whUser.avatarInitials}
                  </div>
                  <div>
                    <div style="display:flex; align-items:center; gap:6px;">
                      <span style="font-size:13px; font-weight:700; color:#0f172a;">${whUser.name}</span>
                      <span style="font-size:10px; font-weight:700; padding:2px 7px; border-radius:999px; background:#e0f2fe; color:#0369a1;">GUDANG</span>
                    </div>
                    <div style="font-size:11px; color:#475569; margin-top:1px;">@${whUser.username} · ${whUser.title}</div>
                  </div>
                </div>
                <span class="material-symbols-outlined" style="color:#0369a1; font-size:20px;">arrow_forward</span>
              </div>
              ` : ''}

              ${opsUser ? `
              <div
                class="quick-role-card"
                data-user-id="${opsUser.id}"
                style="background:#ffffff; border:1.5px solid #cbd5e1; border-radius:12px; padding:10px 14px; cursor:pointer; transition:all 0.15s; display:flex; align-items:center; justify-content:space-between; gap:10px;"
              >
                <div style="display:flex; align-items:center; gap:11px;">
                  <div style="width:36px; height:36px; border-radius:10px; background:#f3e8ff; color:#6d28d9; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:12px; flex-shrink:0;">
                    ${opsUser.avatarInitials}
                  </div>
                  <div>
                    <div style="display:flex; align-items:center; gap:6px;">
                      <span style="font-size:13px; font-weight:700; color:#0f172a;">${opsUser.name}</span>
                      <span style="font-size:10px; font-weight:700; padding:2px 7px; border-radius:999px; background:#f3e8ff; color:#6d28d9;">PENJUALAN</span>
                    </div>
                    <div style="font-size:11px; color:#475569; margin-top:1px;">@${opsUser.username} · ${opsUser.title}</div>
                  </div>
                </div>
                <span class="material-symbols-outlined" style="color:#6d28d9; font-size:20px;">arrow_forward</span>
              </div>
              ` : ''}

              <div style="background:#fffbeb; border:1.5px solid #fcd34d; border-radius:12px; padding:11px 14px;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span class="material-symbols-outlined" style="color:#d97706; font-size:18px;">smartphone</span>
                    <span style="font-size:12px; font-weight:700; color:#78350f;">Sales Lapangan</span>
                  </div>
                  <span style="font-size:10px; font-weight:700; padding:2px 7px; border-radius:999px; background:#fef3c7; color:#b45309; border:1px solid #f59e0b;">${salesUsers.length} Akun</span>
                </div>
                <div style="display:flex; align-items:center; gap:8px; min-width:0;">
                  <select
                    id="auth-quick-sales-select"
                    style="flex:1 1 0%; min-width:0; width:100%; padding:8px 10px; border-radius:8px; border:1px solid #f59e0b; background:#ffffff; font-size:12px; font-weight:600; color:#0f172a; text-overflow:ellipsis;"
                  >
                    ${salesUsers.map(function (su) {
                      var selected = (st.currentSalesRep === su.salesRepName) ? 'selected' : '';
                      return `<option value="${su.id}" ${selected}>${su.name} — ${su.division.replace('Divisi ', '')}</option>`;
                    }).join('')}
                  </select>
                  <button
                    id="auth-quick-sales-btn"
                    type="button"
                    style="flex-shrink:0; padding:8px 14px; border-radius:8px; border:0; background:#d97706; color:#ffffff; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap; display:inline-flex; align-items:center; gap:4px;"
                  >
                    <span>Masuk</span>
                    <span class="material-symbols-outlined" style="font-size:16px;">chevron_right</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Bind Toggle Password Visibility
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

    // Bind Cancel / Close button (only if already logged in)
    var cancelBtn = document.getElementById('auth-cancel-close-btn');
    if (cancelBtn) {
      cancelBtn.onclick = function () {
        hideLoginPortal();
      };
    }

    // Bind Manual Form Submit
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

    // Bind Quick 1-Click Role Cards
    overlay.querySelectorAll('.quick-role-card').forEach(function (card) {
      card.onclick = function () {
        var uid = card.getAttribute('data-user-id');
        var targetUser = users.find(function (u) { return u.id === uid; });
        if (targetUser) {
          window.ArbaStore.loginUser(targetUser);
          hideLoginPortal();
        }
      };
    });

    // Bind Quick Sales Rep Login
    var quickSalesBtn = document.getElementById('auth-quick-sales-btn');
    var quickSalesSelect = document.getElementById('auth-quick-sales-select');
    if (quickSalesBtn && quickSalesSelect) {
      quickSalesBtn.onclick = function () {
        var uid = quickSalesSelect.value;
        var targetUser = users.find(function (u) { return u.id === uid; });
        if (targetUser) {
          window.ArbaStore.loginUser(targetUser);
          hideLoginPortal();
        }
      };
    }
  }

  function openProfileModal() {
    var st = window.ArbaStore.getState();
    var users = getUsers();
    var user = st.currentUser;
    if (!user) {
      showLoginPortal();
      return;
    }
    var roleMeta = ROLE_META[user.role] || ROLE_META['executive'];
    var allowedPaths = window.ArbaStore.getAllowedPathsForUser(user);
    var isSuperAdmin = user.role === 'super-admin';
    var qLen = (st.offlineQueue && st.offlineQueue.length) || 0;

    var html = `
      <div class="modal-card p-6" style="max-width: 560px;">
        <!-- Header Profil Pengguna Aktif -->
        <div class="flex items-start justify-between gap-4 pb-4 border-b border-border-subtle">
          <div class="flex items-center gap-3.5">
            <div style="width:52px; height:52px; border-radius:14px; background:${user.badgeColor || '#005c55'}; color:#ffffff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:18px; box-shadow:0 6px 14px rgba(0,92,85,0.2);">
              ${user.avatarInitials || 'AR'}
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="font-bold text-base text-on-surface">${user.name}</h3>
                <span style="padding:2px 8px; border-radius:999px; font-size:10px; font-weight:800; background:${roleMeta.badgeBg}; color:${roleMeta.badgeText};">
                  ${roleMeta.label.toUpperCase()}
                </span>
              </div>
              <div class="text-xs text-on-surface-variant font-medium mt-0.5">${user.title} • ${user.division}</div>
              <div class="text-[11px] font-mono text-primary mt-0.5">Username: ${user.username} • ${user.email}</div>
            </div>
          </div>
          <button id="profile-modal-close" class="icon-btn" type="button" title="Tutup">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <!-- Tombol Cepat ke Halaman Edit Detail User & Ganti Password (+ Manajemen User untuk Super Admin) -->
        <div class="py-3.5 border-b border-border-subtle flex flex-wrap gap-2">
          <button
            id="profile-goto-edit-btn"
            type="button"
            class="flex-1 px-3.5 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer border-0 shadow-xs"
          >
            <span class="material-symbols-outlined text-[18px]">person_edit</span>
            <span>Edit Detail Profil &amp; Ganti Password</span>
          </button>
          ${isSuperAdmin ? `
            <button
              id="profile-goto-usermgmt-btn"
              type="button"
              class="flex-1 px-3.5 py-2.5 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer border-0 shadow-xs"
              style="background:#6d28d9;"
            >
              <span class="material-symbols-outlined text-[18px]">manage_accounts</span>
              <span>Kelola Semua User (${users.length})</span>
            </button>
          ` : ''}
        </div>

        <!-- Hak Akses Halaman Sesuai Role (RBAC Permissions) -->
        <div class="py-4 border-b border-border-subtle">
          <div class="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
            Halaman yang Dapat Diakses Sesuai Role Anda (${allowedPaths.length} Halaman)
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

        <!-- Status Sinkronisasi Offline-First -->
        <div class="py-3.5 border-b border-border-subtle flex items-center justify-between gap-3">
          <div class="flex items-center gap-2.5">
            <span class="material-symbols-outlined text-[20px] ${st.isOnline ? 'text-emerald-600' : 'text-amber-600'}">
              ${st.isOnline ? 'cloud_done' : 'cloud_off'}
            </span>
            <div class="text-xs">
              <div class="font-bold text-on-surface">
                Status Jaringan: ${st.isOnline ? 'Online (Tersambung ke Server Pusat SQL)' : 'Offline (Penyimpanan Lokal IndexedDB)'}
              </div>
              <div class="text-[11px] text-on-surface-variant">
                Antrean transaksi lokal belum terkirim: <b>${qLen} transaksi</b>
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

        <!-- Tombol Aksi Bawah: Reset Demo, Ganti Akun, Logout -->
        <div class="pt-4 flex flex-wrap items-center justify-between gap-2">
          <button
            id="profile-reset-demo-btn"
            type="button"
            class="px-3 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant text-xs font-semibold flex items-center gap-1.5 cursor-pointer border border-border-subtle"
          >
            <span class="material-symbols-outlined text-[16px]">restart_alt</span>
            <span>Reset Data Demo</span>
          </button>

          <div class="flex items-center gap-2">
            <button
              id="profile-open-login-btn"
              type="button"
              class="px-3 py-2 rounded-lg bg-surface-container-high hover:bg-surface-container text-on-surface text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-border-subtle"
            >
              <span class="material-symbols-outlined text-[16px]">switch_account</span>
              <span>Ganti Akun</span>
            </button>
            <button
              id="profile-logout-btn"
              type="button"
              class="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer border-0 shadow-xs"
            >
              <span class="material-symbols-outlined text-[16px]">logout</span>
              <span>Keluar (Logout)</span>
            </button>
          </div>
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

    var resetBtn = document.getElementById('profile-reset-demo-btn');
    if (resetBtn) {
      resetBtn.onclick = function () {
        window.ArbaApp.closeModal();
        window.ArbaStore.resetToDefaults();
      };
    }

    var openLoginBtn = document.getElementById('profile-open-login-btn');
    if (openLoginBtn) {
      openLoginBtn.onclick = function () {
        window.ArbaApp.closeModal();
        showLoginPortal();
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
