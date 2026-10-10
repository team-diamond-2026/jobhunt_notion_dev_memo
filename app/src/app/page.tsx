import { redirect } from "next/navigation";
import { getCurrentUser } from "../lib/supabase/auth-server";
import Link from "next/link";

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-dvh bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-16 flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="shrink-0 text-xl font-bold text-gray-900">Job Hunt</h1>
            <div className="flex min-w-0 items-center justify-between gap-3 sm:justify-end sm:gap-4">
              <span className="min-w-0 text-gray-700 [overflow-wrap:anywhere]">
                {user.user_metadata?.display_name || user.email}
              </span>
              <form action="/logout" method="post" className="shrink-0">
                <button
                  type="submit"
                  className="min-h-11 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                >
                  ログアウト
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:py-12 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 [overflow-wrap:anywhere]">
            ようこそ、{user.user_metadata?.display_name || user.email}さん
          </h2>
          <p className="text-gray-600 mb-6">
            このアプリケーションへようこそ。認証システムが正常に機能しています。
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="min-w-0 border border-gray-200 rounded-lg p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                ユーザー情報
              </h3>
              <dl className="space-y-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="text-gray-900 [overflow-wrap:anywhere]">{user.email}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    ユーザーID
                  </dt>
                  <dd className="text-gray-900 font-mono text-sm [overflow-wrap:anywhere]">{user.id}</dd>
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

            <div className="min-w-0 border border-gray-200 rounded-lg p-4 sm:p-6">
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
                className="inline-flex min-h-11 w-full items-center justify-center mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition sm:w-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
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
