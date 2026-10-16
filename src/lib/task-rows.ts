import { recordsToRows, rowsToRecords } from "./table";
import type { Task } from "./tasks";

/** Name of the sheet tab that holds tasks, and its header row. */
export const TASKS_TAB = "tasks";
export const TASK_COLUMNS = ["id", "army", "title", "unit", "status", "created", "done"] as const;

/** Reads the tasks tab. Rows without an id or title are skipped. */
export function rowsToTasks(rows: string[][]): Task[] {
  return rowsToRecords(rows, TASK_COLUMNS, ["id", "title"], TASKS_TAB).map((r) => {
    const task: Task = {
      id: r.id,
      army: r.army,
      title: r.title,
      status: r.status.toLowerCase() === "done" ? "done" : "todo",
      created: r.created,
    };
    if (r.unit) task.unit = r.unit;
    if (task.status === "done" && r.done) task.done = r.done;
    return task;
  });
}

/** Writes tasks as a table with a header row, in the column order above. */
export function tasksToRows(tasks: Task[]): string[][] {
  return [[...TASK_COLUMNS], ...recordsToRows(tasks, TASK_COLUMNS)];
}
