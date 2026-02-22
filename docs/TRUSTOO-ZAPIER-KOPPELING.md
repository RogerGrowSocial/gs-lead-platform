# Trustoo koppelen via Zapier

Met deze stappen stuur je nieuwe Trustoo-leads automatisch naar GrowSocial als kansen (Opportunity Streams).

---

## Stap 1: Kansenstroom aanmaken in GrowSocial

1. Ga in GrowSocial naar **Sales → Kansenstromen → Nieuwe stroom**.
2. Vul in:
   - **Naam:** bijv. "Trustoo productie"
   - **Type:** Trustoo
   - **Veldkoppeling:** laat de standaard staan (of pas aan als Trustoo andere veldnamen stuurt).
   - **Secret:** kies een sterk wachtwoord en bewaar het; je hebt het nodig in Zapier.
3. Klik op **Aanmaken**.
4. **Bewaar de Webhook URL en het Secret** (eenmalig zichtbaar).  
   Voorbeeld Webhook URL: `https://jouw-domein.nl/api/ingest/opportunities/<uuid>`.

---

## Stap 2: Trustoo en Zapier verbinden

1. Open deze link (van Trustoo) om Trustoo met Zapier te koppelen:  
   **https://zapier.com/developer/public-invite/187957/937f445eea52d64ff791cb1998d8bcee/**
2. Log in bij Zapier of maak een (gratis) account aan.
3. Volg de instructies om Trustoo te autoriseren.

---

## Stap 3: Zap aanmaken met Trustoo als trigger

1. In Zapier: **Create Zap** (of **Zap maken**).
2. **Trigger:**
   - App: **Trustoo**
   - Trigger event: **New Lead** (of vergelijkbaar).
   - Klik op **Continue**, dan **Sign in** en voer de door Trustoo gegeven code in, bijv.:  
     `55dcb1936ede2d0613d34859c32f0d57`
   - Test de trigger zodat je een voorbeeldlead ziet.

---

## Stap 4: Action – Webhook naar GrowSocial

1. **Action:** kies de app **Webhooks by Zapier**.
2. **Action event:** kies **POST**.
3. Vul in:
   - **URL:** de Webhook URL uit Stap 1 (uit GrowSocial), bijv.  
     `https://jouw-domein.nl/api/ingest/opportunities/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - **Payload Type:** **JSON**
   - **Data:** koppel de Trustoo-velden naar een JSON-body. Gebruik de veldnamen die je in de GrowSocial-veldkoppeling hebt ingesteld (standaard o.a.):
     - `company_name` → Trustoo-veld voor bedrijfsnaam
     - `contact_name` → Trustoo-veld voor contactpersoon
     - `email` → Trustoo-veld voor e-mail
     - `phone` → Trustoo-veld voor telefoon
     - `message` → Trustoo-veld voor bericht/omschrijving
   - **Headers:** voeg een header toe:
     - **Key:** `X-Stream-Secret`
     - **Value:** het Secret uit Stap 1 (uit GrowSocial)

4. **Test** de action; controleer in GrowSocial bij **Sales → Kansen** of er een nieuwe kans is aangemaakt (en bij de stroom in **Kansenstromen** of het event in de log staat).

5. Zet de Zap **Aan**.

---

## Voorbeeld JSON-body in Zapier (Webhooks by Zapier)

Als Trustoo bijvoorbeeld velden levert zoals `Company Name`, `Contact`, `Email`, `Phone`, `Message`:

```json
{
  "company_name": "<veld Company Name uit Trustoo>",
  "contact_name": "<veld Contact uit Trustoo>",
  "email": "<veld Email uit Trustoo>",
  "phone": "<veld Phone uit Trustoo>",
  "message": "<veld Message uit Trustoo>"
}
```

In Zapier kies je bij elk veld de bijbehorende Trustoo-data (uit de trigger-stap). De exacte veldnamen kunnen per Trustoo-account iets verschillen; pas de koppeling aan op wat je in de trigger-test ziet.

---

## Troubleshooting

- **403 / Unauthorized:** controleer of de header `X-Stream-Secret` exact overeenkomt met het secret van de stroom in GrowSocial (geen spaties, juiste stream).
- **Geen kans aangemaakt:** bekijk bij de stroom **Event logs** (success/error). Foutmelding en payload helpen bij aanpassen van de veldkoppeling of JSON.
- **Dubbele kansen:** gebruik in de payload een `idempotency_key` of `external_id` (bijv. Trustoo lead-id) zodat dezelfde lead niet dubbel wordt aangemaakt.
