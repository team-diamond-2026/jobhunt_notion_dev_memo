import Link from "next/link";
import { formatInterviewDate, type InterviewLog } from "../../lib/interview-log";
import { interviewButton, interviewLink } from "./styles";

export function InterviewList({ logs, companyId }: { logs: InterviewLog[]; companyId?: string }) {
  if (!logs.length) {
    return (
      <div className="space-y-3 rounded-xl bg-white p-4 shadow sm:p-6">
        <p>まだ{companyId ? "この企業の" : ""}面接ログはありません。</p>
        <p className="text-slate-600">面接で聞かれたことや改善点を記録して、次の面接に活かしましょう。</p>
        <Link href={companyId ? `/interviews/new?company_id=${companyId}` : "/interviews/new"} className={interviewButton}>最初の面接を記録</Link>
      </div>
    );
  }
  return (
    <ul className="grid gap-4">
      {logs.map((log) => (
        <li key={log.id} className="min-w-0 space-y-2 rounded-xl bg-white p-4 shadow sm:p-6 [overflow-wrap:anywhere]">
          <p className="text-sm text-slate-600"><time dateTime={log.interview_date || undefined}>{formatInterviewDate(log.interview_date)}</time> · {log.format || "形式未設定"}</p>
          <h2 className="text-lg font-semibold"><Link href={`/interviews/${log.id}`} className="inline-flex min-h-11 items-center rounded text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600">{log.companies.company_name}の面接記録</Link></h2>
          <p className="whitespace-pre-wrap text-slate-700">次回までにやること：{log.next_action ? `${log.next_action.slice(0, 160)}${log.next_action.length > 160 ? "…" : ""}` : "未記入"}</p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/interviews/${log.id}/edit`} className={interviewLink}>編集する</Link>
            <Link href={`/interviews?company_id=${log.company_id}`} className={interviewLink}>この企業の面接ログ</Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
