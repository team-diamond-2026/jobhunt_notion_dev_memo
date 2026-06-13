"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "../../lib/supabase/server";

export async function createCompany(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("ログインが必要です");
  }

  const company_name = String(formData.get("company_name") || "").trim();
  const industry = String(formData.get("industry") || "").trim();
  const motivation_level = Number(formData.get("motivation_level") || 0);
  const selection_status = String(
    formData.get("selection_status") || "未エントリー",
  ).trim();
  const memo = String(formData.get("memo") || "").trim();

  if (!company_name) {
    throw new Error("企業名は必須です");
  }

  const { error } = await supabase.from("companies").insert({
    user_id: user.id,
    company_name,
    industry: industry || null,
    motivation_level,
    selection_status,
    memo: memo || null,
  });

  if (error) {
    throw new Error(`企業登録に失敗しました: ${error.message}`);
  }

  revalidatePath("/companies");
}