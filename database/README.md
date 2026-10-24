# CDWS workbook CRUD connection

The project repository currently contains **`CDWS_Database.xlsx`** on branch `main`. There is no `CDWS_databse.xlsm` file in the repository as named in the request. The Worker is configured for the existing .xlsx file. It intentionally refuses .xlsm files because writing through ExcelJS may not preserve VBA macros.

## Important privacy note

The repository is public. Anything committed into `CDWS_Database.xlsx` is publicly downloadable, including every previous version in Git history. **Do not store parent/guardian names, phone numbers, email addresses, student names, or private enquiry messages in this workbook.** The existing contact enquiry form is not redirected to this public workbook. Use a private database or access-controlled Google Sheet for those records.

## What is included

- `worker/src/index.js`: Cloudflare Worker API that reads and writes the repository workbook using GitHub's Contents API.
- `worker/package.json` and `worker/wrangler.toml`: deployment configuration.
- `../database-admin.html` and `../js/database-admin.js`: admin screen to list workbook worksheets and create, update, and delete rows.
- `../js/database-config.js`: endpoint setting used by the admin screen.

The API operates on worksheets and row-1 column headers already present in the workbook. Row 1 must contain column names. The admin page is for non-sensitive website content only.

## Deployment (one-time setup)

1. Create a Cloudflare account and install Node.js/npm if not already installed.
2. Open a terminal in `database/worker`, then run:
   `npm install`
3. In GitHub, create a fine-grained Personal Access Token scoped to **only** `jimmy3953/MYwebsite` with **Contents: Read and write**. Do not paste this token into any source file.
4. Run `npx wrangler secret put GITHUB_TOKEN` and paste that token into the prompt.
5. Generate a separate random admin key at least 24 characters long. Run `npx wrangler secret put ADMIN_API_KEY` and paste the key. Do not commit it.
6. Run `npm run deploy` and copy the Worker URL (usually ending in `.workers.dev`).
7. Edit `js/database-config.js` and set `window.CDWS_DATABASE_API` to that URL, then commit the change to GitHub.
8. Open `database-admin.html` on the deployed site, enter the same admin key and click **Connect**.

Cloudflare Worker variables are specified in `wrangler.toml`. The allowed website origins include `https://jimmy3953.github.io` and local development URLs. If your site uses a different origin, update `ALLOWED_ORIGINS` before deploying.

## API

- `GET /api/health` – service check.
- `GET /api/tables` – worksheet names and header information (requires admin key).
- `GET /api/records?sheet=SheetName` – records from one worksheet (requires admin key).
- `POST /api/records` with `{ "action": "create", "sheet": "...", "record": { ... } }`.
- `POST /api/records` with `{ "action": "update", "sheet": "...", "rowNumber": 2, "record": { ... } }`.
- `POST /api/records` with `{ "action": "delete", "sheet": "...", "rowNumber": 2 }`.

Every write creates a GitHub commit. Avoid simultaneous writes; refresh if the API reports a concurrent workbook edit.

## Current scope

This adds a working integration layer and CRUD admin screen for the workbook. The existing school pages still contain hard-coded prototype content; they do not automatically re-render from the workbook until each page's content sections are migrated to a defined worksheet schema. That migration should be done after the workbook's columns and intended page mapping are confirmed.
