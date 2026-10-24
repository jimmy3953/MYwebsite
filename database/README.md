# Local workbook CRUD

The admin dashboard reads and writes `../CDWS_Database.xlsx` through `server.py`. The server uses only Python's standard library; no npm, pip, Cloudflare account, GitHub token, or network database is required.

## Start the dashboard

Python 3 must be available. In PowerShell, from the project folder, run:

```powershell
python database/server.py
```

If `python` is not recognized on Windows, try `py -3 database/server.py`. Keep the terminal open. The server automatically opens the admin dashboard and creates the browser session; there is no key to copy or paste. You can also open `http://127.0.0.1:3000/database-admin.html` manually.

Use **New record** to insert a row, **Edit** and **Save changes** to update it, or **Delete selected record** to remove it. Changes are written directly to the workbook file on this computer. Stop the server with `Ctrl+C`.

For a focused insert form, open `content.html` from the running local site. It connects automatically and saves new records to the `Website Content` worksheet.

The server listens only on `127.0.0.1`. If port 3000 is already in use, set another port before starting it, for example `$env:PORT = "3001"; python database/server.py`, then open the matching `127.0.0.1:3001` URL.

## Workbook schema

The `Website Content` worksheet uses row 1 for `Page`, `Section`, `Title`, `Content`, `Category`, `Display Order`, and `Status`. Other worksheets can be managed if they also have headers in row 1. The school pages remain static HTML; records do not automatically appear in those pages.

## Contact enquiries

The `Contact Enquiries` worksheet contains parent/guardian name, email, phone, student name and class, category, requested information, preferred contact method, message, and submission time. The Contact form inserts each submission into this sheet without needing the admin key. The local server accepts submissions only from the local website. Because this workbook is in a public repository, use fictional assignment data only. Admins can review submissions from the Database Admin page.

## Privacy and backups

The workbook is tracked in this repository, so committing it makes its contents public and stores prior versions in Git history. Keep personal or confidential data out of it. Back up the workbook before bulk edits. Close it in Excel before saving records from the dashboard.
