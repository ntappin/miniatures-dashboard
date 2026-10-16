import { getToken, loadRemote, saveChange, SaveError } from "./lib/github";
import type { Task, TaskChange } from "./lib/tasks";

export type SaveState =
  | { kind: "local" } // no token: changes stay on this page
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

type Listener = () => void;

/** Holds the task list, applies changes at once and saves them to GitHub when connected. */
export class TaskStore {
  tasks: Task[] = [];
  save: SaveState = { kind: "local" };
  private listeners = new Set<Listener>();
  private queue: Promise<void> = Promise.resolve();

  onChange(fn: Listener) {
    this.listeners.add(fn);
  }

  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  get connected() {
    return !!getToken();
  }

  /** Loads the published copy, then the latest from the repo when a token is set. */
  async load(base: string) {
    try {
      const res = await fetch(`${base}data/tasks.json`, { cache: "no-store" });
      if (res.ok) this.tasks = (await res.json()) as Task[];
    } catch {
      /* no published tasks yet */
    }
    this.save = this.connected ? { kind: "saved" } : { kind: "local" };
    this.emit();
    await this.refresh();
  }

  async refresh() {
    const token = getToken();
    if (!token) return;
    try {
      this.tasks = (await loadRemote(token)).tasks;
      this.save = { kind: "saved" };
    } catch (err) {
      this.save = { kind: "error", message: (err as Error).message };
    }
    this.emit();
  }

  /** Shows the change right away; saves it in order behind any earlier saves. */
  apply(change: TaskChange, message: string) {
    this.tasks = change(this.tasks);
    const token = getToken();
    if (!token) {
      this.save = { kind: "local" };
      this.emit();
      return;
    }
    this.save = { kind: "saving" };
    this.emit();
    this.queue = this.queue.then(async () => {
      try {
        this.tasks = await saveChange(token, change, message);
        this.save = { kind: "saved" };
      } catch (err) {
        this.save = { kind: "error", message: err instanceof SaveError ? err.message : "Couldn't reach GitHub. Check your connection and try again." };
        try {
          this.tasks = (await loadRemote(token)).tasks;
        } catch {
          /* keep what's shown */
        }
      }
      this.emit();
    });
  }
}
