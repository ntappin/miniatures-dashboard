import "./style.css";
import { bindTaskForm, renderArmy, taskRow } from "./army";
import { currentToken, editingAvailable, signOut } from "./auth";
import { renderDashboard } from "./dashboard";
import { armySlug } from "./lib/armies";
import { sortTasks } from "./lib/tasks";
import type { Army, Collection, TimeLog } from "./lib/types";
import { Store } from "./store";
import { $, el } from "./ui";
import { renderLog, renderWorkbench, startLog } from "./workbench";

const store = new Store();
let data: Collection | undefined;
let current: Army | undefined;
type View = "dashboard" | "work" | "log" | "army";
let view: View = "dashboard";

/**
 * Routes: #army/<slug>, and when signed in #work (the workbench) and #log.
 * Signed in, an empty hash opens the workbench; signed out it's the dashboard.
 */
function route() {
  if (!data) return;
  const hash = location.hash;
  const m = hash.match(/^#army\/([a-z0-9-]+)$/);
  current = m ? data.armies.find((a) => armySlug(a.army) === m[1]) : undefined;
  const editing = store.canEdit;
  if (current) view = "army";
  else if (editing && hash === "#log") view = "log";
  else if (editing && hash === "#work") view = "work";
  else view = "dashboard";

  for (const v of ["dashboard", "work", "log", "army"] as View[]) $(`view-${v}`).hidden = v !== view;
  $("nav-work").classList.toggle("on", view === "work" || view === "log");
  $("nav-dash").classList.toggle("on", view === "dashboard");
  $("nav-dash").setAttribute("href", "#dashboard");

  if (view === "log") startLog();
  draw();
  window.scrollTo(0, 0);
  document.title = current ? `${current.army} · Miniatures Collection` : view === "dashboard" ? "Miniatures Collection" : "Workbench · Miniatures Collection";
}

function draw() {
  if (!data) return;
  if (view === "army" && current) renderArmy(current, data, store);
  if (view === "work") renderWorkbench(data, store);
  if (view === "log") renderLog(data, store, () => (location.hash = "work"));
  renderNextUp();
  renderSave();
}

const openArmy = (a: Army) => {
  location.hash = `army/${armySlug(a.army)}`;
};

// "Next up": open tasks across every army, on the dashboard.
function renderNextUp() {
  if (!data) return;
  const names = new Map(data.armies.map((a) => [armySlug(a.army), a.army]));
  const open = sortTasks(store.tasks).filter((t) => t.status === "todo");
  $("next-tasks").replaceChildren(
    ...open.slice(0, 8).map((t) => {
      const li = taskRow(t, store, names.get(t.army) ?? t.army);
      const go = el("a", "task-go", "Open");
      go.href = `#army/${t.army}`;
      go.setAttribute("aria-label", `Open ${names.get(t.army) ?? t.army}`);
      li.insertBefore(go, li.querySelector(".task-del"));
      return li;
    }),
  );
  $("next-empty").hidden = open.length > 0;
  $("next-empty").textContent = store.canEdit ? "No open tasks. Open an army to add one." : "No open tasks right now.";
  $("next-more").textContent = open.length > 8 ? `+${open.length - 8} more on the army pages` : "";
}

// Sign-in and save status. Signed out the site is read-only.
function renderSave() {
  const s = store.save;
  const status = $("save-status");
  const btn = $("signin-btn");
  btn.hidden = !editingAvailable;
  btn.textContent = store.canEdit ? "Sign out" : "Sign in to edit";
  status.className = "save-status " + s.kind;
  status.textContent =
    s.kind === "public" ? "" :
    s.kind === "saving" ? "Saving…" :
    s.kind === "saved" ? "Saved to the sheet" : s.message;
  document.body.classList.toggle("editing", store.canEdit);
}

async function beginEditing() {
  $("save-status").textContent = "Signing in…";
  if (await store.startEditing()) {
    if (!location.hash || location.hash === "#" || location.hash === "#dashboard") location.hash = "work";
    else route();
  }
}

function bindSignIn() {
  $("signin-btn").addEventListener("click", async () => {
    if (!store.canEdit) await beginEditing();
    else {
      signOut();
      store.stopEditing();
      if (view === "work" || view === "log") location.hash = "";
      else route();
    }
  });
}

async function load() {
  const base = import.meta.env.BASE_URL;
  try {
    const [collection, logs] = await Promise.all([
      fetch(`${base}data/collection.json`).then((r) => (r.ok ? (r.json() as Promise<Collection>) : Promise.reject(new Error(`collection.json: ${r.status}`)))),
      fetch(`${base}data/time-logs.json`).then((r) => (r.ok ? (r.json() as Promise<TimeLog[]>) : [])),
    ]);
    data = collection;
    renderDashboard(data, logs, openArmy);
  } catch (err) {
    const box = el("div", "error", `Couldn't load the collection data (${(err as Error).message}). Try reloading the page.`);
    document.querySelector(".grid")?.replaceWith(box);
    return;
  }
  bindSignIn();
  bindTaskForm(store, () => current);
  await store.load(base);
  store.onChange(draw);
  window.addEventListener("hashchange", route);
  route();
  // Still signed in from earlier in this tab: go straight back to editing.
  if (editingAvailable && currentToken()) await beginEditing();
}

load();
