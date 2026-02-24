# Platform Instellingen & RBAC

Admin-only pagina voor platforminstellingen en rolgebaseerde toegang (RBAC): welke pagina’s een rol mag openen en wat er in de sidebar staat.

## How to test

1. **Migratie**
   - Run: `npx supabase db push` (of pas de migration handmatig toe).
   - Controleer of de tabellen bestaan: `platform_settings`, `app_pages`, `role_page_permissions`, `role_page_permission_audit`.

2. **Admin ziet Platform Instellingen**
   - Log in als admin.
   - Ga naar `/admin` en controleer of “Platform Instellingen” in de sidebar staat (onder Instellingen).
   - Open `/admin/platform-settings`. Tab “Toegang & Navigatie (RBAC)” moet laden met rollen (Admin, Manager, Werknemer, Partner) en per sectie de pagina’s met toggles “Toegang” en “In sidebar” en veld “Volgorde”.

3. **Manager/employee geen Platform Instellingen**
   - Log in als manager of werknemer.
   - Controleer dat “Platform Instellingen” niet in de sidebar staat.
   - Ga direct naar `/admin/platform-settings` → verwacht 403 of redirect naar `/admin`.

4. **RBAC enforced**
   - Als admin: ga naar Platform Instellingen → kies rol “Werknemer” → zet “Tickets” uit (Toegang uit).
   - Log uit en log in als werknemer (of gebruik een werknemer-account).
   - Controleer: “Tickets” staat niet in de sidebar.
   - Ga naar `/admin/tickets` → verwacht redirect naar `/admin` of 403.

5. **Opslaan en audit**
   - Als admin: wijzig een paar rechten voor een rol en klik “Opslaan”.
   - Controleer in de DB: `role_page_permissions` heeft de juiste rijen; `role_page_permission_audit` heeft nieuwe regels met `old_value`/`new_value`.

6. **Reset naar standaard**
   - Kies een rol, klik “Reset naar standaard”, bevestig.
   - Controleer dat de toggles/volgorde weer overeenkomen met de standaardwaarden uit de page registry.

7. **Sync app_pages**
   - Bij het eerste laden van de RBAC-tab (of eerste aanroep van de API) wordt `syncPagesRegistryToDb()` uitgevoerd: alle pagina’s uit `config/pageRegistry.js` worden ge-upsert in `app_pages`. Controleer in de DB of `app_pages` gevuld is.

## Bestanden

- **Config:** `config/pageRegistry.js` — definitie van alle admin-pagina’s en standaardrechten per rol.
- **DB:** `supabase/migrations/20260230100000_platform_settings_rbac.sql`.
- **Service:** `services/platformSettingsService.js` — sync, getRbacMatrix, saveRolePermissions, resetRoleToDefaults, getEffectivePermissionsForRole.
- **Middleware:** `middleware/rbac.js` — getRoleKeyFromUser, requirePageAccess, resolvePageKeyAndRequireAccess, buildAdminNav.
- **Routes:** `routes/admin.js` — GET `/platform-settings` (isAdmin), buildAdminNav + resolvePageKeyAndRequireAccess op de admin-router.
- **API:** `routes/api.js` — GET/POST `/api/admin/platform-settings/rbac`, POST `/api/admin/platform-settings/rbac/:roleKey/reset`.
- **Views:** `views/admin/platform-settings/` (index, body, _tabs, _rbac), `public/css/admin/platform-settings.css`, `public/js/admin/platform-settings.js`.
- **Layout:** `views/layouts/admin.ejs` — sidebar gebruikt `adminNav` wanneer gezet door buildAdminNav.

## Rolbepaling

- **admin:** `req.user.is_admin === true` of `user_metadata.is_admin === true`.
- **manager:** rolnaam (uit `profiles.role_id` → `roles.name`) bevat “manager”.
- **employee:** rolnaam bevat “employee”, “werknemer” of “admin” (niet is_admin, maar rol).
- **partner:** overige (klant); heeft geen toegang tot `/admin` door bestaande `isEmployeeOrAdmin`-middleware.
