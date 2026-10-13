/** One army row from the faction table on the sheet's "11th" tab. */
export interface Army {
  group: string;
  army: string;
  totalPts: number;
  paintedPts: number;
  unpaintedPts: number;
  models: number;
  /** How the models were acquired: print, used, mix, etc. */
  source: string;
}

/** One unit row from the "in progress" tab. */
export interface Project {
  /** Year the unit was worked on, or null when it is still in the backlog. */
  year: number | null;
  faction: string;
  unit: string;
  state: string;
  pts: number;
  models: number;
}

/** A painting project with logged hours, used for time-per-model figures. */
export interface TimeLog {
  project: string;
  when: string;
  kind: "infantry" | "knight" | "single";
  models: number;
  hours: number;
  /** Where in the sheet the hours were logged. */
  source: string;
}

/** Everything the dashboard reads, as written by the sheet sync. */
export interface Collection {
  generatedAt: string;
  /** "sheet" when synced from Google Sheets, "snapshot" for a hand-made copy. */
  origin: "sheet" | "snapshot";
  armies: Army[];
  projects: Project[];
}
