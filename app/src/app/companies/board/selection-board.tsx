"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  canAdvanceSelectionStatus,
  isSelectionStatus,
  normalizeSelectionStatus,
  SELECTION_STATUS_OPTIONS,
  type SelectionCompany,
  type SelectionStatus,
} from "../../../lib/selection-status";
import { updateSelectionStatus } from "./actions";

export function SelectionBoard({ companies, selectedStatus = "" }: {
  companies: SelectionCompany[];
  selectedStatus?: SelectionStatus | "";
}) {
  const router = useRouter();
  const [optimisticCompanies, moveCompany] = useOptimistic(
    companies,
    (current, change: { id: string; status: SelectionStatus }) =>
      current.map((company) => company.id === change.id
        ? { ...company, selection_status: change.status }
        : company),
  );
  const [isPending, startTransition] = useTransition();
  const saving = useRef(false);
  const focusAfterMove = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<SelectionStatus | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [needsReload, setNeedsReload] = useState(false);
  const isBusy = isPending || needsReload;
  const columns = selectedStatus ? [selectedStatus] : SELECTION_STATUS_OPTIONS;

  useEffect(() => {
    if (!isPending && focusAfterMove.current) {
      (document.getElementById(`move-${focusAfterMove.current}`) ?? document.getElementById("board-status"))?.focus();
      focusAfterMove.current = null;
    }
  }, [isPending]);

  function resetDrag() {
    setDraggingId(null);
    setOverStatus(null);
  }

  function move(id: string, status: SelectionStatus) {
    const company = optimisticCompanies.find((item) => item.id === id);
    if (!company || normalizeSelectionStatus(company.selection_status ?? "") === status || saving.current || isBusy) return;
    if (!canAdvanceSelectionStatus(company.selection_status ?? "", status)) return;

    saving.current = true;
    setError("");
    setMessage(`${company.company_name}を${status}へ保存中…`);
    startTransition(async () => {
      moveCompany({ id, status });
      try {
        const result = await updateSelectionStatus(id, status, company.selection_status, company.updated_at);
        if (!result.ok) {
          setError(result.error);
          setMessage("");
          startTransition(() => router.refresh());
        } else {
          setMessage(`${company.company_name}を${status}へ移動しました。`);
        }
      } catch {
        setError("通信が切断され、選考ステータスの保存結果を確認できませんでした。再読み込みして最新の状態を確認してください。");
        setMessage("");
        setNeedsReload(true);
      } finally {
        saving.current = false;
      }
    });
  }

  return (
    <div className="min-w-0 space-y-3">
      <p role="status" className="min-h-6 text-sm text-slate-600">{message}</p>
      {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700">{error}</p>}
      {needsReload && (
        <button type="button" onClick={() => window.location.reload()} className="min-h-11 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-blue-600">
          ボードを再読み込み
        </button>
      )}
      {companies.length === 0 && (
        <p className="text-slate-600">まだ企業が登録されていません。「企業一覧・登録」から追加してください。</p>
      )}
      <div
        role="region"
        aria-label="選考ステータス別の企業"
        aria-describedby="board-instructions"
        tabIndex={0}
        className="grid grid-cols-1 gap-4 rounded-lg pb-4 focus-visible:outline-2 focus-visible:outline-blue-600 md:flex md:overflow-x-auto"
      >
        {columns.map((status) => {
          const items = optimisticCompanies.filter((company) => normalizeSelectionStatus(company.selection_status ?? "") === status);
          const isOver = overStatus === status;

          return (
            <section
              key={status}
              aria-label={status}
              onDragOver={(event) => {
                const dragging = optimisticCompanies.find((company) => company.id === draggingId);
                if (!dragging || saving.current || isBusy || !isSelectionStatus(status) || !canAdvanceSelectionStatus(dragging.selection_status ?? "", status)) {
                  setOverStatus(null);
                  return;
                }
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setOverStatus(status);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setOverStatus(null);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                const id = draggingId;
                resetDrag();
                if (id && isSelectionStatus(status)) move(id, status);
              }}
              className={`min-w-0 rounded-lg border-2 p-3 transition-colors md:min-h-[500px] md:w-80 md:shrink-0 ${isOver ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-slate-50"}`}
            >
              <h2 className="mb-3 flex items-center justify-between gap-2 font-semibold">
                {status}<span className="rounded-full bg-white px-2 py-1 text-sm text-slate-600">{items.length}件</span>
              </h2>
              <div className="space-y-3">
                {items.map((company) => (
                  <article
                    key={company.id}
                    aria-label={company.company_name}
                    draggable={!isBusy}
                    onDragStart={(event) => {
                      if (saving.current || (event.target as HTMLElement).closest("select")) {
                        event.preventDefault();
                        return;
                      }
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", company.id);
                      setDraggingId(company.id);
                      setError("");
                    }}
                    onDragEnd={resetDrag}
                    className={`min-w-0 space-y-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm [overflow-wrap:anywhere] ${isBusy ? "cursor-default" : "cursor-grab active:cursor-grabbing"} ${draggingId === company.id ? "opacity-50" : ""}`}
                  >
                    <h3 className="font-semibold">
                      <Link href={`/companies/${company.id}`} draggable={false} className="rounded-sm hover:text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600">{company.company_name}</Link>
                    </h3>
                    <p className="text-sm text-slate-600">業界: {company.industry || "未設定"}</p>
                    <p className="text-sm text-slate-600">志望度: {company.motivation_level}</p>
                    <p className="line-clamp-3 whitespace-pre-wrap text-sm text-slate-600">メモ: {company.memo || "なし"}</p>
                    <Link href={`/companies/${company.id}#company-update`} className="inline-flex min-h-11 items-center text-sm font-medium text-blue-600 hover:underline" draggable={false}>ステータスを変更</Link>
                    <label htmlFor={`move-${company.id}`} className="block text-sm text-slate-600">移動先</label>
                    <select
                      id={`move-${company.id}`}
                      value={normalizeSelectionStatus(company.selection_status ?? "")}
                      disabled={isBusy}
                      onChange={(event) => {
                        if (isSelectionStatus(event.target.value)) {
                          focusAfterMove.current = company.id;
                          move(company.id, event.target.value);
                        }
                      }}
                      className="min-h-11 w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 py-2 text-base focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-60"
                    >
                      {SELECTION_STATUS_OPTIONS.map((option) => <option key={option} value={option} disabled={!canAdvanceSelectionStatus(company.selection_status ?? "", option)}>{option}</option>)}
                    </select>
                  </article>
                ))}
                {items.length === 0 && <p className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">{isOver ? "ここにドロップして移動" : "企業はありません"}</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
