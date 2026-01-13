# Webhooks

**Last Updated:** 2025-01-28

---

## Overview

Webhooks receive events from external services (Mollie, etc.) and update the platform accordingly.

**Security:** Webhooks should verify signatures/authentication from the source.

---

## Mollie Webhooks

### `POST /api/webhooks/mollie`
**Purpose:** Receive payment status updates from Mollie

**Auth:** Public (verified via Mollie signature)

**Request Headers:**
- Mollie sends payment status updates
- Verify signature if configured

**Request Body:**
```json
{
  "id": "tr_xxx",
  "status": "paid",
  "amount": {
    "value": "50.00",
    "currency": "EUR"
  },
  "metadata": {
    "user_id": "uuid"
  }
}
```

**Actions:**
- Update payment status in database
- Update user balance (if prepaid)
- Send notification (if configured)

**Location:** `routes/webhooks.js`

**Status Values:**
- `open`: Payment created, awaiting payment
- `paid`: Payment completed
- `failed`: Payment failed
- `canceled`: Payment canceled
- `expired`: Payment expired

---

## Webhook Security

### Mollie Signature Verification
**Status:** Check if implemented

**How it works:**
1. Mollie signs webhook payload with secret key
2. Platform verifies signature before processing
3. Reject if signature doesn't match

**Implementation:** Check `routes/webhooks.js` for signature verification

---

## Webhook Processing

### Idempotency
**Principle:** Process each webhook only once.

**How:**
- Store webhook ID in database
- Check if already processed before handling
- Prevent duplicate processing

**Location:** Check webhook handler for idempotency logic

---

## Future Webhooks

### Google Ads Webhooks (Planned)
**Purpose:** Receive campaign performance updates

**Status:** Not implemented yet

**Potential Events:**
- Campaign status changes
- Budget alerts
- Performance thresholds

---

## Testing Webhooks

### Local Testing
**Tool:** ngrok or similar tunnel

**Steps:**
1. Start local server
2. Create tunnel: `ngrok http 3000`
3. Configure webhook URL in Mollie dashboard
4. Test payment to trigger webhook

### Mollie Test Mode
**Use:** Mollie test API keys for development

**Test Payment IDs:**
- `tr_xxx` (test transaction IDs)

---

## Webhook Logging

### Log All Webhooks
**Purpose:** Debug webhook issues

**Location:** Check `SystemLogService` for webhook logging

**Log:**
- Webhook payload
- Processing result
- Errors

---

## Related Documentation

- **API Endpoints:** `/docs/02-api/endpoints.md`
- **Payments:** `README-billing.md` (root)

