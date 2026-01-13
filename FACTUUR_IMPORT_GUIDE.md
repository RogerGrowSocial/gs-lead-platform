# Handleiding: Factuur PDFs Converteren naar SQL Import Data

## Doel
Converteer factuur PDFs, Word documenten, of andere factuurformaten naar gestructureerde data die gebruikt kan worden voor SQL INSERT/UPDATE queries in de `customer_invoices` tabel.

## Stap 1: Extracteer Data uit Factuur

### Belangrijke velden om te extraheren:

**Basis factuur informatie:**
- `invoice_number` (Factuurnummer) - bijv. "201", "GS-0445"
- `invoice_date` (Factuurdatum) - formaat: YYYY-MM-DD (bijv. "2020-03-11")
- `due_date` (Vervaldatum) - formaat: YYYY-MM-DD (bijv. "2020-03-17")
- `customer_name` (Klantnaam) - bijv. "Rijschool Intest B.V."
- `amount` (Totaalbedrag incl. BTW) - bijv. 1149.50
- `subtotal` (Subtotaal excl. BTW) - bijv. 950.00
- `vat_amount` (BTW bedrag) - bijv. 199.50
- `status` - "paid", "pending", "overdue" (standaard: "pending")
- `notes` (Optioneel) - bijv. "Geïmporteerd uit e-boekhouden"

**Line items (regels):**
Voor elke regel in de factuur:
- `description` (Beschrijving) - bijv. "Ontwerpen + publiceren Facebook, Instagram"
- `quantity` (Aantal) - bijv. 16
- `unit_price` (Eenheidsprijs excl. BTW) - bijv. 25.00
- `line_total` (Regeltotaal excl. BTW) - bijv. 400.00
- `has_vat` (BTW toepasbaar) - true/false
- `vat_amount` (BTW bedrag voor deze regel) - bijv. 84.00
- `total` (Totaal incl. BTW voor deze regel) - bijv. 484.00

## Stap 2: Data Structuur voor ChatGPT/AI

### Format 1: Gestructureerde Text (Aanbevolen)

Geef de factuur data in dit formaat:

```
FACTUUR DATA:
Factuurnummer: 201
Factuurdatum: 11-03-2020
Vervaldatum: 17-03-2020
Klant: Rijschool Intest B.V.
Subtotaal (excl. BTW): €950,00
BTW (21%): €199,50
Totaal (incl. BTW): €1.149,50
Status: paid

LINE ITEMS:
1. Aantal: 16 | Beschrijving: Ontwerpen + publiceren Facebook, Instagram | Eenheidsprijs: €37,50 | Regeltotaal: €400,00
2. Aantal: 12 | Beschrijving: Contact functie bij advertentie | Eenheidsprijs: €0,00 | Regeltotaal: €0,00
3. Aantal: 1 | Beschrijving: Instagram kopjes ontwerpen / make-over | Eenheidsprijs: €48,00 | Regeltotaal: €48,00
4. Aantal: 4 | Beschrijving: Geanimeerde versie advertentie | Eenheidsprijs: €62,50 | Regeltotaal: €251,00
5. Aantal: 12 | Beschrijving: Verhaal versie advertentie | Eenheidsprijs: €20,92 | Regeltotaal: €251,00
```

### Format 2: JSON Structuur

```json
{
  "invoice_number": "201",
  "invoice_date": "2020-03-11",
  "due_date": "2020-03-17",
  "customer_name": "Rijschool Intest B.V.",
  "subtotal": 950.00,
  "vat_amount": 199.50,
  "total": 1149.50,
  "status": "paid",
  "line_items": [
    {
      "description": "Ontwerpen + publiceren Facebook, Instagram",
      "quantity": 16,
      "unit_price": 25.00,
      "subtotal": 400.00,
      "vat_amount": 84.00,
      "total": 484.00,
      "has_vat": true
    },
    {
      "description": "Contact functie bij advertentie",
      "quantity": 12,
      "unit_price": 0.00,
      "subtotal": 0.00,
      "vat_amount": 0.00,
      "total": 0.00,
      "has_vat": false
    }
  ]
}
```

## Stap 3: Prompt voor ChatGPT/AI

### Basis Prompt Template:

```
Ik heb een factuur die ik wil importeren in een SQL database. 

Hier is de factuur data:
[PLAK HIER DE FACTUUR DATA]

De database tabel heet `customer_invoices` en heeft deze structuur:
- id (UUID, auto-generated)
- customer_id (UUID) - moet opgezocht worden op basis van customer_name
- invoice_number (VARCHAR)
- invoice_date (DATE)
- due_date (DATE)
- order_number (VARCHAR) - formaat: ORD-YYYYMMDD (bijv. ORD-20200311)
- amount (NUMERIC) - totaal incl. BTW
- outstanding_amount (NUMERIC) - standaard: 0 als status = 'paid', anders = amount
- status (VARCHAR) - 'paid', 'pending', 'overdue'
- notes (TEXT)
- line_items (JSONB) - array van line items
- external_id (VARCHAR) - meestal het invoice_number
- external_system (VARCHAR) - bijv. 'eboekhouden', 'zoho_books'
- created_by (UUID) - kan NULL zijn

Line items JSONB structuur:
[
  {
    "description": "string",
    "quantity": number,
    "unit_price": number (excl. BTW),
    "has_vat": boolean,
    "subtotal": number (excl. BTW),
    "vat_amount": number,
    "total": number (incl. BTW)
  }
]

Geef me een SQL UPDATE query als de factuur al bestaat (op basis van invoice_number en customer_id), 
of een SQL INSERT query als de factuur nog niet bestaat.

Voor de customer_id: gebruik een subquery om de customer te vinden op basis van company_name of name 
die overeenkomt met de klantnaam uit de factuur.

Voor order_number: genereer ORD-YYYYMMDD op basis van invoice_date.

Voor outstanding_amount: 
- Als status = 'paid': outstanding_amount = 0
- Anders: outstanding_amount = amount
```

### Uitgebreide Prompt (met voorbeeld):

```
Ik heb een factuur PDF die ik wil converteren naar een SQL INSERT/UPDATE query.

FACTUUR DATA:
Factuurnummer: 201
Factuurdatum: 11-03-2020
Vervaldatum: 17-03-2020
Klant: Rijschool Intest B.V.
Subtotaal (excl. BTW): €950,00
BTW (21%): €199,50
Totaal (incl. BTW): €1.149,50
Status: Betaald (paid)

LINE ITEMS:
1. Aantal: 16 | Beschrijving: Ontwerpen + publiceren Facebook, Instagram | Eenheidsprijs: €37,50 | Regeltotaal: €400,00
2. Aantal: 12 | Beschrijving: Contact functie bij advertentie | Eenheidsprijs: €0,00 | Regeltotaal: €0,00
3. Aantal: 1 | Beschrijving: Instagram kopjes ontwerpen / make-over | Eenheidsprijs: €48,00 | Regeltotaal: €48,00
4. Aantal: 4 | Beschrijving: Geanimeerde versie advertentie | Eenheidsprijs: €62,50 | Regeltotaal: €251,00
5. Aantal: 12 | Beschrijving: Verhaal versie advertentie | Eenheidsprijs: €20,92 | Regeltotaal: €251,00

OPDRACHT:
1. Converteer de datumnotaties naar YYYY-MM-DD formaat
2. Bereken de unit_price (excl. BTW) voor elk line item: unit_price = regeltotaal / quantity
3. Bereken BTW per line item: vat_amount = subtotal * 0.21 (als has_vat = true)
4. Bereken total per line item: total = subtotal + vat_amount
5. Genereer order_number in formaat ORD-YYYYMMDD op basis van invoice_date
6. Maak een SQL UPDATE query die:
   - De factuur update op basis van invoice_number = '201' en customer_id (zoek via klantnaam)
   - Alle line items toevoegt als JSONB array
   - outstanding_amount = 0 omdat status = 'paid'
7. Maak ook een SQL INSERT query voor het geval de factuur nog niet bestaat (met WHERE NOT EXISTS)

Let op:
- Alle bedragen moeten numeriek zijn (geen € symbool, komma als punt)
- Line items moeten een geldig JSONB array zijn
- customer_id moet opgezocht worden via: (SELECT id FROM customers WHERE company_name ILIKE '%[klantnaam]%' OR name ILIKE '%[klantnaam]%' LIMIT 1)
```

## Stap 4: Belangrijke Berekeningsregels

### BTW Berekening:
- **Als regeltotaal excl. BTW is gegeven:**
  - `subtotal` = regeltotaal
  - `vat_amount` = subtotal × 0.21 (als has_vat = true)
  - `total` = subtotal + vat_amount

- **Als regeltotaal incl. BTW is gegeven:**
  - `total` = regeltotaal
  - `subtotal` = total / 1.21
  - `vat_amount` = total - subtotal

### Unit Price Berekening:
- `unit_price` = `subtotal` / `quantity`

### Outstanding Amount:
- Als `status` = 'paid': `outstanding_amount` = 0
- Anders: `outstanding_amount` = `amount`

## Stap 5: Voorbeeld Output (SQL Query)

### UPDATE Query:
```sql
UPDATE public.customer_invoices
SET
  invoice_date = '2020-03-11',
  due_date = '2020-03-17',
  order_number = 'ORD-20200311',
  amount = 1149.50,
  outstanding_amount = 0,
  status = 'paid',
  notes = 'Geïmporteerd uit e-boekhouden - Relatie: Rijschool Intest B.V.',
  line_items = '[...]'::jsonb,
  updated_at = NOW()
WHERE 
  invoice_number = '201'
  AND customer_id = (
    SELECT id 
    FROM public.customers 
    WHERE company_name ILIKE '%Rijschool Intest%' OR name ILIKE '%Rijschool Intest%'
    LIMIT 1
  );
```

### INSERT Query:
```sql
INSERT INTO public.customer_invoices (
  customer_id, invoice_number, invoice_date, due_date, order_number,
  amount, outstanding_amount, status, notes, line_items, external_id, external_system
)
SELECT 
  (SELECT id FROM public.customers WHERE company_name ILIKE '%Rijschool Intest%' LIMIT 1),
  '201', '2020-03-11'::date, '2020-03-17'::date, 'ORD-20200311',
  1149.50, 0, 'paid',
  'Geïmporteerd uit e-boekhouden - Relatie: Rijschool Intest B.V.',
  '[...]'::jsonb,
  '201', 'eboekhouden'
WHERE NOT EXISTS (
  SELECT 1 FROM public.customer_invoices 
  WHERE invoice_number = '201' 
    AND customer_id = (SELECT id FROM public.customers WHERE company_name ILIKE '%Rijschool Intest%' LIMIT 1)
);
```

## Stap 6: Tips voor Beste Resultaten

1. **Duidelijke Data Extractie:**
   - Gebruik OCR tools (zoals Adobe Acrobat, Google Drive) om PDFs te converteren naar tekst
   - Kopieer de factuur data in een gestructureerd formaat naar ChatGPT

2. **Validatie:**
   - Controleer altijd of de som van line items overeenkomt met het totaal
   - Verifieer BTW berekeningen (meestal 21% in Nederland)

3. **Customer Matching:**
   - Gebruik ILIKE met wildcards (%) voor flexibele klantnaam matching
   - Controleer altijd of de customer_id correct is gevonden

4. **Datum Conversie:**
   - Nederlandse datumnotatie (DD-MM-YYYY) → SQL formaat (YYYY-MM-DD)
   - Let op: maanden kunnen ook als tekst voorkomen (bijv. "11 maart 2020")

5. **Bedrag Conversie:**
   - Verwijder € symbool
   - Vervang komma door punt (€1.149,50 → 1149.50)
   - Verwijder duizendtallen scheiding (€1.149,50 → 1149.50)

## Stap 7: Snelle Checklist

Voor elke factuur controleer:
- [ ] Factuurnummer is correct
- [ ] Datums zijn in YYYY-MM-DD formaat
- [ ] Bedragen zijn numeriek (geen €, komma = punt)
- [ ] Ordernummer is in ORD-YYYYMMDD formaat
- [ ] Line items som komt overeen met totaal
- [ ] BTW berekening klopt (21% van subtotaal)
- [ ] outstanding_amount is correct (0 als paid, anders = amount)
- [ ] customer_id wordt correct opgezocht
- [ ] JSONB syntax is geldig

## Voorbeeld: Complete Workflow

1. **PDF Upload** → OCR tool (Adobe, Google Drive)
2. **Text Extractie** → Kopieer factuur data
3. **ChatGPT Prompt** → Gebruik bovenstaande prompt template
4. **SQL Query** → Kopieer output van ChatGPT
5. **Database Test** → Test eerst met SELECT query
6. **Execute** → Voer UPDATE/INSERT uit in Supabase SQL Editor
7. **Verificatie** → Controleer resultaat in admin panel

---

**Let op:** Deze handleiding is specifiek voor de `customer_invoices` tabel in dit project. Pas aan indien nodig voor andere systemen.

