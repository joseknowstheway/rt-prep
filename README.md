# RT Registry Prep

An installable study app for the ARRT Radiation Therapy registry exam. It has 308 questions with rationales, flashcard study with full attempt history, and timed or untimed practice exams with an answer key.

- **Offline first.** Everything is saved on the device immediately, and the app works with no connection.
- **Your data, your database.** When you sign in, attempts and exams sync to *your* Firebase project (free Spark plan). You can browse, export or delete them there at any time.
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
| `.github/workflows/deploy.yml` | Deploys to GitHub Pages on every push to `main` |

## Backend (already set up)

- **Auth:** Firebase Authentication, Email/Password provider. `joseknowstheway.github.io` is an authorized domain.
- **Database:** Cloud Firestore `(default)` in `nam5`. Data lives at `users/{uid}/attempts/{id}`, `users/{uid}/exams/{id}` and `users/{uid}/app_state/active_exam`.
- **Security:** `firestore.rules` lets a signed-in account read and write only its own `users/{uid}` subtree, and attempts are create-only. After editing the rules, deploy them with:
  ```bash
  firebase deploy --only firestore:rules
  ```

> The Firebase web API key in `config.js` is meant to be public. Access is controlled by the security rules, not the key. **Never** put a service account key in this repo.

The app talks to Firebase over its REST APIs with `fetch`, so no SDK is loaded.

## First-time use

### Create your account (once)

1. Open https://joseknowstheway.github.io/rt-prep/ in Safari, go to the **Account** tab, and choose **Create an account**. You're signed in right away.
2. Recommended: in the Firebase console, go to **Authentication → Settings → User actions** and turn off **Enable create (sign-up)**. That keeps the project to just you.

### Install on iPhone and iPad

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
- **In Firebase:** browse the `users` collection under **Firestore Database → Data**. Each attempt has `qid`, `answered_at`, `result` (0 incorrect, 1 correct, 2 skipped), `choice` and `source` (`s` study, `x` exam).
- **Delete everything:** delete your user under **Authentication → Users**, then delete your `users/{uid}` document (with subcollections) in **Firestore Database**.

## Notes

- **Free tier.** The Spark plan allows 50K reads and 20K writes per day, far more than one person studying uses. Spark projects don't pause when idle.
- **Updating the app:** push to `main`. The workflow stamps `sw.js` with the commit id, so installed copies pick up the new version the next time they open.
- **Editing questions:** change the text in `questions.js` but keep each `id` unchanged so your history stays attached. New questions need a new unique id. The `s` field is the content area: `pc`, `pr`, `pq`, `tp` or `td`.
- **Not an official product.** This is an independent study aid, not an ARRT product. Verify figures against your program's current texts.
