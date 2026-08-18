# SAFIRA — Smart and Transparent Food Intelligent Risk Analysis

Aplikasi keamanan pangan berbasis Blockchain (hash-chain) + AI Risk Scoring (rule-based),
sesuai spesifikasi dari infografis SAFIRA & Universitas Sriwijaya.

## ⚠️ Yang WAJIB kamu lakukan secara manual sebelum app ini jalan

Kode ini sudah lengkap, tapi **belum otomatis terhubung ke Supabase** — kamu harus setup
manual langkah-langkah berikut:

### 1. Buat project Supabase
1. Buka [supabase.com](https://supabase.com), buat project baru (kalau kamu sudah punya
   project dari percobaan sebelumnya, boleh pakai project itu juga — tapi disarankan
   pakai project BARU yang kosong supaya tidak konflik dengan skema lama).
2. Catat **Project URL** dan **anon public key** dari Project Settings → API.

### 2. Jalankan migration SQL
1. Buka **SQL Editor** di dashboard Supabase.
2. Jalankan isi file `supabase/migrations/0001_init_schema.sql` — klik Run.
3. Jalankan isi file `supabase/migrations/0002_rls_policies.sql` — klik Run.
4. Jalankan isi file `supabase/migrations/0003_storage_bucket.sql` — klik Run.
   (Urutan penting — 0001 dulu baru 0002 lalu 0003.)

### 3. Deploy Edge Functions
Kamu butuh [Supabase CLI](https://supabase.com/docs/guides/cli) terpasang di komputer.

```bash
supabase login
supabase link --project-ref <project-ref-kamu>

supabase functions deploy calculate-risk-score
supabase functions deploy verify-chain
supabase functions deploy create-product
supabase functions deploy log-distribution
```

### 4. Set secrets (opsional — cuma kalau mau aktifkan narasi AI dari Anthropic)
```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
```
**Tanpa langkah ini pun app tetap jalan penuh** — narasi rekomendasi otomatis pakai
template rule-based lokal.

### 5. Aktifkan Database Webhook (supaya skor otomatis dihitung ulang)
1. Di dashboard Supabase → Database → Webhooks → Create a new hook.
2. Table: `distribution_logs`, Events: `INSERT`.
3. Type: **Supabase Edge Function**, pilih `calculate-risk-score`.
4. Simpan.

(Catatan: `log-distribution` Edge Function juga sudah memanggil `calculate-risk-score`
secara langsung sebagai jaga-jaga kalau kamu lupa/belum sempat setting webhook ini.)

### 6. Setup environment variable frontend
```bash
cp .env.example .env
```
Isi `.env` dengan Project URL dan anon key dari langkah 1.

### 7. Install dependency & jalankan
```bash
npm install
npm run dev
```
Buka `http://localhost:5173` di browser.

**Penting untuk fitur kamera scan QR**: browser hanya mengizinkan akses kamera lewat
`https://` atau `localhost`. Kalau mau test di HP asli, deploy dulu ke hosting (Vercel/
Netlify — keduanya gratis dan otomatis HTTPS), lalu buka link deploy-nya dari HP.

## Struktur project

```
src/
  pages/          — semua halaman (Onboarding, Scan, Tracking, HasilAnalisis, dst)
  components/     — komponen shared (BottomNav)
  lib/            — Supabase client, AuthContext, guest history helper
  types/          — TypeScript interfaces
supabase/
  migrations/     — SQL schema, RLS, storage bucket
  functions/      — 4 Edge Function (Deno)
```

## Alur pengujian end-to-end

1. Buka app → onboarding 4 slide muncul (akan muncul lagi tiap refresh, ini disengaja).
2. Klik "Mulai" → masuk halaman Scan.
3. Klik ikon Profil (bawah kanan) → Login/Daftar akun baru.
4. Setelah login, buka tab Produsen → isi form "Daftar sebagai Produsen".
5. **Approve manual**: buka Table Editor Supabase → tabel `producers` → ubah kolom
   `status_verifikasi` jadi `approved` untuk baris kamu (sistem approval otomatis belum
   ada, ini keputusan desain untuk versi awal).
6. Kembali ke app, refresh → tab Produsen sekarang menampilkan Dashboard Produsen.
7. Klik "Tambah Produk Baru", isi form, submit → QR code digenerate.
8. Klik "Catat Titik Distribusi" di halaman detail produk, isi 1-2 catatan.
9. Buka tab Scan → klik ikon keyboard (fallback manual) → masukkan `qr_code_value`
   produk yang tadi dibuat (bisa dilihat di bawah QR code) → lihat alur Track → Result.

## Keamanan yang sudah diterapkan (hasil pelajaran dari percobaan sebelumnya)

- Tabel `producers`: kolom `kontak` dan `user_id` **tidak bisa dibaca publik** — hanya
  pemiliknya sendiri (lewat RLS `auth.uid() = user_id`). Ada view `producers_public`
  untuk expose data aman (nama, lokasi, status) ke publik.
- `products`, `distribution_logs`, `risk_scores`: **insert-only**, trigger database
  menolak UPDATE/DELETE. Insert produk & distribusi **wajib** lewat Edge Function
  (bukan insert langsung dari client) supaya `record_hash` tidak bisa dipalsukan.
- `verify-chain` sudah menangani kasus produk pertama (prev_hash = GENESIS) sebagai
  otomatis valid — bug "Data Tidak Konsisten" pada produk baru dari percobaan
  sebelumnya sudah diperbaiki di logika ini.
- Riwayat scan guest disimpan di localStorage, bukan query balik ke server, supaya
  guest satu tidak bisa membaca riwayat guest lain.
