begin;

-- 202606270001_mvp_schema_and_rls.sql の既存テーブル・RLS・更新日時
-- トリガーを使用する。日時・JSON列や既存レコードは変更しない。
create index if not exists interview_logs_company_date_idx
  on public.interview_logs (company_id, interview_date desc, created_at desc);

-- 入力列のみ変更可能にし、システム列と削除へのアクセスを制限する。
revoke all on public.interview_logs from anon, authenticated;
grant select on public.interview_logs to authenticated;
grant insert (company_id, interview_date, format, questions, answers, reflection, next_action)
  on public.interview_logs to authenticated;
grant update (company_id, interview_date, format, questions, answers, reflection, next_action)
  on public.interview_logs to authenticated;

commit;
