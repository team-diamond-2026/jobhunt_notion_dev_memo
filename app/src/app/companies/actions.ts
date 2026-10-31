"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import {
  INDUSTRY_CATEGORY_OTHER,
  isIndustryCategory,
} from "./industry";
import {
  canAdvanceSelectionStatus,
  isSelectionStatus,
  SELECTION_STATUS_OPTIONS,
} from "../../lib/selection-status";

function getIndustryValues(formData: FormData) {
  const category = String(formData.get("industry_category") || "").trim();
  const other = String(formData.get("industry_other") || "").trim();
  const legacyIndustry = String(formData.get("industry") || "").trim();
  const categoryRequired = formData.has("industry_category_required");

  if (!category) {
    if (legacyIndustry) {
      return { category: null, industry: legacyIndustry };
    }

    if (!categoryRequired) {
      return { category: null, industry: null };
    }

    throw new Error("業界カテゴリを選択してください。もう一度入力してください。");
  }

  if (!isIndustryCategory(category)) {
    throw new Error("業界カテゴリの選択が正しくありません");
  }

  if (category === INDUSTRY_CATEGORY_OTHER) {
    const customIndustry = other || legacyIndustry;

    if (!customIndustry) {
      throw new Error("その他の業界名を入力してください");
    }

    return { category, industry: customIndustry };
  }

  return { category, industry: category };
}

function getDeadlineValues(formData: FormData) {
  const title = String(formData.get("deadline_title") || "").trim();
  const date = String(formData.get("deadline_date") || "").trim();
  const priority = Number(formData.get("deadline_priority") || 0);

  if (!title && !date) {
    return null;
  }

  if (!title || !date) {
    throw new Error("締切タスク名と締切日はセットで入力してください");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("締切日の形式が正しくありません");
  }

  return {
    title,
    due_date: `${date}T23:59:59+09:00`,
    priority: Math.min(Math.max(priority, 0), 5),
  };
}

export async function createCompany(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("ログインが必要です");
  }

  const company_name = String(formData.get("company_name") || "").trim();
  const { category: industry_category, industry } = getIndustryValues(formData);
  const motivation_level = Number(formData.get("motivation_level") || 0);
  const selection_status = String(
    formData.get("selection_status") || SELECTION_STATUS_OPTIONS[0],
  ).trim();
  const memo = String(formData.get("memo") || "").trim();
  const deadline = getDeadlineValues(formData);

  if (!company_name) {
    throw new Error("企業名は必須です");
  }

  if (!isSelectionStatus(selection_status)) {
    throw new Error("選考状況の選択が正しくありません");
  }

  const safeMotivationLevel = Math.min(Math.max(motivation_level, 0), 5);

  const { data: workspaceCompany, error: workspaceLookupError } = await supabase
    .from("companies")
    .select("workspace_id")
    .eq("user_id", user.id)
    .not("workspace_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (workspaceLookupError) {
    throw new Error(`Workspaceの取得に失敗しました: ${workspaceLookupError.message}`);
  }

  const { data: createdCompany, error } = await supabase
    .from("companies")
    .insert({
    user_id: user.id,
    workspace_id: workspaceCompany?.workspace_id ?? null,
    company_name,
    industry_category,
    industry: industry || null,
    motivation_level: safeMotivationLevel,
    selection_status,
    memo: memo || null,
    })
    .select("id, workspace_id")
    .single();

  if (error) {
    throw new Error(`企業登録に失敗しました: ${error.message}`);
  }

  if (deadline) {
    if (!createdCompany?.workspace_id) {
      throw new Error("Workspaceが設定されていないため、締切を登録できません");
    }

    const { error: taskError } = await supabase.from("tasks").insert({
      workspace_id: createdCompany.workspace_id,
      title: deadline.title,
      due_date: deadline.due_date,
      priority: deadline.priority,
      status: "pending",
      related_company_id: createdCompany.id,
    });

    if (taskError) {
      throw new Error(`締切タスクの登録に失敗しました: ${taskError.message}`);
    }
  }

  revalidatePath("/companies");
}

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
  const { category: industry_category, industry } = getIndustryValues(formData);
  const motivation_level = Number(formData.get("motivation_level") || 0);
  const selection_status = String(
    formData.get("selection_status") || SELECTION_STATUS_OPTIONS[0],
  ).trim();
  const memo = String(formData.get("memo") || "").trim();
  const deadline = getDeadlineValues(formData);

  if (!companyId) {
    throw new Error("更新対象の企業IDがありません");
  }

  if (!company_name) {
    throw new Error("企業名は必須です");
  }

  if (!isSelectionStatus(selection_status)) {
    throw new Error("選考状況の選択が正しくありません");
  }

  const { data: currentCompany, error: currentCompanyError } = await supabase
    .from("companies")
    .select("selection_status, workspace_id")
    .eq("id", companyId)
    .eq("user_id", user.id)
    .single();

  if (currentCompanyError || !currentCompany) {
    throw new Error("更新対象の企業が見つかりません");
  }

  if (!canAdvanceSelectionStatus(currentCompany.selection_status, selection_status)) {
    throw new Error("選考状況を前の段階へ戻すことはできません");
  }

  const safeMotivationLevel = Math.min(Math.max(motivation_level, 0), 5);

  const { error } = await supabase
    .from("companies")
    .update({
      company_name,
      industry_category,
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

  if (deadline) {
    const { data: existingTask, error: taskLookupError } = await supabase
      .from("tasks")
      .select("id")
      .eq("related_company_id", companyId)
      .order("due_date", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (taskLookupError) {
      throw new Error(`既存の締切タスク取得に失敗しました: ${taskLookupError.message}`);
    }

    const taskData = {
      title: deadline.title,
      due_date: deadline.due_date,
      priority: deadline.priority,
      status: "pending",
      related_company_id: companyId,
    };

    const taskResult = existingTask
      ? await supabase.from("tasks").update(taskData).eq("id", existingTask.id)
      : await supabase.from("tasks").insert({
          ...taskData,
          workspace_id: currentCompany.workspace_id,
        });

    if (taskResult.error) {
      throw new Error(`締切タスクの保存に失敗しました: ${taskResult.error.message}`);
    }
  }

  revalidatePath("/companies");
  revalidatePath(`/companies/${companyId}`);
  redirect(`/companies/${companyId}`);
}
