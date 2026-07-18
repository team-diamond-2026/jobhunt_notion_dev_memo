import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { saveSettings } from "./actions";
import { SubmitButton } from "./submit-button";

type PageProps = {
  searchParams: Promise<{
    saved?: string;
    error?: string;
  }>;
};

type UserProfile = {
  name: string | null;
  email: string | null;
};

type UserSettings = {
  email_notifications: boolean;
  deadline_reminders: boolean;
  weekly_digest: boolean;
  reminder_timing: string;
  theme: string;
  density: string;
  default_view: string;
};

const DEFAULT_SETTINGS: UserSettings = {
  email_notifications: true,
  deadline_reminders: true,
  weekly_digest: false,
  reminder_timing: "morning",
  theme: "system",
  density: "comfortable",
  default_view: "dashboard",
};

const fieldClass =
  "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-950 shadow-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200";

function isSettings(value: unknown): Partial<UserSettings> {
  return typeof value === "object" && value !== null ? (value as Partial<UserSettings>) : {};
}

function SettingsToggle({
  name,
  title,
  description,
  defaultChecked,
}: {
  name: string;
  title: string;
  description: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 p-4">
      <span>
        <span className="block text-sm font-semibold text-slate-950">{title}</span>
        <span className="mt-1 block text-sm text-slate-600">{description}</span>
      </span>
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-slate-950"
      />
    </label>
  );
}

export default async function SettingsPage({ searchParams }: PageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: persistedSettings }, resolvedSearchParams] =
    await Promise.all([
      supabase
        .from("user_settings")
        .select(
          "email_notifications,deadline_reminders,weekly_digest,reminder_timing,theme,density,default_view",
        )
        .eq("user_id", user.id)
        .maybeSingle(),
      searchParams,
    ]);

  const metadataSettings = isSettings(user.user_metadata?.settings);
  const userProfile = {
    name: user.user_metadata?.display_name ?? user.user_metadata?.name ?? "",
    email: user.email ?? "",
  } as UserProfile;
  const settings = {
    ...DEFAULT_SETTINGS,
    ...metadataSettings,
    ...(persistedSettings as Partial<UserSettings> | null),
  };
  const displayName =
    userProfile.name || user.user_metadata?.display_name || user.email || "ユーザー";

  return (
    <div className="min-h-screen bg-slate-100">
      <nav className="border-b bg-white">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-500">アカウント</p>
            <h1 className="text-2xl font-bold text-slate-950">設定</h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/" className="text-sm font-medium text-blue-600 hover:underline">
              ダッシュボード
            </Link>
            <Link
              href="/companies"
              className="rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-slate-300"
            >
              企業一覧
            </Link>
            <form action="/logout" method="post">
              <button
                type="submit"
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                ログアウト
              </button>
            </form>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-950 sm:text-3xl">
            {displayName}さんの設定
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            プロフィール、通知、表示方法をまとめて管理できます。
          </p>
        </div>

        {resolvedSearchParams.saved === "1" ? (
          <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            設定を保存しました。
          </div>
        ) : null}

        {resolvedSearchParams.error === "profile" ? (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            名前を入力してください。
          </div>
        ) : null}

        <form action={saveSettings} className="space-y-6">
          <section className="rounded-lg bg-white p-5 shadow-sm sm:p-6">
            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-lg font-bold text-slate-950">プロフィール設定</h3>
              <p className="mt-1 text-sm text-slate-600">
                アプリ上で表示する基本情報です。
              </p>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="text-sm font-medium text-slate-700">
                  表示名
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  defaultValue={userProfile.name ?? ""}
                  placeholder="山田 太郎"
                  className={fieldClass}
                />
              </div>

              <div>
                <label htmlFor="email" className="text-sm font-medium text-slate-700">
                  メールアドレス
                </label>
                <input
                  id="email"
                  type="email"
                  value={userProfile.email ?? user.email ?? ""}
                  readOnly
                  className={`${fieldClass} bg-slate-50 text-slate-600`}
                />
                <p className="mt-1 text-xs text-slate-500">
                  メールアドレス変更は認証フロー側で扱います。
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-lg bg-white p-5 shadow-sm sm:p-6">
            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-lg font-bold text-slate-950">通知設定</h3>
              <p className="mt-1 text-sm text-slate-600">
                就活タスクの見落としを防ぐための通知を調整します。
              </p>
            </div>

            <div className="mt-5 grid gap-3">
              <SettingsToggle
                name="email_notifications"
                title="メール通知"
                description="重要な更新や締切の通知をメールで受け取ります。"
                defaultChecked={settings.email_notifications}
              />
              <SettingsToggle
                name="deadline_reminders"
                title="締切リマインド"
                description="ES提出や面接予定が近づいたときに通知します。"
                defaultChecked={settings.deadline_reminders}
              />
              <SettingsToggle
                name="weekly_digest"
                title="週次まとめ"
                description="今週の応募状況や未完了タスクをまとめて確認します。"
                defaultChecked={settings.weekly_digest}
              />
            </div>

            <div className="mt-5">
              <label
                htmlFor="reminder_timing"
                className="text-sm font-medium text-slate-700"
              >
                リマインドタイミング
              </label>
              <select
                id="reminder_timing"
                name="reminder_timing"
                defaultValue={settings.reminder_timing}
                className={fieldClass}
              >
                <option value="none">通知しない</option>
                <option value="morning">当日の朝</option>
                <option value="previous_day">前日</option>
                <option value="three_days">3日前</option>
              </select>
            </div>
          </section>

          <section className="rounded-lg bg-white p-5 shadow-sm sm:p-6">
            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-lg font-bold text-slate-950">表示設定</h3>
              <p className="mt-1 text-sm text-slate-600">
                初期表示や画面の密度を好みに合わせます。
              </p>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="theme" className="text-sm font-medium text-slate-700">
                  テーマ
                </label>
                <select
                  id="theme"
                  name="theme"
                  defaultValue={settings.theme}
                  className={fieldClass}
                >
                  <option value="system">システム設定に合わせる</option>
                  <option value="light">ライト</option>
                  <option value="dark">ダーク</option>
                </select>
              </div>

              <div>
                <label htmlFor="density" className="text-sm font-medium text-slate-700">
                  表示密度
                </label>
                <select
                  id="density"
                  name="density"
                  defaultValue={settings.density}
                  className={fieldClass}
                >
                  <option value="comfortable">標準</option>
                  <option value="compact">コンパクト</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="default_view"
                  className="text-sm font-medium text-slate-700"
                >
                  初期画面
                </label>
                <select
                  id="default_view"
                  name="default_view"
                  defaultValue={settings.default_view}
                  className={fieldClass}
                >
                  <option value="dashboard">ダッシュボード</option>
                  <option value="companies">企業一覧</option>
                  <option value="board">選考ボード</option>
                </select>
              </div>
            </div>

            <div
              className={`mt-5 rounded-lg border p-4 ${
                settings.theme === "dark"
                  ? "border-slate-700 bg-slate-900 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-950"
              }`}
            >
              <p className="text-sm font-semibold">現在の表示プレビュー</p>
              <p
                className={`mt-2 text-sm ${
                  settings.density === "compact" ? "leading-5" : "leading-7"
                }`}
              >
                テーマと表示密度の設定は保存後にこのプレビューへ反映されます。
              </p>
            </div>
          </section>

          <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-4 shadow-sm backdrop-blur sm:static sm:mx-0 sm:flex sm:items-center sm:justify-between sm:rounded-lg sm:border sm:px-5">
            <p className="mb-3 text-sm text-slate-600 sm:mb-0">
              保存した内容は再ログイン後も保持されます。
            </p>
            <SubmitButton />
          </div>
        </form>
      </main>
    </div>
  );
}
