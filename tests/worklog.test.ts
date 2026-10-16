import { describe, expect, it } from "vitest";
import { latestStepByUnit, logToRows, newSession, recentSessions, rowsToLog, suggestTasks, workableUnits, WORKLOG_COLUMNS, type LogEntry } from "../src/lib/worklog";
import type { Task } from "../src/lib/tasks";
import type { Army, Project } from "../src/lib/types";

const army = (name: string): Army => ({ group: "", army: name, totalPts: 0, paintedPts: 0, unpaintedPts: 0, models: 0, source: "" });
const armies = [army("Agents"), army("craftworlds")];
const p = (year: number | null, faction: string, unit: string, state = ""): Project => ({ year, faction, unit, state, pts: 10, models: 1 });
const entry = (unit: string, step: string, date: string, extra: Partial<LogEntry> = {}): LogEntry =>
  ({ id: unit + date, date, army: "agents", unit, step, task: "", session: date, ...extra });

describe("newSession", () => {
  it("makes one entry per unit sharing a session, tied to the task", () => {
    const task = { id: "t1" } as Task;
    const s = newSession("agents", ["rhino", "venoms"], " Glue arms ", "2026-10-15", task);
    expect(s).toHaveLength(2);
    expect(s.map((e) => e.unit)).toEqual(["rhino", "venoms"]);
    expect(s[0]).toMatchObject({ army: "agents", step: "Glue arms", date: "2026-10-15", task: "t1" });
    expect(s[0].session).toBe(s[1].session);
    expect(s[0].id).not.toBe(s[1].id);
  });

  it("logs whole-army work as one entry with no unit", () => {
    const s = newSession("agents", [], "Prime everything", "2026-10-15");
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ unit: "", task: "" });
  });
});

describe("sheet rows", () => {
  it("round-trips through the work log tab", () => {
    const entries = newSession("agents", ["rhino"], "Base", "2026-10-15");
    expect(rowsToLog([[...WORKLOG_COLUMNS], ...logToRows(entries)])).toEqual(entries);
  });
});

describe("workableUnits", () => {
  const projects = [
    p(null, "imperial agents", "ministorum priest"),
    p(2026, "imperial agents", "calidus", "done"),
    p(2026, "imperial agents", "rhino", "assembled"),
    p(2025, "imperial agents", "old thing", "primed"),
    p(null, "craftworld", "wave serpent"),
  ];

  it("keeps the backlog and this year's unfinished units for the army only", () => {
    expect(workableUnits(armies[0], projects, armies, 2026, []).map((u) => u.unit)).toEqual(["ministorum priest", "rhino"]);
  });

  it("puts recently worked units first and shows their latest step", () => {
    const units = workableUnits(armies[0], projects, armies, 2026, [entry("Rhino", "Glue tracks", "2026-10-14")]);
    expect(units[0]).toMatchObject({ unit: "rhino", last: { step: "Glue tracks", date: "2026-10-14" } });
  });
});

describe("latestStepByUnit", () => {
  it("keeps the latest date per unit, ignoring whole-army entries", () => {
    const m = latestStepByUnit([entry("rhino", "Prime", "2026-10-10"), entry("rhino", "Base", "2026-10-12"), entry("Rhino", "Old", "2026-10-01"), entry("", "All", "2026-10-13")]);
    expect(m.get("rhino")).toEqual({ step: "Base", date: "2026-10-12" });
    expect(m.size).toBe(1);
  });
});

describe("recentSessions", () => {
  it("groups units by session, newest first", () => {
    const s = recentSessions([entry("a", "Prime", "2026-10-10", { session: "s1" }), entry("b", "Prime", "2026-10-10", { session: "s1" }), entry("c", "Base", "2026-10-12", { session: "s2" })]);
    expect(s).toEqual([
      { date: "2026-10-12", army: "agents", step: "Base", units: ["c"] },
      { date: "2026-10-10", army: "agents", step: "Prime", units: ["a", "b"] },
    ]);
  });
});

describe("suggestTasks", () => {
  const t = (id: string, unit: string | undefined, created: string, extra: Partial<Task> = {}): Task =>
    ({ id, army: "agents", title: id, status: "todo", created, ...(unit ? { unit } : {}), ...extra });
  it("lists open tasks for the picked units, then army-wide, then others", () => {
    const tasks = [t("other", "venoms", "1"), t("wide", undefined, "2"), t("mine", "Rhino", "3"), t("done", "rhino", "0", { status: "done" }), t("elsewhere", undefined, "0", { army: "craftworlds" })];
    expect(suggestTasks(tasks, "agents", ["rhino"]).map((x) => x.id)).toEqual(["mine", "wide", "other"]);
  });
});
