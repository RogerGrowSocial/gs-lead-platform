# 🧪 **Complete SEPA Testing Guide - Step by Step**

## 🚨 **Prerequisites Check**

First, let's verify your setup is ready:

```bash
# 1. Check if SEPA is activated in Mollie
curl -s http://localhost:3000/api/health/mollie | jq '.mollie.paymentMethods.sepaAvailable'

# Should return: true (if SEPA is activated)
# If false: Activate SEPA in Mollie Dashboard → Settings → Payment methods
```

## 🔧 **Step 1: Create SEPA Mandate**

### **Option A: Via Frontend (Recommended)**
1. Go to `http://localhost:3000/dashboard/payments`
2. Click on SEPA tab
3. Fill in:
   - **IBAN:** `NL91ABNA0417164300` (test IBAN)
   - **Account Holder:** `Test User`
   - **Bank:** Select any bank
4. ✅ Check the SEPA consent checkbox
5. Click **"SEPA Mandate Aanmaken"**

### **Option B: Via API (for testing)**
```bash
# First, get your session cookie by logging in
# Then use it in the API call:

curl -X POST http://localhost:3000/api/payments/methods/sepa-mandate \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie-here" \
  -d '{
    "iban": "NL91ABNA0417164300",
    "accountName": "Test User",
    "bank": "abn"
  }' | jq
```

**Expected Response:**
```json
{
  "success": true,
  "mandate": {
    "id": "uuid-here",
    "type": "sepa",
    "provider_payment_method_id": "mdt_xxx",
    "account_name": "Test User",
    "iban": "NL91ABNA0417164300"
  },
  "mollieMandateId": "mdt_xxx"
}
```

## 🔄 **Step 2: Test Recurring Payment (Ad-hoc)**

```bash
curl -X POST http://localhost:3000/api/billing/charge \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie-here" \
  -d '{
    "amount": {
      "currency": "EUR",
      "value": "24.20"
    },
    "description": "GrowSocial Leads - Test Recurring Charge"
  }' | jq
```

**Expected Response:**
```json
{
  "success": true,
  "payment": {
    "id": "tr_xxx",
    "status": "open",
    "amount": {
      "currency": "EUR",
      "value": "24.20"
    },
    "sequenceType": "recurring",
    "customerId": "cst_xxx",
    "mandateId": "mdt_xxx"
  }
}
```

## 📅 **Step 3: Test Subscription Creation**

```bash
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie-here" \
  -d '{
    "amount": {
      "currency": "EUR",
      "value": "24.20"
    },
    "interval": "1 month",
    "description": "GrowSocial Leads - Monthly Subscription"
  }' | jq
```

**Expected Response:**
```json
{
  "success": true,
  "subscription": {
    "id": "sub_xxx",
    "status": "active",
    "amount": {
      "currency": "EUR",
      "value": "24.20"
    },
    "interval": "1 month",
    "customerId": "cst_xxx",
    "mandateId": "mdt_xxx"
  }
}
```

## 🔍 **Step 4: Verify in Database**

```bash
# Check if mandate was saved
curl -s http://localhost:3000/api/payments/methods | jq '.paymentMethods[] | select(.type == "sepa")'

# Check if subscription was saved
curl -s http://localhost:3000/api/subscriptions | jq
```

## 🎯 **Step 5: Test Automatic Billing Service**

Let's test the automatic billing service that processes monthly leads:

```bash
# This will test the automatic billing for accepted leads
curl -X POST http://localhost:3000/api/admin/test-billing \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie-here" \
  -d '{
    "userId": "your-user-id-here"
  }' | jq
```

## 🔔 **Step 6: Test Webhook Handling**

### **Simulate Payment Webhook:**
```bash
curl -X POST http://localhost:3000/api/webhooks/mollie \
  -H "Content-Type: application/json" \
  -d '{
    "id": "tr_test123",
    "status": "paid",
    "amount": {
      "currency": "EUR",
      "value": "24.20"
    },
    "customerId": "cst_xxx",
    "metadata": {
      "user_id": "your-user-id",
      "billing_type": "manual_recurring_charge"
    }
  }' | jq
```

### **Simulate Subscription Webhook:**
```bash
curl -X POST http://localhost:3000/api/webhooks/mollie/subscription \
  -H "Content-Type: application/json" \
  -d '{
    "id": "sub_test123",
    "status": "active",
    "customerId": "cst_xxx"
  }' | jq
```

## 🚨 **Common Issues & Solutions**

### **Issue 1: "SEPA not activated"**
```bash
# Check health status
curl -s http://localhost:3000/api/health/mollie | jq '.mollie.paymentMethods.sepaAvailable'

# Solution: Activate SEPA in Mollie Dashboard
```

### **Issue 2: "No valid mandate found"**
```bash
# Check if mandate exists
curl -s http://localhost:3000/api/payments/methods | jq '.paymentMethods[] | select(.type == "sepa")'

# Solution: Create mandate first (Step 1)
```

### **Issue 3: "Mandate not valid"**
```bash
# Check mandate status in Mollie
# Solution: Wait for mandate to be validated, or create a new one
```

## 📊 **Monitoring & Debugging**

### **Check Logs:**
```bash
# Monitor server logs
tail -f logs/combined.log | grep -i "sepa\|mollie\|mandate"

# Check for errors
tail -f logs/error.log | grep -i "sepa\|mollie"
```

### **Health Check:**
```bash
# Full health check
curl -s http://localhost:3000/api/health/mollie | jq

# Quick SEPA check
curl -s http://localhost:3000/api/health/mollie | jq '.mollie.paymentMethods.sepaAvailable'
```

## 🎯 **Complete Test Sequence**

Run this complete test sequence:

```bash
#!/bin/bash

echo "🧪 Starting SEPA Testing Sequence..."

# 1. Health check
echo "1️⃣ Health Check..."
curl -s http://localhost:3000/api/health/mollie | jq '.mollie.paymentMethods.sepaAvailable'

# 2. Create mandate (you'll need to do this via frontend first)
echo "2️⃣ Create SEPA Mandate (via frontend)..."

# 3. Test recurring payment
echo "3️⃣ Test Recurring Payment..."
curl -X POST http://localhost:3000/api/billing/charge \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d '{"amount": {"currency": "EUR", "value": "24.20"}, "description": "Test"}' | jq

# 4. Test subscription
echo "4️⃣ Test Subscription..."
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d '{"amount": {"currency": "EUR", "value": "24.20"}, "interval": "1 month"}' | jq

echo "✅ Testing complete!"
```

## 🔑 **Getting Session Cookie**

To get your session cookie for API testing:

1. Open browser dev tools (F12)
2. Go to Application/Storage → Cookies
3. Copy the `connect.sid` value
4. Use it in your curl commands: `-H "Cookie: connect.sid=your-cookie-value"`

## 🎉 **Success Indicators**

✅ **Mandate Created:** Response with `mollieMandateId`  
✅ **Recurring Payment:** Response with `sequenceType: "recurring"`  
✅ **Subscription:** Response with `status: "active"`  
✅ **Webhook:** Response with `200 OK`  
✅ **Health Check:** `sepaAvailable: true`

Your SEPA Direct Debit implementation is working correctly when all these tests pass! 🚀
