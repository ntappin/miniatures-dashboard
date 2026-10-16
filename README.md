# Miniatures dashboard

A dashboard for my miniatures collection and painting backlog: painted vs unpainted by army, what I've worked on this year against what's still in progress, output by year, and how long models take to paint.

Live at **https://ntappin.github.io/miniatures-dashboard/**

## Where the data comes from

For now the data lives in my "toy list" Google Sheet, and I keep editing it there. Every 30 minutes (and on every push), a GitHub Action reads the sheet, writes `public/data/collection.json`, builds the site and publishes it to GitHub Pages.

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
6. Run the **Sync sheet and deploy** workflow from the **Actions** tab, or wait for the next scheduled run.

Until then the site shows the saved copy in `public/data/collection.json`.

## Editing: tasks and sign-in

Anyone can view the site. Only I can change it: **Sign in to edit** signs in with Google, and the app then reads and writes a `tasks` tab in the toy list sheet using my own Google access. Google allows writes only from accounts with edit access to the sheet, so other visitors who sign in can't save anything.

- Signed in, edits save straight to the sheet and show for me immediately.
- The public page picks them up on the next sync (every 30 minutes) or when the workflow is run by hand.
- Signed in, the site opens on the **Workbench**: what's in progress per army, a pick of which armies I'm working on, and their upcoming tasks. **Log work** asks for the army, then the units, then which task I did, and adds one row per unit to a `work log` tab (`id, date, army, unit, step, task, session`). It never edits the `in progress` tab; each unit's latest logged step shows beside its state from the sheet.
- The `tasks` tab is created on the first edit. It can also be edited directly in the sheet: columns are `id, army, title, unit, status, created, done`, with `status` either `todo` or `done`.

### Setting up Google sign-in (one time)

Use the same Google Cloud project as the sheet sync.

1. **APIs & Services → OAuth consent screen**: choose **External**, fill in the app name and your email, and add the scope `.../auth/spreadsheets`. Leave it in **Testing** and add your own Google account under **Test users**.
2. **APIs & Services → Credentials → Create credentials → OAuth client ID**: type **Web application**. Under **Authorized JavaScript origins** add `https://ntappin.github.io` (and `http://localhost:5173` for local work). No redirect URIs are needed.
3. Copy the **Client ID** (it ends in `.apps.googleusercontent.com`) and add it in this repo under **Settings → Secrets and variables → Actions → Variables** as `GOOGLE_CLIENT_ID`. It isn't secret; it ends up in the page.
4. Run the **Sync sheet and deploy** workflow. **Sign in to edit** appears at the top of the site.

The first sign-in shows Google's "this app isn't verified" screen, because the app is in Testing; continue as the test user.

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
- `src/lib/task-rows.ts`, `src/lib/sheets.ts`: the tasks tab layout, and reading and writing it as the signed-in user
- `src/auth.ts`: Google sign-in
- `src/lib/worklog.ts`: work log entries, units still being worked on, latest step per unit
- `src/main.ts`, `src/dashboard.ts`, `src/army.ts`, `src/workbench.ts`: the dashboard, army pages, workbench and log work flow
- `scripts/sync-sheet.ts`: reads the sheet with the service account and writes the public data files

## Later

More of what's in the sheet can move into the app the same way as tasks: logging painting sessions, moving units out of the backlog, adding armies. Each one is a tab the app writes with Google sign-in and the sync publishes.
