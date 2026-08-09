UPDATE public.mkt_platform_settings
SET value = jsonb_build_object('enabled', true, 'first_delay_ms', 1500, 'interval_ms', 4000, 'auto_dismiss_ms', 7000, 'max_per_session', 5, 'page_settle_ms', 500)
WHERE key = 'popup.pacing';