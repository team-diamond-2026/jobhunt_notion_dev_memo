"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";

const REMINDER_TIMINGS = ["none", "morning", "previous_day", "three_days"] as const;
const THEMES = ["system", "light", "dark"] as const;
const DENSITIES = ["comfortable", "compact"] as const;
const DEFAULT_VIEWS = ["dashboard", "companies", "board"] as const;

function isAllowed<T extends readonly string[]>(value: string, allowed: T): value is T[number] {
  return allowed.includes(value);
}

function getBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function isSchemaMismatch(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "22P02" ||
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    error?.message?.includes("invalid input syntax for type bigint") ||
    error?.message?.includes("Could not find the table 'public.user_settings'")
  );
}

export async function saveSettings(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const name = String(formData.get("name") || "").trim();
  const reminderTiming = String(formData.get("reminder_timing") || "morning");
  const theme = String(formData.get("theme") || "system");
  const density = String(formData.get("density") || "comfortable");
  const defaultView = String(formData.get("default_view") || "dashboard");

  if (!name) {
    redirect("/settings?error=profile");
  }

  const settings = {
    email_notifications: getBoolean(formData, "email_notifications"),
    deadline_reminders: getBoolean(formData, "deadline_reminders"),
    weekly_digest: getBoolean(formData, "weekly_digest"),
    reminder_timing: isAllowed(reminderTiming, REMINDER_TIMINGS)
      ? reminderTiming
      : "morning",
    theme: isAllowed(theme, THEMES) ? theme : "system",
    density: isAllowed(density, DENSITIES) ? density : "comfortable",
    default_view: isAllowed(defaultView, DEFAULT_VIEWS) ? defaultView : "dashboard",
  };

  const { error: authError } = await supabase.auth.updateUser({
    data: {
      display_name: name,
      settings,
    },
  });

  if (authError) {
    throw new Error(`認証プロフィールの保存に失敗しました: ${authError.message}`);
  }

  const { error: settingsError } = await supabase.from("user_settings").upsert({
    user_id: user.id,
    ...settings,
    updated_at: new Date().toISOString(),
  });

  if (settingsError && !isSchemaMismatch(settingsError)) {
    throw new Error(`設定の保存に失敗しました: ${settingsError.message}`);
  }

  revalidatePath("/settings");
  revalidatePath("/");
  redirect("/settings?saved=1");
}
