import "./style.css";
import { bindTaskForm, renderArmy, taskRow } from "./army";
import { renderDashboard } from "./dashboard";
import { armySlug } from "./lib/armies";
import { getToken, setToken } from "./lib/github";
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
      li.insertBefore(go, li.lastChild);
      return li;
    }),
  );
  $("next-empty").hidden = open.length > 0;
  $("next-more").textContent = open.length > 8 ? `+${open.length - 8} more on the army pages` : "";
}

// Save status and the connect panel.
function renderSave() {
  const s = store.save;
  const status = $("save-status");
  status.className = "save-status " + s.kind;
  status.textContent =
    s.kind === "local" ? "Not saving: changes stay on this page" :
    s.kind === "saving" ? "Saving…" :
    s.kind === "saved" ? "Saved to GitHub" : s.message;
  $("connect-btn").textContent = store.connected ? "Disconnect" : "Connect to save";
}

function bindConnect() {
  const panel = $("connect-panel");
  const input = $("token-input") as HTMLInputElement;
  $("connect-btn").addEventListener("click", () => {
    if (store.connected) {
      setToken(null);
      store.save = { kind: "local" };
      renderSave();
      return;
    }
    panel.hidden = !panel.hidden;
    if (!panel.hidden) input.focus();
  });
  $("connect-cancel").addEventListener("click", () => {
    panel.hidden = true;
  });
  ($("connect-form") as HTMLFormElement).addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!input.value.trim()) return;
    setToken(input.value);
    input.value = "";
    panel.hidden = true;
    await store.refresh();
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
  bindConnect();
  bindTaskForm(store, () => current);
  store.onChange(rerender);
  window.addEventListener("hashchange", route);
  route();
  renderSave();
  if (getToken()) $("save-status").textContent = "Loading tasks…";
  await store.load(base);
}

load();
