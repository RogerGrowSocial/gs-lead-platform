# SOP 04.1 – Ticket aanmaken en beheren

**Doel:** Een supportticket aanmaken, status/prioriteit/assignee instellen en beheren.

**Doelgroep:** Admins en supportmedewerkers.

---

## Waar vind je tickets?

- **Lijst:** `/admin/tickets`
- **Detail:** `/admin/tickets/:id`

---

## Ticket aanmaken

1. Ga naar **Admin → Tickets** en klik op **Nieuw ticket** (of vergelijkbare actie).
2. Vul in:
   - **Onderwerp** (verplicht)
   - **Beschrijving**
   - **Prioriteit:** low, normal, high, urgent
   - **Categorie** (indien van toepassing)
   - **Aanvrager:** e-mail, naam
   - Optioneel: klant, bron, tags
3. Sla op → ticket wordt aangemaakt met status `new` en krijgt een ticketnummer.

---

## Ticket beheren

### Status

- **Statuswaarden:** new, open, waiting_on_customer, waiting_on_internal, resolved, closed
- Wijzig status via detailpagina of bulkacties (indien beschikbaar).

### Prioriteit

- low, normal, high, urgent
- Aanpasbaar op ticketdetail of in bulk.

### Toewijzen (assignee)

1. Op ticketdetail: kies **Assignee** (toewijzen aan medewerker).
2. Of gebruik **Toewijzen**-actie in de lijst / bulkacties.
3. Alleen toegewezen tickets (voor niet-admin) zijn zichtbaar in tijdregistratie-ticketzoeker, tenzij anders geconfigureerd.

### Overige velden

- **Due date (SLA)**
- **Bron**, **tags**, **interne notitie** (indien ondersteund)

---

## Lijst en filters

- **Filters:** zoekterm, status, prioriteit, assignee, “Alleen van mij”.
- **KPI-cards:** totaal, open, in progress, urgent.
- Klik op een rij om naar het ticketdetail te gaan.

---

## Rechten

- **Admin/Manager:** volledige toegang.
- **Medewerker:** toegang tot toegewezen tickets, of tickets die hij/zij volgt of waar hij/zij supportrol heeft (afhankelijk van RLS).

---

**Gerelateerd:** [SOP 04.2 – Reacties en bijlagen](04-2-ticket-reacties-bijlagen.md), [SOP 04.3 – Taken binnen ticket](04-3-taken-binnen-ticket.md), [SOP 02.3 – Tijdregistratie Support](../02-tijdregistratie/02-3-tijdregistratie-support.md), `TICKETS_MODULE_IMPLEMENTATION.md`
