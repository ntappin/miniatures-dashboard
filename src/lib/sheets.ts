import { rowsToTasks, TASK_COLUMNS, TASKS_TAB, tasksToRows } from "./task-rows";
import type { Task, TaskChange } from "./tasks";
import { logToRows, rowsToLog, WORKLOG_COLUMNS, WORKLOG_TAB, type LogEntry } from "./worklog";

/**
 * Reads and writes app tabs of the toy list sheet with the signed-in person's
 * Google access token. Google decides who may write: only accounts with edit
 * access to the sheet.
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

const rangeUrl = (sheetId: string, tab: string, suffix = "") =>
  `${API}/${sheetId}/values/${encodeURIComponent(`'${tab}'!A1:G5000`)}${suffix}`;

/** A tab's rows, or null when the tab doesn't exist yet. */
async function readTab(token: string, sheetId: string, tab: string): Promise<string[][] | null> {
  try {
    const body = (await call(token, rangeUrl(sheetId, tab))) as { values?: unknown[][] };
    return (body.values ?? []).map((r) => r.map((c) => (c ?? "").toString()));
  } catch (err) {
    if (err instanceof SheetError && /Unable to parse range/i.test(err.message)) return null;
    throw err;
  }
}

async function addTab(token: string, sheetId: string, tab: string, header: readonly string[]) {
  await call(token, `${API}/${sheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tab } } }] }),
  });
  await call(token, `${rangeUrl(sheetId, tab)}?valueInputOption=RAW`, { method: "PUT", body: JSON.stringify({ values: [header] }) });
}

// Tasks ----------------------------------------------------------------------

export async function readTasks(token: string, sheetId: string): Promise<Task[] | null> {
  const rows = await readTab(token, sheetId, TASKS_TAB);
  return rows === null ? null : rowsToTasks(rows);
}

/**
 * Applies `change` to the tasks as they are on the sheet now, then writes them back.
 * The first time, it creates the tasks tab starting from `seed` (the published list).
 */
export async function saveTasks(token: string, sheetId: string, change: TaskChange, seed: Task[]): Promise<Task[]> {
  let current = await readTasks(token, sheetId);
  if (current === null) {
    await addTab(token, sheetId, TASKS_TAB, TASK_COLUMNS);
    current = seed;
  }
  const next = change(current);
  await call(token, rangeUrl(sheetId, TASKS_TAB, ":clear"), { method: "POST", body: "{}" });
  await call(token, `${rangeUrl(sheetId, TASKS_TAB)}?valueInputOption=RAW`, { method: "PUT", body: JSON.stringify({ values: tasksToRows(next) }) });
  return next;
}

// Work log -------------------------------------------------------------------

export async function readLog(token: string, sheetId: string): Promise<LogEntry[] | null> {
  const rows = await readTab(token, sheetId, WORKLOG_TAB);
  return rows === null ? null : rowsToLog(rows);
}

/** Adds entries below the existing ones, creating the work log tab the first time. */
export async function appendLog(token: string, sheetId: string, entries: LogEntry[]): Promise<void> {
  if ((await readTab(token, sheetId, WORKLOG_TAB)) === null) await addTab(token, sheetId, WORKLOG_TAB, WORKLOG_COLUMNS);
  await call(token, `${rangeUrl(sheetId, WORKLOG_TAB, ":append")}?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    body: JSON.stringify({ values: logToRows(entries) }),
  });
}
