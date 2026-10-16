import "./style.css";
import { bindTaskForm, renderArmy, taskRow } from "./army";
import { renderDashboard } from "./dashboard";
import { armySlug } from "./lib/armies";
import { editingAvailable, signOut } from "./auth";
import { sortTasks } from "./lib/tasks";
import type { Army, Collection, TimeLog } from "./lib/types";
import { TaskStore } from "./store";
import { $, el } from "./ui";

const store = new TaskStore();
let data: Collection | undefined;
let current: Army | undefined;

// Routing: #army/<slug> shows an army; anything else shows the dashboard.
const armyFromHash = () => {
  const m = location.hash.match(/^#army\/([a-z0-9-]+)$/);
  return m && data ? data.armies.find((a) => armySlug(a.army) === m[1]) : undefined;
};

function route() {
  if (!data) return;
  current = armyFromHash();
  $("view-dashboard").hidden = !!current;
  $("view-army").hidden = !current;
  if (current) {
    renderArmy(current, data, store);
    window.scrollTo(0, 0);
  } else {
    document.title = "Miniatures Collection";
  }
}

const openArmy = (a: Army) => {
  location.hash = `army/${armySlug(a.army)}`;
};

// "Next up": open tasks across every army, on the dashboard.
function renderNextUp() {
  if (!data) return;
  const names = new Map(data.armies.map((a) => [armySlug(a.army), a.army]));
  const open = sortTasks(store.tasks).filter((t) => t.status === "todo");
  const list = $("next-tasks");
  list.replaceChildren(
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
    s.kind === "saved" ? "Editing · saved to the sheet" : s.message;
  document.body.classList.toggle("editing", store.canEdit);
}

function bindSignIn() {
  $("signin-btn").addEventListener("click", async () => {
    if (!store.canEdit) {
      $("save-status").textContent = "Signing in…";
      await store.startEditing();
    } else {
      signOut();
      store.stopEditing();
    }
  });
}

function rerender() {
  renderNextUp();
  renderSave();
  if (current && data) renderArmy(current, data, store);
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
  store.onChange(rerender);
  window.addEventListener("hashchange", route);
  route();
  renderSave();
  await store.load(base);
}

load();
