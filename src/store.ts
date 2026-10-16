import { currentToken, sheetId, signIn } from "./auth";
import { appendLog, readLog, readTasks, saveTasks, SheetError } from "./lib/sheets";
import { completeTask, type Task, type TaskChange } from "./lib/tasks";
import type { LogEntry } from "./lib/worklog";

export type SaveState =
  | { kind: "public" } // signed out: read-only
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

type Listener = () => void;

/**
 * Holds tasks and the work log. Signed out it shows the published copies;
 * signed in it reads and writes the sheet.
 */
export class Store {
  tasks: Task[] = [];
  log: LogEntry[] = [];
  private published = { tasks: [] as Task[], log: [] as LogEntry[] };
  save: SaveState = { kind: "public" };
  private listeners = new Set<Listener>();
  private queue: Promise<unknown> = Promise.resolve();

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
    const get = async <T>(file: string): Promise<T[]> => {
      try {
        const res = await fetch(`${base}data/${file}`, { cache: "no-store" });
        return res.ok ? ((await res.json()) as T[]) : [];
      } catch {
        return [];
      }
    };
    [this.published.tasks, this.published.log] = await Promise.all([get<Task>("tasks.json"), get<LogEntry>("worklog.json")]);
    this.tasks = this.published.tasks;
    this.log = this.published.log;
    this.emit();
  }

  /** Signs in and switches to the live tasks and work log on the sheet. Returns whether it worked. */
  async startEditing(): Promise<boolean> {
    if (!sheetId) return false;
    try {
      const token = await signIn();
      const [tasks, log] = await Promise.all([readTasks(token, sheetId), readLog(token, sheetId)]);
      this.tasks = tasks ?? this.published.tasks;
      this.log = log ?? this.published.log;
      this.save = { kind: "saved" };
      this.emit();
      return true;
    } catch (err) {
      this.save = { kind: "error", message: (err as Error).message };
      this.emit();
      return false;
    }
  }

  stopEditing() {
    this.tasks = this.published.tasks;
    this.log = this.published.log;
    this.save = { kind: "public" };
    this.emit();
  }

  private token(): string | undefined {
    const token = currentToken();
    if (!token || !sheetId) {
      this.save = { kind: "error", message: "Your Google sign-in has expired. Sign in again to keep editing." };
      this.emit();
    }
    return token;
  }

  /** Runs a save after earlier ones finish, showing progress and errors. */
  private enqueue(work: (token: string) => Promise<void>, token: string): Promise<boolean> {
    this.save = { kind: "saving" };
    this.emit();
    const run = this.queue.then(async () => {
      try {
        await work(token);
        this.save = { kind: "saved" };
        this.emit();
        return true;
      } catch (err) {
        this.save = {
          kind: "error",
          message: err instanceof SheetError ? err.message : "Couldn't reach Google Sheets. Check your connection and try again.",
        };
        if (!(err instanceof SheetError && err.signedOut)) {
          try {
            this.tasks = (await readTasks(token, sheetId!)) ?? this.tasks;
            this.log = (await readLog(token, sheetId!)) ?? this.log;
          } catch {
            /* keep what's shown */
          }
        }
        this.emit();
        return false;
      }
    });
    this.queue = run;
    return run;
  }

  /** Shows a task change right away and saves it to the sheet. */
  apply(change: TaskChange) {
    const token = this.token();
    if (!token) return;
    this.tasks = change(this.tasks);
    this.enqueue(async (t) => {
      this.tasks = await saveTasks(t, sheetId!, change, this.published.tasks);
    }, token);
  }

  /** Saves a work session, and marks its task done when asked. Resolves to whether it saved. */
  logWork(entries: LogEntry[], finishTask?: string): Promise<boolean> {
    const token = this.token();
    if (!token) return Promise.resolve(false);
    this.log = [...this.log, ...entries];
    const change: TaskChange | undefined = finishTask ? (ts) => completeTask(ts, finishTask) : undefined;
    if (change) this.tasks = change(this.tasks);
    return this.enqueue(async (t) => {
      await appendLog(t, sheetId!, entries);
      if (change) this.tasks = await saveTasks(t, sheetId!, change, this.published.tasks);
    }, token);
  }
}
