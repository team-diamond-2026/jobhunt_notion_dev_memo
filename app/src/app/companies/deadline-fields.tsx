import { deadlineDateInputValue, normalizeTaskPriority } from "../../lib/task";

export type DeadlineTask = {
  id: string;
  title: string;
  due_date: string;
  priority: string;
  updated_at: string;
};

export function DeadlineFields({ task }: { task?: DeadlineTask | null }) {
  return (
    <fieldset className="grid min-w-0 gap-4 rounded-lg border border-slate-200 p-3 sm:col-span-2 sm:grid-cols-2">
      <legend className="px-1 text-sm font-semibold">締切タスク（任意）</legend>
      <input type="hidden" name="deadline_task_id" value={task?.id ?? ""} />
      <input type="hidden" name="deadline_task_updated_at" value={task?.updated_at ?? ""} />
      <div className="sm:col-span-2">
        <label htmlFor="deadline_title" className="ui-label">締切タスク名</label>
        <input
          id="deadline_title"
          name="deadline_title"
          defaultValue={task?.title ?? ""}
          placeholder="例: ESを提出する"
          className="ui-field"
        />
      </div>
      <div>
        <label htmlFor="deadline_date" className="ui-label">締切日</label>
        <input
          id="deadline_date"
          name="deadline_date"
          type="date"
          defaultValue={deadlineDateInputValue(task?.due_date)}
          className="ui-field"
        />
      </div>
      <div>
        <label htmlFor="deadline_priority" className="ui-label">締切の優先度</label>
        <select
          id="deadline_priority"
          name="deadline_priority"
          defaultValue={normalizeTaskPriority(task?.priority ?? "medium")}
          className="ui-field"
        >
          <option value="low">低</option>
          <option value="medium">中</option>
          <option value="high">高</option>
        </select>
      </div>
    </fieldset>
  );
}
