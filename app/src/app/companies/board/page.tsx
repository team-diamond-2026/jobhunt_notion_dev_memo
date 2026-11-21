import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { isSelectionStatus, normalizeSelectionStatus, SELECTION_STATUS_OPTIONS } from "../../../lib/selection-status";

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

export default async function CompaniesBoardPage({ searchParams }: {
  searchParams: Promise<{ status?: string }>;
}) {
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
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`企業データの取得に失敗しました: ${error.message}`);
  }

  const companies = (data ?? []) as Company[];
  const { status: requestedStatus } = await searchParams;
  const selectedStatus = requestedStatus && isSelectionStatus(requestedStatus) ? requestedStatus : "";

  const groupedCompanies = SELECTION_STATUS_OPTIONS.map((status) => ({
    status,
    items: companies.filter((company) => normalizeSelectionStatus(company.selection_status) === status),
  })).filter((group) => !selectedStatus || group.status === selectedStatus);

  return (
    <div className="min-h-screen bg-slate-100">
      <nav className="bg-white border-b">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <h1 className="text-xl font-bold text-black sm:text-2xl">選考管理ボード</h1>

          <div className="grid grid-cols-2 items-center gap-2 text-sm md:flex md:gap-4">
            <Link href="/" className="inline-flex min-h-11 items-center text-blue-600 hover:underline">
              ダッシュボードへ戻る
            </Link>

            <Link href="/companies" className="inline-flex min-h-11 items-center text-blue-600 hover:underline">
              企業一覧へ戻る
            </Link>

            <Link href="/settings" className="inline-flex min-h-11 items-center text-blue-600 hover:underline">
              設定
            </Link>

            <form action="/logout" method="post">
              <button
                type="submit"
                className="min-h-11 rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700"
              >
                ログアウト
              </button>
            </form>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-[1600px] space-y-6 px-3 py-5 sm:px-4 sm:py-8">
        <section className="rounded-xl bg-white p-4 shadow sm:p-6">
          <h2 className="mb-2 text-xl font-bold text-black sm:text-2xl">
            選考状況を一覧で確認
          </h2>
          <p className="text-slate-600">
            ステータスごとに企業を確認できます。「ステータスを変更」から詳細画面で選び直し、「更新する」で保存してください。
          </p>
          <form key={selectedStatus} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label htmlFor="board-status" className="block text-sm font-medium text-slate-700">表示するステータス</label>
              <select id="board-status" name="status" defaultValue={selectedStatus} className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-3 text-base text-slate-950">
                <option value="">すべてのステータス</option>
                {SELECTION_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
            <button type="submit" className="min-h-11 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">表示する</button>
            {selectedStatus ? <Link href="/companies/board" className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm text-blue-600">すべて表示</Link> : null}
          </form>
        </section>

        <section className="md:overflow-x-auto" aria-label="選考ステータス別の企業" tabIndex={0}>
          <div className="grid grid-cols-1 gap-4 md:min-w-max md:grid-flow-col md:auto-cols-[320px] md:grid-cols-none">
            {groupedCompanies.map((group) => (
              <div
                key={group.status}
                className="flex min-w-0 flex-col gap-4 rounded-xl bg-white p-4 shadow md:min-h-[500px]"
              >
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="text-lg font-bold text-black">{group.status}</h3>
                  <span className="px-3 py-1 rounded-full bg-slate-100 text-black text-sm">
                    {group.items.length}件
                  </span>
                </div>

                {group.items.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    このステータスの企業はありません。
                  </p>
                ) : (
                  <div className="space-y-3">
                    {group.items.map((company) => (
                      <article
                        key={company.id}
                        className="min-w-0 rounded-lg border p-4 [overflow-wrap:anywhere]"
                      >
                        <h4 className="font-semibold text-black">
                          {company.company_name}
                        </h4>

                        <p className="text-sm text-slate-600 mt-2">
                          業界: {company.industry || "未設定"}
                        </p>
                        <p className="text-sm text-slate-600">
                          志望度: {company.motivation_level}
                        </p>
                        <p className="text-sm text-slate-600 line-clamp-3">
                          メモ: {company.memo || "なし"}
                        </p>
                        <div className="mt-3 grid gap-2">
                          <Link href={`/companies/${company.id}`} className="inline-flex min-h-11 items-center text-sm font-medium text-blue-600 hover:underline">企業詳細を開く</Link>
                          <Link href={`/companies/${company.id}#company-update`} className="inline-flex min-h-11 items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-blue-700">ステータスを変更</Link>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
