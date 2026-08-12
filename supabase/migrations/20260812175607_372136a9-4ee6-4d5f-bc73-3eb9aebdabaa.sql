-- 1) Unified permission catalog: the single source of truth for permission keys.
CREATE TABLE IF NOT EXISTS public.mkt_permission_catalog (
  perm_key text PRIMARY KEY,
  module text NOT NULL,
  action text NOT NULL,
  label_ar text NOT NULL,
  label_en text NOT NULL,
  description_ar text NOT NULL DEFAULT '',
  description_en text NOT NULL DEFAULT '',
  sort integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mkt_permission_catalog TO authenticated;
GRANT ALL ON public.mkt_permission_catalog TO service_role;

ALTER TABLE public.mkt_permission_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog readable by platform admins" ON public.mkt_permission_catalog;
CREATE POLICY "catalog readable by platform admins"
  ON public.mkt_permission_catalog FOR SELECT TO authenticated
  USING (public.mkt_is_platform_admin());

DROP TRIGGER IF EXISTS trg_mkt_permission_catalog_updated ON public.mkt_permission_catalog;
CREATE TRIGGER trg_mkt_permission_catalog_updated
  BEFORE UPDATE ON public.mkt_permission_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Seed: only keys that are actually enforced by a database function or an RLS policy.
INSERT INTO public.mkt_permission_catalog (perm_key, module, action, label_ar, label_en, description_ar, description_en, sort) VALUES
  ('platform.work','console','view','عرض لوحة الأعمال','View work console','فتح لوحة «أعمالي» التشغيلية.','Open the operational work console.',10),
  ('work.view','console','view','عرض طوابير العمل','View work queues','عرض طوابير المهام المسندة.','View assigned task queues.',11),
  ('jobs.receive','console','execute','استلام المهام','Receive assignments','استلام المهام الموزّعة آليًا.','Receive auto-distributed assignments.',12),

  ('users.view','users','view','عرض المستخدمين','View users','قراءة قائمة المستخدمين وملفاتهم الإدارية.','Read the user list and their administrative files.',20),
  ('users.manage','users','update','إدارة المستخدمين','Manage users','تعديل بيانات المستخدم الإدارية.','Update administrative user data.',21),
  ('accounts.restrict','users','update','تقييد الحسابات','Restrict accounts','فرض قيد على حساب مستخدم ورفعه.','Apply and lift restrictions on a user account.',22),
  ('accounts.suspend','users','approve','إيقاف الحسابات','Suspend accounts','إيقاف حساب مستخدم أو حظره.','Suspend or ban a user account.',23),
  ('restrictions.manage','users','manage','إدارة القيود','Manage restrictions','إدارة سجل القيود على الحسابات.','Manage the account restriction register.',24),
  ('staff.sessions_revoke','users','execute','إلغاء جلسات المستخدم','Revoke user sessions','إجبار مستخدم على الخروج من كل الأجهزة.','Force a user out of every device.',25),

  ('businesses.view','accounts','view','عرض المنشآت','View businesses','قراءة ملفات المنشآت والكيانات.','Read business and entity files.',30),
  ('businesses.manage','accounts','update','إدارة المنشآت','Manage businesses','تعديل بيانات المنشأة الإدارية.','Update administrative business data.',31),
  ('businesses.suspend','accounts','approve','إيقاف المنشآت','Suspend businesses','إيقاف منشأة عن العمل.','Suspend a business.',32),
  ('businesses.revoke_verification','accounts','approve','سحب توثيق المنشأة','Revoke business verification','سحب علامة التوثيق من منشأة.','Revoke a business verification mark.',33),

  ('listings.view','listings','view','عرض الإعلانات','View listings','قراءة الإعلانات في لوحة الإدارة.','Read listings inside the console.',40),
  ('listings.review','listings','approve','مراجعة الإعلانات','Review listings','اعتماد أو رفض الإعلانات المعلّقة.','Approve or reject pending listings.',41),
  ('ads.moderation_hide','listings','update','إخفاء إعلان','Hide a listing','إخفاء إعلان عن العرض العام.','Hide a listing from public view.',42),
  ('ads.moderation_suspend','listings','approve','إيقاف إعلان','Suspend a listing','إيقاف إعلان مؤقتًا.','Temporarily suspend a listing.',43),
  ('ads.moderation_unsuspend','listings','approve','رفع إيقاف إعلان','Unsuspend a listing','إعادة إعلان موقوف إلى العمل.','Return a suspended listing to service.',44),
  ('ads.moderation_request_edit','listings','execute','طلب تعديل إعلان','Request a listing edit','مطالبة المعلن بتعديل إعلانه.','Ask the advertiser to edit their listing.',45),
  ('ads.moderation_archive','listings','delete','أرشفة إعلان','Archive a listing','أرشفة إعلان دون حذفه.','Archive a listing without deleting it.',46),
  ('ads.moderation_extend','listings','update','تمديد إعلان','Extend a listing','تمديد مدة نشر الإعلان.','Extend a listing publication period.',47),
  ('ads.events_view','listings','view','عرض أحداث الإعلانات','View listing events','قراءة سجل أحداث الإعلانات.','Read the listing event log.',48),
  ('ads.view_ip_device','listings','view','عرض بيانات الجهاز','View device data','عرض عنوان الشبكة والجهاز في الأحداث.','See network and device data in events.',49),

  ('content.view','content','view','عرض المحتوى','View content','قراءة صفحات المحتوى ومسوّداتها.','Read content pages and drafts.',50),
  ('content.edit','content','update','تعديل المحتوى','Edit content','تعديل صفحات المحتوى وكتلها.','Edit content pages and their blocks.',51),
  ('content.publish','content','approve','نشر المحتوى','Publish content','نشر صفحة محتوى بعد فحصها.','Publish a content page after preflight.',52),
  ('content.campaigns','content','manage','إدارة الحملات','Manage campaigns','إدارة الحملات ومواضعها.','Manage campaigns and their placements.',53),

  ('reports.inbox_view','reports','view','عرض صندوق البلاغات','View report inbox','قراءة البلاغات الواردة.','Read incoming reports.',60),
  ('reports.view','reports','view','عرض البلاغ','View a report','فتح تفاصيل بلاغ.','Open a report detail view.',61),
  ('reports.review','reports','approve','مراجعة البلاغات','Review reports','تغيير حالة البلاغ واتخاذ القرار.','Change report status and decide.',62),
  ('reports.manage','reports','manage','إدارة البلاغات','Manage reports','إدارة كاملة لدورة حياة البلاغ.','Full report lifecycle management.',63),
  ('reports.assign','reports','assign','إسناد البلاغات','Assign reports','إسناد البلاغ إلى موظف.','Assign a report to a staff member.',64),
  ('reports.close','reports','approve','إغلاق البلاغ','Close a report','إغلاق بلاغ بعد معالجته.','Close a report after handling.',65),
  ('reports.reopen','reports','update','إعادة فتح البلاغ','Reopen a report','إعادة فتح بلاغ مغلق.','Reopen a closed report.',66),
  ('reports.escalate','reports','execute','تصعيد البلاغ','Escalate a report','تصعيد البلاغ لجهة أعلى.','Escalate a report upward.',67),
  ('reports.merge','reports','execute','دمج البلاغات','Merge reports','دمج بلاغات متكررة.','Merge duplicate reports.',68),
  ('reports.add_internal_note','reports','create','إضافة ملاحظة داخلية','Add internal note','كتابة ملاحظة داخلية على البلاغ.','Write an internal note on a report.',69),
  ('reports.message_advertiser','reports','execute','مراسلة المعلن','Message the advertiser','مراسلة صاحب الإعلان في البلاغ.','Message the listing owner about a report.',70),
  ('reports.message_reporter','reports','execute','مراسلة المُبلِّغ','Message the reporter','مراسلة مقدّم البلاغ.','Message the person who reported.',71),
  ('reports.audit_view','reports','view','عرض تدقيق البلاغات','View report audit','قراءة سجل تدقيق البلاغات.','Read the report audit trail.',72),
  ('reports.view_reporter_identity','reports','view','عرض هوية المُبلِّغ','View reporter identity','كشف هوية مقدّم البلاغ.','Reveal the reporter identity.',73),
  ('appeals.review','reports','approve','مراجعة التظلمات','Review appeals','النظر في التظلمات والبتّ فيها.','Review and decide appeals.',74),
  ('notes.read','reports','view','قراءة الملاحظات الإدارية','Read admin notes','قراءة الملاحظات الإدارية الداخلية.','Read internal administrative notes.',75),
  ('notes.write','reports','create','كتابة الملاحظات الإدارية','Write admin notes','كتابة ملاحظة إدارية داخلية.','Write an internal administrative note.',76),

  ('verifications.view','verifications','view','عرض طلبات التوثيق','View verifications','قراءة طلبات التوثيق.','Read verification requests.',80),
  ('verifications.review','verifications','approve','مراجعة التوثيق','Review verifications','اعتماد أو رفض طلب توثيق.','Approve or reject a verification request.',81),
  ('verifications.manage','verifications','manage','إدارة التوثيق','Manage verifications','إدارة كاملة لملف التوثيق.','Full verification file management.',82),
  ('docs.view_sensitive','verifications','view','عرض المستندات الحساسة','View sensitive documents','فتح المستندات الرسمية المرفقة.','Open attached official documents.',83),

  ('support.view','support','view','عرض تذاكر الدعم','View support tickets','قراءة تذاكر الدعم.','Read support tickets.',90),
  ('support.manage','support','manage','إدارة الدعم','Manage support','الرد على التذاكر وتغيير حالتها.','Reply to tickets and change status.',91),

  ('analytics.view','analytics','view','عرض التحليلات','View analytics','قراءة تقارير التحليلات.','Read analytics reports.',100),
  ('analytics.admin','analytics','manage','إدارة التحليلات','Manage analytics','إعدادات التحليلات والتقارير الخام.','Analytics settings and raw reports.',101),
  ('data.export','analytics','export','تصدير البيانات','Export data','تصدير البيانات مع تسجيل السبب.','Export data with a recorded reason.',102),

  ('workforce.manage','workforce','manage','إدارة توزيع الأعمال','Manage workforce','توزيع الأعمال وإدارة الموظفين.','Distribute work and manage staff.',110),
  ('workforce.override','workforce','execute','تجاوز التوزيع الآلي','Override distribution','تجاوز نتيجة التوزيع الآلي.','Override the automatic distribution result.',111),
  ('attendance.view','workforce','view','عرض الحضور','View attendance','قراءة سجلات الحضور.','Read attendance records.',112),
  ('attendance.manage','workforce','update','إدارة الحضور','Manage attendance','تعديل سجلات الحضور.','Edit attendance records.',113),
  ('attendance.approve','workforce','approve','اعتماد الحضور','Approve attendance','اعتماد تعديلات الحضور.','Approve attendance edits.',114),
  ('departments.manage','workforce','manage','إدارة الأقسام','Manage departments','إدارة الأقسام والتخصصات.','Manage departments and specialties.',115),

  ('ads.credit_manage','finance','manage','إدارة رصيد الإعلانات','Manage ad credit','إدارة محافظ رصيد الإعلانات.','Manage advertising credit wallets.',120),

  ('platform.health.view','platform','view','عرض صحة المنصة','View platform health','قراءة لوحات الصحة والموثوقية.','Read health and reliability boards.',130),
  ('platform.slo.manage','platform','manage','إدارة أهداف الخدمة','Manage SLOs','تعديل أهداف مستوى الخدمة.','Edit service level objectives.',131),
  ('platform.incidents.manage','platform','manage','إدارة الحوادث','Manage incidents','فتح الحوادث وإدارتها وإغلاقها.','Open, manage and close incidents.',132),
  ('platform.dependencies.view','platform','view','عرض الاعتماديات','View dependencies','قراءة خريطة اعتماديات المنصة.','Read the platform dependency map.',133),
  ('jobs.manage','platform','manage','إدارة المهام الخلفية','Manage background jobs','إدارة طابور المهام وتشغيلها.','Manage and run the job queue.',134),
  ('flags.manage','platform','manage','إدارة مفاتيح الميزات','Manage feature flags','تشغيل الميزات وإيقافها الطارئ.','Enable features and emergency stops.',135),
  ('settings.manage','platform','manage','إدارة الإعدادات','Manage settings','تعديل إعدادات المنصة.','Edit platform settings.',136),

  ('audit.view','audit','view','عرض سجل التدقيق','View audit log','قراءة سجل التدقيق وسجل العمليات.','Read the audit and operations log.',140),
  ('calls.audit_view','audit','view','عرض تدقيق المكالمات','View call audit','قراءة سجل تدقيق المكالمات.','Read the call audit log.',141)
ON CONFLICT (perm_key) DO UPDATE
  SET module = EXCLUDED.module, action = EXCLUDED.action,
      label_ar = EXCLUDED.label_ar, label_en = EXCLUDED.label_en,
      description_ar = EXCLUDED.description_ar, description_en = EXCLUDED.description_en,
      sort = EXCLUDED.sort, updated_at = now();

-- 3) Deny-by-default on the single-permission function: catalog keys only,
--    and nobody may edit their own permissions.
CREATE OR REPLACE FUNCTION public.mkt_admin_set_staff_perm(_user_id uuid, _perm text, _granted boolean, _reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public.mkt_is_system_owner() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF btrim(COALESCE(_reason,'')) = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  IF btrim(COALESCE(_perm,'')) = '' THEN RAISE EXCEPTION 'A permission is required'; END IF;
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change your own permissions';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mkt_permission_catalog c WHERE c.perm_key = btrim(_perm)) THEN
    RAISE EXCEPTION 'Unknown permission key';
  END IF;
  IF EXISTS (SELECT 1 FROM public.mkt_platform_admins a
              WHERE a.user_id = _user_id AND a.platform_role = 'system_owner')
     AND _granted = false THEN
    RAISE EXCEPTION 'System owner permissions cannot be reduced here';
  END IF;

  IF _granted THEN
    INSERT INTO public.mkt_staff_permissions (user_id, perm, created_by)
    VALUES (_user_id, btrim(_perm), auth.uid())
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.mkt_staff_permissions WHERE user_id = _user_id AND perm = btrim(_perm);
  END IF;

  PERFORM public.log_audit('mkt_staff_permission', CASE WHEN _granted THEN 'grant' ELSE 'revoke' END,
    _user_id, NULL, jsonb_build_object('perm', btrim(_perm)), btrim(_reason));
END $function$;

-- 4) Atomic multi-permission save with full audit diff.
CREATE OR REPLACE FUNCTION public.mkt_admin_save_staff_perms(_user_id uuid, _perms text[], _reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  wanted text[];
  before_perms text[];
  added text[];
  removed text[];
  op_id uuid := gen_random_uuid();
  unknown_keys text[];
BEGIN
  IF NOT public.mkt_is_system_owner() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF btrim(COALESCE(_reason,'')) = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  IF _user_id IS NULL THEN RAISE EXCEPTION 'A target user is required'; END IF;
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change your own permissions';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT btrim(p)), '{}'::text[]) INTO wanted
    FROM unnest(COALESCE(_perms, '{}'::text[])) AS p
   WHERE btrim(COALESCE(p,'')) <> '';

  SELECT COALESCE(array_agg(k), '{}'::text[]) INTO unknown_keys
    FROM unnest(wanted) k
   WHERE NOT EXISTS (SELECT 1 FROM public.mkt_permission_catalog c WHERE c.perm_key = k);
  IF array_length(unknown_keys, 1) > 0 THEN
    RAISE EXCEPTION 'Unknown permission key: %', unknown_keys[1];
  END IF;

  -- Serialise concurrent edits of the same target: the second session waits and
  -- then recomputes its diff against the committed state.
  PERFORM 1 FROM public.mkt_staff_permissions WHERE user_id = _user_id FOR UPDATE;
  PERFORM pg_advisory_xact_lock(hashtext('mkt_staff_perms:' || _user_id::text));

  SELECT COALESCE(array_agg(DISTINCT perm), '{}'::text[]) INTO before_perms
    FROM public.mkt_staff_permissions WHERE user_id = _user_id;

  SELECT COALESCE(array_agg(k), '{}'::text[]) INTO added
    FROM unnest(wanted) k WHERE NOT (k = ANY (before_perms));
  SELECT COALESCE(array_agg(k), '{}'::text[]) INTO removed
    FROM unnest(before_perms) k WHERE NOT (k = ANY (wanted));

  IF array_length(removed, 1) > 0
     AND EXISTS (SELECT 1 FROM public.mkt_platform_admins a
                  WHERE a.user_id = _user_id AND a.platform_role = 'system_owner') THEN
    RAISE EXCEPTION 'System owner permissions cannot be reduced here';
  END IF;

  IF array_length(removed, 1) > 0 THEN
    DELETE FROM public.mkt_staff_permissions
     WHERE user_id = _user_id AND perm = ANY (removed);
  END IF;

  IF array_length(added, 1) > 0 THEN
    INSERT INTO public.mkt_staff_permissions (user_id, perm, created_by)
    SELECT _user_id, k, auth.uid() FROM unnest(added) k
    ON CONFLICT DO NOTHING;
  END IF;

  PERFORM public.log_audit('mkt_staff_permission', 'bulk_update', _user_id,
    jsonb_build_object('perms', before_perms),
    jsonb_build_object('perms', wanted, 'added', added, 'removed', removed,
                       'operation_id', op_id),
    btrim(_reason));

  INSERT INTO public.mkt_ops_log (actor_user_id, action, unit, entity, entity_id, summary, meta)
  VALUES (auth.uid(), 'access_control.perms_updated', 'platform', 'user', _user_id::text,
    format('%s granted, %s revoked', COALESCE(array_length(added,1),0), COALESCE(array_length(removed,1),0)),
    jsonb_build_object('operation_id', op_id, 'before', before_perms, 'after', wanted,
                       'added', added, 'removed', removed, 'reason', btrim(_reason),
                       'actor', auth.uid()));

  PERFORM public.mkt_notify(_user_id, NULL, 'admin_role_changed', 'تم تحديث صلاحياتك الإدارية', NULL);

  RETURN jsonb_build_object('operation_id', op_id, 'before', before_perms,
                            'after', wanted, 'added', added, 'removed', removed);
END $function$;

REVOKE ALL ON FUNCTION public.mkt_admin_save_staff_perms(uuid, text[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_admin_save_staff_perms(uuid, text[], text) TO authenticated;

-- 5) Catalog reader for the console (platform admins only).
CREATE OR REPLACE FUNCTION public.mkt_permission_catalog_list()
 RETURNS TABLE(perm_key text, module text, action text, label_ar text, label_en text,
               description_ar text, description_en text, sort integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
  SELECT c.perm_key, c.module, c.action, c.label_ar, c.label_en,
         c.description_ar, c.description_en, c.sort
    FROM public.mkt_permission_catalog c
   ORDER BY c.sort, c.perm_key;
END $function$;

REVOKE ALL ON FUNCTION public.mkt_permission_catalog_list() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_permission_catalog_list() TO authenticated;