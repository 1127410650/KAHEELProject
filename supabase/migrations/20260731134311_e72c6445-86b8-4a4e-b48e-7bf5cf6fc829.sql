UPDATE public.attachments
SET deleted_at = now(),
    delete_reason = 'ملف اختباري — تم حذفه بعد التحقق من قيود السداد'
WHERE entity_type = 'request'
  AND kind = 'payment_receipt'
  AND file_name = 'receipt1.pdf';

UPDATE public.requests
SET status = 'needs_info',
    payment_no = NULL,
    paid_at = NULL,
    status_note = 'إعادة ضبط بعد الاختبار — يلزم إدخال رقم السداد الحقيقي'
WHERE request_no = '50';