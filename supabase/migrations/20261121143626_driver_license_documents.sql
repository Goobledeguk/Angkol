insert into storage.buckets (id, name, public)
values ('driver-documents', 'driver-documents', false)
on conflict do nothing;

drop policy if exists insert_own_license_document on storage.objects;
create policy insert_own_license_document on storage.objects
for insert to authenticated
with check (
  bucket_id = 'driver-documents'
  and name = 'license/' || (select auth.uid())::text || '.jpg'
  and (select public.my_role()) in ('Tricycle driver', 'PUJ / PUV driver')
);

drop policy if exists update_own_license_document on storage.objects;
create policy update_own_license_document on storage.objects
for update to authenticated
using (
  bucket_id = 'driver-documents'
  and name = 'license/' || (select auth.uid())::text || '.jpg'
  and (select public.my_role()) in ('Tricycle driver', 'PUJ / PUV driver')
)
with check (
  bucket_id = 'driver-documents'
  and name = 'license/' || (select auth.uid())::text || '.jpg'
  and (select public.my_role()) in ('Tricycle driver', 'PUJ / PUV driver')
);

drop policy if exists read_license_document on storage.objects;
create policy read_license_document on storage.objects
for select to authenticated
using (
  bucket_id = 'driver-documents'
  and (
    (select public.is_admin())
    or (
      name = 'license/' || (select auth.uid())::text || '.jpg'
      and (select public.my_role()) in ('Tricycle driver', 'PUJ / PUV driver')
    )
  )
);
