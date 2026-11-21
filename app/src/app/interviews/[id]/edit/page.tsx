import { getInterviewCompanies, getInterviewContext, getInterviewLog } from "../../data";
import { InterviewForm } from "../../interview-form";

export default async function EditInterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await getInterviewContext();
  const { id } = await params;
  const log = await getInterviewLog(supabase, user.id, id);
  const companies = await getInterviewCompanies(supabase, user.id);
  return (
    <>
      <h1 className="text-2xl font-bold">面接ログを編集</h1>
      <InterviewForm companies={companies} logId={log.id} initialValues={log} />
    </>
  );
}
