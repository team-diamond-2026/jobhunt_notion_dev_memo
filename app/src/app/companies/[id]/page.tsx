import Link from "next/link";
import { getInterviewLogs } from "../../interviews/data";
import { InterviewList } from "../../interviews/interview-list";
import { interviewButton, interviewLink } from "../../interviews/styles";
import { notFound, redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { updateCompany } from "../actions";
import {
  getSelectionStatusIndex,
  normalizeSelectionStatus,
  SELECTION_CONFLICT_MESSAGE,
  SELECTION_STATUS_OPTIONS,
} from "../../../lib/selection-status";
import { DeadlineFields, type DeadlineTask } from "../deadline-fields";

type Company = {
  id: string;
  user_id: string;
  workspace_id: string;
  company_name: string;
  industry: string | null;
  industry_category: string | null;
  motivation_level: number;
  selection_status: string;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

type PageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{ error?: string }>;
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getProgressIndex(status: string) {
  return getSelectionStatusIndex(status);
}

export default async function CompanyDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { error: updateError } = await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    notFound();
  }

  const company = {
    ...data,
    selection_status: normalizeSelectionStatus(data.selection_status),
  } as Company;
  const { data: deadlineTask, error: deadlineTaskError } = await supabase
    .from("tasks")
    .select("id, title, due_date, priority, updated_at")
    .eq("related_company_id", company.id)
    .eq("workspace_id", company.workspace_id)
    .in("status", ["todo", "doing"])
    .not("due_date", "is", null)
    .order("due_date", { ascending: true })
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();


  const interviewLogs = await getInterviewLogs(supabase, user.id, company.id);
  const progressIndex = getProgressIndex(company.selection_status);
  const motivationLevel = Math.min(Math.max(company.motivation_level, 0), 5);

  return (
    <div className="ui-workspace">
      <main id="main-content" className="ui-main [overflow-wrap:anywhere]">
        <nav aria-label="企業詳細の操作" className="mb-5 flex flex-wrap gap-2">
          <Link href="/companies" className="ui-button ui-secondary">企業一覧へ戻る</Link>
          <Link href="/companies/board" className="ui-button ui-secondary">選考ボードへ戻る</Link>
          <Link href={`/companies/${company.id}/edit`} className="ui-button ui-primary">詳細編集</Link>
        </nav>
        <header className="mb-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-500">企業詳細</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950">
                {company.company_name}
              </h1>
              <p className="mt-2 text-slate-600">
                {company.industry || "業界未設定"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                {company.selection_status}
              </span>
              <span className="rounded-full bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900">
                志望度 {motivationLevel}/5
              </span>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <section className="min-w-0 space-y-6">
            <div className="ui-panel">
              <h2 className="text-xl font-bold text-slate-950">基本情報</h2>

              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-4">
                  <dt className="text-sm text-slate-500">企業名</dt>
                  <dd className="mt-1 font-medium text-slate-950">
                    {company.company_name}
                  </dd>
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <dt className="text-sm text-slate-500">業界</dt>
                  <dd className="mt-1 font-medium text-slate-950">
                    {company.industry || "未設定"}
                  </dd>
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <dt className="text-sm text-slate-500">作成日</dt>
                  <dd className="mt-1 font-medium text-slate-950">
                    {formatDateTime(company.created_at)}
                  </dd>
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <dt className="text-sm text-slate-500">最終更新</dt>
                  <dd className="mt-1 font-medium text-slate-950">
                    {formatDateTime(company.updated_at)}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="ui-panel">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-bold text-slate-950">
                  選考履歴・現在地
                </h2>
                <span className="text-sm text-slate-500">
                  現在: {company.selection_status}
                </span>
              </div>

              <ol className="mt-6 space-y-3">
                {SELECTION_STATUS_OPTIONS.map((status, index) => {
                  const isCurrent = status === company.selection_status;
                  const isPast = index < progressIndex;

                  return (
                    <li
                      key={status}
                      className={`flex items-center gap-3 rounded-lg border p-3 ${
                        isCurrent
                          ? "border-blue-300 bg-blue-50"
                          : isPast
                            ? "border-green-200 bg-green-50"
                            : "border-slate-200 bg-white"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                          isCurrent
                            ? "bg-blue-600 text-white"
                            : isPast
                              ? "bg-green-600 text-white"
                              : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span className="font-medium text-slate-900">{status}</span>
                      {isCurrent && (
                        <span className="ml-auto rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                          現在
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="ui-panel">
              <h2 className="text-xl font-bold text-slate-950">メモ</h2>
              <div className="mt-4 min-h-32 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="whitespace-pre-wrap text-slate-800">
                  {company.memo || "メモはまだありません。"}
                </p>
              </div>
            </div>
          </section>

          <aside className="min-w-0 space-y-6">
            <section aria-labelledby="company-interviews" className="min-w-0 space-y-4 [overflow-wrap:anywhere]">
              <h2 id="company-interviews" className="text-xl font-bold text-slate-950">面接ログ</h2>
              <div className="flex flex-col gap-2">
                <Link href={`/interviews/new?company_id=${company.id}`} className={interviewButton}>この企業の面接を記録</Link>
                <Link href={`/interviews?company_id=${company.id}`} className={interviewLink}>この企業の面接ログ一覧</Link>
              </div>
              <InterviewList logs={interviewLogs} companyId={company.id} />
            </section>
            <form id="company-update" action={updateCompany} className="scroll-mt-4 rounded-xl bg-white p-4 shadow sm:p-6">
              <input type="hidden" name="company_id" value={company.id} />
              <input type="hidden" name="expected_updated_at" value={company.updated_at} />
              <input
                type="hidden"
                name="company_name"
                value={company.company_name}
              />
              <input type="hidden" name="industry" value={company.industry ?? ""} />
              <input
                type="hidden"
                name="industry_category"
                value={company.industry_category ?? ""}
              />
              <input type="hidden" name="industry_other" value="" />

              <h2 className="text-xl font-bold text-slate-950">詳細を更新</h2>
              {updateError === "conflict" && (
                <p role="alert" className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">{SELECTION_CONFLICT_MESSAGE}</p>
              )}

              <div className="mt-5 space-y-4">
                <div>
                  <label
                    htmlFor="motivation_level"
                    className="block text-sm font-medium text-slate-700"
                  >
                    志望度
                  </label>
                  <select
                    id="motivation_level"
                    name="motivation_level"
                    defaultValue={String(company.motivation_level)}
                    className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-950"
                  >
                    <option value="0">0</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="selection_status"
                    className="block text-sm font-medium text-slate-700"
                  >
                    選考ステータス
                  </label>
                  <select
                    id="selection_status"
                    name="selection_status"
                    defaultValue={company.selection_status}
                    className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-950"
                  >
                    {SELECTION_STATUS_OPTIONS.map((status, index) => (
                      <option
                        key={status}
                        value={status}
                        disabled={index < progressIndex}
                      >
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                {deadlineTaskError ? (
                  <p role="status" className="text-sm text-amber-900">締切タスクを取得できませんでした。企業情報は更新できます。</p>
                ) : (
                  <DeadlineFields task={deadlineTask as DeadlineTask | null} />
                )}

                <div>
                  <label
                    htmlFor="memo"
                    className="block text-sm font-medium text-slate-700"
                  >
                    メモ
                  </label>
                  <textarea
                    id="memo"
                    name="memo"
                    rows={8}
                    defaultValue={company.memo ?? ""}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-950"
                  />
                </div>

                <button
                  type="submit"
                  className="min-h-11 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  更新する
                </button>
              </div>
            </form>

            <div className="ui-panel">
              <h2 className="text-xl font-bold text-slate-950">関連導線</h2>
              <div className="mt-4 grid gap-3">
                <Link
                  href="/companies/board"
                  className="rounded-md bg-slate-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-slate-800"
                >
                  選考ボードで見る
                </Link>
                <Link
                  href={`/companies/${company.id}/edit`}
                  className="rounded-md bg-slate-200 px-4 py-2 text-center text-sm font-medium text-slate-950 hover:bg-slate-300"
                >
                  企業情報を編集
                </Link>
                <Link
                  href={`/es?company=${company.id}`}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-emerald-700"
                >
                  この企業のESを見る
                </Link>
                <Link
                  href={`/es/new?company=${company.id}`}
                  className="rounded-md border border-emerald-300 px-4 py-2 text-center text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                >
                  ESを新規作成
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
