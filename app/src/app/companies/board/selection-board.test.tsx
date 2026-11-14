// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SelectionCompany } from "../../../lib/selection-status";
import { updateSelectionStatus } from "./actions";
import { SelectionBoard } from "./selection-board";

vi.mock("./actions", () => ({ updateSelectionStatus: vi.fn() }));

const companies: SelectionCompany[] = [{
  id: "00000000-0000-0000-0000-000000000047",
  company_name: "サンプル企業",
  industry: "IT",
  motivation_level: 5,
  selection_status: "応募済み",
}];

function dragTo(status: string) {
  const card = screen.getByRole("article", { name: "サンプル企業" });
  const destination = screen.getByRole("region", { name: status });
  const dataTransfer = { setData: vi.fn(), effectAllowed: "", dropEffect: "" };
  fireEvent.dragStart(card, { dataTransfer });
  fireEvent.dragOver(destination, { dataTransfer });
  return { card, destination, dataTransfer };
}

describe("SelectionBoard", () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(cleanup);

  it("空の列を含めて9ステータスを表示する", () => {
    render(<SelectionBoard companies={[]} />);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(9);
    expect(screen.getByText(/まだ企業が登録されていません/)).toBeTruthy();
  });

  it("ドラッグ先を強調し、ドロップで空の列へ移動して保存する", async () => {
    let complete!: (value: { ok: true }) => void;
    vi.mocked(updateSelectionStatus).mockReturnValue(new Promise((resolve) => { complete = resolve; }));
    const { rerender } = render(<SelectionBoard companies={companies} />);
    const { destination, dataTransfer } = dragTo("一次面接");
    expect(destination.className).toContain("border-blue-500");
    fireEvent.drop(destination, { dataTransfer });

    expect(updateSelectionStatus).toHaveBeenCalledWith(companies[0].id, "一次面接");
    expect(within(destination).getByRole("article")).toBeTruthy();
    expect(screen.getByRole<HTMLSelectElement>("combobox").disabled).toBe(true);
    expect(destination.className).not.toContain("border-blue-500");

    await act(async () => {
      // Server Actionによる再検証後のpropsを再現する。
      rerender(<SelectionBoard companies={[{ ...companies[0], selection_status: "一次面接" }]} />);
      complete({ ok: true });
    });
    expect(within(destination).getByRole("article")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("移動しました");
    expect(screen.getByRole<HTMLSelectElement>("combobox").disabled).toBe(false);
  });

  it("保存失敗時に元の列へ戻し、再試行できる", async () => {
    vi.mocked(updateSelectionStatus).mockResolvedValue({ ok: false, error: "保存失敗" });
    render(<SelectionBoard companies={companies} />);
    const { destination, dataTransfer } = dragTo("内定");
    await act(async () => { fireEvent.drop(destination, { dataTransfer }); });
    expect(screen.getByRole("alert").textContent).toContain("保存失敗");
    expect(within(screen.getByRole("region", { name: "応募済み" })).getByRole("article")).toBeTruthy();
    expect(within(destination).queryByRole("article")).toBeNull();
    expect(screen.getByRole<HTMLSelectElement>("combobox").disabled).toBe(false);
  });

  it("保存中の追加操作を止めて二重更新を防ぐ", async () => {
    let complete!: (value: { ok: false; error: string }) => void;
    vi.mocked(updateSelectionStatus).mockReturnValue(new Promise((resolve) => { complete = resolve; }));
    render(<SelectionBoard companies={companies} />);
    fireEvent.change(screen.getByLabelText("移動先"), { target: { value: "一次面接" } });
    fireEvent.change(screen.getByLabelText("移動先"), { target: { value: "内定" } });
    expect(updateSelectionStatus).toHaveBeenCalledTimes(1);
    await act(async () => { complete({ ok: false, error: "保存失敗" }); });
    expect(screen.getByRole<HTMLSelectElement>("combobox").disabled).toBe(false);
    expect(document.activeElement).toBe(screen.getByLabelText("移動先"));
  });

  it("再検証で取得した企業データをボードに反映する", () => {
    const { rerender } = render(<SelectionBoard companies={companies} />);
    rerender(<SelectionBoard companies={[{ ...companies[0], selection_status: "内定" }]} />);
    expect(within(screen.getByRole("region", { name: "内定" })).getByRole("article")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "応募済み" })).queryByRole("article")).toBeNull();
  });

  it("通信例外でも元の列へ戻す", async () => {
    vi.mocked(updateSelectionStatus).mockRejectedValue(new Error("network"));
    render(<SelectionBoard companies={companies} />);
    await act(async () => { fireEvent.change(screen.getByRole("combobox"), { target: { value: "内定" } }); });
    expect(screen.getByRole("alert").textContent).toContain("通信状態");
    expect(within(screen.getByRole("region", { name: "応募済み" })).getByRole("article")).toBeTruthy();
  });

  it("移動先セレクトでも同じ保存処理を使う", async () => {
    vi.mocked(updateSelectionStatus).mockResolvedValue({ ok: false, error: "保存失敗" });
    render(<SelectionBoard companies={companies} />);
    await act(async () => { fireEvent.change(screen.getByLabelText("移動先"), { target: { value: "最終面接" } }); });
    expect(updateSelectionStatus).toHaveBeenCalledWith(companies[0].id, "最終面接");
  });

  it("同じ列へのドロップでは更新しない", () => {
    render(<SelectionBoard companies={companies} />);
    const { destination, dataTransfer } = dragTo("応募済み");
    fireEvent.drop(destination, { dataTransfer });
    expect(updateSelectionStatus).not.toHaveBeenCalled();
  });

  it("前の段階へのドロップや選択を禁止する", () => {
    render(<SelectionBoard companies={[{ ...companies[0], selection_status: "最終面接" }]} />);
    const { destination, dataTransfer } = dragTo("一次面接");
    expect(destination.className).not.toContain("border-blue-500");
    expect(screen.getByRole<HTMLOptionElement>("option", { name: "一次面接" }).disabled).toBe(true);
    fireEvent.drop(destination, { dataTransfer });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "一次面接" } });
    expect(updateSelectionStatus).not.toHaveBeenCalled();
  });

  it("ドラッグをキャンセルすると強調表示を解除し、保存しない", () => {
    render(<SelectionBoard companies={companies} />);
    const { card, destination } = dragTo("内定");
    fireEvent.dragEnd(card);
    expect(destination.className).not.toContain("border-blue-500");
    expect(updateSelectionStatus).not.toHaveBeenCalled();
  });

  it("ボード外からのドロップでは保存しない", () => {
    render(<SelectionBoard companies={companies} />);
    fireEvent.drop(screen.getByRole("region", { name: "内定" }));
    expect(updateSelectionStatus).not.toHaveBeenCalled();
  });

  it("既存の未定義ステータスも非表示にせず、標準ステータスへ変更できる", async () => {
    vi.mocked(updateSelectionStatus).mockResolvedValue({ ok: false, error: "保存失敗" });
    render(<SelectionBoard companies={[{ ...companies[0], selection_status: "書類選考" }]} />);
    expect(within(screen.getByRole("region", { name: "未設定・その他" })).getByRole("article")).toBeTruthy();
    await act(async () => { fireEvent.change(screen.getByRole("combobox"), { target: { value: "一次面接" } }); });
    expect(updateSelectionStatus).toHaveBeenCalledWith(companies[0].id, "一次面接");
  });
});
