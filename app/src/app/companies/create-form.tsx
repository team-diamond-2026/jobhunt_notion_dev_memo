"use client";

import { useState, type FormEvent } from "react";
import { SELECTION_STATUS_OPTIONS } from "@/lib/selection-status";
import { createCompany } from "./actions";
import { IndustryFields } from "./industry-fields";

export function CompanyCreateForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [formVersion, setFormVersion] = useState(0);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const formData = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    setSaved(false);

    try {
      await createCompany(formData);
      setFormVersion((version) => version + 1);
      setSaved(true);
    } catch {
      setError("企業を登録できませんでした。入力内容はそのままです。通信状況と入力内容を確認して、もう一度お試しください。");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-5 border-t border-slate-200 pt-5">
      <p className="mb-5 text-sm text-slate-600">企業名と業界カテゴリは必須です。メモは後から編集できます。</p>
      {error && <p className="ui-feedback ui-feedback-error mb-4" role="alert">{error}</p>}
      {saved && <p className="ui-feedback ui-feedback-success mb-4" role="status">企業を登録しました。一覧から企業情報を確認できます。</p>}
      <form key={formVersion} action={createCompany} onSubmit={handleSubmit} aria-busy={pending}>
        <fieldset disabled={pending} className="grid min-w-0 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="company_name" className="ui-label">企業名 <span aria-hidden="true">*</span></label>
            <input id="company_name" name="company_name" required placeholder="例: 株式会社サンプル" className="ui-field" />
          </div>
          <IndustryFields />
          <div>
            <label htmlFor="motivation_level" className="ui-label">志望度</label>
            <select id="motivation_level" name="motivation_level" defaultValue="3" className="ui-field">
              {[0, 1, 2, 3, 4, 5].map((level) => <option key={level} value={level}>{level} / 5</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="selection_status" className="ui-label">選考状況</label>
            <select id="selection_status" name="selection_status" defaultValue={SELECTION_STATUS_OPTIONS[0]} className="ui-field">
              {SELECTION_STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="memo" className="ui-label">メモ</label>
            <textarea id="memo" name="memo" rows={3} placeholder="企業研究メモ、気になる点、次に確認すること" className="ui-field" />
          </div>
          <div className="sm:col-span-2 sm:flex sm:justify-end">
            <button type="submit" className="ui-button ui-primary w-full sm:w-auto">{pending ? "登録中..." : "企業を登録"}</button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
