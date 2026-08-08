-- Fix the advisor warning for the appointment-only distance helper.
-- The empty search path is immutable and the helper touches no tables.

CREATE OR REPLACE FUNCTION public.appt_distance_km(
  _latitude_a double precision,
  _longitude_a double precision,
  _latitude_b double precision,
  _longitude_b double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = ''
AS $$
  SELECT 6371.0088 * 2 * asin(sqrt(least(1.0, greatest(0.0,
    power(sin(radians((_latitude_b - _latitude_a) / 2)), 2)
    + cos(radians(_latitude_a))
      * cos(radians(_latitude_b))
      * power(sin(radians((_longitude_b - _longitude_a) / 2)), 2)
  ))))
$$;

REVOKE ALL ON FUNCTION public.appt_distance_km(
  double precision,
  double precision,
  double precision,
  double precision
) FROM PUBLIC, anon, authenticated;
