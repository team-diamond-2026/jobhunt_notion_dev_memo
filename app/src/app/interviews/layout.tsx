import Link from "next/link";
import { interviewLink, interviewButton } from "./styles";

export default function InterviewsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-slate-100 text-slate-900">
      <nav aria-label="面接ログのナビゲーション" className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Link href="/interviews" className={`${interviewLink} justify-start text-xl font-bold`}>面接ログ</Link>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className={interviewLink}>ホーム</Link>
            <Link href="/companies" className={interviewLink}>企業一覧</Link>
            <Link href="/interviews/new" className={interviewButton}>面接を記録</Link>
          </div>
        </div>
      </nav>
      <main id="main-content" className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 [overflow-wrap:anywhere]">{children}</main>
    </div>
  );
}
