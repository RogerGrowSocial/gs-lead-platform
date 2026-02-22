# Tijdregistratie Sales – handmatige testchecklist

Na het uitvoeren van de migratie `20260222100000_time_entries_sales_context.sql` en deploy:

## 1. Klantenwerk (ongewijzigd)
- [ ] Selecteer "Waar werk je aan?" = Klantenwerk.
- [ ] Taak- en klantvelden zijn zichtbaar; Titel verplicht.
- [ ] Start → timer loopt; Uitklokken → entry opgeslagen met project_name/task/customer/note.
- [ ] Geen Sales-specifieke velden zichtbaar.

## 2. Sales – start
- [ ] Selecteer "Waar werk je aan?" = Sales.
- [ ] Blok "Meer opties" is zichtbaar (ingeklapt).
- [ ] Klik "Meer opties" → Activiteit type dropdown + "Koppel aan (optioneel)" zoekveld zijn zichtbaar.
- [ ] Titel invullen (verplicht) en Start → timer start zonder activiteit type/koppeling.
- [ ] Met Activiteit type gekozen en/of "Koppel aan" geselecteerd → Start → timer start; bij ophalen active timer zijn activity_type/context_type/context_id gezet.

## 3. Koppel aan (context search)
- [ ] Bij Sales, "Koppel aan" typen (min. 2 tekens) → na ~350 ms dropdown met resultaten.
- [ ] Resultaten gegroepeerd (Deals, Kansen, Klanten, Contactpersonen); per item avatar (indien aanwezig), titel, subtitel.
- [ ] Item kiezen → veld toont gekozen titel; clear-knop zichtbaar.
- [ ] Start met gekozen koppeling → entry heeft context_type + context_id.

## 4. Uitklokken en nudge
- [ ] Timer loopt voor Sales zonder koppeling → Uitklokken → nudge: "Wil je dit nog koppelen aan een deal of kans?" met [Nu koppelen] [Overslaan].
- [ ] Overslaan → timer stopt; entry zonder context.
- [ ] Nu koppelen → "Koppel aan"-veld in running-sectie zichtbaar; zoeken en selecteren → PUT active-timer met context; daarna Uitklokken → entry heeft context.

## 5. Time entries-pagina
- [ ] `/admin/time-entries`: lijst toont bij Sales-entries activiteitstype en "Deal"/"Kans" (context_type) in de meta-regel.
- [ ] Bestaande entries zonder activity_type/context_type blijven correct zichtbaar.

## 6. Backwards compatibility
- [ ] Oude entries (zonder activity_type/context_type/context_id) tonen geen fouten; velden blijven optioneel.
- [ ] Clock-in/clock-out zonder body-velden voor Sales blijft werken (alleen project_name + note).
