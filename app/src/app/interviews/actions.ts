"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { isUuid, validateInterview, interviewToStorage, type InterviewFormState, type InterviewValues } from "../../lib/interview-log";

export async function saveInterview(
  logId: string | null,
  _previousState: InterviewFormState,
  formData: FormData,
): Promise<InterviewFormState> {
  const validated = validateInterview(formData);
  if (validated.error) return validated;
  const { values } = validated;
  if (logId !== null && !isUuid(logId)) return { error: "面接ログが見つかりません。", values };

  let result: Awaited<ReturnType<typeof persistInterview>>;
  try {
    result = await persistInterview(logId, values);
  } catch {
    return { error: "通信に失敗しました。入力内容は保持されています。もう一度保存してください。", values };
  }
  if ("error" in result) return { ...result, values };

  revalidatePath("/interviews");
  revalidatePath(`/interviews/${result.id}`);
  revalidatePath(`/interviews/${result.id}/edit`);
  revalidatePath(`/companies/${values.company_id}`);
  if (result.originalCompanyId && result.originalCompanyId !== values.company_id) revalidatePath(`/companies/${result.originalCompanyId}`);
  redirect(`/interviews/${result.id}`);
}

async function persistInterview(logId: string | null, values: InterviewValues): Promise<{ error: string } | { id: string; originalCompanyId?: string }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "ログインし直してから保存してください。" };

  // 入力された企業IDを信用せず、保存のたびに所有者を検証する。
  const { data: company, error: companyError } = await supabase.from("companies")
    .select("id").eq("id", values.company_id).eq("user_id", user.id).maybeSingle();
  if (companyError) return { error: "企業情報を確認できませんでした。もう一度保存してください。" };
  if (!company) return { error: "選択した企業が見つかりません。企業を選び直してください。" };

  let originalCompanyId: string | undefined;
  if (logId !== null) {
    const { data: original, error } = await supabase.from("interview_logs")
      .select("id, company_id, companies!inner(id)")
      .eq("id", logId).eq("companies.user_id", user.id).maybeSingle();
    if (error) return { error: "面接ログを確認できませんでした。もう一度保存してください。" };
    if (!original) return { error: "編集できる面接ログが見つかりません。" };
    originalCompanyId = original.company_id;
  }

  // 更新時もRLSで既存ログと変更後の企業の両方の所有者を制限する。
  const payload = interviewToStorage(values);
  const mutation = logId === null
    ? supabase.from("interview_logs").insert(payload)
    : supabase.from("interview_logs").update(payload).eq("id", logId).eq("company_id", originalCompanyId!);
  const { data: saved, error } = await mutation.select("id").maybeSingle();
  if (error || !saved) return { error: "保存できませんでした。入力内容は保持されています。もう一度保存してください。" };

  return { id: saved.id, originalCompanyId };
}
