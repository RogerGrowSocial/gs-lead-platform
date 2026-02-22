# SOP 02.2 – Tijdregistratie Sales

**Doel:** Uren registreren voor sales-activiteiten, met optioneel activiteitstype en koppeling aan deal, kans, klant of contactpersoon.

**Doelgroep:** Sales en medewerkers die sales-uren boeken.

---

## Wanneer gebruik je Sales?

- Tijd besteed aan sales: gesprekken, voorbereiding, offertes, follow-up.
- Optioneel: koppelen aan een specifieke deal, kans, klant of contactpersoon.

---

## Stappen

### 1. Kiezen voor Sales

1. Open de tijdregistratie.
2. Kies bij **“Waar werk je aan?”** voor **Sales**.

### 2. Basis invullen

- **Titel** – verplicht.
- Klik **“Meer opties”** voor:
  - **Activiteitstype** – dropdown (bijv. call, meeting, offerte).
  - **Koppel aan (optioneel)** – zoekveld: min. 2 tekens, na ~350 ms dropdown met resultaten.

### 3. Koppel aan – zoekresultaten

- Resultaten gegroepeerd: Deals, Kansen, Klanten, Contactpersonen.
- Per item: avatar (indien aanwezig), titel, subtitel.
- Selecteer item → veld toont gekozen titel; clear-knop om te wissen.

### 4. Starten

- Alleen titel + Start → timer start (zonder activiteitstype/koppeling).
- Met activiteitstype en/of koppeling → Start → timer start; bij ophalen active timer zijn `activity_type`, `context_type`, `context_id` gezet.

### 5. Uitklokken en nudge

- Als je **zonder** koppeling uitklokt: nudge: *“Wil je dit nog koppelen aan een deal of kans?”* met [Nu koppelen] [Overslaan].
- **Overslaan** → entry wordt opgeslagen zonder context.
- **Nu koppelen** → “Koppel aan”-veld verschijnt in de lopende sectie; zoeken en selecteren → PUT active-timer met context → daarna Uitklokken; entry heeft dan context.

---

## Wat wordt opgeslagen?

- `project_name`: "Sales"
- `activity_type` (indien gekozen)
- `context_type` + `context_id` (deal, kans, klant, contact)
- Titel, notitie, start/eindtijd

---

## Time entries-pagina (admin)

- Op `/admin/time-entries` tonen Sales-entries het activiteitstype en “Deal”/“Kans” (context_type) in de meta-regel.
- Oude entries zonder activity_type/context blijven gewoon zichtbaar.

---

**Gerelateerd:** `docs/TIME-REGISTRATION-SALES-MANUAL-TEST.md`, [SOP 02.1 – Klantenwerk](02-1-tijdregistratie-klantenwerk.md), [SOP 02.4 – Time entries beheren](02-4-time-entries-beheren-admin.md)
