import Link from "next/link";
import { redirect } from "next/navigation";
import type { SelectionCompany } from "../../../lib/selection-status";
import { createClient } from "../../../lib/supabase/server";
import { SelectionBoard } from "./selection-board";

export default async function CompaniesBoardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("companies")
    .select("id, company_name, industry, motivation_level, selection_status, memo")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`選考管理ボードの取得に失敗しました: ${error.message}`);
  }

  return (
    <div className="min-h-dvh bg-slate-100 text-slate-900">
      <nav className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <h1 className="text-xl font-bold sm:text-2xl">選考管理ボード</h1>
          <div className="flex flex-wrap gap-3">
            <Link href="/" className="flex min-h-11 items-center rounded-md px-3 py-2 text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600">
              ホームへ戻る
            </Link>
            <Link href="/companies" className="flex min-h-11 items-center rounded-md px-3 py-2 text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600">
              企業一覧・登録
            </Link>
            <Link href="/settings" className="flex min-h-11 items-center rounded-md px-3 py-2 text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600">設定</Link>
            <form action="/logout" method="post">
              <button type="submit" className="min-h-11 rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600">ログアウト</button>
            </form>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6 sm:py-8">
        <p id="board-instructions" className="text-slate-600">
          企業カードを移動先の列へドラッグすると、選考ステータスを変更できます。
          スマホやキーボードでは、カード内の「移動先」を選択してください。選考ステータスは前の段階へ戻せません。
        </p>
        <SelectionBoard companies={(data ?? []) as SelectionCompany[]} />
      </main>
    </div>
  );
}
