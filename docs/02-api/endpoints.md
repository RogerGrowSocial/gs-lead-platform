# API Endpoints

**Last Updated:** 2025-01-28

---

## Overview

The API uses RESTful patterns with Express.js. Most endpoints require authentication via session (cookie-based).

**Base URL:** `/api` (or full URL in production)

**Authentication:** Session-based (not JWT). Use `requireAuth` middleware.

**Response Format:**
- Success: `{ ok: true, data: {...} }` or direct data
- Error: `{ ok: false, error: "message" }` or `{ error: "message" }`

---

## Authentication Endpoints

### `POST /api/auth/login`
**Purpose:** User login

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password"
}
```

**Response:**
```json
{
  "ok": true,
  "user": { "id": "uuid", "email": "...", ... }
}
```

**Location:** `routes/auth.js`

---

### `POST /api/auth/logout`
**Purpose:** User logout

**Response:** `{ ok: true }`

**Location:** `routes/auth.js`

---

### `POST /api/auth/signup`
**Purpose:** User registration

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password",
  "company_name": "Company Name"
}
```

**Response:**
```json
{
  "ok": true,
  "user": { "id": "uuid", ... }
}
```

**Location:** `routes/auth.js`

---

## Profile Endpoints

### `GET /api/profiles`
**Purpose:** List all profiles (admin only)

**Auth:** `requireAuth`, `isAdmin`

**Response:** Array of profiles

**Location:** `routes/api.js`

---

### `GET /api/profiles/search?q=query`
**Purpose:** Search profiles by name/email

**Auth:** `requireAuth`

**Query Params:**
- `q`: Search query (min 2 chars)

**Response:** Array of matching profiles

**Location:** `routes/api.js`

---

### `GET /api/profiles/:id`
**Purpose:** Get profile by ID

**Auth:** Public (or requireAuth)

**Response:** Profile object

**Location:** `routes/api.js`

---

## Lead Endpoints

### `POST /api/leads/public`
**Purpose:** Create lead from public form (no auth required)

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+31612345678",
  "message": "I need a painter",
  "industry_id": "uuid",
  "province": "Noord-Brabant",
  "postcode": "5000AA"
}
```

**Response:**
```json
{
  "ok": true,
  "lead": { "id": "uuid", ... }
}
```

**Location:** `routes/leads.js` or `routes/api.js`

**Note:** Auto-assignment if `routing_mode = 'ai_segment_routing'`

---

### `GET /api/leads`
**Purpose:** List leads (filtered by user role)

**Auth:** `requireAuth`

**Query Params:**
- `status`: Filter by status
- `industry_id`: Filter by industry
- `limit`: Pagination limit
- `offset`: Pagination offset

**Response:** Array of leads

**Location:** `routes/leads.js` or `routes/api.js`

---

### `GET /api/leads/:id`
**Purpose:** Get lead by ID

**Auth:** `requireAuth` (partners see only assigned leads; admins see all)

**Response:** Lead object

**Location:** `routes/leads.js` or `routes/api.js`

---

### `PUT /api/leads/:id`
**Purpose:** Update lead (status, assignment, etc.)

**Auth:** `requireAuth`

**Request:**
```json
{
  "status": "accepted",
  "user_id": "partner-uuid"
}
```

**Response:** Updated lead object

**Location:** `routes/leads.js` or `routes/api.js`

---

### `POST /api/admin/leads/:id/auto-assign`
**Purpose:** Auto-assign lead via AI router

**Auth:** `requireAuth`, `isAdmin`

**Response:**
```json
{
  "ok": true,
  "assigned_to": "partner-uuid",
  "score": 85
}
```

**Location:** `routes/api.js`

---

### `GET /api/admin/leads/:id/recommendations`
**Purpose:** Get AI router recommendations (top 5 partners)

**Auth:** `requireAuth`, `isAdmin`

**Response:**
```json
{
  "recommendations": [
    {
      "partner_id": "uuid",
      "score": 85,
      "reasons": ["branch_match", "region_match", ...]
    },
    ...
  ]
}
```

**Location:** `routes/api.js`

---

## Billing Endpoints

### `GET /api/billing/snapshot`
**Purpose:** Get billing snapshot for current user

**Auth:** `requireAuth`

**Response:**
```json
{
  "snapshot": {
    "user_id": "uuid",
    "period_month": "2025-01",
    "monthly_quota": 100,
    "approved_count": 25,
    "approved_amount": 125.50,
    "balance": 50.00,
    "payment_method": "card"
  }
}
```

**Location:** `routes/api.js` or `routes/payments.js`

---

### `POST /api/leads/allocate-check`
**Purpose:** Check if lead can be allocated (quota/balance check)

**Auth:** `requireAuth`

**Request:**
```json
{
  "price": 5.50
}
```

**Response:**
```json
{
  "result": "OK"  // or "QUOTA_REACHED" or "INSUFFICIENT_FUNDS"
}
```

**Location:** `routes/api.js`

---

### `PUT /api/subscription/quota`
**Purpose:** Update monthly lead quota

**Auth:** `requireAuth`

**Request:**
```json
{
  "leadsPerMonth": 150
}
```

**Response:**
```json
{
  "ok": true,
  "leadsPerMonth": 150
}
```

**Location:** `routes/subscriptions.js` or `routes/api.js`

---

## Onboarding Endpoints

### `GET /api/onboarding/status`
**Purpose:** Get onboarding status for current user

**Auth:** `requireAuth`

**Response:**
```json
{
  "step": 2,
  "completed": false,
  "progress": 66
}
```

**Location:** `routes/api.js`

---

### `POST /api/onboarding/step`
**Purpose:** Update onboarding step

**Auth:** `requireAuth`

**Request:**
```json
{
  "step": 3
}
```

**Response:** `{ ok: true }`

**Location:** `routes/api.js`

---

### `POST /api/onboarding`
**Purpose:** Save onboarding data

**Auth:** `requireAuth`

**Request:**
```json
{
  "first_name": "John",
  "company_name": "Company",
  "lead_industries": ["schilder"],
  ...
}
```

**Response:** `{ ok: true }`

**Location:** `routes/api.js`

---

### `POST /api/onboarding/complete`
**Purpose:** Mark onboarding as complete

**Auth:** `requireAuth`

**Response:** `{ ok: true }`

**Location:** `routes/api.js`

---

## Admin Endpoints

### `GET /api/admin/leadstroom/overview`
**Purpose:** Get lead flow overview (targets, capacity, etc.)

**Auth:** `requireAuth`, `isAdmin`

**Response:** Complex object with segment data, targets, capacity

**Location:** `routes/api.js`

---

### `GET /api/admin/ai-router/settings`
**Purpose:** Get AI router settings

**Auth:** `requireAuth`, `isAdmin`

**Response:**
```json
{
  "region_weight": 80,
  "performance_weight": 40,
  "fairness_weight": 60
}
```

**Location:** `routes/api.js`

---

### `POST /api/admin/ai-router/settings`
**Purpose:** Update AI router settings

**Auth:** `requireAuth`, `isAdmin`

**Request:**
```json
{
  "region_weight": 80,
  "performance_weight": 40,
  "fairness_weight": 60
}
```

**Response:** `{ ok: true }`

**Location:** `routes/api.js`

---

## Payment Endpoints

### `GET /api/payments`
**Purpose:** List payments for current user

**Auth:** `requireAuth`

**Response:** Array of payment records

**Location:** `routes/payments.js`

---

### `POST /api/payments`
**Purpose:** Create payment (Mollie)

**Auth:** `requireAuth`

**Request:**
```json
{
  "amount": 50.00,
  "method": "card"
}
```

**Response:**
```json
{
  "ok": true,
  "payment_url": "https://mollie.com/checkout/...",
  "payment_id": "mollie-id"
}
```

**Location:** `routes/payments.js`

---

## Webhook Endpoints

See `/docs/02-api/webhooks.md` for webhook endpoints.

---

## Error Handling

### Standard Error Response
```json
{
  "ok": false,
  "error": "Error message"
}
```

### HTTP Status Codes
- `200`: Success
- `400`: Bad Request (validation error)
- `401`: Unauthorized (not authenticated)
- `403`: Forbidden (not authorized)
- `404`: Not Found
- `500`: Internal Server Error

---

## Related Documentation

- **Webhooks:** `/docs/02-api/webhooks.md`
- **Architecture:** `/docs/00-context/architecture.md`

