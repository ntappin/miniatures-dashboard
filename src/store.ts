import { currentToken, sheetId, signIn } from "./auth";
import { readTasks, saveChange, SheetError } from "./lib/sheets";
import type { Task, TaskChange } from "./lib/tasks";

export type SaveState =
  | { kind: "public" } // signed out: read-only
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

type Listener = () => void;

/** Holds the task list. Signed out it shows the published copy; signed in it reads and writes the sheet. */
export class TaskStore {
  tasks: Task[] = [];
  published: Task[] = [];
  save: SaveState = { kind: "public" };
  private listeners = new Set<Listener>();
  private queue: Promise<void> = Promise.resolve();

  onChange(fn: Listener) {
    this.listeners.add(fn);
  }

  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  get canEdit() {
    return !!currentToken() && this.save.kind !== "public";
  }

  async load(base: string) {
    try {
      const res = await fetch(`${base}data/tasks.json`, { cache: "no-store" });
      if (res.ok) this.published = (await res.json()) as Task[];
    } catch {
      /* no published tasks yet */
    }
    this.tasks = this.published;
    this.emit();
  }

  /** Signs in and switches to the live tasks on the sheet. */
  async startEditing() {
    if (!sheetId) return;
    try {
      const token = await signIn();
      const live = await readTasks(token, sheetId);
      this.tasks = live ?? this.published;
      this.save = { kind: "saved" };
    } catch (err) {
      this.save = { kind: "error", message: (err as Error).message };
    }
    this.emit();
  }

  stopEditing() {
    this.tasks = this.published;
    this.save = { kind: "public" };
    this.emit();
  }

  /** Shows the change right away and saves it to the sheet, in order behind earlier saves. */
  apply(change: TaskChange) {
    const token = currentToken();
    if (!token || !sheetId) {
      this.save = { kind: "error", message: "Your Google sign-in has expired. Sign in again to keep editing." };
      this.emit();
      return;
    }
    this.tasks = change(this.tasks);
    this.save = { kind: "saving" };
    this.emit();
    this.queue = this.queue.then(async () => {
      try {
        this.tasks = await saveChange(token, sheetId!, change, this.published);
        this.save = { kind: "saved" };
      } catch (err) {
        const message = err instanceof SheetError ? err.message : "Couldn't reach Google Sheets. Check your connection and try again.";
        this.save = { kind: "error", message };
        if (!(err instanceof SheetError && err.signedOut)) {
          try {
            this.tasks = (await readTasks(token, sheetId!)) ?? this.published;
          } catch {
            /* keep what's shown */
          }
        }
      }
      this.emit();
    });
  }
}
