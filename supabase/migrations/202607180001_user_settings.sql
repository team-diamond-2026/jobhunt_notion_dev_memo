-- User settings for profile-adjacent preferences, notifications, and display.

create table if not exists public.user_settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  email_notifications boolean not null default true,
  deadline_reminders boolean not null default true,
  weekly_digest boolean not null default false,
  reminder_timing text not null default 'morning'
    check (reminder_timing in ('none', 'morning', 'previous_day', 'three_days')),
  theme text not null default 'system'
    check (theme in ('system', 'light', 'dark')),
  density text not null default 'comfortable'
    check (density in ('comfortable', 'compact')),
  default_view text not null default 'dashboard'
    check (default_view in ('dashboard', 'companies', 'board')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists touch_user_settings_updated_at on public.user_settings;
create trigger touch_user_settings_updated_at
before update on public.user_settings
for each row execute function public.touch_updated_at();

alter table public.user_settings enable row level security;

drop policy if exists "Users can manage own settings" on public.user_settings;
create policy "Users can manage own settings"
on public.user_settings for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

insert into public.user_settings (user_id)
select users.id
from public.users as users
where not exists (
  select 1
  from public.user_settings
  where user_settings.user_id = users.id
);
