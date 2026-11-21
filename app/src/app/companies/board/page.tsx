import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
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
    <div className="ui-workspace">
      <main id="main-content" className="ui-main space-y-6">
        <PageHeading title="選考管理ボード" description="ステータスごとに企業を確認できます。" />
        <section className="ui-panel">
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
