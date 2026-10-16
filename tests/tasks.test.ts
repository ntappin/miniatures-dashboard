import { describe, expect, it } from "vitest";
import { armyForFaction, armySlug } from "../src/lib/armies";
import { newTask, removeTask, sortTasks, toggleTask } from "../src/lib/tasks";
import type { Army } from "../src/lib/types";

const army = (name: string): Army => ({ group: "", army: name, totalPts: 0, paintedPts: 0, unpaintedPts: 0, models: 0, source: "" });
const armies = ["craftworlds", "Harlequins", "Agents", "Night Goblins", "custodes", "heresy imperial knights"].map(army);

describe("armySlug", () => {
  it("makes link-safe ids", () => {
    expect(armySlug("Night Goblins")).toBe("night-goblins");
    expect(armySlug("First Born night lords")).toBe("first-born-night-lords");
  });
});

describe("armyForFaction", () => {
  it("matches the in progress tab's faction names to armies on the 11th tab", () => {
    expect(armyForFaction("imperial agents", armies)?.army).toBe("Agents");
    expect(armyForFaction("Harlequin", armies)?.army).toBe("Harlequins");
    expect(armyForFaction("craftworld", armies)?.army).toBe("craftworlds");
    expect(armyForFaction("stormtoads", armies)?.army).toBe("custodes");
    expect(armyForFaction("Knights", armies)?.army).toBe("heresy imperial knights");
    expect(armyForFaction("night goblins", armies)?.army).toBe("Night Goblins");
  });

  it("leaves factions with no army row unmatched", () => {
    expect(armyForFaction("tau", armies)).toBeUndefined();
  });
});

describe("tasks", () => {
  const t0 = new Date("2026-10-15T10:00:00Z");
  const a = newTask("night-goblins", "  Connect bases ", undefined, t0);
  const b = newTask("harlequins", "Add masking", "Voidweaver", new Date("2026-10-15T11:00:00Z"));

  it("trims titles and starts as to do", () => {
    expect(a).toMatchObject({ army: "night-goblins", title: "Connect bases", status: "todo" });
    expect(a.unit).toBeUndefined();
    expect(b.unit).toBe("Voidweaver");
  });

  it("marks done with a date and back to to do without one", () => {
    const done = toggleTask([a], a.id, new Date("2026-10-16T09:00:00Z"));
    expect(done[0]).toMatchObject({ status: "done", done: "2026-10-16T09:00:00.000Z" });
    const undone = toggleTask(done, a.id);
    expect(undone[0].status).toBe("todo");
    expect(undone[0].done).toBeUndefined();
  });

  it("lists open tasks oldest first, then finished ones newest first", () => {
    const c = { ...newTask("agents", "Glue arms", undefined, new Date("2026-10-01T00:00:00Z")), status: "done" as const, done: "2026-10-02T00:00:00Z" };
    const d = { ...newTask("agents", "Prime", undefined, new Date("2026-10-01T00:00:00Z")), status: "done" as const, done: "2026-10-05T00:00:00Z" };
    expect(sortTasks([c, b, d, a]).map((t) => t.title)).toEqual(["Connect bases", "Add masking", "Prime", "Glue arms"]);
  });

  it("removes by id", () => {
    expect(removeTask([a, b], a.id)).toEqual([b]);
  });
});

describe("completeTask", () => {
  it("finishes an open task and leaves a finished one alone", async () => {
    const { completeTask } = await import("../src/lib/tasks");
    const open = newTask("agents", "Prime", undefined, new Date("2026-10-01T00:00:00Z"));
    const done = completeTask([open], open.id, new Date("2026-10-02T00:00:00Z"));
    expect(done[0]).toMatchObject({ status: "done", done: "2026-10-02T00:00:00.000Z" });
    expect(completeTask(done, open.id, new Date("2026-10-09T00:00:00Z"))[0].done).toBe("2026-10-02T00:00:00.000Z");
  });
});
