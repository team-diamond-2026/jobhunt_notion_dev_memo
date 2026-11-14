import type { ComponentProps } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("NEXT_REDIRECT"); } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function mockDashboard(eventError: { message: string } | null = null) {
  const eventsQuery = {
    select: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({
      data: eventError ? null : [{ id: "event-1", title: "最終面接", event_type: "interview", start_at: "2026-11-15T01:00:00Z", end_at: null, related_company_id: "company-1" }],
      error: eventError,
    }),
  };
  const companiesQuery = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({
      data: [{ id: "company-1", company_name: "サンプル企業", industry: "IT", selection_status: "最終面接" }],
      error: null,
    }),
  };
  mocks.createClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: "user-1", email: "test@example.com" } } }) },
    from: (table: string) => {
      if (table === "companies") return companiesQuery;
      if (table === "events") return eventsQuery;
      throw new Error(`Unexpected table: ${table}`);
    },
  });
  return eventsQuery;
}

describe("統合後のダッシュボード", () => {
  it("共通UIの企業情報とmainで追加された直近の予定を両方表示する", async () => {
    const eventsQuery = mockDashboard();
    render(await Home());

    expect(screen.getByRole("heading", { level: 1, name: "ダッシュボード" })).toBeTruthy();
    expect(screen.getByRole("main").id).toBe("main-content");
    expect(screen.getByRole("link", { name: "サンプル企業" }).getAttribute("href")).toBe("/companies/company-1");
    const upcoming = screen.getByRole("region", { name: "直近の予定" });
    expect(within(upcoming).getByRole("link", { name: /最終面接/ }).getAttribute("href")).toContain("event=event-1");
    expect(screen.getByRole("link", { name: "カレンダーを見る" }).getAttribute("href")).toBe("/calendar");
    expect(eventsQuery.order).toHaveBeenCalledWith("start_at", { ascending: true });
    expect(eventsQuery.limit).toHaveBeenCalledWith(5);
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("予定の取得に失敗しても企業情報とカレンダーへの導線を保つ", async () => {
    mockDashboard({ message: "private database error" });
    render(await Home());

    expect(screen.getByRole("link", { name: "サンプル企業" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("予定を取得できませんでした");
    expect(screen.getByRole("status").textContent).not.toContain("private database error");
    expect(screen.getByRole("link", { name: "カレンダーを見る" })).toBeTruthy();
    expect(screen.queryByText("直近の予定はありません")).toBeNull();
  });
});
