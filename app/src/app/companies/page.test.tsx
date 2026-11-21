// @vitest-environment jsdom

import { Suspense, use, useState, type ComponentProps, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ErrorBoundaryHandler } from "next/dist/client/components/error-boundary";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CompaniesPage from "./page";
import ErrorPage from "../error";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), deleteCompany: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("./actions", () => ({ deleteCompany: mocks.deleteCompany }));
vi.mock("./create-form", () => ({ CompanyCreateForm: () => <p>企業登録フォーム</p> }));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...await importOriginal<typeof import("next/navigation")>(),
  redirect: () => { throw new Error("NEXT_REDIRECT"); },
}));

type Row = { id: string; company_name: string; industry: string; selection_status: string; motivation_level: number; memo: string; updated_at: string };

function mockDatabase(data: Row[] = [], error: { message: string } | null = null, user: object | null = { id: "test-user" }) {
  const result = { data, error };
  const query = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then: Promise.resolve(result).then.bind(Promise.resolve(result)),
  };
  mocks.createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user } }) }, from: () => query });
  return query;
}

beforeEach(() => { mocks.createClient.mockReset(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// Model an RSC payload cached by the router. Only refresh starts a new server
// render; resetting the real Next.js boundary alone reuses the rejected payload.
async function renderFailedServerPage() {
  const searchParams = Promise.resolve({ keyword: "復帰", industry: "IT" });
  const initialPage = CompaniesPage({ searchParams });
  await expect(initialPage).rejects.toThrow("企業一覧の取得に失敗しました");
  vi.spyOn(console, "error").mockImplementation(() => {});
  const refresh = vi.fn();
  const router: AppRouterInstance = {
    back: vi.fn(), forward: vi.fn(), push: vi.fn(), replace: vi.fn(),
    prefetch: vi.fn(), refresh,
  };

  function ServerPayload({ page }: { page: Promise<ReactNode> }) {
    return use(page);
  }

  function TestRouter() {
    const [page, setPage] = useState<Promise<ReactNode>>(initialPage);
    refresh.mockImplementation(() => setPage(CompaniesPage({ searchParams })));
    return (
      <AppRouterContext.Provider value={router}>
        <Suspense fallback={<p>読み込み中</p>}>
          <ErrorBoundaryHandler pathname="/companies" errorComponent={ErrorPage}>
            <ServerPayload page={page} />
          </ErrorBoundaryHandler>
        </Suspense>
      </AppRouterContext.Provider>
    );
  }

  await act(async () => { render(<TestRouter />); });
  expect((await screen.findByRole("alert")).textContent).not.toContain("private database error");
  expect(mocks.createClient).toHaveBeenCalledTimes(1);
  return refresh;
}

describe("企業一覧の検索と表示状態", () => {
  it("未登録の場合は最初の登録を案内する", async () => {
    mockDatabase();
    render(await CompaniesPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("heading", { name: "最初の企業を登録しましょう" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "条件に一致する企業がありません" })).toBeNull();
    expect(screen.getByRole("search").getAttribute("aria-label")).toBe("企業の検索と絞り込み");
  });

  it("検索0件では入力条件を保持し、全件表示への導線を出す", async () => {
    const query = mockDatabase();
    render(await CompaniesPage({ searchParams: Promise.resolve({ keyword: "サンプル", industry: "IT", status: "一次面接", sort: "motivation_desc" }) }));
    expect(query.ilike).toHaveBeenCalledWith("company_name", "%サンプル%");
    expect(query.ilike).toHaveBeenCalledWith("industry", "%IT%");
    expect(query.eq).toHaveBeenCalledWith("selection_status", "一次面接");
    expect(query.order).toHaveBeenCalledWith("motivation_level", { ascending: false });
    expect((screen.getByLabelText("企業名") as HTMLInputElement).value).toBe("サンプル");
    expect(screen.getByRole("heading", { name: "条件に一致する企業がありません" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "条件をクリアして全件表示" }).getAttribute("href")).toBe("/companies");
  });

  it("長い企業名でも詳細・編集と選考状況を企業カードに表示する", async () => {
    const name = "VeryLongCompanyName".repeat(10);
    mockDatabase([{ id: "company-1", company_name: name, industry: "IT", selection_status: "一次面接", motivation_level: 5, memo: "企業研究メモ", updated_at: "2026-10-17T00:00:00Z" }]);
    render(await CompaniesPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("article", { name }).textContent).toContain("一次面接");
    expect(screen.getByRole("link", { name: "詳細" }).getAttribute("href")).toBe("/companies/company-1");
    expect(screen.getByRole("link", { name: "編集" }).getAttribute("href")).toBe("/companies/company-1/edit");
  });

  it("取得失敗後、再試行でサーバーのデータを再取得して企業一覧を表示する", async () => {
    mockDatabase([], { message: "private database error" });
    const refresh = await renderFailedServerPage();
    expect(screen.queryByRole("heading", { name: "条件に一致する企業がありません" })).toBeNull();

    const query = mockDatabase([{ id: "company-1", company_name: "復帰テスト企業", industry: "IT", selection_status: "一次面接", motivation_level: 5, memo: "", updated_at: "2026-10-17T00:00:00Z" }]);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "もう一度読み込む" })); });

    expect(await screen.findByRole("article", { name: "復帰テスト企業" })).toBeTruthy();
    expect(refresh).toHaveBeenCalledOnce();
    expect(mocks.createClient).toHaveBeenCalledTimes(2);
    expect(query.ilike).toHaveBeenCalledWith("company_name", "%復帰%");
    expect(query.ilike).toHaveBeenCalledWith("industry", "%IT%");
    expect((screen.getByLabelText("企業名") as HTMLInputElement).value).toBe("復帰");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("再取得も失敗する場合はエラー案内を残し、さらに再試行できる", async () => {
    mockDatabase([], { message: "private database error" });
    const refresh = await renderFailedServerPage();

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "もう一度読み込む" })); });

    expect(refresh).toHaveBeenCalledOnce();
    expect(mocks.createClient).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("alert").textContent).not.toContain("private database error");
    expect(screen.queryByRole("heading", { name: "条件に一致する企業がありません" })).toBeNull();

    mockDatabase();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "もう一度読み込む" })); });

    expect(await screen.findByRole("heading", { name: "条件に一致する企業がありません" })).toBeTruthy();
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(mocks.createClient).toHaveBeenCalledTimes(3);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("未認証のユーザーには一覧を表示しない", async () => {
    mockDatabase([], null, null);
    await expect(CompaniesPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_REDIRECT");
  });
});
