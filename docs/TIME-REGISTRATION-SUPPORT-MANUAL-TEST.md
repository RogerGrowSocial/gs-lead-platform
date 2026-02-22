# Tijdregistratie Support – handmatige testchecklist

Na het uitvoeren van de migraties `20260223100000_ticket_tasks_and_time_entries_ticket.sql` (en eventueel `20260222100000_time_entries_sales_context.sql` indien nog niet gedraaid) en deploy:

## 1. Klantenwerk (ongewijzigd)
- [ ] Selecteer "Waar werk je aan?" = Klantenwerk.
- [ ] Taak- en Klantvelden zijn zichtbaar; Titel verplicht; Klant verplicht bij Start.
- [ ] Start → timer loopt; Uitklokken → entry opgeslagen met project_name/task/customer/note.
- [ ] Geen Support- of Sales-specifieke velden zichtbaar.

## 2. Sales (ongewijzigd)
- [ ] Selecteer "Waar werk je aan?" = Sales.
- [ ] Meer opties (activiteitstype, Koppel aan) werken zoals voorheen.
- [ ] Geen ticket/taak-velden zichtbaar.

## 3. Support – ticket verplicht
- [ ] Selecteer "Waar werk je aan?" = Support.
- [ ] Taak- en Klantvelden zijn **niet** zichtbaar.
- [ ] Velden "Ticket *" en (na ticketkeuze) "Taak binnen ticket (optioneel)" zijn zichtbaar.
- [ ] Zonder ticket gekozen: Start klikken → melding "Selecteer eerst een ticket"; timer start niet.
- [ ] Ticket zoeken (min. 2 tekens) → debounce ~300 ms → dropdown met max 15 resultaten.
- [ ] **Niet-admin:** alleen tickets waar assignee_id = huidige user.
- [ ] **Admin:** alle tickets in zoekresultaten.

## 4. Support – ticket + taken
- [ ] Na ticket selecteren: takenlijst laadt onder het ticketveld.
- [ ] Per taak: titel + korte beschrijving (1 regel / truncate) zichtbaar.
- [ ] Klik op een taak → taak geselecteerd (visueel gemarkeerd); Titel-veld wordt indien nog leeg vooringevuld met taaktitel.
- [ ] "+ Nieuwe taak toevoegen" → inline form (Titel * , Beschrijving optioneel).
- [ ] Opslaan → taak wordt aangemaakt bij dit ticket; takenlijst vernieuwd; nieuwe taak geselecteerd; Titel vooringevuld indien leeg.

## 5. Support – Start en opslag
- [ ] Ticket gekozen, optioneel een taak, Titel ingevuld (of door taak vooringevuld) → Start.
- [ ] Timer start; popover toont huidige activiteit (Support).
- [ ] Uitklokken → time entry heeft ticket_id en optioneel ticket_task_id opgeslagen.
- [ ] GET active-timer / time entries: ticket en ticket_task (id, title, …) aanwezig in response.

## 6. Support – Wissel taak (switch)
- [ ] Timer loopt (bijv. Klantenwerk). Open popover → "Nieuwe activiteit" = Support.
- [ ] Sectie "Ticket *" + (na selectie) "Taak (optioneel)" zichtbaar; Taak/Klant secties verborgen.
- [ ] Ticket kiezen (en optioneel taak), Titel invullen → "Wissel taak".
- [ ] Nieuwe entry start met project_name Support, ticket_id en optioneel ticket_task_id.
- [ ] Zonder ticket bij Support → "Wissel taak" → melding "Selecteer eerst een ticket".

## 7. Time entries-pagina
- [ ] `/admin/time-entries`: bij Support-entries met ticket/ticket_task tonen de meta-regel het ticket (nummer + onderwerp) en de taak (titel).
- [ ] Entries zonder ticket_id/ticket_task_id (oude data of andere project_types) tonen geen fouten.

## 8. Backwards compatibility
- [ ] Bestaande time entries zonder ticket_id/ticket_task_id blijven correct zichtbaar en bewerkbaar.
- [ ] Klantenwerk- en Sales-flows ongewijzigd; geen TS/crashes; debounce en limit in ticket search werken.
