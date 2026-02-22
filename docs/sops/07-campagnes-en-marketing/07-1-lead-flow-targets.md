# SOP 07.1 – Lead Flow-overzicht en targets

**Doel:** Segmenten, capaciteit, targets en gap-analyse bekijken en begrijpen.

**Doelgroep:** Admins en marketing.

---

## Overzicht

1. Ga naar **Admin → Leadstroom / Lead Flow Intelligence** → **Overzicht** (`/admin/leadstroom/overview`).
2. Je ziet:
   - **Segmenten:** combinatie branche + regio
   - **Capaciteit** per segment (op basis van partners met actieve betaalmethode)
   - **Targets** per segment (bijv. 80% van beschikbare capaciteit)
   - **Werkelijke leads** vs. targets
   - **Gap:** waar zitten we onder of over target?

---

## Filters

- Filter op branch, regio, datum waar beschikbaar.

---

## Segmentbeheer

- Segmenten **activeren/deactiveren** (geen harde delete).
- **Handmatige sync** triggeren zodat nieuwe (branch, regio)-combinaties met capaciteit als segment verschijnen (zie [SOP 03.4 – Capacity sync testen](../03-leads-en-verkoop/03-4-capacity-sync-testen.md)).
- **Target herberekenen** zodat alle segmenten opnieuw een target krijgen (o.a. `LeadDemandPlannerService.planAllSegments()`).

---

## Regels

- Alleen **betalende** partners (actieve betaalmethode) tellen mee voor capaciteit.
- Target = (beschikbare capaciteit) × 0,8; minimum target o.a. 5 leads als capaciteit > 0.
- Beschikbare capaciteit = totaal – open leads.

---

**Gerelateerd:** [SOP 03.3 – Lead Flow Intelligence en segmenten](../03-leads-en-verkoop/03-3-lead-flow-intelligence-segmenten.md), [SOP 07.2 – Google Ads](../07-campagnes-en-marketing/07-2-google-ads-campagnes.md), `docs/CAPACITY_PAYING_PARTNERS_ONLY.md`
