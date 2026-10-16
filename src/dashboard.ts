import type { Army, Collection, TimeLog } from "./lib/types";
import {
  biggestPile,
  collectionTotals,
  fullYearPace,
  hoursPerModel,
  minutesPerModel,
  outputByYear,
  yearVsBacklog,
  type FactionProgress,
} from "./lib/stats";
import { $, el, fmt, one, pair, pct, tooltip, type Measure } from "./ui";

// Charts -------------------------------------------------------------------
function drawArmies(armies: Army[], m: Measure, tip: ReturnType<typeof tooltip>, onArmy: (a: Army) => void) {
  const pts = m === "pts";
  const key = (a: Army) => (pts ? a.totalPts : a.models);
  $("army-title").textContent = pts ? "Painted vs unpainted by army" : "Models by army";
  $("army-note").textContent = pts
    ? "Points per army, largest first. Click an army for its units and tasks."
    : "Model count per army. Click an army for its units and tasks.";
  $("army-legend").hidden = !pts;
  const rows = [...armies].sort((a, b) => key(b) - key(a));
  const max = Math.max(1, ...rows.map(key));
  const wrap = $("army-bars");
  wrap.replaceChildren();
  for (const a of rows) {
    const bar = el("div", "bar link");
    bar.tabIndex = 0;
    bar.setAttribute("role", "link");
    bar.setAttribute("aria-label", `Open ${a.army}`);
    bar.addEventListener("click", () => onArmy(a));
    bar.addEventListener("keydown", (e) => { if (e.key === "Enter") onArmy(a); });
    const track = el("div", "track");
    const fill = el("div", "fill");
    fill.style.width = (key(a) / max) * 70 + "%";
    if (pts) {
      const p = el("span");
      p.style.background = "var(--painted)";
      p.style.flex = `${a.paintedPts} 0 0`;
      const u = el("span");
      u.style.background = "var(--unpainted)";
      u.style.flex = `${a.unpaintedPts} 0 0`;
      fill.append(p, u);
    } else {
      const s = el("span");
      s.style.background = "var(--knight)";
      s.style.flex = "1 0 0";
      fill.append(s);
    }
    track.append(fill, el("span", "num", fmt(key(a)) + (pts ? "" : " models")));
    bar.append(el("div", "n", a.army), track);
    bar.addEventListener("mousemove", (e) =>
      tip.show(e, `${a.army} · ${a.group}`, [
        ["var(--painted)", `Painted ${fmt(a.paintedPts)} pts`],
        ["var(--unpainted)", `Unpainted ${fmt(a.unpaintedPts)} pts`],
        [null, `${pct(a.totalPts ? a.paintedPts / a.totalPts : 0)} painted · ${fmt(a.models)} models`],
      ]),
    );
    bar.addEventListener("mouseleave", () => tip.hide());
    wrap.append(bar);
  }
}

function drawYearVsBacklog(rows: FactionProgress[], m: Measure, year: number, tip: ReturnType<typeof tooltip>) {
  const done = (r: FactionProgress) => (m === "pts" ? r.donePts : r.doneModels);
  const left = (r: FactionProgress) => (m === "pts" ? r.backlogPts : r.backlogModels);
  const unit = m === "pts" ? " pts" : " models";
  const sorted = [...rows].sort((a, b) => done(b) + left(b) - (done(a) + left(a)));
  const max = Math.max(1, ...sorted.map((r) => Math.max(done(r), left(r))));
  const wrap = $("cmp-bars");
  wrap.replaceChildren();
  if (!sorted.length) {
    wrap.append(el("div", "empty", "Nothing logged for this year or the backlog yet."));
    return;
  }
  const line = (v: number, color: string) => {
    const row = el("div", "track");
    const fill = el("div", "fill");
    fill.style.width = (v / max) * 72 + "%";
    fill.style.background = v ? color : "transparent";
    row.append(fill, el("span", "num", fmt(v)));
    return row;
  };
  for (const r of sorted) {
    const bar = el("div", "bar pair");
    const stack = el("div", "stack");
    stack.append(line(done(r), "var(--painted)"), line(left(r), "var(--progress)"));
    bar.append(el("div", "n", r.faction), stack);
    bar.addEventListener("mousemove", (e) =>
      tip.show(
        e,
        r.faction,
        [
          ["var(--painted)", `Worked on in ${year}: ${fmt(done(r))}${unit}`],
          ["var(--progress)", `In progress: ${fmt(left(r))}${unit}`],
        ],
        (t) => {
          if (!r.units.length) return;
          t.append(el("div", "t", `${year} units`));
          for (const u of r.units) t.append(el("div", undefined, u.state ? `${u.unit} — ${u.state}` : u.unit));
        },
      ),
    );
    bar.addEventListener("mouseleave", () => tip.hide());
    wrap.append(bar);
  }
}

function drawYears(data: Collection, m: Measure) {
  const asOf = new Date(data.generatedAt);
  const thisYear = asOf.getUTCFullYear();
  const box = $("years");
  box.replaceChildren();
  const years = outputByYear(data.projects);
  if (!years.length) {
    box.append(el("div", "empty", "No finished years in the data yet."));
    return;
  }
  const value = (y: { pts: number; models: number }) => (m === "pts" ? y.pts : y.models);
  const projected = (y: { year: number; pts: number; models: number }) =>
    y.year === thisYear ? Math.round(fullYearPace(value(y), asOf)) : value(y);
  const max = Math.max(1, ...years.map(projected));
  const h = box.clientHeight - 36;
  for (const y of years) {
    const actual = value(y);
    const proj = projected(y);
    const col = el("div", "yc");
    col.append(el("div", "v", fmt(actual) + (proj > actual ? ` → ${fmt(proj)}` : "")));
    const stack = el("div", "col");
    if (proj > actual) {
      const ghost = el("div", "proj");
      ghost.style.height = ((proj - actual) / max) * h + "px";
      stack.append(ghost);
    }
    const bar = el("div", "act" + (proj > actual ? " base" : ""));
    bar.style.height = Math.max(1, (actual / max) * h) + "px";
    stack.append(bar);
    col.append(stack, el("div", "y", String(y.year)));
    box.append(col);
  }
}

// Page ---------------------------------------------------------------------
export function renderDashboard(data: Collection, logs: TimeLog[], onArmy: (a: Army) => void) {
  const asOf = new Date(data.generatedAt);
  const year = asOf.getUTCFullYear();
  const dateText = asOf.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
  $("asof").textContent = data.origin === "sheet" ? `Synced from the toy list sheet ${dateText}` : `Saved copy of the toy list sheet, ${dateText}`;
  $("foot").textContent = "Data comes from the toy list Google Sheet and refreshes every 30 minutes.";

  const backlog = data.projects.filter((p) => p.year === null);
  if (data.origin === "snapshot" && !backlog.length) {
    const b = $("banner");
    b.hidden = false;
    b.append(el("b", undefined, "Partial data. "), document.createTextNode("The backlog and earlier years appear after the first sync from the sheet."));
  }

  // Header and tiles
  const t = collectionTotals(data.armies);
  const pile = biggestPile(data.armies);
  $("k-share").textContent = pct(t.paintedShare);
  $("k-pile").textContent = pile ? `${pile.army} (${fmt(pile.unpaintedPts)} pts)` : "—";
  $("t-models").textContent = fmt(t.models);
  $("t-total").textContent = fmt(t.totalPts);
  $("t-painted").textContent = fmt(t.paintedPts);
  $("t-unpainted").textContent = fmt(t.unpaintedPts);
  $("t-share").textContent = pct(t.paintedShare);

  // This year vs backlog
  const progress = yearVsBacklog(data.projects, year);
  const done = { pts: 0, models: 0 };
  const left = { pts: 0, models: 0 };
  for (const r of progress) {
    done.pts += r.donePts;
    done.models += r.doneModels;
    left.pts += r.backlogPts;
    left.models += r.backlogModels;
  }
  $("t-umodels").textContent = backlog.length ? fmt(left.models) : "—";
  $("cmp-title").textContent = `Worked on in ${year} vs still in progress`;
  $("f-done-label").textContent = `Worked on in ${year}`;
  pair($("f-done"), fmt(done.pts), "pts", fmt(done.models), "models");
  pair($("f-prog"), fmt(left.pts), "pts", fmt(left.models), "models");
  if (backlog.length && done.pts && done.models) pair($("f-ratio"), one(left.pts / done.pts) + "×", "pts", one(left.models / done.models) + "×", "models");

  // Pace and backlog
  const pacePts = Math.round(fullYearPace(done.pts, asOf));
  const paceModels = Math.round(fullYearPace(done.models, asOf));
  const pace = $("pace");
  pace.replaceChildren(
    document.createTextNode(`${year} is on pace for `), el("b", undefined, fmt(pacePts)), document.createTextNode(" pts / "),
    el("b", undefined, fmt(paceModels)), document.createTextNode(" models."),
  );
  if (backlog.length && pacePts && paceModels) {
    pace.append(
      document.createTextNode(" At that pace the backlog takes "), el("b", undefined, one(left.pts / pacePts)),
      document.createTextNode(" yrs by points, "), el("b", undefined, one(left.models / paceModels)), document.createTextNode(" by models."),
    );
  }

  // Time per model
  minutes($("s-inf"), hoursPerModel(logs.filter((l) => l.kind === "infantry")) * 60, "min/model");
  minutes($("s-kn"), hoursPerModel(logs.filter((l) => l.kind === "knight")), "h/model");
  minutes($("s-all"), hoursPerModel(logs) * 60, "min/model");
  const body = document.querySelector("#tpm tbody")!;
  const sorted = [...logs].sort((a, b) => minutesPerModel(a) - minutesPerModel(b));
  const maxMin = Math.max(1, ...sorted.map(minutesPerModel));
  body.replaceChildren(
    ...sorted.map((l) => {
      const tr = el("tr");
      tr.title = l.source;
      const mpm = el("td", undefined, one(minutesPerModel(l)));
      const bar = el("span", "tbar");
      bar.style.width = (minutesPerModel(l) / maxMin) * 3 + "rem";
      bar.style.background = l.kind === "knight" ? "var(--knight)" : "var(--painted)";
      mpm.append(bar);
      tr.append(el("td", undefined, l.project), el("td", "hn", l.when), el("td", undefined, fmt(l.models)), el("td", undefined, fmt(l.hours)), mpm);
      return tr;
    }),
  );

  // Charts and their Models/Points switches
  const state: Record<string, Measure> = { army: "models", cmp: "models", years: "models" };
  const armyTip = tooltip($("by-army"));
  const cmpTip = tooltip($("this-year"));
  const draw: Record<string, () => void> = {
    army: () => drawArmies(data.armies, state.army, armyTip, onArmy),
    cmp: () => drawYearVsBacklog(progress, state.cmp, year, cmpTip),
    years: () => drawYears(data, state.years),
  };
  document.querySelectorAll<HTMLElement>(".seg").forEach((group) =>
    group.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest("button");
      const k = group.dataset.for;
      if (!btn || !k) return;
      state[k] = btn.dataset.m as Measure;
      group.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      draw[k]();
    }),
  );
  Object.values(draw).forEach((d) => d());
  let resize: number | undefined;
  window.addEventListener("resize", () => {
    clearTimeout(resize);
    resize = window.setTimeout(draw.years, 120);
  });
}

function minutes(target: HTMLElement, v: number, unit: string) {
  target.replaceChildren(document.createTextNode(v ? one(v) + " " : "— "), el("small", undefined, unit));
}

