/**
 * ArbaConnect ERP - Offline-First Storage (IndexedDB) & Central Server Sync Engine
 * CV Arba'in Solo Raya
 *
 * Fitur Utama:
 * 1. IndexedDB Persistence (`ArbaConnectOfflineDB`):
 *    - Menyimpan antrean transaksi offline (`mutation_queue`) tanpa batas 5MB localStorage.
 *    - Menyimpan snapshot database pusat terakhir (`state_snapshot`).
 * 2. Sinkronisasi Batch Idempoten (`POST /api/sync`):
 *    - Mengirim seluruh antrean offline ke server pusat saat sinyal kembali online.
 *    - Menggunakan `mutationId` / `clientUuid` agar tidak terjadi pemotongan stok ganda.
 * 3. Real-Time Multi-Device Push (`GET /api/events` via Server-Sent Events):
 *    - Saat Sales di HP mengirim order, layar Direktur & Admin Gudang di kantor pusat
 *      langsung ter-update secara live detik itu juga tanpa refresh.
 * 4. Deteksi Sinyal Otomatis (`online` / `offline` browser events) + Mode Simulasi.
 */

window.ArbaOfflineSync = (function () {
  'use strict';

  const DB_NAME = 'ArbaConnectOfflineDB';
  const DB_VERSION = 1;
  const QUEUE_STORE = 'mutation_queue';
  const SNAPSHOT_STORE = 'state_snapshot';
  const CLIENT_ID_KEY = 'arbaconnect_client_device_id';
  const AUTH_TOKEN_KEY = 'arbaconnect_auth_session_token';

  let dbPromise = null;
  let sseConnection = null;
  let isSyncing = false;
  let serverAvailable = false;
  let lastSyncTimestamp = null;
  let deferredInstallPrompt = null;
  let authTokenMemory = null;

  function setAuthToken(token) {
    authTokenMemory = token || null;
    try {
      if (token) {
        sessionStorage.setItem(AUTH_TOKEN_KEY, token);
      } else {
        sessionStorage.removeItem(AUTH_TOKEN_KEY);
      }
    } catch (e) {}
  }

  function getAuthToken() {
    if (authTokenMemory) return authTokenMemory;
    try {
      authTokenMemory = sessionStorage.getItem(AUTH_TOKEN_KEY) || null;
      return authTokenMemory;
    } catch (e) {
      return null;
    }
  }

  function getAuthHeaders(extra) {
    const headers = Object.assign({}, extra || {});
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    return headers;
  }

  function sanitizeStateForStorage(stateData) {
    if (!stateData || typeof stateData !== 'object') return stateData;
    const copy = Object.assign({}, stateData);
    if (Array.isArray(copy.users)) {
      copy.users = copy.users.map((u) => {
        if (!u || typeof u !== 'object') return u;
        const uc = Object.assign({}, u);
        if (uc.password && window.ArbaData && typeof window.ArbaData.hashCredential === 'function') {
          uc.passwordHash = window.ArbaData.hashCredential(uc.password);
        }
        if (uc.pin && window.ArbaData && typeof window.ArbaData.hashCredential === 'function') {
          uc.pinHash = window.ArbaData.hashCredential(uc.pin);
        }
        delete uc.password;
        delete uc.pin;
        return uc;
      });
    }
    if (copy.currentUser && typeof copy.currentUser === 'object') {
      const cu = Object.assign({}, copy.currentUser);
      delete cu.password;
      delete cu.pin;
      copy.currentUser = cu;
    }
    return copy;
  }

  function getClientId() {
    try {
      let cid = localStorage.getItem(CLIENT_ID_KEY);
      if (!cid) {
        cid = 'DEV-' + Math.random().toString(36).substring(2, 8).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
        localStorage.setItem(CLIENT_ID_KEY, cid);
      }
      return cid;
    } catch (e) {
      return 'DEV-LOCAL';
    }
  }

  const clientId = getClientId();

  // ---------------------------------------------------------------------------
  // 1. IndexedDB Wrapper
  // ---------------------------------------------------------------------------
  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(QUEUE_STORE)) {
          const qStore = db.createObjectStore(QUEUE_STORE, { keyPath: 'mutationId' });
          qStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
          db.createObjectStore(SNAPSHOT_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => {
        console.warn('IndexedDB gagal dibuka, fallback ke localStorage:', e.target.error);
        resolve(null);
      };
    });
    return dbPromise;
  }

  async function saveMutationToIDB(mutation) {
    const db = await openDB();
    if (!db) return;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(QUEUE_STORE, 'readwrite');
        tx.objectStore(QUEUE_STORE).put(mutation);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  async function getAllQueuedMutationsFromIDB() {
    const db = await openDB();
    if (!db) return [];
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(QUEUE_STORE, 'readonly');
        const store = tx.objectStore(QUEUE_STORE);
        const req = store.getAll();
        req.onsuccess = () => {
          const items = (req.result || []).sort((a, b) => a.createdAt - b.createdAt);
          resolve(items);
        };
        req.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });
  }

  async function removeMutationsFromIDB(mutationIds) {
    const db = await openDB();
    if (!db || !mutationIds || !mutationIds.length) return;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(QUEUE_STORE, 'readwrite');
        const store = tx.objectStore(QUEUE_STORE);
        mutationIds.forEach((id) => store.delete(id));
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  async function clearIDBQueue() {
    const db = await openDB();
    if (!db) return;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(QUEUE_STORE, 'readwrite');
        tx.objectStore(QUEUE_STORE).clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  async function saveSnapshotToIDB(stateData) {
    const db = await openDB();
    if (!db) return;
    const cleanState = sanitizeStateForStorage(stateData);
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(SNAPSHOT_STORE, 'readwrite');
        tx.objectStore(SNAPSHOT_STORE).put({
          id: 'central_snapshot',
          state: cleanState,
          updatedAt: Date.now()
        });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  async function loadSnapshotFromIDB() {
    const db = await openDB();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(SNAPSHOT_STORE, 'readonly');
        const req = tx.objectStore(SNAPSHOT_STORE).get('central_snapshot');
        req.onsuccess = () => resolve(req.result ? req.result.state : null);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 2. Komunikasi ke Server Pusat (/api/state, /api/sync, /api/events)
  // ---------------------------------------------------------------------------
  function isHttpOrigin() {
    return typeof window !== 'undefined' && /^https?:$/i.test(window.location.protocol);
  }

  async function fetchCentralState() {
    if (!isHttpOrigin()) return null;
    try {
      const res = await fetch('/api/state', {
        method: 'GET',
        headers: getAuthHeaders({ 'Accept': 'application/json' }),
        credentials: 'same-origin',
        cache: 'no-store'
      });
      if (!res.ok) return null;
      const data = await res.json();
      serverAvailable = true;
      lastSyncTimestamp = Date.now();
      if (data && data.state) {
        await saveSnapshotToIDB(data.state);
        return data.state;
      }
    } catch (e) {
      serverAvailable = false;
    }
    return null;
  }

  let syncChain = Promise.resolve();

  /**
   * Mencatat aksi mutasi (Order, Kunjungan, Stok, Otorisasi, Realokasi, dll.).
   * - Jika sedang Offline: Disimpan ke IndexedDB `mutation_queue` + `offlineQueue` lokal.
   * - Jika sedang Online: Dikirim secara berurutan (sequential queue) ke Server Pusat (`POST /api/sync`)
   *   tanpa menimpa ulang state lokal yang baru saja dimutasi oleh pengguna.
   */
  async function recordOrSyncMutation(type, payload, summaryLabel) {
    const mutationId = (payload && (payload.clientUuid || payload.id)) ||
      `MUT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const mutation = {
      mutationId,
      type,
      payload,
      summary: summaryLabel || type,
      createdAt: Date.now(),
      clientId
    };

    const storeState = window.ArbaStore ? window.ArbaStore.getState() : { isOnline: true };

    // Bila sedang mode Offline atau dibuka dari file:// tanpa server
    if (!storeState.isOnline || !isHttpOrigin()) {
      await saveMutationToIDB(mutation);
      if (window.ArbaStore && typeof window.ArbaStore.addOfflineQueueEntry === 'function') {
        window.ArbaStore.addOfflineQueueEntry(mutation);
      }
      registerBackgroundSync();
      return { queuedOffline: true, mutationId };
    }

    // Antrekan request ke server secara berurutan agar tidak saling balapan (race condition)
    const runSync = async () => {
      try {
        const currentSnapshot = window.ArbaStore ? sanitizeStateForStorage(window.ArbaStore.getState()) : null;
        if (currentSnapshot) {
          await saveSnapshotToIDB(currentSnapshot);
        }
        const res = await fetch('/api/sync', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'same-origin',
          body: JSON.stringify({
            clientId,
            mutations: [mutation]
          })
        });

        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (data && data.refreshedToken) {
          setAuthToken(data.refreshedToken);
        }
        serverAvailable = true;
        lastSyncTimestamp = Date.now();
        return { queuedOffline: false, synced: true, mutationId, serverResponse: data };
      } catch (err) {
        serverAvailable = false;
        await saveMutationToIDB(mutation);
        if (window.ArbaStore && typeof window.ArbaStore.addOfflineQueueEntry === 'function') {
          window.ArbaStore.addOfflineQueueEntry(mutation);
        }
        registerBackgroundSync();
        return { queuedOffline: true, mutationId, error: err.message };
      }
    };

    syncChain = syncChain.then(runSync, runSync);
    return syncChain;
  }

  /**
   * Mengirim seluruh antrean transaksi lokal (IndexedDB + state.offlineQueue)
   * ke Server Pusat secara batch & idempoten.
   */
  async function flushOfflineQueue(options) {
    options = options || {};
    if (isSyncing) return { syncedCount: 0, busy: true };
    isSyncing = true;

    try {
      const idbQueue = await getAllQueuedMutationsFromIDB();
      const storeState = window.ArbaStore ? window.ArbaStore.getState() : { offlineQueue: [] };
      const memQueue = storeState.offlineQueue || [];

      // Gabungkan antrean IndexedDB dan memory berdasarkan mutationId/id unik
      const mergedMap = new Map();
      idbQueue.forEach((m) => mergedMap.set(m.mutationId, m));
      memQueue.forEach((m) => {
        const key = m.mutationId || m.id;
        if (key && !mergedMap.has(key)) {
          mergedMap.set(key, {
            mutationId: key,
            type: m.type || 'SUBMIT_ORDER',
            payload: m.payload || { orderId: m.id },
            summary: m.summary || `Pesanan #${m.id}`,
            createdAt: m.createdAt || Date.now(),
            clientId
          });
        }
      });

      const allMutations = Array.from(mergedMap.values()).sort((a, b) => a.createdAt - b.createdAt);

      if (!isHttpOrigin()) {
        // Jika dijalankan via file:// tanpa backend HTTP, bersihkan antrean di memori lokal
        await clearIDBQueue();
        isSyncing = false;
        return { syncedCount: allMutations.length, localOnly: true };
      }

      // Meskipun antrean kosong, saat baru kembali online kita tetap tarik state terbaru dari pusat
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'same-origin',
        body: JSON.stringify({
          clientId,
          mutations: allMutations,
          fullSnapshotFallback: allMutations.length === 0 ? null : undefined
        })
      });

      if (!res.ok) throw new Error('Server merespons ' + res.status);
      const data = await res.json();
      serverAvailable = true;
      lastSyncTimestamp = Date.now();

      await removeMutationsFromIDB(allMutations.map((m) => m.mutationId));
      await clearIDBQueue();

      if (data && data.state && window.ArbaStore && typeof window.ArbaStore.applyServerState === 'function') {
        await saveSnapshotToIDB(data.state);
        window.ArbaStore.applyServerState(data.state, {
          clearQueue: true,
          toastMessage: allMutations.length > 0
            ? `Sinkronisasi Pusat Berhasil: ${allMutations.length} transaksi lokal telah masuk ke Database Pusat!`
            : (options.showToastIfEmpty ? 'Terhubung ke Server Pusat: Data telah mutakhir' : null)
        });
      }

      isSyncing = false;
      return { syncedCount: allMutations.length, serverResponse: data };
    } catch (err) {
      serverAvailable = false;
      isSyncing = false;
      return { syncedCount: 0, error: err.message };
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Real-Time Server-Sent Events (SSE) untuk Multi-Device Live Sync
  // ---------------------------------------------------------------------------
  function connectRealtimeSSE() {
    if (!isHttpOrigin() || typeof EventSource === 'undefined') return;
    const st = window.ArbaStore ? window.ArbaStore.getState() : null;
    if (!st || !st.currentUser) return;
    if (sseConnection) {
      try { sseConnection.close(); } catch (e) {}
    }

    try {
      const tokenParam = getAuthToken() ? '&token=' + encodeURIComponent(getAuthToken()) : '';
      sseConnection = new EventSource('/api/events?clientId=' + encodeURIComponent(clientId) + tokenParam);

      sseConnection.addEventListener('connected', () => {
        serverAvailable = true;
      });

      sseConnection.addEventListener('state_updated', async (event) => {
        try {
          const packet = JSON.parse(event.data);
          // Abaikan jika event berasal dari perangkat kita sendiri atau jika kita sedang mode simulasi Offline
          const st = window.ArbaStore ? window.ArbaStore.getState() : null;
          if (!st || !st.isOnline) return;
          if (packet.sourceClientId === clientId) return;

          if (packet.state && window.ArbaStore && typeof window.ArbaStore.applyServerState === 'function') {
            lastSyncTimestamp = Date.now();
            await saveSnapshotToIDB(packet.state);
            window.ArbaStore.applyServerState(packet.state, {
              toastMessage: packet.summary
                ? `Live Sync Pusat: ${packet.summary}`
                : 'Data diperbarui secara real-time dari perangkat lain'
            });
          }
        } catch (err) {
          console.warn('Gagal memproses SSE event:', err);
        }
      });

      sseConnection.onerror = () => {
        serverAvailable = false;
      };
    } catch (e) {
      serverAvailable = false;
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Service Worker Registration & PWA Install Prompt
  // ---------------------------------------------------------------------------
  const PWA_BANNER_DISMISSED_KEY = 'arbaconnect_pwa_banner_dismissed_at';

  function isStandaloneApp() {
    try {
      return (
        (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
        (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches) ||
        (typeof navigator !== 'undefined' && navigator.standalone === true)
      );
    } catch (e) {
      return false;
    }
  }

  function detectDevicePlatform() {
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
    const isIOS = /iPad|iPhone|iPod/i.test(ua) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(ua);
    const isMobile = isIOS || isAndroid || /Mobile|Tablet/i.test(ua) || (typeof window !== 'undefined' && window.innerWidth <= 900);
    const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
    const isFirefox = /Firefox|FxiOS/i.test(ua);
    return { isIOS, isAndroid, isMobile, isSafari, isFirefox };
  }

  function getActiveInstallPrompt() {
    if (deferredInstallPrompt) return deferredInstallPrompt;
    if (typeof window !== 'undefined' && window.__arbaDeferredInstallPrompt) {
      deferredInstallPrompt = window.__arbaDeferredInstallPrompt;
      return deferredInstallPrompt;
    }
    return null;
  }

  function updateInstallUI() {
    const headerBtn = document.getElementById('header-install-pwa-btn');
    const banner = document.getElementById('pwa-mobile-install-banner');
    const activePrompt = getActiveInstallPrompt();

    if (isStandaloneApp()) {
      if (headerBtn) headerBtn.classList.add('hidden');
      if (banner) banner.classList.add('hidden');
      return;
    }

    // Tampilkan tombol & banner HANYA ketika native installer 1-klik benar-benar siap diunduh/dipasang
    if (headerBtn) {
      if (activePrompt) {
        headerBtn.classList.remove('hidden');
        headerBtn.setAttribute('title', 'Install Aplikasi ArbaConnect Sekali Klik (Bisa Offline)');
      } else {
        headerBtn.classList.add('hidden');
      }
    }

    if (banner) {
      let dismissedRecently = false;
      try {
        const ts = Number(localStorage.getItem(PWA_BANNER_DISMISSED_KEY) || 0);
        if (ts && (Date.now() - ts) < 3 * 24 * 60 * 60 * 1000) {
          dismissedRecently = true;
        }
      } catch (e) {}

      if (activePrompt && !dismissedRecently) {
        banner.classList.remove('hidden');
      } else {
        banner.classList.add('hidden');
      }
    }
  }

  function registerServiceWorker() {
    if (!isHttpOrigin() || !('serviceWorker' in navigator)) {
      updateInstallUI();
      return;
    }

    // Ambil event beforeinstallprompt yang mungkin sudah tertangkap sejak <head>
    getActiveInstallPrompt();

    const doRegister = () => {
      navigator.serviceWorker.register('./sw.js').then((reg) => {
        console.log('[ArbaConnect PWA] Service Worker aktif:', reg.scope);
        updateInstallUI();
      }).catch((err) => {
        console.warn('[ArbaConnect PWA] Gagal mendaftarkan Service Worker:', err);
      });

      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'TRIGGER_OFFLINE_SYNC') {
          const st = window.ArbaStore ? window.ArbaStore.getState() : null;
          if (st && st.isOnline) {
            flushOfflineQueue();
          }
        }
      });
    };

    if (document.readyState === 'complete') {
      doRegister();
    } else {
      window.addEventListener('load', doRegister);
    }

    // Bind tombol di Floating Mobile Install Banner
    const bannerInstallBtn = document.getElementById('pwa-banner-install-btn');
    if (bannerInstallBtn) {
      bannerInstallBtn.addEventListener('click', () => {
        promptInstallPWA();
      });
    }
    const bannerDismissBtn = document.getElementById('pwa-banner-dismiss-btn');
    if (bannerDismissBtn) {
      bannerDismissBtn.addEventListener('click', () => {
        const banner = document.getElementById('pwa-mobile-install-banner');
        if (banner) banner.classList.add('hidden');
        try {
          localStorage.setItem(PWA_BANNER_DISMISSED_KEY, String(Date.now()));
        } catch (e) {}
      });
    }

    // Tangkap event instalasi PWA untuk tombol Install App & Mobile Banner
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      if (typeof window !== 'undefined') window.__arbaDeferredInstallPrompt = e;
      updateInstallUI();
    });

    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      if (typeof window !== 'undefined') window.__arbaDeferredInstallPrompt = null;
      updateInstallUI();
      if (window.ArbaApp && window.ArbaApp.showToast) {
        window.ArbaApp.showToast('Aplikasi ArbaConnect berhasil di-install & siap diakses secara offline!', 'install_mobile');
      }
    });

    updateInstallUI();
  }

  function registerBackgroundSync() {
    if (!('serviceWorker' in navigator) || !('SyncManager' in window)) return;
    navigator.serviceWorker.ready.then((reg) => {
      return reg.sync.register('arba-offline-sync');
    }).catch(() => {});
  }

  async function promptInstallPWA() {
    const promptEvent = getActiveInstallPrompt();
    if (!promptEvent) return false;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    deferredInstallPrompt = null;
    if (typeof window !== 'undefined') window.__arbaDeferredInstallPrompt = null;
    updateInstallUI();
    return choice.outcome === 'accepted';
  }

  // ---------------------------------------------------------------------------
  // 5. Bootstrap Awal & Listener Sinyal Jaringan Asli (`online` / `offline`)
  // ---------------------------------------------------------------------------
  async function init() {
    registerServiceWorker();
    await openDB();

    // Pantau sinyal jaringan asli perangkat (WiFi / Data Seluler Sales)
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        if (window.ArbaStore && typeof window.ArbaStore.setNetworkOnlineState === 'function') {
          window.ArbaStore.setNetworkOnlineState(true, { fromBrowserEvent: true });
        }
      });

      window.addEventListener('offline', () => {
        if (window.ArbaStore && typeof window.ArbaStore.setNetworkOnlineState === 'function') {
          window.ArbaStore.setNetworkOnlineState(false, { fromBrowserEvent: true });
        }
      });
    }

    // Pulihkan antrean yang tersimpan di IndexedDB jika ada
    const pendingIDB = await getAllQueuedMutationsFromIDB();
    if (pendingIDB.length > 0 && window.ArbaStore && typeof window.ArbaStore.restoreOfflineQueue === 'function') {
      window.ArbaStore.restoreOfflineQueue(pendingIDB);
    }

    // Jika sedang Online, sudah login, dan terhubung ke server HTTP, sinkronkan antrean & tarik state pusat
    const st = window.ArbaStore ? window.ArbaStore.getState() : { isOnline: true };
    if (st.isOnline && isHttpOrigin() && st.currentUser) {
      if (pendingIDB.length > 0 || (st.offlineQueue && st.offlineQueue.length > 0)) {
        await flushOfflineQueue();
      } else {
        const centralState = await fetchCentralState();
        if (centralState && window.ArbaStore && typeof window.ArbaStore.applyServerState === 'function') {
          window.ArbaStore.applyServerState(centralState, { silent: true });
        }
      }
      connectRealtimeSSE();
    } else if (!st.isOnline) {
      // Jika cold-boot dalam keadaan offline, muat snapshot terakhir dari IndexedDB bila ada
      const snap = await loadSnapshotFromIDB();
      if (snap && window.ArbaStore && typeof window.ArbaStore.applyServerState === 'function') {
        window.ArbaStore.applyServerState(snap, { silent: true, preserveLocalQueue: true });
      }
    }
  }

  async function onAuthenticated() {
    const st = window.ArbaStore ? window.ArbaStore.getState() : { isOnline: true };
    if (!st.isOnline || !isHttpOrigin()) return;
    const pendingIDB = await getAllQueuedMutationsFromIDB();
    if (pendingIDB.length > 0 || (st.offlineQueue && st.offlineQueue.length > 0)) {
      await flushOfflineQueue();
    } else {
      const centralState = await fetchCentralState();
      if (centralState && window.ArbaStore && typeof window.ArbaStore.applyServerState === 'function') {
        window.ArbaStore.applyServerState(centralState, { silent: true });
      }
    }
    connectRealtimeSSE();
  }

  async function clearAuthSession() {
    setAuthToken(null);
    if (sseConnection) {
      try { sseConnection.close(); } catch (e) {}
      sseConnection = null;
    }
    try {
      const db = await openDB();
      if (db) {
        const tx = db.transaction(SNAPSHOT_STORE, 'readwrite');
        tx.objectStore(SNAPSHOT_STORE).delete('central_snapshot');
      }
    } catch (e) {}
    if (isHttpOrigin()) {
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
      } catch (e) {}
    }
  }

  async function resetCentralServer() {
    await clearIDBQueue();
    if (isHttpOrigin()) {
      try {
        await fetch('/api/reset', {
          method: 'POST',
          headers: getAuthHeaders(),
          credentials: 'same-origin'
        });
      } catch (e) {}
    }
  }

  function getSyncDiagnostics() {
    return {
      clientId,
      serverAvailable,
      isSyncing,
      lastSyncTimestamp,
      canInstallPWA: !!deferredInstallPrompt
    };
  }

  return {
    init,
    getClientId: () => clientId,
    setAuthToken,
    getAuthToken,
    onAuthenticated,
    clearAuthSession,
    recordOrSyncMutation,
    flushOfflineQueue,
    fetchCentralState,
    connectRealtimeSSE,
    promptInstallPWA,
    resetCentralServer,
    getSyncDiagnostics
  };
})();
