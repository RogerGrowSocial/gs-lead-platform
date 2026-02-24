#!/usr/bin/env bash
# Build fullchain.pem from client cert + intermediate/root certs.
# Output: ./.secrets/rabobank/fullchain.pem
# Validates that output contains only CERTIFICATE blocks (no PRIVATE KEY).
# Usage: ./scripts/rabobank/build-fullchain.sh <client.crt> [intermediate.crt ...]

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUTPUT_FILE="${REPO_ROOT}/.secrets/rabobank/fullchain.pem"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <client.crt> [intermediate.crt ...]" >&2
  echo "  Builds fullchain.pem: client cert first, then intermediates/root." >&2
  exit 1
fi

CLIENT_CERT="$1"
shift
if [[ ! -f "$CLIENT_CERT" ]]; then
  echo "Error: client cert not found: $CLIENT_CERT" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT_FILE")"
cat "$CLIENT_CERT" > "$OUTPUT_FILE"
for f in "$@"; do
  if [[ -f "$f" ]]; then
    cat "$f" >> "$OUTPUT_FILE"
  else
    echo "Warning: file not found, skipping: $f" >&2
  fi
done

# Validate: only CERTIFICATE blocks allowed, no PRIVATE KEY
if grep -q "PRIVATE KEY" "$OUTPUT_FILE"; then
  echo "Error: fullchain.pem must not contain PRIVATE KEY. Remove key from input files." >&2
  rm -f "$OUTPUT_FILE"
  exit 1
fi
CERT_COUNT=$(grep -c "BEGIN CERTIFICATE" "$OUTPUT_FILE" || true)
if [[ "${CERT_COUNT:-0}" -eq 0 ]]; then
  echo "Error: no CERTIFICATE block found in output." >&2
  rm -f "$OUTPUT_FILE"
  exit 1
fi

echo "Written: $OUTPUT_FILE ($CERT_COUNT certificate(s))"
echo "Use this file as PEM chain in the Rabobank portal."
