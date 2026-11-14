/**
 * ArbaConnect ERP - Reactive Centralized Store & Business Mutations
 * CV Arba'in Solo Raya
 */

window.ArbaStore = (function() {
  const STORAGE_KEY = 'arbaconnect_erp_state_v5';
  const ALL_VALID_PATHS = [
    'login',
    'executive-dashboard',
    'inventory-stock-ledger',
    'b2b-crm-directory',
    'order-approval-queue',
    'field-sales-pwa-preview',
    'user-management',
    'user-profile-settings'
  ];

  // Load from local storage or fallback to ArbaData initial values
  function loadInitialState() {
    let hashPath = null;
    let overrideSidebarCollapsed = null;
    let overrideDarkMode = null;
    if (typeof window !== 'undefined' && window.location) {
      if (window.location.hash) {
        const h = window.location.hash.replace(/^#\/?/, '');
        if (ALL_VALID_PATHS.indexOf(h) !== -1) {
          hashPath = h;
        }
      }
      if (window.location.search) {
        if (window.location.search.indexOf('sidebar=expanded') !== -1) {
          overrideSidebarCollapsed = false;
        } else if (window.location.search.indexOf('sidebar=collapsed') !== -1) {
          overrideSidebarCollapsed = true;
        }
        if (window.location.search.indexOf('dark=true') !== -1) {
          overrideDarkMode = true;
        } else if (window.location.search.indexOf('dark=false') !== -1) {
          overrideDarkMode = false;
        }
      }
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          currentPath: hashPath || parsed.currentPath || 'executive-dashboard',
          currentRole: parsed.currentRole || 'executive',
          currentUser: parsed.currentUser || null,
          users: parsed.users || JSON.parse(JSON.stringify(ArbaData.users || [])),
          isOnline: parsed.isOnline !== undefined ? parsed.isOnline : true,
          isDarkMode: overrideDarkMode !== null ? overrideDarkMode : (parsed.isDarkMode || false),
          isSidebarCollapsed: overrideSidebarCollapsed !== null ? overrideSidebarCollapsed : (parsed.isSidebarCollapsed !== undefined ? parsed.isSidebarCollapsed : true),
          selectedOutletId: parsed.selectedOutletId || 'AP-SLO-001',
          products: parsed.products || ArbaData.products,
          ledger: parsed.ledger || ArbaData.ledger,
          outlets: parsed.outlets || ArbaData.outlets,
          orders: parsed.orders || ArbaData.orders,
          supplierPOs: parsed.supplierPOs || ArbaData.supplierPOs,
          salesVisits: parsed.salesVisits || ArbaData.salesVisits,
          driverManifests: parsed.driverManifests || ArbaData.driverManifests,
          salesTeam: parsed.salesTeam || JSON.parse(JSON.stringify(ArbaData.salesTeam)),
          salesLoadings: parsed.salesLoadings || JSON.parse(JSON.stringify(ArbaData.salesLoadings)),
          visitLogs: parsed.visitLogs || JSON.parse(JSON.stringify(ArbaData.visitLogs)),
          currentSalesRep: parsed.currentSalesRep || 'Budi Santoso',
          offlineQueue: parsed.offlineQueue || []
        };
      }
    } catch (e) {
      console.warn('Gagal membaca localStorage, memuat data default awal', e);
    }

    return {
      currentPath: hashPath || 'executive-dashboard',
      currentRole: 'executive',
      currentUser: null,
      users: JSON.parse(JSON.stringify(ArbaData.users || [])),
      isOnline: true,
      isDarkMode: overrideDarkMode !== null ? overrideDarkMode : false,
      isSidebarCollapsed: overrideSidebarCollapsed !== null ? overrideSidebarCollapsed : true,
      selectedOutletId: 'AP-SLO-001',
      products: JSON.parse(JSON.stringify(ArbaData.products)),
      ledger: JSON.parse(JSON.stringify(ArbaData.ledger)),
      outlets: JSON.parse(JSON.stringify(ArbaData.outlets)),
      orders: JSON.parse(JSON.stringify(ArbaData.orders)),
      supplierPOs: JSON.parse(JSON.stringify(ArbaData.supplierPOs)),
      salesVisits: JSON.parse(JSON.stringify(ArbaData.salesVisits)),
      driverManifests: JSON.parse(JSON.stringify(ArbaData.driverManifests)),
      salesTeam: JSON.parse(JSON.stringify(ArbaData.salesTeam)),
      salesLoadings: JSON.parse(JSON.stringify(ArbaData.salesLoadings)),
      visitLogs: JSON.parse(JSON.stringify(ArbaData.visitLogs)),
      currentSalesRep: 'Budi Santoso',
      offlineQueue: []
    };
  }

  const state = loadInitialState();
  const listeners = [];
  let toastTimer = null;

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        currentPath: state.currentPath,
        currentRole: state.currentRole,
        currentUser: state.currentUser,
        users: state.users,
        isOnline: state.isOnline,
        isDarkMode: state.isDarkMode,
        isSidebarCollapsed: state.isSidebarCollapsed,
        selectedOutletId: state.selectedOutletId,
        products: state.products,
        ledger: state.ledger,
        outlets: state.outlets,
        orders: state.orders,
        supplierPOs: state.supplierPOs,
        salesVisits: state.salesVisits,
        driverManifests: state.driverManifests,
        salesTeam: state.salesTeam,
        salesLoadings: state.salesLoadings,
        visitLogs: state.visitLogs,
        currentSalesRep: state.currentSalesRep,
        offlineQueue: state.offlineQueue
      }));
    } catch (e) {
      console.error('Failed to persist to localStorage', e);
    }
  }

  function subscribe(fn) {
    listeners.push(fn);
  }

  function notify() {
    persist();
    listeners.forEach(fn => {
      try {
        fn(state);
      } catch (err) {
        console.error('Error in store listener', err);
      }
    });
  }

  function showToast(message, icon = 'check_circle') {
    // Delegasikan ke Toast Manager global (#toast-container di index.html).
    if (window.ArbaApp && typeof window.ArbaApp.showToast === 'function') {
      window.ArbaApp.showToast(message, icon);
      return;
    }

    const toastEl = document.getElementById('toast-popup');
    const toastMsg = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');

    if (!toastEl || !toastMsg) return;

    if (toastTimer) clearTimeout(toastTimer);

    toastMsg.textContent = message;
    if (toastIcon) toastIcon.textContent = icon;
    toastEl.style.display = 'flex';

    toastTimer = setTimeout(() => {
      toastEl.style.display = 'none';
    }, 3500);
  }

  // ---------------------------------------------------------------------------
  // Helper Inti: waktu, pencarian produk, status ROP, mutasi stok, kredit outlet
  // ---------------------------------------------------------------------------
  const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  function pad2(n) { return String(n).padStart(2, '0'); }

  function nowStamp() {
    const d = new Date();
    return `${pad2(d.getDate())} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()} • ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())} WIB`;
  }

  function todayLabel() {
    const d = new Date();
    return `${pad2(d.getDate())} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
  }

  function pseudoHash(seed) {
    // Hash deterministik ringan (FNV-1a) untuk jejak audit buku besar
    let h = 0x811c9dc5;
    const s = String(seed) + Date.now() + Math.random();
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    const hex = h.toString(16).padStart(8, '0');
    return `${hex.slice(0, 4)}...${hex.slice(4, 8)}`;
  }

  function newLedgerId() {
    return `LEDG-${Math.floor(10000 + Math.random() * 90000)}`;
  }

  function normalizeSku(sku) {
    return String(sku || '').toUpperCase().replace(/SKU-|ARB-|-/g, '');
  }

  function findProduct(sku, name) {
    const nSku = normalizeSku(sku);
    return state.products.find(p => p.sku === sku || normalizeSku(p.sku) === nSku) ||
      (name ? state.products.find(p =>
        p.name.toLowerCase().includes(String(name).toLowerCase()) ||
        String(name).toLowerCase().includes(p.name.toLowerCase())
      ) : undefined);
  }

  function computeProductStatus(prod) {
    if (prod.stock <= prod.rop) return 'below-rop';
    if (prod.fefoStatus && prod.fefoStatus.indexOf('Kritis') === 0) return 'critical-expiry';
    return 'optimal';
  }

  function isCreditTerm(terms) {
    return !/COD|Tunai/i.test(String(terms || ''));
  }

  function findOutlet(idOrCode) {
    return state.outlets.find(o => o.id === idOrCode || o.code === idOrCode);
  }

  /** Cek ketersediaan stok semua item pesanan. Mengembalikan daftar kekurangan. */
  function checkStockAvailability(items) {
    const shortages = [];
    (items || []).forEach(item => {
      const prod = findProduct(item.sku, item.name);
      if (!prod) return;
      if (prod.stock < item.quantity) {
        shortages.push({ sku: prod.sku, name: prod.name, requested: item.quantity, available: prod.stock, shortBy: item.quantity - prod.stock });
      }
    });
    return shortages;
  }

  /**
   * Potong stok fisik untuk seluruh item pesanan + catat baris KELUAR ke buku besar.
   * Mengembalikan daftar produk yang baru saja menembus batas ROP (low-stock alert).
   */
  function deductOrderStock(order) {
    const lowStockHits = [];
    const rows = [];
    order.items.forEach(item => {
      const prod = findProduct(item.sku, item.name);
      if (!prod) return;
      const prev = prod.stock;
      prod.stock = Math.max(0, prev - item.quantity);
      prod.status = computeProductStatus(prod);
      if (prev > prod.rop && prod.stock <= prod.rop) lowStockHits.push(prod.name);
      rows.push({
        id: newLedgerId(),
        timestamp: nowStamp(),
        docRef: order.clientUuid,
        skuName: prod.name,
        skuCode: prod.sku,
        batch: String(item.batch || prod.activeBatch).replace('Batch: ', ''),
        type: 'KELUAR',
        quantity: -item.quantity,
        finalStock: prod.stock,
        operator: order.salesRep,
        operatorRole: `Field Sales ${order.salesRepId || ''}`.trim(),
        hash: pseudoHash(order.clientUuid + prod.sku)
      });
    });
    state.ledger = [...rows, ...state.ledger];
    order.stockDeducted = true;
    order.syncStatus = 'SYNCED_DEDUCTED';
    order.stockWarning = undefined;
    return lowStockHits;
  }

  /** Kembalikan stok (RETUR) bila pesanan yang sudah memotong stok dibatalkan. */
  function restoreOrderStock(order, reason) {
    const rows = [];
    order.items.forEach(item => {
      const prod = findProduct(item.sku, item.name);
      if (!prod) return;
      prod.stock += item.quantity;
      prod.status = computeProductStatus(prod);
      rows.push({
        id: newLedgerId(),
        timestamp: nowStamp(),
        docRef: order.clientUuid,
        skuName: prod.name,
        skuCode: prod.sku,
        batch: String(item.batch || prod.activeBatch).replace('Batch: ', ''),
        type: 'RETUR',
        quantity: item.quantity,
        finalStock: prod.stock,
        operator: 'Admin Penjualan',
        operatorRole: `Pembatalan: ${reason || 'Order ditolak'}`,
        hash: pseudoHash(order.clientUuid + prod.sku + 'R')
      });
    });
    state.ledger = [...rows, ...state.ledger];
    order.stockDeducted = false;
  }

  function applyOutletCredit(order, sign) {
    const outlet = findOutlet(order.outletId);
    if (!outlet || !isCreditTerm(order.terms)) return;
    outlet.creditUsed = Math.max(0, (outlet.creditUsed || 0) + sign * order.totalAmount);
    outlet.creditRemaining = Math.max(0, outlet.creditLimit - outlet.creditUsed);
    const ratio = outlet.creditLimit ? outlet.creditUsed / outlet.creditLimit : 0;
    if (outlet.creditStatus !== 'Overdue') {
      outlet.creditStatus = ratio >= 0.9 ? 'Perhatian' : 'Lancar';
    }
    order.creditApplied = sign > 0;
  }

  function lowStockMessage(hits) {
    return hits.length ? ` ⚠ Low-stock: ${hits.join(', ')} di bawah ROP!` : '';
  }

  function getAllowedPathsForUser(user) {
    if (!user) return ['login'];
    if (user.role === 'super-admin') {
      return [
        'executive-dashboard',
        'inventory-stock-ledger',
        'b2b-crm-directory',
        'order-approval-queue',
        'field-sales-pwa-preview',
        'user-management',
        'user-profile-settings'
      ];
    }
    if (Array.isArray(user.permissions) && user.permissions.length > 0) {
      const perms = user.permissions.slice();
      if (perms.indexOf('user-profile-settings') === -1) perms.push('user-profile-settings');
      return perms;
    }
    const roleAllowedMap = {
      'executive': ['executive-dashboard', 'inventory-stock-ledger', 'b2b-crm-directory', 'order-approval-queue', 'user-profile-settings'],
      'inventory': ['inventory-stock-ledger', 'order-approval-queue', 'user-profile-settings'],
      'sales-ops': ['order-approval-queue', 'b2b-crm-directory', 'user-profile-settings'],
      'field-sales': ['field-sales-pwa-preview', 'b2b-crm-directory', 'user-profile-settings']
    };
    return roleAllowedMap[user.role] || ['user-profile-settings'];
  }

  function setPath(path) {
    if (!state.currentUser) {
      state.currentPath = 'login';
      if (typeof window !== 'undefined' && window.location) {
        window.location.hash = 'login';
      }
      notify();
      return;
    }

    const allowed = getAllowedPathsForUser(state.currentUser);
    if (allowed.indexOf(path) === -1) {
      showToast(`Akses Ditolak: Halaman tersebut tidak diizinkan untuk role ${state.currentUser.title}`, 'lock');
      path = state.currentUser.defaultPath || allowed[0] || 'user-profile-settings';
    }

    state.currentPath = path;
    if (typeof window !== 'undefined' && window.location) {
      if (window.location.hash.replace(/^#\/?/, '') !== path) {
        window.location.hash = path;
      }
    }
    notify();
    if (typeof window !== 'undefined' && window.scrollTo) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function setRole(role) {
    // Hanya Super Admin yang diizinkan berpindah perspektif role secara bebas
    if (state.currentUser && state.currentUser.role !== 'super-admin') {
      showToast('Hanya Super Admin yang dapat mengganti perspektif role secara bebas.', 'lock');
      return;
    }
    state.currentRole = role;
    if (role === 'super-admin') {
      state.currentPath = 'user-management';
      showToast('Perspektif Super Admin: Akses Penuh Seluruh Sistem & Manajemen User', 'admin_panel_settings');
    } else if (role === 'field-sales') {
      state.currentPath = 'field-sales-pwa-preview';
      showToast(`Simulasi Perspektif Field Sales: ${state.currentSalesRep} (Mobile PWA)`, 'smartphone');
    } else if (role === 'inventory') {
      state.currentPath = 'inventory-stock-ledger';
      showToast('Simulasi Perspektif Admin Gudang & Stock Ledger', 'warehouse');
    } else if (role === 'sales-ops') {
      state.currentPath = 'order-approval-queue';
      showToast('Simulasi Perspektif Admin Penjualan & Verifikasi', 'fact_check');
    } else {
      state.currentPath = 'executive-dashboard';
      showToast('Simulasi Perspektif Direktur & Manajemen', 'dashboard');
    }
    if (typeof window !== 'undefined' && window.location) {
      window.location.hash = state.currentPath;
    }
    notify();
  }

  function loginUser(userObj, options) {
    options = options || {};
    if (!userObj) return null;
    // Ambil objek terbaru dari state.users agar perubahan profil/password selalu mutakhir
    const latestUser = (state.users || []).find(u => u.id === userObj.id) || userObj;
    if (latestUser.active === false) {
      showToast('Akun ini sedang dinonaktifkan oleh Super Admin.', 'block');
      return null;
    }
    state.currentUser = JSON.parse(JSON.stringify(latestUser));
    state.currentRole = latestUser.role || 'executive';
    if (latestUser.salesRepName) {
      state.currentSalesRep = latestUser.salesRepName;
    }
    const allowed = getAllowedPathsForUser(state.currentUser);
    if (!options.preservePath || allowed.indexOf(state.currentPath) === -1) {
      state.currentPath = latestUser.defaultPath || allowed[0] || 'executive-dashboard';
    }
    if (typeof window !== 'undefined' && window.location) {
      window.location.hash = state.currentPath;
    }
    if (!options.silent) {
      showToast(`Selamat datang, ${latestUser.name} (${latestUser.title})!`, 'verified_user');
    }
    notify();
    return state.currentUser;
  }

  function logoutUser() {
    const prevName = state.currentUser ? state.currentUser.name : 'Pengguna';
    state.currentUser = null;
    state.currentPath = 'login';
    if (typeof window !== 'undefined' && window.location) {
      window.location.hash = 'login';
    }
    showToast(`Sesi ${prevName} telah berakhir. Silakan login kembali.`, 'logout');
    notify();
  }

  function updateUserProfile(userId, updates) {
    const idx = (state.users || []).findIndex(u => u.id === userId);
    if (idx === -1) return { ok: false, message: 'Pengguna tidak ditemukan.' };

    const target = state.users[idx];
    const oldSalesName = target.salesRepName || target.name;

    if (updates.name !== undefined) target.name = String(updates.name).trim();
    if (updates.username !== undefined) target.username = String(updates.username).trim();
    if (updates.email !== undefined) target.email = String(updates.email).trim();
    if (updates.phone !== undefined) target.phone = String(updates.phone).trim();
    if (updates.title !== undefined) target.title = String(updates.title).trim();
    if (updates.division !== undefined) target.division = String(updates.division).trim();
    if (updates.avatarInitials !== undefined) target.avatarInitials = String(updates.avatarInitials).trim().toUpperCase().slice(0, 2);
    if (updates.badgeColor !== undefined) target.badgeColor = updates.badgeColor;
    if (updates.active !== undefined) target.active = Boolean(updates.active);
    if (updates.role !== undefined) {
      target.role = updates.role;
      const sqlMap = {
        'super-admin': 'super_admin',
        'executive': 'direktur',
        'inventory': 'admin_gudang',
        'sales-ops': 'admin_penjualan',
        'field-sales': 'sales'
      };
      target.sqlRole = sqlMap[updates.role] || 'sales';
    }
    if (Array.isArray(updates.permissions)) {
      target.permissions = updates.permissions;
    }
    if (updates.defaultPath !== undefined) {
      target.defaultPath = updates.defaultPath;
    }
    if (updates.password !== undefined && String(updates.password).trim() !== '') {
      target.password = String(updates.password).trim();
    }
    if (updates.pin !== undefined && String(updates.pin).trim() !== '') {
      target.pin = String(updates.pin).trim();
    }

    // Jika user ini adalah Sales Lapangan dan namanya berubah, sinkronkan salesRepName & salesTeam
    if (target.role === 'field-sales' && updates.name) {
      target.salesRepName = target.name;
      const repTeam = (state.salesTeam || []).find(s => s.id === target.salesRepId || s.name === oldSalesName);
      if (repTeam) repTeam.name = target.name;
      if (state.currentSalesRep === oldSalesName) state.currentSalesRep = target.name;
    }

    // Jika yang diedit adalah user yang sedang login, perbarui state.currentUser
    if (state.currentUser && state.currentUser.id === userId) {
      state.currentUser = JSON.parse(JSON.stringify(target));
      state.currentRole = target.role;
    }

    showToast(`Detail profil ${target.name} berhasil diperbarui!`, 'manage_accounts');
    notify();
    syncMutationToServer('UPDATE_USER', { userId, user: target }, `Update Profil User: ${target.name}`);
    return { ok: true, user: target };
  }

  function changeUserPassword(userId, currentPassword, newPassword, newPin, isSuperAdminOverride) {
    const target = (state.users || []).find(u => u.id === userId);
    if (!target) return { ok: false, message: 'Akun pengguna tidak ditemukan.' };

    if (!isSuperAdminOverride) {
      const cur = String(currentPassword || '').trim();
      if (cur !== target.password && cur !== target.pin) {
        return { ok: false, message: 'Password saat ini tidak sesuai!' };
      }
    }

    const nextPw = String(newPassword || '').trim();
    if (!nextPw || nextPw.length < 3) {
      return { ok: false, message: 'Password baru minimal harus 3 karakter.' };
    }

    target.password = nextPw;
    if (newPin && String(newPin).trim().length >= 4) {
      target.pin = String(newPin).trim();
    }

    if (state.currentUser && state.currentUser.id === userId) {
      state.currentUser = JSON.parse(JSON.stringify(target));
    }

    showToast(`Password untuk akun ${target.name} berhasil diperbarui!`, 'lock_reset');
    notify();
    syncMutationToServer('CHANGE_USER_PASSWORD', { userId, newPassword: target.password, newPin: target.pin }, `Ganti Password: ${target.name}`);
    return { ok: true, user: target };
  }

  function createNewUser(userData) {
    const id = userData.id || `USR-${Math.floor(100 + Math.random() * 900)}`;
    const role = userData.role || 'field-sales';
    const sqlMap = {
      'super-admin': 'super_admin',
      'executive': 'direktur',
      'inventory': 'admin_gudang',
      'sales-ops': 'admin_penjualan',
      'field-sales': 'sales'
    };
    const defaultPathMap = {
      'super-admin': 'user-management',
      'executive': 'executive-dashboard',
      'inventory': 'inventory-stock-ledger',
      'sales-ops': 'order-approval-queue',
      'field-sales': 'field-sales-pwa-preview'
    };
    const defaultPermsMap = {
      'super-admin': ['executive-dashboard', 'inventory-stock-ledger', 'b2b-crm-directory', 'order-approval-queue', 'field-sales-pwa-preview', 'user-management', 'user-profile-settings'],
      'executive': ['executive-dashboard', 'inventory-stock-ledger', 'b2b-crm-directory', 'order-approval-queue', 'user-profile-settings'],
      'inventory': ['inventory-stock-ledger', 'order-approval-queue', 'user-profile-settings'],
      'sales-ops': ['order-approval-queue', 'b2b-crm-directory', 'user-profile-settings'],
      'field-sales': ['field-sales-pwa-preview', 'b2b-crm-directory', 'user-profile-settings']
    };

    const name = String(userData.name || 'User Baru').trim();
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'US';
    const newUser = {
      id,
      name,
      username: String(userData.username || name.toLowerCase().replace(/[^a-z0-9]/g, '')).trim(),
      email: String(userData.email || `${name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@arbain.co.id`).trim(),
      phone: String(userData.phone || '081200000000').trim(),
      password: String(userData.password || '123').trim(),
      pin: String(userData.pin || '123456').trim(),
      role,
      sqlRole: sqlMap[role] || 'sales',
      salesRepName: role === 'field-sales' ? name : undefined,
      salesRepId: role === 'field-sales' ? id : undefined,
      title: String(userData.title || (role === 'field-sales' ? 'Field Sales Representative' : 'Staf Operasional')).trim(),
      division: String(userData.division || 'CV Arba\'in Solo Raya').trim(),
      avatarInitials: initials,
      badgeColor: userData.badgeColor || '#005c55',
      active: true,
      defaultPath: userData.defaultPath || defaultPathMap[role] || 'user-profile-settings',
      permissions: Array.isArray(userData.permissions) && userData.permissions.length
        ? userData.permissions
        : defaultPermsMap[role]
    };

    state.users = [newUser, ...(state.users || [])];
    if (role === 'field-sales') {
      state.salesTeam.push({
        id,
        name,
        division: newUser.division,
        area: 'Solo Raya',
        dailyVisitTarget: 15,
        monthlyRevenueTarget: 50000000,
        monthlyRevenueBase: 0,
        monthlyVisitBase: 0
      });
    }

    showToast(`Akun baru ${newUser.name} (${newUser.username}) berhasil ditambahkan!`, 'person_add');
    notify();
    syncMutationToServer('CREATE_USER', { user: newUser }, `Tambah User Baru: ${newUser.name} (${newUser.role})`);
    return { ok: true, user: newUser };
  }

  function deleteUser(userId) {
    if (userId === 'USR-SUPER-01') {
      showToast('Akun Super Admin utama tidak dapat dihapus!', 'warning');
      return { ok: false, message: 'Akun Super Admin utama dilindungi.' };
    }
    if (state.currentUser && state.currentUser.id === userId) {
      showToast('Tidak dapat menghapus akun yang sedang digunakan login!', 'warning');
      return { ok: false, message: 'Tidak dapat menghapus akun yang sedang aktif.' };
    }
    const target = (state.users || []).find(u => u.id === userId);
    if (!target) return { ok: false, message: 'User tidak ditemukan.' };
    state.users = (state.users || []).filter(u => u.id !== userId);
    showToast(`Akun ${target.name} telah dihapus dari sistem.`, 'person_remove');
    notify();
    syncMutationToServer('DELETE_USER', { userId }, `Hapus User: ${target.name}`);
    return { ok: true };
  }

  function toggleSidebar() {
    state.isSidebarCollapsed = !state.isSidebarCollapsed;
    notify();
  }

  function toggleDarkMode() {
    state.isDarkMode = !state.isDarkMode;
    document.documentElement.classList.toggle('dark', state.isDarkMode);
    notify();
  }

  function syncMutationToServer(type, payload, summary) {
    if (window.ArbaOfflineSync && typeof window.ArbaOfflineSync.recordOrSyncMutation === 'function') {
      window.ArbaOfflineSync.recordOrSyncMutation(type, payload, summary);
    }
  }

  function addOfflineQueueEntry(mutation) {
    const id = mutation.mutationId || mutation.id;
    if (!id) return;
    const exists = state.offlineQueue.some(q => (q.mutationId || q.id) === id);
    if (!exists) {
      state.offlineQueue = [{
        id,
        mutationId: id,
        type: mutation.type,
        summary: mutation.summary || mutation.type,
        payload: mutation.payload,
        createdAt: mutation.createdAt || Date.now()
      }, ...state.offlineQueue];
      persist();
    }
  }

  function restoreOfflineQueue(idbMutations) {
    if (!Array.isArray(idbMutations) || !idbMutations.length) return;
    idbMutations.forEach(m => addOfflineQueueEntry(m));
    notify();
  }

  function applyServerState(centralState, options) {
    options = options || {};
    if (!centralState) return;
    if (Array.isArray(centralState.users) && centralState.users.length > 0) {
      state.users = centralState.users;
      if (state.currentUser) {
        const refreshed = state.users.find(u => u.id === state.currentUser.id);
        if (refreshed) state.currentUser = JSON.parse(JSON.stringify(refreshed));
      }
    }
    if (Array.isArray(centralState.products)) state.products = centralState.products;
    if (Array.isArray(centralState.ledger)) state.ledger = centralState.ledger;
    if (Array.isArray(centralState.outlets)) state.outlets = centralState.outlets;
    if (Array.isArray(centralState.orders)) state.orders = centralState.orders;
    if (Array.isArray(centralState.supplierPOs)) state.supplierPOs = centralState.supplierPOs;
    if (Array.isArray(centralState.salesVisits)) state.salesVisits = centralState.salesVisits;
    if (Array.isArray(centralState.driverManifests)) state.driverManifests = centralState.driverManifests;
    if (Array.isArray(centralState.salesTeam)) state.salesTeam = centralState.salesTeam;
    if (Array.isArray(centralState.salesLoadings)) state.salesLoadings = centralState.salesLoadings;
    if (Array.isArray(centralState.visitLogs)) state.visitLogs = centralState.visitLogs;

    if (options.clearQueue) {
      state.offlineQueue = [];
    }
    if (options.toastMessage) {
      showToast(options.toastMessage, 'cloud_done');
    }
    notify();
  }

  function setNetworkOnlineState(nextOnline, opts) {
    opts = opts || {};
    if (state.isOnline === nextOnline && !opts.force) return;
    state.isOnline = nextOnline;

    if (state.isOnline && state.offlineQueue.length > 0) {
      // Sinkronisasi antrean offline: potong stok otomatis untuk setiap pesanan lokal
      let lowHits = [];
      let waiting = 0;
      const queuedIds = state.offlineQueue.map(q => q.id || q.mutationId);
      state.orders.forEach(o => {
        if (queuedIds.indexOf(o.id) === -1 && o.syncStatus !== 'OFFLINE_QUEUED') return;
        if (o.syncStatus !== 'OFFLINE_QUEUED') return;
        const shortages = checkStockAvailability(o.items);
        if (shortages.length === 0) {
          lowHits = lowHits.concat(deductOrderStock(o));
        } else {
          o.syncStatus = 'PENDING_WAREHOUSE';
          o.stockWarning = 'Menunggu stok: ' + shortages.map(s => `${s.name} (kurang ${s.shortBy} unit)`).join(', ');
          waiting++;
        }
      });
      const count = state.offlineQueue.length;
      if (window.ArbaOfflineSync && typeof window.ArbaOfflineSync.flushOfflineQueue === 'function') {
        window.ArbaOfflineSync.flushOfflineQueue();
        window.ArbaOfflineSync.connectRealtimeSSE();
      }
      state.offlineQueue = [];
      showToast(
        `Online kembali: ${count} transaksi lokal dikirim ke Server Pusat & stok dipotong otomatis` +
        (waiting ? ` (${waiting} menunggu stok)` : '') + '.' + lowStockMessage(lowHits),
        'cloud_done'
      );
    } else {
      if (state.isOnline && window.ArbaOfflineSync) {
        window.ArbaOfflineSync.flushOfflineQueue();
        window.ArbaOfflineSync.connectRealtimeSSE();
      }
      showToast(
        state.isOnline
          ? (opts.fromBrowserEvent ? 'Sinyal internet terhubung kembali — sinkronisasi pusat aktif' : 'Status: Online - Terhubung ke Database Pusat secara real-time')
          : (opts.fromBrowserEvent ? 'Koneksi terputus — otomatis beralih ke penyimpanan lokal (IndexedDB)' : 'Status: Offline - Transaksi disimpan di IndexedDB & LocalStorage lokal'),
        state.isOnline ? 'cloud_done' : 'cloud_off'
      );
    }
    notify();
  }

  function toggleOnlineStatus() {
    setNetworkOnlineState(!state.isOnline, { force: true });
  }

  async function syncNow() {
    if (!state.isOnline) {
      setNetworkOnlineState(true, { force: true });
      return;
    }
    if (window.ArbaOfflineSync && typeof window.ArbaOfflineSync.flushOfflineQueue === 'function') {
      await window.ArbaOfflineSync.flushOfflineQueue({ showToastIfEmpty: true });
    }
  }

  function setSelectedOutletId(id) {
    state.selectedOutletId = id;
    notify();
  }

  function addInboundBatch({ sku, batch, qty, expiryDate, docRef }) {
    const prod = state.products.find(p => p.sku === sku);
    const prodName = prod ? prod.name : 'Produk Herbal';
    const newStock = prod ? prod.stock + qty : qty;

    if (prod) {
      prod.stock = newStock;
      prod.activeBatch = batch;
      prod.fefoDate = expiryDate;
      prod.status = newStock >= prod.rop ? 'optimal' : 'below-rop';
    }

    // Jika docRef merujuk ke PO Supplier yang sedang aktif, tandai status PO sebagai DITERIMA
    if (docRef && Array.isArray(state.supplierPOs)) {
      const targetPO = state.supplierPOs.find(po => po.id === docRef);
      if (targetPO) {
        targetPO.status = 'DITERIMA';
      }
    }

    const operatorName = (state.currentUser && state.currentUser.name) || 'Slamet Riadi';
    const operatorTitle = (state.currentUser && state.currentUser.title) || 'Warehouse Inbound';

    const newEntry = {
      id: `LEDG-${Math.floor(10000 + Math.random() * 90000)}`,
      timestamp: nowStamp(),
      docRef: docRef || `PO-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      skuName: prodName,
      skuCode: sku,
      batch: batch,
      type: 'MASUK',
      quantity: qty,
      finalStock: newStock,
      operator: operatorName,
      operatorRole: operatorTitle,
      hash: `${Math.random().toString(36).substring(2, 6)}...${Math.random().toString(36).substring(2, 6)}`
    };

    state.ledger = [newEntry, ...state.ledger];
    showToast(`Penerimaan +${qty} unit (${batch}) berhasil dicatat ke Ledger!`, 'check_circle');
    notify();
    syncMutationToServer('ADD_INBOUND_BATCH', { sku, batch, qty, expiryDate, docRef, ledgerEntry: newEntry }, `Inbound +${qty} unit ${prodName} (${batch})`);
  }

  function approveOrder(orderId, silent) {
    const order = state.orders.find(o => o.id === orderId || o.clientUuid === orderId);
    if (!order) return;

    // Pesanan dari PWA (online) sudah memotong stok saat dibuat — jangan potong dua kali.
    let lowHits = [];
    if (!order.stockDeducted) {
      lowHits = deductOrderStock(order);
    }

    order.status = 'APPROVED';
    order.syncStatus = 'SYNCED_DEDUCTED';

    if (!silent) {
      showToast(`Pesanan ${order.outletName} disetujui & dialokasikan ke armada.${lowStockMessage(lowHits)}`, 'task_alt');
      notify();
      syncMutationToServer('APPROVE_ORDER', { orderId: order.id, clientUuid: order.clientUuid }, `Otorisasi Pesanan ${order.outletName}`);
    }
    return lowHits;
  }

  function batchApproveOrders(orderIds) {
    let lowHits = [];
    orderIds.forEach(id => { lowHits = lowHits.concat(approveOrder(id, true) || []); });
    showToast(`${orderIds.length} pesanan berhasil disetujui & dialokasikan ke armada!${lowStockMessage(lowHits)}`, 'done_all');
    notify();
    syncMutationToServer('BATCH_APPROVE_ORDERS', { orderIds }, `Otorisasi Massal ${orderIds.length} Pesanan`);
  }

  function rejectOrder(orderId, reason) {
    const order = state.orders.find(o => o.id === orderId || o.clientUuid === orderId);
    if (order) {
      if (order.stockDeducted) restoreOrderStock(order, reason);
      if (order.creditApplied) applyOutletCredit(order, -1);
      order.status = 'REJECTED';
      showToast(`Pesanan #${orderId} ditolak: ${reason || 'Pembatalan manual'}${order.stockDeducted === false ? ' — stok dikembalikan' : ''}`, 'block');
      notify();
      syncMutationToServer('REJECT_ORDER', { orderId: order.id, reason }, `Tolak Pesanan ${order.outletName}`);
    }
  }

  function substituteOrderBatch({ orderId, sku, newBatch, sourceWarehouse }) {
    const order = state.orders.find(o => o.id === orderId);
    if (!order) return;

    order.items = order.items.map(it => {
      if (it.sku === sku || it.name.includes(sku) || sku.includes(it.sku)) {
        return {
          ...it,
          batch: `Batch: ${newBatch} (${sourceWarehouse})`,
          allocated: true
        };
      }
      return it;
    });
    order.stockWarning = undefined;

    showToast(`Batch dialihkan ke ${newBatch} (${sourceWarehouse}). Pesanan siap disetujui!`, 'swap_horiz');
    notify();
    syncMutationToServer('SUBSTITUTE_BATCH', { orderId, sku, newBatch, sourceWarehouse }, `Substitusi Batch ${newBatch}`);
  }

  function adjustOrderQuantity({ orderId, sku, newQty }) {
    const order = state.orders.find(o => o.id === orderId);
    if (!order) return;

    order.items = order.items.map(it => {
      if (it.sku === sku || it.name.includes(sku)) {
        return {
          ...it,
          quantity: newQty,
          subtotal: newQty * it.unitPrice
        };
      }
      return it;
    });
    order.totalAmount = order.items.reduce((acc, it) => acc + it.subtotal, 0);

    showToast(`Kuantitas SKU disesuaikan menjadi ${newQty} unit!`, 'tune');
    notify();
    syncMutationToServer('ADJUST_ORDER_QTY', { orderId, sku, newQty }, `Ubah Qty Order #${orderId}`);
  }

  function adjustStock({ sku, batch, quantityDelta, reason, auditorName }) {
    const prod = state.products.find(p => p.sku === sku);
    const prodName = prod ? prod.name : 'Produk Herbal';
    const newStock = Math.max(0, (prod ? prod.stock : 0) + quantityDelta);

    if (prod) {
      prod.stock = newStock;
      prod.status = newStock <= prod.safetyStock ? 'below-rop' : (newStock <= prod.rop ? 'below-rop' : 'optimal');
    }

    const newEntry = {
      id: `LEDG-${Math.floor(10000 + Math.random() * 90000)}`,
      timestamp: nowStamp(),
      docRef: `ADJ-${Math.floor(100 + Math.random() * 900)}`,
      skuName: prodName,
      skuCode: sku,
      batch: batch,
      type: 'PENYESUAIAN',
      quantity: quantityDelta,
      finalStock: newStock,
      operator: auditorName || 'Dewi Lestari',
      operatorRole: 'Chief Auditor Intern',
      hash: `${Math.random().toString(36).substring(2, 6)}...${Math.random().toString(36).substring(2, 6)}`
    };

    state.ledger = [newEntry, ...state.ledger];
    showToast(`Penyesuaian stok (${quantityDelta > 0 ? '+' : ''}${quantityDelta} unit) dicatat ke Ledger: ${reason}`, 'tune');
    notify();
    syncMutationToServer('ADJUST_STOCK', { sku, batch, quantityDelta, reason, auditorName, ledgerEntry: newEntry }, `Penyesuaian Stok ${prodName} (${quantityDelta})`);
  }

  function createSupplierPO({ sku, productName, vendorName, quantity, unitPrice, leadTimeDays }) {
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + leadTimeDays);

    const newPO = {
      id: `PO-SUPP-2026-${Math.floor(100 + Math.random() * 900)}`,
      sku,
      productName,
      vendorName,
      quantity,
      unitPrice,
      totalCost: quantity * unitPrice,
      leadTimeDays,
      expectedDate: expDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
      status: 'TERKIRIM',
      createdAt: 'Baru saja'
    };

    state.supplierPOs = [newPO, ...state.supplierPOs];
    showToast(`PO Supplier ${newPO.id} berhasil diterbitkan ke ${vendorName}!`, 'local_mall');
    notify();
    syncMutationToServer('CREATE_SUPPLIER_PO', { po: newPO }, `PO Supplier ${newPO.id} (${productName})`);
  }

  function scheduleSalesVisit(params) {
    const newVisit = {
      id: `VISIT-${Math.floor(100 + Math.random() * 900)}`,
      ...params,
      status: 'TERJADWAL'
    };

    state.salesVisits = [newVisit, ...state.salesVisits];

    const targetOutlet = state.outlets.find(o => o.id === params.outletId || o.code === params.outletId);
    if (targetOutlet) {
      targetOutlet.lastVisitDate = params.scheduledDate;
      targetOutlet.visitNotes = `"${params.purpose}: ${params.notes}"`;
    }

    showToast(`Kunjungan ke ${params.outletName} dijadwalkan pada ${params.scheduledDate}`, 'event_available');
    notify();
    syncMutationToServer('SCHEDULE_VISIT', { visit: newVisit }, `Jadwal Kunjungan ${params.outletName}`);
  }

  function markOrderDelivered(orderId, driverName) {
    state.driverManifests.forEach(manifest => {
      const ord = manifest.orders.find(o => o.orderId === orderId);
      if (ord) {
        ord.delivered = true;
        ord.deliveredTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
      }
    });

    const targetOrder = state.orders.find(o => o.id === orderId || o.clientUuid === orderId);
    if (targetOrder) {
      targetOrder.status = 'DISPATCHED';
    }

    showToast(`Bukti Serah Terima (POD) berhasil dicatat oleh Driver ${driverName}!`, 'verified');
    notify();
    syncMutationToServer('MARK_DELIVERED', { orderId, driverName }, `POD Pengiriman #${orderId} (${driverName})`);
  }

  function addOutlet(newOutlet) {
    const id = `AP-SLO-${168 + state.outlets.length + 1}`;
    const limit = Number(newOutlet.creditLimit) || 10000000;

    const fullOutlet = {
      id,
      code: id,
      name: newOutlet.name || 'Apotek Mitra Baru',
      address: newOutlet.address || 'Solo Raya',
      city: newOutlet.city || 'Solo',
      cityName: newOutlet.cityName || (newOutlet.city === 'Solo' ? 'Surakarta' : newOutlet.city),
      type: newOutlet.type || 'Apotek Mandiri',
      picName: newOutlet.picName || 'Apoteker Penanggung Jawab',
      picRole: 'Apoteker Pengelola Apotek (APA)',
      picPhone: newOutlet.picPhone || '62812000000',
      salesRep: newOutlet.salesRep || 'Budi Santoso',
      salesArea: 'Solo Tengah',
      terms: newOutlet.terms || 'Net 30 Hari',
      creditLimit: limit,
      creditUsed: 0,
      creditRemaining: limit,
      creditStatus: 'Lancar',
      lastOrderDate: 'Hari Ini (Baru)',
      orderFrequency: 'Akun Baru',
      ytdTotal: 0,
      lastVisitDate: 'Hari Ini',
      visitNotes: `"Outlet baru berhasil didaftarkan ke sistem ERP CV Arba'in. Alokasi rute pengiriman telah terdaftar."`
    };

    state.outlets = [fullOutlet, ...state.outlets];
    state.selectedOutletId = id;
    showToast(`Outlet ${fullOutlet.name} (${id}) berhasil didaftarkan!`, 'add_business');
    notify();
    syncMutationToServer('ADD_OUTLET', { outlet: fullOutlet }, `Registrasi Outlet ${fullOutlet.name}`);
  }

  function submitFieldSalesOrder(newOrder) {
    const id = `ord-${Math.random().toString(36).substring(2, 7)}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
    const outlet = findOutlet(newOrder.outletId);
    const rep = state.salesTeam.find(s => s.name === newOrder.salesRep);
    const items = newOrder.items || [];
    const totalAmount = newOrder.totalAmount || items.reduce((s, it) => s + it.subtotal, 0);

    const orderObj = {
      id,
      clientUuid: id,
      outletId: newOrder.outletId || 'AP-SLO-001',
      outletName: newOrder.outletName || 'Apotek Mitra',
      address: newOrder.address || 'Surakarta',
      city: newOrder.city || 'Surakarta',
      salesRep: newOrder.salesRep || state.currentSalesRep || 'Budi Santoso',
      salesRepId: newOrder.salesRepId || (rep ? rep.id : 'REP-SR-04'),
      orderTime: 'Baru saja (<1m lalu)',
      orderTimestamp: Date.now(),
      totalAmount,
      terms: newOrder.terms || 'Net 30 Hari',
      limitMax: outlet ? outlet.creditLimit : 15000000,
      limitRemaining: outlet ? Math.max(0, outlet.creditRemaining - (isCreditTerm(newOrder.terms) ? totalAmount : 0)) : 0,
      geofenceValid: newOrder.geofenceValid !== undefined ? newOrder.geofenceValid : true,
      geofenceCoords: newOrder.geofenceCoords || '-7.5583, 110.8214 (Presisi GPS)',
      gpsDistance: newOrder.gpsDistance,
      notes: newOrder.notes || '',
      npwp: '01.324.891.4-528.000',
      status: 'PENDING',
      syncStatus: state.isOnline ? 'SYNCED_DEDUCTED' : 'OFFLINE_QUEUED',
      priority: totalAmount >= 10000000 ? 'High' : 'Normal',
      stockDeducted: false,
      items
    };

    // 1) Sinkronisasi stok otomatis: potong stok saat pesanan dibuat (online)
    let lowHits = [];
    let shortages = [];
    if (state.isOnline) {
      shortages = checkStockAvailability(items);
      if (shortages.length === 0) {
        lowHits = deductOrderStock(orderObj);
      } else {
        orderObj.syncStatus = 'PENDING_WAREHOUSE';
        orderObj.priority = 'High';
        orderObj.stockWarning = 'Menunggu stok: ' + shortages.map(s => `${s.name} (kurang ${s.shortBy} unit)`).join(', ');
      }
    } else {
      state.offlineQueue = [{
        id: orderObj.id,
        mutationId: orderObj.clientUuid,
        type: 'SUBMIT_ORDER',
        summary: `Order ${orderObj.outletName} (${items.length} SKU • ${window.ArbaUtils ? window.ArbaUtils.formatRupiah(totalAmount) : totalAmount})`,
        payload: { order: orderObj },
        createdAt: Date.now()
      }, ...state.offlineQueue];
    }

    // 2) Kredit outlet, stok titipan konsinyasi di apotek & barang bawaan sales
    applyOutletCredit(orderObj, 1);
    if (outlet) {
      outlet.lastOrderDate = todayLabel();
      outlet.ytdTotal = (outlet.ytdTotal || 0) + totalAmount;
      if (!Array.isArray(outlet.consignmentItems)) outlet.consignmentItems = [];
      items.forEach(it => {
        const prod = findProduct(it.sku, it.name);
        const fullSku = prod ? prod.sku : it.sku;
        const existingC = outlet.consignmentItems.find(c => c.sku === fullSku);
        if (existingC) {
          existingC.soldQty = (existingC.soldQty || 0) + (it.soldAtOutlet || it.quantity);
          existingC.remainingQty = Math.max(0, (existingC.remainingQty || 0) + it.quantity - (it.soldAtOutlet || it.quantity));
          existingC.consignedQty = existingC.soldQty + existingC.remainingQty;
          existingC.velocity = 'LARIS';
          existingC.daysInOutlet = 1;
        } else if (prod) {
          outlet.consignmentItems.push({
            sku: prod.sku,
            name: prod.name,
            batch: prod.activeBatch,
            expiry: prod.fefoDate,
            consignedQty: it.quantity,
            soldQty: it.quantity,
            remainingQty: it.quantity,
            unitPrice: prod.unitPrice,
            velocity: 'LARIS',
            daysInOutlet: 1,
            nearExpiry: /Kritis|Mendekati/.test(prod.fefoStatus || '')
          });
        }
      });
      outlet.consignmentTotalUnits = outlet.consignmentItems.reduce((s, c) => s + (c.remainingQty || 0), 0);
      outlet.consignmentBillableAmount = outlet.consignmentItems.reduce((s, c) => s + (c.soldQty || 0) * c.unitPrice, 0);
    }

    // Kurangi stok bawaan di mobil/tas sales (Canvas Loading Control)
    const activeLoad = (state.salesLoadings || []).find(l => l.salesRep === orderObj.salesRep);
    if (activeLoad) {
      activeLoad.cashCollected = (activeLoad.cashCollected || 0) + totalAmount;
      items.forEach(it => {
        const prod = findProduct(it.sku, it.name);
        const fullSku = prod ? prod.sku : it.sku;
        const loadItem = activeLoad.items.find(li => li.sku === fullSku);
        if (loadItem) {
          loadItem.droppedQty = (loadItem.droppedQty || 0) + it.quantity;
          loadItem.returnedQty = Math.max(0, loadItem.loadedQty - loadItem.droppedQty - (loadItem.discrepancy || 0));
        }
      });
    }

    state.orders = [orderObj, ...state.orders];

    // 3) Catat aktivitas kunjungan (hasil: ORDER) untuk KPI produktivitas sales
    const visitLog = recordVisit({
      salesRep: orderObj.salesRep,
      outletId: orderObj.outletId,
      outletName: orderObj.outletName,
      outcome: 'ORDER',
      gpsDistance: newOrder.gpsDistance,
      notes: `Order ${items.length} SKU • ${window.ArbaUtils ? window.ArbaUtils.formatRupiah(totalAmount) : totalAmount}`,
      orderId: orderObj.id
    });

    let msg;
    if (!state.isOnline) {
      msg = 'Pesanan disimpan di offline storage lokal (stok dipotong otomatis saat online kembali)';
    } else if (shortages.length) {
      msg = `Pesanan ${orderObj.outletName} masuk antrean "Menunggu Stok" — ${shortages.length} SKU kurang`;
    } else {
      msg = `Pesanan ${orderObj.outletName} tersinkron & stok gudang terpotong otomatis.${lowStockMessage(lowHits)}`;
    }
    showToast(msg, !state.isOnline ? 'save' : (shortages.length || lowHits.length ? 'warning' : 'cloud_done'));
    notify();

    syncMutationToServer(
      'SUBMIT_ORDER',
      { id: orderObj.id, clientUuid: orderObj.clientUuid, order: orderObj, visitLog },
      `Order ${orderObj.outletName} (${items.length} SKU • ${window.ArbaUtils ? window.ArbaUtils.formatRupiah(totalAmount) : totalAmount}) oleh ${orderObj.salesRep}`
    );

    return { order: orderObj, shortages, lowStock: lowHits };
  }

  // ---------------------------------------------------------------------------
  // Aktivitas Kunjungan Lapangan (Canvassing / Visit-only)
  // ---------------------------------------------------------------------------
  const VISIT_OUTCOME_LABELS = {
    ORDER: 'Order Berhasil',
    NO_ORDER_STOCK_FULL: 'Stok Outlet Masih Penuh',
    COLLECTION: 'Penagihan Faktur',
    FOLLOW_UP: 'Follow-up Berikutnya',
    PIC_ABSENT: 'PIC/Apoteker Tidak di Tempat',
    DISPLAY_CHECK: 'Cek Display & Merchandising'
  };

  function recordVisit({ salesRep, outletId, outletName, outcome, gpsDistance, notes, orderId }) {
    const log = {
      id: `VLOG-${Date.now().toString(36).toUpperCase()}`,
      salesRep: salesRep || state.currentSalesRep,
      outletId,
      outletName,
      timestamp: Date.now(),
      outcome: outcome || 'FOLLOW_UP',
      gpsDistance: gpsDistance !== undefined ? gpsDistance : null,
      notes: notes || '',
      orderId: orderId || null
    };
    state.visitLogs = [log, ...state.visitLogs];

    const outlet = findOutlet(outletId);
    if (outlet) {
      const t = new Date();
      outlet.lastVisitDate = `${todayLabel()}, ${pad2(t.getHours())}:${pad2(t.getMinutes())} WIB`;
      outlet.visitNotes = `"${VISIT_OUTCOME_LABELS[log.outcome] || log.outcome} oleh ${log.salesRep}${notes ? ': ' + notes : ''}"`;
    }

    // Tandai jadwal kunjungan terkait sebagai selesai
    state.salesVisits.forEach(v => {
      if ((v.outletId === outletId) && v.status === 'TERJADWAL') v.status = 'SELESAI';
    });
    return log;
  }

  function logFieldVisit(params) {
    const log = recordVisit(params);
    showToast(`Kunjungan ${log.outletName} tercatat: ${VISIT_OUTCOME_LABELS[log.outcome]}`, 'where_to_vote');
    notify();
    syncMutationToServer('LOG_VISIT', { id: log.id, visitLog: log }, `Kunjungan ${log.outletName}: ${VISIT_OUTCOME_LABELS[log.outcome]} (${log.salesRep})`);
    return log;
  }

  function setCurrentSalesRep(name) {
    state.currentSalesRep = name;
    if (state.currentRole === 'field-sales') {
      const allUsers = state.users || (window.ArbaData && window.ArbaData.users) || [];
      const repUser = allUsers.find(u => u.salesRepName === name);
      if (repUser) {
        state.currentUser = repUser;
      }
    }
    notify();
  }

  // ---------------------------------------------------------------------------
  // Kontrol Barang Bawaan Sales dari Gudang (Ambil Pagi vs Kembali Sore — Anti-Fraud)
  // Sesuai wawancara CV Arba'in:
  // "Seandainya sales kita nakal, bawa dari gudang itu 15, yang 3 dijual kantong
  //  sendiri, yang 12 masuk kantor, kita enggak tahu... Mulai nyatatnya saat sales
  //  ngambil dari warehouse, dan saat kembali dicatat pengembaliannya."
  // ---------------------------------------------------------------------------
  function recordSalesWarehouseLoad({ salesRep, sku, loadedQty }) {
    const prod = findProduct(sku);
    const rep = state.salesTeam.find(s => s.name === salesRep) || state.salesTeam[0];
    const qty = Number(loadedQty) || 0;
    if (!prod || qty <= 0) return;

    let loadRec = state.salesLoadings.find(l => l.salesRep === rep.name);
    if (!loadRec) {
      loadRec = {
        id: `LOAD-2026-${Math.floor(100 + Math.random() * 900)}`,
        date: `Hari ini • ${pad2(new Date().getHours())}:${pad2(new Date().getMinutes())} WIB`,
        salesRep: rep.name,
        salesRepId: rep.id,
        division: rep.division || 'Madu & Herbal',
        routeArea: `${rep.area} (Target ${rep.dailyVisitTarget} Outlet)`,
        status: 'SEDANG_KELILING',
        cashCollected: 0,
        items: []
      };
      state.salesLoadings = [loadRec, ...state.salesLoadings];
    }

    const existingItem = loadRec.items.find(i => i.sku === prod.sku);
    if (existingItem) {
      existingItem.loadedQty += qty;
      existingItem.returnedQty += qty;
    } else {
      loadRec.items.push({
        sku: prod.sku,
        name: prod.name,
        batch: prod.activeBatch,
        loadedQty: qty,
        droppedQty: 0,
        returnedQty: qty,
        discrepancy: 0,
        unitPrice: prod.unitPrice
      });
    }

    showToast(`Tercatat: ${rep.name} membawa ${qty} unit ${prod.name} dari gudang.`, 'local_shipping');
    notify();
    syncMutationToServer('RECORD_WAREHOUSE_LOAD', { salesRep: rep.name, sku: prod.sku, loadedQty: qty }, `Loading Gudang ${rep.name}: +${qty} ${prod.name}`);
  }

  function reconcileSalesLoading(loadId, actualReturnedMap) {
    const loadRec = state.salesLoadings.find(l => l.id === loadId);
    if (!loadRec) return;

    let totalDiscrepancy = 0;
    loadRec.items.forEach(it => {
      const expectedReturn = Math.max(0, it.loadedQty - it.droppedQty);
      const actualReturn = actualReturnedMap && actualReturnedMap[it.sku] !== undefined
        ? Number(actualReturnedMap[it.sku])
        : expectedReturn;
      it.returnedQty = actualReturn;
      it.discrepancy = Math.max(0, expectedReturn - actualReturn);
      totalDiscrepancy += it.discrepancy;
    });

    if (totalDiscrepancy === 0) {
      loadRec.status = 'TERVERIFIKASI_KLOP';
      loadRec.auditNote = undefined;
      showToast(`Rekonsiliasi ${loadRec.salesRep} KLOP 100%! Tidak ada selisih barang bawaan.`, 'verified');
    } else {
      loadRec.status = 'SELISIH_AUDIT';
      loadRec.auditNote = `Terdeteksi selisih ${totalDiscrepancy} unit belum kembali ke gudang (wajib ditagihkan ke sales)!`;
      showToast(`PERINGATAN AUDIT: Selisih ${totalDiscrepancy} unit pada bawaan ${loadRec.salesRep}!`, 'warning');
    }
    notify();
    syncMutationToServer('RECONCILE_LOADING', { loadId, actualReturnedMap }, `Rekonsiliasi Bawaan ${loadRec.salesRep}`);
  }

  // ---------------------------------------------------------------------------
  // Migrasi / Impor Data Awal (CSV) — Outlet B2B & Master Produk
  // ---------------------------------------------------------------------------
  function toNumber(v) {
    if (v === undefined || v === null || v === '') return NaN;
    return Number(String(v).replace(/[^0-9,-]/g, '').replace(',', '.'));
  }

  const CITY_NAMES = { Solo: 'Surakarta', Surakarta: 'Surakarta', Sukoharjo: 'Sukoharjo', Karanganyar: 'Karanganyar', Klaten: 'Klaten', Boyolali: 'Boyolali', Sragen: 'Sragen' };

  function importOutlets(rows) {
    const result = { added: 0, updated: 0, errors: [] };
    rows.forEach((r, idx) => {
      const line = idx + 2;
      const name = r.nama_outlet || r.nama;
      if (!name) { result.errors.push(`Baris ${line}: kolom nama_outlet wajib diisi`); return; }
      let city = (r.kota || 'Solo').trim();
      if (city === 'Surakarta') city = 'Solo';
      const limit = toNumber(r.limit_kredit);
      const code = (r.kode_outlet || '').trim() ||
        `${/minimarket|swalayan|toserba/i.test(r.tipe || '') ? 'MM' : 'AP'}-${city.slice(0, 3).toUpperCase()}-${String(state.outlets.length + 1).padStart(3, '0')}`;

      const existing = findOutlet(code);
      const data = {
        name,
        address: r.alamat || (existing ? existing.address : 'Solo Raya'),
        city,
        cityName: CITY_NAMES[city] || city,
        type: r.tipe || (existing ? existing.type : 'Apotek Mandiri'),
        picName: r.nama_pic || (existing ? existing.picName : '-'),
        picPhone: (r.telepon_pic || (existing ? existing.picPhone : '')).replace(/[^0-9]/g, ''),
        salesRep: r.sales_rep || (existing ? existing.salesRep : state.currentSalesRep),
        terms: r.termin || (existing ? existing.terms : 'Net 30 Hari')
      };

      if (existing) {
        Object.assign(existing, data);
        if (!isNaN(limit)) {
          existing.creditLimit = limit;
          existing.creditRemaining = Math.max(0, limit - (existing.creditUsed || 0));
        }
        result.updated++;
      } else {
        const lim = isNaN(limit) ? 10000000 : limit;
        state.outlets.push(Object.assign({
          id: code,
          code,
          picRole: 'Apoteker Pengelola Apotek (APA)',
          salesArea: data.cityName,
          creditLimit: lim,
          creditUsed: 0,
          creditRemaining: lim,
          creditStatus: 'Lancar',
          lastOrderDate: '-',
          orderFrequency: 'Migrasi Data Awal',
          ytdTotal: toNumber(r.omset_ytd) || 0,
          lastVisitDate: '-',
          visitNotes: '"Data outlet hasil migrasi awal (impor CSV)."'
        }, data));
        result.added++;
      }
    });
    if (result.added || result.updated) {
      showToast(`Migrasi outlet selesai: ${result.added} baru, ${result.updated} diperbarui${result.errors.length ? `, ${result.errors.length} baris gagal` : ''}`, 'upload_file');
      notify();
      syncMutationToServer('IMPORT_OUTLETS', { rows }, `Impor CSV Outlet (${result.added} baru, ${result.updated} update)`);
    }
    return result;
  }

  function importProducts(rows) {
    const result = { added: 0, updated: 0, errors: [] };
    rows.forEach((r, idx) => {
      const line = idx + 2;
      const sku = (r.sku || '').trim().toUpperCase();
      const name = r.nama_produk || r.nama;
      const stock = toNumber(r.stok);
      if (!sku || !name) { result.errors.push(`Baris ${line}: kolom sku & nama_produk wajib diisi`); return; }
      if (isNaN(stock) || stock < 0) { result.errors.push(`Baris ${line}: stok tidak valid`); return; }

      const existing = state.products.find(p => p.sku === sku);
      const ss = toNumber(r.safety_stock);
      const rop = toNumber(r.rop);
      const price = toNumber(r.harga_satuan);
      const batch = r.batch_aktif || (existing ? existing.activeBatch : `BATCH-${new Date().getFullYear()}-MIG`);

      if (existing) {
        const delta = stock - existing.stock;
        existing.name = name;
        if (r.kategori) existing.category = r.kategori;
        if (!isNaN(ss)) existing.safetyStock = ss;
        if (!isNaN(rop)) existing.rop = rop;
        if (!isNaN(price)) existing.unitPrice = price;
        if (r.tanggal_ed) existing.fefoDate = r.tanggal_ed;
        existing.activeBatch = batch;
        existing.stock = stock;
        existing.status = computeProductStatus(existing);
        if (delta !== 0) {
          state.ledger = [{
            id: newLedgerId(), timestamp: nowStamp(), docRef: 'MIGRASI-CSV', skuName: name, skuCode: sku, batch,
            type: 'PENYESUAIAN', quantity: delta, finalStock: stock,
            operator: 'Admin Gudang', operatorRole: 'Migrasi Data Awal', hash: pseudoHash(sku)
          }, ...state.ledger];
        }
        result.updated++;
      } else {
        const ssV = isNaN(ss) ? 50 : ss;
        const ropV = isNaN(rop) ? ssV * 2 : rop;
        const prod = {
          sku, name,
          category: r.kategori || 'Madu Herbal',
          stock,
          safetyStock: ssV,
          rop: ropV,
          ropFormula: `SS=${ssV} (migrasi)`,
          activeBatch: batch,
          fefoDate: r.tanggal_ed || '-',
          fefoStatus: 'Aman (>6 Bulan)',
          status: 'optimal',
          unitPrice: isNaN(price) ? 0 : price,
          icon: 'inventory_2'
        };
        prod.status = computeProductStatus(prod);
        state.products.push(prod);
        state.ledger = [{
          id: newLedgerId(), timestamp: nowStamp(), docRef: 'SALDO-AWAL', skuName: name, skuCode: sku, batch,
          type: 'MASUK', quantity: stock, finalStock: stock,
          operator: 'Admin Gudang', operatorRole: 'Migrasi Data Awal', hash: pseudoHash(sku)
        }, ...state.ledger];
        result.added++;
      }
    });
    if (result.added || result.updated) {
      const below = state.products.filter(p => p.stock <= p.rop).length;
      showToast(`Migrasi produk selesai: ${result.added} baru, ${result.updated} diperbarui. ${below} SKU di bawah ROP.`, 'upload_file');
      notify();
      syncMutationToServer('IMPORT_PRODUCTS', { rows }, `Impor CSV Produk (${result.added} baru, ${result.updated} update)`);
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Analitik Terhitung (Selector) — semua KPI dashboard dihitung dari state live
  // ---------------------------------------------------------------------------
  function getAnalytics() {
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const activeOrders = state.orders.filter(o => o.status !== 'REJECTED');

    const salesPerformance = state.salesTeam.map(rep => {
      const logsToday = state.visitLogs.filter(l => l.salesRep === rep.name && l.timestamp >= dayStart);
      const logsMonth = state.visitLogs.filter(l => l.salesRep === rep.name && l.timestamp >= monthStart);
      const repOrders = activeOrders.filter(o => o.salesRep === rep.name);
      const liveRevenue = repOrders.reduce((s, o) => s + o.totalAmount, 0);
      const revenueMonth = rep.monthlyRevenueBase + liveRevenue;
      const ordersToday = logsToday.filter(l => l.outcome === 'ORDER').length;
      return {
        id: rep.id,
        name: rep.name,
        area: rep.area,
        dailyVisitTarget: rep.dailyVisitTarget,
        monthlyRevenueTarget: rep.monthlyRevenueTarget,
        visitsToday: logsToday.length,
        ordersToday,
        visitsMonth: rep.monthlyVisitBase + logsMonth.length,
        revenueMonth,
        ordersCount: repOrders.length,
        revenuePct: rep.monthlyRevenueTarget ? Math.round((revenueMonth / rep.monthlyRevenueTarget) * 1000) / 10 : 0,
        visitPct: rep.dailyVisitTarget ? Math.round((logsToday.length / rep.dailyVisitTarget) * 100) : 0,
        effectiveCallRate: logsToday.length ? Math.round((ordersToday / logsToday.length) * 100) : 0,
        lastActivity: logsToday.length ? Math.max.apply(null, logsToday.map(l => l.timestamp)) : null
      };
    }).sort((a, b) => b.revenuePct - a.revenuePct);

    const revenueMonth = salesPerformance.reduce((s, r) => s + r.revenueMonth, 0);
    const revenueTarget = state.salesTeam.reduce((s, r) => s + r.monthlyRevenueTarget, 0);
    const visitsToday = salesPerformance.reduce((s, r) => s + r.visitsToday, 0);
    const ordersToday = salesPerformance.reduce((s, r) => s + r.ordersToday, 0);
    const visitTargetToday = state.salesTeam.reduce((s, r) => s + r.dailyVisitTarget, 0);
    const activeReps = salesPerformance.filter(r => r.visitsToday > 0).length;
    const liveRevenueToday = activeOrders.filter(o => o.orderTimestamp >= dayStart).reduce((s, o) => s + o.totalAmount, 0);

    const baseline = (window.ArbaData && window.ArbaData.baseline) || { extraApotek: 0, extraMinimarket: 0 };
    const sampleMinimarket = state.outlets.filter(o => /minimarket|swalayan|toserba/i.test(o.type)).length;
    const sampleApotek = state.outlets.length - sampleMinimarket;
    const apotekCount = baseline.extraApotek + sampleApotek;
    const minimarketCount = baseline.extraMinimarket + sampleMinimarket;
    const totalOutlets = apotekCount + minimarketCount;
    const newOutlets = state.outlets.filter(o => !(window.ArbaData.outlets || []).some(s => s.id === o.id)).length;

    // Outlet paling aktif: omset YTD + jumlah pesanan & kunjungan bulan ini
    const topOutlets = state.outlets.map(o => {
      const oOrders = activeOrders.filter(ord => ord.outletId === o.id || ord.outletId === o.code);
      const visits = state.visitLogs.filter(l => l.outletId === o.id && l.timestamp >= monthStart).length;
      return { id: o.id, name: o.name, city: o.cityName, type: o.type, ytdTotal: o.ytdTotal || 0, ordersCount: oOrders.length, visits, lastOrderDate: o.lastOrderDate };
    }).sort((a, b) => b.ytdTotal - a.ytdTotal).slice(0, 5);

    // Perputaran stok: keluar (buku besar) vs saldo, serta estimasi hari persediaan
    const stockTurnover = state.products.map(p => {
      const outQty = state.ledger.filter(l => l.skuCode === p.sku && l.type === 'KELUAR').reduce((s, l) => s + Math.abs(l.quantity), 0);
      const m = /d=(\d+)/.exec(p.ropFormula || '');
      const dailyDemand = m ? Number(m[1]) : Math.max(1, Math.round(p.safetyStock / 7));
      return {
        sku: p.sku,
        name: p.name,
        stock: p.stock,
        rop: p.rop,
        outQty,
        dailyDemand,
        daysOfCover: dailyDemand ? Math.round(p.stock / dailyDemand) : 0,
        turnoverRatio: p.stock ? Math.round(((dailyDemand * 30) / p.stock) * 100) / 100 : 0,
        belowRop: p.stock <= p.rop
      };
    }).sort((a, b) => a.daysOfCover - b.daysOfCover);

    const belowRop = state.products.filter(p => p.stock <= p.rop);
    const nearExpiry = state.products.filter(p => /Kritis|Mendekati/.test(p.fefoStatus || ''));

    // 1) ALARM ORANYE (Permintaan Mitra CV Arba'in: Alarm Stok Menipis dengan ambang berbeda sesuai tonase)
    const orangeStockAlarms = belowRop.map(p => ({
      sku: p.sku,
      name: p.name,
      stock: p.stock,
      rop: p.rop,
      shortage: Math.max(0, p.rop - p.stock),
      consumptionNote: p.monthlyConsumptionNote || p.ropFormula,
      color: 'ORANGE'
    }));

    // 2) ALARM PINK (Permintaan Mitra CV Arba'in: Alarm Produk Mendekati Expired di Gudang & di Apotek Mitra)
    const pinkExpiryAlarms = [];
    nearExpiry.forEach(p => {
      pinkExpiryAlarms.push({
        locationType: 'GUDANG_UTAMA',
        locationName: 'Gudang Utama Kartasura',
        salesRep: 'Admin Gudang',
        sku: p.sku,
        productName: p.name,
        batch: p.activeBatch,
        expiry: p.fefoDate,
        qty: p.stock,
        statusLabel: p.fefoStatus,
        color: 'PINK'
      });
    });
    state.outlets.forEach(o => {
      (o.consignmentItems || []).forEach(ci => {
        if (ci.nearExpiry && ci.remainingQty > 0) {
          pinkExpiryAlarms.push({
            locationType: 'APOTEK_MITRA',
            locationName: o.name,
            outletId: o.id,
            city: o.cityName,
            salesRep: o.salesRep,
            picPhone: o.picPhone,
            sku: ci.sku,
            productName: ci.name,
            batch: ci.batch,
            expiry: ci.expiry,
            qty: ci.remainingQty,
            statusLabel: `Stok Titipan Apotek (${ci.daysInOutlet} hari)`,
            color: 'PINK'
          });
        }
      });
    });

    // 3) Stok Titipan di Apotek: Yang Laku Keras vs Yang Lama Tidak Laku (Slow-Moving)
    const outletSlowMoving = [];
    state.outlets.forEach(o => {
      (o.consignmentItems || []).forEach(ci => {
        if (ci.velocity === 'LAMA_TIDAK_LAKU' && ci.remainingQty > 0) {
          outletSlowMoving.push({
            outletId: o.id,
            outletName: o.name,
            city: o.cityName,
            salesRep: o.salesRep,
            sku: ci.sku,
            productName: ci.name,
            batch: ci.batch,
            expiry: ci.expiry,
            consignedQty: ci.consignedQty,
            soldQty: ci.soldQty,
            remainingQty: ci.remainingQty,
            daysInOutlet: ci.daysInOutlet
          });
        }
      });
    });

    // 4) Tren Produk Paling Laku Keras & Perkiraan (Forecasting) Produksi Bulan Depan (Pilar ke-6 CV Arba'in)
    const productForecasting = state.products.map(p => {
      const liveSold = activeOrders.reduce((s, ord) => {
        return s + (ord.items || []).filter(it => normalizeSku(it.sku) === normalizeSku(p.sku)).reduce((a, b) => a + b.quantity, 0);
      }, 0);
      const soldMonth = (p.monthlySoldUnits || 800) + liveSold;
      const forecastUnits = Math.max(p.forecastNextMonthUnits || Math.round(soldMonth * 1.12), soldMonth);
      const productionNeeded = Math.max(0, forecastUnits + p.safetyStock - p.stock);
      return {
        sku: p.sku,
        name: p.name,
        category: p.category,
        division: p.division || 'Madu & Herbal',
        stock: p.stock,
        rop: p.rop,
        soldMonth,
        forecastUnits,
        productionNeeded,
        consumptionNote: p.monthlyConsumptionNote || `${soldMonth} unit/bln`
      };
    }).sort((a, b) => b.soldMonth - a.soldMonth);

    // 5) Ringkasan Kontrol Barang Bawaan Sales (Anti-Fraud)
    const salesLoadings = state.salesLoadings || [];
    const totalDiscrepancyUnits = salesLoadings.reduce((s, l) => {
      return s + (l.items || []).reduce((a, it) => a + (it.discrepancy || 0), 0);
    }, 0);

    return {
      revenueMonth,
      revenueTarget,
      revenuePct: revenueTarget ? Math.round((revenueMonth / revenueTarget) * 1000) / 10 : 0,
      liveRevenueToday,
      totalOutlets,
      apotekCount,
      minimarketCount,
      apotekPct: totalOutlets ? Math.round((apotekCount / totalOutlets) * 100) : 0,
      newOutlets,
      visitsToday,
      ordersToday,
      visitTargetToday,
      visitPct: visitTargetToday ? Math.round((visitsToday / visitTargetToday) * 1000) / 10 : 0,
      effectiveCallRate: visitsToday ? Math.round((ordersToday / visitsToday) * 100) : 0,
      activeReps,
      totalReps: state.salesTeam.length,
      salesPerformance,
      topOutlets,
      stockTurnover,
      belowRop,
      nearExpiry,
      orangeStockAlarms,
      pinkExpiryAlarms,
      outletSlowMoving,
      productForecasting,
      salesLoadings,
      totalDiscrepancyUnits,
      criticalSkuCount: new Set(belowRop.concat(nearExpiry).map(p => p.sku)).size,
      pendingOrders: state.orders.filter(o => o.status === 'PENDING').length,
      waitingStockOrders: state.orders.filter(o => o.status === 'PENDING' && o.syncStatus === 'PENDING_WAREHOUSE').length
    };
  }

  async function resetToDefaults() {
    localStorage.removeItem(STORAGE_KEY);
    if (window.ArbaOfflineSync && typeof window.ArbaOfflineSync.resetCentralServer === 'function') {
      await window.ArbaOfflineSync.resetCentralServer();
    }
    location.reload();
  }

  // Initialize theme on load
  if (state.isDarkMode) {
    document.documentElement.classList.add('dark');
  }

  return {
    getState: () => state,
    subscribe,
    notify,
    setPath,
    setRole,
    loginUser,
    logoutUser,
    getAllowedPathsForUser,
    updateUserProfile,
    changeUserPassword,
    createNewUser,
    deleteUser,
    toggleSidebar,
    toggleDarkMode,
    toggleOnlineStatus,
    setNetworkOnlineState,
    syncNow,
    applyServerState,
    addOfflineQueueEntry,
    restoreOfflineQueue,
    setSelectedOutletId,
    showToast,
    addInboundBatch,
    approveOrder,
    batchApproveOrders,
    rejectOrder,
    substituteOrderBatch,
    adjustOrderQuantity,
    adjustStock,
    createSupplierPO,
    scheduleSalesVisit,
    markOrderDelivered,
    addOutlet,
    submitFieldSalesOrder,
    logFieldVisit,
    setCurrentSalesRep,
    recordSalesWarehouseLoad,
    reconcileSalesLoading,
    checkStockAvailability,
    importOutlets,
    importProducts,
    getAnalytics,
    visitOutcomeLabels: VISIT_OUTCOME_LABELS,
    resetToDefaults
  };
})();
