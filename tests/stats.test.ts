import { describe, expect, it } from "vitest";
import { fullYearPace, hoursPerModel, outputByYear, yearVsBacklog } from "../src/lib/stats";
import type { Project, TimeLog } from "../src/lib/types";

const p = (year: number | null, faction: string, pts: number, models: number, unit = "u"): Project =>
  ({ year, faction, unit, state: "", pts, models });

describe("yearVsBacklog", () => {
  it("merges factions that differ only in case and splits this year from the backlog", () => {
    const rows = yearVsBacklog([p(2026, "tau", 90, 10), p(2026, "Tau", 85, 1), p(null, "tau", 50, 5), p(2025, "tau", 999, 99)], 2026);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ faction: "Tau", doneModels: 11, donePts: 175, backlogModels: 5, backlogPts: 50 });
  });
});

describe("outputByYear", () => {
  it("sums each year and leaves the backlog out", () => {
    expect(outputByYear([p(2025, "a", 10, 1), p(2023, "b", 5, 2), p(2025, "c", 1, 1), p(null, "d", 100, 100)])).toEqual([
      { year: 2023, pts: 5, models: 2 },
      { year: 2025, pts: 11, models: 2 },
    ]);
  });
});

describe("fullYearPace", () => {
  it("doubles a total read halfway through the year", () => {
    const mid = new Date(Date.UTC(2026, 0, 1) + (Date.UTC(2027, 0, 1) - Date.UTC(2026, 0, 1)) / 2);
    expect(fullYearPace(100, mid)).toBeCloseTo(200);
  });
});

describe("hoursPerModel", () => {
  it("weights by models painted rather than averaging projects", () => {
    const logs: TimeLog[] = [
      { project: "a", when: "", kind: "infantry", models: 100, hours: 25, source: "" },
      { project: "b", when: "", kind: "infantry", models: 10, hours: 10, source: "" },
    ];
    expect(hoursPerModel(logs)).toBeCloseTo(35 / 110);
  });
});
