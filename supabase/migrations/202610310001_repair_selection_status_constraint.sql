-- Keep the production database compatible with the selection statuses used by
-- the current company forms and server actions.

alter table public.companies
  drop constraint if exists companies_selection_status_allowed;

update public.companies
set selection_status = case selection_status
  when '未エントリー' then '未応募'
  when '書類選考中' then 'Webテスト'
  when '1次面接' then '一次面接'
  when '2次面接' then '二次面接'
  when 'お祈り' then '不採用'
  when 'not_entered' then '未応募'
  else selection_status
end
where selection_status in (
  '未エントリー',
  '書類選考中',
  '1次面接',
  '2次面接',
  'お祈り',
  'not_entered'
);

alter table public.companies
  alter column selection_status set default '未応募';

alter table public.companies
  add constraint companies_selection_status_allowed
  check (selection_status in (
    '未応募',
    '応募済み',
    'ES提出',
    'Webテスト',
    '一次面接',
    '二次面接',
    '最終面接',
    '内定',
    '不採用',
    '辞退'
  ));
