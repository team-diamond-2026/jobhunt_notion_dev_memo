"use server";

import { revalidatePath } from "next/cache";
import { canAdvanceSelectionStatus, isSelectionStatus } from "../../../lib/selection-status";
import { createClient } from "../../../lib/supabase/server";

type UpdateSelectionResult = { ok: true } | { ok: false; error: string };

export async function updateSelectionStatus(companyId: string, status: string): Promise<UpdateSelectionResult> {
  if (
    typeof companyId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(companyId) ||
    !isSelectionStatus(status)
  ) {
    return { ok: false, error: "企業または選考ステータスが不正です。" } as const;
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "ログインし直してから、もう一度お試しください。" } as const;
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("selection_status")
    .eq("id", companyId)
    .eq("user_id", user.id)
    .single();

  if (companyError || !company) {
    return { ok: false, error: "更新対象の企業が見つかりません。" };
  }

  if (!canAdvanceSelectionStatus(company.selection_status ?? "", status)) {
    return { ok: false, error: "選考状況を前の段階へ戻すことはできません。" };
  }

  if (company.selection_status === status) return { ok: true };

  const { data, error } = await supabase
    .from("companies")
    .update({ selection_status: status, updated_at: new Date().toISOString() })
    .eq("id", companyId)
    .eq("user_id", user.id)
    .eq("selection_status", company.selection_status)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: "選考ステータスを保存できませんでした。もう一度お試しください。" } as const;
  }

  revalidatePath("/companies/board");
  revalidatePath("/companies");
  revalidatePath(`/companies/${companyId}`);
  revalidatePath("/");
  return { ok: true } as const;
}
