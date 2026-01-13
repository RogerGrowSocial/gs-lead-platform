# 🎯 TRUSTOO-STYLE FORM BUILDER - IMPLEMENTATION PLAN

## 📍 BESTAANDE BESTANDEN (CONFIRMED)

### 1. Public Form Template
**Locatie:** `views/forms/lead-form.ejs`
- Rendert het publieke formulier voor gebruikers
- Huidige structuur: multi-step met kleine inputs
- **MOET WORDEN:** Trustoo-style met grote radio cards, one question per page

### 2. Form Builder Preview Template
**Locatie:** `views/admin/industries/form-builder-content.ejs`
- Admin UI voor form builder
- Preview panel toont huidige form structuur
- **MOET WORDEN:** Preview met Trustoo-style cards

### 3. Form Builder JavaScript
**Locatie:** `public/js/admin/form-builder.js`
- Handelt form configuratie, preview rendering, en opslaan
- `createDefaultConfig()` - maakt default config
- `renderPreview()` - rendert preview
- `generateWithAI()` - roept AI aan
- **MOET WORDEN:** Nieuwe fixed 8-step structuur, Trustoo-style preview

### 4. AI Generation Backend
**Locatie:** `routes/api.js` - POST `/api/admin/form-builder/suggestions`
- Genereert AI form suggestions
- **MOET WORDEN:** Alleen variable velden genereren, Trustoo-style format

### 5. Form Storage
**Database:** `lead_form_templates` tabel
- Kolom: `config_json` (JSONB)
- **MOET BLIJVEN:** Zelfde structuur, maar met nieuwe fixed steps

---

## 🎨 TRUSTOO-STYLE FIXED STRUCTURE

### 8 Vaste Stappen (ALTIJD in deze volgorde):

1. **Step 1: Job Type (Main Category)**
   - ID: `step-job-type`
   - Type: Radio cards (groot)
   - Fixed: ✅ JA
   - AI mag: Opties aanpassen per industry

2. **Step 2: Subcategory / Job Details**
   - ID: `step-subcategory`
   - Type: Radio cards (groot)
   - Fixed: ✅ JA (structuur)
   - AI mag: Opties genereren/aanpassen

3. **Step 3: Scope (Size of Project)**
   - ID: `step-scope`
   - Type: Radio cards (groot)
   - Fixed: ✅ JA (structuur)
   - AI mag: Opties genereren/aanpassen

4. **Step 4: Urgency**
   - ID: `step-urgency`
   - Type: Radio cards (groot)
   - Fixed: ✅ JA
   - Opties: Standaard (Met spoed, Binnen dagen, Binnen maanden, etc.)

5. **Step 5: Description (Optional)**
   - ID: `step-description`
   - Type: Textarea met voorbeeldzinnen
   - Fixed: ✅ JA (structuur)
   - AI mag: Voorbeeldzinnen genereren per industry

6. **Step 6: Budget**
   - ID: `step-budget`
   - Type: Radio cards (groot)
   - Fixed: ✅ JA
   - Opties: Standaard budget ranges

7. **Step 7: Location**
   - ID: `step-location`
   - Type: Postcode, city, street inputs
   - Fixed: ✅ JA
   - AI mag: NIETS

8. **Step 8: Contact Details**
   - ID: `step-contact`
   - Type: Name, email, phone inputs
   - Fixed: ✅ JA (ALTIJD LAATSTE)
   - AI mag: NIETS

---

## 🔧 IMPLEMENTATIE STAPPEN

### PHASE 1: Update Default Config Structure

**Bestand:** `public/js/admin/form-builder.js`
- Functie: `createDefaultConfig()`
- **Wijziging:** Maak 8 vaste stappen in Trustoo-volgorde
- **Wijziging:** Markeer alle stappen als `isFixed: true`
- **Wijziging:** Gebruik `type: 'radio-cards'` voor steps 1-4, 6

### PHASE 2: Update Preview Rendering

**Bestand:** `public/js/admin/form-builder.js`
- Functie: `renderPreview()`
- **Wijziging:** Render grote radio cards in plaats van kleine inputs
- **Wijziging:** One question per page layout
- **Wijziging:** Progress bar (5px hoog)
- **Wijziging:** Sidebar met high-five illustration (desktop)

### PHASE 3: Update Public Form Template

**Bestand:** `views/forms/lead-form.ejs`
- **Wijziging:** Trustoo-style layout
- **Wijziging:** Grote radio cards component
- **Wijziging:** One question per page
- **Wijziging:** Smooth slide animations
- **Wijziging:** Sidebar met benefits (desktop)
- **Wijziging:** Contact step als single final screen

### PHASE 4: Update AI Generator

**Bestand:** `routes/api.js` - POST `/api/admin/form-builder/suggestions`
- **Wijziging:** AI prompt aanpassen
- **Wijziging:** AI mag ALLEEN variable velden genereren (steps 2, 3, 5, 6)
- **Wijziging:** AI moet Trustoo-style format gebruiken
- **Wijziging:** AI moet voorbeeldzinnen genereren voor description step

### PHASE 5: Update Form Builder UI

**Bestand:** `views/admin/industries/form-builder-content.ejs`
- **Wijziging:** Lock icon op fixed steps
- **Wijziging:** Disable delete/reorder voor fixed steps
- **Wijziging:** Alleen variable velden binnen fixed steps zijn editable

### PHASE 6: CSS & Styling

**Bestand:** `public/css/admin/form-builder.css` + nieuwe CSS voor public form
- **Wijziging:** Trustoo-style radio card componenten
- **Wijziging:** Slide animations
- **Wijziging:** Progress bar styling (5px)
- **Wijziging:** Sidebar styling

---

## 📋 DETAILED CHANGES PER FILE

### 1. `public/js/admin/form-builder.js`

**Functie: `createDefaultConfig()`**
```javascript
createDefaultConfig() {
  return {
    version: 1,
    industryId: DATA.industryId,
    title: `Aanvraagformulier ${DATA.industryName}`,
    slug: DATA.slug || null,
    steps: [
      {
        id: 'step-job-type',
        title: 'Wat voor klus?',
        order: 1,
        isFixed: true,
        fields: [{
          id: 'job_type',
          type: 'radio-cards',
          label: 'Wat voor klus?',
          required: true,
          options: [] // AI vult in
        }]
      },
      {
        id: 'step-subcategory',
        title: 'Meer details',
        order: 2,
        isFixed: true,
        fields: [{
          id: 'subcategory',
          type: 'radio-cards',
          label: 'Meer details',
          required: true,
          options: [] // AI vult in
        }]
      },
      // ... etc voor alle 8 stappen
    ],
    settings: {
      style: 'trustoo',
      oneQuestionPerPage: true,
      showProgressBar: true,
      progressBarHeight: 5
    }
  };
}
```

**Functie: `renderPreview()`**
- Render grote radio cards
- One question per page
- Trustoo-style layout

### 2. `views/forms/lead-form.ejs`

**Nieuwe structuur:**
- Trustoo-style container
- Sidebar met benefits (desktop)
- One question per page
- Grote radio cards
- Smooth animations
- Progress bar (5px)

### 3. `routes/api.js` - AI Generator

**Nieuwe prompt:**
- "Je genereert ALLEEN variable velden voor steps 2, 3, 5, 6"
- "Gebruik Trustoo-style format: grote radio cards"
- "Genereer voorbeeldzinnen voor description step"
- "NOOIT location of contact steps aanpassen"

---

## ✅ CHECKLIST VOOR IMPLEMENTATIE

- [ ] Update `createDefaultConfig()` met 8 vaste stappen
- [ ] Update `renderPreview()` met Trustoo-style cards
- [ ] Update `views/forms/lead-form.ejs` met Trustoo layout
- [ ] Update AI generator prompt
- [ ] Maak radio card component
- [ ] Maak sidebar component met benefits
- [ ] Voeg slide animations toe
- [ ] Update progress bar styling
- [ ] Test in admin builder
- [ ] Test in public form
- [ ] Test AI generation

---

## 🚀 READY TO START?

Bevestig dat je wilt dat ik begin met de implementatie volgens dit plan.

