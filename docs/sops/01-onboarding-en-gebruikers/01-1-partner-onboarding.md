# SOP 01.1 – Partner onboarding (flow)

**Doel:** Stapsgewijs overzicht van wat een nieuwe partner na aanmelding doorloopt in het platform.

**Doelgroep:** Intern (support, sales) en voor uitleg naar partners.

---

## Stap 1: Aanmelding

1. Partner bezoekt de signup-pagina.
2. Vul in: e-mail, wachtwoord, bedrijfsnaam.
3. Systeem maakt Supabase auth user aan.
4. Database-trigger maakt een `profiles`-record.
5. Indien ingeschakeld: e-mailverificatie wordt verstuurd.
6. Doorverwijzing naar de onboarding-wizard.

---

## Stap 2: Onboarding-wizard

1. **Stap 1 – Persoonlijke gegevens:** voornaam, achternaam, telefoon.
2. **Stap 2 – Bedrijfsgegevens:** adres, KVK-nummer, BTW-nummer.
3. **Stap 3 – Leadvoorkeuren:** branches (industrieën), regio’s, budget.
4. Stappen kunnen worden overgeslagen en later worden ingevuld.
5. Voortgang wordt na elke stap opgeslagen.

---

## Stap 3: Betalingsgegevens

1. Partner gaat naar betalingsinstellingen.
2. Kiest betaalmethode:
   - **SEPA:** bankgegevens invullen en verifiëren.
   - **Card:** kaartgegevens via Mollie invullen.
3. Status betaalmethode: `pending` → na verificatie `active`.
4. **Belangrijk:** Zonder actieve betaalmethode heeft de partner **geen capaciteit** (0 leads).

---

## Stap 4: Capaciteit instellen

1. Partner stelt `max_open_leads` in (slider of invoerveld).
2. Systeem synchroniseert segmenten op basis van capaciteit.
3. Segmenten worden aangemaakt/geactiveerd voor (branch, regio)-combinaties.
4. Partner is daarna klaar om leads te ontvangen.

---

## Controlepunten voor support

- Is het profiel volledig (naam, bedrijf, voorkeuren)?
- Is er een actieve betaalmethode?
- Is capaciteit > 0 en zijn voorkeuren (branches/regio’s) ingevuld?
- Zie ook: [SOP 01.2 – Gebruikersbeheer](01-2-gebruikersbeheer-admin.md) voor aanpassingen door admin.

---

**Gerelateerd:** `docs/03-flows/user_flows.md` (Onboarding Flow)
