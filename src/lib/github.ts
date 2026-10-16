import type { Task, TaskChange } from "./tasks";

/**
 * Tasks are saved as public/data/tasks.json in the repo, through the GitHub API,
 * using a fine-grained personal access token kept only in this browser.
 */
const REPO = "ntappin/miniatures-dashboard";
const PATH = "public/data/tasks.json";
const API = `https://api.github.com/repos/${REPO}/contents/${PATH}`;
const TOKEN_KEY = "miniatures-dashboard:github-token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token.trim());
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage blocked: the token lasts for this page only */
  }
}

const headers = (token: string) => ({
  authorization: `Bearer ${token}`,
  accept: "application/vnd.github+json",
  "x-github-api-version": "2022-11-28",
});

const decode = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, "")), (c) => c.charCodeAt(0)));
const encode = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};

export class SaveError extends Error {}

function explain(status: number, fallback: string): string {
  if (status === 401) return "GitHub didn't accept the token. It may have expired; connect again with a new one.";
  if (status === 403 || status === 404)
    return "The token can't write to the repo. It needs access to miniatures-dashboard with Contents set to Read and write.";
  return fallback;
}

/** Reads the current task list and its version straight from the repo. */
export async function loadRemote(token: string): Promise<{ tasks: Task[]; sha: string | null }> {
  const res = await fetch(`${API}?ref=main`, { headers: headers(token), cache: "no-store" });
  if (res.status === 404) return { tasks: [], sha: null };
  if (!res.ok) throw new SaveError(explain(res.status, `Couldn't read tasks from GitHub (${res.status}).`));
  const body = (await res.json()) as { content: string; sha: string };
  return { tasks: JSON.parse(decode(body.content)) as Task[], sha: body.sha };
}

/**
 * Applies `change` to the latest saved tasks and commits the result.
 * If someone else saved in between, re-reads and applies the change again once.
 */
export async function saveChange(token: string, change: TaskChange, message: string): Promise<Task[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { tasks, sha } = await loadRemote(token);
    const next = change(tasks);
    const res = await fetch(API, {
      method: "PUT",
      headers: headers(token),
      body: JSON.stringify({
        message,
        content: encode(JSON.stringify(next, null, 2) + "\n"),
        branch: "main",
        ...(sha ? { sha } : {}),
      }),
    });
    if (res.ok) return next;
    if (res.status !== 409 && res.status !== 422) throw new SaveError(explain(res.status, `Couldn't save to GitHub (${res.status}).`));
  }
  throw new SaveError("The task list changed on another device while saving. Reload the page and try again.");
}
