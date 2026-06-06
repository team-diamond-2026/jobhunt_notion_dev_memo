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
    <div className="min-h-screen bg-slate-100">
      <nav className="bg-white border-b">
        <div className="max-w-6xl mx-auto h-16 px-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">企業一覧</h1>

          <div className="flex items-center gap-4">
            <Link href="/" className="text-blue-600 hover:underline">
              ホームへ戻る
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

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <section className="bg-white rounded-xl shadow p-6">
          <h2 className="text-2xl font-bold text-black mb-4">企業を追加</h2>

          <form action={createCompany} className="grid gap-4">
            <div>
              <label className="block text-black mb-1">企業名 *</label>
              <input
                name="company_name"
                type="text"
                required
                placeholder="例: 株式会社サンプル"
                className="w-full border text-black px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-black mb-1">業界</label>
              <input
                name="industry"
                type="text"
                placeholder="例: IT / 小売 / 通信"
                className="w-full border text-black px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-black mb-1">志望度</label>
              <select
                name="motivation_level"
                defaultValue="0"
                className="w-full border text-black px-3 py-2"
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
              <label className="block text-black mb-1">
                選考ステータス
              </label>
              <select
                name="selection_status"
                defaultValue="未エントリー"
                className="w-full border text-black px-3 py-2"
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

            <div>
              <label className="block text-black mb-1">メモ</label>
              <textarea
                name="memo"
                rows={4}
                placeholder="企業研究メモなど"
                className="w-full border text-black px-3 py-2"
              />
            </div>

            <button
              type="submit"
              className="w-fit px-5 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              企業を登録
            </button>
          </form>
        </section>

        <section className="bg-white rounded-xl shadow p-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">登録済み企業</h2>

          {companies.length === 0 ? (
            <p className="text-slate-500">まだ企業が登録されていません。</p>
          ) : (
            <div className="grid gap-4">
              {companies.map((company) => (
                <div key={company.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-black font-semibold">{company.company_name}</h3>
                    <span className="text-black px-3 py-1 rounded-full bg-slate-100">
                      {company.selection_status}
                    </span>
                  </div>

                  <p className="text-sm text-slate-600">
                    業界: {company.industry || "未設定"}
                  </p>
                  <p className="text-sm text-slate-600">
                    志望度: {company.motivation_level}
                  </p>
                  <p className="text-sm text-slate-600">
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