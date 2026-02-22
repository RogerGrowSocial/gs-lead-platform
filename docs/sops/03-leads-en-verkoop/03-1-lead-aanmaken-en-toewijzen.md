# SOP 03.1 – Lead aanmaken en toewijzen (admin)

**Doel:** Handmatig een lead aanmaken en toewijzen aan een partner (auto-assign of handmatig).

**Doelgroep:** Admins.

---

## Lead handmatig aanmaken

1. Ga naar **Admin → Leads** en klik op **Nieuwe lead** (of `/admin/leads/new`).
2. Vul in:
   - Naam, e-mail, telefoon
   - Bericht
   - Branche (industrie)
   - Locatie
3. Sla op → systeem maakt lead aan met status `new`.
4. De lead verschijnt in de admin leads-lijst.

---

## Lead toewijzen

### Optie A: Auto-assign (AI-router)

1. Open de lead-detailpagina (`/admin/leads/:id`).
2. Klik op **Auto-assign**.
3. Het systeem:
   - Haalt kandidaten op via de lead assignment service.
   - Berekent scores (branch, regio, performance, capaciteit, wachttijd).
   - Kiest de beste match (score ≥ drempel).
   - Wijst de lead toe aan die partner.
4. Bij fout: melding tonen en handmatig toewijzen mogelijk.

### Optie B: Handmatig toewijzen

1. Open de lead-detailpagina.
2. Kies in het dropdown **Partner** de gewenste partner.
3. Sla op → lead is toegewezen; partner krijgt (indien geconfigureerd) een notificatie.

### Optie C: Eerst aanbevelingen bekijken

1. Open de lead-detailpagina.
2. Klik op **View Recommendations**.
3. Bekijk de top 5 partners met score (0–100) en redenen (branch match, regio, performance, enz.).
4. Kies een partner uit de lijst of wijs handmatig toe.

---

## Lead monitoren

- **Admin → Leads:** overzicht met filters op status, partner, branche, datum.
- Reassignen indien nodig.
- Lead-details, activiteiten en notities bekijken.

---

**Gerelateerd:** [SOP 03.2 – AI-router en aanbevelingen](03-2-ai-router-aanbevelingen.md), `docs/03-flows/admin_flows.md` (Lead Management Flow)
