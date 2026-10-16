import { armySlug, projectsForArmy } from "./lib/armies";
import { newTask, removeTask, sortTasks, toggleTask, type Task } from "./lib/tasks";
import type { Army, Collection, Project } from "./lib/types";
import type { TaskStore } from "./store";
import { $, el, fmt, pct } from "./ui";

/** Units for an army: backlog first, then this year's, then earlier years. */
function orderUnits(units: Project[], year: number): Project[] {
  const rank = (p: Project) => (p.year === null ? 0 : p.year === year ? 1 : 2);
  return [...units].sort((a, b) => rank(a) - rank(b) || (b.year ?? 0) - (a.year ?? 0) || a.unit.localeCompare(b.unit));
}

export function taskRow(t: Task, store: TaskStore, armyName?: string): HTMLLIElement {
  const li = el("li", "task" + (t.status === "done" ? " done" : ""));
  const id = `task-${t.id}`;
  const box = el("input");
  box.type = "checkbox";
  box.id = id;
  box.checked = t.status === "done";
  box.disabled = !store.canEdit;
  box.addEventListener("change", () => store.apply((ts) => toggleTask(ts, t.id)));
  const label = el("label");
  label.htmlFor = id;
  label.append(el("span", "task-title", t.title));
  const meta: string[] = [];
  if (armyName) meta.push(armyName);
  if (t.unit) meta.push(t.unit);
  if (t.status === "done" && t.done) meta.push("done " + new Date(t.done).toLocaleDateString("en-CA", { month: "short", day: "numeric" }));
  if (meta.length) label.append(el("span", "task-meta", meta.join(" · ")));
  li.append(box, label);
  if (store.canEdit) {
    const del = el("button", "task-del", "Delete");
    del.type = "button";
    del.setAttribute("aria-label", `Delete task: ${t.title}`);
    del.addEventListener("click", () => store.apply((ts) => removeTask(ts, t.id)));
    li.append(del);
  }
  return li;
}

export function renderArmy(army: Army, data: Collection, store: TaskStore) {
  const slug = armySlug(army.army);
  const year = new Date(data.generatedAt).getUTCFullYear();
  const units = orderUnits(projectsForArmy(army, data.projects, data.armies), year);
  const backlog = units.filter((u) => u.year === null);

  document.title = `${army.army} · Miniatures Collection`;
  $("army-name").textContent = army.army;
  $("army-sub").textContent = `${army.group} · ${army.source || "source not noted"}`;
  $("a-models").textContent = fmt(army.models);
  $("a-total").textContent = fmt(army.totalPts);
  $("a-painted").textContent = fmt(army.paintedPts);
  $("a-unpainted").textContent = fmt(army.unpaintedPts);
  $("a-share").textContent = pct(army.totalPts ? army.paintedPts / army.totalPts : 0);
  $("a-backlog").textContent = backlog.length ? `${fmt(backlog.length)} units · ${fmt(backlog.reduce((s, u) => s + u.models, 0))} models` : "—";

  // Unit picker for new tasks
  const pick = $("task-unit") as HTMLSelectElement;
  const current = pick.value;
  pick.replaceChildren(new Option("No specific unit", ""));
  for (const u of units.filter((u) => u.year === null || u.year === year)) pick.append(new Option(u.unit, u.unit));
  pick.value = [...pick.options].some((o) => o.value === current) ? current : "";

  // Tasks
  const list = $("army-tasks");
  const mine = sortTasks(store.tasks.filter((t) => t.army === slug));
  list.replaceChildren(...mine.map((t) => taskRow(t, store)));
  const open = mine.filter((t) => t.status === "todo").length;
  $("army-task-count").textContent = mine.length ? `${open} to do · ${mine.length - open} done` : "";
  $("army-tasks-empty").hidden = mine.length > 0;
  $("army-tasks-empty").textContent = store.canEdit ? "No tasks yet. Add the next step above." : "No tasks for this army right now.";
  $("task-form").hidden = !store.canEdit;

  // Units table
  const body = document.querySelector("#army-units tbody")!;
  $("army-units-empty").hidden = units.length > 0;
  $("army-units-wrap").hidden = units.length === 0;
  body.replaceChildren(
    ...units.map((u) => {
      const tr = el("tr");
      const when = u.year === null ? "In progress" : String(u.year);
      const pill = el("span", "pill " + (u.year === null ? "pill-prog" : u.year === year ? "pill-year" : "pill-old"), when);
      const unitCell = el("td");
      if (store.canEdit) {
        const btn = el("button", "unit-link", u.unit);
        btn.type = "button";
        btn.title = "Add a task for this unit";
        btn.addEventListener("click", () => {
          if (![...pick.options].some((o) => o.value === u.unit)) pick.append(new Option(u.unit, u.unit));
          pick.value = u.unit;
          ($("task-title") as HTMLInputElement).focus();
        });
        unitCell.append(btn);
      } else unitCell.textContent = u.unit;
      const whenCell = el("td");
      whenCell.append(pill);
      tr.append(unitCell, el("td", undefined, u.state || "—"), el("td", undefined, u.pts ? fmt(u.pts) : "—"), el("td", undefined, fmt(u.models)), whenCell);
      return tr;
    }),
  );
}

/** Wires the add-task form once; it always adds to whichever army is showing. */
export function bindTaskForm(store: TaskStore, currentArmy: () => Army | undefined) {
  const form = $("task-form") as HTMLFormElement;
  const title = $("task-title") as HTMLInputElement;
  const unit = $("task-unit") as HTMLSelectElement;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const army = currentArmy();
    const text = title.value.trim();
    if (!army || !text) return;
    const task = newTask(armySlug(army.army), text, unit.value || undefined);
    store.apply((ts) => [...ts, task]);
    title.value = "";
    title.focus();
  });
}
