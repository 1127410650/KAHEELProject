-- Public store images (logo/cover/item photos) live under stores/<storefront_id>/…
create policy "mkt_store_media_public_read"
on storage.objects for select
using (
  bucket_id = 'mkt-media'
  and (storage.foldername(name))[1] = 'stores'
  and public.mkt_store_visible(nullif((storage.foldername(name))[2], '')::uuid)
);

-- Delivery-permit documents: owner or authorised admin only (signed URLs).
create policy "mkt_store_docs_private_read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'mkt-media'
  and (storage.foldername(name))[1] = 'store-docs'
  and (
    public.mkt_store_manage(nullif((storage.foldername(name))[2], '')::uuid)
    or public.mkt_store_admin()
  )
);