import { notFound, redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { isUuid, normalizeInterviewLog, type StoredInterviewLog } from "../../lib/interview-log";

type Client = Awaited<ReturnType<typeof createClient>>;
export type InterviewCompany = { id: string; company_name: string };
export type CompanyDetail = InterviewCompany & {
  industry: string | null;
  motivation_level: number;
  selection_status: string;
  memo: string | null;
};

const logColumns = "id, company_id, interview_date, format, questions, answers, reflection, next_action, created_at, updated_at, companies!inner(id, company_name)";

export async function getInterviewContext() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  return { supabase, user };
}

export async function getInterviewCompanies(supabase: Client, userId: string) {
  const { data, error } = await supabase.from("companies")
    .select("id, company_name").eq("user_id", userId)
    .order("company_name").returns<InterviewCompany[]>();
  if (error) throw new Error("企業一覧を取得できませんでした。");
  return data ?? [];
}

export async function getInterviewCompany(supabase: Client, userId: string, companyId: string) {
  if (!isUuid(companyId)) notFound();
  const { data, error } = await supabase.from("companies")
    .select("id, company_name, industry, motivation_level, selection_status, memo")
    .eq("id", companyId).eq("user_id", userId).maybeSingle<CompanyDetail>();
  if (error) throw new Error("企業情報を取得できませんでした。");
  if (!data) notFound();
  return data;
}

export async function getInterviewLogs(supabase: Client, userId: string, companyId?: string) {
  let query = supabase.from("interview_logs").select(logColumns)
    .eq("companies.user_id", userId)
    .order("interview_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (companyId) query = query.eq("company_id", companyId);
  const { data, error } = await query.returns<StoredInterviewLog[]>();
  if (error) throw new Error("面接ログを取得できませんでした。");
  return (data ?? []).map(normalizeInterviewLog);
}

export async function getInterviewLog(supabase: Client, userId: string, logId: string) {
  if (!isUuid(logId)) notFound();
  const { data, error } = await supabase.from("interview_logs").select(logColumns)
    .eq("id", logId).eq("companies.user_id", userId).maybeSingle<StoredInterviewLog>();
  if (error) throw new Error("面接ログを取得できませんでした。");
  if (!data) notFound();
  return normalizeInterviewLog(data);
}
