# SOP 04.2 – Ticketreacties en bijlagen

**Doel:** Reacties en interne notities toevoegen bij een ticket, en bijlagen uploaden/beheren.

**Doelgroep:** Admins en supportmedewerkers.

---

## Reacties (comments)

1. Open het ticketdetail (`/admin/tickets/:id`).
2. Ga naar de tab **Reacties** (of Comments).
3. **Nieuwe reactie:**
   - Typ je bericht.
   - Optioneel: vink **Interne notitie** aan (alleen zichtbaar voor intern, niet voor klant).
   - Verstuur.
4. Reacties worden getoond in thread-vorm; interne notities zijn gemarkeerd en alleen zichtbaar voor bevoegde rollen.

---

## Interne notities

- Gebruik voor interne afstemming, aantekeningen of gevoelige info.
- Niet zichtbaar voor klant/aanvrager.
- Alleen zichtbaar voor gebruikers met de juiste rechten (admin/manager/support).

---

## Bijlagen

1. Op ticketdetail: tab **Bijlagen**.
2. **Uploaden:** bestand kiezen en uploaden (opslag in Supabase Storage of vergelijkbaar).
3. Lijst toont geüploade bestanden; verwijderen indien ondersteund en toegestaan.

---

## Activity / audit (admin)

- Tab **Activity** (alleen voor admin): volledige auditlog van wijzigingen aan het ticket (status, assignee, reacties, bijlagen, enz.).

---

**Gerelateerd:** [SOP 04.1 – Ticket aanmaken en beheren](04-1-ticket-aanmaken-beheren.md), [SOP 04.3 – Taken binnen ticket](04-3-taken-binnen-ticket.md)
