/** A to-do for one army, optionally tied to a unit on the in progress tab. */
export interface Task {
  id: string;
  /** Army slug, e.g. "night-goblins". */
  army: string;
  title: string;
  unit?: string;
  status: "todo" | "done";
  created: string;
  done?: string;
}

export function newTask(army: string, title: string, unit?: string, now = new Date()): Task {
  const id = `${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  return { id, army, title: title.trim(), ...(unit ? { unit } : {}), status: "todo", created: now.toISOString() };
}

export function toggleTask(tasks: Task[], id: string, now = new Date()): Task[] {
  return tasks.map((t) => {
    if (t.id !== id) return t;
    if (t.status === "done") {
      const { done: _done, ...rest } = t;
      return { ...rest, status: "todo" };
    }
    return { ...t, status: "done", done: now.toISOString() };
  });
}

export function removeTask(tasks: Task[], id: string): Task[] {
  return tasks.filter((t) => t.id !== id);
}

/** Open tasks first (oldest first), then done tasks (most recently finished first). */
export function sortTasks(tasks: Task[]): Task[] {
  const open = tasks.filter((t) => t.status === "todo").sort((a, b) => a.created.localeCompare(b.created));
  const done = tasks.filter((t) => t.status === "done").sort((a, b) => (b.done ?? "").localeCompare(a.done ?? ""));
  return [...open, ...done];
}

/**
 * Applies the same change to the latest saved list, so two devices editing
 * different tasks don't overwrite each other.
 */
export type TaskChange = (tasks: Task[]) => Task[];

/** Marks a task done if it's still open; leaves finished tasks as they are. */
export function completeTask(tasks: Task[], id: string, now = new Date()): Task[] {
  return tasks.map((t) => (t.id === id && t.status === "todo" ? { ...t, status: "done", done: now.toISOString() } : t));
}
