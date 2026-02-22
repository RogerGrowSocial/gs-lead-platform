# SOP 02.4 – Time entries beheren (admin)

**Doel:** Time entries bekijken, filteren en waar mogelijk bewerken in het admin-panel.

**Doelgroep:** Admins en managers.

---

## Waar vind je time entries?

- **Route:** `/admin/time-entries`
- Overzicht van alle geregistreerde uren (time entries) in het platform.

---

## Wat wordt getoond?

- Lijst met entries: medewerker, project type (Klantenwerk / Sales / Support), datum, duur, titel, en meta-informatie.
- **Klantenwerk:** taak, klant, notitie.
- **Sales:** activiteitstype, “Deal”/“Kans” (context_type) in de meta-regel.
- **Support:** ticket (nummer + onderwerp), taak (titel) in de meta-regel.

---

## Filters en zoeken

- Filter op periode, medewerker, project type (Klantenwerk/Sales/Support).
- Zoeken op titel, klant, ticket (indien van toepassing).

---

## Bewerken (indien ondersteund)

- Afhankelijk van implementatie: bewerken van datum, duur, titel, notitie, of koppeling (klant, ticket, taak).
- Let op: wijzigingen kunnen rapportages en facturatie beïnvloeden; alleen aanpassen volgens intern beleid.

---

## Backwards compatibility

- Oude entries zonder `ticket_id`/`ticket_task_id` of zonder `activity_type`/`context_type` blijven correct zichtbaar en veroorzaken geen fouten.
- Velden die later zijn toegevoegd (bijv. Sales context, Support ticket) zijn optioneel voor bestaande data.

---

**Gerelateerd:** [SOP 02.1 – Klantenwerk](02-1-tijdregistratie-klantenwerk.md), [SOP 02.2 – Sales](02-2-tijdregistratie-sales.md), [SOP 02.3 – Support](02-3-tijdregistratie-support.md)
