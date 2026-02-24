# Betalingen en banksysteem – Volledige documentatie

**Platform:** GrowSocial Lead Platform  
**Laatste update:** februari 2025

---

## 1. Overzicht

Het platform combineert **prepaid** (saldo/kaart) en **postpaid** (SEPA incasso) met één payment provider (**Mollie**) en een optionele **Rabobank API**-koppeling voor rekeninginformatie (geen betalingen via Rabobank).

| Onderdeel | Technologie | Doel |
|-----------|-------------|------|
| Betalingen (iDEAL, SEPA, creditcard) | Mollie | Incasso’s, saldo-opwaardering, mandate-verificatie |
| Saldo (prepaid) | `profiles.balance` | Afschrijving bij acceptatie lead |
| SEPA-mandaten | Mollie Customers + Mandates | Maandelijkse incasso, eerste/terugkerende betalingen |
| Rekening koppelen (optioneel) | Rabobank PSD2 OAuth | Alleen koppelen/tonen rekening; geen betalingen via Rabobank |

---

## 2. Architectuur

### 2.1 Gegevensstromen

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GEBRUIKER (Partner)                                  │
└─────────────────────────────────────────────────────────────────────────────┘
        │
        │  Betaalmethode toevoegen          Saldo opwaarderen        Lead accepteren
        ▼                                       ▼                            ▼
┌───────────────┐  ┌──────────────────┐  ┌──────────────┐  ┌─────────────────────────┐
│ SEPA (IBAN)   │  │ Creditcard       │  │ Top-up       │  │ Lead acceptatie          │
│ → Mollie      │  │ → Mollie         │  │ → Mollie     │  │ → Saldo check / SEPA      │
│ mandate       │  │ first payment    │  │ (recurring   │  │   / hybride (saldo+SEPA)  │
│ (directdebit) │  │ 0,01 €           │  │  of first)   │  │ → profiles.balance       │
└───────────────┘  └──────────────────┘  └──────────────┘  └─────────────────────────┘
        │                   │                     │                      │
        └───────────────────┴─────────────────────┴──────────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MOLLIE                                          │
│  Customers, Mandates, Payments (one-off + recurring), iDEAL, directdebit    │
└─────────────────────────────────────────────────────────────────────────────┘
        │
        │  Webhook: POST /api/webhooks/mollie
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PLATFORM (Node/Express)                              │
│  • payment status → payments tabel                                           │
│  • paid → profiles.balance (top-up + of automatic billing -)                 │
│  • leads markeren als paid (automatic billing)                                │
│  • payment_methods status (creditcard verificatie)                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Rabobank (alleen koppeling)

```
Gebruiker → /auth/rabobank/connect → Rabobank OAuth → callback
    → token + account info → bank_connections (Supabase)
```

- **Niet** gebruikt voor het initiëren van betalingen.
- Alleen: rekening koppelen, IBAN/rekeningnaam ophalen, opslaan in `bank_connections`.
- SEPA-incasso’s lopen uitsluitend via Mollie (IBAN + mandaat bij Mollie).

---

## 3. Database

### 3.1 Relevante tabellen

| Tabel | Doel |
|-------|------|
| **profiles** | `balance` (prepaid saldo), `mollie_customer_id`, `payment_method` (legacy/weergave) |
| **payment_methods** | Per gebruiker: type (sepa, credit_card, ideal, paypal), Mollie mandate/payment ID, status, is_default |
| **payments** | Alle betalingen: amount, status, payment_details (mollie_payment_id, billing_type, etc.) |
| **bank_connections** | Alleen Rabobank OAuth: user_id, provider, access/refresh token, account_iban, account_name |
| **invoices** | Facturen o.a. na automatische incasso: user_id, invoice_number, amount, status, due_date |
| **billing_settings** | Eén rij: is_active, billing_date, billing_time, timezone voor automatische incasso-cron |
| **subscriptions** | Per gebruiker: leads_per_month, status, is_paused (gebruikt o.a. door automatic billing) |
| **leads** | status (accepted → paid na incasso), price_at_purchase, paid_at |

### 3.2 payment_methods

- **provider:** `mollie`
- **type:** `sepa` | `credit_card` | `ideal` | `paypal` (enum; mapping via `helpers/method-map.js`: directdebit→sepa, creditcard→credit_card)
- **provider_payment_method_id:** Mollie mandate ID (SEPA) of payment ID (creditcard-verificatie)
- **status:** `active` | `pending` | `failed`
- **is_default:** welke methode gebruikt wordt voor incasso/top-up

### 3.3 payments.payment_details (JSONB)

O.a.:

- `mollie_payment_id`, `customer_id`, `mandate_id`, `sequence_type`, `method`
- `payment_type`: `topup` | anders
- `billing_type`: o.a. `automatic_monthly_accepted_leads` voor maandelijkse SEPA-incasso

Webhook gebruikt o.a. `payment_type === 'topup'` (saldo erbij) en `billing_type === 'automatic_monthly_accepted_leads'` (saldo eraf, leads op paid).

### 3.4 bank_connections (Rabobank)

- `user_id`, `provider` = `'rabobank'`
- `access_token`, `refresh_token`, `token_expires_at`
- `account_iban`, `account_name`, `connection_status`
- Uniek op `(user_id, provider, account_iban)`.

---

## 4. Mollie-integratie

### 4.1 Client

- **Bestand:** `lib/mollie.js`
- **Package:** `@mollie/api-client`
- **Config:** `process.env.MOLLIE_API_KEY` (test: `test_...`, live: `live_...`)

### 4.2 Gebruikte concepten

- **Customers** – één per gebruiker; `profiles.mollie_customer_id`
- **Mandates** – SEPA (directdebit) of creditcard; opgeslagen in `payment_methods.provider_payment_method_id`
- **Payments** – one-off of recurring (`sequenceType`: `first` | `recurring`)
- **iDEAL** – o.a. voor SEPA-mandate-verificatie (veilige flow, zie hieronder)

### 4.3 Methodemapping (Mollie → DB)

Zie `helpers/method-map.js`:

- `creditcard` → `credit_card`
- `ideal` → `ideal`
- `paypal` → `paypal`
- `directdebit` → `sepa`

---

## 5. Betaalmethodes toevoegen

### 5.1 SEPA (incasso)

Twee flows in de code:

1. **Veilig (aanbevolen): iDEAL-verificatie**  
   - Endpoint: `POST /api/payments/methods/sepa-mandate-ideal`  
   - Gebruiker vult IBAN (+ rekeningnaam, bank) in → platform start iDEAL-betaling (klein bedrag) → na succesvolle betaling wordt Mollie SEPA-mandaat aangemaakt en in `payment_methods` opgeslagen.  
   - Zo kan alleen de rekeninghouder een mandaat afgeven.

2. **Deprecated (onveilig): direct mandaat zonder bankverificatie**  
   - Endpoint: `POST /api/payments/methods/sepa-mandate`  
   - Alleen IBAN + BIC + naam naar Mollie; geen bankverificatie. Zie ook `SECURE_SEPA_IMPLEMENTATION.md`.

BIC-mapping (o.a. in `routes/api.js`): abn→ABNANL2A, ing→INGBNL2A, rabobank→RABONL2U, asn, bunq, knab, sns, triodos.

### 5.2 Creditcard

- Gebruiker stuurt card token (van frontend) naar `POST /api/payments/methods/creditcard` (api.js) of `POST /api/payments/methods/creditcard` (payments.js).
- Platform maakt bij Mollie een “first” payment (0,01 €) met `sequenceType: 'first'` voor verificatie.
- Na succes (redirect + webhook) wordt de betaalmethode in `payment_methods` gezet op `active`; daarna kunnen recurring payments (o.a. top-up) zonder redirect.

### 5.3 Bankrekening (UI: “Bankrekening toevoegen”)

- Frontend: `views/partials/payment-method-toggle.ejs` (bankkeuze: o.a. Rabobank, ABN, ING).
- Aanmelden gaat via bovenstaande SEPA-flows (Mollie); Rabobank-optie in de UI is alleen voor weergave/keuze bank, niet voor betalingen via Rabobank API.

---

## 6. Saldo (prepaid) en lead-acceptatie

### 6.1 Billingstrategie bij acceptatie

Logica o.a. in `routes/leads.js` en `routes/api.js` (lead accepteren / toewijzen):

1. **balance >= leadprijs** → `balance_only`: volledige afschrijving van saldo, geen SEPA.
2. **balance > 0 en SEPA-mandaat** → `balance_then_sepa`: eerst saldo maximal afschrijven, rest via SEPA (wordt later geïncasseerd).
3. **geen saldo, wel SEPA** → `sepa_only`: volledige bedrag via SEPA.
4. **geen saldo, geen SEPA** → fout: “Onvoldoende saldo en geen SEPA incasso beschikbaar”.

Leadprijs: `lead.price_at_purchase` of industry `price_per_lead` of default (bijv. 10 of 25).

### 6.2 Saldo-updates

- **Afschrijven bij acceptatie:** direct in `profiles.balance` (alleen het deel dat van saldo wordt betaald).
- **Bijwerken bij betaling:** in de Mollie-webhook:
  - **Top-up (payment_type topup):** balance += amount.
  - **Automatische incasso (billing_type automatic_monthly_accepted_leads):** balance -= amount; leads worden op `paid` gezet.

---

## 7. Saldo opwaarderen (top-up)

- **Routes:** o.a. `POST /api/payments/topup` (payments.js), `POST /dashboard/payments/topup` (dashboard.js).
- Flow:
  - Als er een geldige creditcard-mandate is: recurring payment zonder redirect (off-session).
  - Zo niet: “first” payment met redirect naar Mollie Checkout voor verificatie.
- Bedrag en beschrijving worden in `payments` gezet; na `paid` webhook wordt `profiles.balance` verhoogd.

---

## 8. Automatische incasso (maandelijkse SEPA)

### 8.1 Service

- **Bestand:** `services/automaticBillingService.js`
- **Methode:** `startBillingProcess()`

### 8.2 Stappen

1. **billing_settings** ophalen; als `is_active` niet true → stoppen.
2. **Actieve gebruikers** met actief abonnement (subscriptions, niet paused).
3. Per gebruiker:
   - Abonnement en **standaard betaalmethode** (payment_methods, type sepa, status active, is_default) ophalen.
   - **Bedrag** berekenen: geaccepteerde leads in de huidige maand, som van `price_at_purchase` (of industry price).
   - Als bedrag ≤ 0 → overslaan.
   - **Mollie recurring payment** aanmaken: `sequenceType: 'recurring'`, `mandateId`, `customerId`, `webhookUrl`.
   - Betaling in **payments** opslaan (o.a. billing_type, mollie_payment_id).
4. Bij webhook `paid`:
   - Saldo verlagen (`profiles.balance`).
   - Leads van die facturatie op `paid` zetten (`markLeadsAsPaid`).
   - **Factuur** aanmaken in `invoices`.

### 8.3 Cron

- **Bestand:** `services/billingCronJob.js`
- **Instellingen:** `billing_settings`: `billing_date`, `billing_time`, `timezone` (bijv. Europe/Amsterdam).
- Cron-expressie: maandelijks op die dag en tijd (bijv. `0 9 1 * *` = 1e van de maand 09:00).
- Cron moet gestart worden vanuit de app (geen aparte cron in deze doc).

---

## 9. Webhooks

### 9.1 Mollie: POST /api/webhooks/mollie

- **Bestand:** `routes/webhooks.js`
- **Body:** Mollie stuurt o.a. payment `id`; platform haalt payment op bij Mollie.

Verwerking:

1. **Verificatiebetaling (0,01 €, beschrijving bevat “verificatie”):**  
   `payment_methods` bijwerken op basis van payment status (o.a. active/failed).

2. **Overige betalingen:**  
   - Payment in DB zoeken via `payment_details.mollie_payment_id`.  
   - Status mappen: open/pending→pending, paid→paid, failed→failed, canceled→cancelled, expired→expired.  
   - Bij overgang naar **paid**:
     - **payment_type === 'topup'** → balance verhogen.
     - **billing_type === 'automatic_monthly_accepted_leads'** → balance verlagen, leads markeren als paid, eventueel activity log.
     - Anders: bestaande RPC/logica (bijv. `add_to_balance`).

- Altijd **200 OK** terug naar Mollie (ook bij interne fout), zodat Mollie niet blijft retryen.

### 9.2 Mollie Subscriptions

- `POST /api/webhooks/mollie/subscription`  
- Verwerkt status (active, cancelled, suspended) en werkt subscription-status in de database bij (o.a. `SubscriptionBillingService`).

---

## 10. Rabobank API (alleen koppeling)

### 10.1 Doel

- Rekening van de gebruiker koppelen via Rabobank PSD2 OAuth (Account Information).
- Geen betalingen initiëren via Rabobank; incasso’s lopen via Mollie.

### 10.2 Service

- **Bestand:** `services/rabobankApiService.js`
- **Functies:** o.a. `getAuthorizationUrl`, `exchangeCodeForToken`, `getAccountInformation`, `getAccountBalances`, `getAccountTransactions`; token refresh.
- **Beschikbaarheid:** `RabobankApiService.isAvailable()` = `RABOBANK_CLIENT_ID` en `RABOBANK_CLIENT_SECRET` gezet.

### 10.3 Auth-routes

- **GET /auth/rabobank/connect** – Start OAuth; state in session; redirect naar Rabobank.
- **GET /auth/rabobank/callback** – Code omwisselen voor token, rekeninginfo ophalen, rij in `bank_connections` upserten.
- **GET /auth/rabobank/disconnect** – Verwijderen van `bank_connections` voor deze gebruiker.

### 10.4 Environment

- `RABOBANK_CLIENT_ID`, `RABOBANK_CLIENT_SECRET`, `RABOBANK_SANDBOX_MODE` (true/false).
- Redirect URI in Rabobank Developer Portal:  
  `https://app.growsocialmedia.nl/auth/rabobank/callback` (productie) en eventueel `http://localhost:3000/auth/rabobank/callback` (dev).

---

## 11. API-endpoints (betalingen/bank) – overzicht

| Methode | Pad | Beschrijving |
|--------|-----|--------------|
| GET | /api/payments/methods | Lijst betaalmethodes (ingelogde gebruiker) |
| POST | /api/payments/methods/creditcard | Creditcard toevoegen (token → Mollie first payment) |
| POST | /api/payments/methods/bankaccount | SEPA-mandaat aanmaken (direct, deprecated) |
| POST | /api/payments/methods/sepa-mandate-ideal | SEPA-mandaat via iDEAL-verificatie |
| POST | /api/payments/methods/sepa-mandate | SEPA direct (deprecated) |
| GET | /api/payments/methods/mandate-status/:paymentId | Status mandate-verificatie (dev) |
| POST | /api/payments/methods/revoke-sepa-mandate | SEPA-mandaat intrekken bij Mollie |
| POST | /api/payments/methods/:id/set-default | Betaalmethode als default zetten |
| DELETE | /api/payments/methods/:id | Betaalmethode verwijderen |
| GET | /api/user/payment-methods | Betaalmethodes (alternatief endpoint) |
| POST | /api/payments/topup | Saldo opwaarderen (Mollie) |
| GET | /api/payments/status/:paymentId | Status van een betaling |
| POST | /api/payments/confirm/:paymentId | Handmatige bevestiging saldo (na succesvolle betaling) |
| POST | /api/webhooks/mollie | Mollie payment status |
| POST | /api/webhooks/mollie/subscription | Mollie subscription status |

Dashboard (voorbeeld):

- GET /dashboard/payments – Betaalpagina (saldo, top-up, bank toevoegen).
- GET /dashboard/settings/payment – Instellingen betalingen + overzicht betalingen.
- POST /dashboard/payments/topup – Top-up vanaf dashboard.

Admin:

- GET /admin/payments – Overzicht betalingen (filters, details).
- GET /admin/payments/invoices – Facturen.
- GET /admin/payments/mandates – Mandaten (indien geïmplementeerd).

---

## 12. Environment variables

| Variabele | Verplicht | Doel |
|-----------|-----------|------|
| MOLLIE_API_KEY | Ja | Mollie API key (test_ of live_) |
| MOLLIE_WEBHOOK_URL | Optioneel | Volledige webhook-URL (anders uit APP_URL opgebouwd) |
| APP_URL | Aanbevolen | Basis-URL (redirects, webhooks); bijv. https://app.growsocialmedia.nl |
| RABOBANK_CLIENT_ID | Voor Rabobank | OAuth client ID |
| RABOBANK_CLIENT_SECRET | Voor Rabobank | OAuth client secret |
| RABOBANK_SANDBOX_MODE | Voor Rabobank | true = sandbox, false = productie |

---

## 13. Beveiliging

- **SEPA:** Gebruik de iDEAL-verificatieroute (`sepa-mandate-ideal`); vermijd de directe SEPA-mandate zonder bankverificatie.
- **Webhooks:** Mollie-signatuurverificatie staat in de doc; in code controleren of die daadwerkelijk wordt toegepast.
- **Rabobank:** State in session bij OAuth; state/code exchange en opslag tokens alleen server-side; `bank_connections` via RLS beperkt tot eigen user_id.
- **Tokens:** Mollie customer ID en mandate IDs in DB; geen kaartnummers. Rabobank tokens in `bank_connections`; in productie overwegen encryptie van tokens.

---

## 14. Gerelateerde documenten

- **SOP Admin betalingen:** `docs/sops/05-financieel/05-2-betalingen-facturatie-admin.md`
- **Rabobank koppelen:** `docs/sops/05-financieel/05-3-rabobank-api-koppelen.md`, `RABOBANK_QUICK_START.md`
- **SEPA-veiligheid:** `SECURE_SEPA_IMPLEMENTATION.md`
- **Webhooks:** `docs/02-api/webhooks.md`
- **User/Admin flows:** `docs/03-flows/user_flows.md`, `docs/03-flows/admin_flows.md`

---

*Dit document beschrijft het huidige gedrag van het platform op basis van de codebase (routes, services, webhooks, DB). Wijzigingen in code kunnen deze beschrijving na verloop van tijd deels verouderen.*
