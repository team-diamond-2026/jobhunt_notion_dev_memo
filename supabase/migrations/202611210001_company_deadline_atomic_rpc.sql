-- Keep company and deadline writes in one transaction while preserving RLS.

create or replace function public.create_company_with_deadline(
  p_company_name text,
  p_industry_category text,
  p_industry text,
  p_motivation_level integer,
  p_selection_status text,
  p_memo text,
  p_deadline_title text,
  p_deadline_due_date timestamptz,
  p_deadline_priority text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  company_workspace_id uuid;
  created_company_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  insert into public.companies (
    user_id,
    company_name,
    industry_category,
    industry,
    motivation_level,
    selection_status,
    memo
  )
  values (
    current_user_id,
    p_company_name,
    p_industry_category,
    p_industry,
    p_motivation_level,
    p_selection_status,
    p_memo
  )
  returning id, workspace_id into created_company_id, company_workspace_id;

  insert into public.tasks (
    workspace_id,
    title,
    due_date,
    status,
    priority,
    related_company_id
  )
  values (
    company_workspace_id,
    p_deadline_title,
    p_deadline_due_date,
    'todo',
    p_deadline_priority,
    created_company_id
  );

  return created_company_id;
end;
$$;

create or replace function public.update_company_with_deadline(
  p_company_id uuid,
  p_expected_updated_at timestamptz,
  p_current_selection_status text,
  p_company_name text,
  p_industry_category text,
  p_industry text,
  p_motivation_level integer,
  p_selection_status text,
  p_memo text,
  p_deadline_title text,
  p_deadline_due_date timestamptz,
  p_deadline_priority text,
  p_deadline_task_id uuid,
  p_deadline_task_updated_at timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  company_workspace_id uuid;
  deadline_task_id uuid;
  deadline_task_updated_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  update public.companies as companies
     set company_name = p_company_name,
         industry_category = p_industry_category,
         industry = p_industry,
         motivation_level = p_motivation_level,
         selection_status = p_selection_status,
         memo = p_memo
   where companies.id = p_company_id
     and companies.user_id = current_user_id
     and companies.selection_status = p_current_selection_status
     and companies.updated_at = p_expected_updated_at
     and exists (
       select 1
         from public.workspaces as workspaces
        where workspaces.id = companies.workspace_id
          and workspaces.user_id = current_user_id
     )
  returning companies.workspace_id into company_workspace_id;

  if company_workspace_id is null then
    return null;
  end if;

  select tasks.id, tasks.updated_at
    into deadline_task_id, deadline_task_updated_at
    from public.tasks as tasks
   where tasks.related_company_id = p_company_id
     and tasks.workspace_id = company_workspace_id
     and tasks.status in ('todo', 'doing')
     and tasks.due_date is not null
   order by tasks.due_date asc, tasks.id asc
   limit 1
   for update;

  if deadline_task_id is distinct from p_deadline_task_id
     or deadline_task_updated_at is distinct from p_deadline_task_updated_at then
    raise exception 'deadline task changed' using errcode = '40001';
  end if;

  if deadline_task_id is null then
    insert into public.tasks (
      workspace_id,
      title,
      due_date,
      status,
      priority,
      related_company_id
    )
    values (
      company_workspace_id,
      p_deadline_title,
      p_deadline_due_date,
      'todo',
      p_deadline_priority,
      p_company_id
    );
  else
    update public.tasks
       set title = p_deadline_title,
           due_date = case
             when (due_date at time zone 'Asia/Tokyo')::date
                = (p_deadline_due_date at time zone 'Asia/Tokyo')::date
             then due_date
             else p_deadline_due_date
           end,
           priority = p_deadline_priority
     where id = deadline_task_id
       and workspace_id = company_workspace_id
       and related_company_id = p_company_id;
  end if;

  return p_company_id;
end;
$$;

revoke all on function public.create_company_with_deadline(
  text, text, text, integer, text, text, text, timestamptz, text
) from public, anon;
revoke all on function public.update_company_with_deadline(
  uuid, timestamptz, text, text, text, text, integer, text, text, text, timestamptz, text,
  uuid, timestamptz
) from public, anon;

grant execute on function public.create_company_with_deadline(
  text, text, text, integer, text, text, text, timestamptz, text
) to authenticated;
grant execute on function public.update_company_with_deadline(
  uuid, timestamptz, text, text, text, text, integer, text, text, text, timestamptz, text,
  uuid, timestamptz
) to authenticated;
