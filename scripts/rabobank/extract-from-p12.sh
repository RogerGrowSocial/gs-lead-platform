#!/usr/bin/env bash
# Extract client cert and CA chain from .p12/.pfx for Rabobank mTLS.
# Outputs: client_cert.pem, ca_chain.pem, fullchain.pem in .secrets/rabobank/
# Usage: ./scripts/rabobank/extract-from-p12.sh <path-to.p12> [password]

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SECRETS_DIR="${REPO_ROOT}/.secrets/rabobank"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <path-to.p12|.pfx> [password]" >&2
  echo "  If password omitted, openssl will prompt." >&2
  exit 1
fi

P12_PATH="$1"
PASS="${2:-}"

if [[ ! -f "$P12_PATH" ]]; then
  echo "Error: file not found: $P12_PATH" >&2
  exit 1
fi

mkdir -p "$SECRETS_DIR"
CLIENT_PEM="${SECRETS_DIR}/client_cert.pem"
CA_CHAIN_PEM="${SECRETS_DIR}/ca_chain.pem"
FULLCHAIN_PEM="${SECRETS_DIR}/fullchain.pem"

# Export client certificate (no key to avoid leaking key in fullchain)
if [[ -n "$PASS" ]]; then
  openssl pkcs12 -in "$P12_PATH" -clcerts -nokeys -out "$CLIENT_PEM" -passin "pass:${PASS}"
else
  openssl pkcs12 -in "$P12_PATH" -clcerts -nokeys -out "$CLIENT_PEM"
fi

# Export CA chain (intermediates + root)
if [[ -n "$PASS" ]]; then
  openssl pkcs12 -in "$P12_PATH" -cacerts -nokeys -out "$CA_CHAIN_PEM" -passin "pass:${PASS}"
else
  openssl pkcs12 -in "$P12_PATH" -cacerts -nokeys -out "$CA_CHAIN_PEM"
fi

# fullchain = client + CA chain (for portal)
cat "$CLIENT_PEM" "$CA_CHAIN_PEM" > "$FULLCHAIN_PEM"

# Sanity check: no private key in fullchain
if grep -q "PRIVATE KEY" "$FULLCHAIN_PEM"; then
  echo "Error: fullchain contained private key – aborting." >&2
  rm -f "$CLIENT_PEM" "$CA_CHAIN_PEM" "$FULLCHAIN_PEM"
  exit 1
fi

echo "Extracted to $SECRETS_DIR:"
echo "  - client_cert.pem"
echo "  - ca_chain.pem"
echo "  - fullchain.pem"
echo ""
echo "  Plak fullchain.pem in het Rabobank portal (PEM chain / certificate veld)."
