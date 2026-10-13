/**
 * Reads the toy list Google Sheet and writes public/data/collection.json.
 *
 * Needs two environment variables:
 *   SHEET_ID                     the spreadsheet id from its URL
 *   GOOGLE_SERVICE_ACCOUNT_JSON  the service account's JSON key (the whole file's contents)
 * The sheet must be shared (view access) with the service account's email.
 *
 * With either missing it leaves the committed data alone and exits cleanly,
 * so the site still builds from the last saved copy.
 */
import { createSign } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArmies, parseProjects, type Grid } from "../src/lib/parse";
import type { Collection } from "../src/lib/types";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../public/data/collection.json");
const TABS = { armies: "'11th'!A1:H80", projects: "'in progress'!A1:H500" };

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");

async function accessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(sa.private_key, "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  const body = (await res.json()) as { access_token?: string; error_description?: string };
  if (!res.ok || !body.access_token) throw new Error(`Google sign-in failed: ${body.error_description ?? res.status}`);
  return body.access_token;
}

async function readTabs(sheetId: string, token: string): Promise<Record<keyof typeof TABS, Grid>> {
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet`);
  for (const range of Object.values(TABS)) url.searchParams.append("ranges", range);
  url.searchParams.set("valueRenderOption", "UNFORMATTED_VALUE");
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  const body = (await res.json()) as { valueRanges?: { values?: unknown[][] }[]; error?: { message: string } };
  if (!res.ok || !body.valueRanges) {
    const hint = res.status === 403 ? " (is the sheet shared with the service account's email?)" : "";
    throw new Error(`Reading the sheet failed: ${body.error?.message ?? res.status}${hint}`);
  }
  const toGrid = (v?: unknown[][]): Grid => (v ?? []).map((r) => r.map((c) => (c ?? "").toString()));
  const [armies, projects] = body.valueRanges.map((r) => toGrid(r.values));
  return { armies, projects };
}

async function main() {
  const sheetId = process.env.SHEET_ID;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!sheetId || !key) {
    console.log("SHEET_ID or GOOGLE_SERVICE_ACCOUNT_JSON not set; keeping the saved data.");
    return;
  }
  const token = await accessToken(JSON.parse(key) as ServiceAccount);
  const tabs = await readTabs(sheetId, token);
  const data: Collection = {
    generatedAt: new Date().toISOString(),
    origin: "sheet",
    armies: parseArmies(tabs.armies),
    projects: parseProjects(tabs.projects),
  };
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(data, null, 2) + "\n");
  console.log(`Synced ${data.armies.length} armies and ${data.projects.length} units from the sheet.`);
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
