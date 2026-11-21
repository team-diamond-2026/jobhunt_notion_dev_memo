"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { interviewFormats, interviewTextLimit, type InterviewFormState, type InterviewValues } from "../../lib/interview-log";
import type { InterviewCompany } from "./data";
import { saveInterview } from "./actions";
import { interviewButton, interviewInput, interviewLink } from "./styles";

type Props = {
  companies: InterviewCompany[];
  logId?: string;
  initialValues?: Partial<InterviewValues>;
};

const textFields = [
  { name: "questions", label: "質問内容", hint: "聞かれた質問を、1つずつ改行して残しましょう。", placeholder: "例：学生時代に力を入れたことは？" },
  { name: "answers", label: "回答内容", hint: "質問と同じ順番で、実際に伝えた内容を記録しましょう。", placeholder: "例：チームで取り組んだこと、担当した役割、結果" },
  { name: "reflection", label: "振り返り・改善点", hint: "うまく話せたことと、次に改善したいことを整理しましょう。", placeholder: "例：結論から話せた。成果を数字で説明できなかった。" },
  { name: "next_action", label: "次回までにやること", hint: "次の面接までに実行することを具体的に書きましょう。", placeholder: "例：成果の数字を整理し、1分で伝える練習を3回する。" },
] as const;

export function InterviewForm({ companies, logId, initialValues = {} }: Props) {
  const [state, action, pending] = useActionState<InterviewFormState, FormData>(
    saveInterview.bind(null, logId ?? null), {},
  );
  // Reactのフォーム自動リセットでselectを含む入力値が失われないよう保持する。
  const [values, setValues] = useState<Partial<InterviewValues>>(state.values ?? initialValues);
  const setField = (name: keyof InterviewValues, value: string) => setValues((current) => ({ ...current, [name]: value }));
  const cancelHref = logId ? `/interviews/${logId}` : initialValues.company_id ? `/interviews?company_id=${initialValues.company_id}` : "/interviews";
  const errorProps = (name: keyof InterviewValues) => ({
    "aria-invalid": state.fieldErrors?.[name] ? true : undefined,
    "aria-describedby": state.fieldErrors?.[name] ? `${name}-error` : undefined,
  });
  const fieldError = (name: keyof InterviewValues) => state.fieldErrors?.[name] && (
    <p id={`${name}-error`} className="mt-1 text-sm text-red-700">{state.fieldErrors[name]}</p>
  );

  return (
    <form action={action} onReset={(event) => event.preventDefault()} className="space-y-6 rounded-xl bg-white p-4 shadow sm:p-6" aria-busy={pending}>
      <p className="text-slate-600">企業・面接日・形式は必須です。振り返りは後から追記できます。</p>
      {state.error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-red-800">{state.error}</p>}
      <fieldset disabled={pending} className="min-w-0 space-y-6">
        <legend className="sr-only">面接記録の入力</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0 sm:col-span-2">
            <label htmlFor="company_id" className="mb-1 block font-medium">企業（必須）</label>
            <select id="company_id" name="company_id" required value={values.company_id ?? ""} onChange={(event) => setField("company_id", event.target.value)} className={interviewInput} {...errorProps("company_id")}>
              <option value="" disabled>企業を選択してください</option>
              {companies.map((company) => <option key={company.id} value={company.id}>{company.company_name}</option>)}
            </select>
            {fieldError("company_id")}
          </div>
          <div className="min-w-0">
            <label htmlFor="interview_date" className="mb-1 block font-medium">面接日（必須）</label>
            <input id="interview_date" name="interview_date" type="date" required min="0001-01-01" max="9999-12-31" value={values.interview_date ?? ""} onChange={(event) => setField("interview_date", event.target.value)} className={interviewInput} {...errorProps("interview_date")} />
            {fieldError("interview_date")}
          </div>
          <div className="min-w-0">
            <label htmlFor="format" className="mb-1 block font-medium">面接形式（必須）</label>
            <select id="format" name="format" required value={values.format ?? ""} onChange={(event) => setField("format", event.target.value)} className={interviewInput} {...errorProps("format")}>
              <option value="" disabled>形式を選択してください</option>
              {interviewFormats.map((format) => <option key={format} value={format}>{format}</option>)}
            </select>
            {fieldError("format")}
          </div>
        </div>
        {textFields.map(({ name, label, hint, placeholder }) => (
          <div key={name} className="min-w-0">
            <label htmlFor={name} className="mb-1 block font-medium">{label}</label>
            <p id={`${name}-hint`} className="mb-2 text-sm text-slate-600">{hint}（10,000文字まで）</p>
            <textarea id={name} name={name} rows={5} maxLength={interviewTextLimit} value={values[name] ?? ""} onChange={(event) => setField(name, event.target.value)} placeholder={placeholder}
              className={interviewInput} {...errorProps(name)} aria-describedby={`${name}-hint${state.fieldErrors?.[name] ? ` ${name}-error` : ""}`} />
            {fieldError(name)}
          </div>
        ))}
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="submit" className={interviewButton}>{pending ? "保存中…" : logId ? "変更を保存" : "面接ログを保存"}</button>
          <Link href={cancelHref} className={interviewLink}>キャンセル</Link>
        </div>
      </fieldset>
      <p role="status" className="sr-only">{pending ? "面接ログを保存しています。" : ""}</p>
    </form>
  );
}
