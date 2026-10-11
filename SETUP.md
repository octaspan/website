# Connecting the Octaspan Website to Google Sheets & Google Drive

This guide connects the four forms on the website — **Newsletter subscribe**,
**Contact Us**, **Submit an RFP** and the **Partnership Form** (including file uploads) — to your
own Google account. Submissions will land as rows in a Google Sheet, and RFP
file attachments will be saved to a Google Drive folder automatically.

No coding required — just copy/paste. Takes about 10–15 minutes.

Two files are involved:
- **`Code.gs`** — the backend script (provided alongside this guide)
- **`assets/app.js`** — the site's script file (one line needs updating at the end)

---

## Step 1 — Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a **new blank spreadsheet**.
2. Name it something like **"Octaspan Website Submissions"**.
3. Leave it empty — the script will create its own tabs (`Newsletter Signups`,
   `Contact Submissions`, `RFP Submissions`) automatically the first time each
   form is used. You don't need to set up columns yourself.

---

## Step 2 — Attach the Apps Script

1. In your new Sheet, go to **Extensions → Apps Script**.
2. Delete the placeholder code in the editor (`function myFunction() {}`).
3. Open the **`Code.gs`** file provided with this guide, copy its entire
   contents, and paste it into the Apps Script editor.
4. Click the **project name** at the top (e.g. "Untitled project") and rename
   it to **"Octaspan Form Intake"**.
5. Click the **disk/save icon** (or press `Ctrl+S` / `Cmd+S`).

---

## Step 3 — Create a Google Drive folder for RFP files

1. Go to [drive.google.com](https://drive.google.com) and create a new folder,
   e.g. **"Octaspan RFP Attachments"**.
2. Open the folder and copy its **ID** from the URL:
   ```
   https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz
                                            └──────────── this part ────────────┘
   ```
3. Back in the Apps Script editor, find this line near the top of `Code.gs`:
   ```js
   const RFP_DRIVE_FOLDER_ID = 'PASTE_YOUR_DRIVE_FOLDER_ID_HERE';
   ```
   Replace `PASTE_YOUR_DRIVE_FOLDER_ID_HERE` with the folder ID you copied.
4. Save again.

> Every RFP submission will create its own dated subfolder inside this
> folder (e.g. `2026-09-16 1432 — Acme Corp (jane@acme.com)`), containing that
> submission's uploaded files. The Sheet row for that submission includes a
> direct link to each file.

---

## Step 3b — Create a second Drive folder for Partner attachments

Repeat Step 3 with a new folder (e.g. "Octaspan Partner Files"), copy its
folder ID, and paste it into `PARTNER_DRIVE_FOLDER_ID` near the top of
`Code.gs`. Company profiles and brochures from the Partnership Form are saved
there, in one subfolder per submission. A "Partner Applications" tab is
created in your Sheet automatically.

---

## Step 4 — Deploy as a Web App

1. In the Apps Script editor, click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Configure it exactly like this:
   - **Description:** `Octaspan website intake v1`
   - **Execute as:** `Me (your-email@gmail.com)`
   - **Who has access:** `Anyone`

   > "Anyone" is required because the request comes from a visitor's browser,
   > not a logged-in Google account. The script itself still only writes to
   > *your* Sheet and Drive folder — it can't be used to access anything else
   > in your account.
4. Click **Deploy**.
5. The first time, Google will ask you to **authorize** the script:
   - Click **Authorize access**
   - Choose your Google account
   - You'll see an "unverified app" warning — this is expected for a script
     you wrote yourself. Click **Advanced → Go to Octaspan Form Intake (unsafe)**
     → **Allow**.
6. Copy the **Web app URL** shown after deployment. It looks like:
   ```
   https://script.google.com/macros/s/AKfycb......................./exec
   ```

---

## Step 5 — Connect the website to your deployment

1. Open **`assets/app.js`** in a text editor.
2. Find this block near the top of the `<script>` section (search for `CONFIG`):
   ```js
   const CONFIG = {
     SHEETS_ENDPOINT: "https://script.google.com/macros/s/REPLACE_WITH_YOUR_DEPLOYMENT_ID/exec",
     DEMO_MODE: true, // set false once SHEETS_ENDPOINT is a real deployment
     ...
   };
   ```
3. Replace the placeholder URL with the Web app URL you copied in Step 4.
4. Change `DEMO_MODE: true` to `DEMO_MODE: false`.
5. Save the file.

That's it — the site is now live-wired to your Google account.

---

## Step 6 — Test it

1. Open the website and try each form:
   - **Newsletter** (in any page footer) → check for a new row in
     **Newsletter Signups**.
   - **Contact Us** → check **Contact Submissions**.
   - **Submit an RFP**, attaching a small PDF or DOCX → check **RFP
     Submissions** for the row, and your Drive folder for the uploaded file.
   - **Partnership Form** (partner-form.html) → check **Partner Applications**
     and your partner Drive folder.
2. If a submission doesn't appear:
   - Open the Sheet and check for an **Errors** tab — the script logs any
     failures there with the error message.
   - Re-check that `DEMO_MODE` is `false` and the URL was pasted correctly
     (no extra spaces, ends in `/exec` not `/dev`).

---

## Updating the script later

If you ever edit `Code.gs` again (e.g. to add a field), you must create a
**new deployment version** for the change to take effect:

1. **Deploy → Manage deployments**
2. Click the **pencil/edit icon** on your existing deployment
3. Under "Version," choose **New version**
4. Click **Deploy**

The Web app URL stays the same — you won't need to update `index.html` again
unless you create an entirely new deployment.

**Important:** if you deployed an older version of `Code.gs`, you must deploy a
New version with this one, or partner submissions will land in the
"Unrecognized Submissions" tab.

---

## Notes on limits & privacy

- Google Apps Script Web Apps have a daily quota (typically **20,000
  requests/day and ~50MB of Drive writes per execution** on a standard
  Google/Workspace account) — more than enough for a company website's
  contact and RFP volume.
- All submitted data stays inside **your own** Google Sheet and Drive — it
  never passes through any third-party server other than Google's.
- The `mode: 'no-cors'` used by the site's fetch request means the browser
  can't read the response back from the script, so the site always shows a
  success confirmation optimistically once the request is sent. Genuine
  delivery failures (bad URL, script error, quota exceeded) will show up in
  the **Errors** tab, not in the visitor's browser — check that tab
  periodically, especially right after going live.
