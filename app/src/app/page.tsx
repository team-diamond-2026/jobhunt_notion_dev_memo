import { StatusBadge } from "@/components/status-badge";
import { PageHeading } from "@/components/page-heading";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../lib/supabase/server";
import { SELECTION_STATUS_OPTIONS } from "../lib/selection-status";

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

  return (
    <div className="ui-workspace">
      <main id="main-content" className="ui-main space-y-6">
        <PageHeading title="ダッシュボード" description="企業情報と選考の進み具合を、ひとつの場所で確認できます。" />
        <section className="ui-panel">
          <h2 className="text-xl sm:text-2xl font-bold text-black mb-3">
            ようこそ、{user.user_metadata?.display_name || user.email}さん
          </h2>
          <p className="text-slate-600">
            就活管理アプリのダッシュボードです。企業情報や選考状況をここから確認できます。
          </p>

          <div className="flex flex-wrap gap-3 mt-6">
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

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <div className="ui-panel">
            <p className="text-sm text-slate-500 mb-2">登録企業数</p>
            <p className="text-3xl font-bold text-black">{totalCompanies}</p>
          </div>

          <div className="ui-panel">
            <p className="text-sm text-slate-500 mb-2">未応募</p>
            <p className="text-3xl font-bold text-black">{notEnteredCount}</p>
          </div>

          <div className="ui-panel">
            <p className="text-sm text-slate-500 mb-2">面接中</p>
            <p className="text-3xl font-bold text-black">{interviewCount}</p>
          </div>

          <div className="ui-panel">
            <p className="text-sm text-slate-500 mb-2">内定</p>
            <p className="text-3xl font-bold text-black">{offerCount}</p>
          </div>
        </section>

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
                        className="font-semibold text-black hover:text-blue-600 hover:underline"
                      >
                        {company.company_name}
                      </Link>

                      <p className="text-sm text-slate-600 mt-1">
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
                次の準備を進めましょう
              </h4>
              <ul className="space-y-2 text-slate-700">
                <li>・気になる企業を登録して比較する</li>
                <li>・企業ごとのESを下書きする</li>
                <li>・選考ボードで進み具合を確認する</li>
                <li>・面接の前に企業研究メモを見返す</li>
              </ul>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
