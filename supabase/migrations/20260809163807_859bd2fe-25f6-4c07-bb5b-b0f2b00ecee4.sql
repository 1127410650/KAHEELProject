UPDATE public.mkt_platform_settings
SET value = jsonb_build_object('enabled', true, 'first_delay_ms', 45000, 'interval_ms', 210000, 'auto_dismiss_ms', 7000, 'max_per_session', 5, 'page_settle_ms', 3000)
WHERE key = 'popup.pacing';