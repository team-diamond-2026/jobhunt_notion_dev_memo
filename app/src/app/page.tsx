import { redirect } from "next/navigation";
import { getCurrentUser } from "../lib/supabase/auth-server";
import Link from "next/link";

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-bold text-gray-900">Job Hunt</h1>
            <div className="flex items-center gap-4">
              <span className="text-gray-700">
                {user.user_metadata?.display_name || user.email}
              </span>
              <form action="/logout" method="post">
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
                >
                  ログアウト
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            ようこそ、{user.user_metadata?.display_name || user.email}さん
          </h2>
          <p className="text-gray-600 mb-6">
            このアプリケーションへようこそ。認証システムが正常に機能しています。
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                ユーザー情報
              </h3>
              <dl className="space-y-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="text-gray-900">{user.email}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    ユーザーID
                  </dt>
                  <dd className="text-gray-900 font-mono text-sm">{user.id}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">登録日</dt>
                  <dd className="text-gray-900">
                    {user.created_at
                      ? new Date(user.created_at).toLocaleDateString("ja-JP")
                      : "取得不可"}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                次のステップ
              </h3>
              <ul className="space-y-2 text-gray-700">
                <li>✓ 認証システムのテスト完了</li>
                <li>✓ ログイン/ログアウト機能が動作中</li>
                <li>→ 追加機能の実装を開始できます</li>
              </ul>

              <Link
                href="/companies"
                className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
              >
                企業一覧へ進む
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
