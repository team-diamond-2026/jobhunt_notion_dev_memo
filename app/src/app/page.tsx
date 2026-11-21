import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../lib/supabase/server";
import { SELECTION_STATUS_OPTIONS } from "../lib/selection-status";
import { UpcomingEvents } from "@/components/calendar/upcoming-events";
import {
  CalendarEvent,
  CALENDAR_EVENT_COLUMNS,
  getUpcomingEventRange,
  UPCOMING_EVENT_LIMIT,
} from "@/lib/calendar";

type Company = {
  id: string;
  user_id: string;
  company_name: string;
  industry: string | null;
  motivation_level: number;
  selection_status: string;
  memo: string | null;
  created_at: string;
  updated_at: string;
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

  const companies = (data ?? []) as Company[];

  const totalCompanies = companies.length;
  const notEnteredCount = companies.filter(
    (company) => company.selection_status === SELECTION_STATUS_OPTIONS[0],
  ).length;
  const interviewCount = companies.filter((company) =>
    ["一次面接", "二次面接", "最終面接"].includes(company.selection_status),
  ).length;
  const offerCount = companies.filter(
    (company) => company.selection_status === "内定",
  ).length;

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
    <div className="min-h-dvh bg-slate-100">
      <nav className="border-b bg-white">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <h1 className="text-xl font-bold text-black sm:text-2xl">Job Hunt Dashboard</h1>

          <div className="flex min-w-0 items-center justify-between gap-3 sm:justify-end sm:gap-4">
            <span className="min-w-0 text-slate-700 [overflow-wrap:anywhere]">
              {user.user_metadata?.display_name || user.email}
            </span>

            <Link href="/settings" className="inline-flex min-h-11 shrink-0 items-center rounded-md px-2 text-sm text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600">
              設定
            </Link>

            <form action="/logout" method="post" className="shrink-0">
              <button
                type="submit"
                className="min-h-11 rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
              >
                ログアウト
              </button>
            </form>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:space-y-8 sm:px-6 sm:py-8">
        <section className="rounded-xl bg-white p-4 shadow sm:p-8">
          <h2 className="mb-3 text-2xl font-bold text-black [overflow-wrap:anywhere] sm:text-3xl">
            ようこそ、{user.user_metadata?.display_name || user.email}さん
          </h2>
          <p className="text-slate-600">
            就活管理アプリのダッシュボードです。企業情報や選考状況をここから確認できます。
          </p>

          <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
            <Link
              href="/companies"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-blue-600 px-5 py-2 text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:w-auto"
            >
              企業一覧を見る
            </Link>

            <Link
              href="/companies/board"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-slate-800 px-5 py-2 text-white hover:bg-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 sm:w-auto"
            >
              選考管理ボードを見る
            </Link>

            <Link href="/interviews" className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-blue-600 px-5 py-2 text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600 sm:w-auto">
              面接ログを見る
            </Link>

            <Link
              href="/calendar"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-violet-600 px-5 py-2 text-white hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 sm:w-auto"
            >
              カレンダーを見る
            </Link>

            <Link
              href="/es"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-emerald-600 px-5 py-2 text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:w-auto"
            >
              ESを管理
            </Link>

            <Link
              href={`/companies?status=${SELECTION_STATUS_OPTIONS[0]}`}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-slate-200 px-5 py-2 text-black hover:bg-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 sm:w-auto"
            >
              未応募を確認
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <div className="rounded-xl bg-white p-4 shadow sm:p-6">
            <p className="text-sm text-slate-500 mb-2">登録企業数</p>
            <p className="text-3xl font-bold text-black">{totalCompanies}</p>
          </div>

          <div className="rounded-xl bg-white p-4 shadow sm:p-6">
            <p className="text-sm text-slate-500 mb-2">未応募</p>
            <p className="text-3xl font-bold text-black">{notEnteredCount}</p>
          </div>

          <div className="rounded-xl bg-white p-4 shadow sm:p-6">
            <p className="text-sm text-slate-500 mb-2">面接中</p>
            <p className="text-3xl font-bold text-black">{interviewCount}</p>
          </div>

          <div className="rounded-xl bg-white p-4 shadow sm:p-6">
            <p className="text-sm text-slate-500 mb-2">内定</p>
            <p className="text-3xl font-bold text-black">{offerCount}</p>
          </div>
        </section>

        <UpcomingEvents events={upcomingEvents} hasError={Boolean(eventError)} />

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="rounded-xl bg-white p-4 shadow sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-2xl font-bold text-black">最近更新した企業</h3>
              <Link href="/companies" className="inline-flex min-h-11 items-center rounded-md px-2 text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600">
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
                    className="flex min-w-0 flex-wrap items-center justify-between gap-4 rounded-lg border p-4 sm:flex-nowrap"
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

                    <span className="shrink-0 px-3 py-1 rounded-full bg-slate-100 text-black text-sm">
                      {company.selection_status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl bg-white p-4 shadow sm:p-6">
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
                次のおすすめ実装
              </h4>
              <ul className="space-y-2 text-slate-700">
                <li>・ESテンプレートの追加</li>
                <li>・締切タスク管理の追加</li>
                <li>・カレンダーで予定を登録・編集</li>
              </ul>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
