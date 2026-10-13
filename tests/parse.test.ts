import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseArmies, parseCsv, parseProjects } from "../src/lib/parse";

const fixture = (name: string) => parseCsv(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));

describe("parseArmies", () => {
  const armies = parseArmies(fixture("eleventh.csv"));

  it("reads every army in the faction table and stops at the first blank row", () => {
    expect(armies.map((a) => a.army)).toEqual([
      "craftworlds", "Harlequins", "Drukhari", "First Born night lords", "Mystical mechanicus",
      "heresy imperial knights", "custodes", "Agents", "Night Goblins", "Votann",
    ]);
  });

  it("reads points, models and source as given", () => {
    expect(armies[7]).toEqual({
      group: "imperial", army: "Agents", totalPts: 4820, paintedPts: 905, unpaintedPts: 3915, models: 214, source: "mix",
    });
  });

  it("matches the totals the sheet shows in its first row", () => {
    expect(armies.reduce((s, a) => s + a.totalPts, 0)).toBe(52324);
    expect(armies.reduce((s, a) => s + a.paintedPts, 0)).toBe(37613);
    expect(armies.reduce((s, a) => s + a.models, 0)).toBe(1597);
  });

  it("says what is wrong when the header is missing", () => {
    expect(() => parseArmies([["faction", "totals"]])).toThrow(/header/);
  });
});

describe("parseProjects", () => {
  const projects = parseProjects(fixture("in-progress.csv"));

  it("keeps rows that name a unit and skips helper rows", () => {
    expect(projects.map((p) => p.unit)).toEqual([
      "Voidweaver", "all", "windriders", "breachers", "devilfish", "howling banshees", "ministorum priest", "venoms",
    ]);
  });

  it("treats a blank year as backlog", () => {
    const priest = projects.find((p) => p.unit === "ministorum priest");
    expect(priest).toMatchObject({ year: null, faction: "imperial agents", pts: 0, models: 2 });
  });

  it("reads numbers with thousands separators", () => {
    expect(projects.find((p) => p.unit === "venoms")?.pts).toBe(1200);
  });

  it("reads the year, state and size of a finished unit", () => {
    expect(projects.find((p) => p.unit === "breachers")).toEqual({
      year: 2026, faction: "tau", unit: "breachers", state: "done", pts: 90, models: 10,
    });
  });
});
