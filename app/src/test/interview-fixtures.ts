import type { InterviewLog } from "../lib/interview-log";

export const userId = "00000000-0000-0000-0000-000000000001";
export const companyId = "00000000-0000-0000-0000-000000000008";
export const otherCompanyId = "00000000-0000-0000-0000-000000000009";
export const logId = "00000000-0000-0000-0000-000000000080";

export const interview: InterviewLog = {
  id: logId, company_id: companyId, interview_date: "2026-11-14", format: "オンライン",
  questions: "自己紹介をしてください。", answers: "開発経験を伝えた。", reflection: "結論から話す。", next_action: "1分で話す練習をする。",
  created_at: "2026-11-14T00:00:00Z", updated_at: "2026-11-14T00:00:00Z",
  companies: { id: companyId, company_name: "サンプル企業" },
};

export function interviewFormData(overrides: Record<string, string> = {}) {
  const data = new FormData();
  const { company_id, interview_date, format, questions, answers, reflection, next_action } = interview;
  for (const [key, value] of Object.entries({ company_id, interview_date, format, questions, answers, reflection, next_action, ...overrides })) data.set(key, value);
  return data;
}
