CREATE OR REPLACE FUNCTION public.enforce_request_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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

  if TG_OP = 'UPDATE' and auth.uid() is not null and not public.is_accountant() then
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
end $function$;

UPDATE public.requests
SET status = 'needs_info',
    status_note = 'تم إرجاع الطلب لأن رقم السداد غير مُدخل — Returned: payment number missing'
WHERE status = 'awaiting_payment'
  AND coalesce(btrim(payment_no), '') = ''
  AND deleted_at IS NULL;