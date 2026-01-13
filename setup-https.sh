#!/bin/bash

# Create SSL certificates for HTTPS development
echo "🔒 Creating SSL certificates for HTTPS development..."

# Create certs directory if it doesn't exist
mkdir -p certs

# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout certs/server.key -out certs/server.crt -days 365 -nodes \
  -subj "/C=NL/ST=Netherlands/L=Amsterdam/O=GrowSocial/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,DNS:127.0.0.1"

echo "✅ SSL certificates created successfully!"
echo ""
echo "🚀 To start HTTPS development server:"
echo "   npm run dev:https"
echo ""
echo "🌐 Then visit: https://localhost:3000"
echo "⚠️  Accept the browser security warning for the self-signed certificate"
echo ""
echo "💡 This will enable autofill functionality in payment forms!"
