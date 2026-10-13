import type { Army, Project, TimeLog } from "./types";

const sum = <T>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0);

/** Sheet faction names vary in case ("tau", "Tau"); this gives one key and one label per faction. */
export const factionKey = (name: string) => name.trim().toLowerCase();
export const factionLabel = (name: string) => name.trim().replace(/\b\p{L}/gu, (c) => c.toUpperCase());

export function collectionTotals(armies: Army[]) {
  const totalPts = sum(armies, (a) => a.totalPts);
  const paintedPts = sum(armies, (a) => a.paintedPts);
  return {
    totalPts,
    paintedPts,
    unpaintedPts: sum(armies, (a) => a.unpaintedPts),
    models: sum(armies, (a) => a.models),
    paintedShare: totalPts ? paintedPts / totalPts : 0,
  };
}

export function biggestPile(armies: Army[]): Army | undefined {
  return armies.reduce<Army | undefined>((m, a) => (!m || a.unpaintedPts > m.unpaintedPts ? a : m), undefined);
}

export interface FactionProgress {
  faction: string;
  doneModels: number;
  donePts: number;
  backlogModels: number;
  backlogPts: number;
  units: { unit: string; state: string }[];
}

/** Units worked on in `year` against the backlog (rows with no year), by faction. */
export function yearVsBacklog(projects: Project[], year: number): FactionProgress[] {
  const by = new Map<string, FactionProgress>();
  const get = (name: string) => {
    const k = factionKey(name);
    let f = by.get(k);
    if (!f) {
      f = { faction: factionLabel(name), doneModels: 0, donePts: 0, backlogModels: 0, backlogPts: 0, units: [] };
      by.set(k, f);
    }
    return f;
  };
  for (const p of projects) {
    if (p.year === year) {
      const f = get(p.faction);
      f.doneModels += p.models;
      f.donePts += p.pts;
      f.units.push({ unit: p.unit, state: p.state });
    } else if (p.year === null) {
      const f = get(p.faction);
      f.backlogModels += p.models;
      f.backlogPts += p.pts;
    }
  }
  return [...by.values()];
}

export interface YearOutput {
  year: number;
  pts: number;
  models: number;
}

export function outputByYear(projects: Project[]): YearOutput[] {
  const by = new Map<number, YearOutput>();
  for (const p of projects) {
    if (p.year === null) continue;
    const y = by.get(p.year) ?? { year: p.year, pts: 0, models: 0 };
    y.pts += p.pts;
    y.models += p.models;
    by.set(p.year, y);
  }
  return [...by.values()].sort((a, b) => a.year - b.year);
}

/** Scales a part-year total up to a full year, from the date the data was read. */
export function fullYearPace(value: number, asOf: Date): number {
  const start = Date.UTC(asOf.getUTCFullYear(), 0, 1);
  const end = Date.UTC(asOf.getUTCFullYear() + 1, 0, 1);
  const elapsed = (asOf.getTime() - start) / (end - start);
  return elapsed > 0 ? value / elapsed : value;
}

export function minutesPerModel(log: TimeLog): number {
  return (log.hours * 60) / log.models;
}

/** Hours per model across a set of logs, weighted by models painted. */
export function hoursPerModel(logs: TimeLog[]): number {
  const models = sum(logs, (l) => l.models);
  return models ? sum(logs, (l) => l.hours) / models : 0;
}
