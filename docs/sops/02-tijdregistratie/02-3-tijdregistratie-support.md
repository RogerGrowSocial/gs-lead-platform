# SOP 02.3 – Tijdregistratie Support (ticket verplicht)

**Doel:** Uren registreren voor supportwerk; een ticket is verplicht, een taak binnen het ticket optioneel.

**Doelgroep:** Supportmedewerkers en iedereen die support-uren boekt.

---

## Wanneer gebruik je Support?

- Tijd besteed aan support: ticket afhandelen, klant helpen, onderzoek, communicatie.
- Altijd koppelen aan een ticket (en optioneel aan een taak binnen dat ticket).

---

## Stappen

### 1. Kiezen voor Support

1. Open de tijdregistratie.
2. Kies bij **“Waar werk je aan?”** voor **Support**.

### 2. Velden

- **Ticket *** – verplicht. Zonder gekozen ticket kun je niet starten; bij Start verschijnt: “Selecteer eerst een ticket”.
- **Taak binnen ticket (optioneel)** – verschijnt nadat een ticket is gekozen.
- **Titel** – verplicht (kan automatisch worden vooringevuld als je een taak selecteert).

Bij Support zijn de gewone **Taak-** en **Klant-**velden (zoals bij Klantenwerk) **niet** zichtbaar.

### 3. Ticket zoeken

- Typ min. 2 tekens in het ticketveld.
- Na ~300 ms (debounce) verschijnt een dropdown met max. 15 resultaten.
- **Niet-admin:** alleen tickets waar `assignee_id` = huidige gebruiker.
- **Admin:** alle tickets in de zoekresultaten.

### 4. Taken binnen ticket

- Na ticketkeuze laadt de takenlijst onder het ticketveld.
- Per taak: titel + korte beschrijving (1 regel/truncate).
- Klik op een taak → taak geselecteerd (visueel gemarkeerd); titelveld wordt indien nog leeg vooringevuld met taaktitel.
- **“+ Nieuwe taak toevoegen”** → inline form (Titel * , Beschrijving optioneel) → Opslaan → taak wordt bij dit ticket aangemaakt; lijst vernieuwd; nieuwe taak geselecteerd; titel vooringevuld indien leeg.

### 5. Starten

1. Kies ticket (verplicht).
2. Optioneel: kies of maak een taak; vul titel in (of laat voorinvullen).
3. Klik **Start** → timer loopt; popover toont huidige activiteit (Support).

### 6. Uitklokken

- Klik **Uitklokken** → time entry wordt opgeslagen met `ticket_id` en optioneel `ticket_task_id`.
- Bij GET active-timer / time entries: ticket en ticket_task (id, title, …) in de response.

### 7. Wissel taak (van andere activiteit naar Support)

- Timer loopt (bijv. Klantenwerk). Open popover → “Nieuwe activiteit” = Support.
- Sectie “Ticket *” + (na selectie) “Taak (optioneel)” zichtbaar; Taak/Klant-secties verborgen.
- Kies ticket (en optioneel taak), vul titel in → **“Wissel taak”**.
- Nieuwe entry start met project_name Support, ticket_id en optioneel ticket_task_id.
- Zonder ticket bij Support → “Wissel taak” → melding “Selecteer eerst een ticket”.

---

## Wat wordt opgeslagen?

- `project_name`: "Support"
- `ticket_id` (verplicht)
- `ticket_task_id` (optioneel)
- Titel, notitie, start/eindtijd

---

## Time entries-pagina (admin)

- Op `/admin/time-entries`: bij Support-entries met ticket/ticket_task toont de meta-regel het ticket (nummer + onderwerp) en de taak (titel).
- Entries zonder ticket_id/ticket_task_id (oude data of andere project_types) geven geen fouten.

---

## Backwards compatibility

- Bestaande time entries zonder ticket_id/ticket_task_id blijven zichtbaar en bewerkbaar.
- Klantenwerk- en Sales-flows blijven ongewijzigd.

---

**Gerelateerd:** `docs/TIME-REGISTRATION-SUPPORT-MANUAL-TEST.md`, [SOP 04.3 – Taken binnen ticket](04-tickets-en-support/04-3-taken-binnen-ticket.md), [SOP 02.4 – Time entries beheren](02-4-time-entries-beheren-admin.md)
