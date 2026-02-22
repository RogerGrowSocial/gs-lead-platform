# SOP 03.3 – Lead Flow Intelligence en segmenten

**Doel:** Overzicht van segmenten, capaciteit, targets en gap-analyse; segmentbeheer en handmatige sync.

**Doelgroep:** Admins.

---

## Overzicht bekijken (`/admin/leadstroom/overview`)

1. Ga naar **Admin → Leadstroom / Lead Flow Intelligence → Overzicht**.
2. Je ziet:
   - Alle segmenten (branche + regio)
   - Capaciteit per segment
   - Targets per segment
   - Werkelijke leads vs. targets
   - Gap-analyse
3. Filter op branch, regio, datum waar mogelijk.

---

## Segmentbeheer

1. In het overzicht of segmentenpagina:
   - Segmenten **activeren/deactiveren**
   - **Capaciteitsdetails** per segment bekijken
   - **Targetberekening** per segment bekijken
   - **Handmatige sync** triggeren (zie hieronder)

---

## Target herberekenen

1. Trigger **target herberekening** (knop of actie in Lead Flow Intelligence).
2. Het systeem:
   - Herberekent targets voor alle segmenten
   - Gebruikt o.a. `LeadDemandPlannerService.planAllSegments()`
   - Werkt tabel `lead_segment_plans` bij
3. Resultaten zijn zichtbaar in het overzicht.

---

## Handmatige segment-sync

- Sync op basis van capaciteit: nieuwe (branch, regio)-combinaties waar partners capaciteit hebben worden als segmenten aangemaakt of geactiveerd.
- Via admin-endpoint of runbook: zie [SOP 03.4 – Capacity sync testen](03-4-capacity-sync-testen.md) voor hoe je dit handmatig kunt triggeren en verifiëren.

---

## Belangrijke regels

- Alleen partners met **actieve betaalmethode** tellen mee voor capaciteit.
- Targets = (beschikbare capaciteit) × 0,8 (80% benutting); minimum target o.a. 5 leads als capaciteit > 0.
- Segmenten worden **gedeactiveerd** (niet verwijderd) als er geen capaciteit meer is.

---

**Gerelateerd:** [SOP 03.4 – Capacity sync testen](03-4-capacity-sync-testen.md), `docs/03-flows/admin_flows.md` (Lead Flow Intelligence), `docs/CAPACITY_PAYING_PARTNERS_ONLY.md`
