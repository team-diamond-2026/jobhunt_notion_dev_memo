-- Shukatsu OS MVP schema and row-level security.
-- Apply this in Supabase SQL editor or with the Supabase CLI.

create extension if not exists "pgcrypto";

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null default 'Default workspace',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_name text not null,
  industry text,
  motivation_level integer not null default 0 check (motivation_level between 0 and 5),
  selection_status text not null default 'not_entered',
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  status text not null default 'not_entered',
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.es_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  doc_type text not null default 'entry_sheet',
  title text not null,
  content text not null default '',
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.interview_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  interview_date timestamptz,
  format text,
  questions jsonb not null default '[]'::jsonb,
  answers jsonb not null default '[]'::jsonb,
  reflection text,
  next_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  description text,
  due_date timestamptz,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done', 'archived')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  related_company_id uuid references public.companies(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  event_type text not null default 'other',
  start_at timestamptz not null,
  end_at timestamptz,
  related_company_id uuid references public.companies(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at is null or end_at >= start_at)
);

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  icon text,
  parent_page_id uuid references public.pages(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.page_blocks (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  block_type text not null default 'paragraph',
  content jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  template_name text not null,
  template_type text not null default 'page',
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep existing early MVP databases compatible when the companies table
-- already exists with only user_id-based ownership.
alter table public.companies add column if not exists user_id uuid;
alter table public.companies add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.companies add column if not exists company_name text;
alter table public.companies add column if not exists industry text;
alter table public.companies add column if not exists motivation_level integer not null default 0;
alter table public.companies add column if not exists selection_status text not null default 'not_entered';
alter table public.companies add column if not exists memo text;
alter table public.companies add column if not exists created_at timestamptz not null default now();
alter table public.companies add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_workspaces_user_id on public.workspaces(user_id);
create index if not exists idx_companies_user_id on public.companies(user_id);
create index if not exists idx_companies_workspace_id on public.companies(workspace_id);
create index if not exists idx_companies_selection_status on public.companies(selection_status);
create index if not exists idx_applications_company_id on public.applications(company_id);
create index if not exists idx_es_documents_company_id on public.es_documents(company_id);
create index if not exists idx_interview_logs_company_id on public.interview_logs(company_id);
create index if not exists idx_tasks_workspace_id on public.tasks(workspace_id);
create index if not exists idx_tasks_due_date on public.tasks(due_date);
create index if not exists idx_events_workspace_id on public.events(workspace_id);
create index if not exists idx_events_start_at on public.events(start_at);
create index if not exists idx_pages_workspace_id on public.pages(workspace_id);
create index if not exists idx_pages_parent_page_id on public.pages(parent_page_id);
create index if not exists idx_page_blocks_page_id_sort_order on public.page_blocks(page_id, sort_order);
create index if not exists idx_templates_workspace_id on public.templates(workspace_id);

drop trigger if exists touch_users_updated_at on public.users;
create trigger touch_users_updated_at
before update on public.users
for each row execute function public.touch_updated_at();

drop trigger if exists touch_workspaces_updated_at on public.workspaces;
create trigger touch_workspaces_updated_at
before update on public.workspaces
for each row execute function public.touch_updated_at();

drop trigger if exists touch_companies_updated_at on public.companies;
create trigger touch_companies_updated_at
before update on public.companies
for each row execute function public.touch_updated_at();

drop trigger if exists touch_applications_updated_at on public.applications;
create trigger touch_applications_updated_at
before update on public.applications
for each row execute function public.touch_updated_at();

drop trigger if exists touch_es_documents_updated_at on public.es_documents;
create trigger touch_es_documents_updated_at
before update on public.es_documents
for each row execute function public.touch_updated_at();

drop trigger if exists touch_interview_logs_updated_at on public.interview_logs;
create trigger touch_interview_logs_updated_at
before update on public.interview_logs
for each row execute function public.touch_updated_at();

drop trigger if exists touch_tasks_updated_at on public.tasks;
create trigger touch_tasks_updated_at
before update on public.tasks
for each row execute function public.touch_updated_at();

drop trigger if exists touch_events_updated_at on public.events;
create trigger touch_events_updated_at
before update on public.events
for each row execute function public.touch_updated_at();

drop trigger if exists touch_pages_updated_at on public.pages;
create trigger touch_pages_updated_at
before update on public.pages
for each row execute function public.touch_updated_at();

drop trigger if exists touch_page_blocks_updated_at on public.page_blocks;
create trigger touch_page_blocks_updated_at
before update on public.page_blocks
for each row execute function public.touch_updated_at();

drop trigger if exists touch_templates_updated_at on public.templates;
create trigger touch_templates_updated_at
before update on public.templates
for each row execute function public.touch_updated_at();

create or replace function public.ensure_default_workspace_for_user(target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace_id uuid;
begin
  select id
    into workspace_id
    from public.workspaces
   where user_id = target_user_id
   order by created_at asc
   limit 1;

  if workspace_id is null then
    insert into public.workspaces (user_id, name)
    values (target_user_id, 'Default workspace')
    returning id into workspace_id;
  end if;

  return workspace_id;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'name'),
    new.email
  )
  on conflict (id) do update
    set email = excluded.email,
        name = coalesce(public.users.name, excluded.name);

  perform public.ensure_default_workspace_for_user(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.prepare_company_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace_owner uuid;
begin
  new.user_id = coalesce(new.user_id, auth.uid());

  if new.user_id is null then
    raise exception 'companies.user_id is required';
  end if;

  insert into public.users (id)
  values (new.user_id)
  on conflict (id) do nothing;

  if new.workspace_id is null then
    new.workspace_id = public.ensure_default_workspace_for_user(new.user_id);
  end if;

  select user_id
    into workspace_owner
    from public.workspaces
   where id = new.workspace_id;

  if workspace_owner is null or workspace_owner <> new.user_id then
    raise exception 'company workspace does not belong to company user';
  end if;

  return new;
end;
$$;

drop trigger if exists prepare_company_defaults_before_write on public.companies;
create trigger prepare_company_defaults_before_write
before insert or update on public.companies
for each row execute function public.prepare_company_defaults();

insert into public.users (id, name, email, created_at)
select
  auth_users.id,
  coalesce(auth_users.raw_user_meta_data->>'display_name', auth_users.raw_user_meta_data->>'name'),
  auth_users.email,
  auth_users.created_at
from auth.users as auth_users
on conflict (id) do update
  set email = excluded.email,
      name = coalesce(public.users.name, excluded.name);

insert into public.workspaces (user_id, name)
select users.id, 'Default workspace'
from public.users as users
where not exists (
  select 1 from public.workspaces where workspaces.user_id = users.id
);

update public.companies
   set workspace_id = public.ensure_default_workspace_for_user(user_id)
 where workspace_id is null;

alter table public.companies alter column user_id set not null;
alter table public.companies alter column workspace_id set not null;
alter table public.companies alter column company_name set not null;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'companies_user_id_fkey'
       and conrelid = 'public.companies'::regclass
  ) then
    alter table public.companies add constraint companies_user_id_fkey
      foreign key (user_id) references public.users(id) on delete cascade not valid;
  end if;
end;
$$;

alter table public.companies validate constraint companies_user_id_fkey;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'companies_workspace_id_fkey'
       and conrelid = 'public.companies'::regclass
  ) then
    alter table public.companies add constraint companies_workspace_id_fkey
      foreign key (workspace_id) references public.workspaces(id) on delete cascade not valid;
  end if;
end;
$$;

alter table public.companies validate constraint companies_workspace_id_fkey;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'companies_motivation_level_range'
       and conrelid = 'public.companies'::regclass
  ) then
    alter table public.companies add constraint companies_motivation_level_range
      check (motivation_level between 0 and 5) not valid;
  end if;
end;
$$;

alter table public.companies validate constraint companies_motivation_level_range;

alter table public.users enable row level security;
alter table public.workspaces enable row level security;
alter table public.companies enable row level security;
alter table public.applications enable row level security;
alter table public.es_documents enable row level security;
alter table public.interview_logs enable row level security;
alter table public.tasks enable row level security;
alter table public.events enable row level security;
alter table public.pages enable row level security;
alter table public.page_blocks enable row level security;
alter table public.templates enable row level security;

drop policy if exists "Users can read own profile" on public.users;
create policy "Users can read own profile"
on public.users for select
using (id = auth.uid());

drop policy if exists "Users can insert own profile" on public.users;
create policy "Users can insert own profile"
on public.users for insert
with check (id = auth.uid());

drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile"
on public.users for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Users can manage own workspaces" on public.workspaces;
create policy "Users can manage own workspaces"
on public.workspaces for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can manage own companies" on public.companies;
create policy "Users can manage own companies"
on public.companies for all
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1
      from public.workspaces
     where workspaces.id = companies.workspace_id
       and workspaces.user_id = auth.uid()
  )
);

drop policy if exists "Users can manage applications for own companies" on public.applications;
create policy "Users can manage applications for own companies"
on public.applications for all
using (
  exists (
    select 1
      from public.companies
     where companies.id = applications.company_id
       and companies.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
      from public.companies
     where companies.id = applications.company_id
       and companies.user_id = auth.uid()
  )
);

drop policy if exists "Users can manage ES documents for own companies" on public.es_documents;
create policy "Users can manage ES documents for own companies"
on public.es_documents for all
using (
  exists (
    select 1
      from public.companies
     where companies.id = es_documents.company_id
       and companies.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
      from public.companies
     where companies.id = es_documents.company_id
       and companies.user_id = auth.uid()
  )
);

drop policy if exists "Users can manage interview logs for own companies" on public.interview_logs;
create policy "Users can manage interview logs for own companies"
on public.interview_logs for all
using (
  exists (
    select 1
      from public.companies
     where companies.id = interview_logs.company_id
       and companies.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
      from public.companies
     where companies.id = interview_logs.company_id
       and companies.user_id = auth.uid()
  )
);

drop policy if exists "Users can manage own tasks" on public.tasks;
create policy "Users can manage own tasks"
on public.tasks for all
using (
  exists (
    select 1
      from public.workspaces
     where workspaces.id = tasks.workspace_id
       and workspaces.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
      from public.workspaces
     where workspaces.id = tasks.workspace_id
       and workspaces.user_id = auth.uid()
  )
);

drop policy if exists "Users can manage own events" on public.events;
create policy "Users can manage own events"
on public.events for all
using (
  exists (
    select 1
      from public.workspaces
     where workspaces.id = events.workspace_id
       and workspaces.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
      from public.workspaces
     where workspaces.id = events.workspace_id
       and workspaces.user_id = auth.uid()
  )
);

drop policy if exists "Users can manage own pages" on public.pages;
create policy "Users can manage own pages"
on public.pages for all
using (
  exists (
    select 1
      from public.workspaces
     where workspaces.id = pages.workspace_id
       and workspaces.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
      from public.workspaces
     where workspaces.id = pages.workspace_id
       and workspaces.user_id = auth.uid()
  )
);

drop policy if exists "Users can manage own page blocks" on public.page_blocks;
create policy "Users can manage own page blocks"
on public.page_blocks for all
using (
  exists (
    select 1
      from public.pages
      join public.workspaces on workspaces.id = pages.workspace_id
     where pages.id = page_blocks.page_id
       and workspaces.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
      from public.pages
      join public.workspaces on workspaces.id = pages.workspace_id
     where pages.id = page_blocks.page_id
       and workspaces.user_id = auth.uid()
  )
);

drop policy if exists "Users can manage own templates" on public.templates;
create policy "Users can manage own templates"
on public.templates for all
using (
  exists (
    select 1
      from public.workspaces
     where workspaces.id = templates.workspace_id
       and workspaces.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
      from public.workspaces
     where workspaces.id = templates.workspace_id
       and workspaces.user_id = auth.uid()
  )
);
