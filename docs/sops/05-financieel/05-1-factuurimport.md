# SOP 05.1 – Factuurimport (PDF naar database)

**Doel:** Factuurdata uit PDF’s of documenten omzetten naar gestructureerde data voor import in de `customer_invoices`-tabel (en eventueel regels).

**Doelgroep:** Financieel/administratie.

---

## Doel

- Factuur-PDF’s of Word-documenten omzetten naar SQL INSERT/UPDATE voor `customer_invoices` (en line items indien van toepassing).
- Handig voor historische import of bulk-import.

---

## Stap 1: Data uit de factuur halen

**Belangrijke velden (hoofd):**

- Factuurnummer, factuurdatum, vervaldatum (YYYY-MM-DD)
- Klantnaam
- Subtotaal (excl. BTW), BTW-bedrag, totaal (incl. BTW)
- Status: paid, pending, overdue
- Notities (optioneel)

**Regels (line items):**

- Beschrijving, aantal, eenheidsprijs (excl. BTW), regeltotaal, BTW, totaal incl. BTW, has_vat

Volledige veldlijst en voorbeelden staan in `FACTUUR_IMPORT_GUIDE.md`.

---

## Stap 2: Gestructureerde data maken

- **Format 1 (aanbevolen):** gestructureerde tekst (zie template in `FACTUUR_IMPORT_GUIDE.md`).
- **Format 2:** JSON met `invoice_*` en `line_items` (zelfde guide).

---

## Stap 3: ChatGPT/AI gebruiken (optioneel)

- Plak de factuurdata in de prompt-template uit `FACTUUR_IMPORT_GUIDE.md`.
- Vraag om SQL INSERTs voor `customer_invoices` (en eventueel regeltabel).
- Controleer de gegenereerde SQL op juiste velden en datums.

---

## Stap 4: SQL uitvoeren

- Run de gegenereerde SQL in Supabase SQL Editor (of via migratie) in de juiste volgorde.
- Controleer of factuurnummers uniek zijn en of klant-ID’s kloppen als je foreign keys gebruikt.

---

## Tips

- Gebruik altijd YYYY-MM-DD voor datums.
- Controleer bedragen (afronding, BTW-percentages).
- Test eerst op een kopie of staging-database.

---

**Gerelateerd:** `FACTUUR_IMPORT_GUIDE.md`, [SOP 05.2 – Betalingen en facturatie](05-2-betalingen-facturatie-admin.md)
