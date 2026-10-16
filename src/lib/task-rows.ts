import type { Task } from "./tasks";

/** Name of the sheet tab that holds tasks, and its header row. */
export const TASKS_TAB = "tasks";
export const TASK_COLUMNS = ["id", "army", "title", "unit", "status", "created", "done"] as const;

/** Reads the tasks tab. Rows without an id or title are skipped, so notes typed below the table are ignored. */
export function rowsToTasks(rows: string[][]): Task[] {
  const [header, ...body] = rows;
  if (!header) return [];
  const col = (name: (typeof TASK_COLUMNS)[number]) => header.findIndex((h) => h.toString().trim().toLowerCase() === name);
  const idx = Object.fromEntries(TASK_COLUMNS.map((c) => [c, col(c)])) as Record<(typeof TASK_COLUMNS)[number], number>;
  if (idx.id < 0 || idx.title < 0) throw new Error('The tasks tab needs "id" and "title" columns in its first row');
  const get = (r: string[], c: number) => (c >= 0 ? (r[c] ?? "").toString().trim() : "");
  return body
    .filter((r) => get(r, idx.id) && get(r, idx.title))
    .map((r) => {
      const task: Task = {
        id: get(r, idx.id),
        army: get(r, idx.army),
        title: get(r, idx.title),
        status: get(r, idx.status).toLowerCase() === "done" ? "done" : "todo",
        created: get(r, idx.created),
      };
      const unit = get(r, idx.unit);
      const done = get(r, idx.done);
      if (unit) task.unit = unit;
      if (task.status === "done" && done) task.done = done;
      return task;
    });
}

/** Writes tasks as a table with a header row, in the column order above. */
export function tasksToRows(tasks: Task[]): string[][] {
  return [
    [...TASK_COLUMNS],
    ...tasks.map((t) => [t.id, t.army, t.title, t.unit ?? "", t.status, t.created, t.done ?? ""]),
  ];
}
