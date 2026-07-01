#!/usr/bin/env bash
# Add custom hosting domains to Firebase Auth authorized domains (required for Google sign-in).
set -euo pipefail

PROJECT="${FIREBASE_PROJECT:-warp-12}"
DOMAINS=(
  "leaderboard.warp12.app"
  "warp-12-leaderboard.web.app"
  "warp12.app"
)

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud not found — install google-cloud-sdk or add it to PATH" >&2
  exit 1
fi

TOKEN="$(gcloud auth print-access-token --project="$PROJECT")"
CONFIG_URL="https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT}/config"

CURRENT="$(curl -sf \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-goog-user-project: ${PROJECT}" \
  "$CONFIG_URL")"

PATCH_BODY="$(python3 - "$CURRENT" "${DOMAINS[@]}" <<'PY'
import json, sys

config = json.loads(sys.argv[1])
domains = list(config.get("authorizedDomains") or [])
added = []
for domain in sys.argv[2:]:
    if domain not in domains:
        domains.append(domain)
        added.append(domain)

if not added:
    print(json.dumps({"skip": True, "message": "already present"}))
    sys.exit(0)

config["authorizedDomains"] = domains
print(json.dumps(config))
PY
)"

if python3 -c "import json,sys; d=json.loads(sys.argv[1]); sys.exit(0 if d.get('skip') else 1)" "$PATCH_BODY" 2>/dev/null; then
  echo "Authorized domains already include: ${DOMAINS[*]}"
  exit 0
fi

curl -sf -X PATCH \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-goog-user-project: ${PROJECT}" \
  -H "Content-Type: application/json" \
  "${CONFIG_URL}?updateMask=authorizedDomains" \
  -d "$PATCH_BODY" >/dev/null

echo "Added authorized domain(s): ${DOMAINS[*]}"
