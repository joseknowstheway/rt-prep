#!/usr/bin/env bash
# Wipes the shared study history for BOTH accounts: every answer (study and exam), every
# finished exam and the exam in progress. Each device clears its local copy on its next sync.
# Usage: scripts/reset-history.sh --yes
# Needs gcloud and the Firebase CLI signed in to an account with access to the project.
set -euo pipefail
P=rt-prep-9994e6

if [ "${1:-}" != "--yes" ]; then
  echo "This permanently deletes all shared answers and exams for both accounts." >&2
  echo "Run again with --yes to confirm." >&2
  exit 1
fi
T=$(gcloud auth print-access-token)
H=(-H "Authorization: Bearer $T" -H "x-goog-user-project: $P" -H "Content-Type: application/json")
DOC="https://firestore.googleapis.com/v1/projects/$P/databases/(default)/documents/spaces/main"

# Write the marker first, so a device syncing mid-reset drops its local copy instead of re-uploading it.
AT=$(python3 -c 'import time;print(int(time.time()*1000))')
ID="reset-$AT"
DATA=$(python3 -c 'import json,sys;print(json.dumps(json.dumps({"id":sys.argv[1],"at":int(sys.argv[2])})))' "$ID" "$AT")
curl -sf -X PATCH "$DOC/app_state/reset" "${H[@]}" \
  -d "{\"fields\":{\"data\":{\"stringValue\":$DATA},\"updated_at\":{\"timestampValue\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}}}" >/dev/null
echo "Reset marker written ($ID)."

for c in attempts exams; do
  firebase firestore:delete "spaces/main/$c" --recursive --force --project "$P" >/dev/null
done
curl -sf -X DELETE "$DOC/app_state/active_exam" "${H[@]}" >/dev/null
echo "Deleted all answers, finished exams and the exam in progress."
echo "Each device clears its local history the next time it syncs (on open, on return to the app, or every minute)."
