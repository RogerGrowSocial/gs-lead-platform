# Employee Detail Page - Beschrijving

## Overzicht
De employee detail pagina toont een uitgebreid overzicht van een individuele werknemer met alle relevante informatie, statistieken en activiteiten.

## Wat wordt er getoond:

### 1. Header Sectie
- **Naam**: Volledige naam van de werknemer (first_name + last_name)
- **Status badge**: "Actief" of "Inactief" gebaseerd op de status in de database
- **Admin badge**: Wordt getoond als de werknemer admin rechten heeft
- **Performance Score**: Alleen getoond als er een performance_score > 0 is
- **Rol**: De display_name van de rol (bijv. "Manager", "Developer", "Admin")
- **Afdeling**: Optioneel, als deze is ingesteld
- **Contact informatie**:
  - E-mailadres
  - Telefoonnummer (indien beschikbaar)
  - Locatie (indien beschikbaar)
  - Startdatum (wanneer de werknemer is aangemaakt)

### 2. Statistieken Cards (3 cards)
- **Deals Gewonnen**: Aantal gewonnen/completed leads en opportunities
- **In Progress**: Aantal leads/opportunities die nog in behandeling zijn
- **Totale Omzet**: Som van alle gewonnen deals (price_at_purchase van leads + value van opportunities)

### 3. Tabs Sectie

#### Tab 1: Activiteit
- **Activiteit Tijdlijn**: Toont de laatste 10 activiteiten van de werknemer
- Activiteiten worden opgehaald uit de `lead_activities` tabel
- Elke activiteit toont:
  - Type (deal_won, meeting, email, note)
  - Beschrijving
  - Relatieve tijd (bijv. "Vandaag", "2 dagen geleden")

#### Tab 2: Recente Deals
- **Recente Deals**: Toont de laatste 5 deals die nog in behandeling zijn
- Data komt van:
  - Leads tabel (status: new, contacted, qualified, proposal)
  - Opportunities tabel (status: open, in_progress, negotiation)
- Elke deal toont:
  - Bedrijfsnaam
  - Verwachtte sluitingsdatum
  - Waarde
  - Status badge

#### Tab 3: Performance
- **Maandelijkse Performance**: Toont de laatste 6 maanden met gewonnen deals
- Data wordt berekend uit:
  - Gewonnen leads (status: won, completed, converted)
  - Gewonnen opportunities (status: won)
- Per maand wordt getoond:
  - Maand naam
  - Aantal gewonnen deals
  - Totale omzet voor die maand

### 4. Sidebar (Rechts)

#### Vaardigheden
- Lijst van vaardigheden van de werknemer
- Standaard: "Algemeen" als er geen vaardigheden zijn ingesteld
- Kan worden aangepast op basis van afdeling:
  - Sales: Sales, Account Management, CRM
  - Marketing: Marketing, Content, SEO

#### Snelle Statistieken
- **Gem. deal waarde**: Totale omzet gedeeld door aantal gewonnen deals
- **Win rate**: Hardcoded op 75% (kan later dynamisch worden)
- **Gem. deal cyclus**: Hardcoded op 32 dagen (kan later dynamisch worden)
- **Actieve prospects**: Hardcoded op 12 (kan later dynamisch worden)

#### Performance Trend
- **Trend indicator**: Toont +18% vs vorige maand
- **Notitie**: "Top performer" (kan later dynamisch worden)

## Data Bronnen

### Database Tabellen:
1. **profiles**: Basis werknemer informatie
2. **roles**: Rol informatie met display_name
3. **leads**: Leads toegewezen aan de werknemer (user_id)
4. **opportunities**: Opportunities toegewezen aan de werknemer (assigned_to)
5. **lead_activities**: Activiteiten van de werknemer (created_by)

### Berekeningen:
- **Deals Gewonnen**: Count van leads + opportunities met status 'won'/'completed'/'converted'
- **In Progress**: Count van leads + opportunities met status 'new'/'contacted'/'qualified'/'proposal'/'open'/'in_progress'/'negotiation'
- **Totale Omzet**: Sum van price_at_purchase (leads) + value (opportunities) voor gewonnen deals
- **Maandelijkse Performance**: Groepeert gewonnen deals per maand en berekent deals count en revenue per maand

## Styling
- Alle borders gebruiken: `1px solid #e5e7eb` met `border-radius: 0.5rem` (consistent met /admin/employees)
- Geen padding rond header en content containers
- Witte achtergrond (#ffffff)
- Inter font family (consistent met platform)

