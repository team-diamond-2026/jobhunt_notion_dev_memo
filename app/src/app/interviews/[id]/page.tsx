import Link from "next/link";
import { formatInterviewDate } from "../../../lib/interview-log";
import { getInterviewContext, getInterviewLog } from "../data";
import { interviewButton, interviewLink } from "../styles";

export default async function InterviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await getInterviewContext();
  const { id } = await params;
  const log = await getInterviewLog(supabase, user.id, id);
  return (
    <>
      <h1 className="text-2xl font-bold">{log.companies.company_name}の面接記録</h1>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Link href={`/interviews/${log.id}/edit`} className={interviewButton}>この記録を編集</Link>
        <Link href={`/interviews?company_id=${log.company_id}`} className={interviewLink}>この企業の面接ログ</Link>
        <Link href={`/companies/${log.company_id}`} className={interviewLink}>企業詳細</Link>
        <Link href="/interviews" className={interviewLink}>面接ログ一覧へ</Link>
      </div>
      <dl className="space-y-5 rounded-xl bg-white p-4 shadow sm:p-6">
        <div><dt className="font-semibold">企業</dt><dd>{log.companies.company_name}</dd></div>
        <div><dt className="font-semibold">面接日</dt><dd><time dateTime={log.interview_date || undefined}>{formatInterviewDate(log.interview_date)}</time></dd></div>
        <div><dt className="font-semibold">面接形式</dt><dd>{log.format || "未設定"}</dd></div>
        {([
          ["質問内容", log.questions], ["回答内容", log.answers],
          ["振り返り・改善点", log.reflection], ["次回までにやること", log.next_action],
        ] as const).map(([label, value]) => (
          <div key={label}><dt className="mb-1 font-semibold">{label}</dt><dd className="whitespace-pre-wrap text-slate-700">{value || "未記入"}</dd></div>
        ))}
      </dl>
    </>
  );
}
