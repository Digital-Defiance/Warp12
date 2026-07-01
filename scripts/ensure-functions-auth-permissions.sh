#!/usr/bin/env bash
# Gen2 Cloud Functions use the default Compute service account.
# - firebaseauth.admin: custom claims (bootstrapAdmin, setUserRoles)
# - datastore.user: Admin SDK Firestore reads/writes (playerStats, ratedMatches, …)
set -euo pipefail

PROJECT="${FIREBASE_PROJECT:-warp-12}"
ROLES=(
  "roles/firebaseauth.admin"
  "roles/datastore.user"
)

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud not found — install google-cloud-sdk or add it to PATH" >&2
  exit 1
fi

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

grant_if_missing() {
  local role="$1"
  if gcloud projects get-iam-policy "$PROJECT" \
    --flatten="bindings[].members" \
    --filter="bindings.members:serviceAccount:${SA} AND bindings.role:${role}" \
    --format='value(bindings.role)' | grep -q "$role"; then
    echo "Already granted ${role} to ${SA}"
    return 0
  fi

  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:${SA}" \
    --role="$role" \
    --condition=None \
    --quiet >/dev/null

  echo "Granted ${role} to ${SA}"
}

for role in "${ROLES[@]}"; do
  grant_if_missing "$role"
done
