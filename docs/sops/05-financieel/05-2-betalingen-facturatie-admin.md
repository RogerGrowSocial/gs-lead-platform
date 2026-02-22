# SOP 05.2 – Betalingen en facturatie (admin)

**Doel:** Betalingen bekijken, goedkeuren/afwijzen en facturen beheren in het admin-panel.

**Doelgroep:** Admins en financieel.

---

## Betalingen bekijken

1. Ga naar **Admin → Betalingen** (`/admin/payments`).
2. Overzicht met filters: gebruiker, status, datumbereik.
3. Klik op een betaling voor details.

---

## Betaling verwerken

- **In behandeling (pending):** goedkeuren of afwijzen.
- **Goedkeuren:** betaling wordt verwerkt (Mollie/SEPA volgens configuratie).
- **Afwijzen:** betaling wordt geweigerd; indien van toepassing krijgt de gebruiker een melding.
- **Terugbetaling:** indien ondersteund via Mollie-dashboard of admin-actie.

---

## Facturatie (SEPA / postpaid)

- **Facturen genereren:** aan het einde van de maand of handmatig; totaal op basis van goedgekeurd verbruik (o.a. `v_monthly_lead_usage`, `approved_amount`).
- **Factuur versturen:** per e-mail naar de partner.
- **Als betaald markeren:** na ontvangst van betaling; status bijwerken.
- **Export:** voor boekhouding (CSV/PDF indien ondersteund).

---

## Prepaid (kaart)

- Saldo staat op het profiel (`profiles.balance`).
- Bij acceptatie van een lead: controle of saldo ≥ leadprijs; afschrijving.
- Bij onvoldoende saldo: toewijzing geweigerd; gebruiker moet opladen.

---

## Quota en capaciteit

- Zonder **actieve betaalmethode** heeft een partner 0 capaciteit (geen leads).
- Quota: maandlimiet leads (`subscriptions.leads_per_month`); bij bereikt quota geen nieuwe toewijzing tot volgende periode of verhoging.

---

**Gerelateerd:** [SOP 05.1 – Factuurimport](05-1-factuurimport.md), [SOP 05.3 – Rabobank](05-3-rabobank-api-koppelen.md), `docs/03-flows/admin_flows.md` (Billing & Payments)
