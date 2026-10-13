# Miniatures dashboard

A dashboard for my miniatures collection and painting backlog: painted vs unpainted by army, what I've worked on this year against what's still in progress, output by year, and how long models take to paint.

Live at **https://ntappin.github.io/miniatures-dashboard/**

## Where the data comes from

For now the data lives in my "toy list" Google Sheet, and I keep editing it there. Once a day (and on every push), a GitHub Action reads the sheet, writes `public/data/collection.json`, builds the site and publishes it to GitHub Pages.

| Sheet tab | What's read |
|---|---|
| `11th` | The faction table: points total / painted / unpainted, model count and source per army |
| `in progress` | Every unit row: year, faction, unit, state, points, models. A blank year means it's in the backlog |

Time-per-model figures come from `public/data/time-logs.json`. The hours were gathered by hand from logs scattered across several tabs, so they're kept in the repo rather than synced.

The sync only reads those two tabs. Nothing else in the sheet ends up in the repo or on the site.

### Setting up the sheet sync (one time)

1. In [Google Cloud console](https://console.cloud.google.com/), create a project (or pick one), then enable the **Google Sheets API** for it.
2. Under **IAM & Admin → Service accounts**, create a service account. No roles are needed.
3. On the service account, open **Keys → Add key → Create new key → JSON**. A `.json` file downloads.
4. In the toy list sheet, click **Share** and add the service account's email (it ends in `iam.gserviceaccount.com`) as a **Viewer**.
5. In this repo on GitHub, go to **Settings → Secrets and variables → Actions**:
   - **Secrets** tab: add `GOOGLE_SERVICE_ACCOUNT_JSON` and paste the whole contents of the downloaded file.
   - **Variables** tab: add `SHEET_ID` with the id from the sheet's URL (the part between `/d/` and `/edit`).
6. Run the **Sync sheet and deploy** workflow from the **Actions** tab, or wait for the next daily run.

Until then the site shows the saved copy in `public/data/collection.json`.

## Developing

```sh
npm install
npm run dev      # local site at http://localhost:5173/miniatures-dashboard/
npm test         # parser and stats tests
npm run sync     # needs SHEET_ID and GOOGLE_SERVICE_ACCOUNT_JSON in the environment
npm run build
```

Code layout:

- `src/lib/parse.ts`: turns sheet tabs into armies and unit rows
- `src/lib/stats.ts`: totals, this year vs backlog, output by year, pace, time per model
- `src/main.ts`: the dashboard page
- `scripts/sync-sheet.ts`: reads the sheet with the service account and writes the data file

## Later: entering data in the app

The plan is for the app to replace the sheet as the place I enter things (logging painting sessions, moving units out of the backlog, adding new armies). The data is already shaped for that: `collection.json` holds plain army and unit records rather than sheet cells. Moving input into the app means adding a small backend to store those records and swapping the sheet sync for it.
