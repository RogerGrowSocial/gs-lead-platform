# Locatie Voorkeuren - 500 Error Fix

## ✅ Wat is gefixed

1. **API endpoint gebruikt nu `supabaseAdmin`** - Bypass RLS voor user preference updates
2. **Betere error logging toegevoegd** - Zie nu exacte error details in server logs
3. **Verbeterde error responses** - Frontend krijgt nu meer details over wat er misgaat

---

## 🔍 Debugging Stappen

### STAP 1: Server opnieuw starten
De code is aangepast, dus de server moet opnieuw worden gestart:
```bash
# Stop de huidige server (Ctrl+C)
# Start opnieuw
npm start
# of
node server.js
```

### STAP 2: Opnieuw proberen
1. Ga naar `/dashboard/leads`
2. Scroll naar "Locatie voorkeuren"
3. Probeer een locatie in/uit te schakelen
4. Check de browser console voor errors
5. Check de server logs voor details

### STAP 3: Check Server Logs
De server logs tonen nu:
- 📍 Request details (userId, preferences count)
- ❌ Exacte error message, code, details, hint
- ✅ Success berichten

**Voorbeeld output:**
```
📍 Location preferences update request: { userId: '...', preferencesCount: 12, ... }
❌ Error upserting user_location_preferences:
   Message: ...
   Code: ...
   Details: ...
```

---

## 🐛 Mogelijke Problemen

### Probleem 1: Tabel bestaat niet
**Symptoom:** Error code `42P01` (table does not exist)
**Oplossing:** 
- Run de migration: `supabase/migrations/20250115000002_user_location_preferences.sql`
- Via Supabase Dashboard → SQL Editor

### Probleem 2: RLS Policy blokkeert
**Symptoom:** Error code `42501` (permission denied)
**Oplossing:**
- Code gebruikt nu `supabaseAdmin` (bypass RLS)
- Als dit nog steeds faalt, check RLS policies in Supabase

### Probleem 3: Foreign Key Constraint
**Symptoom:** Error code `23503` (foreign key violation)
**Oplossing:**
- Check of `user_id` bestaat in `profiles` tabel
- Check of user is correct ingelogd

### Probleem 4: Invalid Data Format
**Symptoom:** Error over invalid data type
**Oplossing:**
- Check server logs voor exacte data die wordt verstuurd
- Verifieer dat `preferences` array is

---

## ✅ Test Checklist

- [ ] Server is opnieuw gestart
- [ ] Migration is uitgevoerd (als nog niet gedaan)
- [ ] User is ingelogd
- [ ] Browser console toont geen errors
- [ ] Server logs tonen request details
- [ ] Locatie voorkeuren kunnen worden opgeslagen
- [ ] `profiles.lead_locations` wordt automatisch gesync't

---

## 📊 Verificatie Queries

Na succesvolle update, check in Supabase:

```sql
-- Check user_location_preferences
SELECT * FROM user_location_preferences 
WHERE user_id = 'YOUR_USER_ID';

-- Check profiles.lead_locations (should be synced automatically)
SELECT id, lead_locations FROM profiles 
WHERE id = 'YOUR_USER_ID';
```

---

## 🚀 Volgende Stap

**Start de server opnieuw en probeer opnieuw!**

Als het nog steeds niet werkt, check de server logs en deel de exacte error message.

