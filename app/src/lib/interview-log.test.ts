import { describe, expect, it } from "vitest";
import { formatInterviewDate, validateInterview, normalizeInterviewLog, interviewToStorage } from "./interview-log";
import { interview, interviewFormData } from "../test/interview-fixtures";

describe("面接ログの入力検証", () => {
  it("振り返りが未記入でも面接の基本情報を保存できる", () => {
    const result = validateInterview(interviewFormData({ questions: "", answers: "", reflection: "", next_action: "" }));
    expect(result.error).toBeUndefined();
  });

  it.each(["2026-02-29", "2026-02-30", "2026-13-01", "0000-01-01", "", "invalid", "2026-1-1"])("不正な日付を拒否する: %s", (date) => {
    expect(validateInterview(interviewFormData({ interview_date: date })).fieldErrors?.interview_date).toBeTruthy();
  });

  it("うるう日と日付範囲の境界を受け入れる", () => {
    for (const interview_date of ["2024-02-29", "0001-01-01", "9999-12-31"]) {
      expect(validateInterview(interviewFormData({ interview_date })).error).toBeUndefined();
    }
  });

  it("不正な企業・形式・長すぎる本文をフィールドごとに拒否し、入力値を返す", () => {
    const result = validateInterview(interviewFormData({ company_id: "other", format: "invalid", reflection: "a".repeat(10001) }));
    expect(Object.keys(result.fieldErrors!)).toEqual(["company_id", "format", "reflection"]);
    expect(result.values.questions).toBe("自己紹介をしてください。");
  });

  it("改行を保持し、日付をタイムゾーンに依存せず表示する", () => {
    const result = validateInterview(interviewFormData({ reflection: "  改善点\n次の行  " }));
    expect(result.values.reflection).toBe("改善点\n次の行");
    expect(formatInterviewDate("2026-11-14")).toBe("2026年11月14日");
  });

  it("既存スキーマのJSON配列とUTCの日時を、日本時間の面接日と改行テキストに変換する", () => {
    const log = normalizeInterviewLog({ ...interview, interview_date: "2026-11-13T15:00:00Z", questions: ["自己紹介", "志望理由"], answers: ["開発経験", "事業への関心"] });
    expect(log.interview_date).toBe("2026-11-14");
    expect(log.questions).toBe("自己紹介\n志望理由");
    expect(log.answers).toBe("開発経験\n事業への関心");
  });

  it("NULLを含む既存記録も表示できる", () => {
    const log = normalizeInterviewLog({ ...interview, interview_date: null, format: null, questions: [], answers: [], reflection: null, next_action: null });
    expect(formatInterviewDate(log.interview_date)).toBe("面接日未設定");
    expect(log.format).toBe("");
    expect(log.reflection).toBe("");
    expect(log.next_action).toBe("");
  });

  it("改行をJSON配列へ戻し、面接日を日本時間の午前0時として保存する", () => {
    const values = validateInterview(interviewFormData({ questions: "自己紹介\n志望理由", answers: "" })).values;
    const stored = interviewToStorage(values);
    expect(stored.questions).toEqual(["自己紹介", "志望理由"]);
    expect(stored.answers).toEqual([]);
    expect(stored.interview_date).toBe("2026-11-14T00:00:00+09:00");
    expect(normalizeInterviewLog({ ...interview, ...stored }).interview_date).toBe(values.interview_date);
  });
});
