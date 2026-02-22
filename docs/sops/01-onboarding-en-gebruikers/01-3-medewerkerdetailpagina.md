# SOP 01.3 – Medewerkerdetailpagina

**Doel:** Uitleg wat er op de employee-detailpagina wordt getoond en welke data daar vandaan komt.

**Doelgroep:** Intern (HR, managers, support).

---

## Overzicht

De medewerkerdetailpagina toont één werknemer met relevante informatie, statistieken en activiteiten.

**Route:** `/admin/employees/:id`

---

## 1. Header

- **Naam:** volledige naam (first_name + last_name).
- **Status:** badge “Actief” of “Inactief”.
- **Admin-badge:** zichtbaar als de werknemer admin is.
- **Performance Score:** alleen getoond als `performance_score > 0`.
- **Rol:** display_name van de rol (bijv. Manager, Developer, Admin).
- **Afdeling:** indien ingesteld.
- **Contact:** e-mail, telefoon, locatie, startdatum.

---

## 2. Statistiek-cards

- **Deals gewonnen:** aantal gewonnen/completed leads en opportunities.
- **In progress:** aantal leads/opportunities in behandeling.
- **Totale omzet:** som van gewonnen deals (o.a. `price_at_purchase` van leads + `value` van opportunities).

---

## 3. Tabs

### Tab Activiteit

- Laatste activiteiten uit `lead_activities`.
- Per activiteit: type (deal_won, meeting, email, note), beschrijving, relatieve tijd.

### Tab Recente deals

- Laatste deals nog in behandeling (leads + opportunities met status new/contacted/qualified/proposal of open/in_progress/negotiation).
- Per deal: bedrijfsnaam, verwachte sluitingsdatum, waarde, status.

### Tab Performance

- Laatste 6 maanden: aantal gewonnen deals en omzet per maand.
- Gebaseerd op gewonnen leads en opportunities.

---

## 4. Sidebar

- **Vaardigheden:** lijst vaardigheden; standaard “Algemeen” als geen vaardigheden.
- **Snelle statistieken:** o.a. gem. dealwaarde, win rate, gem. dealcyclus, actieve prospects (waar dynamisch).
- **Performance-trend:** bijv. +18% t.o.v. vorige maand.

---

## Databronnen

- **profiles** – basisgegevens werknemer.
- **roles** – rol met display_name.
- **leads** – toegewezen aan werknemer (`user_id`).
- **opportunities** – toegewezen aan werknemer (`assigned_to`).
- **lead_activities** – activiteiten (`created_by`).

---

**Gerelateerd:** `docs/employee-detail-page-description.md`
