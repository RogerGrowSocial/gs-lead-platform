# Standard Operating Procedures (SOP's) – Interne handleidingen

**Doel:** Eén centrale plek voor alle processen en handleidingen die werknemers nodig hebben om in het GS Lead Platform te werken. Via deze documenten (en via de AI-assistent) kun je alle werkprocessen terugvinden.

**Laatste update:** februari 2026

---

## Categorieën

| Nr | Categorie | Beschrijving |
|----|-----------|--------------|
| 01 | [Onboarding en gebruikers](#01-onboarding-en-gebruikers) | Partner-onboarding, gebruikersbeheer, medewerkerpagina |
| 02 | [Tijdregistratie](#02-tijdregistratie) | Klantenwerk, Sales, Support – uren registreren en koppelen |
| 03 | [Leads en verkoop](#03-leads-en-verkoop) | Leadbeheer, AI-router, toewijzing, capaciteit, segmenten |
| 04 | [Tickets en support](#04-tickets-en-support) | Tickets aanmaken, beheren, taken, tijd koppelen |
| 05 | [Financieel](#05-financieel) | Factuurimport, betalingen, Rabobank, billing |
| 06 | [Systeem en techniek](#06-systeem-en-techniek) | Local setup, deploy, troubleshooting, backups |
| 07 | [Campagnes en marketing](#07-campagnes-en-marketing) | Lead flow, targets, Google Ads (admin) |
| 08 | [E-mail en communicatie](#08-email-en-communicatie) | Mail-inbox, AI-labeling, opportunities |

---

## 01 Onboarding en gebruikers

- [SOP 01.1 – Partner onboarding (flow)](01-onboarding-en-gebruikers/01-1-partner-onboarding.md) – Stappen die een nieuwe partner doorloopt na aanmelding.
- [SOP 01.2 – Gebruikersbeheer (admin)](01-onboarding-en-gebruikers/01-2-gebruikersbeheer-admin.md) – Gebruikers bekijken, aanmaken, bewerken, rol wijzigen.
- [SOP 01.3 – Medewerkerdetailpagina](01-onboarding-en-gebruikers/01-3-medewerkerdetailpagina.md) – Wat staat op de employee-detailpagina en welke data wordt getoond.

---

## 02 Tijdregistratie

- [SOP 02.1 – Tijdregistratie Klantenwerk](02-tijdregistratie/02-1-tijdregistratie-klantenwerk.md) – Uren registreren bij klantenwerk (taak, klant, titel).
- [SOP 02.2 – Tijdregistratie Sales](02-tijdregistratie/02-2-tijdregistratie-sales.md) – Sales-uren met activiteitstype en koppeling aan deal/kans/klant.
- [SOP 02.3 – Tijdregistratie Support (ticket verplicht)](02-tijdregistratie/02-3-tijdregistratie-support.md) – Support-uren met ticket (en optioneel taak) koppelen.
- [SOP 02.4 – Time entries beheren (admin)](02-tijdregistratie/02-4-time-entries-beheren-admin.md) – Overzicht, filters en bewerken van time entries in admin.

---

## 03 Leads en verkoop

- [SOP 03.1 – Lead aanmaken en toewijzen (admin)](03-leads-en-verkoop/03-1-lead-aanmaken-en-toewijzen.md) – Handmatig lead aanmaken, auto-assign of handmatig toewijzen.
- [SOP 03.2 – AI-router en aanbevelingen](03-leads-en-verkoop/03-2-ai-router-aanbevelingen.md) – Aanbevelingen bekijken, auto-assign, instellingen.
- [SOP 03.3 – Lead Flow Intelligence en segmenten](03-leads-en-verkoop/03-3-lead-flow-intelligence-segmenten.md) – Overzicht, segmenten, targets, handmatige sync.
- [SOP 03.4 – Capacity-based segment sync testen](03-leads-en-verkoop/03-4-capacity-sync-testen.md) – Handmatig testen van segment-sync op basis van capaciteit.

---

## 04 Tickets en support

- [SOP 04.1 – Ticket aanmaken en beheren](04-tickets-en-support/04-1-ticket-aanmaken-beheren.md) – Ticket aanmaken, status, prioriteit, assignee.
- [SOP 04.2 – Ticketreacties en bijlagen](04-tickets-en-support/04-2-ticket-reacties-bijlagen.md) – Reacties, interne notities, bijlagen toevoegen.
- [SOP 04.3 – Taken binnen een ticket](04-tickets-en-support/04-3-taken-binnen-ticket.md) – Taken toevoegen bij een ticket en gebruiken in tijdregistratie.

---

## 05 Financieel

- [SOP 05.1 – Factuurimport (PDF naar database)](05-financieel/05-1-factuurimport.md) – Factuurdata uit PDF/documenten omzetten naar SQL-import voor `customer_invoices`.
- [SOP 05.2 – Betalingen en facturatie (admin)](05-financieel/05-2-betalingen-facturatie-admin.md) – Betalingen bekijken, goedkeuren/afwijzen, facturen genereren.
- [SOP 05.3 – Rabobank API koppelen](05-financieel/05-3-rabobank-api-koppelen.md) – OAuth-instellingen, env vars, testen.

---

## 06 Systeem en techniek

- [SOP 06.1 – Local development setup](06-systeem-en-techniek/06-1-local-setup.md) – Repository, dependencies, .env, database, server starten.
- [SOP 06.2 – Deploy naar productie](06-systeem-en-techniek/06-2-deploy-productie.md) – Checklist, migrations, env, deploy-stappen, rollback.
- [SOP 06.3 – Troubleshooting](06-systeem-en-techniek/06-3-troubleshooting.md) – Veelvoorkomende fouten, database, auth, leads, betalingen.
- [SOP 06.4 – Backups (Supabase en Vercel)](06-systeem-en-techniek/06-4-backups.md) – Database- en deployment-backups maken en bewaren.

---

## 07 Campagnes en marketing

- [SOP 07.1 – Lead Flow-overzicht en targets](07-campagnes-en-marketing/07-1-lead-flow-targets.md) – Segmenten, capaciteit, targets, gap-analyse.
- [SOP 07.2 – Google Ads-campagnes (admin)](07-campagnes-en-marketing/07-2-google-ads-campagnes.md) – MCC, campagnes bekijken/aanmaken, budgetten.

---

## 08 E-mail en communicatie

- [SOP 08.1 – E-mailinbox en AI-labeling](08-email-en-communicatie/08-1-email-inbox-ai-labeling.md) – Inbox bekijken, labels, filteren.
- [SOP 08.2 – Opportunity uit e-mail en AI-antwoord](08-email-en-communicatie/08-2-opportunity-ai-antwoord.md) – Opportunity aanmaken uit e-mail, AI-antwoord genereren en versturen.

---

## Gebruik

- **Voor medewerkers:** Gebruik dit overzicht om de juiste handleiding te vinden. Elke SOP beschrijft stappen, schermen en aandachtspunten.
- **Voor AI/assistent:** Verwijs naar `docs/sops/` en de specifieke SOP-bestanden om processen consistent uit te leggen of na te lopen.
- **SOP-module in de app:** De database-tabellen `sop_categories` en `sops` kunnen met deze inhoud gevuld worden (bijv. via seed of import) zodat SOP’s ook in de applicatie leesbaar zijn.

---

## Gerelateerde documentatie

- **Flows:** `docs/03-flows/admin_flows.md`, `docs/03-flows/user_flows.md`
- **Product & begrippen:** `docs/00-context/product.md`, `docs/00-context/glossary.md`
- **API:** `docs/02-api/endpoints.md`
- **Runbooks:** `docs/05-runbooks/local_setup.md`, `docs/05-runbooks/deploy.md`, `docs/05-runbooks/troubleshooting.md`
