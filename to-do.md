# To-Do Lijst - GS Lead Platform

## 🎨 UI/UX Verbeteringen

### Prioriteit: Hoog
- [ ] **Zorgen dat er nergens layout shifts / css flickeringen zijn ook niet bij hard refresh**
  - Implementeren van CSS-in-JS of critical CSS inlining voor boven de fold content
  - Zorgen voor juiste width/height attributen op afbeeldingen
  - Preload van kritieke fonts en stylesheets
  - Skeleton loaders voor async content om layout shifts te voorkomen
  - Testen op verschillende browsers en netwerkcondities

- [ ] **Design Token Centralisatie**
  - Centrale design tokens definiëren (`public/css/design-tokens.css`)
  - Alle inline styles vervangen door token variabelen
  - Consistentie tussen EJS templates en React components
  - Tailwind configuratie updaten met design tokens

- [ ] **Loading States Standardisatie**
  - Uniforme skeleton loaders voor alle async content
  - Consistente spinners en loading indicators
  - Loading states voor zowel React als EJS templates

- [ ] **CSS Cascade Cleanup**
  - Conflicterende CSS regels opruimen
  - Z-index stacking context issues oplossen
  - Modal container overflow handling verbeteren
  - Dropdown positioning issues oplossen (zie DROPDOWN_ISSUE_ANALYSIS.md)

## 🔒 Security & Database

### Prioriteit: Kritiek
- [ ] **RLS Policy Hardening**
  - `lead_usage` tabel RLS policies fixen (voorkomt cross-user data modification)
  - WITH CHECK constraints toevoegen aan SELECT policies
  - Audit logging implementeren voor sensitive operations
  - Testen van alle RLS policies

- [ ] **Payment Idempotency**
  - `payment_events` tabel aanmaken voor webhook event tracking
  - Webhook signature verificatie implementeren
  - Duplicate payment detection verbeteren
  - Idempotency keys gebruiken voor alle payment webhooks

## 🚀 Performance Optimalisaties

### Prioriteit: Medium
- [ ] **Database Optimalisatie**
  - Composite indexes toevoegen op veelgebruikte query kolommen
  - Query result caching voor KPI data
  - GIN indexes op JSONB kolommen (`payment_details`, `metadata`)
  - Query performance analyseren en verbeteren

- [ ] **Frontend Optimalisatie**
  - Code splitting voor admin vs customer routes
  - Hydration issues tussen EJS/React oplossen
  - Image optimization voor charts en icons
  - Lazy loading implementeren waar mogelijk

- [ ] **Bundle Size Optimalisatie**
  - Unused dependencies verwijderen
  - Tree shaking optimaliseren
  - Dynamic imports voor grote componenten

## 🎯 Functionaliteit

### Prioriteit: Medium
- [ ] **Component Library**
  - Standaard Card component (`components/ui/Card.tsx`)
  - Standaard Button component (`components/ui/Button.tsx`)
  - Herbruikbare DataTable component (`components/ui/DataTable.tsx`)
  - Standaard Modal component (`components/ui/Modal.tsx`)
  - Consistent LoadingState component (`components/ui/LoadingState.tsx`)
  - Standaard EmptyState component (`components/ui/EmptyState.tsx`)
  - Consistent ErrorState component (`components/ui/ErrorState.tsx`)

- [ ] **Error Handling Verbetering**
  - Uniforme error handling patterns
  - Error boundaries voor React components
  - User-vriendelijke error messages
  - Consistent error logging

- [ ] **Button Styles Consistentie**
  - Alle buttons gebruiken `--primary-color: #ea5d0d`
  - Consistent `border-radius: 0.375rem`
  - Uniforme padding en spacing

- [ ] **Card Components Consistentie**
  - Standaard border: `1px solid #e5e7eb`
  - Uniforme padding: `24px`
  - Consistente border-radius

- [ ] **Typography Hierarchy**
  - Consistente font-weight waarden
  - Uniforme line-height waarden
  - Design token systeem voor kleuren

## 📊 Testing & Kwaliteit

### Prioriteit: Medium
- [ ] **Test Coverage**
  - Unit tests voor kritieke services
  - Integration tests voor payment flows
  - E2E tests voor belangrijke user flows
  - RLS policy tests

- [ ] **Browser Compatibiliteit**
  - Testen op Chrome, Firefox, Safari, Edge
  - Mobile responsiveness testen
  - Cross-browser CSS issues oplossen

## 📝 Documentatie

### Prioriteit: Laag
- [ ] **Code Documentatie**
  - JSDoc comments voor alle services
  - README updates voor nieuwe features
  - API documentatie bijwerken

- [ ] **Developer Onboarding**
  - Setup guide verbeteren
  - Development workflow documentatie
  - Best practices documentatie

## 🔧 Technical Debt

### Prioriteit: Medium
- [ ] **Code Organization**
  - Service layer refactoring
  - Helper functions organiseren
  - Duplicate code elimineren

- [ ] **Migration Scripts**
  - Database migrations standaardiseren
  - Rollback scripts toevoegen
  - Migration testing automatiseren

## 📅 Geplande Features

### Prioriteit: Variabel
- [ ] Feature aanvragen via issue tracker
- [ ] Feature prioritering met stakeholders

---

**Laatste update:** Januari 2025
**Status:** Actief onderhoud

