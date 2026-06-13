"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";

/**
 * 企業登録
 */
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

  const safeMotivationLevel = Math.min(Math.max(motivation_level, 0), 5);

  const { error } = await supabase.from("companies").insert({
    user_id: user.id,
    company_name,
    industry: industry || null,
    motivation_level: safeMotivationLevel,
    selection_status,
    memo: memo || null,
  });

  if (error) {
    throw new Error(`企業登録に失敗しました: ${error.message}`);
  }

  revalidatePath("/companies");
}

/**
 * 企業削除
 */
export async function deleteCompany(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("ログインが必要です");
  }

  const companyId = String(formData.get("company_id") || "").trim();

  if (!companyId) {
    throw new Error("削除対象の企業IDがありません");
  }

  const { error } = await supabase
    .from("companies")
    .delete()
    .eq("id", companyId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(`企業削除に失敗しました: ${error.message}`);
  }

  revalidatePath("/companies");
}

/**
 * 企業更新
 */
export async function updateCompany(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("ログインが必要です");
  }

  const companyId = String(formData.get("company_id") || "").trim();
  const company_name = String(formData.get("company_name") || "").trim();
  const industry = String(formData.get("industry") || "").trim();
  const motivation_level = Number(formData.get("motivation_level") || 0);
  const selection_status = String(
    formData.get("selection_status") || "未エントリー",
  ).trim();
  const memo = String(formData.get("memo") || "").trim();

  if (!companyId) {
    throw new Error("更新対象の企業IDがありません");
  }

  if (!company_name) {
    throw new Error("企業名は必須です");
  }

  const safeMotivationLevel = Math.min(Math.max(motivation_level, 0), 5);

  const { error } = await supabase
    .from("companies")
    .update({
      company_name,
      industry: industry || null,
      motivation_level: safeMotivationLevel,
      selection_status,
      memo: memo || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", companyId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(`企業更新に失敗しました: ${error.message}`);
  }

  revalidatePath("/companies");
  revalidatePath(`/companies/${companyId}`);
  redirect(`/companies/${companyId}`);
}