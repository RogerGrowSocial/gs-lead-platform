# Uitgebreide Probleembeschrijving: Flickering bij Page Navigation in Onboarding Tour

## Probleem
Bij navigatie tussen verschillende pagina's tijdens de onboarding tour (bijvoorbeeld van `/dashboard?tour=true&step=2` naar `/dashboard/leads?tour=true&step=3`) treedt er een zichtbare flickering op waarbij de overlay (dimming layer) kort verdwijnt en weer verschijnt.

## Technische Context

### Huidige Architectuur

1. **Pre-dim Overlay (CSS)**
   - In `views/layouts/dashboard.ejs` wordt een CSS class `tour-pre-dim` toegevoegd aan `document.body` zodra de pagina laadt met `?tour=true` in de URL
   - Deze class creëert een `::before` pseudo-element met `position: fixed`, `inset: 0`, en `background: rgba(0, 0, 0, 0.72)`
   - Dit zorgt voor een instant donkere overlay voordat JavaScript laadt
   - De overlay heeft een fade-in animatie: `animation: fadeInDim 0.15s ease-in forwards`

2. **JavaScript Tour Engine (`onboarding-spotlight.js`)**
   - De `GSTour` class beheert de tour state en rendering
   - Bij `start()` wordt de tour geïnitialiseerd en `renderCurrentStep()` aangeroepen
   - `positionHighlightAndTooltip()` creëert de daadwerkelijke highlight overlay (`#gs-tour-highlight`)
   - Deze highlight heeft `opacity: 0` als initiële state en wordt naar `opacity: 1` gezet in `positionHighlightAndTooltip()`

3. **Page Navigation Flow**
   - Wanneer een step naar een andere pagina moet navigeren (bijv. step 2 → step 3 naar `/dashboard/leads`):
     - `renderCurrentStep()` detecteert dat `step.page !== window.location.pathname`
     - Er wordt een `window.location.href` redirect uitgevoerd naar de nieuwe pagina met `?tour=true&step=3`
     - De nieuwe pagina laadt volledig (nieuwe HTML, nieuwe JavaScript context)

## Wat Er Gebeurt Bij Page Navigation

### Stap-voor-stap Analyse

1. **Op pagina 1 (`/dashboard?tour=true&step=2`)**:
   - Tour is actief, `#gs-tour-highlight` bestaat en is zichtbaar (`opacity: 1`)
   - `tour-pre-dim` class is verwijderd van `document.body` (verwijderd in `positionHighlightAndTooltip()`)

2. **Navigatie wordt geïnitieerd**:
   - `next()` wordt aangeroepen of `renderCurrentStep()` detecteert page mismatch
   - `window.location.href = '/dashboard/leads?tour=true&step=3'` wordt uitgevoerd
   - **Browser start volledige page reload**

3. **Nieuwe pagina begint te laden (`/dashboard/leads?tour=true&step=3`)**:
   - HTML wordt geparsed
   - CSS wordt geladen, inclusief de `tour-pre-dim::before` styles
   - JavaScript in `<head>` van `dashboard.ejs` detecteert `?tour=true` en voegt `tour-pre-dim` class toe aan `document.body`
   - **Pre-dim overlay verschijnt direct** (via CSS `::before` pseudo-element)

4. **JavaScript laadt en executeert**:
   - `onboarding-spotlight.js` laadt
   - `onboarding.js` laadt
   - Auto-start script in `dashboard.ejs` detecteert `?tour=true&step=3`
   - `window.GSTour.start()` wordt aangeroepen

5. **In `GSTour.start()`**:
   - **Probleem punt 1**: De code checkt `isPageNavigation` maar deze check werkt niet correct:
     ```javascript
     const isPageNavigation = isTourActive && currentStep?.page && 
                              window.location.pathname === currentStep.page &&
                              options.initialIndex > 0;
     ```
     - Bij een nieuwe page load is `this.state.isActive` altijd `false` (nieuwe JavaScript context)
     - Dus `isPageNavigation` is altijd `false` bij een echte page navigation
   - **Probleem punt 2**: Omdat `isPageNavigation` false is, wordt de volgende code uitgevoerd:
     ```javascript
     if (!isPageNavigation) {
       document.documentElement.classList.remove('tour-pre-dim');
       // ... oude overlays worden verborgen
     }
     ```
     - Dit verwijdert de `tour-pre-dim` class, waardoor de CSS overlay verdwijnt
   - **Probleem punt 3**: `ensureDom()` wordt aangeroepen, wat `#gs-tour-highlight` aanmaakt met `opacity: 0`
   - **Probleem punt 4**: `renderCurrentStep()` wordt aangeroepen, wat uiteindelijk `positionHighlightAndTooltip()` aanroept
   - **Probleem punt 5**: In `positionHighlightAndTooltip()` wordt `tour-pre-dim` verwijderd:
     ```javascript
     if (document.body.classList.contains("tour-pre-dim")) {
       document.body.classList.remove("tour-pre-dim");
     }
     ```
     - Maar dit gebeurt pas NADAT de highlight is gepositioneerd
   - **Probleem punt 6**: De highlight krijgt `opacity: 1`, maar dit gebeurt met een transition van `0.18s ease-out`

### De Flickering Sequence

**Moment 1 (0ms)**: Nieuwe pagina laadt
- `tour-pre-dim` class wordt toegevoegd aan `body`
- CSS `::before` overlay verschijnt (zwart, 72% opacity)

**Moment 2 (~50-100ms)**: JavaScript start
- `GSTour.start()` wordt aangeroepen
- `isPageNavigation` is `false` (omdat `this.state.isActive` false is)
- `tour-pre-dim` wordt verwijderd van `document.documentElement` (niet `body`!)
- CSS overlay verdwijnt → **FLICKER 1: overlay verdwijnt**

**Moment 3 (~100-200ms)**: DOM elements worden aangemaakt
- `#gs-tour-highlight` wordt aangemaakt met `opacity: 0`
- Element is nog niet zichtbaar

**Moment 4 (~200-300ms)**: `renderCurrentStep()` executeert
- `waitFor()` conditions worden gecheckt
- Target element wordt gevonden
- `positionHighlightAndTooltip()` wordt aangeroepen

**Moment 5 (~300-400ms)**: Highlight wordt gepositioneerd
- `tour-pre-dim` wordt verwijderd van `body` (maar was al weg)
- Highlight krijgt `opacity: 1` met transition
- **FLICKER 2: highlight fade-in (0.18s)**

## Root Causes

### 1. **State Loss bij Page Reload**
   - Bij een volledige page reload wordt alle JavaScript state gewist
   - `this.state.isActive` is altijd `false` in een nieuwe context
   - De `isPageNavigation` check kan daarom niet werken zoals bedoeld

### 2. **Race Condition tussen CSS en JavaScript**
   - CSS `tour-pre-dim` overlay verschijnt direct bij page load
   - JavaScript verwijdert deze overlay voordat de highlight klaar is
   - Er is een gap tussen het verwijderen van de CSS overlay en het zichtbaar maken van de JavaScript highlight

### 3. **Dubbele Overlay Removal**
   - `tour-pre-dim` wordt verwijderd in `start()` (van `document.documentElement`)
   - `tour-pre-dim` wordt opnieuw verwijderd in `positionHighlightAndTooltip()` (van `document.body`)
   - Dit kan timing issues veroorzaken

### 4. **Transition Timing**
   - De highlight heeft een `transition: opacity 0.18s ease-out`
   - Bij page navigation wordt deze transition niet uitgeschakeld (omdat `isPageNavigation` false is)
   - Dit veroorzaakt een zichtbare fade-in die als flickering wordt waargenomen

### 5. **Pre-dim Animation Conflict**
   - De CSS `tour-pre-dim::before` heeft een `fadeInDim` animatie van 0.15s
   - Deze animatie kan conflicteren met de JavaScript highlight fade-in
   - Als de CSS overlay wordt verwijderd tijdens de animatie, ontstaat er een visuele "jump"

## Visuele Manifestatie

De gebruiker ziet:
1. **Donker scherm** (pre-dim CSS overlay verschijnt)
2. **Korte flash van licht** (overlay wordt verwijderd voordat highlight klaar is)
3. **Fade-in van highlight** (JavaScript highlight verschijnt met transition)

Dit wordt waargenomen als een "flickering" of "flashing" effect.

## Belangrijke Code Secties

### `public/js/onboarding-spotlight.js` - `start()` method (regels 30-87)
```javascript
const isPageNavigation = isTourActive && currentStep?.page && 
                         window.location.pathname === currentStep.page &&
                         options.initialIndex > 0;

if (!isPageNavigation) {
  document.documentElement.classList.remove('tour-pre-dim');
  // ...
}
```

### `public/js/onboarding-spotlight.js` - `positionHighlightAndTooltip()` (regels 678-682)
```javascript
if (document.body.classList.contains("tour-pre-dim")) {
  document.body.classList.remove("tour-pre-dim");
}
```

### `views/layouts/dashboard.ejs` - Pre-dim CSS (regels 6-21)
```css
body.tour-pre-dim::before {
  content: "";
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  pointer-events: none;
  z-index: 2147483640;
  opacity: 0;
  transition: opacity 0.15s ease-in;
  animation: fadeInDim 0.15s ease-in forwards;
}
```

## Mogelijke Oplossingsrichtingen (Niet Geïmplementeerd)

1. **State Persistence**: Gebruik `sessionStorage` of `localStorage` om tour state te behouden tussen page navigations
2. **Smooth Transition**: Behoud de CSS overlay totdat de JavaScript highlight volledig zichtbaar is
3. **Instant Highlight**: Zet highlight direct op `opacity: 1` zonder transition bij page navigation
4. **Unified Overlay**: Gebruik één overlay systeem (CSS of JavaScript) in plaats van beide
5. **Navigation Detection**: Detecteer page navigation via URL parameters in plaats van state
6. **Pre-render**: Maak highlight element aan voordat de CSS overlay wordt verwijderd

## Test Scenario

1. Start tour op `/dashboard?tour=true&step=0`
2. Navigeer naar step 1 (blijft op `/dashboard`)
3. Navigeer naar step 2 (blijft op `/dashboard`)
4. Klik "Volgende" → navigeert naar `/dashboard/leads?tour=true&step=3`
5. **Flickering treedt op tijdens stap 4**

## Conclusie

Het flickering probleem wordt veroorzaakt door een combinatie van:
- Verlies van JavaScript state bij page reload
- Race condition tussen CSS pre-dim overlay en JavaScript highlight
- Onjuiste detectie van page navigation
- Timing issues tussen overlay removal en highlight visibility

De huidige `isPageNavigation` check werkt niet omdat deze afhankelijk is van `this.state.isActive`, wat altijd `false` is bij een nieuwe page load.

