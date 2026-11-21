import { StatusBadge } from "@/components/status-badge";
import { PageHeading } from "@/components/page-heading";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../lib/supabase/server";
import { normalizeSelectionStatus, SELECTION_STATUS_OPTIONS } from "../lib/selection-status";
import { UpcomingEvents } from "@/components/calendar/upcoming-events";
import {
  CalendarEvent,
  CALENDAR_EVENT_COLUMNS,
  dateKeyToStartIso,
  eventDateKey,
  formatDateLabel,
  formatEventDateTime,
  getCalendarPeriod,
  getUpcomingEventRange,
  shiftDateKey,
  todayDateKey,
  UPCOMING_EVENT_LIMIT,
} from "@/lib/calendar";

type Company = {
  id: string;
  user_id: string;
  workspace_id: string | number | null;
  company_name: string;
  industry: string | null;
  motivation_level: number;
  selection_status: string;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

type Kpi = {
  label: string;
  value: number;
  description: string;
};

type DeadlineTask = {
  id: string;
  title: string;
  due_date: string;
  status: string;
  priority: number | string;
  related_company_id: string | null;
};

type CompanyName = {
  id: string;
  company_name: string;
};

export default async function Home() {
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
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`企業データの取得に失敗しました: ${error.message}`);
  }

  const companies = ((data ?? []) as Company[]).map((company) => ({
    ...company,
    selection_status: normalizeSelectionStatus(company.selection_status),
  }));

  const todayKey = todayDateKey();
  const weekPeriod = getCalendarPeriod("week", todayKey);
  const { data: workspaces, error: workspacesError } = await supabase
    .from("workspaces")
    .select("id")
    .eq("user_id", user.id);

  const workspaceIds = (workspaces ?? []).map((workspace) => workspace.id);

  let scheduleEvents: CalendarEvent[] = [];
  let deadlineTasks: DeadlineTask[] = [];
  let todayScheduleError = workspacesError?.message ?? null;
  let weeklyDeadlinesError = workspacesError?.message ?? null;

  if (!workspacesError && workspaceIds.length > 0) {
    const todayStart = dateKeyToStartIso(todayKey);
    const tomorrowStart = dateKeyToStartIso(shiftDateKey(todayKey, 1));
    const weekEnd = dateKeyToStartIso(weekPeriod.endKeyExclusive);
    const [eventsResult, todayTasksResult, weeklyTasksResult] = await Promise.all([
      supabase
        .from("events")
        .select("id, title, event_type, start_at, end_at, related_company_id")
        .in("workspace_id", workspaceIds)
        .gte("start_at", todayStart)
        .lt("start_at", tomorrowStart)
        .order("start_at", { ascending: true })
        .limit(5),
      supabase
        .from("tasks")
        .select("id, title, due_date, status, priority, related_company_id")
        .in("workspace_id", workspaceIds)
        .in("status", ["todo", "doing"])
        .gte("due_date", todayStart)
        .lt("due_date", tomorrowStart)
        .not("due_date", "is", null)
        .order("due_date", { ascending: true })
        .limit(10),
      supabase
        .from("tasks")
        .select("id, title, due_date, status, priority, related_company_id")
        .in("workspace_id", workspaceIds)
        .in("status", ["todo", "doing"])
        .gte("due_date", tomorrowStart)
        .lt("due_date", weekEnd)
        .not("due_date", "is", null)
        .order("due_date", { ascending: true })
        .limit(10),
    ]);

    todayScheduleError = eventsResult.error?.message ?? todayTasksResult.error?.message ?? null;
    weeklyDeadlinesError = weeklyTasksResult.error?.message ?? null;
    scheduleEvents = (eventsResult.data ?? []) as CalendarEvent[];
    deadlineTasks = [
      ...(todayTasksResult.data ?? []),
      ...(weeklyTasksResult.data ?? []),
    ].map((task) => task as DeadlineTask);
  }

  const todayDeadlineTasks = deadlineTasks.filter((task) => eventDateKey(task.due_date) === todayKey);
  const weeklyDeadlineTasks = deadlineTasks.filter((task) => eventDateKey(task.due_date) !== todayKey);

  const relatedCompanyIds = [
    ...new Set(
      [...scheduleEvents, ...deadlineTasks]
        .map((item) => item.related_company_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  let relatedCompanies: CompanyName[] = [];

  if (relatedCompanyIds.length > 0) {
    const { data: relatedCompanyData, error: relatedCompanyError } = await supabase
      .from("companies")
      .select("id, company_name")
      .in("id", relatedCompanyIds);

    if (!relatedCompanyError) {
      relatedCompanies = (relatedCompanyData ?? []) as CompanyName[];
    }
  }

  const companyNameById = new Map(
    relatedCompanies.map((company) => [company.id, company.company_name]),
  );

  const totalCompanies = companies.length;
  const notEnteredCount = companies.filter(
    (company) => company.selection_status === SELECTION_STATUS_OPTIONS[0],
  ).length;
  const appliedCount = companies.filter(
    (company) => company.selection_status === "応募済み",
  ).length;
  const documentScreeningCount = companies.filter(
    (company) => company.selection_status === "書類選考中",
  ).length;
  const interviewCount = companies.filter((company) =>
    ["一次面接", "二次面接", "最終面接"].includes(company.selection_status),
  ).length;
  const offerCount = companies.filter(
    (company) => company.selection_status === "内定",
  ).length;

  const kpis: Kpi[] = [
    {
      label: "登録企業数",
      value: totalCompanies,
      description: "登録されている企業の合計",
    },
    {
      label: "未応募",
      value: notEnteredCount,
      description: "選考を開始していない企業",
    },
    {
      label: "応募済み",
      value: appliedCount,
      description: "応募済みの企業",
    },
    {
      label: "書類選考中",
      value: documentScreeningCount,
      description: "書類選考中の企業",
    },
    {
      label: "面接中",
      value: interviewCount,
      description: "一次・二次・最終面接の企業",
    },
    {
      label: "内定",
      value: offerCount,
      description: "内定ステータスの企業",
    },
  ];

  const recentCompanies = companies.slice(0, 5);
  const upcomingRange = getUpcomingEventRange();
  const { data: eventData, error: eventError } = await supabase
    .from("events")
    .select(CALENDAR_EVENT_COLUMNS)
    .gte("start_at", upcomingRange.startAt)
    .lt("start_at", upcomingRange.endAtExclusive)
    .order("start_at", { ascending: true })
    .limit(UPCOMING_EVENT_LIMIT);
  const upcomingEvents = (eventData ?? []) as CalendarEvent[];

  return (
    <div className="ui-workspace">
      <main id="main-content" className="ui-main space-y-6">
        <PageHeading title="ダッシュボード" description="企業情報、選考状況、直近の予定を、ひとつの場所で確認できます。" />
        <section className="ui-panel">
          <h2 className="mb-3 text-xl font-bold text-black [overflow-wrap:anywhere] sm:text-2xl">
            ようこそ、{user.user_metadata?.display_name || user.email}さん
          </h2>
          <p className="text-slate-600">
            就活管理アプリのダッシュボードです。企業情報や選考状況をここから確認できます。
          </p>

          <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
            <Link
              href="/companies"
              className="ui-button ui-primary"
            >
              企業一覧を見る
            </Link>

            <Link
              href="/companies/board"
              className="ui-button ui-primary"
            >
              選考管理ボードを見る
            </Link>

            <Link href="/interviews" className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-blue-600 px-5 py-2 text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600 sm:w-auto">
              面接ログを見る
            </Link>

            <Link
              href="/calendar"
              className="ui-button ui-primary"
            >
              カレンダーを見る
            </Link>

            <Link
              href="/es"
              className="ui-button ui-primary"
            >
              ESを管理
            </Link>

            <Link
              href={`/companies?status=${SELECTION_STATUS_OPTIONS[0]}`}
              className="ui-button ui-secondary"
            >
              未応募を確認
            </Link>
          </div>
        </section>

        <section
          aria-label="選考進捗サマリー"
          className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4"
        >
          {kpis.map((kpi) => (
            <article key={kpi.label} className="ui-panel">
              <p className="mb-2 text-sm text-slate-500">{kpi.label}</p>
              <p className="text-3xl font-bold text-black">{kpi.value}</p>
              <p className="mt-2 text-sm text-slate-600">{kpi.description}</p>
            </article>
          ))}
        </section>

        <UpcomingEvents events={upcomingEvents} hasError={Boolean(eventError)} />

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="ui-panel">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h3 className="text-2xl font-bold text-black">最近更新した企業</h3>
              <Link href="/companies" className="ui-link">
                一覧を見る
              </Link>
            </div>

            {recentCompanies.length === 0 ? (
              <p className="text-slate-500">まだ企業が登録されていません。</p>
            ) : (
              <div className="space-y-3">
                {recentCompanies.map((company) => (
                  <div
                    key={company.id}
                    className="border rounded-lg p-4 flex flex-col items-start justify-between gap-3 sm:flex-row"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/companies/${company.id}`}
                        className="font-semibold text-black [overflow-wrap:anywhere] hover:text-blue-600 hover:underline"
                      >
                        {company.company_name}
                      </Link>

                      <p className="text-sm text-slate-600 mt-1 [overflow-wrap:anywhere]">
                        業界: {company.industry || "未設定"}
                      </p>
                    </div>

                    <StatusBadge status={company.selection_status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="ui-panel">
            <h3 className="text-2xl font-bold text-black mb-4">アカウント情報</h3>

            <dl className="space-y-4">
              <div>
                <dt className="text-sm text-slate-500">メールアドレス</dt>
                <dd className="text-black [overflow-wrap:anywhere]">{user.email}</dd>
              </div>

              <div>
                <dt className="text-sm text-slate-500">ユーザーID</dt>
                <dd className="text-black font-mono text-sm [overflow-wrap:anywhere]">{user.id}</dd>
              </div>

              <div>
                <dt className="text-sm text-slate-500">登録日</dt>
                <dd className="text-black">
                  {user.created_at
                    ? new Date(user.created_at).toLocaleDateString("ja-JP")
                    : "取得不可"}
                </dd>
              </div>
            </dl>

            <div className="mt-6 border-t pt-6">
              <h4 className="text-lg font-semibold text-black mb-3">
                次の準備を進めましょう
              </h4>
              <ul className="space-y-2 text-slate-700">
                <li>・気になる企業を登録して比較する</li>
                <li>・企業ごとのESを下書きする</li>
                <li>・選考ボードで進み具合を確認する</li>
                <li>・面接の前に企業研究メモを見返す</li>
                <li>・カレンダーで予定を登録・編集する</li>
              </ul>
            </div>
          </div>
        </section>
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section
            className="bg-white rounded-xl shadow p-6"
            aria-labelledby="today-schedule-heading"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="today-schedule-heading" className="text-2xl font-bold text-black">
                今日の予定
              </h3>
              <span className="text-sm text-slate-500">
                {scheduleEvents.length + todayDeadlineTasks.length}件
              </span>
            </div>
            {todayScheduleError ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
                今日の予定を取得できませんでした。時間を置いて再読み込みしてください。
              </p>
            ) : scheduleEvents.length === 0 && todayDeadlineTasks.length === 0 ? (
              <p className="text-slate-500">今日の予定はありません。</p>
            ) : (
              <div className="space-y-3">
                {scheduleEvents.map((event) => (
                  <div key={event.id} className="border rounded-lg p-4">
                    <p className="font-semibold text-black">{event.title}</p>
                    <p className="text-sm text-slate-600 mt-1">
                      {formatEventDateTime(event.start_at)}
                      {event.event_type ? ` · ${event.event_type}` : ""}
                    </p>
                    {event.related_company_id && companyNameById.get(event.related_company_id) ? (
                      <p className="text-sm text-slate-600 mt-1">
                        {companyNameById.get(event.related_company_id)}
                      </p>
                    ) : null}
                  </div>
                ))}
                {todayDeadlineTasks.map((task) => (
                  <div key={task.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-black">{task.title}</p>
                      <span className="shrink-0 text-sm text-slate-600">
                        {formatDateLabel(eventDateKey(task.due_date))}
                      </span>
                    </div>
                    {task.related_company_id && companyNameById.get(task.related_company_id) ? (
                      <p className="text-sm text-slate-600 mt-1">
                        {companyNameById.get(task.related_company_id)}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section
            className="bg-white rounded-xl shadow p-6"
            aria-labelledby="weekly-deadlines-heading"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="weekly-deadlines-heading" className="text-2xl font-bold text-black">
                今週の締切
              </h3>
              <span className="text-sm text-slate-500">{weeklyDeadlineTasks.length}件</span>
            </div>
            {weeklyDeadlinesError ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
                今週の締切を取得できませんでした。時間を置いて再読み込みしてください。
              </p>
            ) : weeklyDeadlineTasks.length === 0 ? (
              <p className="text-slate-500">今週の締切はありません。</p>
            ) : (
              <div className="space-y-3">
                {weeklyDeadlineTasks.map((task) => (
                  <div key={task.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-black">{task.title}</p>
                      <span className="shrink-0 text-sm text-slate-600">
                        {formatDateLabel(eventDateKey(task.due_date))}
                      </span>
                    </div>
                    {task.related_company_id && companyNameById.get(task.related_company_id) ? (
                      <p className="text-sm text-slate-600 mt-1">
                        {companyNameById.get(task.related_company_id)}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}
