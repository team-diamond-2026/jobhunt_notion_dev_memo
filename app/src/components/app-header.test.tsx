import type { ComponentProps } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppHeader } from "./app-header";

const route = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));
afterEach(cleanup);

describe("共通ナビゲーション", () => {
  it.each([
    ["/", "ダッシュボード"],
    ["/companies", "企業一覧"],
    ["/companies/company-1/edit", "企業一覧"],
    ["/companies/board", "選考ボード"],
    ["/es/new", "ES管理"],
    ["/es/document-1/edit", "ES管理"],
    ["/settings", "設定"],
  ])("%s では %s だけを現在地として表示する", (pathname, label) => {
    route.pathname = pathname;
    render(<AppHeader displayName="テストユーザー" />);
    const current = screen.getAllByRole("link").filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toBe(label);
  });

  it.each(["/login", "/reset-password"])("認証画面 %s ではナビゲーションを表示しない", (pathname) => {
    route.pathname = pathname;
    render(<AppHeader displayName="テストユーザー" />);
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("button", { name: "ログアウト" })).toBeNull();
  });
});
