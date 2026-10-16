import { describe, expect, it } from "vitest";
import { rowsToTasks, tasksToRows } from "../src/lib/task-rows";
import type { Task } from "../src/lib/tasks";

const tasks: Task[] = [
  { id: "a1", army: "night-goblins", title: "Connect the bases", status: "todo", created: "2026-10-16T01:24:00.000Z" },
  { id: "b2", army: "agents", title: "Glue arms", unit: "ministorum priest", status: "done", created: "2026-10-01T00:00:00.000Z", done: "2026-10-02T00:00:00.000Z" },
];

describe("task rows", () => {
  it("round-trips through the sheet layout", () => {
    expect(rowsToTasks(tasksToRows(tasks))).toEqual(tasks);
  });

  it("writes a header row first", () => {
    expect(tasksToRows([])[0]).toEqual(["id", "army", "title", "unit", "status", "created", "done"]);
  });

  it("reads columns by header name, in any order, and skips notes without an id", () => {
    const rows = [
      ["title", "id", "status", "army"],
      ["Add masking", "c3", "TODO", "harlequins"],
      ["remember to buy glue"],
      ["Prime", "d4", "Done", "agents"],
    ];
    expect(rowsToTasks(rows)).toEqual([
      { id: "c3", army: "harlequins", title: "Add masking", status: "todo", created: "" },
      { id: "d4", army: "agents", title: "Prime", status: "done", created: "" },
    ]);
  });

  it("drops a done date on a task that isn't done", () => {
    const rows = [["id", "title", "status", "done"], ["e5", "Base", "todo", "2026-10-02"]];
    expect(rowsToTasks(rows)[0].done).toBeUndefined();
  });

  it("treats an empty tab as no tasks and a tab without ids as a mistake", () => {
    expect(rowsToTasks([])).toEqual([]);
    expect(() => rowsToTasks([["name", "notes"]])).toThrow(/"id" and "title"/);
  });
});
