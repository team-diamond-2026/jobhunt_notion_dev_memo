"use client";

import Link from "next/link";
import { interviewButton, interviewLink } from "./styles";

export default function InterviewsError({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="space-y-3 rounded-xl bg-white p-4 sm:p-6">
      <h1 className="text-xl font-bold">面接ログを表示できませんでした</h1>
      <p>時間をおいて、もう一度お試しください。</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={reset} className={interviewButton}>再試行</button>
        <Link href="/companies" className={interviewLink}>企業一覧へ</Link>
      </div>
    </div>
  );
}
