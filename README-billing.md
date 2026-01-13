# Billing API & UI Documentation

## Overzicht

Deze implementatie biedt een complete billing API en UI voor het GrowSocial Lead Platform. Het systeem ondersteunt twee betaalroutes:

- **SEPA (Postpaid)**: Maandelijkse facturatie aan het eind van de maand
- **Card/Credit (Prepaid)**: Gebruik van `profiles.balance` - zonder saldo geen nieuwe leads

## Database Functies

Het systeem gebruikt de volgende database functies en views:

- `public.v_monthly_lead_usage` - View voor maandelijks lead gebruik
- `public.get_billing_snapshot(p_user uuid) -> jsonb` - Billing snapshot per gebruiker
- `public.can_allocate_lead(p_user uuid, p_price numeric) -> text` - Controleert of een lead kan worden toegewezen

## API Routes

### GET /api/billing/snapshot

Haalt het billing snapshot op voor de ingelogde gebruiker.

**Response:**
```json
{
  "snapshot": {
    "user_id": "uuid",
    "period_month": "2024-01",
    "monthly_quota": 100,
    "approved_count": 25,
    "approved_amount": 125.50,
    "balance": 50.00,
    "payment_method": "card"
  }
}
```

**Curl voorbeeld:**
```bash
curl -X GET "http://localhost:3000/api/billing/snapshot" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### PUT /api/subscription/quota

Update de maandelijkse lead quota voor de gebruiker.

**Request Body:**
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

**Curl voorbeeld:**
```bash
curl -X PUT "http://localhost:3000/api/subscription/quota" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"leadsPerMonth": 150}'
```

### POST /api/leads/allocate-check

Controleert of een lead kan worden toegewezen voor de gegeven prijs.

**Request Body:**
```json
{
  "price": 5.50
}
```

**Response:**
```json
{
  "result": "OK"
}
```

Mogelijke resultaten:
- `"OK"` - Lead kan worden toegewezen
- `"QUOTA_REACHED"` - Maandelijkse quota is bereikt
- `"INSUFFICIENT_FUNDS"` - Onvoldoende saldo (voor card payments)

**Curl voorbeeld:**
```bash
curl -X POST "http://localhost:3000/api/leads/allocate-check" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"price": 5.50}'
```

## React Components

### LeadQuotaSlider

Een interactieve slider component voor het beheren van lead quota.

```tsx
import LeadQuotaSlider from '@/components/billing/LeadQuotaSlider'

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <LeadQuotaSlider 
        initialQuota={100}
        onSaved={(newQuota) => console.log('Quota updated:', newQuota)}
      />
    </div>
  )
}
```

**Features:**
- Real-time quota aanpassing (0-1000 leads)
- Gebruik voortgang indicator
- Waarschuwingen bij ≥80% gebruik
- "Limiet bereikt" label bij 100% gebruik
- Saldo waarschuwing voor card payments
- Optimistic UI updates

### MonthlyUsageCard

Toont maandelijks gebruik en statistieken.

```tsx
import MonthlyUsageCard from '@/components/billing/MonthlyUsageCard'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <MonthlyUsageCard />
    </div>
  )
}
```

**Features:**
- Maandelijks gebruik overzicht
- Circulaire voortgang indicator
- Uitgegeven bedrag weergave
- Saldo weergave (voor card payments)
- Reset informatie

## Hooks

### useBillingSnapshot

```tsx
import { useBillingSnapshot } from '@/hooks/useBillingSnapshot'

function MyComponent() {
  const { data, isLoading, error, refresh } = useBillingSnapshot()
  
  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  
  return <div>Quota: {data?.monthly_quota}</div>
}
```

### useQuotaMutation

```tsx
import { useQuotaMutation } from '@/hooks/useQuotaMutation'

function QuotaForm() {
  const { mutate, isPending, error } = useQuotaMutation()
  
  const handleSubmit = async (quota: number) => {
    try {
      await mutate(quota)
      // Success handling
    } catch (error) {
      // Error handling
    }
  }
}
```

### useAllocateCheck

```tsx
import { useAllocateCheck } from '@/hooks/useAllocateCheck'

function LeadForm() {
  const { checkAllocation, isPending } = useAllocateCheck()
  
  const handleCheck = async (price: number) => {
    try {
      const result = await checkAllocation(price)
      if (result === 'OK') {
        // Proceed with lead allocation
      } else {
        // Show appropriate warning
      }
    } catch (error) {
      // Handle error
    }
  }
}
```

## Complete Page Example

```tsx
import LeadQuotaSlider from '@/components/billing/LeadQuotaSlider'
import MonthlyUsageCard from '@/components/billing/MonthlyUsageCard'

export default function BillingPage() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Billing & Quota</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MonthlyUsageCard />
        <LeadQuotaSlider />
      </div>
    </div>
  )
}
```

## Error Handling

### HTTP Status Codes

- `200` - Success
- `400` - Validation error (invalid input)
- `401` - Unauthorized (not logged in)
- `500` - Internal server error

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "path": ["leadsPerMonth"],
        "message": "Expected number, received string"
      }
    ]
  }
}
```

## Troubleshooting

### 401 Unauthorized
- Gebruiker is niet ingelogd
- Controleer of Supabase auth correct is geconfigureerd
- Verificeer dat de access token geldig is

### 500 Internal Server Error
- Database functie bestaat niet of heeft een fout
- Controleer Supabase logs voor meer details
- Verificeer dat alle benodigde tabellen en functies bestaan

### Component Loading Issues
- Controleer of alle hooks correct zijn geïmporteerd
- Verificeer dat de API routes bereikbaar zijn
- Controleer browser console voor JavaScript errors

## Environment Variables

Zorg ervoor dat de volgende environment variables zijn ingesteld:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Dependencies

Deze implementatie gebruikt de volgende packages:

- `@supabase/ssr` - Supabase server-side rendering
- `zod` - Schema validatie
- `next` - Next.js framework
- `react` - React library
- `tailwindcss` - Styling (optioneel, kan worden vervangen)

## Database Schema Requirements

Zorg ervoor dat de volgende tabellen en functies bestaan:

```sql
-- Tables
subscriptions(leads_per_month, user_id, created_at, status)
profiles(id, balance, payment_method, ...)
leads(..., status, approved_at, created_at, price_at_purchase)
invoices(...)
invoice_lines(...)

-- Views
public.v_monthly_lead_usage

-- Functions
public.get_billing_snapshot(p_user uuid) -> jsonb
public.can_allocate_lead(p_user uuid, p_price numeric) -> text
```
