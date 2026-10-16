import { rowsToTasks, TASKS_TAB, tasksToRows } from "./task-rows";
import type { Task, TaskChange } from "./tasks";

/**
 * Reads and writes the tasks tab of the toy list sheet with the signed-in
 * person's Google access token. Google decides who may write: only accounts
 * with edit access to the sheet.
 */
const API = "https://sheets.googleapis.com/v4/spreadsheets";

export class SheetError extends Error {
  constructor(message: string, readonly signedOut = false) {
    super(message);
  }
}

async function call(token: string, url: string, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" } });
  if (res.ok) return res.json();
  if (res.status === 401) throw new SheetError("Your Google sign-in has expired. Sign in again to keep editing.", true);
  if (res.status === 403 || res.status === 404)
    throw new SheetError("This Google account can't edit the toy list sheet. Sign in with the account that owns it.");
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  throw new SheetError(`Google Sheets returned an error: ${body.error?.message ?? res.status}`);
}

const range = (sheetId: string) => `${API}/${sheetId}/values/${encodeURIComponent(`'${TASKS_TAB}'!A1:G1000`)}`;

/** The tasks on the sheet, or null when the tasks tab doesn't exist yet. */
export async function readTasks(token: string, sheetId: string): Promise<Task[] | null> {
  try {
    const body = (await call(token, range(sheetId))) as { values?: string[][] };
    return rowsToTasks(body.values ?? []);
  } catch (err) {
    if (err instanceof SheetError && /Unable to parse range/i.test(err.message)) return null;
    throw err;
  }
}

async function addTasksTab(token: string, sheetId: string) {
  await call(token, `${API}/${sheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: TASKS_TAB } } }] }),
  });
}

async function writeTasks(token: string, sheetId: string, tasks: Task[]) {
  await call(token, `${API}/${sheetId}/values/${encodeURIComponent(`'${TASKS_TAB}'!A1:G1000`)}:clear`, { method: "POST", body: "{}" });
  await call(token, `${range(sheetId)}?valueInputOption=RAW`, {
    method: "PUT",
    body: JSON.stringify({ values: tasksToRows(tasks) }),
  });
}

/**
 * Applies `change` to the tasks as they are on the sheet now, then writes them back.
 * The first time, it creates the tasks tab starting from `seed` (the published list).
 */
export async function saveChange(token: string, sheetId: string, change: TaskChange, seed: Task[]): Promise<Task[]> {
  let current = await readTasks(token, sheetId);
  if (current === null) {
    await addTasksTab(token, sheetId);
    current = seed;
  }
  const next = change(current);
  await writeTasks(token, sheetId, next);
  return next;
}
