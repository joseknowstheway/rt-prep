# RT Registry Prep

An installable study app for the ARRT Radiation Therapy registry exam. It has 308 questions with rationales, flashcard study with full attempt history, and timed or untimed practice exams with an answer key.

- **Offline first.** Everything is saved on the device immediately, and the app works with no connection.
- **Your data, your database.** When you sign in, attempts and exams sync to *your* Supabase project. You can query, export or delete them there at any time.
- **No build step.** Plain HTML, CSS and JavaScript. Nothing to install.

## Files

| File | Purpose |
|---|---|
| `index.html`, `app.css`, `app.js` | The app |
| `questions.js` | Question bank (stable ids, so history stays linked if you edit wording) |
| `config.js` | Your Supabase URL and key, which you fill in |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline support and the Home Screen install |
| `supabase/schema.sql` | Database tables and security rules |
| `.github/workflows/deploy.yml` | Deploys to GitHub Pages on every push to `main` |

## Setup

### 1. Create the database (about 5 minutes)

1. Sign up at [supabase.com](https://supabase.com) and create a new project. The free tier is enough.
2. Open **SQL Editor → New query**, paste the contents of `supabase/schema.sql`, and click **Run**.
3. Open **Project Settings → API** (or **API Keys**). Copy the **Project URL** and the **publishable** key (older projects call it the **anon** key).
4. Paste both into `config.js`.

> The publishable/anon key is meant to be public. Row-level security in `schema.sql` means a signed-in account can only see its own rows. **Never** put the `service_role` / secret key in `config.js`.

### 2. Deploy to GitHub Pages

1. Create a new GitHub repository, for example `rt-prep`, and push these files to the `main` branch:
   ```bash
   git init && git add . && git commit -m "RT Registry Prep"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/rt-prep.git
   git push -u origin main
   ```
2. In the repo, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. The **Deploy to GitHub Pages** workflow runs automatically. When it finishes, the site is at `https://YOUR-USERNAME.github.io/rt-prep/`.

### 3. Point Supabase at your site

In Supabase, go to **Authentication → URL Configuration** and set **Site URL** to your Pages address. This makes the account confirmation email link back to your app.

### 4. Create your account (once)

1. Open the site in Safari, go to the **Account** tab, and choose **Create an account**.
2. Confirm the email Supabase sends you, then sign in.
3. Recommended: in Supabase, go to **Authentication → Sign In / Providers** and turn off **Allow new users to sign up**. That keeps the project to just you.

### 5. Install on iPhone and iPad

On each device:

1. Open the site in **Safari**.
2. Tap **Share → Add to Home Screen**.
3. Open the app from the Home Screen, go to **Account**, and sign in.

Each Home Screen app has its own storage, separate from Safari, so sign in inside the installed app. Once you're signed in, both devices share the same history and exams.

## How sync works

- Every answer is written to the device right away and queued for upload. The queue uploads when you're online and signed in. The header pill shows the state: **Synced**, **Syncing…**, **N waiting**, **Offline**, or **Not signed in**.
- The app pulls new data when it opens, when you return to it, and every minute while it's open.
- Attempts are append-only rows, so two devices can never overwrite each other's answers.
- The exam in progress syncs too. You can start an exam on the iPad and finish it on the iPhone. For a timed exam, the clock keeps running while you're away.

## Your data

- **In the app:** **Account → Export backup (JSON)** saves everything. **Export attempts (CSV)** gives a spreadsheet of every answer. **Import backup** merges a file back in without duplicating anything.
- **In Supabase:** see the `attempts`, `exams` and `app_state` tables in **Table Editor**, where you can also export CSV. The `question_accuracy` view gives per-question accuracy, for example:
  ```sql
  select qid, answered, correct, pct_correct
  from question_accuracy
  order by pct_correct asc nulls first
  limit 25;
  ```
- **Delete everything:** delete your user under **Authentication → Users**. All rows cascade-delete.

## Notes

- **Free Supabase projects pause after a week with no activity.** If that happens, the app keeps working on the device and shows a sync error. Click **Restore** on the project in the Supabase dashboard, and the queued changes upload.
- **Updating the app:** push to `main`. The workflow stamps `sw.js` with the commit id, so installed copies pick up the new version the next time they open.
- **Editing questions:** change the text in `questions.js` but keep each `id` unchanged so your history stays attached. New questions need a new unique id. The `s` field is the content area: `pc`, `pr`, `pq`, `tp` or `td`.
- **Not an official product.** This is an independent study aid, not an ARRT product. Verify figures against your program's current texts.
