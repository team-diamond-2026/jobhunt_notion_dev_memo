import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { companyId, otherCompanyId, logId, userId, interviewFormData } from "../../test/interview-fixtures";
import { saveInterview } from "./actions";

vi.mock("../../lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("redirect"); }) }));

function mockQuery(data: object | null = null, error: object | null = null) {
  return {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
}

function mockClient() {
  const company = mockQuery({ id: companyId });
  const original = mockQuery({ id: logId, company_id: companyId });
  const mutation = mockQuery({ id: logId });
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
    from: vi.fn().mockReturnValueOnce(company).mockReturnValueOnce(mutation),
  };
  vi.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>);
  return { client, company, original, mutation, forEdit() { client.from.mockReset().mockReturnValueOnce(company).mockReturnValueOnce(original).mockReturnValueOnce(mutation); } };
}

describe("面接ログの保存", () => {
  beforeEach(() => vi.resetAllMocks());

  it("自分の企業に新規作成し、詳細へ遷移する", async () => {
    const { company, mutation } = mockClient();
    await expect(saveInterview(null, {}, interviewFormData())).rejects.toThrow("redirect");
    expect(company.eq.mock.calls).toEqual([["id", companyId], ["user_id", userId]]);
    expect(mutation.insert).toHaveBeenCalledWith(expect.objectContaining({ company_id: companyId, reflection: "結論から話す。" }));
    expect(mutation.insert).toHaveBeenCalledWith(expect.objectContaining({ questions: ["自己紹介をしてください。"], answers: ["開発経験を伝えた。"], interview_date: "2026-11-14T00:00:00+09:00" }));
    expect(revalidatePath).toHaveBeenCalledWith("/interviews");
    expect(revalidatePath).toHaveBeenCalledWith(`/companies/${companyId}`);
    expect(redirect).toHaveBeenCalledWith(`/interviews/${logId}`);
  });

  it("既存ログの所有者も確認し、企業変更時は変更前後の企業詳細を更新する", async () => {
    const { forEdit, original, mutation } = mockClient();
    forEdit();
    await expect(saveInterview(logId, {}, interviewFormData({ company_id: otherCompanyId }))).rejects.toThrow("redirect");
    expect(original.eq.mock.calls).toEqual([["id", logId], ["companies.user_id", userId]]);
    expect(mutation.update).toHaveBeenCalledWith(expect.objectContaining({ company_id: otherCompanyId }));
    expect(mutation.eq.mock.calls).toEqual([["id", logId], ["company_id", companyId]]);
    expect(revalidatePath).toHaveBeenCalledWith(`/companies/${companyId}`);
    expect(revalidatePath).toHaveBeenCalledWith(`/companies/${otherCompanyId}`);
  });

  it.each([null, logId])("入力不正ではDBにアクセスせず入力内容を返す: %s", async (id) => {
    const result = await saveInterview(id, {}, interviewFormData({ interview_date: "2026-02-30" }));
    expect(result.fieldErrors?.interview_date).toBeTruthy();
    expect(result.values?.questions).toBe("自己紹介をしてください。");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("不正なログIDで新規作成に切り替わらない", async () => {
    expect((await saveInterview("invalid", {}, interviewFormData())).error).toBeTruthy();
    expect(createClient).not.toHaveBeenCalled();
  });

  it.each([null, { id: userId }])("未ログイン・認証エラーでは保存しない: %j", async (user) => {
    const { client } = mockClient();
    client.auth.getUser.mockResolvedValue({ data: { user }, error: user ? { message: "invalid session" } : null });
    expect((await saveInterview(null, {}, interviewFormData())).error).toContain("ログイン");
    expect(client.from).not.toHaveBeenCalled();
  });

  it("他人の企業・削除された企業には紐付けられない", async () => {
    const { company, mutation } = mockClient();
    company.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await saveInterview(null, {}, interviewFormData())).error).toContain("企業が見つかりません");
    expect(mutation.insert).not.toHaveBeenCalled();
  });

  it("他人のログ・削除されたログは更新しない", async () => {
    const { forEdit, original, mutation } = mockClient();
    forEdit();
    original.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await saveInterview(logId, {}, interviewFormData())).error).toContain("編集できる面接ログ");
    expect(mutation.update).not.toHaveBeenCalled();
  });

  it.each([
    { data: null, error: { message: "private database detail" } },
    { data: null, error: null },
  ])("保存エラー・更新0件で成功扱いせず、入力を保持する: %j", async (response) => {
    const { mutation } = mockClient();
    mutation.maybeSingle.mockResolvedValue(response);
    const result = await saveInterview(null, {}, interviewFormData());
    expect(result.error).toContain("保存できません");
    expect(result.error).not.toContain("private database detail");
    expect(result.values?.answers).toBe("開発経験を伝えた。");
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("通信例外でも入力内容を返す", async () => {
    const { company } = mockClient();
    company.maybeSingle.mockRejectedValue(new Error("network"));
    const result = await saveInterview(null, {}, interviewFormData());
    expect(result.error).toContain("通信に失敗");
    expect(result.values?.reflection).toBe("結論から話す。");
  });
});
