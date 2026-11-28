/**
 * =============================================================================
 * ArbaConnect ERP - Central Server, Relational SQL Engine & Offline-First Sync API
 * CV Arba'in Solo Raya
 * =============================================================================
 *
 * Fitur Server Pusat:
 * 1. Database Relasional SQL Persisten (`database/arbaconnect.sqlite` via `node:sqlite`)
 *    mengimplementasikan ke-10 tabel pada `database/schema.sql`:
 *    - users, outlets, sales_targets, visits, products, product_batches,
 *      orders, order_items, stock_ledger, alerts + sync_mutations_log.
 * 2. Endpoint Sinkronisasi Idempoten (`POST /api/sync`):
 *    - Menerima antrean transaksi dari HP Sales (PWA Offline Queue) maupun aksi live.
 *    - Menolak duplikasi berdasarkan `mutationId` / `client_uuid` (Idempotent).
 *    - Memotong stok batch FEFO secara atomik (`BEGIN IMMEDIATE ... COMMIT`),
 *      mencatat buku besar imutabel (`stock_ledger`), plafon kredit apotek, & alarm ROP.
 * 3. Real-Time Multi-Device Push (`GET /api/events` via Server-Sent Events / SSE):
 *    - Begitu HP Sales sinkronisasi ke pusat, layar Direktur & Admin Gudang langsung
 *      ter-update detik itu juga tanpa perlu refresh.
 * 4. Static PWA Host:
 *    - Melayani `index.html`, `sw.js`, `manifest.json`, `css/*`, `js/*`, `icons/*`.
 */

'use strict';

const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { URL } = require('node:url');

let DatabaseSync = null;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (sqliteLoadErr) {
  DatabaseSync = null;
}

function createInMemoryFallbackDb() {
  const kvStore = new Map();
  const revokedMap = new Map();
  const mutationsMap = new Map();
  const auditLogsList = [];
  return {
    isFallbackMemory: true,
    exec() {},
    prepare(sql) {
      const q = String(sql || '').trim().toLowerCase();
      return {
        get(...args) {
          if (q.includes('from erp_central_state')) {
            const val = kvStore.get('main');
            return val !== undefined ? { state_json: val } : undefined;
          }
          if (q.includes('from app_kv_state')) {
            const val = kvStore.get(args[0]);
            return val !== undefined ? { value_json: val } : undefined;
          }
          if (q.includes('from revoked_tokens')) {
            const exp = revokedMap.get(args[0]);
            return exp !== undefined ? { exp_ms: exp } : undefined;
          }
          if (q.includes('from sync_mutations_log')) {
            const m = mutationsMap.get(args[0]);
            return m ? { mutation_id: m.mutation_id } : undefined;
          }
          if (q.includes('from audit_logs') && q.includes('count(*)')) {
            return { c: auditLogsList.length };
          }
          if (q.includes('select count(*)')) {
            return { c: 0 };
          }
          return undefined;
        },
        all() {
          if (q.includes('from sync_mutations_log')) {
            return Array.from(mutationsMap.values()).slice(-30).reverse();
          }
          if (q.includes('from audit_logs')) {
            return auditLogsList.slice(0, 100);
          }
          return [];
        },
        run(...args) {
          if (q.includes('into erp_central_state')) {
            kvStore.set('main', args[0]);
          } else if (q.includes('into app_kv_state')) {
            kvStore.set(args[0], args[1]);
          } else if (q.includes('into audit_logs')) {
            auditLogsList.unshift({
              id: args[0], action: args[1], actor: args[2], actor_role: args[3],
              outlet_id: args[4], outlet_name: args[5], product_sku: args[6],
              product_name: args[7], no_batch: args[8], qty: args[9],
              doc_ref: args[10], details: args[11], checksum_hash: args[12], created_at: args[13]
            });
            if (auditLogsList.length > 500) auditLogsList.length = 500;
          } else if (q.includes('delete from audit_logs')) {
            auditLogsList.length = 0;
          } else if (q.includes('into revoked_tokens')) {
            revokedMap.set(args[0], args[1]);
          } else if (q.includes('delete from revoked_tokens')) {
            if (q.includes('token_hash = ?')) {
              revokedMap.delete(args[0]);
            } else {
              const now = args[0] || Date.now();
              for (const [k, exp] of revokedMap.entries()) {
                if (exp <= now) revokedMap.delete(k);
              }
            }
          } else if (q.includes('into sync_mutations_log')) {
            mutationsMap.set(args[0], {
              mutation_id: args[0],
              client_id: args[1],
              mutation_type: args[2],
              summary: args[3],
              synced_at: new Date().toISOString()
            });
          } else if (q.includes('delete from sync_mutations_log')) {
            mutationsMap.clear();
          }
          return { changes: 1 };
        }
      };
    }
  };
}

function hashCredential(raw) {
  const str = String(raw || '');
  if (str.startsWith('sha256:') && str.length === 71) return str;
  return 'sha256:' + crypto.createHash('sha256').update('ARBA-SALT-2026:' + str).digest('hex');
}

function verifyCredentialHash(inputRaw, storedPlainOrHash, storedHashField) {
  const candidate = hashCredential(inputRaw);
  const expected = storedHashField
    ? String(storedHashField)
    : (storedPlainOrHash ? hashCredential(storedPlainOrHash) : '');
  if (!expected || candidate.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(candidate, 'utf8'), Buffer.from(expected, 'utf8'));
  } catch (e) {
    return false;
  }
}

// Di Vercel Serverless, pastikan seluruh container dalam 1 deployment berbagi secret HMAC yang konsisten
// agar token sesi tidak error 401 saat pindah instance serverless / cold start.
const IS_SERVERLESS_RUNTIME = Boolean(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  __dirname.startsWith('/var/task')
);
const SERVER_STABLE_SEED =
  process.env.VERCEL_PROJECT_ID ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.VERCEL_DEPLOYMENT_ID ||
  __dirname;
const SERVER_AUTH_SECRET = process.env.ARBA_AUTH_SECRET ||
  crypto.createHash('sha256').update('ARBA-SESSION-HMAC-2026:' + SERVER_STABLE_SEED).digest('hex');

// Adapter Persistensi Cloud KV Opsional (Vercel KV / Upstash Redis REST API, zero-dependency)
// Mendukung nama variabel standar maupun yang memakai Custom Prefix dari Vercel Marketplace Storage
function resolveCloudKvCredentials() {
  const env = process.env || {};
  if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) {
    return { url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN, envSource: 'KV_REST_API_*' };
  }
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    return { url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN, envSource: 'UPSTASH_REDIS_REST_*' };
  }
  const keys = Object.keys(env);
  for (const k of keys) {
    if (k.endsWith('_KV_REST_API_URL') && env[k]) {
      const prefix = k.slice(0, -'_KV_REST_API_URL'.length);
      const tokKey = prefix + '_KV_REST_API_TOKEN';
      if (env[tokKey]) {
        return { url: env[k], token: env[tokKey], envSource: prefix + '_KV_REST_API_*' };
      }
    }
    if (k.endsWith('_UPSTASH_REDIS_REST_URL') && env[k]) {
      const prefix = k.slice(0, -'_UPSTASH_REDIS_REST_URL'.length);
      const tokKey = prefix + '_UPSTASH_REDIS_REST_TOKEN';
      if (env[tokKey]) {
        return { url: env[k], token: env[tokKey], envSource: prefix + '_UPSTASH_REDIS_REST_*' };
      }
    }
  }
  return { url: '', token: '', envSource: null };
}

const CLOUD_KV_CREDS = resolveCloudKvCredentials();
const CLOUD_KV_URL = String(CLOUD_KV_CREDS.url || '').trim().replace(/\/+$/, '');
const CLOUD_KV_TOKEN = String(CLOUD_KV_CREDS.token || '').trim();
const CLOUD_KV_ENV_SOURCE = CLOUD_KV_CREDS.envSource;
const HAS_CLOUD_KV = Boolean(CLOUD_KV_URL && CLOUD_KV_TOKEN && typeof fetch === 'function');
const CLOUD_KV_STATE_KEY = 'arbaconnect:central_state:v3';
const STORAGE_MODE = HAS_CLOUD_KV
  ? 'cloud-kv'
  : (IS_SERVERLESS_RUNTIME ? 'serverless-ephemeral' : 'local-sqlite');

async function cloudKvGetState() {
  if (!HAS_CLOUD_KV) return null;
  try {
    const res = await fetch(CLOUD_KV_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CLOUD_KV_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(['GET', CLOUD_KV_STATE_KEY])
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.result) return null;
    return typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
  } catch (err) {
    console.warn('[CloudKV] Gagal memuat state dari Cloud KV:', err.message);
    return null;
  }
}

async function cloudKvSetState(stateObj) {
  if (!HAS_CLOUD_KV || !stateObj) return false;
  try {
    const res = await fetch(CLOUD_KV_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CLOUD_KV_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(['SET', CLOUD_KV_STATE_KEY, JSON.stringify(stateObj)])
    });
    return res.ok;
  } catch (err) {
    console.warn('[CloudKV] Gagal menyimpan state ke Cloud KV:', err.message);
    return false;
  }
}
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const revokedTokens = new Set();

const SECURITY_CSP_POLICY = "default-src 'self'; script-src 'self' 'unsafe-inline' https://unpkg.com/leaflet@1.9.4/dist/leaflet.js https://vercel.live; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com/leaflet@1.9.4/dist/leaflet.css; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://*.tile.openstreetmap.org https://unpkg.com; connect-src 'self' https://router.project-osrm.org https://*.tile.openstreetmap.org https://fonts.googleapis.com https://fonts.gstatic.com https://unpkg.com https://vercel.live; worker-src 'self'; manifest-src 'self'; object-src 'none'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests";
const SECURITY_PERMISSIONS_POLICY = 'camera=(self), geolocation=(self), microphone=(), payment=(), usb=(), interest-cohort=()';
const SECURITY_HSTS_POLICY = 'max-age=63072000; includeSubDomains; preload';

function buildBaseSecurityHeaders(extraHeaders) {
  return Object.assign({
    'Strict-Transport-Security': SECURITY_HSTS_POLICY,
    'Content-Security-Policy': SECURITY_CSP_POLICY,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': SECURITY_PERMISSIONS_POLICY,
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'X-DNS-Prefetch-Control': 'off'
  }, extraHeaders || {});
}

function isHttpsRequest(req) {
  if (process.env.VERCEL === '1' || process.env.VERCEL === 'true') return true;
  const h = (req && req.headers) || {};
  const proto = String(h['x-forwarded-proto'] || h['X-Forwarded-Proto'] || '').toLowerCase();
  if (proto.includes('https')) return true;
  if (req && req.socket && req.socket.encrypted) return true;
  return false;
}

function buildSessionCookieHeader(tokenValue, maxAgeSec, req) {
  const secureAttr = isHttpsRequest(req) ? '; Secure' : '';
  return `arba_session=${tokenValue}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSec}${secureAttr}`;
}

function hashTokenForRevocation(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function isTokenRevoked(token) {
  if (!token) return true;
  if (revokedTokens.has(token)) return true;
  try {
    const tokenHash = hashTokenForRevocation(token);
    const row = db.prepare('SELECT exp_ms FROM revoked_tokens WHERE token_hash = ?').get(tokenHash);
    if (row) {
      if (row.exp_ms > Date.now()) {
        revokedTokens.add(token);
        return true;
      }
      db.prepare('DELETE FROM revoked_tokens WHERE token_hash = ?').run(tokenHash);
    }
  } catch (e) {
    // Table may not be initialized yet during early boot
  }
  return false;
}

function revokeSessionToken(token) {
  if (!token || typeof token !== 'string') return;
  revokedTokens.add(token);
  try {
    let expMs = Date.now() + SESSION_TTL_MS;
    const parts = token.split('.');
    if (parts.length === 2) {
      const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      if (payload && payload.exp) expMs = Number(payload.exp) || expMs;
    }
    const tokenHash = hashTokenForRevocation(token);
    db.prepare('INSERT OR REPLACE INTO revoked_tokens (token_hash, exp_ms) VALUES (?, ?)').run(tokenHash, expMs);
  } catch (e) {
    // Ignore malformed token payload on logout
  }
}

function getUserPasswordTag(user) {
  if (!user) return '';
  const pwHash = user.passwordHash || hashCredential(user.password || '123');
  return String(pwHash).slice(7, 23);
}

function issueSessionToken(user) {
  const payloadObj = {
    sub: user.id,
    username: user.username,
    role: user.role,
    pwdTag: getUserPasswordTag(user),
    iat: Date.now(),
    exp: Date.now() + SESSION_TTL_MS,
    jti: crypto.randomBytes(12).toString('hex')
  };
  const payloadB64 = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SERVER_AUTH_SECRET).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || isTokenRevoked(token)) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SERVER_AUTH_SECRET).update(payloadB64).digest('base64url');
  if (sig.length !== expectedSig.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expectedSig, 'utf8'))) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!payload || !payload.sub || !payload.exp || Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}

function parseCookies(req) {
  const list = {};
  const cookieHeader = req.headers && req.headers.cookie;
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const idx = cookie.indexOf('=');
    if (idx > 0) {
      const key = cookie.slice(0, idx).trim();
      const val = cookie.slice(idx + 1).trim();
      list[key] = decodeURIComponent(val);
    }
  });
  return list;
}

function extractRequestToken(req, parsedUrl) {
  const h = (req && req.headers) || {};
  const authHeader = h.authorization || h.Authorization || h['x-arba-token'] || h['X-Arba-Token'];
  if (authHeader && typeof authHeader === 'string') {
    if (authHeader.toLowerCase().startsWith('bearer ')) {
      return authHeader.slice(7).trim();
    }
    return authHeader.trim();
  }
  const cookies = parseCookies(req);
  if (cookies.arba_session) return cookies.arba_session;
  if (parsedUrl && parsedUrl.searchParams && parsedUrl.searchParams.get('token')) {
    return parsedUrl.searchParams.get('token');
  }
  return null;
}

function sanitizeHexColor(c, fallback = '#005c55') {
  if (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c.trim())) {
    return c.trim();
  }
  return fallback;
}

function sanitizeUserRecord(u) {
  if (!u || typeof u !== 'object') return u;
  const copy = Object.assign({}, u);
  const pwHash = copy.passwordHash || (copy.password ? hashCredential(copy.password) : undefined);
  const pnHash = copy.pinHash || (copy.pin ? hashCredential(copy.pin) : undefined);
  delete copy.password;
  delete copy.pin;
  if (pwHash) copy.passwordHash = pwHash;
  if (pnHash) copy.pinHash = pnHash;
  copy.badgeColor = sanitizeHexColor(copy.badgeColor, '#005c55');
  return copy;
}

function sanitizeUserForPublicList(u) {
  const copy = sanitizeUserRecord(u);
  delete copy.passwordHash;
  delete copy.pinHash;
  return copy;
}

function sanitizeStateForClient(state, callerUser) {
  if (!state || typeof state !== 'object') return state;
  const copy = Object.assign({}, state);
  const callerId = callerUser && callerUser.id ? String(callerUser.id) : null;
  if (Array.isArray(copy.users)) {
    copy.users = copy.users.map((u) => {
      const clean = sanitizeUserRecord(u);
      // Hanya sertakan passwordHash & pinHash milik user yang sedang login (agar offline PIN/password check miliknya tetap berfungsi tanpa membocorkan hash milik Super Admin / user lain)
      if (!callerId || clean.id !== callerId) {
        delete clean.passwordHash;
        delete clean.pinHash;
      }
      return clean;
    });
  }
  return copy;
}

function getClientIp(req) {
  const h = (req && req.headers) || {};
  const isVercelEnv = process.env.VERCEL === '1' || process.env.VERCEL === 'true';
  const isExplicitTrustProxy = process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true';
  const isCloudflareTrusted = process.env.TRUST_CLOUDFLARE === '1' || process.env.TRUST_CLOUDFLARE === 'true';

  if (isVercelEnv || isExplicitTrustProxy) {
    if (isCloudflareTrusted && h['cf-connecting-ip']) {
      return String(h['cf-connecting-ip']).trim();
    }
    const vercelFwd = h['x-vercel-forwarded-for'] || h['X-Vercel-Forwarded-For'];
    if (vercelFwd) return String(vercelFwd).split(',')[0].trim();
    const realIp = h['x-real-ip'] || h['X-Real-Ip'];
    if (realIp) return String(realIp).trim();
    const xff = h['x-forwarded-for'] || h['X-Forwarded-For'];
    if (xff) return String(xff).split(',')[0].trim();
  }
  return (req && req.socket && req.socket.remoteAddress) || 'local';
}

// Rate limiter anti brute-force login (per IP+akun dan per akun global)
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const MAX_ACCOUNT_ATTEMPTS = 10;
const LOCKOUT_MS = 30 * 1000;

function pruneSecurityCaches() {
  const now = Date.now();
  for (const [k, v] of loginAttempts.entries()) {
    if (!v || (now - (v.lastAttempt || 0)) > LOCKOUT_MS * 4) {
      loginAttempts.delete(k);
    }
  }
  for (const tok of revokedTokens) {
    const parts = String(tok).split('.');
    if (parts.length !== 2) {
      revokedTokens.delete(tok);
      continue;
    }
    try {
      const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      if (!payload || !payload.exp || now > payload.exp) {
        revokedTokens.delete(tok);
      }
    } catch (e) {
      revokedTokens.delete(tok);
    }
  }
  try {
    db.prepare('DELETE FROM revoked_tokens WHERE exp_ms <= ?').run(now);
  } catch (e) {
    // Ignore if table not ready
  }
}

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT_DIR = path.resolve(__dirname, '..');

function resolveWritableDbDir() {
  const preferredDir = path.join(ROOT_DIR, 'database');
  if (!IS_SERVERLESS_RUNTIME) {
    try {
      if (!fs.existsSync(preferredDir)) {
        fs.mkdirSync(preferredDir, { recursive: true });
      }
      fs.accessSync(preferredDir, fs.constants.W_OK);
      return preferredDir;
    } catch (e) {
      // Fall back to os.tmpdir() if preferred directory is read-only
    }
  }
  const tmpDbDir = path.join(os.tmpdir(), 'arbaconnect-db');
  if (!fs.existsSync(tmpDbDir)) {
    fs.mkdirSync(tmpDbDir, { recursive: true });
  }
  return tmpDbDir;
}

const DB_DIR = resolveWritableDbDir();
const DB_FILE = path.join(DB_DIR, 'arbaconnect.sqlite');

// -----------------------------------------------------------------------------
// 1. Muat Master Data Awal dari `js/data.js` untuk Seeding Database Pusat
// -----------------------------------------------------------------------------
function loadInitialMasterData() {
  const dataJsPath = path.join(ROOT_DIR, 'js', 'data.js');
  const code = fs.readFileSync(dataJsPath, 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return JSON.parse(JSON.stringify(sandbox.window.ArbaData));
}

// -----------------------------------------------------------------------------
// 2. Inisialisasi Skema SQL Relasional (10 Entitas `database/schema.sql` + Log Sync)
// -----------------------------------------------------------------------------
let db;
try {
  if (DatabaseSync) {
    db = new DatabaseSync(DB_FILE);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
  } else {
    db = createInMemoryFallbackDb();
  }
} catch (dbInitErr) {
  db = createInMemoryFallbackDb();
}

function initRelationalSchema() {
  // Migrasi otomatis tabel users bila skema lama belum mendukung peran 'super_admin'
  const existingUsersTable = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();
  if (existingUsersTable && existingUsersTable.sql && !existingUsersTable.sql.includes('super_admin')) {
    db.exec('PRAGMA foreign_keys = OFF;');
    db.exec('DROP TABLE IF EXISTS users;');
    db.exec('PRAGMA foreign_keys = ON;');
  }

  db.exec(`
    -- 1. Tabel Pengguna & Hak Akses Per Peran (RBAC) termasuk Super Admin
    CREATE TABLE IF NOT EXISTS users (
      id              TEXT PRIMARY KEY,
      username        TEXT UNIQUE,
      nama            TEXT NOT NULL,
      email           TEXT UNIQUE NOT NULL,
      password_hash   TEXT NOT NULL DEFAULT '123',
      pin_offline     TEXT DEFAULT '123456',
      no_telp         TEXT,
      jabatan         TEXT,
      divisi          TEXT,
      peran           TEXT NOT NULL CHECK (peran IN ('super_admin', 'sales', 'admin_gudang', 'admin_penjualan', 'direktur')),
      aktif           INTEGER NOT NULL DEFAULT 1,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 2. Tabel Pelanggan B2B (Apotek & Minimarket)
    CREATE TABLE IF NOT EXISTS outlets (
      id              TEXT PRIMARY KEY,
      sales_id        TEXT REFERENCES users(id),
      kode            TEXT UNIQUE NOT NULL,
      nama            TEXT NOT NULL,
      jenis           TEXT NOT NULL,
      alamat          TEXT NOT NULL,
      kota            TEXT NOT NULL,
      lat             REAL,
      lng             REAL,
      kontak_nama     TEXT,
      kontak_telp     TEXT,
      termin_hari     INTEGER NOT NULL DEFAULT 30,
      limit_kredit    INTEGER NOT NULL DEFAULT 10000000,
      kredit_terpakai INTEGER NOT NULL DEFAULT 0,
      status          TEXT NOT NULL DEFAULT 'Lancar',
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 3. Tabel Target Capaian Sales Bulanan & Harian
    CREATE TABLE IF NOT EXISTS sales_targets (
      id                  TEXT PRIMARY KEY,
      sales_id            TEXT NOT NULL REFERENCES users(id),
      periode             TEXT NOT NULL,
      target_nilai        INTEGER NOT NULL DEFAULT 50000000,
      target_kunjungan    INTEGER NOT NULL DEFAULT 120,
      UNIQUE (sales_id, periode)
    );

    -- 4. Tabel Kunjungan Lapangan / Canvassing (Check-in GPS)
    CREATE TABLE IF NOT EXISTS visits (
      id              TEXT PRIMARY KEY,
      outlet_id       TEXT NOT NULL,
      sales_id        TEXT,
      sales_nama      TEXT,
      checkin_at      TEXT NOT NULL DEFAULT (datetime('now')),
      lat             REAL,
      lng             REAL,
      jarak_meter     INTEGER,
      hasil           TEXT NOT NULL,
      catatan         TEXT
    );

    -- 5. Tabel Master Produk Herbal & Parameter ROP
    CREATE TABLE IF NOT EXISTS products (
      id                  TEXT PRIMARY KEY,
      sku                 TEXT UNIQUE NOT NULL,
      nama                TEXT NOT NULL,
      kategori            TEXT NOT NULL,
      satuan              TEXT NOT NULL DEFAULT 'Botol',
      harga               INTEGER NOT NULL,
      stok_minimum        INTEGER NOT NULL DEFAULT 50,
      titik_pesan_ulang   INTEGER NOT NULL DEFAULT 120,
      stok_total          INTEGER NOT NULL DEFAULT 0,
      aktif               INTEGER NOT NULL DEFAULT 1
    );

    -- 6. Tabel Batch Produk & Kedaluwarsa (FEFO - First-Expired, First-Out)
    CREATE TABLE IF NOT EXISTS product_batches (
      id              TEXT PRIMARY KEY,
      product_id      TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      no_batch        TEXT NOT NULL,
      tgl_kedaluwarsa TEXT NOT NULL,
      stok_batch      INTEGER NOT NULL DEFAULT 0 CHECK (stok_batch >= 0),
      UNIQUE (product_id, no_batch)
    );

    -- 7. Tabel Pesanan B2B (Idempotent Offline-First via client_uuid)
    CREATE TABLE IF NOT EXISTS orders (
      id              TEXT PRIMARY KEY,
      client_uuid     TEXT UNIQUE NOT NULL,
      outlet_id       TEXT NOT NULL,
      sales_id        TEXT,
      sales_nama      TEXT,
      visit_id        TEXT,
      tanggal         TEXT NOT NULL DEFAULT (datetime('now')),
      jatuh_tempo     TEXT,
      termin          TEXT NOT NULL DEFAULT 'Net 30 Hari',
      status          TEXT NOT NULL,
      sync_status     TEXT NOT NULL DEFAULT 'SYNCED_DEDUCTED',
      total           INTEGER NOT NULL DEFAULT 0
    );

    -- 8. Tabel Rincian Item Pesanan
    CREATE TABLE IF NOT EXISTS order_items (
      id              TEXT PRIMARY KEY,
      order_id        TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_sku     TEXT NOT NULL,
      no_batch        TEXT,
      qty             INTEGER NOT NULL CHECK (qty > 0),
      harga_satuan    INTEGER NOT NULL,
      subtotal        INTEGER NOT NULL
    );

    -- 9. Tabel Buku Besar Stok Imutabel (Stock Ledger)
    CREATE TABLE IF NOT EXISTS stock_ledger (
      id              TEXT PRIMARY KEY,
      product_sku     TEXT NOT NULL,
      no_batch        TEXT,
      order_ref       TEXT,
      tipe            TEXT NOT NULL,
      qty             INTEGER NOT NULL,
      saldo_setelah   INTEGER NOT NULL,
      dibuat_oleh     TEXT,
      checksum_hash   TEXT NOT NULL,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 10. Tabel Peringatan Stok Menipis (Low-Stock & Near-Expiry Alerts)
    CREATE TABLE IF NOT EXISTS alerts (
      id              TEXT PRIMARY KEY,
      product_sku     TEXT NOT NULL,
      saldo           INTEGER NOT NULL,
      ambang          INTEGER NOT NULL,
      status          TEXT NOT NULL DEFAULT 'baru',
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 11. Tabel Log Idempotensi Mutasi Offline-First (Mencegah Eksekusi Ganda)
    CREATE TABLE IF NOT EXISTS sync_mutations_log (
      mutation_id     TEXT PRIMARY KEY,
      client_id       TEXT NOT NULL,
      mutation_type   TEXT NOT NULL,
      summary         TEXT,
      payload_json    TEXT,
      synced_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 12. Snapshot State Dokumen Lengkap ERP (Menjaga Paritas 100% dengan UI)
    CREATE TABLE IF NOT EXISTS erp_central_state (
      id              TEXT PRIMARY KEY,
      state_json      TEXT NOT NULL,
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 13. Tabel Persistensi Revokasi Token Sesi (Tetap Valid Meski Server Restart)
    CREATE TABLE IF NOT EXISTS revoked_tokens (
      token_hash      TEXT PRIMARY KEY,
      exp_ms          INTEGER NOT NULL,
      revoked_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 14. Tabel Audit Log Terpisah (Pelacakan Siklus Hidup Barang & Jejak Audit CDOB/BPOM)
    CREATE TABLE IF NOT EXISTS audit_logs (
      id              TEXT PRIMARY KEY,
      action          TEXT NOT NULL,
      actor           TEXT NOT NULL,
      actor_role      TEXT NOT NULL,
      outlet_id       TEXT,
      outlet_name     TEXT,
      product_sku     TEXT,
      product_name    TEXT,
      no_batch        TEXT,
      qty             INTEGER,
      doc_ref         TEXT,
      details         TEXT,
      checksum_hash   TEXT NOT NULL,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// -----------------------------------------------------------------------------
// 3. Sinkronisasi Data ke 10 Tabel Relasional SQL (`schema.sql`)
// -----------------------------------------------------------------------------
function syncStateToRelationalTables(state) {
  db.exec('DELETE FROM order_items;');
  db.exec('DELETE FROM orders;');
  db.exec('DELETE FROM stock_ledger;');
  db.exec('DELETE FROM alerts;');
  db.exec('DELETE FROM visits;');
  db.exec('DELETE FROM product_batches;');
  db.exec('DELETE FROM products;');
  db.exec('DELETE FROM outlets;');
  db.exec('DELETE FROM sales_targets;');
  db.exec('DELETE FROM users;');

  // 1. Users & 3. Sales Targets
  const insUser = db.prepare(`
    INSERT OR REPLACE INTO users (id, username, nama, email, password_hash, pin_offline, no_telp, jabatan, divisi, peran, aktif)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insTarget = db.prepare(`INSERT OR REPLACE INTO sales_targets (id, sales_id, periode, target_nilai, target_kunjungan) VALUES (?, ?, '2026-11', ?, ?)`);

  const usersList = Array.isArray(state.users) && state.users.length > 0
    ? state.users
    : (loadInitialMasterData().users || []);

  usersList.forEach((u) => {
    const sqlRole = u.sqlRole || (
      u.role === 'super-admin' ? 'super_admin' :
      u.role === 'executive' ? 'direktur' :
      u.role === 'inventory' ? 'admin_gudang' :
      u.role === 'sales-ops' ? 'admin_penjualan' : 'sales'
    );
    insUser.run(
      u.id,
      u.username || u.id.toLowerCase(),
      u.name,
      u.email,
      hashCredential(u.passwordHash || u.password || '123'),
      hashCredential(u.pinHash || u.pin || '123456'),
      u.phone || '-',
      u.title || '-',
      u.division || '-',
      sqlRole,
      u.active === false ? 0 : 1
    );
  });

  (state.salesTeam || []).forEach((rep, i) => {
    const uid = rep.id || `REP-SR-0${i + 1}`;
    const alreadyInUsers = usersList.some((u) => u.id === uid);
    if (!alreadyInUsers) {
      const email = `${rep.name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@arbain.co.id`;
      insUser.run(uid, uid.toLowerCase(), rep.name, email, hashCredential('123'), hashCredential('123456'), '-', 'Sales Rep', rep.division || 'Sales', 'sales', 1);
    }
    insTarget.run(`TGT-${uid}-202611`, uid, rep.monthlyRevenueTarget || 50000000, (rep.dailyVisitTarget || 6) * 25);
  });

  // 2. Outlets
  const insOutlet = db.prepare(`
    INSERT OR REPLACE INTO outlets (
      id, sales_id, kode, nama, jenis, alamat, kota, lat, lng, kontak_nama, kontak_telp,
      termin_hari, limit_kredit, kredit_terpakai, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const defaultCoords = {
    'AP-SLO-001': { lat: -7.5682, lng: 110.8091 },
    'AP-SLO-002': { lat: -7.5588, lng: 110.8562 },
    'MM-SKH-014': { lat: -7.6819, lng: 110.8408 },
    'MM-SLO-009': { lat: -7.5812, lng: 110.8279 },
    'AP-KRA-023': { lat: -7.5965, lng: 110.9461 },
    'AP-KRA-004': { lat: -7.5684, lng: 110.8753 },
    'AP-BYL-008': { lat: -7.5305, lng: 110.5964 },
    'MM-BYL-003': { lat: -7.5358, lng: 110.6022 },
    'MM-KLT-005': { lat: -7.7056, lng: 110.6015 },
    'AP-SRG-019': { lat: -7.4272, lng: 111.0221 },
    'AP-KRA-078': { lat: -7.5931, lng: 110.9384 }
  };
  (state.outlets || []).forEach((o) => {
    const rep = (state.salesTeam || []).find((s) => s.name === o.salesRep);
    const jenis = /minimarket|swalayan|toserba/i.test(o.type || '')
      ? 'minimarket'
      : (/jaringan|kimia farma|k-24/i.test(o.type || '') ? 'jaringan_farmasi' : 'apotek');
    const fallback = defaultCoords[o.id] || defaultCoords[o.code] || { lat: -7.5682, lng: 110.8091 };
    const lat = typeof o.lat === 'number' ? o.lat : fallback.lat;
    const lng = typeof o.lng === 'number' ? o.lng : fallback.lng;
    insOutlet.run(
      o.id,
      rep ? rep.id : null,
      o.code || o.id,
      o.name,
      jenis,
      o.address || 'Solo Raya',
      o.cityName || o.city || 'Surakarta',
      lat,
      lng,
      o.picName || '-',
      o.picPhone || '-',
      /14/.test(o.terms || '') ? 14 : (/COD|Tunai/i.test(o.terms || '') ? 0 : 30),
      o.creditLimit || 10000000,
      o.creditUsed || 0,
      o.creditStatus || 'Lancar'
    );
  });

  // 5. Products, 6. Product Batches & 10. Alerts
  const insProd = db.prepare(`
    INSERT OR REPLACE INTO products (
      id, sku, nama, kategori, satuan, harga, stok_minimum, titik_pesan_ulang, stok_total, aktif
    ) VALUES (?, ?, ?, ?, 'Botol', ?, ?, ?, ?, 1)
  `);
  const insBatch = db.prepare(`
    INSERT OR REPLACE INTO product_batches (id, product_id, no_batch, tgl_kedaluwarsa, stok_batch)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insAlert = db.prepare(`
    INSERT OR REPLACE INTO alerts (id, product_sku, saldo, ambang, status)
    VALUES (?, ?, ?, ?, 'baru')
  `);

  (state.products || []).forEach((p) => {
    const pid = `PROD-${p.sku}`;
    insProd.run(pid, p.sku, p.name, p.category || 'Herbal', p.unitPrice || 0, p.safetyStock || 50, p.rop || 100, Math.max(0, p.stock || 0));
    insBatch.run(`BATCH-${p.sku}-${p.activeBatch}`, pid, p.activeBatch || 'BATCH-DEFAULT', p.fefoDate || '2027-12-31', Math.max(0, p.stock || 0));
    if ((p.stock || 0) <= (p.rop || 0)) {
      insAlert.run(`ALRT-${p.sku}`, p.sku, p.stock || 0, p.rop || 0);
    }
  });

  // 4. Visits
  const insVisit = db.prepare(`
    INSERT OR REPLACE INTO visits (id, outlet_id, sales_id, sales_nama, checkin_at, jarak_meter, hasil, catatan)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  (state.visitLogs || []).forEach((v) => {
    const rep = (state.salesTeam || []).find((s) => s.name === v.salesRep);
    insVisit.run(
      v.id,
      v.outletId || 'AP-SLO-001',
      rep ? rep.id : null,
      v.salesRep || 'Budi Santoso',
      new Date(v.timestamp || Date.now()).toISOString(),
      v.gpsDistance || 10,
      v.outcome || 'FOLLOW_UP',
      v.notes || ''
    );
  });

  // 7. Orders & 8. Order Items
  const insOrder = db.prepare(`
    INSERT OR REPLACE INTO orders (id, client_uuid, outlet_id, sales_id, sales_nama, termin, status, sync_status, total)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insOrderItem = db.prepare(`
    INSERT OR REPLACE INTO order_items (id, order_id, product_sku, no_batch, qty, harga_satuan, subtotal)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  (state.orders || []).forEach((ord) => {
    insOrder.run(
      ord.id,
      ord.clientUuid || ord.id,
      ord.outletId || 'AP-SLO-001',
      ord.salesRepId || null,
      ord.salesRep || 'Budi Santoso',
      ord.terms || 'Net 30 Hari',
      ord.status || 'PENDING',
      ord.syncStatus || 'SYNCED_DEDUCTED',
      ord.totalAmount || 0
    );
    (ord.items || []).forEach((it, idx) => {
      insOrderItem.run(
        `${ord.id}-ITM-${idx + 1}`,
        ord.id,
        it.sku || it.name,
        it.batch || '',
        Math.max(1, it.quantity || 1),
        it.unitPrice || 0,
        it.subtotal || 0
      );
    });
  });

  // 9. Stock Ledger
  const insLedger = db.prepare(`
    INSERT OR REPLACE INTO stock_ledger (id, product_sku, no_batch, order_ref, tipe, qty, saldo_setelah, dibuat_oleh, checksum_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  (state.ledger || []).forEach((l) => {
    insLedger.run(
      l.id,
      l.skuCode || l.skuName,
      l.batch || '-',
      l.docRef || '-',
      (l.type || 'KELUAR').toLowerCase(),
      l.quantity || 0,
      l.finalStock || 0,
      l.operator || 'Sistem',
      l.hash || '0000...0000',
      l.timestamp || new Date().toISOString()
    );
  });

  // 14. Audit Logs Terpisah (Pelacakan Jejak Barang & Aksi User)
  db.exec('DELETE FROM audit_logs;');
  const insAudit = db.prepare(`
    INSERT OR REPLACE INTO audit_logs (
      id, action, actor, actor_role, outlet_id, outlet_name,
      product_sku, product_name, no_batch, qty, doc_ref, details, checksum_hash, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  (state.auditLogs || []).slice(0, 500).forEach((al) => {
    insAudit.run(
      al.id,
      al.action || 'SYSTEM_EVENT',
      al.actor || 'Sistem',
      al.actorRole || '-',
      al.outletId || null,
      al.outletName || null,
      al.sku || null,
      al.productName || null,
      al.batch || null,
      al.qty !== undefined && al.qty !== null ? Number(al.qty) : null,
      al.docRef || null,
      al.details || '',
      al.checksum || '0000...0000',
      al.isoTime || al.timestamp || new Date().toISOString()
    );
  });
}

function buildInitialAuditLogs(master) {
  const logs = [];
  (master.ledger || []).slice(0, 12).forEach((l, idx) => {
    const actionMap = {
      MASUK: 'INBOUND_BATCH',
      KELUAR: 'ORDER_DISPATCHED',
      PENYESUAIAN: 'ADJUST_STOCK',
      RETUR: 'ORDER_RETURN'
    };
    logs.push({
      id: `AUD-INIT-${String(idx + 1).padStart(3, '0')}`,
      timestamp: l.timestamp || nowStamp(),
      isoTime: new Date(Date.now() - (idx + 1) * 3600000).toISOString(),
      action: actionMap[l.type] || 'STOCK_EVENT',
      actor: l.operator || 'Sistem',
      actorRole: l.operatorRole || 'Operasional Gudang',
      outletId: null,
      outletName: null,
      sku: l.skuCode || null,
      productName: l.skuName || null,
      batch: l.batch || null,
      qty: l.quantity || 0,
      docRef: l.docRef || l.id,
      details: `Mutasi ${l.type} ${l.quantity > 0 ? '+' : ''}${l.quantity} unit (Saldo akhir: ${l.finalStock})`,
      checksum: l.hash || pseudoHash(l.id)
    });
  });
  (master.orders || []).slice(0, 8).forEach((ord, idx) => {
    const firstItem = (ord.items && ord.items[0]) || {};
    logs.push({
      id: `AUD-ORD-${String(idx + 1).padStart(3, '0')}`,
      timestamp: ord.orderTime || nowStamp(),
      isoTime: new Date(ord.orderTimestamp || (Date.now() - (idx + 2) * 5400000)).toISOString(),
      action: ord.status === 'APPROVED' ? 'ORDER_APPROVED' : (ord.status === 'REJECTED' ? 'ORDER_REJECTED' : 'ORDER_CREATED'),
      actor: ord.salesRep || 'Sales Lapangan',
      actorRole: `Field Sales ${ord.salesRepId || ''}`.trim(),
      outletId: ord.outletId || null,
      outletName: ord.outletName || null,
      sku: firstItem.sku || null,
      productName: firstItem.name || `${(ord.items || []).length} SKU`,
      batch: firstItem.batch ? String(firstItem.batch).replace('Batch: ', '') : null,
      qty: (ord.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0),
      docRef: ord.clientUuid || ord.id,
      details: `Pesanan ${ord.outletName} (${(ord.items || []).length} SKU, status: ${ord.status})`,
      checksum: pseudoHash((ord.clientUuid || ord.id) + idx)
    });
  });
  return logs;
}

function getCentralState() {
  const master = loadInitialMasterData();
  const row = db.prepare(`SELECT state_json FROM erp_central_state WHERE id = 'main'`).get();
  if (row && row.state_json) {
    const parsed = JSON.parse(row.state_json);
    let needsSave = false;
    // Pastikan daftar users dan Super Admin selalu tersedia dan kredensial telah ter-hash
    if (!Array.isArray(parsed.users) || parsed.users.length === 0) {
      parsed.users = (master.users || []).map((u) => sanitizeUserRecord(u));
      needsSave = true;
    } else {
      if (!parsed.users.some((u) => u.role === 'super-admin')) {
        const superAdmin = (master.users || []).find((u) => u.role === 'super-admin');
        if (superAdmin) {
          parsed.users = [sanitizeUserRecord(superAdmin), ...parsed.users];
          needsSave = true;
        }
      }
      if (parsed.users.some((u) => u.password !== undefined || u.pin !== undefined)) {
        parsed.users = parsed.users.map((u) => sanitizeUserRecord(u));
        needsSave = true;
      }
    }
    // Backfill otomatis atribut regulasi CDOB (NIE BPOM, Halal BPJPH, Suhu, SIA/SIPA) & FEFO dinamis pada state lama
    if (Array.isArray(parsed.products) && Array.isArray(master.products)) {
      const masterProdMap = new Map(master.products.map((mp) => [mp.sku, mp]));
      parsed.products.forEach((p) => {
        const mp = masterProdMap.get(p.sku);
        if (!mp) return;
        if (!p.nieBpom && mp.nieBpom) { p.nieBpom = mp.nieBpom; needsSave = true; }
        if (!p.noHalal && mp.noHalal) { p.noHalal = mp.noHalal; needsSave = true; }
        if (!p.storageTemp && mp.storageTemp) { p.storageTemp = mp.storageTemp; needsSave = true; }
        if (!p.fefoIsoDate && mp.fefoIsoDate) {
          p.fefoDate = mp.fefoDate;
          p.fefoIsoDate = mp.fefoIsoDate;
          p.fefoDaysLeft = mp.fefoDaysLeft;
          p.fefoStatus = mp.fefoStatus;
          needsSave = true;
        }
      });
    }
    if (Array.isArray(parsed.outlets) && Array.isArray(master.outlets)) {
      const masterOutMap = new Map(master.outlets.map((mo) => [mo.id, mo]));
      parsed.outlets.forEach((o) => {
        const mo = masterOutMap.get(o.id);
        if (!mo) return;
        if (!o.noSia && mo.noSia) { o.noSia = mo.noSia; needsSave = true; }
        if (!o.noSipa && mo.noSipa) { o.noSipa = mo.noSipa; needsSave = true; }
        if (!o.sipaExpiry && mo.sipaExpiry) { o.sipaExpiry = mo.sipaExpiry; needsSave = true; }
        if (!o.sipaStatus && mo.sipaStatus) { o.sipaStatus = mo.sipaStatus; needsSave = true; }
      });
    }
    if (!Array.isArray(parsed.auditLogs)) {
      parsed.auditLogs = buildInitialAuditLogs(master);
      needsSave = true;
    }
    if (!parsed.stateVersion) {
      parsed.stateVersion = 1;
      needsSave = true;
    }
    if (needsSave) saveCentralState(parsed);
    return parsed;
  }
  const initialState = {
    stateVersion: 1,
    users: (master.users || []).map((u) => sanitizeUserRecord(u)),
    products: master.products,
    ledger: master.ledger,
    auditLogs: buildInitialAuditLogs(master),
    outlets: master.outlets,
    orders: master.orders,
    supplierPOs: master.supplierPOs,
    salesVisits: master.salesVisits,
    driverManifests: master.driverManifests,
    salesTeam: master.salesTeam,
    salesLoadings: master.salesLoadings,
    visitLogs: master.visitLogs
  };
  saveCentralState(initialState);
  return initialState;
}

function saveCentralState(state, bumpVersion) {
  if (bumpVersion) {
    state.stateVersion = Math.max(Date.now(), (Number(state.stateVersion) || 0) + 1);
  } else if (!state.stateVersion) {
    state.stateVersion = 1;
  }
  const upsert = db.prepare(`
    INSERT INTO erp_central_state (id, state_json, updated_at)
    VALUES ('main', ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET state_json = excluded.state_json, updated_at = datetime('now')
  `);
  upsert.run(JSON.stringify(state));
  syncStateToRelationalTables(state);
}

async function ensureCloudKvHydrated() {
  if (!HAS_CLOUD_KV) return;
  const remote = await cloudKvGetState();
  if (!remote || typeof remote !== 'object') return;
  const local = getCentralState();
  const remoteVer = Number(remote.stateVersion) || 0;
  const localVer = Number(local.stateVersion) || 0;
  if (remoteVer > localVer) {
    saveCentralState(remote, false);
  }
}

async function persistCentralStateEverywhere(state) {
  saveCentralState(state, true);
  if (HAS_CLOUD_KV) {
    await cloudKvSetState(state);
  }
}

// Inisialisasi database saat server menyala
initRelationalSchema();
getCentralState();

// -----------------------------------------------------------------------------
// 4. Mesin Pemroses Bisnis & Mutasi Stok FEFO di Server Pusat
// -----------------------------------------------------------------------------
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
  let h = 0x811c9dc5;
  const s = String(seed) + Date.now() + Math.random();
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const hex = h.toString(16).padStart(8, '0');
  return `${hex.slice(0, 4)}...${hex.slice(4, 8)}`;
}
function normalizeSku(sku) {
  return String(sku || '').toUpperCase().replace(/SKU-|ARB-|-/g, '');
}
function findProduct(state, sku, name) {
  const nSku = normalizeSku(sku);
  return state.products.find((p) => p.sku === sku || normalizeSku(p.sku) === nSku) ||
    (name ? state.products.find((p) =>
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
function findOutlet(state, idOrCode) {
  return state.outlets.find((o) => o.id === idOrCode || o.code === idOrCode);
}
function checkStockAvailability(state, items) {
  const shortages = [];
  (items || []).forEach((item) => {
    const prod = findProduct(state, item.sku, item.name);
    if (!prod) return;
    if (prod.stock < item.quantity) {
      shortages.push({ sku: prod.sku, name: prod.name, requested: item.quantity, available: prod.stock, shortBy: item.quantity - prod.stock });
    }
  });
  return shortages;
}
function deductOrderStock(state, order) {
  const rows = [];
  (order.items || []).forEach((item) => {
    const prod = findProduct(state, item.sku, item.name);
    if (!prod) return;
    prod.stock = Math.max(0, prod.stock - item.quantity);
    prod.status = computeProductStatus(prod);
    rows.push({
      id: `LEDG-${Math.floor(10000 + Math.random() * 90000)}`,
      timestamp: nowStamp(),
      docRef: order.clientUuid || order.id,
      skuName: prod.name,
      skuCode: prod.sku,
      batch: String(item.batch || prod.activeBatch).replace('Batch: ', ''),
      type: 'KELUAR',
      quantity: -item.quantity,
      finalStock: prod.stock,
      operator: order.salesRep,
      operatorRole: `Field Sales ${order.salesRepId || ''}`.trim(),
      hash: pseudoHash((order.clientUuid || order.id) + prod.sku)
    });
  });
  state.ledger = [...rows, ...state.ledger];
  order.stockDeducted = true;
  order.syncStatus = 'SYNCED_DEDUCTED';
  order.stockWarning = undefined;
}
function restoreOrderStock(state, order, reason) {
  const rows = [];
  (order.items || []).forEach((item) => {
    const prod = findProduct(state, item.sku, item.name);
    if (!prod) return;
    prod.stock += item.quantity;
    prod.status = computeProductStatus(prod);
    rows.push({
      id: `LEDG-${Math.floor(10000 + Math.random() * 90000)}`,
      timestamp: nowStamp(),
      docRef: order.clientUuid || order.id,
      skuName: prod.name,
      skuCode: prod.sku,
      batch: String(item.batch || prod.activeBatch).replace('Batch: ', ''),
      type: 'RETUR',
      quantity: item.quantity,
      finalStock: prod.stock,
      operator: 'Admin Penjualan',
      operatorRole: `Pembatalan: ${reason || 'Order ditolak'}`,
      hash: pseudoHash((order.clientUuid || order.id) + prod.sku + 'R')
    });
  });
  state.ledger = [...rows, ...state.ledger];
  order.stockDeducted = false;
}
function applyOutletCredit(state, order, sign) {
  const outlet = findOutlet(state, order.outletId);
  if (!outlet || !isCreditTerm(order.terms)) return;
  outlet.creditUsed = Math.max(0, (outlet.creditUsed || 0) + sign * order.totalAmount);
  outlet.creditRemaining = Math.max(0, outlet.creditLimit - outlet.creditUsed);
  const ratio = outlet.creditLimit ? outlet.creditUsed / outlet.creditLimit : 0;
  if (outlet.creditStatus !== 'Overdue') {
    outlet.creditStatus = ratio >= 0.9 ? 'Perhatian' : 'Lancar';
  }
  order.creditApplied = sign > 0;
}

function isProductExpired(prod) {
  if (!prod) return false;
  if (prod.quarantined) return true;
  if (typeof prod.fefoDaysLeft === 'number' && prod.fefoDaysLeft <= 0) return true;
  if (prod.fefoIsoDate) {
    const expMs = Date.parse(prod.fefoIsoDate);
    if (!Number.isNaN(expMs) && expMs <= Date.now()) return true;
  }
  return false;
}

function isProductNearExpiry(prod) {
  if (!prod) return false;
  if (typeof prod.fefoDaysLeft === 'number' && prod.fefoDaysLeft > 0 && prod.fefoDaysLeft <= 30) return true;
  if (/Kritis/i.test(String(prod.fefoStatus || ''))) return true;
  return false;
}

function recordServerAuditLog(state, entry) {
  if (!Array.isArray(state.auditLogs)) state.auditLogs = [];
  const id = entry.id || `AUD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const rec = {
    id,
    timestamp: entry.timestamp || nowStamp(),
    isoTime: entry.isoTime || new Date().toISOString(),
    action: entry.action || 'SYSTEM_EVENT',
    actor: entry.actor || 'Sistem',
    actorRole: entry.actorRole || '-',
    outletId: entry.outletId || null,
    outletName: entry.outletName || null,
    sku: entry.sku || null,
    productName: entry.productName || null,
    batch: entry.batch || null,
    qty: entry.qty !== undefined && entry.qty !== null ? Number(entry.qty) : null,
    docRef: entry.docRef || null,
    details: entry.details || '',
    checksum: entry.checksum || pseudoHash(`${id}|${entry.action}|${entry.actor}|${entry.sku || ''}|${entry.docRef || ''}`)
  };
  state.auditLogs = [rec, ...state.auditLogs].slice(0, 500);
  return rec;
}

/**
 * Terapkan satu mutasi ke state pusat secara deterministik & idempoten
 */
function applyMutationOnCentralState(state, mutation, callerUser) {
  const type = mutation.type;
  const p = mutation.payload || {};

  switch (type) {
    case 'SUBMIT_ORDER': {
      const incoming = p.order;
      if (!incoming) break;

      const orderCopy = JSON.parse(JSON.stringify(incoming));
      // Enforce kepemilikan salesRep apabila pemanggil memiliki peran field-sales
      if (callerUser && callerUser.role === 'field-sales') {
        orderCopy.salesRep = callerUser.salesRepName || callerUser.name || orderCopy.salesRep;
        orderCopy.salesRepId = callerUser.salesRepId || callerUser.id || orderCopy.salesRepId;
      }

      // Validasi dan normalisasi seluruh item pesanan (wajib kuantitas bulat positif >= 1 dan harga resmi dari master produk)
      const rawItems = Array.isArray(orderCopy.items) ? orderCopy.items : [];
      const sanitizedItems = [];
      let recalculatedTotal = 0;

      for (const rawIt of rawItems) {
        if (!rawIt || typeof rawIt !== 'object') continue;
        const rawQty = Number(rawIt.quantity);
        if (!Number.isFinite(rawQty) || rawQty < 1) continue;
        const safeQty = Math.min(100000, Math.floor(rawQty));
        const prod = findProduct(state, rawIt.sku || rawIt.productId, rawIt.name);
        const unitPrice = prod ? Number(prod.unitPrice) : Math.max(0, Math.floor(Number(rawIt.unitPrice) || 0));
        const subtotal = safeQty * unitPrice;
        recalculatedTotal += subtotal;
        sanitizedItems.push(Object.assign({}, rawIt, {
          sku: prod ? prod.sku : (rawIt.sku || rawIt.productId || 'SKU-UNKNOWN'),
          name: prod ? prod.name : String(rawIt.name || 'Produk Herbal'),
          batch: prod ? prod.activeBatch : (rawIt.batch || '-'),
          expiry: prod ? prod.fefoDate : (rawIt.expiry || '-'),
          quantity: safeQty,
          soldAtOutlet: rawIt.soldAtOutlet !== undefined
            ? Math.max(0, Math.min(safeQty, Math.floor(Number(rawIt.soldAtOutlet) || 0)))
            : safeQty,
          unitPrice,
          subtotal
        }));
      }

      if (sanitizedItems.length === 0) {
        break;
      }
      orderCopy.items = sanitizedItems;
      orderCopy.totalAmount = recalculatedTotal;

      // Cek duplikasi clientUuid (Idempotency)
      const exists = state.orders.find((o) => o.id === orderCopy.id || o.clientUuid === orderCopy.clientUuid);
      if (exists) {
        // Jika sebelumnya masuk sebagai OFFLINE_QUEUED dan belum potong stok, potong sekarang
        if (!exists.stockDeducted) {
          const shortages = checkStockAvailability(state, exists.items);
          if (shortages.length === 0) {
            deductOrderStock(state, exists);
          } else {
            exists.syncStatus = 'PENDING_WAREHOUSE';
            exists.stockWarning = 'Menunggu stok: ' + shortages.map((s) => `${s.name} (kurang ${s.shortBy} unit)`).join(', ');
          }
        }
        break;
      }

      // Batasi ukuran dan skema data:image/* pada signatureDataUrl & shelfPhotoDataUrl
      const safeDataUrlRe = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/i;
      if (orderCopy.signatureDataUrl) {
        if (typeof orderCopy.signatureDataUrl !== 'string' || orderCopy.signatureDataUrl.length > 512 * 1024 || !safeDataUrlRe.test(orderCopy.signatureDataUrl)) {
          delete orderCopy.signatureDataUrl;
        }
      }
      if (orderCopy.shelfPhotoDataUrl) {
        if (typeof orderCopy.shelfPhotoDataUrl !== 'string' || orderCopy.shelfPhotoDataUrl.length > 1024 * 1024 || !safeDataUrlRe.test(orderCopy.shelfPhotoDataUrl)) {
          delete orderCopy.shelfPhotoDataUrl;
        }
      }
      // Cek apakah ada item mendekati expired (<30 hari / Kritis) -> wajib tahan & tunggu override Admin Penjualan/Gudang
      const nearExpiryItems = [];
      for (const it of sanitizedItems) {
        const prod = findProduct(state, it.sku, it.name);
        if (isProductNearExpiry(prod)) {
          nearExpiryItems.push(`${prod.name} (${prod.activeBatch}, ED ${prod.fefoDate})`);
        }
      }
      if (nearExpiryItems.length > 0 && orderCopy.expiryOverrideStatus !== 'APPROVED_OVERRIDE') {
        orderCopy.requiresExpiryOverride = true;
        orderCopy.expiryOverrideStatus = 'PENDING_OVERRIDE';
        orderCopy.expiryOverrideItems = nearExpiryItems;
        orderCopy.priority = 'High';
      }

      orderCopy.stockDeducted = false;
      if (orderCopy.requiresExpiryOverride && orderCopy.expiryOverrideStatus === 'PENDING_OVERRIDE') {
        // Jangan potong stok dulu sebelum Admin Penjualan/Gudang menyetujui override mendesak
        orderCopy.syncStatus = 'PENDING_EXPIRY_OVERRIDE';
        orderCopy.stockWarning = 'Ditahan (Near-ED): Membutuhkan persetujuan override mendesak Admin Penjualan/Gudang untuk ' + nearExpiryItems.join(', ');
      } else {
        const shortages = checkStockAvailability(state, orderCopy.items);
        if (shortages.length === 0) {
          deductOrderStock(state, orderCopy);
        } else {
          orderCopy.syncStatus = 'PENDING_WAREHOUSE';
          orderCopy.priority = 'High';
          orderCopy.stockWarning = 'Menunggu stok: ' + shortages.map((s) => `${s.name} (kurang ${s.shortBy} unit)`).join(', ');
        }
      }

      applyOutletCredit(state, orderCopy, 1);
      const outlet = findOutlet(state, orderCopy.outletId);
      if (outlet) {
        outlet.lastOrderDate = todayLabel();
        outlet.ytdTotal = (outlet.ytdTotal || 0) + (orderCopy.totalAmount || 0);
        if (!Array.isArray(outlet.consignmentItems)) outlet.consignmentItems = [];
        (orderCopy.items || []).forEach((it) => {
          const prod = findProduct(state, it.sku, it.name);
          const fullSku = prod ? prod.sku : it.sku;
          const existingC = outlet.consignmentItems.find((c) => c.sku === fullSku);
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

      const activeLoad = (state.salesLoadings || []).find((l) => l.salesRep === orderCopy.salesRep);
      if (activeLoad) {
        activeLoad.cashCollected = (activeLoad.cashCollected || 0) + (orderCopy.totalAmount || 0);
        (orderCopy.items || []).forEach((it) => {
          const prod = findProduct(state, it.sku, it.name);
          const fullSku = prod ? prod.sku : it.sku;
          const loadItem = activeLoad.items.find((li) => li.sku === fullSku);
          if (loadItem) {
            loadItem.droppedQty = (loadItem.droppedQty || 0) + it.quantity;
            loadItem.returnedQty = Math.max(0, loadItem.loadedQty - loadItem.droppedQty - (loadItem.discrepancy || 0));
          }
        });
      }

      state.orders = [orderCopy, ...state.orders];
      // Catat ke tabel Audit Log terpisah untuk setiap item agar pelacakan 1 barang dari masuk sampai terjual akurat
      (orderCopy.items || []).forEach((it) => {
        recordServerAuditLog(state, {
          action: orderCopy.requiresExpiryOverride ? 'ORDER_NEAR_ED_HELD' : 'ORDER_CREATED',
          actor: orderCopy.salesRep || (callerUser && callerUser.name) || 'Sales Lapangan',
          actorRole: `Field Sales ${orderCopy.salesRepId || ''}`.trim(),
          outletId: orderCopy.outletId,
          outletName: orderCopy.outletName,
          sku: it.sku,
          productName: it.name,
          batch: String(it.batch || '-').replace('Batch: ', ''),
          qty: it.quantity,
          docRef: orderCopy.clientUuid || orderCopy.id,
          details: orderCopy.requiresExpiryOverride
            ? `Order ditahan (Near-ED) menunggu override mendesak Admin. Alasan outlet: ${orderCopy.expiryOverrideReason || orderCopy.notes || '-'}`
            : `Order ${it.quantity} unit ke ${orderCopy.outletName} (${orderCopy.terms}) • Sync: ${orderCopy.syncStatus}`
        });
      });
      if (p.visitLog && !state.visitLogs.some((v) => v.id === p.visitLog.id)) {
        const vlogCopy = Object.assign({}, p.visitLog);
        if (callerUser && callerUser.role === 'field-sales') {
          vlogCopy.salesRep = callerUser.salesRepName || callerUser.name || vlogCopy.salesRep;
        }
        state.visitLogs = [vlogCopy, ...state.visitLogs];
      }
      break;
    }

    case 'LOG_VISIT': {
      const vlog = p.visitLog ? Object.assign({}, p.visitLog) : null;
      if (vlog && !state.visitLogs.some((v) => v.id === vlog.id)) {
        if (callerUser && callerUser.role === 'field-sales') {
          vlog.salesRep = callerUser.salesRepName || callerUser.name || vlog.salesRep;
        }
        state.visitLogs = [vlog, ...state.visitLogs];
        const outlet = findOutlet(state, vlog.outletId);
        if (outlet) {
          outlet.lastVisitDate = todayLabel();
          outlet.visitNotes = `"Kunjungan oleh ${vlog.salesRep}${vlog.notes ? ': ' + vlog.notes : ''}"`;
        }
        (state.salesVisits || []).forEach((v) => {
          if (v.outletId === vlog.outletId && v.status === 'TERJADWAL') v.status = 'SELESAI';
        });
        recordServerAuditLog(state, {
          action: 'VISIT_LOGGED',
          actor: vlog.salesRep || (callerUser && callerUser.name) || 'Sales Lapangan',
          actorRole: 'Field Sales',
          outletId: vlog.outletId,
          outletName: vlog.outletName || (outlet ? outlet.name : vlog.outletId),
          docRef: vlog.id,
          details: `Check-in GPS (${vlog.gpsDistance || 0}m) • Hasil: ${vlog.outcome}${vlog.notes ? ' — ' + vlog.notes : ''}`
        });
      }
      break;
    }

    case 'APPROVE_ORDER': {
      const ord = state.orders.find((o) => o.id === p.orderId || o.clientUuid === p.clientUuid || o.clientUuid === p.orderId);
      if (ord) {
        if (ord.requiresExpiryOverride && ord.expiryOverrideStatus === 'PENDING_OVERRIDE' && !p.overrideReason) {
          break;
        }
        if (p.overrideReason) {
          ord.expiryOverrideStatus = 'APPROVED_OVERRIDE';
          ord.expiryOverrideReason = String(p.overrideReason);
          ord.expiryOverrideBy = (callerUser && callerUser.name) || 'Admin Penjualan';
          ord.expiryOverrideAt = nowStamp();
          ord.stockWarning = undefined;
        }
        if (!ord.stockDeducted) deductOrderStock(state, ord);
        ord.status = 'APPROVED';
        ord.syncStatus = 'SYNCED_DEDUCTED';
        (ord.items || []).forEach((it) => {
          recordServerAuditLog(state, {
            action: p.overrideReason ? 'NEAR_EXPIRY_OVERRIDE' : 'ORDER_APPROVED',
            actor: (callerUser && callerUser.name) || 'Admin Penjualan',
            actorRole: (callerUser && callerUser.title) || 'Admin Operasional',
            outletId: ord.outletId,
            outletName: ord.outletName,
            sku: it.sku,
            productName: it.name,
            batch: String(it.batch || '-').replace('Batch: ', ''),
            qty: it.quantity,
            docRef: ord.clientUuid || ord.id,
            details: p.overrideReason
              ? `Override Mendesak Near-ED disetujui untuk ${ord.outletName}. Alasan: ${p.overrideReason}`
              : `Faktur ${ord.clientUuid || ord.id} disetujui & stok batch FEFO dialokasikan untuk ${ord.outletName}`
          });
        });
      }
      break;
    }

    case 'APPROVE_EXPIRY_OVERRIDE': {
      const ord = state.orders.find((o) => o.id === p.orderId || o.clientUuid === p.orderId);
      if (ord) {
        const reason = String(p.reason || 'Kebutuhan mendesak outlet, langsung dipakai sebelum tanggal kedaluwarsa').trim();
        ord.expiryOverrideStatus = 'APPROVED_OVERRIDE';
        ord.expiryOverrideReason = reason;
        ord.expiryOverrideBy = (callerUser && callerUser.name) || p.approverName || 'Admin Penjualan & Gudang';
        ord.expiryOverrideAt = nowStamp();
        ord.stockWarning = undefined;
        if (!ord.stockDeducted) deductOrderStock(state, ord);
        ord.status = 'APPROVED';
        ord.syncStatus = 'SYNCED_DEDUCTED';
        (ord.items || []).forEach((it) => {
          recordServerAuditLog(state, {
            action: 'NEAR_EXPIRY_OVERRIDE',
            actor: ord.expiryOverrideBy,
            actorRole: (callerUser && callerUser.title) || 'Admin Penjualan / Gudang',
            outletId: ord.outletId,
            outletName: ord.outletName,
            sku: it.sku,
            productName: it.name,
            batch: String(it.batch || '-').replace('Batch: ', ''),
            qty: it.quantity,
            docRef: ord.clientUuid || ord.id,
            details: `Persetujuan Khusus Near-ED (Mendesak): ${reason}`
          });
        });
      }
      break;
    }

    case 'BATCH_APPROVE_ORDERS': {
      (p.orderIds || []).forEach((id) => {
        const ord = state.orders.find((o) => o.id === id || o.clientUuid === id);
        if (ord) {
          if (ord.requiresExpiryOverride && ord.expiryOverrideStatus === 'PENDING_OVERRIDE') return;
          if (!ord.stockDeducted) deductOrderStock(state, ord);
          ord.status = 'APPROVED';
          ord.syncStatus = 'SYNCED_DEDUCTED';
          recordServerAuditLog(state, {
            action: 'ORDER_APPROVED',
            actor: (callerUser && callerUser.name) || 'Admin Penjualan',
            actorRole: (callerUser && callerUser.title) || 'Admin Operasional',
            outletId: ord.outletId,
            outletName: ord.outletName,
            sku: ord.items && ord.items[0] ? ord.items[0].sku : null,
            productName: ord.items && ord.items[0] ? ord.items[0].name : null,
            batch: ord.items && ord.items[0] ? String(ord.items[0].batch || '-').replace('Batch: ', '') : null,
            qty: (ord.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0),
            docRef: ord.clientUuid || ord.id,
            details: `Otorisasi massal faktur ${ord.outletName} (${(ord.items || []).length} SKU)`
          });
        }
      });
      break;
    }

    case 'REJECT_ORDER': {
      const ord = state.orders.find((o) => o.id === p.orderId || o.clientUuid === p.orderId);
      if (ord && ord.status !== 'REJECTED') {
        if (ord.stockDeducted) restoreOrderStock(state, ord, p.reason);
        if (ord.creditApplied) applyOutletCredit(state, ord, -1);
        ord.status = 'REJECTED';
        if (ord.requiresExpiryOverride) ord.expiryOverrideStatus = 'REJECTED_OVERRIDE';
        recordServerAuditLog(state, {
          action: 'ORDER_REJECTED',
          actor: (callerUser && callerUser.name) || 'Admin Penjualan',
          actorRole: (callerUser && callerUser.title) || 'Admin Operasional',
          outletId: ord.outletId,
          outletName: ord.outletName,
          sku: ord.items && ord.items[0] ? ord.items[0].sku : null,
          productName: ord.items && ord.items[0] ? ord.items[0].name : null,
          docRef: ord.clientUuid || ord.id,
          details: `Pesanan ditolak/ditahan: ${p.reason || 'Pembatalan manual'}`
        });
      }
      break;
    }

    case 'QUARANTINE_BATCH': {
      const prod = state.products.find((pr) => pr.sku === p.sku);
      if (prod) {
        prod.quarantined = true;
        prod.quarantineReason = p.reason || 'Penarikan / Karantina Batch CDOB BPOM';
        prod.quarantinedAt = nowStamp();
        prod.status = 'critical-expiry';
        prod.fefoStatus = 'Dikarantina (Recall CDOB)';
        recordServerAuditLog(state, {
          action: 'BATCH_RECALL_QUARANTINE',
          actor: (callerUser && callerUser.name) || 'QA / CDOB Officer',
          actorRole: (callerUser && callerUser.title) || 'QA / Admin Gudang',
          sku: prod.sku,
          productName: prod.name,
          batch: prod.activeBatch,
          qty: prod.stock,
          docRef: `RECALL-${prod.activeBatch}`,
          details: `Karantina & Batch Recall CDOB: ${prod.quarantineReason}`
        });
      }
      break;
    }

    case 'ADD_INBOUND_BATCH': {
      const prod = state.products.find((pr) => pr.sku === p.sku);
      const rawQty = Number(p.qty);
      if (!Number.isFinite(rawQty) || rawQty < 1) break;
      const qty = Math.min(1000000, Math.floor(rawQty));
      const newStock = prod ? prod.stock + qty : qty;
      if (prod) {
        prod.stock = newStock;
        prod.activeBatch = p.batch;
        prod.fefoDate = p.expiryDate;
        prod.status = newStock >= prod.rop ? 'optimal' : 'below-rop';
      }
      const entry = p.ledgerEntry || {
        id: `LEDG-${Math.floor(10000 + Math.random() * 90000)}`,
        timestamp: nowStamp(),
        docRef: p.docRef || 'PO-INBOUND',
        skuName: prod ? prod.name : 'Produk Herbal',
        skuCode: p.sku,
        batch: p.batch,
        type: 'MASUK',
        quantity: qty,
        finalStock: newStock,
        operator: 'Slamet Riadi',
        operatorRole: 'Warehouse Inbound',
        hash: pseudoHash(p.sku + p.batch)
      };
      entry.quantity = qty;
      entry.finalStock = newStock;
      if (!state.ledger.some((l) => l.id === entry.id)) {
        state.ledger = [entry, ...state.ledger];
      }
      recordServerAuditLog(state, {
        action: 'INBOUND_BATCH',
        actor: entry.operator || (callerUser && callerUser.name) || 'Admin Gudang',
        actorRole: entry.operatorRole || 'Warehouse Inbound',
        sku: p.sku,
        productName: prod ? prod.name : 'Produk Herbal',
        batch: p.batch,
        qty,
        docRef: entry.docRef,
        details: `Penerimaan batch masuk +${qty} unit (ED: ${p.expiryDate || '-'}, Saldo akhir: ${newStock})`
      });
      break;
    }

    case 'ADJUST_STOCK': {
      const prod = state.products.find((pr) => pr.sku === p.sku);
      const delta = Number(p.quantityDelta) || 0;
      const newStock = Math.max(0, (prod ? prod.stock : 0) + delta);
      if (prod) {
        prod.stock = newStock;
        prod.status = computeProductStatus(prod);
      }
      const entry = p.ledgerEntry || {
        id: `LEDG-${Math.floor(10000 + Math.random() * 90000)}`,
        timestamp: nowStamp(),
        docRef: 'ADJ-AUDIT',
        skuName: prod ? prod.name : 'Produk Herbal',
        skuCode: p.sku,
        batch: p.batch,
        type: 'PENYESUAIAN',
        quantity: delta,
        finalStock: newStock,
        operator: p.auditorName || 'Dewi Lestari',
        operatorRole: 'Chief Auditor Intern',
        hash: pseudoHash(p.sku + delta)
      };
      if (!state.ledger.some((l) => l.id === entry.id)) {
        state.ledger = [entry, ...state.ledger];
      }
      recordServerAuditLog(state, {
        action: 'ADJUST_STOCK',
        actor: entry.operator || (callerUser && callerUser.name) || 'Auditor Gudang',
        actorRole: entry.operatorRole || 'Stock Opname',
        sku: p.sku,
        productName: prod ? prod.name : 'Produk Herbal',
        batch: p.batch,
        qty: delta,
        docRef: entry.docRef,
        details: `Penyesuaian stok opname (${delta >= 0 ? '+' : ''}${delta} unit, Saldo: ${newStock}). Alasan: ${p.reason || '-'}`
      });
      break;
    }

    case 'SUBSTITUTE_BATCH': {
      const ord = state.orders.find((o) => o.id === p.orderId);
      if (ord) {
        ord.items = (ord.items || []).map((it) => {
          if (it.sku === p.sku || (it.name && it.name.includes(p.sku))) {
            return Object.assign({}, it, {
              batch: `Batch: ${p.newBatch} (${p.sourceWarehouse})`,
              allocated: true
            });
          }
          return it;
        });
        ord.stockWarning = undefined;
      }
      break;
    }

    case 'ADJUST_ORDER_QTY': {
      const rawNewQty = Number(p.newQty);
      if (!Number.isFinite(rawNewQty) || rawNewQty < 1) break;
      const safeNewQty = Math.min(100000, Math.floor(rawNewQty));
      const ord = state.orders.find((o) => o.id === p.orderId);
      if (ord) {
        ord.items = (ord.items || []).map((it) => {
          if (it.sku === p.sku || (it.name && it.name.includes(p.sku))) {
            return Object.assign({}, it, {
              quantity: safeNewQty,
              subtotal: safeNewQty * it.unitPrice
            });
          }
          return it;
        });
        ord.totalAmount = ord.items.reduce((acc, it) => acc + it.subtotal, 0);
      }
      break;
    }

    case 'CREATE_SUPPLIER_PO': {
      if (p.po && !state.supplierPOs.some((po) => po.id === p.po.id)) {
        const rawQty = Number(p.po.quantity);
        if (!Number.isFinite(rawQty) || rawQty < 1) break;
        const safeQty = Math.min(1000000, Math.floor(rawQty));
        const rawPrice = Number(p.po.unitPrice);
        const safePrice = Number.isFinite(rawPrice) && rawPrice >= 0 ? Math.floor(rawPrice) : 0;
        const poCopy = Object.assign({}, p.po, {
          quantity: safeQty,
          unitPrice: safePrice,
          totalCost: safeQty * safePrice
        });
        state.supplierPOs = [poCopy, ...state.supplierPOs];
      }
      break;
    }

    case 'SCHEDULE_VISIT': {
      if (p.visit && !state.salesVisits.some((v) => v.id === p.visit.id)) {
        state.salesVisits = [p.visit, ...state.salesVisits];
        const targetOutlet = findOutlet(state, p.visit.outletId);
        if (targetOutlet) {
          targetOutlet.lastVisitDate = p.visit.scheduledDate;
          targetOutlet.visitNotes = `"${p.visit.purpose}: ${p.visit.notes}"`;
        }
      }
      break;
    }

    case 'MARK_DELIVERED': {
      (state.driverManifests || []).forEach((manifest) => {
        const ord = (manifest.orders || []).find((o) => o.orderId === p.orderId);
        if (ord) {
          ord.delivered = true;
          ord.deliveredTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
        }
      });
      const targetOrder = state.orders.find((o) => o.id === p.orderId || o.clientUuid === p.orderId);
      if (targetOrder) {
        targetOrder.status = 'DISPATCHED';
        recordServerAuditLog(state, {
          action: 'ORDER_DELIVERED',
          actor: p.driverName || (callerUser && callerUser.name) || 'Driver Armada',
          actorRole: 'Armada Pengiriman',
          outletId: targetOrder.outletId,
          outletName: targetOrder.outletName,
          sku: targetOrder.items && targetOrder.items[0] ? targetOrder.items[0].sku : null,
          productName: targetOrder.items && targetOrder.items[0] ? targetOrder.items[0].name : null,
          docRef: targetOrder.clientUuid || targetOrder.id,
          details: `Bukti Serah Terima (POD) diterima di ${targetOrder.outletName} oleh Driver ${p.driverName || '-'}`
        });
      }
      break;
    }

    case 'ADD_OUTLET': {
      if (p.outlet && !state.outlets.some((o) => o.id === p.outlet.id)) {
        state.outlets = [p.outlet, ...state.outlets];
      }
      break;
    }

    case 'RECORD_WAREHOUSE_LOAD': {
      const prod = findProduct(state, p.sku);
      const rep = (state.salesTeam || []).find((s) => s.name === p.salesRep) || state.salesTeam[0];
      const qty = Number(p.loadedQty) || 0;
      if (prod && rep && qty > 0) {
        let loadRec = state.salesLoadings.find((l) => l.salesRep === rep.name);
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
        const existingItem = loadRec.items.find((i) => i.sku === prod.sku);
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
      }
      break;
    }

    case 'RECONCILE_LOADING': {
      const loadRec = (state.salesLoadings || []).find((l) => l.id === p.loadId);
      if (loadRec) {
        let totalDiscrepancy = 0;
        (loadRec.items || []).forEach((it) => {
          const expectedReturn = Math.max(0, it.loadedQty - it.droppedQty);
          const rawReturn = p.actualReturnedMap && p.actualReturnedMap[it.sku] !== undefined
            ? Number(p.actualReturnedMap[it.sku])
            : expectedReturn;
          const actualReturn = Number.isFinite(rawReturn)
            ? Math.max(0, Math.min(it.loadedQty, Math.floor(rawReturn)))
            : expectedReturn;
          it.returnedQty = actualReturn;
          it.discrepancy = Math.max(0, expectedReturn - actualReturn);
          totalDiscrepancy += it.discrepancy;
        });
        loadRec.status = totalDiscrepancy === 0 ? 'TERVERIFIKASI_KLOP' : 'SELISIH_AUDIT';
        loadRec.auditNote = totalDiscrepancy === 0
          ? undefined
          : `Terdeteksi selisih ${totalDiscrepancy} unit belum kembali ke gudang (wajib ditagihkan ke sales)!`;
      }
      break;
    }

    case 'UPDATE_USER': {
      if (!Array.isArray(state.users)) state.users = loadInitialMasterData().users || [];
      if (p.user && p.user.id) {
        const idx = state.users.findIndex((u) => u.id === p.user.id);
        const incoming = Object.assign({}, p.user);
        const targetId = String(incoming.id);
        // Cegah kolisi username, email, atau nama dengan akun lain
        const hasCollision = state.users.some((other) => {
          if (!other || String(other.id) === targetId) return false;
          const uCollision = incoming.username && String(other.username || '').toLowerCase() === String(incoming.username).trim().toLowerCase();
          const eCollision = incoming.email && String(other.email || '').toLowerCase() === String(incoming.email).trim().toLowerCase();
          const nCollision = incoming.name && String(other.name || '').toLowerCase() === String(incoming.name).trim().toLowerCase();
          return Boolean(uCollision || eCollision || nCollision);
        });
        if (hasCollision) break;

        if (incoming.password) {
          incoming.passwordHash = hashCredential(incoming.password);
          delete incoming.password;
        }
        if (incoming.pin) {
          incoming.pinHash = hashCredential(incoming.pin);
          delete incoming.pin;
        }
        incoming.badgeColor = sanitizeHexColor(incoming.badgeColor, idx !== -1 ? state.users[idx].badgeColor : '#005c55');
        if (idx !== -1) {
          state.users[idx] = sanitizeUserRecord(Object.assign({}, state.users[idx], incoming));
        } else {
          state.users.push(sanitizeUserRecord(incoming));
        }
      }
      break;
    }

    case 'CHANGE_USER_PASSWORD': {
      if (!Array.isArray(state.users)) state.users = loadInitialMasterData().users || [];
      if (p.userId) {
        const u = state.users.find((usr) => usr.id === p.userId);
        if (u) {
          if (p.newPasswordHash || p.newPassword) {
            u.passwordHash = hashCredential(p.newPasswordHash || p.newPassword);
            delete u.password;
          }
          if (p.newPinHash || p.newPin) {
            u.pinHash = hashCredential(p.newPinHash || p.newPin);
            delete u.pin;
          }
        }
      }
      break;
    }

    case 'CREATE_USER': {
      if (!Array.isArray(state.users)) state.users = loadInitialMasterData().users || [];
      if (p.user && p.user.id && !state.users.some((u) => u.id === p.user.id)) {
        const sanitizedNew = sanitizeUserRecord(p.user);
        state.users.push(sanitizedNew);
        if (sanitizedNew.role === 'field-sales' && Array.isArray(state.salesTeam) && !state.salesTeam.some((s) => s.id === sanitizedNew.id)) {
          state.salesTeam.push({
            id: sanitizedNew.id,
            name: sanitizedNew.name,
            division: sanitizedNew.division || 'Madu & Herbal',
            area: 'Solo Raya',
            dailyVisitTarget: 15,
            monthlyRevenueTarget: 50000000,
            monthlyRevenueBase: 0,
            monthlyVisitBase: 0
          });
        }
      }
      break;
    }

    case 'DELETE_USER': {
      if (!Array.isArray(state.users)) state.users = loadInitialMasterData().users || [];
      if (p.userId && p.userId !== 'USR-SUPER-01') {
        state.users = state.users.filter((u) => u.id !== p.userId);
      }
      break;
    }

    case 'IMPORT_OUTLETS': {
      const safeRows = Array.isArray(p.rows) ? p.rows.slice(0, 500) : [];
      safeRows.forEach((r) => {
        const name = r.nama_outlet || r.nama;
        if (!name) return;
        let city = String(r.kota || 'Solo').trim();
        if (city === 'Surakarta') city = 'Solo';
        const code = String(r.kode_outlet || '').trim() || `AP-${city.slice(0, 3).toUpperCase()}-${String(state.outlets.length + 1).padStart(3, '0')}`;
        const limit = Number(String(r.limit_kredit || '10000000').replace(/[^0-9]/g, '')) || 10000000;
        const existing = findOutlet(state, code);
        if (existing) {
          existing.name = name;
          existing.address = r.alamat || existing.address;
          existing.city = city;
          existing.cityName = city === 'Solo' ? 'Surakarta' : city;
          existing.creditLimit = limit;
          existing.creditRemaining = Math.max(0, limit - (existing.creditUsed || 0));
        } else {
          state.outlets.push({
            id: code,
            code,
            name,
            address: r.alamat || 'Solo Raya',
            city,
            cityName: city === 'Solo' ? 'Surakarta' : city,
            type: r.tipe || 'Apotek Mandiri',
            picName: r.nama_pic || '-',
            picRole: 'Apoteker Pengelola Apotek (APA)',
            picPhone: String(r.telepon_pic || '').replace(/[^0-9]/g, ''),
            salesRep: r.sales_rep || 'Budi Santoso',
            salesArea: city,
            terms: r.termin || 'Net 30 Hari',
            creditLimit: limit,
            creditUsed: 0,
            creditRemaining: limit,
            creditStatus: 'Lancar',
            lastOrderDate: '-',
            orderFrequency: 'Impor CSV',
            ytdTotal: Number(String(r.omset_ytd || '0').replace(/[^0-9]/g, '')) || 0,
            lastVisitDate: '-',
            visitNotes: '"Data outlet hasil impor CSV."'
          });
        }
      });
      break;
    }

    case 'IMPORT_PRODUCTS': {
      const safeRows = Array.isArray(p.rows) ? p.rows.slice(0, 500) : [];
      safeRows.forEach((r) => {
        const sku = String(r.sku || '').trim().toUpperCase();
        const name = r.nama_produk || r.nama;
        const stock = Number(String(r.stok || '0').replace(/[^0-9]/g, ''));
        if (!sku || !name || isNaN(stock)) return;
        const existing = state.products.find((pr) => pr.sku === sku);
        const ss = Number(r.safety_stock) || 50;
        const rop = Number(r.rop) || ss * 2;
        const price = Number(r.harga_satuan) || 45000;
        const batch = r.batch_aktif || (existing ? existing.activeBatch : 'BATCH-2026-MIG');
        if (existing) {
          existing.name = name;
          existing.stock = stock;
          existing.safetyStock = ss;
          existing.rop = rop;
          existing.unitPrice = price;
          existing.activeBatch = batch;
          existing.status = computeProductStatus(existing);
        } else {
          const prod = {
            sku,
            name,
            category: r.kategori || 'Madu Herbal',
            stock,
            safetyStock: ss,
            rop,
            ropFormula: `SS=${ss} (impor)`,
            activeBatch: batch,
            fefoDate: r.tanggal_ed || '2027-12-31',
            fefoStatus: 'Aman (>6 Bulan)',
            status: stock <= rop ? 'below-rop' : 'optimal',
            unitPrice: price,
            icon: 'inventory_2'
          };
          state.products.push(prod);
        }
      });
      break;
    }

    case 'REBALANCE_CONSIGNMENT': {
      const applyOneRebalance = (item) => {
        const src = findOutlet(state, item.sourceOutletId);
        const dst = findOutlet(state, item.targetOutletId);
        const qty = Number(item.transferQty) || 0;
        if (src && dst && qty > 0) {
          const srcItem = (src.consignmentItems || []).find((c) => c.sku === item.sku);
          if (srcItem && (srcItem.remainingQty || 0) >= qty) {
            srcItem.remainingQty = Math.max(0, srcItem.remainingQty - qty);
            srcItem.consignedQty = (srcItem.soldQty || 0) + srcItem.remainingQty;
            srcItem.velocity = 'LARIS';
            srcItem.daysInOutlet = 1;
            srcItem.nearExpiry = false;
            srcItem.rebalanced = true;

            if (!Array.isArray(dst.consignmentItems)) dst.consignmentItems = [];
            const dstItem = dst.consignmentItems.find((c) => c.sku === item.sku);
            if (dstItem) {
              dstItem.remainingQty = (dstItem.remainingQty || 0) + qty;
              dstItem.consignedQty = (dstItem.soldQty || 0) + dstItem.remainingQty;
              dstItem.velocity = 'LARIS';
            } else {
              dst.consignmentItems.push({
                sku: srcItem.sku,
                name: srcItem.name,
                batch: srcItem.batch,
                expiry: srcItem.expiry,
                consignedQty: qty,
                soldQty: 0,
                remainingQty: qty,
                unitPrice: srcItem.unitPrice,
                velocity: 'LARIS',
                daysInOutlet: 1,
                nearExpiry: false,
                rebalanced: true
              });
            }
            src.consignmentTotalUnits = (src.consignmentItems || []).reduce((s, c) => s + (c.remainingQty || 0), 0);
            src.consignmentBillableAmount = (src.consignmentItems || []).reduce((s, c) => s + (c.soldQty || 0) * c.unitPrice, 0);
            dst.consignmentTotalUnits = (dst.consignmentItems || []).reduce((s, c) => s + (c.remainingQty || 0), 0);
            dst.consignmentBillableAmount = (dst.consignmentItems || []).reduce((s, c) => s + (c.soldQty || 0) * c.unitPrice, 0);
          }
          if (item.ledgerEntry && !state.ledger.some((l) => l.id === item.ledgerEntry.id)) {
            state.ledger = [item.ledgerEntry, ...state.ledger];
          }
        }
      };
      applyOneRebalance(p);
      break;
    }

    case 'BATCH_REBALANCE_CONSIGNMENT': {
      (p.items || []).forEach((item) => {
        applyMutationOnCentralState(state, { type: 'REBALANCE_CONSIGNMENT', payload: item });
      });
      break;
    }

    case 'RESOLVE_EXPIRY_ALARM': {
      const prod = state.products.find((pr) => pr.sku === p.sku || pr.activeBatch === p.batch);
      if (prod) {
        prod.fefoStatus = 'Prioritas FEFO Terjadwal';
        prod.status = prod.stock <= prod.rop ? 'below-rop' : 'optimal';
      }
      if (p.ledgerEntry && !state.ledger.some((l) => l.id === p.ledgerEntry.id)) {
        state.ledger = [p.ledgerEntry, ...state.ledger];
      }
      break;
    }

    case 'UPDATE_OUTLET_CREDIT_POLICY': {
      const target = findOutlet(state, p.outletId);
      if (target) {
        if (p.creditLimit !== undefined) {
          const lim = Number(p.creditLimit);
          if (!Number.isFinite(lim) || lim < 0) break;
          target.creditLimit = Math.floor(lim);
        }
        if (p.terms !== undefined) target.terms = String(p.terms);
        if (p.creditRemaining !== undefined) {
          const rem = Number(p.creditRemaining);
          if (!Number.isFinite(rem) || rem < 0) break;
          target.creditRemaining = Math.floor(rem);
        } else if (p.creditLimit !== undefined) {
          target.creditRemaining = Math.max(0, target.creditLimit - (target.creditUsed || 0));
        }
        if (p.creditStatus !== undefined) target.creditStatus = String(p.creditStatus);
        if (p.aiCreditOptimized !== undefined) target.aiCreditOptimized = Boolean(p.aiCreditOptimized);
      }
      break;
    }
  }
}

// -----------------------------------------------------------------------------
// 5. Server-Sent Events (SSE) Broadcast Manager
// -----------------------------------------------------------------------------
const sseClients = new Map();

function broadcastSSE(eventName, payload) {
  const msg = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const [id, res] of sseClients.entries()) {
    try {
      res.write(msg);
    } catch (e) {
      sseClients.delete(id);
    }
  }
}

// -----------------------------------------------------------------------------
// 6. HTTP Server & Static PWA Router
// -----------------------------------------------------------------------------
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.sql': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

function isSafeHostHeader(rawHost) {
  if (!rawHost || typeof rawHost !== 'string') return false;
  return /^[a-zA-Z0-9.-]+(?::[0-9]{1,5})?$/.test(rawHost.trim());
}

function getAllowedCorsOrigin(req) {
  const h = (req && req.headers) || {};
  const origin = h.origin || h.Origin;
  if (!origin) return `http://localhost:${PORT}`;
  try {
    const u = new URL(origin);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return `http://localhost:${PORT}`;
    }
    const explicitAllowed = String(process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (explicitAllowed.includes(origin.toLowerCase()) || explicitAllowed.includes(u.host.toLowerCase())) {
      return origin;
    }
    if (process.env.VERCEL_URL && u.host.toLowerCase() === String(process.env.VERCEL_URL).trim().toLowerCase()) {
      return origin;
    }
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL && u.host.toLowerCase() === String(process.env.VERCEL_PROJECT_PRODUCTION_URL).trim().toLowerCase()) {
      return origin;
    }
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      return origin;
    }
    if ((process.env.VERCEL === '1' || process.env.VERCEL === 'true') && u.hostname.endsWith('.vercel.app') && u.host === (h.host || h.Host)) {
      return origin;
    }
  } catch (e) {}
  return `http://localhost:${PORT}`;
}

function sendJson(res, statusCode, body, req, extraHeaders) {
  const payload = JSON.stringify(body);
  const headers = buildBaseSecurityHeaders(Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'Access-Control-Allow-Origin': getAllowedCorsOrigin(req),
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Arba-Token',
    'Vary': 'Origin'
  }, extraHeaders || {}));
  res.writeHead(statusCode, headers);
  if (req && req.method === 'HEAD') {
    return res.end();
  }
  res.end(payload);
}

function authenticateRequest(req, parsedUrl) {
  const token = extractRequestToken(req, parsedUrl);
  if (!token) {
    return { ok: false, status: 401, message: 'Akses ditolak: Token autentikasi sesi diperlukan. Silakan login terlebih dahulu.' };
  }
  const claims = verifySessionToken(token);
  if (!claims) {
    return { ok: false, status: 401, message: 'Sesi tidak valid atau telah kedaluwarsa. Silakan login kembali.' };
  }
  const state = getCentralState();
  const user = (state.users || []).find((u) => u.id === claims.sub);
  if (!user || user.active === false) {
    return { ok: false, status: 403, message: 'Akun tidak aktif atau tidak ditemukan.' };
  }
  if (claims.pwdTag && claims.pwdTag !== getUserPasswordTag(user)) {
    return { ok: false, status: 401, message: 'Kredensial akun telah berubah. Silakan login kembali dengan kata sandi terbaru.' };
  }
  return { ok: true, user: sanitizeUserRecord(user), rawUser: user, token, claims };
}

const ROLE_ALLOWED_MUTATIONS = {
  'super-admin': '*',
  'executive': new Set([
    'SUBMIT_ORDER', 'LOG_VISIT', 'APPROVE_ORDER', 'APPROVE_EXPIRY_OVERRIDE', 'BATCH_APPROVE_ORDERS', 'REJECT_ORDER',
    'ADD_INBOUND_BATCH', 'ADJUST_STOCK', 'QUARANTINE_BATCH', 'SUBSTITUTE_BATCH', 'ADJUST_ORDER_QTY',
    'CREATE_SUPPLIER_PO', 'SCHEDULE_VISIT', 'MARK_DELIVERED', 'ADD_OUTLET',
    'RECORD_WAREHOUSE_LOAD', 'RECONCILE_LOADING', 'IMPORT_OUTLETS', 'IMPORT_PRODUCTS',
    'REBALANCE_CONSIGNMENT', 'BATCH_REBALANCE_CONSIGNMENT', 'RESOLVE_EXPIRY_ALARM',
    'UPDATE_OUTLET_CREDIT_POLICY', 'UPDATE_USER', 'CHANGE_USER_PASSWORD'
  ]),
  'inventory': new Set([
    'ADD_INBOUND_BATCH', 'ADJUST_STOCK', 'QUARANTINE_BATCH', 'SUBSTITUTE_BATCH', 'ADJUST_ORDER_QTY',
    'CREATE_SUPPLIER_PO', 'RECORD_WAREHOUSE_LOAD', 'RECONCILE_LOADING', 'IMPORT_PRODUCTS',
    'APPROVE_ORDER', 'APPROVE_EXPIRY_OVERRIDE', 'BATCH_APPROVE_ORDERS', 'MARK_DELIVERED', 'REBALANCE_CONSIGNMENT',
    'BATCH_REBALANCE_CONSIGNMENT', 'RESOLVE_EXPIRY_ALARM', 'UPDATE_USER', 'CHANGE_USER_PASSWORD'
  ]),
  'sales-ops': new Set([
    'APPROVE_ORDER', 'APPROVE_EXPIRY_OVERRIDE', 'BATCH_APPROVE_ORDERS', 'REJECT_ORDER', 'SUBSTITUTE_BATCH',
    'ADJUST_ORDER_QTY', 'MARK_DELIVERED', 'ADD_OUTLET', 'SCHEDULE_VISIT',
    'IMPORT_OUTLETS', 'UPDATE_OUTLET_CREDIT_POLICY', 'REBALANCE_CONSIGNMENT',
    'BATCH_REBALANCE_CONSIGNMENT', 'RESOLVE_EXPIRY_ALARM', 'SUBMIT_ORDER', 'LOG_VISIT',
    'UPDATE_USER', 'CHANGE_USER_PASSWORD'
  ]),
  'field-sales': new Set([
    'SUBMIT_ORDER', 'LOG_VISIT', 'SCHEDULE_VISIT', 'UPDATE_USER', 'CHANGE_USER_PASSWORD'
  ])
};

function isMutationAllowedForUser(callerUser, mut, fullState) {
  if (!callerUser) return { allowed: false, message: 'Tidak terautentikasi.' };
  const role = callerUser.role;
  const type = mut && mut.type;
  const p = (mut && mut.payload) || {};

  if (role === 'super-admin' && !['UPDATE_USER', 'CREATE_USER', 'SUBMIT_ORDER', 'ADD_INBOUND_BATCH', 'ADJUST_ORDER_QTY', 'RECORD_WAREHOUSE_LOAD', 'UPDATE_OUTLET_CREDIT_POLICY', 'CREATE_SUPPLIER_PO', 'IMPORT_OUTLETS', 'IMPORT_PRODUCTS'].includes(type)) {
    return { allowed: true };
  }

  const allowedSet = ROLE_ALLOWED_MUTATIONS[role];
  if (!allowedSet || (allowedSet !== '*' && !allowedSet.has(type))) {
    return {
      allowed: false,
      message: `Akses ditolak (RBAC): Peran "${role}" tidak memiliki otorisasi untuk menjalankan mutasi "${type}".`
    };
  }

  if (type === 'UPDATE_USER' || type === 'CREATE_USER') {
    const targetId = p.userId || (p.user && p.user.id);
    if (role !== 'super-admin' && targetId !== callerUser.id) {
      return { allowed: false, message: 'Akses ditolak: Anda hanya dapat memperbarui profil akun Anda sendiri.' };
    }
    const st = fullState || getCentralState();
    if (p.user) {
      const nextUsername = p.user.username !== undefined ? String(p.user.username).trim() : '';
      const nextEmail = p.user.email !== undefined ? String(p.user.email).trim() : '';
      const nextName = p.user.name !== undefined ? String(p.user.name).trim() : '';

      if (nextUsername && !/^[a-zA-Z0-9._-]{3,32}$/.test(nextUsername)) {
        return { allowed: false, message: 'Username tidak valid: Gunakan 3-32 karakter huruf, angka, titik, garis bawah, atau tanda hubung.' };
      }

      const duplicate = (st.users || []).find((other) => {
        if (!other || String(other.id) === String(targetId)) return false;
        if (nextUsername && String(other.username || '').toLowerCase() === nextUsername.toLowerCase()) return true;
        if (nextEmail && String(other.email || '').toLowerCase() === nextEmail.toLowerCase()) return true;
        if (nextName && String(other.name || '').toLowerCase() === nextName.toLowerCase()) return true;
        return false;
      });
      if (duplicate) {
        return {
          allowed: false,
          message: 'Akses ditolak: Username, Email, atau Nama Lengkap tersebut sudah digunakan oleh akun pengguna lain.'
        };
      }

      const safeBadgeColor = sanitizeHexColor(p.user.badgeColor, callerUser.badgeColor || '#005c55');

      if (role !== 'super-admin') {
        // Cegah eskalasi privilege oleh non-Super-Admin
        p.user = {
          id: callerUser.id,
          name: nextName || callerUser.name,
          username: nextUsername || callerUser.username,
          email: nextEmail || callerUser.email,
          phone: p.user.phone !== undefined ? String(p.user.phone).trim() : callerUser.phone,
          title: p.user.title !== undefined ? String(p.user.title).trim() : callerUser.title,
          division: p.user.division !== undefined ? String(p.user.division).trim() : callerUser.division,
          avatarInitials: p.user.avatarInitials !== undefined ? String(p.user.avatarInitials).trim().slice(0, 2).toUpperCase() : callerUser.avatarInitials,
          badgeColor: safeBadgeColor
        };
      } else {
        p.user.badgeColor = safeBadgeColor;
      }
    }
    return { allowed: true };
  }

  if (type === 'ADD_INBOUND_BATCH') {
    const q = Number(p.qty);
    if (!Number.isFinite(q) || q < 1 || !Number.isInteger(q)) {
      return { allowed: false, message: 'Mutasi gudang ditolak: Kuantitas penerimaan batch masuk (qty) wajib bilangan bulat positif (>= 1).' };
    }
    return { allowed: true };
  }

  if (type === 'ADJUST_ORDER_QTY') {
    const q = Number(p.newQty);
    if (!Number.isFinite(q) || q < 1 || !Number.isInteger(q)) {
      return { allowed: false, message: 'Koreksi pesanan ditolak: Kuantitas baru pesanan (newQty) wajib bilangan bulat positif (>= 1).' };
    }
    return { allowed: true };
  }

  if (type === 'RECORD_WAREHOUSE_LOAD') {
    const q = Number(p.loadedQty);
    if (!Number.isFinite(q) || q < 1 || !Number.isInteger(q)) {
      return { allowed: false, message: 'Muatan kanvas ditolak: Kuantitas muatan (loadedQty) wajib bilangan bulat positif (>= 1).' };
    }
    return { allowed: true };
  }

  if (type === 'UPDATE_OUTLET_CREDIT_POLICY') {
    if (p.creditLimit !== undefined) {
      const lim = Number(p.creditLimit);
      if (!Number.isFinite(lim) || lim < 0) {
        return { allowed: false, message: 'Kebijakan kredit ditolak: Plafon kredit (creditLimit) tidak boleh bernilai negatif.' };
      }
    }
    if (p.creditRemaining !== undefined) {
      const rem = Number(p.creditRemaining);
      if (!Number.isFinite(rem) || rem < 0) {
        return { allowed: false, message: 'Kebijakan kredit ditolak: Sisa plafon kredit (creditRemaining) tidak boleh bernilai negatif.' };
      }
    }
    return { allowed: true };
  }

  if (type === 'CREATE_SUPPLIER_PO') {
    const po = p.po;
    const q = Number(po && po.quantity);
    const price = Number(po && po.unitPrice);
    if (!po || !Number.isFinite(q) || q < 1 || !Number.isInteger(q) || (po.unitPrice !== undefined && (!Number.isFinite(price) || price < 0))) {
      return { allowed: false, message: 'PO Supplier ditolak: Kuantitas PO wajib bilangan bulat positif (>= 1) dan harga satuan tidak boleh negatif.' };
    }
    return { allowed: true };
  }

  if (type === 'IMPORT_OUTLETS' || type === 'IMPORT_PRODUCTS') {
    if (!Array.isArray(p.rows) || p.rows.length === 0 || p.rows.length > 500) {
      return { allowed: false, message: 'Impor data ditolak: Jumlah baris CSV wajib antara 1 hingga maksimal 500 baris per transaksi.' };
    }
    return { allowed: true };
  }

  if (type === 'CHANGE_USER_PASSWORD') {
    if (p.userId !== callerUser.id) {
      return { allowed: false, message: 'Akses ditolak: Anda hanya dapat mengganti kata sandi akun Anda sendiri.' };
    }
    const providedCurrent = p.currentPasswordHash || p.currentPassword;
    if (!providedCurrent) {
      return { allowed: false, message: 'Akses ditolak: Kata sandi saat ini wajib disertakan untuk verifikasi keamanan.' };
    }
    const st = fullState || getCentralState();
    const storedUser = (st.users || []).find((u) => u.id === callerUser.id) || callerUser;
    if (!verifyCredentialHash(providedCurrent, storedUser.password, storedUser.passwordHash)) {
      return { allowed: false, message: 'Akses ditolak: Kata sandi saat ini tidak sesuai.' };
    }
    return { allowed: true };
  }

  if (type === 'SUBMIT_ORDER') {
    const incomingOrder = p.order;
    if (!incomingOrder || !Array.isArray(incomingOrder.items) || incomingOrder.items.length === 0) {
      return { allowed: false, message: 'Pesanan tidak valid: Daftar item pesanan tidak boleh kosong.' };
    }
    const hasInvalidQty = incomingOrder.items.some((it) => {
      const q = Number(it && it.quantity);
      return !Number.isFinite(q) || q < 1 || !Number.isInteger(q);
    });
    if (hasInvalidQty) {
      return { allowed: false, message: 'Pesanan ditolak: Setiap item pesanan wajib memiliki kuantitas bilangan bulat positif (>= 1).' };
    }
    const st = fullState || getCentralState();
    const blockedItem = incomingOrder.items.find((it) => {
      const prod = findProduct(st, it.sku || it.productId, it.name);
      return isProductExpired(prod);
    });
    if (blockedItem) {
      return {
        allowed: false,
        message: `Pesanan ditolak (CDOB): Produk "${blockedItem.name || blockedItem.sku}" sudah kedaluwarsa (expired) atau sedang dikarantina.`
      };
    }
    return { allowed: true };
  }

  return { allowed: true };
}

function readJsonBody(req) {
  const MAX_BODY_BYTES = 2 * 1024 * 1024;
  return new Promise((resolve, reject) => {
    // Di Vercel Serverless Functions, runtime otomatis mem-parsing JSON body ke req.body
    // dan stream request bisa sudah selesai (readableEnded) sebelum handler dipanggil.
    if (req && req.body !== undefined) {
      if (typeof req.body === 'object' && req.body !== null && !Buffer.isBuffer(req.body)) {
        try {
          if (Buffer.byteLength(JSON.stringify(req.body), 'utf8') > MAX_BODY_BYTES) {
            return reject(new Error('Payload terlalu besar (maksimal 2 MB)'));
          }
        } catch (e) {
          return reject(e);
        }
        return resolve(req.body);
      }
      if (typeof req.body === 'string') {
        if (Buffer.byteLength(req.body, 'utf8') > MAX_BODY_BYTES) {
          return reject(new Error('Payload terlalu besar (maksimal 2 MB)'));
        }
        if (!req.body.trim()) return resolve({});
        try {
          return resolve(JSON.parse(req.body));
        } catch (e) {
          return reject(e);
        }
      }
      if (Buffer.isBuffer(req.body)) {
        if (req.body.length > MAX_BODY_BYTES) {
          return reject(new Error('Payload terlalu besar (maksimal 2 MB)'));
        }
        const text = req.body.toString('utf8').trim();
        if (!text) return resolve({});
        try {
          return resolve(JSON.parse(text));
        } catch (e) {
          return reject(e);
        }
      }
    }

    if (req && req.readableEnded) {
      return resolve({});
    }

    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
        reject(new Error('Payload terlalu besar (maksimal 2 MB)'));
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const rawHost = req && req.headers && (req.headers.host || req.headers.Host);
  if (rawHost !== undefined && !isSafeHostHeader(String(rawHost))) {
    res.writeHead(400, buildBaseSecurityHeaders({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }));
    return res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ status: 'error', message: '400 Bad Request: Invalid Host header.' }));
  }

  let parsedUrl;
  try {
    const safeHost = isSafeHostHeader(String(rawHost || '')) ? String(rawHost).trim() : 'localhost';
    parsedUrl = new URL(req.url || '/', `http://${safeHost}`);
  } catch (urlErr) {
    res.writeHead(400, buildBaseSecurityHeaders({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }));
    return res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ status: 'error', message: '400 Bad Request: Malformed URL.' }));
  }
  const pathname = parsedUrl.pathname;
  const isGetOrHead = req.method === 'GET' || req.method === 'HEAD';

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': getAllowedCorsOrigin(req),
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Arba-Token',
      'Vary': 'Origin'
    });
    return res.end();
  }

  // 1) Health & SQL Relational Table Counts (Rincian tabel internal hanya ditampilkan bila pemanggil terautentikasi)
  if (pathname === '/api/health' && isGetOrHead) {
    const auth = authenticateRequest(req, parsedUrl);
    if (!auth.ok) {
      return sendJson(res, 200, {
        status: 'ok',
        timestamp: new Date().toISOString()
      }, req);
    }
    const counts = {
      users: db.prepare('SELECT COUNT(*) AS c FROM users').get().c,
      outlets: db.prepare('SELECT COUNT(*) AS c FROM outlets').get().c,
      sales_targets: db.prepare('SELECT COUNT(*) AS c FROM sales_targets').get().c,
      visits: db.prepare('SELECT COUNT(*) AS c FROM visits').get().c,
      products: db.prepare('SELECT COUNT(*) AS c FROM products').get().c,
      product_batches: db.prepare('SELECT COUNT(*) AS c FROM product_batches').get().c,
      orders: db.prepare('SELECT COUNT(*) AS c FROM orders').get().c,
      order_items: db.prepare('SELECT COUNT(*) AS c FROM order_items').get().c,
      stock_ledger: db.prepare('SELECT COUNT(*) AS c FROM stock_ledger').get().c,
      alerts: db.prepare('SELECT COUNT(*) AS c FROM alerts').get().c,
      audit_logs: db.prepare('SELECT COUNT(*) AS c FROM audit_logs').get().c,
      synced_mutations: db.prepare('SELECT COUNT(*) AS c FROM sync_mutations_log').get().c
    };
    return sendJson(res, 200, {
      status: 'ok',
      engine: HAS_CLOUD_KV
        ? 'Cloud KV Persistent Store + SQLite Relational Engine'
        : (IS_SERVERLESS_RUNTIME ? 'Serverless Ephemeral SQLite (Hubungkan Vercel KV / Upstash Redis untuk persistensi lintas instance)' : 'Node.js Built-in SQLite Relational Engine (WAL Mode)'),
      storageMode: STORAGE_MODE,
      cloudKvConfigured: HAS_CLOUD_KV,
      cloudKvEnvSource: CLOUD_KV_ENV_SOURCE,
      detectedStorageEnvKeys: Object.keys(process.env || {}).filter((k) => /KV|UPSTASH|REDIS/i.test(k)),
      databaseFile: 'database/arbaconnect.sqlite',
      connectedClients: sseClients.size,
      relationalTables: counts,
      timestamp: new Date().toISOString()
    }, req);
  }

  // 2) Ambil State Pusat (Wajib Terautentikasi & Tanpa Plaintext Kredensial)
  if (pathname === '/api/state' && isGetOrHead) {
    await ensureCloudKvHydrated();
    const auth = authenticateRequest(req, parsedUrl);
    if (!auth.ok) {
      return sendJson(res, auth.status, { status: 'error', message: auth.message }, req);
    }
    const rawState = getCentralState();
    const state = sanitizeStateForClient(rawState, auth.user);
    return sendJson(res, 200, {
      status: 'ok',
      storageMode: STORAGE_MODE,
      stateVersion: rawState.stateVersion || 1,
      state,
      timestamp: new Date().toISOString()
    }, req);
  }

  // 2B) Endpoint Audit Log Terpisah (`GET /api/audit-logs` — Pelacakan Jejak Barang & Audit CDOB)
  if (pathname === '/api/audit-logs' && isGetOrHead) {
    await ensureCloudKvHydrated();
    const auth = authenticateRequest(req, parsedUrl);
    if (!auth.ok) {
      return sendJson(res, auth.status, { status: 'error', message: auth.message }, req);
    }
    const rawState = getCentralState();
    let logs = Array.isArray(rawState.auditLogs) ? rawState.auditLogs.slice() : [];
    const skuFilter = (parsedUrl.searchParams.get('sku') || '').trim().toLowerCase();
    const batchFilter = (parsedUrl.searchParams.get('batch') || '').trim().toLowerCase();
    const actorFilter = (parsedUrl.searchParams.get('actor') || '').trim().toLowerCase();
    const outletFilter = (parsedUrl.searchParams.get('outletId') || '').trim().toLowerCase();
    const actionFilter = (parsedUrl.searchParams.get('action') || '').trim().toUpperCase();
    const qFilter = (parsedUrl.searchParams.get('q') || '').trim().toLowerCase();

    if (skuFilter) logs = logs.filter((l) => String(l.sku || '').toLowerCase().includes(skuFilter));
    if (batchFilter) logs = logs.filter((l) => String(l.batch || '').toLowerCase().includes(batchFilter));
    if (actorFilter) logs = logs.filter((l) => String(l.actor || '').toLowerCase().includes(actorFilter));
    if (outletFilter) logs = logs.filter((l) => String(l.outletId || '').toLowerCase().includes(outletFilter) || String(l.outletName || '').toLowerCase().includes(outletFilter));
    if (actionFilter && actionFilter !== 'ALL') logs = logs.filter((l) => String(l.action || '').toUpperCase() === actionFilter);
    if (qFilter) {
      logs = logs.filter((l) =>
        [l.id, l.action, l.actor, l.outletName, l.sku, l.productName, l.batch, l.docRef, l.details]
          .some((val) => String(val || '').toLowerCase().includes(qFilter))
      );
    }

    return sendJson(res, 200, {
      status: 'ok',
      total: logs.length,
      storageMode: STORAGE_MODE,
      auditLogs: logs.slice(0, 250),
      timestamp: new Date().toISOString()
    }, req);
  }

  // 3) Audit Tabel SQL Relasional (10 Tabel `schema.sql` - Khusus Super Admin & Direksi)
  if (pathname === '/api/sql-audit' && isGetOrHead) {
    const auth = authenticateRequest(req, parsedUrl);
    if (!auth.ok) {
      return sendJson(res, auth.status, { status: 'error', message: auth.message }, req);
    }
    if (auth.user.role !== 'super-admin' && auth.user.role !== 'executive') {
      return sendJson(res, 403, {
        status: 'error',
        message: 'Akses ditolak: Endpoint audit SQL hanya diizinkan untuk Super Admin dan Direksi.'
      }, req);
    }
    const rawSqlUsers = db.prepare('SELECT id, username, nama, email, no_telp, jabatan, divisi, peran, aktif, created_at FROM users').all();
    return sendJson(res, 200, {
      status: 'ok',
      tables: {
        users: rawSqlUsers,
        outlets: db.prepare('SELECT * FROM outlets').all(),
        sales_targets: db.prepare('SELECT * FROM sales_targets').all(),
        visits: db.prepare('SELECT * FROM visits ORDER BY checkin_at DESC LIMIT 25').all(),
        products: db.prepare('SELECT * FROM products').all(),
        product_batches: db.prepare('SELECT * FROM product_batches').all(),
        orders: db.prepare('SELECT * FROM orders ORDER BY rowid DESC LIMIT 25').all(),
        order_items: db.prepare('SELECT * FROM order_items LIMIT 50').all(),
        stock_ledger: db.prepare('SELECT * FROM stock_ledger LIMIT 30').all(),
        alerts: db.prepare('SELECT * FROM alerts').all(),
        sync_mutations_log: db.prepare('SELECT mutation_id, client_id, mutation_type, summary, synced_at FROM sync_mutations_log ORDER BY synced_at DESC LIMIT 30').all()
      }
    }, req);
  }

  // 3B) Endpoint Autentikasi & Daftar Akun Pengguna Per Role (`/api/auth/users`, `/api/auth/login`, `/api/auth/logout`)
  if (pathname === '/api/auth/users' && isGetOrHead) {
    const auth = authenticateRequest(req, parsedUrl);
    if (!auth.ok) {
      return sendJson(res, auth.status, { status: 'error', message: auth.message }, req);
    }
    const centralState = getCentralState();
    const safeUsers = (centralState.users || []).map((u) => sanitizeUserForPublicList(u));
    return sendJson(res, 200, { status: 'ok', users: safeUsers }, req);
  }

  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    const token = extractRequestToken(req, parsedUrl);
    if (token) revokeSessionToken(token);
    pruneSecurityCaches();
    return sendJson(res, 200, { status: 'ok', message: 'Sesi berhasil diakhiri.' }, req, {
      'Set-Cookie': buildSessionCookieHeader('', 0, req)
    });
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      await ensureCloudKvHydrated();
      pruneSecurityCaches();
      const body = await readJsonBody(req);
      const q = String(body.identifier || '').trim().toLowerCase();
      const pw = String(body.password || '').trim();
      const clientIp = getClientIp(req);
      const attemptKey = `${clientIp}:${q}`;
      const accountKey = `acct:${q}`;
      const attemptInfo = loginAttempts.get(attemptKey);
      const accountInfo = loginAttempts.get(accountKey);

      if (
        (attemptInfo && attemptInfo.count >= MAX_LOGIN_ATTEMPTS && (Date.now() - attemptInfo.lastAttempt) < LOCKOUT_MS) ||
        (accountInfo && accountInfo.count >= MAX_ACCOUNT_ATTEMPTS && (Date.now() - accountInfo.lastAttempt) < LOCKOUT_MS)
      ) {
        const activeLock = (attemptInfo && attemptInfo.count >= MAX_LOGIN_ATTEMPTS) ? attemptInfo : accountInfo;
        const waitSec = Math.max(1, Math.ceil((LOCKOUT_MS - (Date.now() - activeLock.lastAttempt)) / 1000));
        return sendJson(res, 429, {
          status: 'error',
          message: `Terlalu banyak percobaan login gagal. Silakan tunggu ${waitSec} detik lagi.`
        }, req);
      }

      const centralState = getCentralState();
      const matched = (centralState.users || []).find(
        (u) =>
          String(u.username || '').toLowerCase() === q ||
          String(u.email || '').toLowerCase() === q ||
          String(u.id || '').toLowerCase() === q ||
          String(u.name || '').toLowerCase() === q
      );

      if (!matched) {
        // Jalankan verifikasi hash dummy untuk menyamakan waktu eksekusi dan mencegah Username Enumeration (CWE-204)
        verifyCredentialHash(pw, 'arba_dummy_timing_guard_2026', null);
        const prev = loginAttempts.get(attemptKey) || { count: 0 };
        loginAttempts.set(attemptKey, { count: prev.count + 1, lastAttempt: Date.now() });
        const prevAcct = loginAttempts.get(accountKey) || { count: 0 };
        loginAttempts.set(accountKey, { count: prevAcct.count + 1, lastAttempt: Date.now() });
        return sendJson(res, 401, {
          status: 'error',
          message: 'Username/Email atau Kata Sandi tidak sesuai.'
        }, req);
      }

      if (matched.active === false) {
        return sendJson(res, 403, {
          status: 'error',
          message: 'Akun ini sedang dinonaktifkan oleh Super Admin.'
        }, req);
      }

      // Verifikasi password online secara ketat menggunakan perbandingan hash timing-safe (PIN offline tidak diterima untuk login online)
      const isPasswordValid = verifyCredentialHash(pw, matched.password, matched.passwordHash);
      if (!isPasswordValid) {
        const prev = loginAttempts.get(attemptKey) || { count: 0 };
        loginAttempts.set(attemptKey, { count: prev.count + 1, lastAttempt: Date.now() });
        const prevAcct = loginAttempts.get(accountKey) || { count: 0 };
        loginAttempts.set(accountKey, { count: prevAcct.count + 1, lastAttempt: Date.now() });
        return sendJson(res, 401, {
          status: 'error',
          message: 'Username/Email atau Kata Sandi tidak sesuai.'
        }, req);
      }

      loginAttempts.delete(attemptKey);
      loginAttempts.delete(accountKey);

      const sessionToken = issueSessionToken(matched);
      const safeUser = sanitizeUserRecord(matched);

      // Pastikan juga user tercatat di tabel SQL `users`
      const sqlUser = db.prepare('SELECT id, username, nama, email, peran, aktif FROM users WHERE email = ? OR id = ?').get(matched.email, matched.id);

      return sendJson(res, 200, {
        status: 'ok',
        token: sessionToken,
        user: safeUser,
        sqlRecord: sqlUser || null,
        timestamp: new Date().toISOString()
      }, req, {
        'Set-Cookie': buildSessionCookieHeader(encodeURIComponent(sessionToken), 86400, req)
      });
    } catch (err) {
      return sendJson(res, 500, { status: 'error', message: err.message }, req);
    }
  }

  // 4) Endpoint Sinkronisasi Batch Offline -> Online (`POST /api/sync` - Wajib Terautentikasi & RBAC)
  if (pathname === '/api/sync' && req.method === 'POST') {
    await ensureCloudKvHydrated();
    const auth = authenticateRequest(req, parsedUrl);
    if (!auth.ok) {
      return sendJson(res, auth.status, { status: 'error', message: auth.message }, req);
    }
    try {
      const body = await readJsonBody(req);
      const clientId = body.clientId || 'UNKNOWN';
      const mutations = Array.isArray(body.mutations) ? body.mutations : [];

      const currentStateForPerm = getCentralState();
      for (const mut of mutations) {
        const perm = isMutationAllowedForUser(auth.user, mut, currentStateForPerm);
        if (!perm.allowed) {
          return sendJson(res, 403, { status: 'error', message: perm.message }, req);
        }
      }

      if (mutations.length === 0 && body.clientState && typeof body.clientState === 'object' && auth.user.role !== 'super-admin') {
        return sendJson(res, 403, {
          status: 'error',
          message: 'Akses ditolak: Penimpaan snapshot state penuh hanya diizinkan untuk Super Admin.'
        }, req);
      }

      let appliedCount = 0;
      let skippedDuplicates = 0;
      let callerPasswordChanged = false;
      const summaries = [];

      db.exec('BEGIN IMMEDIATE;');
      try {
        const state = getCentralState();
        const checkStmt = db.prepare('SELECT mutation_id FROM sync_mutations_log WHERE mutation_id = ?');
        const logStmt = db.prepare(`
          INSERT INTO sync_mutations_log (mutation_id, client_id, mutation_type, summary, payload_json)
          VALUES (?, ?, ?, ?, ?)
        `);

        for (const mut of mutations) {
          const mid = mut.mutationId || mut.id;
          if (!mid) continue;

          // Cek Idempotensi: jika mutasi dengan ID ini sudah pernah masuk, lewati!
          const alreadyProcessed = checkStmt.get(mid);
          if (alreadyProcessed) {
            skippedDuplicates++;
            continue;
          }

          applyMutationOnCentralState(state, mut, auth.user);
          if (mut.type === 'CHANGE_USER_PASSWORD' && mut.payload && mut.payload.userId === auth.user.id) {
            callerPasswordChanged = true;
          }
          logStmt.run(mid, clientId, mut.type || 'UNKNOWN', mut.summary || '', JSON.stringify(mut.payload || {}));
          if (mut.summary) summaries.push(mut.summary);
          appliedCount++;
        }

        // Sinkronkan snapshot penuh hanya bila pemanggil adalah Super Admin & tidak ada mutasi eksplisit
        if (auth.user.role === 'super-admin' && mutations.length === 0 && body.clientState && typeof body.clientState === 'object') {
          const cs = body.clientState;
          if (Array.isArray(cs.users) && cs.users.length) {
            state.users = cs.users.map((u) => sanitizeUserRecord(u));
          }
          if (Array.isArray(cs.products) && cs.products.length) state.products = cs.products;
          if (Array.isArray(cs.ledger) && cs.ledger.length) state.ledger = cs.ledger;
          if (Array.isArray(cs.outlets) && cs.outlets.length) state.outlets = cs.outlets;
          if (Array.isArray(cs.orders) && cs.orders.length) state.orders = cs.orders;
          if (Array.isArray(cs.supplierPOs)) state.supplierPOs = cs.supplierPOs;
          if (Array.isArray(cs.salesVisits)) state.salesVisits = cs.salesVisits;
          if (Array.isArray(cs.driverManifests)) state.driverManifests = cs.driverManifests;
          if (Array.isArray(cs.salesTeam)) state.salesTeam = cs.salesTeam;
          if (Array.isArray(cs.salesLoadings)) state.salesLoadings = cs.salesLoadings;
          if (Array.isArray(cs.visitLogs)) state.visitLogs = cs.visitLogs;
        }

        if (appliedCount > 0) {
          saveCentralState(state, true);
        }
        db.exec('COMMIT;');

        if (appliedCount > 0 && HAS_CLOUD_KV) {
          await cloudKvSetState(state);
        }

        const rawUpdatedState = getCentralState();
        const callerState = sanitizeStateForClient(rawUpdatedState, auth.user);
        const broadcastState = sanitizeStateForClient(rawUpdatedState, null);

        if (appliedCount > 0) {
          broadcastSSE('state_updated', {
            sourceClientId: clientId,
            appliedCount,
            summary: summaries.join(' • '),
            state: broadcastState,
            timestamp: Date.now()
          });
        }

        let refreshedToken = undefined;
        let extraHeaders = undefined;
        if (callerPasswordChanged) {
          const updatedCaller = (rawUpdatedState.users || []).find((u) => u.id === auth.user.id);
          if (updatedCaller) {
            refreshedToken = issueSessionToken(updatedCaller);
            extraHeaders = {
              'Set-Cookie': buildSessionCookieHeader(encodeURIComponent(refreshedToken), 86400, req)
            };
          }
        }

        return sendJson(res, 200, {
          status: 'ok',
          storageMode: STORAGE_MODE,
          stateVersion: rawUpdatedState.stateVersion || 1,
          appliedCount,
          skippedDuplicates,
          refreshedToken,
          state: callerState,
          timestamp: new Date().toISOString()
        }, req, extraHeaders);
      } catch (txErr) {
        db.exec('ROLLBACK;');
        throw txErr;
      }
    } catch (err) {
      return sendJson(res, 500, { status: 'error', message: err.message }, req);
    }
  }

  // 5) Reset Database Pusat ke Awal (Khusus Super Admin)
  if (pathname === '/api/reset' && req.method === 'POST') {
    const auth = authenticateRequest(req, parsedUrl);
    if (!auth.ok) {
      return sendJson(res, auth.status, { status: 'error', message: auth.message }, req);
    }
    if (auth.user.role !== 'super-admin') {
      return sendJson(res, 403, {
        status: 'error',
        message: 'Akses ditolak: Hanya Super Admin yang diizinkan mereset database pusat.'
      }, req);
    }
    const master = loadInitialMasterData();
    const initialState = {
      stateVersion: Date.now(),
      users: (master.users || []).map((u) => sanitizeUserRecord(u)),
      products: master.products,
      ledger: master.ledger,
      auditLogs: buildInitialAuditLogs(master),
      outlets: master.outlets,
      orders: master.orders,
      supplierPOs: master.supplierPOs,
      salesVisits: master.salesVisits,
      driverManifests: master.driverManifests,
      salesTeam: master.salesTeam,
      salesLoadings: master.salesLoadings,
      visitLogs: master.visitLogs
    };
    db.exec('DELETE FROM sync_mutations_log;');
    await persistCentralStateEverywhere(initialState);
    const safeBroadcastInitial = sanitizeStateForClient(initialState, null);
    const safeCallerInitial = sanitizeStateForClient(initialState, auth.user);
    broadcastSSE('state_updated', {
      sourceClientId: 'SYSTEM_RESET',
      appliedCount: 1,
      summary: 'Database pusat di-reset ke data awal oleh Super Admin',
      state: safeBroadcastInitial,
      timestamp: Date.now()
    });
    return sendJson(res, 200, { status: 'ok', state: safeCallerInitial }, req);
  }

  // 6) Real-time Server-Sent Events Stream (`GET /api/events` - Wajib Terautentikasi)
  if (pathname === '/api/events' && req.method === 'GET') {
    const auth = authenticateRequest(req, parsedUrl);
    if (!auth.ok) {
      return sendJson(res, auth.status, { status: 'error', message: auth.message }, req);
    }
    const streamId = (parsedUrl.searchParams.get('clientId') || 'CLI') + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': getAllowedCorsOrigin(req),
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin'
    });
    res.write(`event: connected\ndata: ${JSON.stringify({ streamId, userId: auth.user.id, time: Date.now() })}\n\n`);
    sseClients.set(streamId, res);

    req.on('close', () => {
      sseClients.delete(streamId);
    });
    return;
  }

  // Pastikan seluruh request HEAD pada endpoint selain GET/HEAD API di atas tidak mengeluarkan body (RFC 9110)
  if (pathname.startsWith('/api/')) {
    return sendJson(res, req.method === 'HEAD' ? 405 : 404, {
      status: 'error',
      message: req.method === 'HEAD' ? '405 Method Not Allowed' : '404 API Endpoint Not Found'
    }, req);
  }

  // 7) Melayani Berkas Statis PWA (Hanya direktori frontend publik yang diizinkan)
  let relPath = pathname === '/' ? '/index.html' : pathname;
  try {
    relPath = decodeURIComponent(relPath);
  } catch (e) {
    res.writeHead(400);
    return res.end(req.method === 'HEAD' ? undefined : 'Bad Request');
  }

  // Blokir akses langsung ke direktori/berkas sensitif server & database SQLite
  const normalizedRel = relPath.replace(/\\/g, '/').toLowerCase();
  if (
    normalizedRel.includes('..') ||
    normalizedRel.startsWith('/database') ||
    normalizedRel.startsWith('/server') ||
    normalizedRel.startsWith('/docs') ||
    normalizedRel.startsWith('/api') ||
    normalizedRel.startsWith('/.') ||
    normalizedRel.startsWith('/node_modules') ||
    normalizedRel === '/package.json' ||
    normalizedRel === '/package-lock.json' ||
    normalizedRel === '/vercel.json' ||
    normalizedRel === '/metadata.json' ||
    normalizedRel.endsWith('.sqlite') ||
    normalizedRel.endsWith('.sqlite-wal') ||
    normalizedRel.endsWith('.sqlite-shm') ||
    normalizedRel.endsWith('.sql')
  ) {
    res.writeHead(403, buildBaseSecurityHeaders({
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'X-Robots-Tag': 'noindex, nofollow, noarchive'
    }));
    return res.end(req.method === 'HEAD' ? undefined : '403 Forbidden: Access to protected server/database resource is denied.');
  }

  const safePath = path.normalize(path.join(ROOT_DIR, relPath));

  if (!safePath.startsWith(ROOT_DIR)) {
    res.writeHead(403, buildBaseSecurityHeaders({ 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }));
    return res.end(req.method === 'HEAD' ? undefined : 'Forbidden');
  }

  fs.stat(safePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // Fallback SPA ke index.html
      const indexHtml = path.join(ROOT_DIR, 'index.html');
      fs.readFile(indexHtml, (e2, content) => {
        if (e2) {
          res.writeHead(404, buildBaseSecurityHeaders({ 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }));
          return res.end(req.method === 'HEAD' ? undefined : 'Not Found');
        }
        res.writeHead(200, buildBaseSecurityHeaders({
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, must-revalidate'
        }));
        res.end(req.method === 'HEAD' ? undefined : content);
      });
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const mime = safePath.endsWith('manifest.json')
      ? 'application/manifest+json; charset=utf-8'
      : (MIME_TYPES[ext] || 'application/octet-stream');
    const headers = buildBaseSecurityHeaders({
      'Content-Type': mime,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    if (safePath.endsWith('sw.js')) {
      headers['Service-Worker-Allowed'] = '/';
    }

    fs.readFile(safePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, buildBaseSecurityHeaders({ 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }));
        return res.end(req.method === 'HEAD' ? undefined : 'Internal Server Error');
      }
      res.writeHead(200, headers);
      res.end(req.method === 'HEAD' ? undefined : content);
    });
  });
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log('===================================================================');
    console.log("  ArbaConnect ERP - Central Server & Offline-First PWA Active");
    console.log("  CV Arba'in Solo Raya");
    console.log('===================================================================');
    console.log(`  Local URL   : http://localhost:${PORT}`);
    console.log(`  Field Sales : http://localhost:${PORT}/?pwa=full#field-sales-pwa-preview`);
    console.log(`  Health API  : http://localhost:${PORT}/api/health`);
    console.log(`  SQL Audit   : http://localhost:${PORT}/api/sql-audit`);
    console.log(`  SQLite DB   : ${DB_FILE}`);
    console.log('===================================================================');
  });
}

module.exports = {
  server,
  db,
  getCentralState,
  saveCentralState,
  applyMutationOnCentralState,
  hashCredential,
  issueSessionToken,
  verifySessionToken,
  sanitizeStateForClient
};

