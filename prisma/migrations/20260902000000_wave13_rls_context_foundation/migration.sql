-- Wave 13 F02: PostgreSQL tenant-context foundation.
-- This migration deliberately does NOT enable RLS on every table yet.
-- Application queries must first adopt withTenantContext() so existing
-- pooled Prisma connections cannot be broken by a partial rollout.

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_tenant_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '');
$$;

CREATE OR REPLACE FUNCTION app.require_tenant_context()
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  tenant_id text;
BEGIN
  tenant_id := app.current_tenant_id();
  IF tenant_id IS NULL THEN
    RAISE EXCEPTION 'TENANT_CONTEXT_REQUIRED';
  END IF;
  RETURN tenant_id;
END;
$$;

COMMENT ON FUNCTION app.current_tenant_id() IS
  'Returns the transaction-local tenant identity; NULL means fail closed.';
COMMENT ON FUNCTION app.require_tenant_context() IS
  'Raises TENANT_CONTEXT_REQUIRED when no tenant is bound to the transaction.';
