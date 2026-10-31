import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../lib/supabase/server";
import { SELECTION_STATUS_OPTIONS } from "../lib/selection-status";

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

type ScheduleEvent = {
  id: string;
  title: string;
  event_type: string | null;
  start_at: string;
  end_at: string | null;
  related_company_id: string | null;
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

const DASHBOARD_TIME_ZONE = "Asia/Tokyo";

function getDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DASHBOARD_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getDateRangeStart(dateKey: string) {
  return new Date(`${dateKey}T00:00:00+09:00`);
}

function addDays(dateKey: string, days: number) {
  const date = getDateRangeStart(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return getDateKey(date);
}

function getWeekStartKey(dateKey: string) {
  const date = getDateRangeStart(dateKey);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - ((day + 6) % 7));
  return getDateKey(date);
}

function formatScheduleDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: DASHBOARD_TIME_ZONE,
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDeadlineDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: DASHBOARD_TIME_ZONE,
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(new Date(value));
}

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

  const companies = (data ?? []) as Company[];

  const todayKey = getDateKey(new Date());
  const weekStartKey = getWeekStartKey(todayKey);
  const weekEndKey = addDays(weekStartKey, 7);
  const workspaceIds = [
    ...new Set(
      companies
        .map((company) => company.workspace_id)
        .filter((id): id is string | number => id !== null && id !== undefined),
    ),
  ];

  let scheduleEvents: ScheduleEvent[] = [];
  let deadlineTasks: DeadlineTask[] = [];

  if (workspaceIds.length > 0) {
    const [eventsResult, tasksResult] = await Promise.all([
      supabase
        .from("events")
        .select("id, title, event_type, start_at, end_at, related_company_id")
        .in("workspace_id", workspaceIds)
        .gte("start_at", getDateRangeStart(todayKey).toISOString())
        .lt("start_at", getDateRangeStart(addDays(todayKey, 1)).toISOString())
        .order("start_at", { ascending: true })
        .limit(5),
      supabase
        .from("tasks")
        .select("id, title, due_date, status, priority, related_company_id")
        .in("workspace_id", workspaceIds)
        .gte("due_date", getDateRangeStart(weekStartKey).toISOString())
        .lt("due_date", getDateRangeStart(weekEndKey).toISOString())
        .not("due_date", "is", null)
        .order("due_date", { ascending: true })
        .limit(10),
    ]);

    if (eventsResult.error) {
      throw new Error(`今日の予定の取得に失敗しました: ${eventsResult.error.message}`);
    }

    if (tasksResult.error) {
      throw new Error(`今週の締切の取得に失敗しました: ${tasksResult.error.message}`);
    }

    scheduleEvents = (eventsResult.data ?? []) as ScheduleEvent[];
    deadlineTasks = (tasksResult.data ?? [])
      .filter((task) => !["done", "completed", "archived"].includes(task.status))
      .map((task) => task as DeadlineTask);
  }

  const todayDeadlineTasks = deadlineTasks.filter(
    (task) => getDateKey(new Date(task.due_date)) === todayKey,
  );
  const weeklyDeadlineTasks = deadlineTasks.filter(
    (task) => getDateKey(new Date(task.due_date)) !== todayKey,
  );

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

    if (relatedCompanyError) {
      throw new Error(`関連企業の取得に失敗しました: ${relatedCompanyError.message}`);
    }

    relatedCompanies = (relatedCompanyData ?? []) as CompanyName[];
  }

  const companyNameById = new Map(
    relatedCompanies.map((company) => [company.id, company.company_name]),
  );

  const totalCompanies = companies.length;
  const notEnteredCount = companies.filter(
    (company) => company.selection_status === SELECTION_STATUS_OPTIONS[0],
  ).length;
  const esSubmittedCount = companies.filter(
    (company) => company.selection_status === "ES提出",
  ).length;
  const webTestCount = companies.filter(
    (company) => company.selection_status === "Webテスト",
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
      label: "ES提出",
      value: esSubmittedCount,
      description: "ES提出の企業",
    },
    {
      label: "Webテスト",
      value: webTestCount,
      description: "Webテストの企業",
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

  return (
    <div className="min-h-screen bg-slate-100">
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-black">Job Hunt Dashboard</h1>

          <div className="flex items-center gap-4">
            <span className="text-slate-700">
              {user.user_metadata?.display_name || user.email}
            </span>

            <Link href="/settings" className="text-sm text-blue-600 hover:underline">
              設定
            </Link>

            <form action="/logout" method="post">
              <button
                type="submit"
                className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700"
              >
                ログアウト
              </button>
            </form>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <section className="bg-white rounded-xl shadow p-8">
          <h2 className="text-3xl font-bold text-black mb-3">
            ようこそ、{user.user_metadata?.display_name || user.email}さん
          </h2>
          <p className="text-slate-600">
            就活管理アプリのダッシュボードです。企業情報や選考状況をここから確認できます。
          </p>

          <div className="flex flex-wrap gap-3 mt-6">
            <Link
              href="/companies"
              className="px-5 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              企業一覧を見る
            </Link>

            <Link
              href="/companies/board"
              className="px-5 py-2 rounded-md bg-slate-800 text-white hover:bg-slate-900"
            >
              選考管理ボードを見る
            </Link>

            <Link
              href={`/companies?status=${SELECTION_STATUS_OPTIONS[0]}`}
              className="px-5 py-2 rounded-md bg-slate-200 text-black hover:bg-slate-300"
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
            <article key={kpi.label} className="rounded-xl bg-white p-6 shadow">
              <p className="mb-2 text-sm text-slate-500">{kpi.label}</p>
              <p className="text-3xl font-bold text-black">{kpi.value}</p>
              <p className="mt-2 text-sm text-slate-600">{kpi.description}</p>
            </article>
          ))}
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-black">最近更新した企業</h3>
              <Link href="/companies" className="text-blue-600 hover:underline">
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
                    className="border rounded-lg p-4 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/companies/${company.id}`}
                        className="font-semibold text-black hover:text-blue-600 hover:underline"
                      >
                        {company.company_name}
                      </Link>

                      <p className="text-sm text-slate-600 mt-1">
                        業界: {company.industry || "未設定"}
                      </p>
                    </div>

                    <span className="shrink-0 px-3 py-1 rounded-full bg-slate-100 text-black text-sm">
                      {company.selection_status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-2xl font-bold text-black mb-4">アカウント情報</h3>

            <dl className="space-y-4">
              <div>
                <dt className="text-sm text-slate-500">メールアドレス</dt>
                <dd className="text-black">{user.email}</dd>
              </div>

              <div>
                <dt className="text-sm text-slate-500">ユーザーID</dt>
                <dd className="text-black break-all">{user.id}</dd>
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
                次のおすすめ実装
              </h4>
              <ul className="space-y-2 text-slate-700">
                <li>・面接ログ機能の追加</li>
                <li>・ES管理ページの追加</li>
                <li>・締切タスク管理の追加</li>
                <li>・カレンダー表示の追加</li>
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
            {scheduleEvents.length === 0 && todayDeadlineTasks.length === 0 ? (
              <p className="text-slate-500">今日の予定はありません。</p>
            ) : (
              <div className="space-y-3">
                {scheduleEvents.map((event) => (
                  <div key={event.id} className="border rounded-lg p-4">
                    <p className="font-semibold text-black">{event.title}</p>
                    <p className="text-sm text-slate-600 mt-1">
                      {formatScheduleDate(event.start_at)}
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
                        {formatDeadlineDate(task.due_date)}
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
            {weeklyDeadlineTasks.length === 0 ? (
              <p className="text-slate-500">今週の締切はありません。</p>
            ) : (
              <div className="space-y-3">
                {weeklyDeadlineTasks.map((task) => (
                  <div key={task.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-black">{task.title}</p>
                      <span className="shrink-0 text-sm text-slate-600">
                        {formatDeadlineDate(task.due_date)}
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
