"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isEsDocumentType } from "@/lib/es";
import type { EsSaveState } from "@/lib/es";
import { createClient } from "@/lib/supabase/server";

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function failedSave(previous: EsSaveState, formData: FormData, error: string): EsSaveState {
  return {
    attempt: (previous?.attempt ?? 0) + 1,
    error,
    values: {
      company_id: getText(formData, "company_id"),
      title: String(formData.get("title") ?? ""),
      doc_type: getText(formData, "doc_type"),
      content: String(formData.get("content") ?? ""),
    },
  };
}

function redirectWithError(path: string, message: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}error=${encodeURIComponent(message)}`);
}

function parseDocumentValues(formData: FormData) {
  const companyId = getText(formData, "company_id");
  const title = getText(formData, "title");
  const docType = getText(formData, "doc_type");
  const content = String(formData.get("content") ?? "").trim();

  if (!companyId) {
    throw new Error("企業を選択してください");
  }

  if (!title) {
    throw new Error("ESタイトルを入力してください");
  }

  if (title.length > 120) {
    throw new Error("ESタイトルは120文字以内で入力してください");
  }

  if (!isEsDocumentType(docType)) {
    throw new Error("文書種別を選択してください");
  }

  return {
    company_id: companyId,
    title,
    doc_type: docType,
    content,
  };
}

async function ownsCompany(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  companyId: string,
) {
  const { data } = await supabase
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("user_id", userId)
    .maybeSingle();

  return Boolean(data);
}

export async function createEsDocument(previous: EsSaveState, formData: FormData): Promise<EsSaveState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const failure = (error: string) => failedSave(previous, formData, error);
  let values: ReturnType<typeof parseDocumentValues>;

  try {
    values = parseDocumentValues(formData);
  } catch (error) {
    return failure(error instanceof Error ? error.message : "入力内容を確認してください");
  }

  if (!(await ownsCompany(supabase, user.id, values.company_id))) {
    return failure("選択した企業を確認できません");
  }

  const { data, error } = await supabase
    .from("es_documents")
    .insert({ ...values, version: 1 })
    .select("id")
    .single();

  if (error || !data) {
    return failure("ESを保存できませんでした");
  }

  revalidatePath("/es");
  revalidatePath(`/companies/${values.company_id}`);
  redirect(`/es/${data.id}?saved=created`);
}

export async function updateEsDocument(previous: EsSaveState, formData: FormData): Promise<EsSaveState> {
  const documentId = getText(formData, "document_id");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!documentId) {
    return failedSave(previous, formData, "更新するESを確認できません");
  }

  let values: ReturnType<typeof parseDocumentValues>;

  try {
    values = parseDocumentValues(formData);
  } catch (error) {
    return failedSave(
      previous, formData,
      error instanceof Error ? error.message : "入力内容を確認してください",
    );
  }

  if (!(await ownsCompany(supabase, user.id, values.company_id))) {
    return failedSave(previous, formData, "選択した企業を確認できません");
  }

  const { data, error } = await supabase
    .from("es_documents")
    .update(values)
    .eq("id", documentId)
    .select("id,version,updated_at")
    .maybeSingle();

  if (error || !data) {
    return failedSave(previous, formData, "ESを更新できませんでした");
  }

  revalidatePath("/es");
  revalidatePath(`/es/${documentId}`);
  revalidatePath(`/companies/${values.company_id}`);
  redirect(`/es/${documentId}?saved=updated`);
}

export async function deleteEsDocument(formData: FormData) {
  const documentId = getText(formData, "document_id");
  const detailPath = documentId ? `/es/${documentId}` : "/es";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!documentId) {
    redirectWithError(detailPath, "削除するESを確認できません");
  }

  const { data, error } = await supabase
    .from("es_documents")
    .delete()
    .eq("id", documentId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    redirectWithError(detailPath, "ESを削除できませんでした");
  }

  revalidatePath("/es");
  revalidatePath(`/es/${documentId}`);
  revalidatePath(`/es/${documentId}/edit`);
  redirect("/es?deleted=1");
}
