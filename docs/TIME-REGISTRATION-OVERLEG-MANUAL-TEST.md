# Tijdregistratie Overleg – handmatige testchecklist

Na het uitvoeren van de migratie `20260224100000_time_entries_overleg.sql` (of vergelijkbare overleg-velden) en deploy:

## 1. Andere types ongewijzigd
- [ ] Klantenwerk, Sales, Support: bestaande velden en flow werken zoals voorheen.
- [ ] Geen Overleg-velden zichtbaar bij andere activiteitstypes.

## 2. Overleg – startformulier
- [ ] Selecteer "Waar werk je aan?" = Overleg.
- [ ] Overleg-container zichtbaar: Soort overleg (dropdown), Deelnemers (zoekveld + chips), Koppel aan (zoekveld).
- [ ] Titel-placeholder: "Bijv. Weekstart / Klant call / 1:1 Servé".
- [ ] Alleen titel invullen + Start → timer start (meeting_type default "intern", geen deelnemers/context).
- [ ] Soort overleg kiezen (Intern/Klant/Partner/1:1/Overig) + optioneel deelnemers en/of Koppel aan → Start → entry heeft meeting_type, participant_user_ids, context_type/context_id waar ingevuld.

## 3. Deelnemers zoeken
- [ ] Bij Overleg, in "Deelnemers" min. 2 tekens typen → dropdown met profielen (profiles/search).
- [ ] Klik op een resultaat → chip verschijnt; nog een toevoegen mogelijk.
- [ ] × op chip → deelnemer verwijderd.
- [ ] Start met deelnemers gekozen → entry heeft participant_user_ids array.

## 4. Koppel aan (Overleg)
- [ ] "Koppel aan" bij Overleg: zoeken (min. 2 tekens) →zelfde context-search resultaten als Sales (deal/kans/klant/contact).
- [ ] Item kiezen → veld toont titel; clear-knop zichtbaar.
- [ ] Start met koppeling → entry heeft context_type + context_id.

## 5. Titel-prefill (optioneel)
- [ ] Overleg geselecteerd, titel leeg, soort overleg "Intern" → Start → titel wordt "Overleg - Intern (team)" (of gekozen type).
- [ ] Eerst deelnemer toevoegen, titel leeg → Start → titel wordt "Overleg met [naam eerste deelnemer]".

## 6. Timer loopt – wissel naar Overleg
- [ ] Start een timer (willekeurig type), open popover → "Nieuwe activiteit" = Overleg.
- [ ] Switch-Overlegblok zichtbaar: Soort overleg, Deelnemers, Koppel aan.
- [ ] Invullen en "Wissel taak" → actieve entry wordt Overleg met meeting_type, participant_user_ids, context.
- [ ] "Wijzig details" met Overleg geselecteerd → PUT active-timer met overleg-velden.

## 7. Uitklokken (Overleg)
- [ ] Timer loopt op Overleg → Uitklokken → body bevat project_name "Overleg", meeting_type, participant_user_ids, context_type/context_id.
- [ ] Geen Sales-nudge voor Overleg; direct uitklokken mogelijk.

## 8. updateUI – actieve Overleg-entry
- [ ] Timer loopt op Overleg → popover openen → "Nieuwe activiteit" staat op Overleg, switch-Overlegblok zichtbaar.
- [ ] Soort overleg en Koppel aan zijn vooringevuld uit currentEntry.

## 9. Time entries-pagina
- [ ] `/admin/time-entries`: bij Overleg-entries toont meta-regel "Intern (team)" / "Klant" etc. (meeting_type) en "Met: N deelnemer(s)" indien participant_user_ids aanwezig.

## 10. Backwards compatibility
- [ ] Bestaande time entries zonder meeting_type/participant_user_ids tonen geen fouten.
- [ ] Clock-in met alleen project_name "Overleg" + note (zonder extra velden) blijft werken.
