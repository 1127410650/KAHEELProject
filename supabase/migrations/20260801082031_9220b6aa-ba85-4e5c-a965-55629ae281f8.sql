-- Soft-delete proven test requests only (no hard delete, no custody changes)
UPDATE public.requests
SET deleted_at = now(),
    delete_reason = 'تنظيف بيانات اختبار قبل الإطلاق'
WHERE tenant_id = 'f41c9729-4b27-4cd5-88a1-971946d1ecb8'
  AND deleted_at IS NULL
  AND id IN (
    '37b43a31-c371-4597-b457-924a81833a56', -- 00
    '05618816-8440-4c08-9923-19601be0b068', -- 11
    'cadb01f6-62f2-43b2-b1e7-2ad4ab0d9c64', -- AT-P1
    'e9702ab8-68f9-42ea-81c0-204be205b389', -- PR-260731-004 AT-عام سري
    'afabea90-13c7-4e9d-95fe-1d61e9f03861', -- PR-260731-005 AT-مشروع
    '5e243512-1b79-459d-8574-9a5c80c02dd5', -- PR-260731-007
    '952fe8df-a92f-4a83-a669-4de67b911a0a', -- PR-260731-008
    '0e456dad-442c-400e-850f-55d18adeaf49', -- PR-260731-009
    '0dd4fc6b-5429-4ba3-92c6-91d12f3bbb71', -- PR-260731-010
    '987b0c17-e77d-4ce3-8b09-75a3f67a6b36', -- PR-260731-011
    'ea3770b2-4d5d-475a-818c-066b61d88160'  -- PR-260731-012
  );

-- Silence notifications that now point at archived test requests (audit log untouched)
UPDATE public.notifications n
SET read_at = now()
WHERE n.read_at IS NULL
  AND n.request_id IN (
    SELECT r.id FROM public.requests r
    WHERE r.deleted_at IS NOT NULL
      AND r.delete_reason = 'تنظيف بيانات اختبار قبل الإطلاق'
  );
