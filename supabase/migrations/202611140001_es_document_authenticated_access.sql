-- Issue #39: some existing projects have no authenticated privileges on this
-- table, so PostgREST returns 42501 even after login. Keep ownership in RLS.
-- Refuse to grant access if the prerequisite RLS setup has not been applied.
do $$
begin
  if not exists (
    select 1 from pg_class
    where oid = to_regclass('public.es_documents') and relrowsecurity
  ) then
    raise exception 'Apply the MVP schema/RLS migration before granting ES access';
  end if;

  if not exists (
    select 1 from pg_policy
    where polrelid = to_regclass('public.es_documents')
      and polname = 'Users can manage ES documents for own companies'
      and polcmd = '*'
      and polqual is not null and polwithcheck is not null
  ) then
    raise exception 'The ES company ownership RLS policy is required before granting access';
  end if;
end;
$$;

-- No anonymous access, service-role bypass, TRUNCATE, or schema-wide grants.
grant select, insert, update, delete on table public.es_documents to authenticated;
