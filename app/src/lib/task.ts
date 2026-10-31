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

