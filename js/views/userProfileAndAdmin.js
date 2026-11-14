/**
 * =============================================================================
 * ArbaConnect ERP - User Profile Settings & Super Admin User Management View
 * CV Arba'in Solo Raya
 * =============================================================================
 *
 * Mencakup 2 Halaman Utama:
 * 1. `user-profile-settings` (Edit Detail User & Ganti Password - untuk semua user yang login)
 * 2. `user-management` (Manajemen Seluruh User, Hak Akses Modul & Reset Password - khusus Super Admin)
 */

(function () {
  'use strict';

  window.ArbaViews = window.ArbaViews || {};

  var ROLE_LABELS = {
    'super-admin': { label: 'Super Admin (All Access)', bg: '#ffe4e6', text: '#be123c', icon: 'admin_panel_settings' },
    'executive': { label: 'Direktur & Manajemen', bg: '#e6f4f1', text: '#005c55', icon: 'monitoring' },
    'inventory': { label: 'Admin Gudang & Stok', bg: '#e0f2fe', text: '#0369a1', icon: 'warehouse' },
    'sales-ops': { label: 'Admin Penjualan & Verifikasi', bg: '#f3e8ff', text: '#6d28d9', icon: 'fact_check' },
    'field-sales': { label: 'Sales Lapangan (PWA)', bg: '#fef3c7', text: '#b45309', icon: 'smartphone' }
  };

  var ALL_MODULES = [
    { path: 'executive-dashboard', name: 'Executive Dashboard', icon: 'dashboard', desc: 'KPI Eksekutif, Forecasting & Alarm Dual-Warna' },
    { path: 'inventory-stock-ledger', name: 'Inventory & Stock Ledger', icon: 'inventory_2', desc: 'Katalog Batch FEFO, Buku Besar & Anti-Fraud Gudang' },
    { path: 'b2b-crm-directory', name: 'B2B CRM & Directory', icon: 'store', desc: 'Direktori >1.000 Apotek Konsinyasi & Plafon Kredit' },
    { path: 'order-approval-queue', name: 'Order Approval Queue', icon: 'fact_check', desc: 'Verifikasi Faktur PWA, Surat Jalan & Manifest Armada' },
    { path: 'field-sales-pwa-preview', name: 'Field Sales PWA', icon: 'smartphone', desc: 'Aplikasi Sales Lapangan Offline-First & Check-in GPS' },
    { path: 'user-management', name: 'Manajemen Semua User (Super Admin)', icon: 'manage_accounts', desc: 'Kelola seluruh akun, role, hak akses & reset password' },
    { path: 'user-profile-settings', name: 'Edit Profil & Ganti Password', icon: 'person_edit', desc: 'Pengaturan profil pribadi & keamanan kata sandi' }
  ];

  var adminState = {
    searchQuery: '',
    roleFilter: 'ALL',
    showPasswords: false
  };

  // ===========================================================================
  // 1. HALAMAN EDIT DETAIL USER & GANTI PASSWORD (`user-profile-settings`)
  // ===========================================================================
  function renderUserProfileSettings(container) {
    var appState = window.ArbaStore.getState();
    var user = appState.currentUser;
    if (!user) {
      if (window.ArbaAuth && typeof window.ArbaAuth.showLoginPortal === 'function') {
        window.ArbaAuth.showLoginPortal();
      }
      return;
    }

    var roleInfo = ROLE_LABELS[user.role] || ROLE_LABELS['executive'];
    var allowedPaths = window.ArbaStore.getAllowedPathsForUser(user);

    var html = `
      <div class="flex flex-col w-full gap-space-lg pb-space-xl">
        <!-- Header Breadcrumb -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest p-6 rounded-xl border border-border-subtle/60">
          <div>
            <div class="flex items-center gap-2 text-xs text-on-surface-variant font-medium mb-1">
              <span class="text-primary font-semibold">Pengaturan Akun &amp; Keamanan</span>
              <span>·</span>
              <span>${roleInfo.label}</span>
            </div>
            <h1 class="text-2xl text-on-surface tracking-tight font-bold">
              Detail Profil Pengguna &amp; Ganti Password
            </h1>
            <p class="text-xs text-on-surface-variant mt-0.5">
              Perbarui informasi identitas kerja Anda serta kelola kata sandi login dan PIN Offline-First.
            </p>
          </div>
          <div class="flex items-center gap-2">
            ${user.role === 'super-admin' ? `
              <button
                id="btn-goto-user-mgmt"
                type="button"
                class="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer border-0 shadow-xs"
              >
                <span class="material-symbols-outlined text-[16px]">admin_panel_settings</span>
                <span>Kelola Semua User (Super Admin)</span>
              </button>
            ` : ''}
            <button
              id="btn-profile-page-logout"
              type="button"
              class="px-3.5 py-2 rounded-lg bg-surface-container-high hover:bg-rose-50 text-rose-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-rose-200"
            >
              <span class="material-symbols-outlined text-[16px]">logout</span>
              <span>Logout Sesi</span>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
          <!-- KOLOM KIRI (4 Kolom): Ringkasan Identitas & Hak Akses Modul -->
          <div class="lg:col-span-4 flex flex-col gap-4">
            <div class="bg-surface-container-lowest p-6 rounded-xl border border-border-subtle/60 flex flex-col items-center text-center">
              <div
                id="profile-preview-avatar"
                style="width:72px; height:72px; border-radius:20px; background:${user.badgeColor || '#005c55'}; color:#ffffff; display:flex; align-items:center; justify-content:center; font-size:26px; font-weight:800; box-shadow:0 10px 24px rgba(0,92,85,0.22); margin-bottom:12px;"
              >
                ${window.ArbaUtils.escapeHtml(user.avatarInitials || 'US')}
              </div>
              <span style="padding:3px 10px; border-radius:999px; font-size:11px; font-weight:800; background:${roleInfo.bg}; color:${roleInfo.text};">
                ${roleInfo.label.toUpperCase()}
              </span>
              <h2 class="text-lg font-bold text-on-surface mt-2">${window.ArbaUtils.escapeHtml(user.name)}</h2>
              <p class="text-xs text-on-surface-variant font-medium">${window.ArbaUtils.escapeHtml(user.title)} • ${window.ArbaUtils.escapeHtml(user.division)}</p>

              <div class="w-full mt-4 pt-4 border-t border-border-subtle text-left space-y-2 text-xs">
                <div class="flex justify-between">
                  <span class="text-on-surface-variant">ID Pegawai:</span>
                  <span class="font-mono font-bold text-primary">${window.ArbaUtils.escapeHtml(user.id)}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-on-surface-variant">Username Login:</span>
                  <span class="font-mono font-semibold text-on-surface">@${window.ArbaUtils.escapeHtml(user.username)}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-on-surface-variant">Email Resmi:</span>
                  <span class="font-semibold text-on-surface">${window.ArbaUtils.escapeHtml(user.email)}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-on-surface-variant">No. Telepon / WA:</span>
                  <span class="font-mono text-on-surface">${window.ArbaUtils.escapeHtml(user.phone || '-')}</span>
                </div>
              </div>
            </div>

            <!-- Kartu Halaman yang Bisa Diakses Sesuai Role -->
            <div class="bg-surface-container-lowest p-5 rounded-xl border border-border-subtle/60">
              <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Halaman yang Dapat Diakses Role Anda
                </span>
                <span class="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                  ${allowedPaths.length} Halaman
                </span>
              </div>
              <div class="space-y-2">
                ${ALL_MODULES.map(function (mod) {
                  var isAllowed = allowedPaths.indexOf(mod.path) !== -1;
                  if (!isAllowed) return '';
                  return `
                    <button
                      type="button"
                      class="btn-jump-allowed-module w-full p-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container flex items-center justify-between text-left transition-colors cursor-pointer border border-border-subtle/50"
                      data-path="${mod.path}"
                    >
                      <div class="flex items-center gap-2.5">
                        <span class="material-symbols-outlined text-primary text-[18px]">${mod.icon}</span>
                        <div>
                          <div class="text-xs font-bold text-on-surface">${mod.name}</div>
                          <div class="text-[10px] text-on-surface-variant">${mod.desc}</div>
                        </div>
                      </div>
                      <span class="material-symbols-outlined text-on-surface-variant text-[16px]">chevron_right</span>
                    </button>
                  `;
                }).join('')}
              </div>
            </div>
          </div>

          <!-- KOLOM KANAN (8 Kolom): Form Edit Detail User & Form Ganti Password -->
          <div class="lg:col-span-8 flex flex-col gap-6">
            <!-- Form 1: Edit Detail Profil User -->
            <div class="bg-surface-container-lowest p-6 rounded-xl border border-border-subtle/60">
              <div class="flex items-center gap-2.5 pb-4 mb-4 border-b border-border-subtle">
                <span class="material-symbols-outlined text-primary text-[22px]">badge</span>
                <div>
                  <h3 class="text-base font-bold text-on-surface">Edit Detail Profil Pengguna</h3>
                  <p class="text-xs text-on-surface-variant">Perubahan langsung tersimpan di perangkat lokal &amp; disinkronkan ke Server SQL Pusat.</p>
                </div>
              </div>

              <form id="form-edit-own-profile" class="space-y-4 text-xs">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label class="block font-bold text-on-surface mb-1">Nama Lengkap</label>
                    <input
                      type="text"
                      id="prof-name"
                      required
                      value="${window.ArbaUtils.escapeHtml(user.name)}"
                      class="w-full p-2.5 rounded-lg border border-border-subtle bg-surface-container-low text-on-surface font-semibold"
                    />
                  </div>
                  <div>
                    <label class="block font-bold text-on-surface mb-1">Username Login</label>
                    <input
                      type="text"
                      id="prof-username"
                      required
                      value="${window.ArbaUtils.escapeHtml(user.username)}"
                      class="w-full p-2.5 rounded-lg border border-border-subtle bg-surface-container-low text-on-surface font-mono font-semibold"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label class="block font-bold text-on-surface mb-1">Alamat Email Resmi</label>
                    <input
                      type="email"
                      id="prof-email"
                      required
                      value="${window.ArbaUtils.escapeHtml(user.email)}"
                      class="w-full p-2.5 rounded-lg border border-border-subtle bg-surface-container-low text-on-surface"
                    />
                  </div>
                  <div>
                    <label class="block font-bold text-on-surface mb-1">Nomor Telepon / WhatsApp</label>
                    <input
                      type="text"
                      id="prof-phone"
                      value="${window.ArbaUtils.escapeHtml(user.phone || '')}"
                      placeholder="Contoh: 081234567890"
                      class="w-full p-2.5 rounded-lg border border-border-subtle bg-surface-container-low text-on-surface font-mono"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label class="block font-bold text-on-surface mb-1">Jabatan / Posisi</label>
                    <input
                      type="text"
                      id="prof-title"
                      required
                      value="${window.ArbaUtils.escapeHtml(user.title)}"
                      class="w-full p-2.5 rounded-lg border border-border-subtle bg-surface-container-low text-on-surface"
                    />
                  </div>
                  <div>
                    <label class="block font-bold text-on-surface mb-1">Divisi / Rayon Area Tugas</label>
                    <input
                      type="text"
                      id="prof-division"
                      required
                      value="${window.ArbaUtils.escapeHtml(user.division)}"
                      class="w-full p-2.5 rounded-lg border border-border-subtle bg-surface-container-low text-on-surface"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label class="block font-bold text-on-surface mb-1">Inisial Avatar (Maks 2 Huruf)</label>
                    <input
                      type="text"
                      id="prof-initials"
                      maxlength="2"
                      required
                      value="${window.ArbaUtils.escapeHtml(user.avatarInitials || 'US')}"
                      class="w-full p-2.5 rounded-lg border border-border-subtle bg-surface-container-low text-on-surface font-mono font-bold uppercase"
                    />
                  </div>
                  <div>
                    <label class="block font-bold text-on-surface mb-1">Warna Badge Profil</label>
                    <input
                      type="color"
                      id="prof-color"
                      value="${user.badgeColor || '#005c55'}"
                      class="w-full h-10 p-1 rounded-lg border border-border-subtle bg-surface-container-low cursor-pointer"
                    />
                  </div>
                </div>

                <div class="pt-2 flex justify-end">
                  <button
                    type="submit"
                    class="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-container text-white font-bold text-xs flex items-center gap-2 cursor-pointer border-0 shadow-xs"
                  >
                    <span class="material-symbols-outlined text-[18px]">save</span>
                    <span>Simpan Perubahan Detail User</span>
                  </button>
                </div>
              </form>
            </div>

            <!-- Form 2: Ganti Password & PIN Offline -->
            <div class="bg-surface-container-lowest p-6 rounded-xl border border-border-subtle/60">
              <div class="flex items-center justify-between pb-4 mb-4 border-b border-border-subtle">
                <div class="flex items-center gap-2.5">
                  <span class="material-symbols-outlined text-amber-600 text-[22px]">lock_reset</span>
                  <div>
                    <h3 class="text-base font-bold text-on-surface">Ganti Password Login &amp; PIN Offline</h3>
                    <p class="text-xs text-on-surface-variant">Gunakan kombinasi kata sandi baru yang kuat. Berlaku untuk login Online maupun Offline.</p>
                  </div>
                </div>
                <button
                  type="button"
                  id="btn-toggle-pw-fields"
                  class="px-2.5 py-1 rounded bg-surface-container-low hover:bg-surface-container text-on-surface-variant text-xs font-semibold flex items-center gap-1 cursor-pointer border border-border-subtle"
                >
                  <span class="material-symbols-outlined text-[15px]">visibility</span>
                  <span>Lihat Karakter</span>
                </button>
              </div>

              <div id="pw-change-alert" style="display:none;" class="p-3 rounded-lg text-xs font-semibold mb-4"></div>

              <form id="form-change-own-password" class="space-y-4 text-xs">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label class="block font-bold text-on-surface mb-1">Password Saat Ini</label>
                    <input
                      type="password"
                      id="pw-current"
                      required
                      placeholder="Masukkan password Anda saat ini"
                      class="pw-field-toggle w-full p-2.5 rounded-lg border border-border-subtle bg-surface-container-low text-on-surface font-mono"
                    />
                  </div>
                  <div>
                    <label class="block font-bold text-on-surface mb-1">PIN Offline 6 Digit Baru</label>
                    <input
                      type="password"
                      id="pw-new-pin"
                      maxlength="8"
                      value="${window.ArbaUtils.escapeHtml(user.pin || '123456')}"
                      placeholder="Contoh: 123456"
                      class="pw-field-toggle w-full p-2.5 rounded-lg border border-border-subtle bg-surface-container-low text-on-surface font-mono"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label class="block font-bold text-on-surface mb-1">Password Baru</label>
                    <input
                      type="password"
                      id="pw-new"
                      required
                      placeholder="Minimal 3 karakter"
                      class="pw-field-toggle w-full p-2.5 rounded-lg border border-border-subtle bg-surface-container-low text-on-surface font-mono"
                    />
                  </div>
                  <div>
                    <label class="block font-bold text-on-surface mb-1">Konfirmasi Password Baru</label>
                    <input
                      type="password"
                      id="pw-confirm"
                      required
                      placeholder="Ulangi password baru"
                      class="pw-field-toggle w-full p-2.5 rounded-lg border border-border-subtle bg-surface-container-low text-on-surface font-mono"
                    />
                  </div>
                </div>

                <div class="pt-2 flex justify-end">
                  <button
                    type="submit"
                    class="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer border-0 shadow-xs"
                  >
                    <span class="material-symbols-outlined text-[18px]">key</span>
                    <span>Perbarui Password &amp; PIN</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Bind events for Profile Settings Page
    var btnGotoMgmt = container.querySelector('#btn-goto-user-mgmt');
    if (btnGotoMgmt) {
      btnGotoMgmt.onclick = function () {
        window.ArbaApp.navigate('user-management');
      };
    }

    var btnLogout = container.querySelector('#btn-profile-page-logout');
    if (btnLogout) {
      btnLogout.onclick = function () {
        window.ArbaStore.logoutUser();
      };
    }

    container.querySelectorAll('.btn-jump-allowed-module').forEach(function (btn) {
      btn.onclick = function () {
        var p = btn.getAttribute('data-path');
        if (p) window.ArbaApp.navigate(p);
      };
    });

    var formProfile = container.querySelector('#form-edit-own-profile');
    if (formProfile) {
      formProfile.onsubmit = function (e) {
        e.preventDefault();
        window.ArbaStore.updateUserProfile(user.id, {
          name: document.getElementById('prof-name').value,
          username: document.getElementById('prof-username').value,
          email: document.getElementById('prof-email').value,
          phone: document.getElementById('prof-phone').value,
          title: document.getElementById('prof-title').value,
          division: document.getElementById('prof-division').value,
          avatarInitials: document.getElementById('prof-initials').value,
          badgeColor: document.getElementById('prof-color').value
        });
      };
    }

    var btnTogglePw = container.querySelector('#btn-toggle-pw-fields');
    if (btnTogglePw) {
      btnTogglePw.onclick = function () {
        var fields = container.querySelectorAll('.pw-field-toggle');
        var isHidden = fields[0] && fields[0].type === 'password';
        fields.forEach(function (f) {
          f.type = isHidden ? 'text' : 'password';
        });
      };
    }

    var formPw = container.querySelector('#form-change-own-password');
    var pwAlert = container.querySelector('#pw-change-alert');
    if (formPw) {
      formPw.onsubmit = function (e) {
        e.preventDefault();
        var curPw = document.getElementById('pw-current').value;
        var newPw = document.getElementById('pw-new').value;
        var confPw = document.getElementById('pw-confirm').value;
        var newPin = document.getElementById('pw-new-pin').value;

        if (newPw !== confPw) {
          if (pwAlert) {
            pwAlert.style.display = 'block';
            pwAlert.style.background = '#fef2f2';
            pwAlert.style.color = '#b91c1c';
            pwAlert.style.border = '1px solid #fecaca';
            pwAlert.textContent = 'Konfirmasi password baru tidak cocok dengan password baru!';
          }
          return;
        }

        var res = window.ArbaStore.changeUserPassword(user.id, curPw, newPw, newPin, false);
        if (!res.ok) {
          if (pwAlert) {
            pwAlert.style.display = 'block';
            pwAlert.style.background = '#fef2f2';
            pwAlert.style.color = '#b91c1c';
            pwAlert.style.border = '1px solid #fecaca';
            pwAlert.textContent = res.message;
          }
          return;
        }

        if (pwAlert) {
          pwAlert.style.display = 'block';
          pwAlert.style.background = '#dcfce7';
          pwAlert.style.color = '#166534';
          pwAlert.style.border = '1px solid #86efac';
          pwAlert.textContent = 'Password & PIN berhasil diperbarui! Gunakan password baru ini saat Anda login berikutnya.';
        }
        document.getElementById('pw-current').value = '';
        document.getElementById('pw-new').value = '';
        document.getElementById('pw-confirm').value = '';
      };
    }
  }

  // ===========================================================================
  // 2. HALAMAN SUPER ADMIN: MANAJEMEN SEMUA USER & HAK AKSES (`user-management`)
  // ===========================================================================
  function renderUserManagement(container) {
    var appState = window.ArbaStore.getState();
    var currentUser = appState.currentUser;
    if (!currentUser || currentUser.role !== 'super-admin') {
      window.ArbaApp.showToast('Halaman Manajemen User hanya dapat diakses oleh Super Admin!', 'lock');
      window.ArbaStore.setPath(currentUser ? currentUser.defaultPath : 'login');
      return;
    }

    var users = appState.users || [];
    var filteredUsers = users.filter(function (u) {
      var q = adminState.searchQuery.toLowerCase();
      var matchesSearch =
        !q ||
        u.name.toLowerCase().indexOf(q) !== -1 ||
        u.username.toLowerCase().indexOf(q) !== -1 ||
        u.email.toLowerCase().indexOf(q) !== -1 ||
        u.id.toLowerCase().indexOf(q) !== -1 ||
        (u.division || '').toLowerCase().indexOf(q) !== -1;

      var matchesRole = adminState.roleFilter === 'ALL' || u.role === adminState.roleFilter;
      return matchesSearch && matchesRole;
    });

    var activeCount = users.filter(function (u) { return u.active !== false; }).length;
    var salesCount = users.filter(function (u) { return u.role === 'field-sales'; }).length;
    var adminStaffCount = users.filter(function (u) { return u.role === 'inventory' || u.role === 'sales-ops'; }).length;

    var html = `
      <div class="flex flex-col w-full gap-space-lg pb-space-xl">
        <!-- Top Banner Super Admin -->
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-container-lowest p-6 rounded-xl border border-border-subtle/60">
          <div>
            <div class="flex items-center gap-2 text-xs font-bold text-rose-700 mb-1">
              <span class="material-symbols-outlined text-[16px]">admin_panel_settings</span>
              <span>SUPER ADMIN CONTROL CENTER • FULL SYSTEM ACCESS</span>
            </div>
            <h1 class="text-2xl font-bold text-on-surface tracking-tight">
              Manajemen Seluruh Pengguna &amp; Otorisasi Role (RBAC)
            </h1>
            <p class="text-xs text-on-surface-variant mt-0.5">
              Kelola seluruh akun pengguna CV Arba'in, ubah detail profil &amp; password user mana pun, atur hak akses halaman per role, atau masuk sebagai user tertentu.
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button
              id="btn-admin-toggle-pw-col"
              type="button"
              class="px-3.5 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold flex items-center gap-1.5 cursor-pointer border border-border-subtle"
            >
              <span class="material-symbols-outlined text-[16px]">${adminState.showPasswords ? 'visibility_off' : 'visibility'}</span>
              <span>${adminState.showPasswords ? 'Sembunyikan Password' : 'Tampilkan Password User'}</span>
            </button>
            <button
              id="btn-admin-add-user"
              type="button"
              class="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer border-0 shadow-xs"
            >
              <span class="material-symbols-outlined text-[18px]">person_add</span>
              <span>+ Tambah Akun User Baru</span>
            </button>
          </div>
        </div>

        <!-- 4 KPI Cards Ringkasan User -->
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div class="bg-surface-container-lowest p-5 rounded-xl border border-border-subtle/60">
            <div class="text-xs font-semibold uppercase text-on-surface-variant mb-1">Total Akun Terdaftar</div>
            <div class="text-2xl font-bold text-on-surface">${users.length} Akun</div>
            <div class="text-xs text-emerald-700 font-semibold mt-1">${activeCount} Aktif · ${users.length - activeCount} Nonaktif</div>
          </div>
          <div class="bg-surface-container-lowest p-5 rounded-xl border border-border-subtle/60">
            <div class="text-xs font-semibold uppercase text-on-surface-variant mb-1">Super Admin &amp; Direksi</div>
            <div class="text-2xl font-bold text-rose-700">${users.filter(function(u){return u.role === 'super-admin' || u.role === 'executive';}).length} Pejabat</div>
            <div class="text-xs text-on-surface-variant mt-1">Otoritas Penuh &amp; Eksekutif</div>
          </div>
          <div class="bg-surface-container-lowest p-5 rounded-xl border border-border-subtle/60">
            <div class="text-xs font-semibold uppercase text-on-surface-variant mb-1">Admin Gudang &amp; Penjualan</div>
            <div class="text-2xl font-bold text-primary">${adminStaffCount} Admin</div>
            <div class="text-xs text-on-surface-variant mt-1">Akses Terbatas Modul Operasional</div>
          </div>
          <div class="bg-surface-container-lowest p-5 rounded-xl border border-border-subtle/60">
            <div class="text-xs font-semibold uppercase text-on-surface-variant mb-1">Tim Field Sales (PWA)</div>
            <div class="text-2xl font-bold text-amber-600">${salesCount} Personel</div>
            <div class="text-xs text-on-surface-variant mt-1">Terkunci pada Rute &amp; Aplikasi PWA</div>
          </div>
        </div>

        <!-- Tabel Daftar Semua User -->
        <div class="bg-surface-container-lowest p-6 rounded-xl border border-border-subtle/60 flex flex-col gap-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-[20px]">group</span>
              <h2 class="font-bold text-base text-on-surface">Daftar Lengkap Akun Pengguna (${filteredUsers.length} dari ${users.length})</h2>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <div class="flex items-center bg-surface-container-low px-3 py-1.5 rounded-lg border border-border-subtle/50">
                <span class="material-symbols-outlined text-on-surface-variant text-[18px] mr-1.5">search</span>
                <input
                  type="text"
                  id="admin-user-search"
                  value="${window.ArbaUtils.escapeHtml(adminState.searchQuery)}"
                  placeholder="Cari nama, username, email..."
                  class="bg-transparent text-xs text-on-surface focus:outline-none border-0 w-48"
                />
              </div>
              <select
                id="admin-role-filter"
                class="bg-surface-container-low px-3 py-1.5 rounded-lg border border-border-subtle/50 text-xs font-semibold text-on-surface cursor-pointer"
              >
                <option value="ALL" ${adminState.roleFilter === 'ALL' ? 'selected' : ''}>Semua Role (${users.length})</option>
                <option value="super-admin" ${adminState.roleFilter === 'super-admin' ? 'selected' : ''}>Super Admin</option>
                <option value="executive" ${adminState.roleFilter === 'executive' ? 'selected' : ''}>Direktur &amp; Manajemen</option>
                <option value="inventory" ${adminState.roleFilter === 'inventory' ? 'selected' : ''}>Admin Gudang &amp; Stok</option>
                <option value="sales-ops" ${adminState.roleFilter === 'sales-ops' ? 'selected' : ''}>Admin Penjualan</option>
                <option value="field-sales" ${adminState.roleFilter === 'field-sales' ? 'selected' : ''}>Sales Lapangan (PWA)</option>
              </select>
            </div>
          </div>

          <div class="overflow-x-auto rounded-xl border border-border-subtle/40">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-surface-container-low text-on-surface-variant uppercase tracking-wider text-[11px]">
                  <th class="py-3 px-4">Nama &amp; ID Pengguna</th>
                  <th class="py-3 px-3">Username &amp; Email</th>
                  <th class="py-3 px-3">Role &amp; Divisi</th>
                  <th class="py-3 px-3">Password &amp; PIN</th>
                  <th class="py-3 px-3">Hak Akses Halaman</th>
                  <th class="py-3 px-3 text-center">Status</th>
                  <th class="py-3 px-4 text-right">Aksi Super Admin</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border-subtle/40 text-on-surface">
                ${filteredUsers.map(function (u) {
                  var rMeta = ROLE_LABELS[u.role] || ROLE_LABELS['field-sales'];
                  var perms = window.ArbaStore.getAllowedPathsForUser(u);
                  var isActive = u.active !== false;
                  return `
                    <tr class="hover:bg-surface-container-low/40 transition-colors ${!isActive ? 'opacity-50' : ''}">
                      <td class="py-3 px-4">
                        <div class="flex items-center gap-2.5">
                          <div style="width:34px; height:34px; border-radius:9px; background:${u.badgeColor || '#005c55'}; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:11px; flex-shrink:0;">
                            ${window.ArbaUtils.escapeHtml(u.avatarInitials || 'US')}
                          </div>
                          <div>
                            <div class="font-bold text-on-surface">${window.ArbaUtils.escapeHtml(u.name)}</div>
                            <div class="text-[11px] font-mono text-primary">${window.ArbaUtils.escapeHtml(u.id)} · ${window.ArbaUtils.escapeHtml(u.phone || '-')}</div>
                          </div>
                        </div>
                      </td>
                      <td class="py-3 px-3">
                        <div class="font-mono font-bold text-on-surface">@${window.ArbaUtils.escapeHtml(u.username)}</div>
                        <div class="text-[11px] text-on-surface-variant">${window.ArbaUtils.escapeHtml(u.email)}</div>
                      </td>
                      <td class="py-3 px-3">
                        <span style="display:inline-block; padding:2px 8px; border-radius:999px; font-size:10px; font-weight:800; background:${rMeta.bg}; color:${rMeta.text};">
                          ${rMeta.label}
                        </span>
                        <div class="text-[11px] text-on-surface-variant mt-1">${window.ArbaUtils.escapeHtml(u.title)} · ${window.ArbaUtils.escapeHtml(u.division)}</div>
                      </td>
                      <td class="py-3 px-3 font-mono">
                        <div>PW: <b class="text-primary">${adminState.showPasswords ? window.ArbaUtils.escapeHtml(u.password) : '••••••'}</b></div>
                        <div class="text-[10px] text-on-surface-variant">PIN: ${adminState.showPasswords ? window.ArbaUtils.escapeHtml(u.pin || '123456') : '••••••'}</div>
                      </td>
                      <td class="py-3 px-3">
                        <div class="flex flex-wrap gap-1 max-w-[230px]">
                          ${perms.map(function (pKey) {
                            var mObj = ALL_MODULES.find(function (m) { return m.path === pKey; });
                            var shortName = mObj ? mObj.name.replace(' Preview', '').replace(' (Super Admin)', '') : pKey;
                            return `<span class="px-1.5 py-0.5 rounded bg-surface-container text-[10px] font-semibold text-on-surface">${shortName}</span>`;
                          }).join('')}
                        </div>
                      </td>
                      <td class="py-3 px-3 text-center">
                        <button
                          type="button"
                          class="btn-admin-toggle-active px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer border-0 ${
                            isActive ? 'bg-status-success-bg text-status-success-text' : 'bg-rose-100 text-rose-700'
                          }"
                          data-user-id="${u.id}"
                          title="Klik untuk mengaktifkan / menonaktifkan akun"
                        >
                          ${isActive ? 'AKTIF' : 'NONAKTIF'}
                        </button>
                      </td>
                      <td class="py-3 px-4 text-right">
                        <div class="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            class="btn-admin-edit-user px-2.5 py-1.5 rounded-lg bg-primary text-white hover:bg-primary-container font-bold text-[11px] flex items-center gap-1 cursor-pointer border-0"
                            data-user-id="${u.id}"
                            title="Edit Detail Profil, Hak Akses &amp; Ganti Password User Ini"
                          >
                            <span class="material-symbols-outlined text-[14px]">edit_square</span>
                            <span>Edit / Password</span>
                          </button>
                          <button
                            type="button"
                            class="btn-admin-impersonate px-2 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-semibold text-[11px] flex items-center gap-1 cursor-pointer border border-border-subtle"
                            data-user-id="${u.id}"
                            title="Masuk / Uji Tampilan sebagai User Ini"
                          >
                            <span class="material-symbols-outlined text-[14px]">login</span>
                            <span>Masuk</span>
                          </button>
                          ${u.id !== 'USR-SUPER-01' ? `
                            <button
                              type="button"
                              class="btn-admin-delete-user p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer border border-rose-200"
                              data-user-id="${u.id}"
                              title="Hapus Akun User"
                            >
                              <span class="material-symbols-outlined text-[15px]">delete</span>
                            </button>
                          ` : ''}
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Bind events for Super Admin User Management
    var btnShowPw = container.querySelector('#btn-admin-toggle-pw-col');
    if (btnShowPw) {
      btnShowPw.onclick = function () {
        adminState.showPasswords = !adminState.showPasswords;
        renderUserManagement(container);
      };
    }

    var btnAddUser = container.querySelector('#btn-admin-add-user');
    if (btnAddUser) {
      btnAddUser.onclick = function () {
        openAdminUserModal(null, container);
      };
    }

    var searchInput = container.querySelector('#admin-user-search');
    if (searchInput) {
      searchInput.oninput = function (e) {
        adminState.searchQuery = e.target.value;
        renderUserManagement(container);
        var el = container.querySelector('#admin-user-search');
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      };
    }

    var roleSelect = container.querySelector('#admin-role-filter');
    if (roleSelect) {
      roleSelect.onchange = function (e) {
        adminState.roleFilter = e.target.value;
        renderUserManagement(container);
      };
    }

    container.querySelectorAll('.btn-admin-toggle-active').forEach(function (btn) {
      btn.onclick = function () {
        var uid = btn.getAttribute('data-user-id');
        if (uid === 'USR-SUPER-01') {
          window.ArbaApp.showToast('Akun Super Admin utama harus selalu aktif!', 'warning');
          return;
        }
        var target = users.find(function (u) { return u.id === uid; });
        if (target) {
          window.ArbaStore.updateUserProfile(uid, { active: target.active === false });
        }
      };
    });

    container.querySelectorAll('.btn-admin-edit-user').forEach(function (btn) {
      btn.onclick = function () {
        var uid = btn.getAttribute('data-user-id');
        var target = users.find(function (u) { return u.id === uid; });
        if (target) {
          openAdminUserModal(target, container);
        }
      };
    });

    container.querySelectorAll('.btn-admin-impersonate').forEach(function (btn) {
      btn.onclick = function () {
        var uid = btn.getAttribute('data-user-id');
        var target = users.find(function (u) { return u.id === uid; });
        if (target) {
          window.ArbaStore.loginUser(target);
        }
      };
    });

    container.querySelectorAll('.btn-admin-delete-user').forEach(function (btn) {
      btn.onclick = function () {
        var uid = btn.getAttribute('data-user-id');
        window.ArbaStore.deleteUser(uid);
      };
    });
  }

  // Modal Super Admin: Edit Detail User / Ganti Password / Atur Hak Akses Halaman / Tambah User Baru
  function openAdminUserModal(editUser, parentContainer) {
    var isEdit = Boolean(editUser);
    var u = editUser || {
      name: '',
      username: '',
      email: '',
      phone: '0812',
      password: '123',
      pin: '123456',
      role: 'field-sales',
      title: 'Field Sales Representative',
      division: 'Divisi Madu & Herbal',
      badgeColor: '#005c55',
      defaultPath: 'field-sales-pwa-preview',
      permissions: ['field-sales-pwa-preview', 'b2b-crm-directory', 'user-profile-settings']
    };

    var currentPerms = isEdit ? window.ArbaStore.getAllowedPathsForUser(u) : u.permissions;

    var modalHtml = `
      <div class="modal-dialog max-w-2xl">
        <div class="modal-header">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[22px]">${isEdit ? 'manage_accounts' : 'person_add'}</span>
            <div>
              <h3 class="font-bold text-sm text-on-surface">
                ${isEdit ? 'Edit Detail User, Hak Akses & Reset Password (' + window.ArbaUtils.escapeHtml(u.name) + ')' : 'Tambah Akun Pengguna Baru (RBAC)'}
              </h3>
              <p class="text-[11px] text-on-surface-variant">Otoritas Super Admin: atur kredensial dan halaman yang boleh diakses user ini.</p>
            </div>
          </div>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form id="form-admin-user-modal">
          <div class="modal-body text-xs space-y-3 max-h-[72vh] overflow-y-auto">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-on-surface mb-1">Nama Lengkap Pengguna</label>
                <input type="text" id="adm-u-name" required value="${window.ArbaUtils.escapeHtml(u.name)}" class="w-full p-2 rounded-lg border border-border-subtle bg-surface-container-low text-on-surface font-semibold" />
              </div>
              <div>
                <label class="block font-bold text-on-surface mb-1">Username Login</label>
                <input type="text" id="adm-u-username" required value="${window.ArbaUtils.escapeHtml(u.username)}" class="w-full p-2 rounded-lg border border-border-subtle bg-surface-container-low text-on-surface font-mono font-bold" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-on-surface mb-1">Email Resmi</label>
                <input type="email" id="adm-u-email" required value="${window.ArbaUtils.escapeHtml(u.email)}" class="w-full p-2 rounded-lg border border-border-subtle bg-surface-container-low text-on-surface" />
              </div>
              <div>
                <label class="block font-bold text-on-surface mb-1">No. Telepon / WhatsApp</label>
                <input type="text" id="adm-u-phone" value="${window.ArbaUtils.escapeHtml(u.phone || '')}" class="w-full p-2 rounded-lg border border-border-subtle bg-surface-container-low text-on-surface font-mono" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block font-bold text-on-surface mb-1">Role Pengguna</label>
                <select id="adm-u-role" class="w-full p-2 rounded-lg border border-border-subtle bg-surface-container-low text-on-surface font-bold cursor-pointer">
                  <option value="super-admin" ${u.role === 'super-admin' ? 'selected' : ''}>Super Admin (All Access)</option>
                  <option value="executive" ${u.role === 'executive' ? 'selected' : ''}>Direktur &amp; Manajemen</option>
                  <option value="inventory" ${u.role === 'inventory' ? 'selected' : ''}>Admin Gudang &amp; Stok</option>
                  <option value="sales-ops" ${u.role === 'sales-ops' ? 'selected' : ''}>Admin Penjualan</option>
                  <option value="field-sales" ${u.role === 'field-sales' ? 'selected' : ''}>Sales Lapangan (PWA)</option>
                </select>
              </div>
              <div>
                <label class="block font-bold text-on-surface mb-1">Jabatan</label>
                <input type="text" id="adm-u-title" required value="${window.ArbaUtils.escapeHtml(u.title)}" class="w-full p-2 rounded-lg border border-border-subtle bg-surface-container-low text-on-surface" />
              </div>
              <div>
                <label class="block font-bold text-on-surface mb-1">Divisi / Area</label>
                <input type="text" id="adm-u-division" required value="${window.ArbaUtils.escapeHtml(u.division)}" class="w-full p-2 rounded-lg border border-border-subtle bg-surface-container-low text-on-surface" />
              </div>
            </div>

            <!-- Bagian Password & PIN -->
            <div class="p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
              <div class="font-bold text-amber-900 flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">key</span>
                <span>Kredensial Login (Password &amp; PIN Offline)</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Password Login</label>
                  <input type="text" id="adm-u-password" required value="${window.ArbaUtils.escapeHtml(u.password || '123')}" class="w-full p-2 rounded-lg border border-amber-300 bg-white text-slate-900 font-mono font-bold" />
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">PIN Offline (6 Digit)</label>
                  <input type="text" id="adm-u-pin" required value="${window.ArbaUtils.escapeHtml(u.pin || '123456')}" class="w-full p-2 rounded-lg border border-amber-300 bg-white text-slate-900 font-mono font-bold" />
                </div>
              </div>
            </div>

            <!-- Bagian Hak Akses Halaman (RBAC Checkboxes) -->
            <div class="p-3 rounded-xl bg-surface-container-low border border-border-subtle space-y-2">
              <div class="font-bold text-on-surface flex items-center justify-between">
                <span>Halaman yang Diizinkan untuk Diakses User Ini:</span>
                <span class="text-[10px] text-primary font-semibold">Centang sesuai kewenangan role</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                ${ALL_MODULES.map(function (mod) {
                  var checked = currentPerms.indexOf(mod.path) !== -1;
                  return `
                    <label class="flex items-center gap-2 p-2 rounded-lg bg-surface-container-lowest border border-border-subtle/50 cursor-pointer">
                      <input
                        type="checkbox"
                        class="adm-perm-checkbox w-4 h-4 accent-primary"
                        value="${mod.path}"
                        ${checked ? 'checked' : ''}
                      />
                      <div>
                        <div class="font-bold text-on-surface text-[11px]">${mod.name}</div>
                        <div class="text-[10px] text-on-surface-variant">${mod.desc}</div>
                      </div>
                    </label>
                  `;
                }).join('')}
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-outline" onclick="window.ArbaApp.closeModal()">Batal</button>
            <button type="submit" class="btn btn-primary">
              ${isEdit ? 'Simpan Perubahan User & Password' : 'Buat Akun User Baru'}
            </button>
          </div>
        </form>
      </div>
    `;

    window.ArbaApp.openModal(modalHtml);

    // Otomatis sesuaikan default checkbox permissions saat Role diubah di modal
    var roleSel = document.getElementById('adm-u-role');
    if (roleSel) {
      roleSel.onchange = function (e) {
        var r = e.target.value;
        var map = {
          'super-admin': ['executive-dashboard', 'inventory-stock-ledger', 'b2b-crm-directory', 'order-approval-queue', 'field-sales-pwa-preview', 'user-management', 'user-profile-settings'],
          'executive': ['executive-dashboard', 'inventory-stock-ledger', 'b2b-crm-directory', 'order-approval-queue', 'user-profile-settings'],
          'inventory': ['inventory-stock-ledger', 'order-approval-queue', 'user-profile-settings'],
          'sales-ops': ['order-approval-queue', 'b2b-crm-directory', 'user-profile-settings'],
          'field-sales': ['field-sales-pwa-preview', 'b2b-crm-directory', 'user-profile-settings']
        };
        var preset = map[r] || ['user-profile-settings'];
        document.querySelectorAll('.adm-perm-checkbox').forEach(function (cb) {
          cb.checked = preset.indexOf(cb.value) !== -1;
        });
      };
    }

    var form = document.getElementById('form-admin-user-modal');
    if (form) {
      form.onsubmit = function (e) {
        e.preventDefault();
        var selectedPerms = [];
        document.querySelectorAll('.adm-perm-checkbox').forEach(function (cb) {
          if (cb.checked) selectedPerms.push(cb.value);
        });
        if (selectedPerms.indexOf('user-profile-settings') === -1) {
          selectedPerms.push('user-profile-settings');
        }

        var payload = {
          name: document.getElementById('adm-u-name').value,
          username: document.getElementById('adm-u-username').value,
          email: document.getElementById('adm-u-email').value,
          phone: document.getElementById('adm-u-phone').value,
          role: document.getElementById('adm-u-role').value,
          title: document.getElementById('adm-u-title').value,
          division: document.getElementById('adm-u-division').value,
          password: document.getElementById('adm-u-password').value,
          pin: document.getElementById('adm-u-pin').value,
          permissions: selectedPerms,
          defaultPath: selectedPerms[0] || 'user-profile-settings'
        };

        if (isEdit) {
          window.ArbaStore.updateUserProfile(editUser.id, payload);
        } else {
          window.ArbaStore.createNewUser(payload);
        }
        window.ArbaApp.closeModal();
        if (parentContainer) renderUserManagement(parentContainer);
      };
    }
  }

  window.ArbaViews.renderUserProfileSettings = renderUserProfileSettings;
  window.ArbaViews.renderUserManagement = renderUserManagement;
})();

