export const interviewFormats = ["対面", "オンライン", "電話", "その他"] as const;
export const interviewTextLimit = 10_000;

export type InterviewValues = {
  company_id: string;
  interview_date: string;
  format: string;
  questions: string;
  answers: string;
  reflection: string;
  next_action: string;
};

export type InterviewLog = InterviewValues & {
  id: string;
  created_at: string;
  updated_at: string;
  companies: { id: string; company_name: string };
};

// 既存MVPスキーマのtimestamptz / jsonb / nullable列をそのまま使用する。
export type StoredInterviewLog = Omit<InterviewLog, "interview_date" | "format" | "questions" | "answers" | "reflection" | "next_action"> & {
  interview_date: string | null;
  format: string | null;
  questions: unknown;
  answers: unknown;
  reflection: string | null;
  next_action: string | null;
};

function interviewText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(interviewText).join("\n");
  return JSON.stringify(value);
}

export function normalizeInterviewLog(log: StoredInterviewLog): InterviewLog {
  const timestamp = log.interview_date ? Date.parse(log.interview_date) : NaN;
  const date = !Number.isFinite(timestamp) ? "" : new Date(timestamp + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return {
    ...log, interview_date: date, format: log.format ?? "",
    questions: interviewText(log.questions), answers: interviewText(log.answers),
    reflection: log.reflection ?? "", next_action: log.next_action ?? "",
  };
}

export function interviewToStorage(values: InterviewValues) {
  return {
    ...values,
    interview_date: `${values.interview_date}T00:00:00+09:00`,
    questions: values.questions ? values.questions.split("\n") : [],
    answers: values.answers ? values.answers.split("\n") : [],
  };
}

export type InterviewFormState = {
  error?: string;
  fieldErrors?: Partial<Record<keyof InterviewValues, string>>;
  values?: InterviewValues;
};

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function validateInterview(formData: FormData): InterviewFormState & { values: InterviewValues } {
  const read = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value.trim() : "";
  };
  const values: InterviewValues = {
    company_id: read("company_id"),
    interview_date: read("interview_date"),
    format: read("format"),
    questions: read("questions"),
    answers: read("answers"),
    reflection: read("reflection"),
    next_action: read("next_action"),
  };
  const fieldErrors: NonNullable<InterviewFormState["fieldErrors"]> = {};
  if (!isUuid(values.company_id)) fieldErrors.company_id = "企業を選択してください。";
  const date = values.interview_date;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < "0001-01-01" || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    fieldErrors.interview_date = "有効な面接日を入力してください。";
  }
  if (!interviewFormats.some((format) => format === values.format)) {
    fieldErrors.format = "面接形式を選択してください。";
  }
  for (const key of ["questions", "answers", "reflection", "next_action"] as const) {
    if (values[key].length > interviewTextLimit) fieldErrors[key] = "10,000文字以内で入力してください。";
  }
  return Object.keys(fieldErrors).length
    ? { values, fieldErrors, error: "入力内容を確認してください。" }
    : { values };
}

export function formatInterviewDate(date: string) {
  if (!date) return "面接日未設定";
  const [year, month, day] = date.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}
