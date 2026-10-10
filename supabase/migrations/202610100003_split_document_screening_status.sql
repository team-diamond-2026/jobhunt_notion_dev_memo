-- Keep existing databases aligned with the ES/Web test status split.
update public.companies
set selection_status = 'Webテスト'
where selection_status = '書類選考中';

alter table public.companies
  drop constraint if exists companies_selection_status_allowed;

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
