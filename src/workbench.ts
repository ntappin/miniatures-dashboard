import { taskRow } from "./army";
import { armySlug } from "./lib/armies";
import { newTask, sortTasks } from "./lib/tasks";
import type { Army, Collection } from "./lib/types";
import { newSession, recentSessions, suggestTasks, workableUnits, type WorkableUnit } from "./lib/worklog";
import type { Store } from "./store";
import { $, el, fmt } from "./ui";

// Which armies I'm working on: a per-browser convenience.
const PICKED_KEY = "miniatures-dashboard:working-on";
function loadPicked(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(PICKED_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
function savePicked(p: Set<string>) {
  try {
    localStorage.setItem(PICKED_KEY, JSON.stringify([...p]));
  } catch {
    /* storage blocked: the choice lasts for this page */
  }
}
const picked = loadPicked();

export interface ArmyWork {
  army: Army;
  slug: string;
  units: WorkableUnit[];
  models: number;
  pts: number;
  openTasks: number;
}

/** Armies with something to work on: in-progress units or open tasks, most models first. */
export function armiesInProgress(data: Collection, store: Store): ArmyWork[] {
  const year = new Date(data.generatedAt).getUTCFullYear();
  return data.armies
    .map((army) => {
      const slug = armySlug(army.army);
      const units = workableUnits(army, data.projects, data.armies, year, store.log);
      return {
        army,
        slug,
        units,
        models: units.reduce((s, u) => s + u.models, 0),
        pts: units.reduce((s, u) => s + u.pts, 0),
        openTasks: store.tasks.filter((t) => t.army === slug && t.status === "todo").length,
      };
    })
    .filter((a) => a.units.length || a.openTasks)
    .sort((a, b) => b.models - a.models || b.openTasks - a.openTasks);
}

const dateLabel = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric" });

// Workbench ------------------------------------------------------------------
export function renderWorkbench(data: Collection, store: Store) {
  const list = armiesInProgress(data, store);
  const maxModels = Math.max(1, ...list.map((a) => a.models));

  // In-progress breakdown, each row a toggle for "working on this"
  const rows = $("wb-armies");
  rows.replaceChildren(
    ...list.map((a) => {
      const id = `wb-pick-${a.slug}`;
      const row = el("label", "wb-army" + (picked.has(a.slug) ? " on" : ""));
      row.htmlFor = id;
      const box = el("input");
      box.type = "checkbox";
      box.id = id;
      box.checked = picked.has(a.slug);
      box.addEventListener("change", () => {
        if (box.checked) picked.add(a.slug);
        else picked.delete(a.slug);
        savePicked(picked);
        renderWorkbench(data, store);
      });
      const name = el("span", "wb-name", a.army.army);
      const bar = el("span", "wb-bar");
      const fill = el("span", "wb-fill");
      fill.style.width = (a.models / maxModels) * 100 + "%";
      bar.append(fill);
      const nums = el("span", "wb-nums");
      nums.append(
        el("b", undefined, fmt(a.models)), document.createTextNode(" models · "),
        document.createTextNode(`${fmt(a.units.length)} ${a.units.length === 1 ? "unit" : "units"} · ${fmt(a.pts)} pts`),
      );
      const tasks = el("span", "wb-tasks", a.openTasks ? `${a.openTasks} open ${a.openTasks === 1 ? "task" : "tasks"}` : "no tasks");
      row.append(box, name, bar, nums, tasks);
      return row;
    }),
  );
  $("wb-armies-empty").hidden = list.length > 0;
  const total = list.reduce((s, a) => s + a.models, 0);
  $("wb-total").textContent = list.length ? `${fmt(total)} models across ${list.length} armies` : "";

  // Upcoming tasks for the picked armies
  const chosen = list.filter((a) => picked.has(a.slug));
  const cols = $("wb-tasks");
  cols.replaceChildren(
    ...chosen.map((a) => {
      const card = el("section", "card wb-col");
      const head = el("div", "ch");
      const link = el("a", "wb-col-name", a.army.army);
      link.href = `#army/${a.slug}`;
      head.append(link, el("span", "note", `${a.openTasks} open`));
      const ul = el("ul", "tasks");
      const open = sortTasks(store.tasks.filter((t) => t.army === a.slug && t.status === "todo"));
      ul.append(...open.map((t) => taskRow(t, store)));
      const form = el("form", "row-form wb-add");
      const input = el("input");
      input.type = "text";
      input.placeholder = "Add a task";
      input.setAttribute("aria-label", `Add a task for ${a.army.army}`);
      input.required = true;
      const add = el("button", "btn", "Add");
      add.type = "submit";
      form.append(input, add);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        const task = newTask(a.slug, text);
        store.apply((ts) => [...ts, task]);
      });
      card.append(head, ul);
      if (!open.length) card.append(el("p", "empty", "No open tasks."));
      card.append(form);
      return card;
    }),
  );
  $("wb-tasks-empty").hidden = chosen.length > 0;

  // Recent work
  const names = new Map(data.armies.map((a) => [armySlug(a.army), a.army]));
  const recent = recentSessions(store.log, 6);
  $("wb-recent").replaceChildren(
    ...recent.map((s) => {
      const li = el("li");
      li.append(
        el("span", "wb-date", dateLabel(s.date)),
        el("span", undefined, `${s.step} · ${names.get(s.army) ?? s.army}${s.units.length ? ` · ${s.units.join(", ")}` : ""}`),
      );
      return li;
    }),
  );
  $("wb-recent-card").hidden = recent.length === 0;
}

// Log work: army → units → task ------------------------------------------------
interface Draft {
  step: 1 | 2 | 3;
  army?: string;
  units: string[];
  extraUnits: string[];
  task?: string; // task id, or "other"
  other: string;
  finish: boolean;
  date: string;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

let draft: Draft = { step: 1, units: [], extraUnits: [], other: "", finish: false, date: today() };

/** Starts a fresh log, preselecting the army when exactly one is picked. */
export function startLog() {
  const only = picked.size === 1 ? [...picked][0] : undefined;
  draft = { step: 1, army: only, units: [], extraUnits: [], other: "", finish: false, date: today() };
}

export function renderLog(data: Collection, store: Store, done: () => void) {
  const list = armiesInProgress(data, store);
  const order = [...list.filter((a) => picked.has(a.slug)), ...list.filter((a) => !picked.has(a.slug))];
  const work = list.find((a) => a.slug === draft.army);
  const body = $("log-body");
  const steps = ["Army", "Units", "Task"];
  $("log-steps").replaceChildren(
    ...steps.map((s, i) => el("li", i + 1 === draft.step ? "now" : i + 1 < draft.step ? "past" : undefined, `${i + 1}. ${s}`)),
  );
  const back = $("log-back") as HTMLButtonElement;
  const next = $("log-next") as HTMLButtonElement;
  back.hidden = draft.step === 1;
  $("log-error").textContent = "";

  const radio = (name: string, value: string, checked: boolean, label: string, meta: string, onPick: () => void) => {
    const id = `${name}-${value}`.replace(/[^a-z0-9-]/gi, "-");
    const row = el("label", "pick" + (checked ? " on" : ""));
    row.htmlFor = id;
    const input = el("input");
    input.type = "radio";
    input.name = name;
    input.id = id;
    input.value = value;
    input.checked = checked;
    input.addEventListener("change", onPick);
    const text = el("span", "pick-text");
    text.append(el("span", "pick-title", label));
    if (meta) text.append(el("span", "pick-meta", meta));
    row.append(input, text);
    return row;
  };

  if (draft.step === 1) {
    $("log-q").textContent = "Which army did you work on?";
    body.replaceChildren(
      ...order.map((a) =>
        radio("log-army", a.slug, draft.army === a.slug, a.army.army, `${fmt(a.models)} models in progress${a.openTasks ? ` · ${a.openTasks} open tasks` : ""}`, () => {
          if (draft.army !== a.slug) draft = { ...draft, army: a.slug, units: [], extraUnits: [], task: undefined };
          renderLog(data, store, done);
        }),
      ),
    );
    if (!order.length) body.append(el("p", "empty", "No armies with work in progress."));
    next.textContent = "Next: units";
    next.disabled = !draft.army;
  }

  if (draft.step === 2 && work) {
    $("log-q").textContent = `Which ${work.army.army} units did you work on?`;
    const all = [...work.units.map((u) => u.unit), ...draft.extraUnits];
    const meta = new Map(work.units.map((u) => [u.unit, u]));
    const boxes = all.map((name) => {
      const id = `log-unit-${name}`.replace(/[^a-z0-9-]/gi, "-");
      const on = draft.units.includes(name);
      const row = el("label", "pick" + (on ? " on" : ""));
      row.htmlFor = id;
      const input = el("input");
      input.type = "checkbox";
      input.id = id;
      input.checked = on;
      input.addEventListener("change", () => {
        draft.units = input.checked ? [...draft.units, name] : draft.units.filter((u) => u !== name);
        renderLog(data, store, done);
      });
      const u = meta.get(name);
      const bits: string[] = [];
      if (u) bits.push(`${fmt(u.models)} ${u.models === 1 ? "model" : "models"}`);
      if (u?.last) bits.push(`last: ${u.last.step} (${dateLabel(u.last.date)})`);
      else if (u?.state) bits.push(u.state);
      if (!u) bits.push("added now");
      const text = el("span", "pick-text");
      text.append(el("span", "pick-title", name), el("span", "pick-meta", bits.join(" · ")));
      row.append(input, text);
      return row;
    });
    const grid = el("div", "pick-grid");
    grid.append(...boxes);
    const addForm = el("form", "row-form");
    const addInput = el("input");
    addInput.type = "text";
    addInput.placeholder = "A unit not listed";
    addInput.setAttribute("aria-label", "Add a unit not listed");
    const addBtn = el("button", "btn", "Add unit");
    addBtn.type = "submit";
    addForm.append(addInput, addBtn);
    addForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = addInput.value.trim();
      if (!name || all.some((n) => n.toLowerCase() === name.toLowerCase())) return;
      draft.extraUnits.push(name);
      draft.units.push(name);
      renderLog(data, store, done);
    });
    body.replaceChildren(grid, addForm);
    if (!all.length) grid.append(el("p", "empty", "No units listed for this army yet. Add one, or continue to log work on the whole army."));
    body.append(el("p", "note", draft.units.length ? `${draft.units.length} selected` : "None selected: the work is logged for the whole army."));
    next.textContent = "Next: task";
    next.disabled = false;
  }

  if (draft.step === 3 && work) {
    $("log-q").textContent = "Which task did you do?";
    const options = suggestTasks(store.tasks, work.slug, draft.units);
    const rows = options.map((t) =>
      radio("log-task", t.id, draft.task === t.id, t.title, t.unit ?? "Whole army", () => {
        draft.task = t.id;
        renderLog(data, store, done);
      }),
    );
    const other = radio("log-task", "other", draft.task === "other", "Something else", "", () => {
      draft.task = "other";
      renderLog(data, store, done);
      ($("log-other") as HTMLInputElement | null)?.focus();
    });
    const otherInput = el("input");
    otherInput.type = "text";
    otherInput.id = "log-other";
    otherInput.placeholder = "What did you do? e.g. glue arms";
    otherInput.value = draft.other;
    otherInput.hidden = draft.task !== "other";
    otherInput.setAttribute("aria-label", "What did you do?");
    otherInput.addEventListener("input", () => {
      draft.other = otherInput.value;
      next.disabled = !otherInput.value.trim();
    });
    other.querySelector(".pick-text")!.append(otherInput);
    const extras = el("div", "log-extras");
    if (draft.task && draft.task !== "other") {
      const id = "log-finish";
      const lab = el("label", "inline");
      lab.htmlFor = id;
      const box = el("input");
      box.type = "checkbox";
      box.id = id;
      box.checked = draft.finish;
      box.addEventListener("change", () => (draft.finish = box.checked));
      lab.append(box, document.createTextNode(" This task is finished: mark it done"));
      extras.append(lab);
    }
    const dateLab = el("label", "inline");
    dateLab.htmlFor = "log-date";
    const date = el("input");
    date.type = "date";
    date.id = "log-date";
    date.value = draft.date;
    date.max = today();
    date.addEventListener("change", () => (draft.date = date.value || today()));
    dateLab.append(document.createTextNode("Date "), date);
    extras.append(dateLab);
    const grid = el("div", "pick-grid one");
    grid.append(...rows, other);
    body.replaceChildren(grid, extras);
    if (!options.length) body.prepend(el("p", "note", "No open tasks for this army; describe what you did."));
    next.textContent = "Save";
    next.disabled = !draft.task || (draft.task === "other" && !draft.other.trim());
  }

  next.onclick = async () => {
    if (draft.step < 3) {
      draft.step = (draft.step + 1) as Draft["step"];
      renderLog(data, store, done);
      return;
    }
    if (!work) return;
    const task = draft.task !== "other" ? store.tasks.find((t) => t.id === draft.task) : undefined;
    const step = task ? task.title : draft.other.trim();
    if (!step) return;
    next.disabled = true;
    next.textContent = "Saving…";
    const entries = newSession(work.slug, draft.units, step, draft.date, task);
    const ok = await store.logWork(entries, task && draft.finish ? task.id : undefined);
    if (ok) {
      const what = draft.units.length ? `${draft.units.length} ${draft.units.length === 1 ? "unit" : "units"}` : work.army.army;
      flash(`Logged "${step}" on ${what}.`);
      startLog();
      done();
    } else {
      next.disabled = false;
      next.textContent = "Save";
      $("log-error").textContent = store.save.kind === "error" ? store.save.message : "Couldn't save. Try again.";
    }
  };
  back.onclick = () => {
    draft.step = (draft.step - 1) as Draft["step"];
    renderLog(data, store, done);
  };
}

export function flash(message: string) {
  const t = $("toast");
  t.textContent = message;
  t.hidden = false;
  clearTimeout(Number(t.dataset.timer));
  t.dataset.timer = String(window.setTimeout(() => (t.hidden = true), 4000));
}
