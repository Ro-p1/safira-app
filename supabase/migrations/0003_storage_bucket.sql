-- ============================================================
-- SAFIRA — Storage bucket untuk foto produk
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-photos', 'product-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Siapa saja boleh melihat foto produk (publik, sesuai transparansi rantai pasok)
create policy "product_photos_select_all"
  on storage.objects for select
  using (bucket_id = 'product-photos');

-- Hanya user yang sudah login (producer) yang boleh upload
create policy "product_photos_insert_authenticated"
  on storage.objects for insert
  with check (bucket_id = 'product-photos' and auth.role() = 'authenticated');
