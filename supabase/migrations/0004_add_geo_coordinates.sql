-- ============================================================
-- SAFIRA — Tambah koordinat GPS untuk peta pelacakan asli
-- (products.lokasi_produksi & distribution_logs.lokasi_transit
-- sebelumnya cuma teks; sekarang ditambah lat/lng opsional
-- supaya halaman Tracking bisa gambar rute di peta beneran)
-- ============================================================

alter table products
  add column if not exists produksi_lat numeric,
  add column if not exists produksi_lng numeric;

alter table distribution_logs
  add column if not exists lat numeric,
  add column if not exists lng numeric;

-- Catatan: kolom ini SENGAJA tidak dimasukkan ke perhitungan
-- record_hash (lihat create-product & log-distribution) supaya
-- tidak mengubah skema hash-chain yang sudah berjalan. Koordinat
-- bersifat metadata tampilan, bukan bagian dari data yang
-- diverifikasi keasliannya.
