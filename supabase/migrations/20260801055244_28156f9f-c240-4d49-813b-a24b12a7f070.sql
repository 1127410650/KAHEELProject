ALTER TABLE public.custody_transactions DISABLE TRIGGER USER;

UPDATE public.custody_transactions
SET deleted_at = now(), delete_reason = 'أرشفة بيانات اختبار TEST-PROPERTY'
WHERE deleted_at IS NULL
  AND (notes_ar ILIKE '%TEST-PROPERTY%' OR notes_en ILIKE '%TEST-PROPERTY%'
       OR project_id IN (SELECT id FROM public.projects WHERE code ILIKE '%TEST-PROPERTY%' OR name_ar ILIKE '%TEST-PROPERTY%'));

ALTER TABLE public.custody_transactions ENABLE TRIGGER USER;

UPDATE public.supervisors
SET deleted_at = now()
WHERE deleted_at IS NULL AND (name_ar ILIKE '%TEST-PROPERTY%' OR name_en ILIKE '%TEST-PROPERTY%');