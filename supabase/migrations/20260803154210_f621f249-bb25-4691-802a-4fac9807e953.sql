INSERT INTO public.mkt_platform_admins (user_id)
SELECT p.user_id FROM public.profiles p WHERE p.national_id = '1150110474'
ON CONFLICT DO NOTHING;