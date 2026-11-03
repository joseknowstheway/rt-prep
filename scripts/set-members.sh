#!/usr/bin/env bash
# Sets the (at most two) accounts that share the app's data, then turns off new sign-ups.
# Usage: scripts/set-members.sh first@example.com second@example.com
# Needs gcloud signed in to an account with access to the Firebase project.
set -euo pipefail
P=rt-prep-9994e6

if [ $# -lt 1 ] || [ $# -gt 2 ]; then echo "Give one or two account emails." >&2; exit 1; fi
T=$(gcloud auth print-access-token)
H=(-H "Authorization: Bearer $T" -H "x-goog-user-project: $P" -H "Content-Type: application/json")

emails=$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1:]))' "$@")
uids=$(curl -sf -X POST "https://identitytoolkit.googleapis.com/v1/projects/$P/accounts:lookup" "${H[@]}" -d "{\"email\":$emails}" \
  | python3 -c '
import json,sys
want=[e.lower() for e in sys.argv[1:]]
users={u["email"].lower():u["localId"] for u in json.load(sys.stdin).get("users",[])}
missing=[e for e in want if e not in users]
if missing: sys.exit("No account yet for: "+", ".join(missing)+". Create it in the app first.")
print(json.dumps([{"stringValue":users[e]} for e in want]))' "$@")

curl -sf -X PATCH "https://firestore.googleapis.com/v1/projects/$P/databases/(default)/documents/spaces/main?updateMask.fieldPaths=members" "${H[@]}" \
  -d "{\"fields\":{\"members\":{\"arrayValue\":{\"values\":$uids}}}}" >/dev/null
echo "Members set: $*"

curl -sf -X PATCH "https://identitytoolkit.googleapis.com/admin/v2/projects/$P/config?updateMask=client.permissions.disabledUserSignup" "${H[@]}" \
  -d '{"client":{"permissions":{"disabledUserSignup":true}}}' >/dev/null
echo "New sign-ups turned off. To allow one again (e.g. to swap a member), turn on"
echo "Authentication > Settings > User actions > Enable create (sign-up) in the Firebase console."
