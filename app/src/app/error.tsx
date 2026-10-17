"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main-content" className="ui-main">
      <section className="ui-panel ui-empty-state" role="alert">
        <p className="ui-eyebrow">読み込みエラー</p>
        <h1 className="text-2xl font-bold">画面を表示できませんでした</h1>
        <p className="mt-3 text-slate-600">通信状況を確認して、もう一度お試しください。繰り返し発生する場合は、時間をおいて再度アクセスしてください。</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="ui-button ui-primary">もう一度読み込む</button>
          <Link href="/" className="ui-button ui-secondary">ダッシュボードへ戻る</Link>
        </div>
      </section>
    </main>
  );
}
