#!/usr/bin/env bash
# Verify that client.key and client.crt match (same key pair).
# Usage: ./scripts/rabobank/verify-key-cert-match.sh [path/to/client.crt]
# Default cert: .secrets/rabobank/client_cert.pem or .secrets/rabobank/client.crt

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SECRETS_DIR="${REPO_ROOT}/.secrets/rabobank"
KEY_FILE="${SECRETS_DIR}/client.key"

CERT_FILE="${1:-}"
if [[ -z "$CERT_FILE" ]]; then
  for f in "${SECRETS_DIR}/client_cert.pem" "${SECRETS_DIR}/client.crt"; do
    if [[ -f "$f" ]]; then
      CERT_FILE="$f"
      break
    fi
  done
fi

if [[ -z "$CERT_FILE" || ! -f "$CERT_FILE" ]]; then
  echo "Usage: $0 [path/to/client.crt]" >&2
  echo "  Or place client_cert.pem / client.crt in .secrets/rabobank/" >&2
  exit 1
fi

if [[ ! -f "$KEY_FILE" ]]; then
  echo "Error: key not found: $KEY_FILE" >&2
  exit 1
fi

HASH_CERT=$(openssl x509 -noout -modulus -in "$CERT_FILE" 2>/dev/null | openssl md5)
HASH_KEY=$(openssl rsa -noout -modulus -in "$KEY_FILE" 2>/dev/null | openssl md5)

if [[ "$HASH_CERT" == "$HASH_KEY" ]]; then
  echo "OK: key and certificate match ($HASH_CERT)"
  exit 0
else
  echo "MISMATCH: key and certificate do not belong together." >&2
  echo "  cert: $HASH_CERT" >&2
  echo "  key:  $HASH_KEY" >&2
  exit 1
fi
