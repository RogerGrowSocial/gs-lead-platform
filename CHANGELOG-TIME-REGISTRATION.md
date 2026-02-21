# Changelog – Tijdregistratie UX & logica

## Aangepaste bestanden (kort)

- **services/timeEntryService.js** – `validateEntry()`, `ValidationError`; `clockIn` default project_name; `clockOut` merged data + validatie, 400 requires_completion; `updateActiveTimer` validatie + missing_fields.
- **routes/api.js** – clock-out 400 requires_completion + missing_fields; update active-timer 400 missing_fields; GET tasks q/limit params.
- **services/taskService.js** – getTasks: q (title ILIKE), limit (default 25, max 50), return customer_name/contact_name.
- **routes/admin.js** – customers/search: logo_url → avatar_url in response; customers/:id/contacts: photo_url → avatar_url in response.
- **public/js/admin/components/search-dropdown.js** – Nieuw: herbruikbare SearchDropdown (avatar/initials, debounce, keyboard).
- **public/css/admin/search-dropdown.css** – Nieuw: styling voor dropdown + avatar/initials.
- **views/layouts/admin.ejs** – search-dropdown.css + search-dropdown.js ingeladen.
- **public/js/admin/time-tracker.js** – “Wijzig details”-knop + PUT active-timer; clock-out met body + requires_completion-melding; server-side task search (debounce 250ms); avatar in klant/contact-dropdowns; BroadcastChannel + visibilitychange refresh.
- **public/js/admin/time-tracking.js** – BroadcastChannel listener + visibilitychange; broadcast na clockIn/clockOut/updateActiveTimer; clock-out project_name genormaliseerd + requires_completion + velden rood; updateActiveTimer project_name genormaliseerd.
- **supabase** – Geen nieuwe migration; bestaande unique index één actieve timer per employee blijft.

## Vervolgstap (na eerste push)

- **Pagina /admin/time-entries – custom dropdowns klant/contact**: Klant- en contactvelden zijn vervangen door custom search dropdowns (input + resultatenlijst) met avatar/initials, via SearchDropdown.create(). Data: customers via /admin/api/customers/search?q=; contacten via /admin/api/customers/:id/contacts, geladen bij selectie klant. handleTaskChange zet data-customer-name/data-contact-name op taakopties en vult zoekvelden; bij wijziging klant wordt contact geleegd en contactlijst herladen.
