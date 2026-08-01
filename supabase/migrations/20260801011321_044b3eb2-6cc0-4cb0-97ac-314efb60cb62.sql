drop policy if exists invoice_files_update on storage.objects;
create policy invoice_files_update on storage.objects
  for update to authenticated
  using (bucket_id = 'invoice-files' and public.has_perm('invoices.save_verified') and public.can_access_invoice_object(name))
  with check (bucket_id = 'invoice-files' and public.has_perm('invoices.save_verified') and public.can_access_invoice_object(name));

drop policy if exists invoice_files_delete on storage.objects;
create policy invoice_files_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'invoice-files' and public.has_perm('invoices.delete') and public.can_access_invoice_object(name));