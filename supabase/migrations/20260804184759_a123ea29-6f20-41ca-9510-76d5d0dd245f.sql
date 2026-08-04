drop policy if exists mkt_chat_objects_read on storage.objects;
create policy mkt_chat_objects_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'mkt-chat'
    and public.mkt_can_view_conversation(nullif(split_part(name, '/', 1), '')::uuid)
  );

drop policy if exists mkt_chat_objects_insert on storage.objects;
create policy mkt_chat_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'mkt-chat'
    and owner = auth.uid()
    and public.mkt_can_view_conversation(nullif(split_part(name, '/', 1), '')::uuid)
  );

drop policy if exists mkt_chat_objects_delete on storage.objects;
create policy mkt_chat_objects_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'mkt-chat' and owner = auth.uid());