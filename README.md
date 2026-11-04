# RT Registry Prep

An installable study app for the ARRT Radiation Therapy registry exam. It has 486 questions with rationales, flashcard study with full attempt history, and timed or untimed practice exams with an answer key.

- **Offline first.** Everything is saved on the device immediately, and the app works with no connection.
- **Two accounts, one shared history.** Up to two accounts share the same data: every attempt, finished exam and the exam in progress. If one person misses a question, it shows as missed for both. Everything syncs through *your* Firebase project (free Spark plan). You can browse, export or delete them there at any time.
- **No build step.** Plain HTML, CSS and JavaScript. Nothing to install.

**Live app:** https://joseknowstheway.github.io/rt-prep/ · **Firebase project:** [`rt-prep-9994e6`](https://console.firebase.google.com/project/rt-prep-9994e6/overview)

## Files

| File | Purpose |
|---|---|
| `index.html`, `app.css`, `app.js` | The app |
| `questions.js` | Question bank (stable ids, so history stays linked if you edit wording) |
| `config.js` | Firebase web API key and project id |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline support and the Home Screen install |
| `firestore.rules`, `firebase.json`, `.firebaserc` | Firestore security rules and the Firebase CLI config to deploy them |
| `scripts/set-members.sh` | Sets the two accounts that share the data, and turns off new sign-ups |
| `scripts/reset-history.sh` | Wipes all shared answers and exams for both accounts (devices clear their local copy on next sync) |
| `.github/workflows/deploy.yml` | Deploys to GitHub Pages on every push to `main` |

## Backend (already set up)

- **Auth:** Firebase Authentication, Email/Password provider. `joseknowstheway.github.io` is an authorized domain.
- **Database:** Cloud Firestore `(default)` in `nam5`. All shared data lives under `spaces/main`: `attempts/{id}`, `exams/{id}` and `app_state/active_exam`.
- **Members:** the `members` field of `spaces/main` lists the auth uids (two at most) allowed in. It can only be changed with admin access: run `scripts/set-members.sh` or edit it in the console. The app can't change it.
- **Security:** `firestore.rules` denies every account that isn't in `members`, and attempts are create-only. After editing the rules, deploy them with:
  ```bash
  firebase deploy --only firestore:rules
  ```

> The Firebase web API key in `config.js` is meant to be public. Access is controlled by the security rules, not the key. **Never** put a service account key in this repo.

The app talks to Firebase over its REST APIs with `fetch`, so no SDK is loaded.

## First-time use

### Create the two accounts (once)

1. Each person opens https://joseknowstheway.github.io/rt-prep/, goes to **Account → Create an account**, and signs up. Until step 2 is done, the app shows "This account doesn't have access to the shared study data". Anything answered before then is kept on the device and uploads afterwards.
2. Run the following once (it needs `gcloud` signed in):
   ```bash
   scripts/set-members.sh first@example.com second@example.com
   ```
   This adds both accounts as members and turns off new sign-ups, so nobody else can create an account.

**Swapping a member later:** in the Firebase console, turn on **Authentication → Settings → User actions → Enable create (sign-up)**. Have the new person sign up, then run the script again with the two emails. A removed account loses access immediately, but the data it created stays.

### Install on iPhone and iPad

On each device:

1. Open the site in **Safari**.
2. Tap **Share → Add to Home Screen**.
3. Open the app from the Home Screen, go to **Account**, and sign in.

Each Home Screen app has its own storage, separate from Safari, so sign in inside the installed app. Every device signed in to either account sees the same history and exams.

## How sync works

- Every answer is written to the device right away and queued for upload. The queue uploads when you're online and signed in. The header pill shows the state: **Synced**, **Syncing…**, **N waiting**, **Offline**, or **Not signed in**.
- The app pulls new data when it opens, when you return to it, and every minute while it's open.
- Attempts are append-only, so two people or devices can never overwrite each other's answers. A question's status (Mastered, Missed last, …) comes from the combined history, so the most recent answer by *either* person counts.
- There is one shared exam in progress. Either person can resume it on any device, and while it exists, neither can start another. For a timed exam, the clock keeps running while you're away.

## Your data

- **In the app:** **Account → Export backup (JSON)** saves everything. **Export attempts (CSV)** gives a spreadsheet of every answer. **Import backup** merges a file back in without duplicating anything.
- **In Firebase:** browse `spaces/main` under **Firestore Database → Data**. Each attempt has `qid`, `answered_at`, `result` (0 incorrect, 1 correct, 2 skipped), `choice` and `source` (`s` study, `x` exam).
- **Delete everything:** in **Firestore Database**, delete the `attempts`, `exams` and `app_state` collections under `spaces/main`. Deleting a user under **Authentication → Users** removes that login but not the shared data.

## Notes

- **Free tier.** The Spark plan allows 50K reads and 20K writes per day, far more than one person studying uses. Spark projects don't pause when idle.
- **Updating the app:** push to `main`. The workflow stamps `sw.js` with the commit id, so installed copies pick up the new version the next time they open.
- **Editing questions:** change the text in `questions.js` but keep each `id` unchanged so your history stays attached. New questions need a new unique id. The `s` field is the content area: `pc`, `pr`, `pq`, `tp` or `td`.
- **Not an official product.** This is an independent study aid, not an ARRT product. Verify figures against your program's current texts.
