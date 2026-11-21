import Link from "next/link";
import { getInterviewCompanies, getInterviewCompany, getInterviewContext, getInterviewLogs } from "./data";
import { InterviewList } from "./interview-list";
import { interviewButton, interviewInput, interviewLink } from "./styles";

export default async function InterviewsPage({ searchParams }: { searchParams: Promise<{ company_id?: string | string[] }> }) {
  const { supabase, user } = await getInterviewContext();
  const params = await searchParams;
  const companyId = Array.isArray(params.company_id) ? params.company_id[0] : params.company_id;
  const company = companyId ? await getInterviewCompany(supabase, user.id, companyId) : null;
  const [companies, logs] = await Promise.all([
    getInterviewCompanies(supabase, user.id), getInterviewLogs(supabase, user.id, companyId),
  ]);
  return (
    <>
      <h1 className="text-2xl font-bold">{company ? `${company.company_name}の面接ログ` : "面接ログ一覧"}</h1>
      <p className="text-slate-600">質問・回答・改善点を振り返り、次の面接に備えましょう。</p>
      {companies.length === 0 ? (
        <div className="space-y-3 rounded-xl bg-white p-4 shadow sm:p-6">
          <p>面接ログを記録するには、先に企業を登録してください。</p>
          <Link href="/companies" className={interviewButton}>企業を登録する</Link>
        </div>
      ) : (
        <>
          <form action="/interviews" method="get" className="space-y-2 rounded-xl bg-white p-4 sm:p-6">
            <label htmlFor="company-filter" className="block font-medium">企業で絞り込み</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select key={companyId ?? "all"} id="company-filter" name="company_id" defaultValue={companyId ?? ""} className={interviewInput}>
                <option value="">すべての企業</option>
                {companies.map((item) => <option key={item.id} value={item.id}>{item.company_name}</option>)}
              </select>
              <button type="submit" className={`${interviewButton} shrink-0`}>表示する</button>
              {company && <Link href="/interviews" className={`${interviewLink} shrink-0`}>絞り込みを解除</Link>}
            </div>
          </form>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>{logs.length}件の面接記録</p>
            <Link href={companyId ? `/interviews/new?company_id=${companyId}` : "/interviews/new"} className={interviewButton}>面接を記録する</Link>
          </div>
          <InterviewList logs={logs} companyId={companyId} />
        </>
      )}
    </>
  );
}
