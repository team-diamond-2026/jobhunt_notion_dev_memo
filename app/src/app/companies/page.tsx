import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { createCompany } from "./actions";

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

export default async function CompaniesPage() {
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
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`企業一覧の取得に失敗しました: ${error.message}`);
  }

  const companies = (data ?? []) as Company[];

  return (
    <div className="min-h-dvh bg-slate-100">
      <nav className="bg-white border-b">
        <div className="max-w-6xl mx-auto min-h-16 px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">企業一覧</h1>

          <div className="grid grid-cols-2 items-center gap-3 sm:flex sm:gap-4">
            <Link href="/" className="flex min-h-11 items-center justify-center rounded-md px-3 py-2 text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
              ホームへ戻る
            </Link>

            <form action="/logout" method="post">
              <button
                type="submit"
                className="min-h-11 w-full px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
              >
                ログアウト
              </button>
            </form>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6 sm:px-6 sm:py-8 sm:space-y-8">
        <section className="bg-white rounded-xl shadow p-4 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-bold text-black mb-4">企業を追加</h2>

          <form action={createCompany} className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <label htmlFor="company_name" className="block text-black mb-1">企業名 *</label>
              <input
                id="company_name"
                name="company_name"
                type="text"
                required
                placeholder="例: 株式会社サンプル"
                className="min-h-11 w-full min-w-0 rounded-md border text-base text-black px-3 py-2 focus-visible:outline-2 focus-visible:outline-blue-600"
              />
            </div>

            <div className="min-w-0">
              <label htmlFor="industry" className="block text-black mb-1">業界</label>
              <input
                id="industry"
                name="industry"
                type="text"
                placeholder="例: IT / 小売 / 通信"
                className="min-h-11 w-full min-w-0 rounded-md border text-base text-black px-3 py-2 focus-visible:outline-2 focus-visible:outline-blue-600"
              />
            </div>

            <div className="min-w-0">
              <label htmlFor="motivation_level" className="block text-black mb-1">志望度</label>
              <select
                id="motivation_level"
                name="motivation_level"
                defaultValue="0"
                className="min-h-11 w-full min-w-0 rounded-md border text-base text-black px-3 py-2 focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                <option value="0">0</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </select>
            </div>

            <div className="min-w-0">
              <label htmlFor="selection_status" className="block text-black mb-1">
                選考ステータス
              </label>
              <select
                id="selection_status"
                name="selection_status"
                defaultValue="未エントリー"
                className="min-h-11 w-full min-w-0 rounded-md border text-base text-black px-3 py-2 focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                <option value="未エントリー">未エントリー</option>
                <option value="ES提出">ES提出</option>
                <option value="Webテスト">Webテスト</option>
                <option value="1次面接">1次面接</option>
                <option value="2次面接">2次面接</option>
                <option value="最終面接">最終面接</option>
                <option value="内定">内定</option>
                <option value="お祈り">お祈り</option>
              </select>
            </div>

            <div className="min-w-0 sm:col-span-2">
              <label htmlFor="memo" className="block text-black mb-1">メモ</label>
              <textarea
                id="memo"
                name="memo"
                rows={4}
                placeholder="企業研究メモなど"
                className="min-h-11 w-full min-w-0 rounded-md border text-base text-black px-3 py-2 focus-visible:outline-2 focus-visible:outline-blue-600"
              />
            </div>

            <button
              type="submit"
              className="min-h-11 w-full px-5 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 sm:col-span-2 sm:w-fit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              企業を登録
            </button>
          </form>
        </section>

        <section className="bg-white rounded-xl shadow p-4 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">登録済み企業</h2>

          {companies.length === 0 ? (
            <p className="text-slate-500">まだ企業が登録されていません。</p>
          ) : (
            <div className="grid gap-4">
              {companies.map((company) => (
                <div key={company.id} className="min-w-0 border rounded-lg p-3 sm:p-4 space-y-2 [overflow-wrap:anywhere]">
                  <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between">
                    <h3 className="min-w-0 text-black font-semibold">{company.company_name}</h3>
                    <span className="shrink-0 text-sm text-black px-3 py-1 rounded-full bg-slate-100">
                      {company.selection_status}
                    </span>
                  </div>

                  <p className="text-base sm:text-sm text-slate-600">
                    業界: {company.industry || "未設定"}
                  </p>
                  <p className="text-base sm:text-sm text-slate-600">
                    志望度: {company.motivation_level}
                  </p>
                  <p className="whitespace-pre-wrap text-base sm:text-sm text-slate-600">
                    メモ: {company.memo || "なし"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
