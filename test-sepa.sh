#!/bin/bash

# SEPA Testing Script
# Run this after creating a SEPA mandate via the frontend

echo "🧪 SEPA Direct Debit Testing Script"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if server is running
echo "1️⃣ Checking if server is running..."
if curl -s http://localhost:3000/api/health/mollie > /dev/null; then
    echo -e "${GREEN}✅ Server is running${NC}"
else
    echo -e "${RED}❌ Server is not running. Start it with: npm start${NC}"
    exit 1
fi

# Health check
echo ""
echo "2️⃣ Checking Mollie health..."
HEALTH_RESPONSE=$(curl -s http://localhost:3000/api/health/mollie)
SEPA_AVAILABLE=$(echo $HEALTH_RESPONSE | jq -r '.mollie.paymentMethods.sepaAvailable // false')

if [ "$SEPA_AVAILABLE" = "true" ]; then
    echo -e "${GREEN}✅ SEPA Direct Debit is available${NC}"
else
    echo -e "${RED}❌ SEPA Direct Debit is NOT available${NC}"
    echo -e "${YELLOW}⚠️  You need to activate SEPA in Mollie Dashboard:${NC}"
    echo "   1. Go to https://www.mollie.com/dashboard"
    echo "   2. Settings → Payment methods"
    echo "   3. Enable SEPA Direct Debit"
    echo ""
    echo "Current available methods:"
    echo $HEALTH_RESPONSE | jq -r '.mollie.paymentMethods.availableMethods[].id' | sed 's/^/   - /'
    exit 1
fi

# Check if user has session cookie
echo ""
echo "3️⃣ Checking authentication..."
echo -e "${YELLOW}⚠️  To test API endpoints, you need to:${NC}"
echo "   1. Login to your app at http://localhost:3000"
echo "   2. Open browser dev tools (F12)"
echo "   3. Go to Application → Cookies"
echo "   4. Copy the 'connect.sid' value"
echo "   5. Use it in the commands below"
echo ""

# Test commands with placeholder
echo "4️⃣ Test Commands (replace YOUR_SESSION_COOKIE):"
echo ""
echo -e "${YELLOW}# Test recurring payment:${NC}"
echo "curl -X POST http://localhost:3000/api/billing/charge \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -H \"Cookie: connect.sid=YOUR_SESSION_COOKIE\" \\"
echo "  -d '{\"amount\": {\"currency\": \"EUR\", \"value\": \"24.20\"}, \"description\": \"Test Recurring Charge\"}' | jq"
echo ""

echo -e "${YELLOW}# Test subscription creation:${NC}"
echo "curl -X POST http://localhost:3000/api/subscriptions \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -H \"Cookie: connect.sid=YOUR_SESSION_COOKIE\" \\"
echo "  -d '{\"amount\": {\"currency\": \"EUR\", \"value\": \"24.20\"}, \"interval\": \"1 month\", \"description\": \"Test Subscription\"}' | jq"
echo ""

echo -e "${YELLOW}# Test webhook simulation:${NC}"
echo "curl -X POST http://localhost:3000/api/webhooks/mollie \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"id\": \"tr_test123\", \"status\": \"paid\", \"amount\": {\"currency\": \"EUR\", \"value\": \"24.20\"}, \"customerId\": \"cst_test\"}' | jq"
echo ""

echo "5️⃣ Frontend Testing:"
echo -e "${GREEN}✅ Go to http://localhost:3000/dashboard/payments${NC}"
echo "   1. Click on SEPA tab"
echo "   2. Fill in IBAN: NL91ABNA0417164300"
echo "   3. Fill in Account Holder: Test User"
echo "   4. Select a bank"
echo "   5. Check the SEPA consent checkbox"
echo "   6. Click 'SEPA Mandate Aanmaken'"
echo ""

echo "6️⃣ Expected Results:"
echo -e "${GREEN}✅ Mandate creation: Success message + mandate ID${NC}"
echo -e "${GREEN}✅ Recurring payment: Payment ID with sequenceType: 'recurring'${NC}"
echo -e "${GREEN}✅ Subscription: Subscription ID with status: 'active'${NC}"
echo -e "${GREEN}✅ Webhook: 200 OK response${NC}"
echo ""

echo "🎉 Testing setup complete! Follow the steps above to test your SEPA implementation."
