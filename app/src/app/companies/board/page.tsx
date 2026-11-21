import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { isSelectionStatus, SELECTION_STATUS_OPTIONS, type SelectionCompany } from "../../../lib/selection-status";
import { SelectionBoard } from "./selection-board";

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
    .select("id,company_name,industry,motivation_level,memo,selection_status,updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`企業データの取得に失敗しました: ${error.message}`);
  }

  const companies = (data ?? []) as SelectionCompany[];
  const { status: requestedStatus } = await searchParams;
  const selectedStatus = requestedStatus && isSelectionStatus(requestedStatus) ? requestedStatus : "";

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
          <p id="board-instructions" className="text-slate-600">
            カードをドラッグするか「移動先」を選ぶと、選考状況を保存できます。企業詳細からも変更できます。
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

        <SelectionBoard companies={companies} selectedStatus={selectedStatus} />
      </main>
    </div>
  );
}
