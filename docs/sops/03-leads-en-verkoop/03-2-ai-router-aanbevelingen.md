# SOP 03.2 – AI-router en aanbevelingen

**Doel:** Aanbevelingen bekijken, auto-assign gebruiken en AI-router-instellingen beheren.

**Doelgroep:** Admins.

---

## Aanbevelingen bekijken

1. Open een lead-detailpagina.
2. Klik op **View Recommendations**.
3. Je ziet de top 5 partners met:
   - Score (0–100)
   - Redenen (branch match, regio, performance, enz.)
   - Partnergegevens
4. Je kunt een van de aanbevolen partners kiezen en de lead aan hem/haar toewijzen.

---

## Auto-assign

1. Op de lead-detailpagina: klik **Auto-assign**.
2. Het systeem:
   - Haalt kandidaten op (`LeadAssignmentService.getCandidates()`).
   - Berekent scores.
   - Selecteert beste match (score ≥ ingestelde drempel).
   - Wijst de lead toe.
3. Bij mislukking: foutmelding; handmatige toewijzing blijft mogelijk.

---

## AI-routerinstellingen configureren

1. Ga naar **AI Router-instellingen** (in admin).
2. Pas gewichten aan, bijv.:
   - **Region weight** (standaard 80)
   - **Performance weight** (standaard 40)
   - **Fairness weight** (standaard 60)
3. Stel **auto-assignment threshold** in (standaard 70).
4. Sla op → instellingen gelden voor volgende toewijzingen.

---

## Troubleshooting

- **Geen kandidaten:** controleer of er partners zijn met capaciteit, actieve betaalmethode en passend segment. Zie [SOP 06.3 – Troubleshooting](06-systeem-en-techniek/06-3-troubleshooting.md).
- **Quota bereikt:** partner heeft maandquota bereikt; verhoog quota of wacht op volgende periode.

---

**Gerelateerd:** [SOP 03.1 – Lead aanmaken en toewijzen](03-1-lead-aanmaken-en-toewijzen.md), [SOP 03.3 – Lead Flow Intelligence](03-3-lead-flow-intelligence-segmenten.md)
