alter table public.requests
  add column if not exists authority text,
  add column if not exists status_note text,
  add column if not exists final_result text,
  add column if not exists payment_no text,
  add column if not exists payment_amount numeric(14,2),
  add column if not exists payment_beneficiary text,
  add column if not exists payment_expiry date,
  add column if not exists payment_note text,
  add column if not exists paid_at date,
  add column if not exists payment_method text,
  add column if not exists payment_reference text;

alter table public.attachments
  add column if not exists stage_id uuid references public.request_status_history(id) on delete set null,
  add column if not exists note text,
  add column if not exists kind text;

create unique index if not exists attachments_storage_path_key
  on public.attachments (storage_path);

create index if not exists attachments_entity_idx
  on public.attachments (entity_type, entity_id);

create index if not exists requests_supervisor_idx on public.requests (supervisor_id);
create index if not exists requests_project_idx on public.requests (project_id);

create or replace function public.log_request_status()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.request_status_history (request_id, from_status, to_status, actor_id, note)
    VALUES (NEW.id, NULL, NEW.status, auth.uid(), NULLIF(btrim(coalesce(NEW.status_note, '')), ''));
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.request_status_history (request_id, from_status, to_status, actor_id, note)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), NULLIF(btrim(coalesce(NEW.status_note, '')), ''));
  END IF;
  RETURN NEW;
END; $function$;

create or replace function public.enforce_request_rules()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_receipts int;
begin
  if NEW.status = 'awaiting_payment' and coalesce(btrim(NEW.payment_no), '') = '' then
    raise exception 'PAYMENT_NO_REQUIRED';
  end if;

  if NEW.status = 'paid' then
    if NEW.paid_at is null then
      raise exception 'PAID_DATE_REQUIRED';
    end if;
    select count(*) into v_receipts
    from public.attachments a
    where a.entity_type = 'request'
      and a.entity_id = NEW.id
      and a.kind = 'payment_receipt'
      and a.deleted_at is null;
    if v_receipts = 0 then
      raise exception 'PAYMENT_RECEIPT_REQUIRED';
    end if;
  end if;

  if TG_OP = 'UPDATE' and not public.is_accountant() then
    if NEW.status is distinct from OLD.status then
      raise exception 'STATUS_CHANGE_FORBIDDEN';
    end if;
    if OLD.status in ('paid', 'completed')
       and (NEW.payment_no is distinct from OLD.payment_no
            or NEW.paid_at is distinct from OLD.paid_at) then
      raise exception 'PAYMENT_LOCKED';
    end if;
  end if;

  return NEW;
end $$;

revoke execute on function public.enforce_request_rules() from public;

drop trigger if exists requests_enforce_rules on public.requests;
create trigger requests_enforce_rules
  before insert or update on public.requests
  for each row execute function public.enforce_request_rules();

drop policy if exists requests_update_allowed on public.requests;
create policy requests_update_allowed on public.requests
  for update to authenticated
  using (public.is_accountant() or (public.can_access_project(project_id) and status <> 'cancelled'))
  with check (public.is_accountant() or (public.can_access_project(project_id) and status <> 'cancelled'));
