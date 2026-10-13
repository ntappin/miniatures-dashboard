import type { Army, Project } from "./types";

/** A sheet tab as rows of cell text, the shape both the Sheets API and a CSV export give. */
export type Grid = string[][];

const cell = (row: string[] | undefined, i: number): string => (row?.[i] ?? "").toString().trim();

/** Parses a number cell, tolerating thousands separators and blanks (which become 0). */
export const num = (v: string): number => {
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Reads the faction table on the "11th" tab: the rows under the
 * "total | painted | unpainted | model count" header, down to the first blank row.
 */
export function parseArmies(grid: Grid): Army[] {
  const header = grid.findIndex((r) => cell(r, 2).toLowerCase() === "total" && cell(r, 3).toLowerCase() === "painted");
  if (header < 0) throw new Error('Couldn\'t find the "total | painted | unpainted" header on the 11th tab');
  const armies: Army[] = [];
  for (const row of grid.slice(header + 1)) {
    const group = cell(row, 0);
    const army = cell(row, 1);
    if (!group || !army) break;
    armies.push({
      group,
      army,
      totalPts: num(cell(row, 2)),
      paintedPts: num(cell(row, 3)),
      unpaintedPts: num(cell(row, 4)),
      models: num(cell(row, 5)),
      source: cell(row, 6),
    });
  }
  if (!armies.length) throw new Error("The faction table on the 11th tab has no rows");
  return armies;
}

/**
 * Reads unit rows from the "in progress" tab, below the "year completed" header.
 * A row counts when it names a unit; a blank year means the unit is in the backlog.
 */
export function parseProjects(grid: Grid): Project[] {
  const header = grid.findIndex((r) => cell(r, 0).toLowerCase() === "year completed");
  if (header < 0) throw new Error('Couldn\'t find the "year completed" header on the in progress tab');
  const projects: Project[] = [];
  for (const row of grid.slice(header + 1)) {
    const unit = cell(row, 2);
    const faction = cell(row, 1);
    if (!unit || !faction) continue;
    const yearText = cell(row, 0);
    if (yearText && !/^\d{4}$/.test(yearText)) continue;
    projects.push({
      year: yearText ? Number(yearText) : null,
      faction,
      unit,
      state: cell(row, 3),
      pts: num(cell(row, 4)),
      models: num(cell(row, 5)),
    });
  }
  return projects;
}

/** Splits CSV text into rows of cells, handling quoted fields. */
export function parseCsv(text: string): Grid {
  const rows: Grid = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  row.push(field);
  rows.push(row);
  return rows;
}
