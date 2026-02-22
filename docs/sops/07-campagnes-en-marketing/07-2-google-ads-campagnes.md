# SOP 07.2 – Google Ads-campagnes (admin)

**Doel:** Google Ads Manager Account (MCC) koppelen, campagnes bekijken en aanmaken, budgetten beheren.

**Doelgroep:** Admins en marketing.

---

## Google Ads (MCC) koppelen

1. In admin: **Integraties** of **Google Ads**-instellingen.
2. Koppel het **Manager Account (MCC)** met de juiste OAuth/credentials.
3. Systeem synchroniseert partner-accounts onder het MCC.
4. Zorg dat in `.env` de juiste Google Ads-variabelen staan (zie `GOOGLE_ADS_ENV_VARIABLES.md` of projectdocumentatie).

---

## Campagnes bekijken

1. Ga naar **Admin → Campagnes** (of Google Ads-dashboard in de app).
2. Bekijk campagnes per partner-account.
3. Filters: partner, segment, status, datum.

---

## Nieuwe campagne aanmaken

1. Selecteer **partner** (account).
2. Kies **segment** (branche + regio).
3. Stel **budget** en **targeting** in (locatie, zoekwoorden, enz. afhankelijk van de app).
4. Start aanmaak → systeem maakt campagne aan via Google Ads API.
5. Campagne verschijnt in het dashboard.

---

## Budget en optimalisatie

- Systeem kan **targets per segment** gebruiken om budgetvoorstellen te doen.
- Admin bekijkt target vs. werkelijk; goedkeurt of wijst budgetaanpassingen af.
- Budgetwijzigingen worden via de API naar Google Ads doorgevoerd.

---

## Troubleshooting

- **Toegang/URL-fouten:** zie `GOOGLE_ADS_*` docs (URL validation, permissions).
- **API-fouten:** controleer client ID/secret/refresh token en rate limits.

---

**Gerelateerd:** [SOP 07.1 – Lead Flow en targets](07-1-lead-flow-targets.md), `docs/03-flows/admin_flows.md` (Campaign Management), `GOOGLE_ADS_SETUP.md`
