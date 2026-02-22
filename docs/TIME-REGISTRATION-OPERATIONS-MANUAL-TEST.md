# Tijdregistratie Operations – handmatige testchecklist

Na het uitvoeren van de migratie `20260225100000_time_entries_operations.sql` en deploy:

## 1. Andere types ongewijzigd
- [ ] Klantenwerk, Sales, Support, Overleg: bestaande velden en flow werken zoals voorheen.
- [ ] Geen Operations-velden zichtbaar bij andere activiteitstypes.

## 2. Operations – startformulier
- [ ] Selecteer "Waar werk je aan?" = Operations.
- [ ] Operations-container zichtbaar: Operations categorie (dropdown), Area/Project (tekst), Koppel aan (zoekveld), Impact (dropdown).
- [ ] Titel-placeholder: "Bijv. Zapier fix / Dashboard verbeteringen / Facturatie run".
- [ ] Alleen titel invullen + Start → timer start (ops_category default "Algemeen").
- [ ] Categorie kiezen (Processen, Automations, Data, Platform, etc.) + optioneel area en/of Koppel aan + Start → entry heeft ops_category, ops_area, context_type/context_id waar ingevuld.

## 3. Titel-prefill (optioneel)
- [ ] Operations geselecteerd, titel leeg, area ingevuld → Start → titel wordt "Operations - {area}".
- [ ] Geen area, titel leeg → Start → titel wordt "Operations - {categorie label}".

## 4. Koppel aan (Operations)
- [ ] "Koppel aan" bij Operations: zoeken (min. 2 tekens) →zelfde context-search resultaten (deal/kans/klant/contact).
- [ ] Item kiezen → veld toont titel; clear-knop zichtbaar.
- [ ] Start met koppeling → entry heeft context_type + context_id.

## 5. Impact (optioneel)
- [ ] Impact-dropdown: Bespaart tijd, Verhoogt omzet, Vermindert fouten, Compliance (of leeg).
- [ ] Start met impact gekozen → entry heeft ops_impact.

## 6. Timer loopt – wissel naar Operations
- [ ] Start een timer, open popover → "Nieuwe activiteit" = Operations.
- [ ] Switch-Operationsblok zichtbaar: categorie, area, Koppel aan, impact.
- [ ] Invullen en "Wissel taak" → actieve entry wordt Operations met ops_category, ops_area, ops_impact, context.
- [ ] "Wijzig details" met Operations geselecteerd → PUT active-timer met ops-velden.

## 7. Uitklokken (Operations)
- [ ] Timer loopt op Operations → Uitklokken → body bevat project_name "Operations", ops_category, ops_area, ops_impact, context_type/context_id.
- [ ] Direct uitklokken mogelijk (geen nudge).

## 8. updateUI – actieve Operations-entry
- [ ] Timer loopt op Operations → popover openen → "Nieuwe activiteit" staat op Operations, switch-Operationsblok zichtbaar.
- [ ] Categorie, area, impact en Koppel aan zijn vooringevuld uit currentEntry.

## 9. Time entries-pagina
- [ ] `/admin/time-entries`: bij Operations-entries toont meta-regel categorie (label), area en eventueel impact.

## 10. Backwards compatibility
- [ ] Bestaande time entries zonder ops_category/ops_area/ops_impact tonen geen fouten.
- [ ] Clock-in met alleen project_name "Operations" + note (zonder extra velden) blijft werken.
