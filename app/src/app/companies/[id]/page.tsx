import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";

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

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CompanyDetailPage({ params }: PageProps) {
  const { id } = await params;

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
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    notFound();
  }

  const company = data as Company;

  return (
    <div className="min-h-screen bg-slate-100">
      <nav className="bg-white border-b">
        <div className="max-w-4xl mx-auto h-16 px-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-black">会社概要</h1>

          <div className="flex items-center gap-4">
            <Link href="/companies" className="text-blue-600 hover:underline">
              企業一覧へ戻る
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

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow p-8 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500 mb-2">会社名</p>
              <h2 className="text-3xl font-bold text-black">
                {company.company_name}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-slate-100 text-black">
                {company.selection_status}
              </span>

              <Link
                href={`/companies/${company.id}/edit`}
                className="px-3 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700"
              >
                編集
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border rounded-lg p-4">
              <p className="text-sm text-slate-500 mb-1">業界</p>
              <p className="text-black">{company.industry || "未設定"}</p>
            </div>

            <div className="border rounded-lg p-4">
              <p className="text-sm text-slate-500 mb-1">志望度</p>
              <p className="text-black">{company.motivation_level}</p>
            </div>

            <div className="border rounded-lg p-4">
              <p className="text-sm text-slate-500 mb-1">作成日</p>
              <p className="text-black">
                {company.created_at
                  ? new Date(company.created_at).toLocaleString("ja-JP")
                  : "不明"}
              </p>
            </div>

            <div className="border rounded-lg p-4">
              <p className="text-sm text-slate-500 mb-1">更新済み</p>
              <p className="text-black">
                {company.updated_at
                  ? new Date(company.updated_at).toLocaleString("ja-JP")
                  : "不明"}
              </p>
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <p className="text-sm text-slate-500 mb-2">メモ</p>
            <p className="text-black whitespace-pre-wrap">
              {company.memo || "メモはありません"}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}