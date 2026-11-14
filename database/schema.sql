-- =============================================================================
-- ArbaConnect ERP - Skema Basis Data PostgreSQL (10 Entitas Sesuai ERD Gambar C2)
-- Tantangan ARB-02: Sistem CRM Terpadu CV Arba'in Solo Raya
-- UMS Health Innovation Hackathon 2026
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabel Pengguna & Hak Akses Per Peran (RBAC + Super Admin)
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username        VARCHAR(64)  UNIQUE NOT NULL,
    nama            VARCHAR(120) NOT NULL,
    email           VARCHAR(150) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    pin_offline     VARCHAR(16)  DEFAULT '123456',
    no_telp         VARCHAR(32),
    jabatan         VARCHAR(100),
    divisi          VARCHAR(120),
    peran           VARCHAR(32)  NOT NULL CHECK (peran IN ('super_admin', 'direktur', 'admin_gudang', 'admin_penjualan', 'sales')),
    aktif           BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 2. Tabel Pelanggan B2B (Apotek & Minimarket)
CREATE TABLE outlets (
    id              VARCHAR(32) PRIMARY KEY,
    sales_id        UUID REFERENCES users(id),
    kode            VARCHAR(32) UNIQUE NOT NULL,
    nama            VARCHAR(160) NOT NULL,
    jenis           VARCHAR(32)  NOT NULL CHECK (jenis IN ('apotek', 'minimarket', 'jaringan_farmasi')),
    alamat          TEXT NOT NULL,
    kota            VARCHAR(64) NOT NULL,
    lat             NUMERIC(10, 7),
    lng             NUMERIC(10, 7),
    kontak_nama     VARCHAR(120),
    kontak_telp     VARCHAR(32),
    termin_hari     INTEGER NOT NULL DEFAULT 30,
    limit_kredit    BIGINT  NOT NULL DEFAULT 10000000,
    kredit_terpakai BIGINT  NOT NULL DEFAULT 0,
    status          VARCHAR(24) NOT NULL DEFAULT 'Lancar',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabel Target Capaian Sales Bulanan & Harian
CREATE TABLE sales_targets (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sales_id            UUID NOT NULL REFERENCES users(id),
    periode             VARCHAR(7) NOT NULL, -- Format YYYY-MM
    target_nilai        BIGINT  NOT NULL DEFAULT 50000000,
    target_kunjungan    INTEGER NOT NULL DEFAULT 120,
    UNIQUE (sales_id, periode)
);

-- 4. Tabel Kunjungan Lapangan / Canvassing (Check-in GPS)
CREATE TABLE visits (
    id              VARCHAR(40) PRIMARY KEY,
    outlet_id       VARCHAR(32) NOT NULL REFERENCES outlets(id),
    sales_id        UUID NOT NULL REFERENCES users(id),
    checkin_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    lat             NUMERIC(10, 7),
    lng             NUMERIC(10, 7),
    jarak_meter     INTEGER,
    hasil           VARCHAR(40) NOT NULL CHECK (hasil IN ('ORDER', 'NO_ORDER_STOCK_FULL', 'COLLECTION', 'FOLLOW_UP', 'PIC_ABSENT', 'DISPLAY_CHECK')),
    catatan         TEXT
);

-- 5. Tabel Master Produk Herbal & Parameter ROP
CREATE TABLE products (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku                 VARCHAR(40) UNIQUE NOT NULL,
    nama                VARCHAR(160) NOT NULL,
    kategori            VARCHAR(64)  NOT NULL,
    satuan              VARCHAR(24)  NOT NULL DEFAULT 'Botol',
    harga               BIGINT  NOT NULL,
    stok_minimum        INTEGER NOT NULL DEFAULT 50,
    titik_pesan_ulang   INTEGER NOT NULL DEFAULT 120, -- ROP = d * L + SS
    stok_total          INTEGER NOT NULL DEFAULT 0,
    aktif               BOOLEAN NOT NULL DEFAULT TRUE
);

-- 6. Tabel Batch Produk & Kedaluwarsa (FEFO - First-Expired, First-Out)
CREATE TABLE product_batches (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    no_batch        VARCHAR(48) NOT NULL,
    tgl_kedaluwarsa DATE NOT NULL,
    stok_batch      INTEGER NOT NULL DEFAULT 0 CHECK (stok_batch >= 0),
    UNIQUE (product_id, no_batch)
);

-- 7. Tabel Pesanan B2B (Idempotent Offline-First via client_uuid)
CREATE TABLE orders (
    id              VARCHAR(48) PRIMARY KEY,
    client_uuid     VARCHAR(64) UNIQUE NOT NULL,
    outlet_id       VARCHAR(32) NOT NULL REFERENCES outlets(id),
    sales_id        UUID NOT NULL REFERENCES users(id),
    visit_id        VARCHAR(40) REFERENCES visits(id),
    tanggal         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    jatuh_tempo     DATE,
    termin          VARCHAR(32) NOT NULL DEFAULT 'Net 30 Hari',
    status          VARCHAR(24) NOT NULL CHECK (status IN ('draft', 'menunggu_stok', 'dikonfirmasi', 'dikirim', 'selesai', 'batal')),
    total           BIGINT NOT NULL DEFAULT 0
);

-- 8. Tabel Rincian Item Pesanan
CREATE TABLE order_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id        VARCHAR(48) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    batch_id        UUID REFERENCES product_batches(id),
    qty             INTEGER NOT NULL CHECK (qty > 0),
    harga_satuan    BIGINT  NOT NULL,
    subtotal        BIGINT  NOT NULL
);

-- 9. Tabel Buku Besar Stok Imutabel (Stock Ledger)
CREATE TABLE stock_ledger (
    id              VARCHAR(32) PRIMARY KEY,
    product_id      UUID NOT NULL REFERENCES products(id),
    batch_id        UUID REFERENCES product_batches(id),
    order_id        VARCHAR(48) REFERENCES orders(id),
    tipe            VARCHAR(20) NOT NULL CHECK (tipe IN ('masuk', 'keluar', 'penyesuaian', 'retur')),
    qty             INTEGER NOT NULL,
    saldo_setelah   INTEGER NOT NULL,
    dibuat_oleh     UUID REFERENCES users(id),
    checksum_hash   VARCHAR(32) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Tabel Peringatan Stok Menipis (Low-Stock & Near-Expiry Alerts)
CREATE TABLE alerts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id      UUID NOT NULL REFERENCES products(id),
    saldo           INTEGER NOT NULL,
    ambang          INTEGER NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'baru' CHECK (status IN ('baru', 'dibaca', 'ditangani')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_outlet_tanggal ON orders(outlet_id, tanggal DESC);
CREATE INDEX idx_visits_sales_checkin  ON visits(sales_id, checkin_at DESC);
CREATE INDEX idx_ledger_product_time   ON stock_ledger(product_id, created_at DESC);
