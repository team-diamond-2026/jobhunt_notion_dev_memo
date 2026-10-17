"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "ダッシュボード" },
  { href: "/companies", label: "企業一覧" },
  { href: "/companies/board", label: "選考ボード" },
  { href: "/es", label: "ES管理" },
  { href: "/settings", label: "設定" },
];

export function AppHeader({ displayName }: { displayName: string }) {
  const pathname = usePathname();

  if (pathname === "/login" || pathname === "/reset-password") return null;

  return (
    <>
      <a href="#main-content" className="ui-skip-link">本文へ移動</a>
      <header className="ui-app-header">
        <div className="ui-header-account">
          <Link href="/" className="ui-brand" aria-label="Shukatsu OS ホーム">
            <span className="ui-brand-mark" aria-hidden="true">S</span>
            Shukatsu OS
          </Link>
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <span className="min-w-0 text-sm text-slate-600 [overflow-wrap:anywhere]">
              {displayName}
            </span>
            <form action="/logout" method="post" className="shrink-0">
              <button type="submit" className="ui-button ui-secondary">ログアウト</button>
            </form>
          </div>
        </div>
        <nav aria-label="メインナビゲーション" className="ui-navigation">
          {links.map(({ href, label }) => {
            const active = href === "/"
              ? pathname === "/"
              : href === "/companies"
                ? pathname.startsWith("/companies") && !pathname.startsWith("/companies/board")
                : pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined}>
                {label}
              </Link>
            );
          })}
        </nav>
      </header>
    </>
  );
}
