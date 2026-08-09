insert into public.mkt_platform_settings (key, section, value, description_ar)
values (
  'popup.pacing',
  'popup_pacing',
  jsonb_build_object(
    'first_delay_ms', 45000,
    'interval_ms', 210000,
    'max_per_session', 5,
    'auto_dismiss_ms', 7000,
    'page_settle_ms', 3000,
    'enabled', true
  ),
  'إيقاع ظهور البطاقات الترويجية الخفيفة: المهلة الأولى، الفاصل، الحد الأقصى في الجلسة، مدة الاختفاء التلقائي.'
)
on conflict (key) do nothing;

grant select on public.mkt_platform_settings to anon;

drop policy if exists "public read popup pacing" on public.mkt_platform_settings;
create policy "public read popup pacing"
  on public.mkt_platform_settings
  for select
  to anon, authenticated
  using (section = 'popup_pacing');
