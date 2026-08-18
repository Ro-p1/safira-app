-- ============================================================
-- SAFIRA — Row Level Security Policies
-- ============================================================

alter table product_categories enable row level security;
alter table producers enable row level security;
alter table products enable row level security;
alter table distribution_logs enable row level security;
alter table risk_scores enable row level security;
alter table scan_history enable row level security;

-- ============================================================
-- product_categories: read-only untuk semua
-- ============================================================
create policy "product_categories_select_all"
  on product_categories for select
  using (true);

-- ============================================================
-- producers:
-- - Publik cuma boleh lihat nama, lokasi, status (lewat view producers_public)
-- - kontak & user_id CUMA boleh dibaca pemiliknya sendiri
-- - insert: user login boleh insert 1x untuk dirinya sendiri
-- ============================================================
create policy "producers_select_own"
  on producers for select
  using (auth.uid() = user_id);

create policy "producers_insert_own"
  on producers for insert
  with check (auth.uid() = user_id);

-- View publik yang cuma expose kolom aman (tanpa kontak/user_id)
create view producers_public as
  select id, nama, lokasi, status_verifikasi, dibuat_pada
  from producers
  where status_verifikasi = 'approved';

grant select on producers_public to anon, authenticated;

-- ============================================================
-- products: read publik. INSERT TIDAK diizinkan langsung dari client
-- (tidak ada insert policy untuk anon/authenticated) — semua insert
-- WAJIB lewat Edge Function `create-product` yang memakai service_role
-- (otomatis bypass RLS) supaya record_hash tidak bisa dipalsukan client.
-- ============================================================
create policy "products_select_all"
  on products for select
  using (true);

-- update/delete ditolak sepenuhnya lewat trigger reject_mutation (lihat migration 0001)

-- ============================================================
-- distribution_logs: read publik. INSERT juga WAJIB lewat Edge Function
-- `log-distribution` (service_role), dengan alasan yang sama.
-- ============================================================
create policy "distribution_logs_select_all"
  on distribution_logs for select
  using (true);

-- ============================================================
-- risk_scores: read publik, insert hanya lewat service role (Edge Function)
-- ============================================================
create policy "risk_scores_select_all"
  on risk_scores for select
  using (true);

-- Tidak ada insert policy untuk anon/authenticated — hanya service_role
-- (dipakai oleh Edge Function calculate-risk-score) yang bisa insert,
-- karena service_role otomatis bypass RLS di Supabase.

-- ============================================================
-- scan_history:
-- - insert boleh siapa saja (termasuk anon) untuk keperluan analitik
-- - select HANYA untuk pemilik sendiri (user login) — guest TIDAK bisa
--   query balik riwayatnya dari server (ditangani di localStorage client)
-- - delete boleh oleh pemiliknya sendiri
-- ============================================================
create policy "scan_history_insert_anyone"
  on scan_history for insert
  with check (true);

create policy "scan_history_select_own"
  on scan_history for select
  using (auth.uid() = user_id);

create policy "scan_history_delete_own"
  on scan_history for delete
  using (auth.uid() = user_id);
