import {
  dateKeyToStartIso,
  eventDateKey,
  normalizeDateKey,
  shiftDateKey,
} from "./calendar";

export const TASK_PRIORITY_OPTIONS = ["low", "medium", "high"] as const;

export type TaskPriority = (typeof TASK_PRIORITY_OPTIONS)[number];

const LEGACY_PRIORITY_MAP: Record<string, TaskPriority> = {
  "1": "low",
  "3": "medium",
  "5": "high",
};

export function normalizeTaskPriority(value: string): TaskPriority {
  if (TASK_PRIORITY_OPTIONS.includes(value as TaskPriority)) {
    return value as TaskPriority;
  }

  return LEGACY_PRIORITY_MAP[value] ?? "medium";
}

export function deadlineDateKeyToIso(value: string) {
  const dateKey = normalizeDateKey(value);

  if (!dateKey) {
    return null;
  }

  const nextDayStart = Date.parse(dateKeyToStartIso(shiftDateKey(dateKey, 1)));
  return new Date(nextDayStart - 1_000).toISOString();
}

export function deadlineDateInputValue(value: string | null | undefined) {
  return value ? eventDateKey(value) : "";
}
