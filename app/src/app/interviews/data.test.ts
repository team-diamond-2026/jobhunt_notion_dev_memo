import { beforeEach, describe, expect, it, vi } from "vitest";
import { notFound, redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { getInterviewCompany, getInterviewContext, getInterviewLog, getInterviewLogs } from "./data";
import { companyId, interview, logId, userId } from "../../test/interview-fixtures";

vi.mock("../../lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => { throw new Error("redirect"); }),
  notFound: vi.fn(() => { throw new Error("not found"); }),
}));

function mockClient(data: unknown = interview, error: object | null = null) {
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }), returns: vi.fn().mockResolvedValue({ data, error }),
  };
  const client = { from: vi.fn().mockReturnValue(query), auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) } };
  const supabase = client as unknown as Awaited<ReturnType<typeof createClient>>;
  vi.mocked(createClient).mockResolvedValue(supabase);
  return { supabase, query, client };
}

describe("面接ログの取得", () => {
  beforeEach(() => vi.resetAllMocks());
  it("未ログインではログインへ遷移する", async () => {
    const { client } = mockClient();
    client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(getInterviewContext()).rejects.toThrow("redirect");
    expect(redirect).toHaveBeenCalledWith("/login");
  });
  it("一覧は所有者と企業に絞り、面接日の降順で取得する", async () => {
    const { supabase, query } = mockClient([interview]);
    expect(await getInterviewLogs(supabase, userId, companyId)).toEqual([interview]);
    expect(query.eq.mock.calls).toEqual([["companies.user_id", userId], ["company_id", companyId]]);
    expect(query.order).toHaveBeenNthCalledWith(1, "interview_date", { ascending: false, nullsFirst: false });
  });
  it("詳細も所有者を制限する", async () => {
    const { supabase, query } = mockClient();
    expect(await getInterviewLog(supabase, userId, logId)).toEqual(interview);
    expect(query.eq.mock.calls).toEqual([["id", logId], ["companies.user_id", userId]]);
  });
  it("他人のログ・企業や存在しないIDを404として扱う", async () => {
    const { supabase } = mockClient(null);
    await expect(getInterviewLog(supabase, userId, logId)).rejects.toThrow("not found");
    await expect(getInterviewCompany(supabase, userId, companyId)).rejects.toThrow("not found");
    expect(notFound).toHaveBeenCalledTimes(2);
  });
  it("不正なURLパラメータをクエリ前に拒否する", async () => {
    const { supabase, client } = mockClient();
    await expect(getInterviewLog(supabase, userId, "invalid")).rejects.toThrow("not found");
    await expect(getInterviewCompany(supabase, userId, "invalid")).rejects.toThrow("not found");
    expect(client.from).not.toHaveBeenCalled();
  });
  it("DBエラーを空データとして表示しない", async () => {
    const { supabase } = mockClient(null, { message: "private detail" });
    await expect(getInterviewLogs(supabase, userId)).rejects.toThrow("面接ログを取得できませんでした。");
  });
});
