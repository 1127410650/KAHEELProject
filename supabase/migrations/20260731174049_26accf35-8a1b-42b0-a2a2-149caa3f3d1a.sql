CREATE SCHEMA IF NOT EXISTS backup_tiv;
REVOKE ALL ON SCHEMA backup_tiv FROM anon, authenticated;
DROP TABLE IF EXISTS backup_tiv.invoices_20260731;
CREATE TABLE backup_tiv.invoices_20260731 AS SELECT * FROM public.invoices;
DROP TABLE IF EXISTS backup_tiv.suppliers_20260731;
CREATE TABLE backup_tiv.suppliers_20260731 AS SELECT * FROM public.suppliers;
DROP TABLE IF EXISTS backup_tiv.attachments_20260731;
CREATE TABLE backup_tiv.attachments_20260731 AS SELECT * FROM public.attachments;

ALTER TYPE public.record_status ADD VALUE IF NOT EXISTS 'tech_verified';
ALTER TYPE public.record_status ADD VALUE IF NOT EXISTS 'needs_review';
ALTER TYPE public.record_status ADD VALUE IF NOT EXISTS 'rejected';