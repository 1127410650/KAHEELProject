UPDATE public.mkt_platform_settings
SET value = jsonb_build_object('enabled', true, 'first_delay_ms', 3000, 'interval_ms', 4000, 'auto_dismiss_ms', 2500, 'max_per_session', 5, 'page_settle_ms', 1000)
WHERE key = 'popup.pacing';