/**
 * ArbaConnect ERP - User Profile Settings & User Management View
 */

(function () {
  'use strict';

  window.ArbaViews = window.ArbaViews || {};

  var ROLE_LABELS = {
    'super-admin': { label: 'Super Admin', bg: '#ffe4e6', text: '#be123c' },
    'executive': { label: 'Direktur', bg: '#e6f4f1', text: '#005c55' },
    'inventory': { label: 'Admin Gudang', bg: '#e0f2fe', text: '#0369a1' },
    'sales-ops': { label: 'Admin Penjualan', bg: '#f3e8ff', text: '#6d28d9' },
    'field-sales': { label: 'Sales Lapangan', bg: '#fef3c7', text: '#b45309' }
  };

  var ALL_MODULES = [
    { path: 'executive-dashboard', name: 'Dasbor Eksekutif' },
    { path: 'inventory-stock-ledger', name: 'Stok & Gudang' },
    { path: 'b2b-crm-directory', name: 'Mitra Outlet' },
    { path: 'order-approval-queue', name: 'Verifikasi Order' },
    { path: 'field-sales-pwa-preview', name: 'Aplikasi Sales' },
    { path: 'user-management', name: 'Manajemen User' },
    { path: 'user-profile-settings', name: 'Profil & Keamanan' }
  ];

  var adminState = {
    searchQuery: '',
    roleFilter: 'ALL'
  };

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

    var html = `
      <div class="flex flex-col w-full gap-space-lg pb-space-xl">
        <div class="page-header">
          <div>
            <h1 class="page-title">Profil &amp; Keamanan</h1>
            <p class="page-meta">${window.ArbaUtils.escapeHtml(user.name)} · ${window.ArbaUtils.escapeHtml(roleInfo.label)}</p>
          </div>
          <div class="flex items-center gap-2">
            ${user.role === 'super-admin' ? `
              <button id="btn-goto-user-mgmt" type="button" class="btn btn-outline">
                <span class="material-symbols-outlined text-[16px]">manage_accounts</span>
                <span>Manajemen User</span>
              </button>
            ` : ''}
            <button id="btn-profile-page-logout" type="button" class="btn btn-danger">
              <span class="material-symbols-outlined text-[16px]">logout</span>
              <span>Keluar</span>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
          <div class="lg:col-span-4 flex flex-col gap-4">
            <div class="section-card flex flex-col items-center text-center">
              <div
                style="width:68px; height:68px; border-radius:18px; background:${user.badgeColor || '#005c55'}; color:#ffffff; display:flex; align-items:center; justify-content:center; font-size:24px; font-weight:800; margin-bottom:12px;"
              >
                ${window.ArbaUtils.escapeHtml(user.avatarInitials || 'US')}
              </div>
              <span class="badge badge-round" style="background:${roleInfo.bg}; color:${roleInfo.text};">${roleInfo.label}</span>
              <h2 class="text-lg font-bold text-on-surface mt-2">${window.ArbaUtils.escapeHtml(user.name)}</h2>
              <p class="text-xs text-on-surface-variant">${window.ArbaUtils.escapeHtml(user.title)} · ${window.ArbaUtils.escapeHtml(user.division)}</p>

              <div class="w-full mt-4 pt-4 border-t border-border-subtle text-left space-y-2 text-xs">
                <div class="flex justify-between">
                  <span class="text-on-surface-variant">ID</span>
                  <span class="font-mono font-bold text-primary">${window.ArbaUtils.escapeHtml(user.id)}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-on-surface-variant">Username</span>
                  <span class="font-mono font-semibold text-on-surface">@${window.ArbaUtils.escapeHtml(user.username)}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-on-surface-variant">Email</span>
                  <span class="font-semibold text-on-surface">${window.ArbaUtils.escapeHtml(user.email)}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-on-surface-variant">Telepon</span>
                  <span class="font-mono text-on-surface">${window.ArbaUtils.escapeHtml(user.phone || '-')}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="lg:col-span-8 flex flex-col gap-6">
            <div class="section-card">
              <h3 class="section-title mb-4">Edit Profil</h3>
              <form id="form-edit-own-profile" class="space-y-4 text-xs">
                <div class="form-grid-2">
                  <div class="form-group">
                    <label class="form-label">Nama Lengkap</label>
                    <input type="text" id="prof-name" required value="${window.ArbaUtils.escapeHtml(user.name)}" class="form-input font-semibold" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Username</label>
                    <input type="text" id="prof-username" required value="${window.ArbaUtils.escapeHtml(user.username)}" class="form-input font-mono font-semibold" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Email</label>
                    <input type="email" id="prof-email" required value="${window.ArbaUtils.escapeHtml(user.email)}" class="form-input" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Telepon / WhatsApp</label>
                    <input type="text" id="prof-phone" value="${window.ArbaUtils.escapeHtml(user.phone || '')}" class="form-input font-mono" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Jabatan</label>
                    <input type="text" id="prof-title" required value="${window.ArbaUtils.escapeHtml(user.title)}" class="form-input" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Divisi / Area</label>
                    <input type="text" id="prof-division" required value="${window.ArbaUtils.escapeHtml(user.division)}" class="form-input" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Inisial (Maks 2 Huruf)</label>
                    <input type="text" id="prof-initials" maxlength="2" required value="${window.ArbaUtils.escapeHtml(user.avatarInitials || 'US')}" class="form-input font-mono font-bold uppercase" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Warna Badge</label>
                    <input type="color" id="prof-color" value="${user.badgeColor || '#005c55'}" class="form-input h-10 p-1 cursor-pointer" />
                  </div>
                </div>
                <div class="flex justify-end">
                  <button type="submit" class="btn btn-primary">Simpan Profil</button>
                </div>
              </form>
            </div>

            <div class="section-card">
              <div class="flex items-center justify-between mb-4">
                <h3 class="section-title">Ganti Password &amp; PIN</h3>
                <button type="button" id="btn-toggle-pw-fields" class="btn btn-sm btn-outline">Tampilkan</button>
              </div>

              <div id="pw-change-alert" style="display:none;" class="p-3 rounded-lg text-xs font-semibold mb-4"></div>

              <form id="form-change-own-password" class="space-y-4 text-xs">
                <div class="form-grid-2">
                  <div class="form-group">
                    <label class="form-label">Password Saat Ini</label>
                    <input type="password" id="pw-current" required class="pw-field-toggle form-input font-mono" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">PIN Offline</label>
                    <input type="password" id="pw-new-pin" maxlength="8" value="${window.ArbaUtils.escapeHtml(user.pin || '123456')}" class="pw-field-toggle form-input font-mono" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Password Baru</label>
                    <input type="password" id="pw-new" required class="pw-field-toggle form-input font-mono" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Konfirmasi Password Baru</label>
                    <input type="password" id="pw-confirm" required class="pw-field-toggle form-input font-mono" />
                  </div>
                </div>
                <div class="flex justify-end">
                  <button type="submit" class="btn btn-primary">Perbarui Password</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;

    var btnGotoMgmt = container.querySelector('#btn-goto-user-mgmt');
    if (btnGotoMgmt) btnGotoMgmt.onclick = function () { window.ArbaApp.navigate('user-management'); };

    var btnLogout = container.querySelector('#btn-profile-page-logout');
    if (btnLogout) btnLogout.onclick = function () { window.ArbaStore.logoutUser(); };

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
        fields.forEach(function (f) { f.type = isHidden ? 'text' : 'password'; });
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
            pwAlert.className = 'p-3 rounded-lg text-xs font-semibold mb-4 bg-status-danger-bg text-status-danger-text';
            pwAlert.textContent = 'Konfirmasi password tidak cocok.';
          }
          return;
        }

        var res = window.ArbaStore.changeUserPassword(user.id, curPw, newPw, newPin, false);
        if (!res.ok) {
          if (pwAlert) {
            pwAlert.style.display = 'block';
            pwAlert.className = 'p-3 rounded-lg text-xs font-semibold mb-4 bg-status-danger-bg text-status-danger-text';
            pwAlert.textContent = res.message;
          }
          return;
        }

        if (pwAlert) {
          pwAlert.style.display = 'block';
          pwAlert.className = 'p-3 rounded-lg text-xs font-semibold mb-4 bg-status-success-bg text-status-success-text';
          pwAlert.textContent = 'Password berhasil diperbarui.';
        }
        document.getElementById('pw-current').value = '';
        document.getElementById('pw-new').value = '';
        document.getElementById('pw-confirm').value = '';
      };
    }
  }

  function renderUserManagement(container) {
    var appState = window.ArbaStore.getState();
    var currentUser = appState.currentUser;
    if (!currentUser || currentUser.role !== 'super-admin') {
      window.ArbaApp.showToast('Halaman ini khusus Super Admin', 'lock');
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
        <div class="page-header">
          <div>
            <h1 class="page-title">Manajemen User</h1>
            <p class="page-meta">${users.length} akun terdaftar · ${activeCount} aktif</p>
          </div>
          <button id="btn-admin-add-user" type="button" class="btn btn-primary">
            <span class="material-symbols-outlined text-[18px]">person_add</span>
            <span>Tambah User</span>
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div class="kpi-card">
            <span class="kpi-title">Total Akun</span>
            <div class="kpi-value mt-1">${users.length}</div>
            <div class="kpi-subtext mt-1">${activeCount} Aktif · ${users.length - activeCount} Nonaktif</div>
          </div>
          <div class="kpi-card">
            <span class="kpi-title">Admin &amp; Direksi</span>
            <div class="kpi-value mt-1 text-rose-700">${users.filter(function(u){return u.role === 'super-admin' || u.role === 'executive';}).length}</div>
            <div class="kpi-subtext mt-1">Super Admin &amp; Manajemen</div>
          </div>
          <div class="kpi-card">
            <span class="kpi-title">Staf Operasional</span>
            <div class="kpi-value mt-1 text-primary">${adminStaffCount}</div>
            <div class="kpi-subtext mt-1">Gudang &amp; Penjualan</div>
          </div>
          <div class="kpi-card">
            <span class="kpi-title">Sales Lapangan</span>
            <div class="kpi-value mt-1 text-amber-700">${salesCount}</div>
            <div class="kpi-subtext mt-1">Aplikasi Sales</div>
          </div>
        </div>

        <div class="section-card flex flex-col gap-4">
          <div class="section-header">
            <h2 class="section-title">Daftar User (${filteredUsers.length})</h2>
            <div class="flex flex-wrap items-center gap-2">
              <div class="flex items-center bg-surface-container-low px-3 py-1.5 rounded-lg border border-border-subtle/50">
                <span class="material-symbols-outlined text-on-surface-variant text-[18px] mr-1.5">search</span>
                <input
                  type="text"
                  id="admin-user-search"
                  value="${window.ArbaUtils.escapeHtml(adminState.searchQuery)}"
                  placeholder="Cari nama / username..."
                  class="bg-transparent text-xs text-on-surface focus:outline-none border-0 w-48"
                />
              </div>
              <select id="admin-role-filter" class="form-select w-auto">
                <option value="ALL" ${adminState.roleFilter === 'ALL' ? 'selected' : ''}>Semua Role</option>
                <option value="super-admin" ${adminState.roleFilter === 'super-admin' ? 'selected' : ''}>Super Admin</option>
                <option value="executive" ${adminState.roleFilter === 'executive' ? 'selected' : ''}>Direktur</option>
                <option value="inventory" ${adminState.roleFilter === 'inventory' ? 'selected' : ''}>Admin Gudang</option>
                <option value="sales-ops" ${adminState.roleFilter === 'sales-ops' ? 'selected' : ''}>Admin Penjualan</option>
                <option value="field-sales" ${adminState.roleFilter === 'field-sales' ? 'selected' : ''}>Sales Lapangan</option>
              </select>
            </div>
          </div>

          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Username &amp; Email</th>
                  <th>Role &amp; Divisi</th>
                  <th>Akses Halaman</th>
                  <th class="text-center">Status</th>
                  <th class="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                ${filteredUsers.map(function (u) {
                  var rMeta = ROLE_LABELS[u.role] || ROLE_LABELS['field-sales'];
                  var perms = window.ArbaStore.getAllowedPathsForUser(u);
                  var isActive = u.active !== false;
                  return `
                    <tr class="${!isActive ? 'opacity-50' : ''}">
                      <td>
                        <div class="flex items-center gap-2.5">
                          <div style="width:32px; height:32px; border-radius:8px; background:${u.badgeColor || '#005c55'}; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:11px; flex-shrink:0;">
                            ${window.ArbaUtils.escapeHtml(u.avatarInitials || 'US')}
                          </div>
                          <div>
                            <div class="font-bold text-on-surface">${window.ArbaUtils.escapeHtml(u.name)}</div>
                            <div class="text-[11px] font-mono text-on-surface-variant">${window.ArbaUtils.escapeHtml(u.id)}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div class="font-mono font-semibold text-on-surface">@${window.ArbaUtils.escapeHtml(u.username)}</div>
                        <div class="text-[11px] text-on-surface-variant">${window.ArbaUtils.escapeHtml(u.email)}</div>
                      </td>
                      <td>
                        <span class="badge" style="background:${rMeta.bg}; color:${rMeta.text};">${rMeta.label}</span>
                        <div class="text-[11px] text-on-surface-variant mt-1">${window.ArbaUtils.escapeHtml(u.division)}</div>
                      </td>
                      <td>
                        <div class="flex flex-wrap gap-1 max-w-[220px]">
                          ${perms.map(function (pKey) {
                            var mObj = ALL_MODULES.find(function (m) { return m.path === pKey; });
                            return `<span class="badge badge-neutral text-[10px]">${mObj ? mObj.name : pKey}</span>`;
                          }).join('')}
                        </div>
                      </td>
                      <td class="text-center">
                        <button
                          type="button"
                          class="btn-admin-toggle-active badge cursor-pointer border-0 ${isActive ? 'badge-success' : 'badge-danger'}"
                          data-user-id="${u.id}"
                        >
                          ${isActive ? 'Aktif' : 'Nonaktif'}
                        </button>
                      </td>
                      <td class="text-right">
                        <div class="flex items-center justify-end gap-1.5">
                          <button type="button" class="btn-admin-edit-user btn btn-sm btn-primary" data-user-id="${u.id}">Edit</button>
                          <button type="button" class="btn-admin-impersonate btn btn-sm btn-outline" data-user-id="${u.id}">Masuk</button>
                          ${u.id !== 'USR-SUPER-01' ? `
                            <button type="button" class="btn-admin-delete-user icon-btn text-rose-600" data-user-id="${u.id}" title="Hapus">
                              <span class="material-symbols-outlined text-[16px]">delete</span>
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

    var btnAddUser = container.querySelector('#btn-admin-add-user');
    if (btnAddUser) btnAddUser.onclick = function () { openAdminUserModal(null, container); };

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
          window.ArbaApp.showToast('Akun Super Admin utama harus selalu aktif', 'warning');
          return;
        }
        var target = users.find(function (u) { return u.id === uid; });
        if (target) window.ArbaStore.updateUserProfile(uid, { active: target.active === false });
      };
    });

    container.querySelectorAll('.btn-admin-edit-user').forEach(function (btn) {
      btn.onclick = function () {
        var target = users.find(function (u) { return u.id === btn.getAttribute('data-user-id'); });
        if (target) openAdminUserModal(target, container);
      };
    });

    container.querySelectorAll('.btn-admin-impersonate').forEach(function (btn) {
      btn.onclick = function () {
        var target = users.find(function (u) { return u.id === btn.getAttribute('data-user-id'); });
        if (target) window.ArbaStore.loginUser(target);
      };
    });

    container.querySelectorAll('.btn-admin-delete-user').forEach(function (btn) {
      btn.onclick = function () { window.ArbaStore.deleteUser(btn.getAttribute('data-user-id')); };
    });
  }

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
          <h3 class="modal-title">${isEdit ? 'Edit User: ' + window.ArbaUtils.escapeHtml(u.name) : 'Tambah User Baru'}</h3>
          <button class="icon-btn" onclick="window.ArbaApp.closeModal()" type="button">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form id="form-admin-user-modal">
          <div class="modal-body text-xs space-y-3 max-h-[72vh] overflow-y-auto">
            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Nama Lengkap</label>
                <input type="text" id="adm-u-name" required value="${window.ArbaUtils.escapeHtml(u.name)}" class="form-input font-semibold" />
              </div>
              <div class="form-group">
                <label class="form-label">Username</label>
                <input type="text" id="adm-u-username" required value="${window.ArbaUtils.escapeHtml(u.username)}" class="form-input font-mono font-bold" />
              </div>
              <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" id="adm-u-email" required value="${window.ArbaUtils.escapeHtml(u.email)}" class="form-input" />
              </div>
              <div class="form-group">
                <label class="form-label">Telepon</label>
                <input type="text" id="adm-u-phone" value="${window.ArbaUtils.escapeHtml(u.phone || '')}" class="form-input font-mono" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="form-group">
                <label class="form-label">Role</label>
                <select id="adm-u-role" class="form-select font-semibold">
                  <option value="super-admin" ${u.role === 'super-admin' ? 'selected' : ''}>Super Admin</option>
                  <option value="executive" ${u.role === 'executive' ? 'selected' : ''}>Direktur</option>
                  <option value="inventory" ${u.role === 'inventory' ? 'selected' : ''}>Admin Gudang</option>
                  <option value="sales-ops" ${u.role === 'sales-ops' ? 'selected' : ''}>Admin Penjualan</option>
                  <option value="field-sales" ${u.role === 'field-sales' ? 'selected' : ''}>Sales Lapangan</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Jabatan</label>
                <input type="text" id="adm-u-title" required value="${window.ArbaUtils.escapeHtml(u.title)}" class="form-input" />
              </div>
              <div class="form-group">
                <label class="form-label">Divisi / Area</label>
                <input type="text" id="adm-u-division" required value="${window.ArbaUtils.escapeHtml(u.division)}" class="form-input" />
              </div>
            </div>

            <div class="form-grid-2 p-3 rounded-xl bg-surface-container-low border border-border-subtle">
              <div class="form-group">
                <label class="form-label">Password Baru</label>
                <input type="text" id="adm-u-password" required value="${window.ArbaUtils.escapeHtml(u.password || '123')}" class="form-input font-mono" />
              </div>
              <div class="form-group">
                <label class="form-label">PIN Offline</label>
                <input type="text" id="adm-u-pin" required value="${window.ArbaUtils.escapeHtml(u.pin || '123456')}" class="form-input font-mono" />
              </div>
            </div>

            <div class="p-3 rounded-xl bg-surface-container-low border border-border-subtle space-y-2">
              <div class="font-bold text-on-surface">Hak Akses Halaman</div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                ${ALL_MODULES.map(function (mod) {
                  var checked = currentPerms.indexOf(mod.path) !== -1;
                  return `
                    <label class="flex items-center gap-2 p-2 rounded-lg bg-surface-container-lowest border border-border-subtle/50 cursor-pointer">
                      <input type="checkbox" class="adm-perm-checkbox w-4 h-4 accent-primary" value="${mod.path}" ${checked ? 'checked' : ''} />
                      <span class="font-semibold text-on-surface text-[11px]">${mod.name}</span>
                    </label>
                  `;
                }).join('')}
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-outline" onclick="window.ArbaApp.closeModal()">Batal</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Simpan' : 'Tambah User'}</button>
          </div>
        </form>
      </div>
    `;

    window.ArbaApp.openModal(modalHtml);

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

        if (isEdit) window.ArbaStore.updateUserProfile(editUser.id, payload);
        else window.ArbaStore.createNewUser(payload);
        window.ArbaApp.closeModal();
        if (parentContainer) renderUserManagement(parentContainer);
      };
    }
  }

  window.ArbaViews.renderUserProfileSettings = renderUserProfileSettings;
  window.ArbaViews.renderUserManagement = renderUserManagement;
})();
