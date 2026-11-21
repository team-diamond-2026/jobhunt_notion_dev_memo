import Link from "next/link";
import { getInterviewCompanies, getInterviewCompany, getInterviewContext } from "../data";
import { InterviewForm } from "../interview-form";
import { interviewButton } from "../styles";

export default async function NewInterviewPage({ searchParams }: { searchParams: Promise<{ company_id?: string | string[] }> }) {
  const { supabase, user } = await getInterviewContext();
  const params = await searchParams;
  const companyId = Array.isArray(params.company_id) ? params.company_id[0] : params.company_id;
  if (companyId) await getInterviewCompany(supabase, user.id, companyId);
  const companies = await getInterviewCompanies(supabase, user.id);
  return (
    <>
      <h1 className="text-2xl font-bold">面接を記録する</h1>
      {companies.length ? <InterviewForm companies={companies} initialValues={{ company_id: companyId }} /> : (
        <div className="space-y-3 rounded-xl bg-white p-4 sm:p-6">
          <p>まずは面接を受けた企業を登録しましょう。</p>
          <Link href="/companies" className={interviewButton}>企業を登録する</Link>
        </div>
      )}
    </>
  );
}
