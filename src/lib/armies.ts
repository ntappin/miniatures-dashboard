import type { Army, Project } from "./types";

/** URL-safe id for an army, used in links like #army/night-goblins. */
export const armySlug = (name: string) =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * The "11th" tab and the "in progress" tab name armies differently
 * ("Agents" vs "imperial agents", "custodes" vs "stormtoads").
 * Keys are army slugs; values are the faction names used on the in progress tab.
 */
const ALIASES: Record<string, string[]> = {
  craftworlds: ["craftworld", "craftworlds"],
  harlequins: ["harlequin", "harlequins"],
  drukhari: ["drukhari", "dark eldar"],
  "first-born-night-lords": ["night lords", "nightlords", "first born night lords"],
  "mystical-mechanicus": ["mystical mechanicus", "mechanicus"],
  "heresy-imperial-knights": ["knights", "imperial knights", "heresy imperial knights"],
  custodes: ["custodes", "stormtoads"],
  agents: ["agents", "imperial agents"],
  "night-goblins": ["night goblins", "night gobbos", "night goblin"],
  votann: ["votann"],
};

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** The army a unit row belongs to, or undefined when its faction isn't one of the armies (e.g. Tau). */
export function armyForFaction(faction: string, armies: Army[]): Army | undefined {
  const f = norm(faction);
  for (const a of armies) {
    const slug = armySlug(a.army);
    const names = ALIASES[slug] ?? [];
    if (names.includes(f) || norm(a.army) === f || norm(a.army).replace(/s$/, "") === f) return a;
  }
  return undefined;
}

export function projectsForArmy(army: Army, projects: Project[], armies: Army[]): Project[] {
  return projects.filter((p) => armyForFaction(p.faction, armies) === army);
}
