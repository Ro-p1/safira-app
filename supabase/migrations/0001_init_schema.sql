-- ============================================================
-- SAFIRA — Skema Database Awal
-- Smart and Transparent Food Intelligent Risk Analysis
-- ============================================================

-- Extension untuk UUID
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. product_categories (data referensi, read-only untuk semua)
-- ============================================================
create table product_categories (
  id uuid primary key default gen_random_uuid(),
  nama_kategori text not null unique,
  suhu_aman_min numeric not null,
  suhu_aman_max numeric not null,
  kelembapan_aman_min numeric not null,
  kelembapan_aman_max numeric not null,
  masa_simpan_wajar_hari integer not null,
  dibuat_pada timestamptz not null default now()
);

insert into product_categories (nama_kategori, suhu_aman_min, suhu_aman_max, kelembapan_aman_min, kelembapan_aman_max, masa_simpan_wajar_hari) values
  ('Daging', -2, 4, 5, 15, 3),
  ('Sayur', 2, 8, 85, 95, 7),
  ('Buah', 4, 10, 80, 90, 10),
  ('Produk Olahan', 0, 6, 5, 20, 14);

-- ============================================================
-- 2. producers
-- ============================================================
create table producers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  nama text not null,
  kontak text not null,
  lokasi text not null,
  status_verifikasi text not null default 'pending' check (status_verifikasi in ('pending', 'approved', 'rejected')),
  dibuat_pada timestamptz not null default now()
);

-- ============================================================
-- 3. products (INSERT-ONLY, hash-chain, supersedes untuk koreksi)
-- ============================================================
create table products (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid not null references producers(id) on delete restrict,
  category_id uuid not null references product_categories(id),
  nama_produk text not null,
  lokasi_produksi text not null,
  tanggal_panen date not null,
  metode_produksi text,
  sertifikasi text[] not null default '{}',
  foto_url text,
  qr_code_value uuid not null default gen_random_uuid(),
  supersedes_id uuid references products(id),
  prev_hash text not null default 'GENESIS',
  record_hash text not null,
  dibuat_pada timestamptz not null default now()
);

create index idx_products_qr_code_value on products(qr_code_value);
create index idx_products_producer_id on products(producer_id);
create index idx_products_supersedes_id on products(supersedes_id);

-- ============================================================
-- 4. distribution_logs (INSERT-ONLY, hash-chain per produk)
-- ============================================================
create table distribution_logs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete restrict,
  lokasi_transit text not null,
  suhu numeric not null,
  kelembapan numeric not null,
  waktu_dicatat timestamptz not null default now(),
  nama_petugas text not null,
  prev_hash text not null default 'GENESIS',
  record_hash text not null
);

create index idx_distribution_logs_product_id on distribution_logs(product_id);

-- ============================================================
-- 5. risk_scores (INSERT-ONLY — riwayat skor, bukan overwrite)
-- ============================================================
create table risk_scores (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete restrict,
  freshness_score numeric not null,
  storage_score numeric not null,
  distribution_score numeric not null,
  compliance_score numeric not null,
  historical_score numeric not null,
  total_score numeric not null,
  status text not null check (status in ('AMAN', 'WASPADA', 'BERESIKO')),
  catatan_ai text,
  ai_status text not null default 'local' check (ai_status in ('local', 'ai', 'failed')),
  dihitung_pada timestamptz not null default now()
);

create index idx_risk_scores_product_id on risk_scores(product_id, dihitung_pada desc);

-- ============================================================
-- 6. scan_history
-- ============================================================
create table scan_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  waktu_scan timestamptz not null default now()
);

create index idx_scan_history_user_id on scan_history(user_id);
create index idx_scan_history_product_id on scan_history(product_id);

-- ============================================================
-- TRIGGER: Menolak UPDATE & DELETE pada tabel insert-only
-- ============================================================
create or replace function reject_mutation()
returns trigger as $$
begin
  raise exception 'Tabel % bersifat insert-only — UPDATE/DELETE tidak diizinkan. Gunakan insert record baru.', TG_TABLE_NAME;
end;
$$ language plpgsql;

create trigger trg_products_no_update
  before update or delete on products
  for each row execute function reject_mutation();

create trigger trg_distribution_logs_no_update
  before update or delete on distribution_logs
  for each row execute function reject_mutation();

create trigger trg_risk_scores_no_update
  before update or delete on risk_scores
  for each row execute function reject_mutation();

-- scan_history BOLEH di-delete (bukan bagian hash-chain, cuma histori scan)
