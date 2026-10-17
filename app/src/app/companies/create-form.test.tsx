import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompanyCreateForm } from "./create-form";
import { INDUSTRY_CATEGORIES, INDUSTRY_CATEGORY_OTHER } from "./industry";

const { createCompany } = vi.hoisted(() => ({ createCompany: vi.fn() }));
vi.mock("./actions", () => ({ createCompany }));

afterEach(cleanup);
beforeEach(() => { createCompany.mockReset(); });

function fillForm() {
  fireEvent.change(screen.getByLabelText(/企業名/), { target: { value: "テスト企業" } });
  fireEvent.change(screen.getByLabelText(/業界カテゴリ/), { target: { value: INDUSTRY_CATEGORIES[0] } });
  fireEvent.change(screen.getByLabelText("メモ"), { target: { value: "入力を保持したいメモ" } });
  return screen.getByRole("button", { name: "企業を登録" }).closest("form")!;
}

describe("企業登録の操作とフィードバック", () => {
  it("必須項目と「その他」の業界名をネイティブのフォーム検証で要求する", () => {
    render(<CompanyCreateForm />);
    const form = screen.getByRole("button", { name: "企業を登録" }).closest("form")!;
    expect(form.checkValidity()).toBe(false);
    fillForm();
    expect(form.checkValidity()).toBe(true);
    fireEvent.change(screen.getByLabelText(/業界カテゴリ/), { target: { value: INDUSTRY_CATEGORY_OTHER } });
    expect(form.checkValidity()).toBe(false);
    fireEvent.change(screen.getByLabelText("業界名を入力"), { target: { value: "エンタメ" } });
    expect(form.checkValidity()).toBe(true);
  });

  it("登録中は操作と二重送信を抑止し、成功時に結果を通知して入力欄を初期化する", async () => {
    let finish!: () => void;
    createCompany.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<CompanyCreateForm />);
    const form = fillForm();
    fireEvent.submit(form);
    expect(screen.getByRole("button", { name: "登録中..." }).closest("fieldset")?.disabled).toBe(true);
    expect(form.getAttribute("aria-busy")).toBe("true");
    fireEvent.submit(form);
    expect(createCompany).toHaveBeenCalledTimes(1);
    const payload = createCompany.mock.calls[0][0] as FormData;
    expect(payload.get("company_name")).toBe("テスト企業");
    expect(payload.get("industry_category")).toBe(INDUSTRY_CATEGORIES[0]);
    await act(async () => finish());
    expect(screen.getByRole("status").textContent).toContain("企業を登録しました");
    expect((screen.getByLabelText(/企業名/) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(/業界カテゴリ/) as HTMLSelectElement).value).toBe("");
    expect(screen.getByRole("button", { name: "企業を登録" }).closest("fieldset")?.disabled).toBe(false);
  });

  it("登録失敗時は入力内容を保持し、内部エラーを表示せず再試行できる", async () => {
    createCompany.mockRejectedValueOnce(new Error("private database detail"));
    render(<CompanyCreateForm />);
    const form = fillForm();
    fireEvent.submit(form);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("企業を登録できませんでした"));
    expect(screen.getByRole("alert").textContent).not.toContain("private database detail");
    expect((screen.getByLabelText(/企業名/) as HTMLInputElement).value).toBe("テスト企業");
    expect((screen.getByLabelText("メモ") as HTMLTextAreaElement).value).toBe("入力を保持したいメモ");
    expect((screen.getByLabelText(/業界カテゴリ/) as HTMLSelectElement).value).toBe(INDUSTRY_CATEGORIES[0]);
    createCompany.mockResolvedValueOnce(undefined);
    fireEvent.submit(form);
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("企業を登録しました"));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(createCompany).toHaveBeenCalledTimes(2);
  });
});
