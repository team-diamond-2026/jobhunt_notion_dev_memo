import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "../../../lib/supabase/server";
import { revalidatePath } from "next/cache";
import { updateSelectionStatus } from "./actions";

vi.mock("../../../lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const id = "00000000-0000-0000-0000-000000000047";

function mockClient({ user = { id: "current-user" } as { id: string } | null, error = null as object | null, data = { id } as { id: string } | null, currentStatus = "応募済み" } = {}) {
  const query = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { selection_status: currentStatus }, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn().mockReturnValue(query),
  };
  vi.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>);
  return { client, query };
}

describe("updateSelectionStatus", () => {
  beforeEach(() => vi.resetAllMocks());

  it("本人所有の企業に限定してステータスと更新日時を保存し、両画面を再検証する", async () => {
    const { client, query } = mockClient();
    expect(await updateSelectionStatus(id, "一次面接")).toEqual({ ok: true });
    expect(client.from).toHaveBeenCalledWith("companies");
    expect(query.update).toHaveBeenCalledWith({ selection_status: "一次面接", updated_at: expect.any(String) });
    expect(query.eq.mock.calls).toEqual([
      ["id", id], ["user_id", "current-user"],
      ["id", id], ["user_id", "current-user"], ["selection_status", "応募済み"],
    ]);
    expect(query.select).toHaveBeenCalledWith("id");
    expect(revalidatePath).toHaveBeenCalledWith("/companies");
    expect(revalidatePath).toHaveBeenCalledWith("/companies/board");
    expect(revalidatePath).toHaveBeenCalledWith(`/companies/${id}`);
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("前の段階への変更をサーバーでも拒否する", async () => {
    const { query } = mockClient({ currentStatus: "最終面接" });
    expect(await updateSelectionStatus(id, "一次面接")).toMatchObject({ ok: false });
    expect(query.update).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("同じステータスの場合はDBを更新しない", async () => {
    const { query } = mockClient({ currentStatus: "一次面接" });
    expect(await updateSelectionStatus(id, "一次面接")).toEqual({ ok: true });
    expect(query.update).not.toHaveBeenCalled();
  });

  it("対象企業を取得できなければ更新しない", async () => {
    const { query } = mockClient();
    query.single.mockResolvedValue({ data: null, error: { message: "not found" } });
    expect((await updateSelectionStatus(id, "内定")).ok).toBe(false);
    expect(query.update).not.toHaveBeenCalled();
  });

  it.each([[id, "不正なステータス"], ["", "内定"], ["invalid-id", "内定"]])("不正な引数をDB操作前に拒否する: %s / %s", async (companyId, status) => {
    expect((await updateSelectionStatus(companyId, status)).ok).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("未ログインでは更新しない", async () => {
    const { client } = mockClient({ user: null });
    expect((await updateSelectionStatus(id, "内定")).ok).toBe(false);
    expect(client.from).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("認証エラーでは更新しない", async () => {
    const { client } = mockClient();
    client.auth.getUser.mockResolvedValue({ data: { user: { id: "current-user" } }, error: { message: "auth failed" } });
    expect((await updateSelectionStatus(id, "内定")).ok).toBe(false);
    expect(client.from).not.toHaveBeenCalled();
  });

  it.each([
    { error: { message: "database error" }, data: null },
    { error: null, data: null },
  ])("DBエラー、他人の企業や削除済み企業への更新を成功扱いしない: %j", async (result) => {
    mockClient(result);
    expect((await updateSelectionStatus(id, "内定")).ok).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
