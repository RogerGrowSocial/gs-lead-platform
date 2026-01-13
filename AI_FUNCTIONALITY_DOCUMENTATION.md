# AI Functionaliteit Documentatie - GrowSocial Platform

**Laatste update:** 31 oktober 2025  
**Versie:** 1.0

Dit document beschrijft alle AI-functionaliteiten binnen het GrowSocial platform, hoe ze werken, en waar ze worden toegepast.

---

## Overzicht AI Functionaliteiten

Het GrowSocial platform gebruikt AI voor de volgende functies:

1. **AI E-mail Labeling & Opportunity Suggesties** - Automatische detectie van leads in e-mails met suggestie om kansen te maken
2. **AI Waardeschatting Opportunities** - Automatische inschatting van potentiële deal waarde op basis van e-mailinhoud
3. **AI Sales Rep Suggesties** - Automatische matching van kansen aan de beste sales representative
4. **AI E-mail Antwoord Generatie** - Automatische generatie van professionele e-mail antwoorden
5. *(Toekomstige functies worden hier toegevoegd)*

---

## 1. AI E-mail Labeling & Opportunity Suggesties

### Locatie
- **Mail Inbox:** `/admin/mail`
- **Mail Detail Drawer:** Wanneer een e-mail wordt geopend

### Functionaliteit
Het systeem analyseert inkomende e-mails en:
1. **Labelt e-mails automatisch** op basis van inhoud (lead, newsletter, customer_request, urgent, etc.)
2. **Detecteert sales leads** door keywords te herkennen
3. **Toont een suggestie** om een opportunity te maken voor e-mails die als "lead" of "customer_request" zijn gelabeld

### Implementatie Details

#### Backend Logic
**Bestand:** `services/aiMailService.js`

**Twee methodes:**

1. **Keyword-Based Labeling** (Fallback):
   - Analyseert e-mail inhoud op keywords
   - Detecteert leads op basis van: "nieuwe website", "website laten maken", "hoeveel kost", "prijs", "offerte", "interesse", etc.
   - Retourneert labels met confidence scores

2. **OpenAI Labeling** (Primair, indien API key beschikbaar):
   - Gebruikt GPT-4o-mini model voor intelligente labeling
   - Analyseert context beter dan keyword matching
   - Retourneert labels met hogere confidence (0.85)

**Lead Detectie Keywords:**
```javascript
'nieuwe website', 'website laten maken', 'hoeveel kost', 
'prijs', 'kosten', 'offerte', 'interesse', 'mogelijkheden',
'graag een', 'wil graag'
```

**Labels die opportunity suggestie triggeren:**
- `lead` (confidence: 0.90)
- `customer_request` (confidence: 0.85)
- `follow_up` (indien aanwezig)

#### Frontend Weergave

**Mail Detail Drawer:**
- Bij e-mails met `lead`, `customer_request`, of `follow_up` label wordt een tip getoond
- Tip bevat: "AI suggereert om een kans te maken" met een "Maak kans" button
- Gebruiker kan met één klik een opportunity aanmaken vanuit de e-mail

**Route:** `POST /api/opportunities/from-mail/:id`
- Maakt automatisch een opportunity aan met:
  - Title: E-mail onderwerp
  - Contact naam: Afzender naam
  - Email: Afzender e-mail
  - Company name: Geëxtraheerd uit e-mail domein (indien niet Gmail/Hotmail/Outlook)
  - **Value: AI geschatte waarde** (zie sectie 2 hieronder)
  - Notes: E-mail inhoud (eerste 2000 karakters)
  - Status: 'open'
  - Stage: 'nieuw'
- Markeert e-mail als `lead_created`

### Gebruik

**Wanneer wordt suggestie getoond:**
- ✅ E-mail heeft label `lead`, `customer_request`, of `follow_up`
- ✅ Suggestie verschijnt automatisch in mail drawer
- ✅ Gebruiker kan kiezen om suggestie te accepteren of te negeren

**Workflow:**
1. E-mail wordt ontvangen en automatisch gelabeld
2. Bij openen van e-mail wordt label gecontroleerd
3. Als label suggestie triggert, wordt tip getoond
4. Gebruiker klikt "Maak kans" button
5. Opportunity wordt aangemaakt met relevante informatie uit e-mail
6. Gebruiker wordt naar nieuwe opportunity gebracht

---

## 2. AI Waardeschatting Opportunities

### Locatie
- **Automatisch bij aanmaken:** Wanneer een opportunity wordt aangemaakt vanuit e-mail via `/api/opportunities/from-mail/:id`
- **Opportunity Detail Pagina:** Toont de geschatte waarde in het value veld

### Functionaliteit
Het systeem analyseert e-mailinhoud automatisch en schat de potentiële waarde van de opportunity op basis van:
- **Bedrijfsgrootte:** Grote makelaar/groot bedrijf = hoog, eenpitter/kleine zaak = laag
- **Project omvang:** Enterprise/grote website/complex = hoog, kleine website/simpel = laag
- **Budget indicatoren:** Expliciet genoemde budgetten of indicaties (€100/maand = laag, €10.000+ = hoog)
- **Bedrijfstype:** Makelaar/vastgoed/MKB = vaak hoger, zzp'er/kleine zaak = vaak lager
- **Service type:** E-commerce/CRM/software = hoger, alleen SEO = lager

### Implementatie Details

#### Backend Logic
**Bestand:** `services/aiMailService.js`

**Method:** `estimateOpportunityValue(mail)`

**Twee methodes:**

1. **OpenAI Waardeschatting** (Primair, indien API key beschikbaar):
   - Gebruikt GPT-4o-mini model voor contextuele analyse
   - Analyseert volledige e-mail inhoud voor betere inschatting
   - Retourneert een specifiek bedrag in euro's

2. **Keyword-Based Waardeschatting** (Fallback):
   - Analyseert keywords en patronen in e-mail
   - Past multipliers toe op basis van indicatoren
   - Basiswaarde: €2.500 (MKB standaard)

**Waarde Bereik:**
- **Laag (€500 - €1.500):** Kleine eenpitter, simpele SEO voor €100/maand
- **MKB (€2.500 - €7.500):** Standaard website, basis diensten
- **Hoog (€10.000 - €25.000):** Grote makelaar, grote website, e-commerce
- **Enterprise (€30.000 - €100.000):** Complexe projecten, enterprise oplossingen

**High Value Indicators:**
- Enterprise, groot bedrijf, multinational
- Makelaar, makelaarskantoor, vastgoed
- Grote website, veel pagina's, complex project
- E-commerce, webshop
- CRM, software ontwikkeling, platform
- Expliciet hoog budget genoemd (€10.000+)

**Low Value Indicators:**
- Eenpitter, zzp, zelfstandige, particulier
- Zeer laag budget (€100/maand)
- Simpele/basis website
- Alleen SEO zonder andere diensten

#### Frontend Weergave

**Opportunity Detail Pagina:**
- Value veld wordt automatisch gevuld met AI geschatte waarde
- Gebruiker kan waarde handmatig aanpassen indien nodig
- Waarde wordt getoond in groot formaat (€ teken, 42px font)

**Opportunity Listing:**
- Geschatte waarde wordt getoond in opportunity cards
- Formaat: € X.XXX,XX

### Gebruik

**Wanneer wordt waarde geschat:**
- ✅ Automatisch bij aanmaken opportunity vanuit e-mail
- ✅ Gebruikt volledige e-mail inhoud (subject + body)
- ✅ Werkt op de achtergrond zonder gebruiker interventie

**Workflow:**
1. E-mail wordt gelabeld als "lead"
2. Gebruiker klikt "Maak kans" button
3. AI analyseert e-mailinhoud
4. Waarde wordt automatisch ingeschat en opgeslagen
5. Opportunity wordt aangemaakt met geschatte waarde
6. Gebruiker kan waarde handmatig aanpassen indien nodig

**Nauwkeurigheid:**
- OpenAI inschatting: Meest accuraat, gebruikt contextuele analyse
- Keyword-based: Goed voor basis scenarios, minder accuraat voor complexe cases
- Gebruikers wordt aangeraden waarde te reviewen en aan te passen indien nodig

### Technische Specificaties

**Algoritme (Keyword-Based):**
```javascript
Startwaarde: €2.500 (MKB standaard)
Multiplier systeem:
- Enterprise indicatoren: 2.5x
- Makelaar/vastgoed: 2.0x
- E-commerce: 1.6x
- CRM/software: 1.7x
- Kleine zaak: 0.4x
- Zeer laag budget: 0.3x

Finale waarde = (base value * multiplier) afgerond naar 100 of 500
Min: €500
Max: €100.000
```

**Budget Extractie:**
- Detecteert expliciete budget vermeldingen (bijv. "€10.000", "10k", "tien duizend")
- Gebruikt 80% van genoemd budget als geschatte waarde
- Voor maandelijkse bedragen wordt jaarlijkse waarde geschat

---

## 3. AI Sales Rep Suggesties

### Locatie
- **Opportunities Listing Pagina:** `/admin/opportunities`
- **Opportunity Detail Pagina:** `/admin/opportunities/:id`

### Functionaliteit
De AI analyseert historische deal data en matcht elke ontoegewezen kans aan de meest geschikte sales representative op basis van:
- **Success Rate (0-50 punten):** Hoeveel procent van deals heeft de rep gewonnen
- **Ervaring (0-30 punten):** Aantal deals dat de rep heeft afgehandeld (meer = beter)
- **Value Match (0-20 punten):** Hoe goed de gemiddelde deal waarde van de rep matcht met de kans waarde

### Implementatie Details

#### Backend Logic
**Bestand:** `routes/admin.js`

**Functies:**
- Listing pagina: `generateAISuggestion` (regel ~5167)
- Detail pagina: Inline AI Suggestion Logic (regel ~5347)

```javascript
// Voor elke sales rep wordt een score berekend:
// 1. Success Rate (0-50): (wonDeals / totalDeals) * 50
// 2. Experience (0-30): Math.min(30, (dealCount / 10) * 30)
// 3. Value Match (0-20): Gebaseerd op verschil tussen gemiddelde deal waarde en kans waarde

// Top match wordt gebruikt als primaire suggestie
// 2e en 3e match worden gebruikt als alternatieve opties
```

**Data Bronnen:**
- `deals` tabel: `sales_rep_id`, `status`, `value_eur`
- `profiles` tabel: Sales rep informatie
- `opportunities` tabel: Huidige kans details

**Output:**
- **Primaire Suggestie:** Top match met `rep_id`, `rep_name`, `confidence`, `match_percentage`, `reason`
- **Alternatieven:** 2e en 3e beste match (indien beschikbaar)

#### Frontend Weergave

**Listing Pagina (`/admin/opportunities`):**
- AI suggestie wordt getoond in elke opportunity card
- Bevat: rep naam, match percentage badge, reden, en "Toewijzen" button
- Alleen getoond voor ontoegewezen kansen

**Detail Pagina (`/admin/opportunities/:id`):**
- AI card in de rechter sidebar
- Primaire suggestie met volledige details
- "Alternatieve opties" sectie met 2-3 extra suggesties
- Alle suggesties tonen match percentage en reden

#### Styling
**Bestanden:**
- `public/css/opportunities.css` - Listing pagina styling
- `public/css/opportunity-detail.css` - Detail pagina styling

**Kenmerken:**
- Blauw gradient achtergrond (#eff6ff naar #ffffff)
- SVG sparkle icon (16x16px)
- Match percentage badge met blauwe styling
- Witte button met blauwe border voor toewijzing

### Gebruik

**Wanneer wordt AI suggestie getoond:**
- ✅ Alleen voor kansen die nog **niet** toegewezen zijn (`assigned_to` is null)
- ✅ Alleen als er minstens 1 sales rep beschikbaar is
- ✅ Alleen als de score > 0 is

**Automatische Toewijzing:**
Het systeem wijst automatisch de beste sales rep toe in de volgende scenario's:
1. ✅ **Bij aanmaken vanuit e-mail:** Wanneer een opportunity wordt aangemaakt via `/api/opportunities/from-mail/:id`
2. ✅ **Bij verwijderen toewijzing:** Wanneer een opportunity wordt bijgewerkt en `assigned_to` wordt verwijderd/leeg gemaakt
3. ✅ **Bulk toewijzing:** Via `/api/opportunities/auto-assign-all` endpoint voor alle niet-toegewezen opportunities

**Handmatige Toewijzing:**
1. Gebruiker klikt "Toewijzen" button bij AI suggestie
2. Frontend stuurt POST request naar `/admin/opportunities/:id/assign`
3. Backend update `assigned_to` en `assigned_to_name` in `opportunities` tabel
4. Pagina herlaadt om toegewezen status te tonen

**Automatische Toewijzing Logica:**
- Gebruikt dezelfde scoring algoritme als AI suggesties
- Berekent scores voor alle beschikbare sales reps
- Wijs automatisch toe aan de rep met hoogste score (indien score > 0)
- Werkt op de achtergrond zonder gebruiker interventie

### Technische Specificaties

**Scoring Algoritme:**
```javascript
Total Score = Success Rate Score + Experience Score + Value Match Score

Success Rate Score = (wonDeals / totalDeals) * 50
Experience Score = Math.min(30, (dealCount / 10) * 30)
Value Match Score = (1 - (valueDiff / maxValue)) * 20
```

**Limitaties:**
- Nieuwe sales reps zonder historische data krijgen default 50% success rate
- Maximum 30 punten voor ervaring (bij 10+ deals)
- Value match is 0 als rep geen deals heeft afgehandeld

**Performance:**
- Alle deals worden eenmaal opgehaald per request
- Stats worden in-memory berekend voor alle reps
- Scores worden gesorteerd om top matches te vinden

---

---

## 4. AI E-mail Antwoord Generatie

### Locatie
- **Mail Detail Drawer:** `/admin/mail` - bij openen van e-mail

### Functionaliteit
Het systeem genereert automatisch professionele e-mail antwoorden op basis van:
- Originele e-mail inhoud
- Gekozen stijl (professioneel, vriendelijk, casual)
- Taal (Nederlands of Engels)
- Formaliteit (formeel, neutraal, informeel)
- Lengte (kort, medium, lang)

### Implementatie Details

#### Backend Logic
**Bestand:** `services/aiMailService.js`

**Method:** `generateReplyDraft()`

**Twee modi:**

1. **OpenAI Generatie** (Primair, indien API key beschikbaar):
   - Gebruikt GPT-4o-mini model
   - Analyseert originele e-mail volledig
   - Genereert contextueel relevant antwoord
   - Past stijl aan volgens gebruiker voorkeuren
   - Handhaaft consistent taalgebruik (je/jouw vs u/uw)

2. **Template-Based Generatie** (Fallback):
   - Gebruikt vooraf gedefinieerde templates
   - Passt templates aan op basis van stijl instellingen
   - Ondersteunt custom instructions

**Styling Opties:**
- Tone: `professional`, `friendly`, `casual`
- Language: `nl`, `en`
- Formality: `formal`, `neutral`, `casual`
- Length: `short`, `medium`, `long`
- Custom Instructions: Vrije tekst instructies

**Frontend Integratie:**
- Gebruiker klikt "AI Antwoord" button in mail drawer
- Loading state wordt getoond
- Generatief antwoord wordt in textarea geplaatst
- Gebruiker kan antwoord bewerken voordat het wordt verzonden

### Gebruik

**Wanneer te gebruiken:**
- Voor alle e-mails waarop je wilt antwoorden
- Vooral handig voor standaard vragen of follow-ups
- Altijd reviewen en aanpassen indien nodig

**Best Practices:**
- Review AI gegenereerde antwoorden altijd
- Pas aan voor persoonlijke touch
- Voeg specifieke details toe die AI niet kan weten
- Handtekening wordt automatisch toegevoegd bij verzenden

---

## 5. Toekomstige AI Functionaliteiten

*(Hier worden nieuwe AI functies gedocumenteerd wanneer ze worden toegevoegd)*

### Geplande Features:
- AI-powered lead scoring
- Predictive analytics voor deal closing
- Chatbot integratie
- Automatische follow-up scheduling
- Sentiment analyse van e-mails

---

## Best Practices

### Voor Developers

1. **AI Logica Updaten:**
   - Wijzigingen aan AI algoritme moeten in dit document worden gedocumenteerd
   - Test altijd met verschillende data scenarios
   - Zorg voor fallback gedrag bij ontbrekende data

2. **Performance:**
   - AI berekeningen moeten snel zijn (< 500ms)
   - Cache resultaten waar mogelijk
   - Overweeg background jobs voor complexe berekeningen

3. **UX:**
   - Altijd duidelijk maken waarom AI een suggestie doet (reden tonen)
   - Laat gebruikers altijd controle houden (override mogelijk)
   - Geef visuele feedback tijdens AI processing

### Voor Gebruikers

1. **Wanneer te gebruiken:**
   - AI suggesties zijn richtlijnen, niet verplichte keuzes
   - Bekijk altijd alternatieve opties voor context
   - Pas handmatige toewijzing aan indien nodig

2. **Betrouwbaarheid:**
   - AI wordt beter naarmate er meer historische data is
   - Nieuwe reps hebben lagere betrouwbaarheid
   - Review AI suggesties regelmatig voor feedback

---

## Changelog

### 31 oktober 2025 - v1.2
- ✅ **AI WAARDESCHATTING IMPLEMENTATIE:** Automatische waardeschatting bij aanmaken opportunities vanuit e-mail
- ✅ OpenAI-powered waardeschatting voor accurate inschattingen
- ✅ Keyword-based fallback voor betrouwbaarheid
- ✅ Ondersteuning voor bedrijfsgrootte, project omvang, budget detectie
- ✅ Documentatie bijgewerkt met nieuwe functie

### 31 oktober 2025 - v1.1
- ✅ **AUTOMATISCHE TOEWIJZING IMPLEMENTATIE:** Opportunities worden nu automatisch toegewezen aan beste sales rep
- ✅ Automatische toewijzing bij aanmaken vanuit e-mail
- ✅ Automatische toewijzing bij verwijderen toewijzing
- ✅ Bulk auto-assign endpoint toegevoegd (`/api/opportunities/auto-assign-all`)
- ✅ `autoAssignOpportunity()` helper functie geïmplementeerd

### 31 oktober 2025 - v1.0
- ✅ Eerste versie AI Sales Rep Suggesties geïmplementeerd
- ✅ Support voor alternatieve opties toegevoegd (top 3 matches)
- ✅ UI/UX styling afgerond voor listing en detail pagina's
- ✅ Backend scoring algoritme geoptimaliseerd
- ✅ AI E-mail Labeling & Opportunity Suggesties gedocumenteerd
- ✅ AI E-mail Antwoord Generatie gedocumenteerd

---

## Contact & Support

Voor vragen over AI functionaliteiten:
- **Documentatie updates:** Update dit bestand direct
- **Bug reports:** Documenteer in issues met AI label
- **Feature requests:** Voeg toe aan "Toekomstige AI Functionaliteiten" sectie

---

**Let op:** Dit document moet up-to-date blijven. Update dit bestand bij elke wijziging aan AI functionaliteiten.

