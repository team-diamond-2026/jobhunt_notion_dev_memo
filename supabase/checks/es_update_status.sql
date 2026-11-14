-- Read-only deployment check for Issue #39. Run in the target SQL Editor.
-- Every row must be true. This checks wiring/permissions, not saved UI behavior.
with checks(check_name, ok) as (
  select 'es_documents_exists', to_regclass('public.es_documents') is not null
  union all
  select 'version_integer_not_null_default_1', exists (
    select 1 from pg_attribute a
    join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where a.attrelid = to_regclass('public.es_documents')
      and a.attname = 'version' and not a.attisdropped and a.attnotnull
      and a.atttypid = 'integer'::regtype
      and pg_get_expr(d.adbin, d.adrelid) = '1'
  )
  union all
  select 'created_and_updated_at_timestamptz', (
    select count(*) = 2 from pg_attribute a
    where a.attrelid = to_regclass('public.es_documents')
      and a.attname in ('created_at', 'updated_at')
      and not a.attisdropped and a.attnotnull
      and a.atttypid = 'timestamp with time zone'::regtype
  )
  union all
  select 'version_before_update_trigger', exists (
    select 1 from pg_trigger t
    where t.tgrelid = to_regclass('public.es_documents')
      and t.tgname = 'increment_es_document_version_before_update'
      and t.tgenabled in ('O', 'A') and t.tgtype = 19
      and t.tgfoid = to_regprocedure('public.increment_es_document_version()')
  )
  union all
  select 'timestamp_before_update_trigger', exists (
    select 1 from pg_trigger t
    where t.tgrelid = to_regclass('public.es_documents')
      and t.tgname = 'touch_es_documents_updated_at'
      and t.tgenabled in ('O', 'A') and t.tgtype = 19
      and t.tgfoid = to_regprocedure('public.touch_updated_at()')
  )
  union all
  select 'row_level_security_enabled', coalesce((
    select relrowsecurity from pg_class where oid = to_regclass('public.es_documents')
  ), false)
  union all
  select 'company_ownership_policy_exists', exists (
    select 1 from pg_policy where polrelid = to_regclass('public.es_documents')
      and polname = 'Users can manage ES documents for own companies'
      and polqual is not null and polwithcheck is not null
  )
  union all
  select 'authenticated_select_insert_update_delete', coalesce(
    has_table_privilege(to_regrole('authenticated'), to_regclass('public.es_documents'), 'SELECT')
    and has_table_privilege(to_regrole('authenticated'), to_regclass('public.es_documents'), 'INSERT')
    and has_table_privilege(to_regrole('authenticated'), to_regclass('public.es_documents'), 'UPDATE')
    and has_table_privilege(to_regrole('authenticated'), to_regclass('public.es_documents'), 'DELETE'), false
  )
)
select check_name, ok from checks order by check_name;
