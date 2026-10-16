import { armyForFaction, armySlug } from "./armies";
import { recordsToRows, rowsToRecords } from "./table";
import type { Task } from "./tasks";
import type { Army, Project } from "./types";

/** One unit worked on in one session. A session that covers three units is three entries. */
export interface LogEntry {
  id: string;
  /** Day the work was done, YYYY-MM-DD. */
  date: string;
  /** Army slug, e.g. "night-goblins". */
  army: string;
  /** Unit name, or "" for work on the whole army. */
  unit: string;
  /** What was done, e.g. "Connect the bases". */
  step: string;
  /** The task this work was for, if any. */
  task: string;
  /** Entries logged together share a session id. */
  session: string;
}

export const WORKLOG_TAB = "work log";
export const WORKLOG_COLUMNS = ["id", "date", "army", "unit", "step", "task", "session"] as const;

export function rowsToLog(rows: string[][]): LogEntry[] {
  return rowsToRecords(rows, WORKLOG_COLUMNS, ["id", "step"], WORKLOG_TAB);
}

/** Rows to append below the header (no header row). */
export function logToRows(entries: LogEntry[]): string[][] {
  return recordsToRows(entries, WORKLOG_COLUMNS);
}

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** Entries for one session: one per unit, or a single whole-army entry when no units are picked. */
export function newSession(army: string, units: string[], step: string, date: string, task?: Task): LogEntry[] {
  const session = uid();
  const list = units.length ? units : [""];
  return list.map((unit) => ({ id: uid(), date, army, unit, step: step.trim(), task: task?.id ?? "", session }));
}

/** A unit that can still be worked on, with its latest logged step if there is one. */
export interface WorkableUnit {
  unit: string;
  state: string;
  pts: number;
  models: number;
  year: number | null;
  last?: { step: string; date: string };
}

const isFinished = (state: string) => /^(done|complete|completed|finished)$/i.test(state.trim());

/**
 * Units for an army that still need work: everything in the backlog (no year)
 * plus this year's units that aren't marked done.
 */
export function workableUnits(army: Army, projects: Project[], armies: Army[], year: number, log: LogEntry[]): WorkableUnit[] {
  const slug = armySlug(army.army);
  const latest = latestStepByUnit(log.filter((e) => e.army === slug));
  return projects
    .filter((p) => armyForFaction(p.faction, armies) === army)
    .filter((p) => p.year === null || (p.year === year && !isFinished(p.state)))
    .map((p) => {
      const last = latest.get(p.unit.toLowerCase());
      return { unit: p.unit, state: p.state, pts: p.pts, models: p.models, year: p.year, ...(last ? { last } : {}) };
    })
    .sort((a, b) => (b.last?.date ?? "").localeCompare(a.last?.date ?? "") || a.unit.localeCompare(b.unit));
}

/** Most recent step per unit name (lowercased), latest date wins; later entries win ties. */
export function latestStepByUnit(entries: LogEntry[]): Map<string, { step: string; date: string }> {
  const out = new Map<string, { step: string; date: string }>();
  for (const e of entries) {
    if (!e.unit) continue;
    const k = e.unit.toLowerCase();
    const prev = out.get(k);
    if (!prev || e.date >= prev.date) out.set(k, { step: e.step, date: e.date });
  }
  return out;
}

/** Sessions newest first, each with its units gathered. */
export function recentSessions(entries: LogEntry[], limit = 10) {
  const by = new Map<string, { date: string; army: string; step: string; units: string[] }>();
  for (const e of entries) {
    const s = by.get(e.session) ?? { date: e.date, army: e.army, step: e.step, units: [] };
    if (e.unit) s.units.push(e.unit);
    by.set(e.session, s);
  }
  return [...by.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

/** Open tasks for an army, with tasks for the picked units first, then army-wide ones, then the rest. */
export function suggestTasks(tasks: Task[], army: string, units: string[]): Task[] {
  const picked = new Set(units.map((u) => u.toLowerCase()));
  const rank = (t: Task) => (t.unit && picked.has(t.unit.toLowerCase()) ? 0 : !t.unit ? 1 : 2);
  return tasks
    .filter((t) => t.army === army && t.status === "todo")
    .sort((a, b) => rank(a) - rank(b) || a.created.localeCompare(b.created));
}
