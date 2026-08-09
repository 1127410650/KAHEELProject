INSERT INTO public.mkt_platform_settings (key, section, value, description_ar) VALUES
  ('assets.watermark', 'assets',
   '{"enabled": true, "position": "bottom-left", "opacity": 50, "sizePct": 3.2, "text": "كَحيل · KAHEEL", "url": "kaheel.market"}'::jsonb,
   'العلامة المائية وحقوق الأصول البصرية')
ON CONFLICT (key) DO NOTHING;