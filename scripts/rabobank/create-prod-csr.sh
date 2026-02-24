#!/usr/bin/env bash
# Create production CSR for Rabobank mTLS.
# Generates client.key and client.csr in .secrets/rabobank/
# Usage: ./scripts/rabobank/create-prod-csr.sh

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SECRETS_DIR="${REPO_ROOT}/.secrets/rabobank"

# Defaults (overridable via env)
C="${RABOBANK_CSR_C:-NL}"
O="${RABOBANK_CSR_O:-GrowSocial}"
CN="${RABOBANK_CSR_CN:-GrowSocial Rabobank mTLS}"

echo "=== Rabobank mTLS – CSR aanmaken ==="
echo ""

# Interactive if not all env set (optional: we always allow override via env)
if [[ -z "${RABOBANK_CSR_C:-}" ]]; then
  read -rp "Country (C) [$C]: " input_c
  C="${input_c:-$C}"
fi
if [[ -z "${RABOBANK_CSR_O:-}" ]]; then
  read -rp "Organization (O) [$O]: " input_o
  O="${input_o:-$O}"
fi
if [[ -z "${RABOBANK_CSR_CN:-}" ]]; then
  read -rp "Common Name (CN) [$CN]: " input_cn
  CN="${input_cn:-$CN}"
fi

mkdir -p "$SECRETS_DIR"
KEY_FILE="${SECRETS_DIR}/client.key"
CSR_FILE="${SECRETS_DIR}/client.csr"

# Generate private key (RSA 4096 for production)
openssl genrsa -out "$KEY_FILE" 4096
chmod 600 "$KEY_FILE"

# Generate CSR
openssl req -new -key "$KEY_FILE" -out "$CSR_FILE" \
  -subj "/C=${C}/O=${O}/CN=${CN}"

echo ""
echo "--- Gereed ---"
echo "Bestanden staan in: $SECRETS_DIR"
echo "  - client.key  (private key)"
echo "  - client.csr  (certificate signing request)"
echo ""
echo "  Stuur client.csr naar Rabobank / QTSP / CA om een client-certificaat te krijgen."
echo "  client.key NOOIT delen of committen – bewaar lokaal en veilig."
echo ""
