# Locatie Voorkeuren - Volgende Stappen

## ✅ Wat is al gedaan

1. ✅ **Migration aangemaakt**: `supabase/migrations/20250115000002_user_location_preferences.sql`
2. ✅ **API endpoints aangepast**: Backwards compatible met fallback
3. ✅ **Frontend container toegevoegd**: Locatie voorkeuren grid in `views/dashboard/leads.ejs`

---

## 🚀 Stap-voor-stap Actieplan

### STAP 1: Migration Uitvoeren ⚠️ BELANGRIJK

**Optie A: Via Supabase Dashboard (Aanbevolen)**
1. Ga naar je Supabase project dashboard
2. Open de SQL Editor
3. Kopieer de inhoud van `supabase/migrations/20250115000002_user_location_preferences.sql`
4. Plak in de SQL Editor en voer uit
5. Controleer of de tabel is aangemaakt:
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'user_location_preferences';
   ```

**Optie B: Via Supabase CLI**
```bash
cd /path/to/gs-lead-platform
supabase db push
```

**Verificatie:**
- Check of de tabel bestaat
- Check of bestaande data is gemigreerd:
  ```sql
  SELECT COUNT(*) FROM user_location_preferences;
  SELECT * FROM user_location_preferences LIMIT 5;
  ```

---

### STAP 2: Testen - Locatie Voorkeuren

**Test 1: Frontend testen**
1. Ga naar `/dashboard/leads` (of waar de leads pagina staat)
2. Scroll naar "Locatie voorkeuren" container
3. Check of alle 12 provincies worden getoond
4. Test: klik op een provincie om in/uit te schakelen
5. Check of bevestigingsmodal verschijnt
6. Check of voorkeur wordt opgeslagen

**Test 2: API testen**
```bash
# Get location preferences
curl http://localhost:3000/api/users/current/location-preferences \
  -H "Authorization: Bearer YOUR_TOKEN"

# Update location preferences
curl -X POST http://localhost:3000/api/users/current/location-preferences \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "preferences": [
      {"location_code": "noord-holland", "location_name": "Noord-Holland", "is_enabled": true},
      {"location_code": "zuid-holland", "location_name": "Zuid-Holland", "is_enabled": true}
    ]
  }'
```

**Test 3: Database verificatie**
```sql
-- Check of data in user_location_preferences staat
SELECT * FROM user_location_preferences 
WHERE user_id = 'YOUR_USER_ID';

-- Check of profiles.lead_locations is gesync't
SELECT id, lead_locations FROM profiles 
WHERE id = 'YOUR_USER_ID';
```

---

### STAP 3: Verificatie - Automatische Sync

**Test of trigger werkt:**
1. Update een locatie preference via API
2. Check of `profiles.lead_locations` automatisch wordt geüpdatet:
   ```sql
   SELECT lead_locations FROM profiles WHERE id = 'YOUR_USER_ID';
   ```

**Verwachte resultaat:**
- `user_location_preferences` bevat alle preferences
- `profiles.lead_locations` bevat alleen enabled locations (automatisch gesync't)

---

### STAP 4: Integratie met Lead Flow Intelligence

**Verificatie:**
- Check of partners met locatie voorkeuren nu meetellen voor capaciteit:
  ```sql
  SELECT * FROM get_segment_capacity('SEGMENT_ID');
  ```

**Verwachte resultaat:**
- Partners met matching locaties tellen mee voor segment capaciteit
- Segment assignment werkt met locatie voorkeuren

---

## 🔧 Troubleshooting

### Probleem: Tabel bestaat niet na migration
**Oplossing:**
- Check Supabase logs voor errors
- Verifieer dat migration correct is uitgevoerd
- Check of je de juiste database gebruikt

### Probleem: Bestaande data niet gemigreerd
**Oplossing:**
- Run handmatig de migratie query:
  ```sql
  -- Check of er data in profiles.lead_locations staat
  SELECT id, lead_locations FROM profiles 
  WHERE lead_locations IS NOT NULL 
    AND array_length(lead_locations, 1) > 0;
  
  -- Als er data is, run de migratie handmatig
  ```

### Probleem: Frontend toont geen locaties
**Oplossing:**
- Check browser console voor errors
- Verifieer dat API endpoint werkt
- Check of user is ingelogd

### Probleem: Sync werkt niet
**Oplossing:**
- Check of trigger bestaat:
  ```sql
  SELECT * FROM pg_trigger WHERE tgname = 'sync_lead_locations_trigger';
  ```
- Check trigger function:
  ```sql
  SELECT * FROM pg_proc WHERE proname = 'sync_lead_locations_from_preferences';
  ```

---

## ✅ Checklist

- [ ] Migration uitgevoerd in Supabase
- [ ] Tabel `user_location_preferences` bestaat
- [ ] Bestaande data is gemigreerd
- [ ] Frontend toont locatie voorkeuren
- [ ] Locaties kunnen worden in/uitgeschakeld
- [ ] Data wordt opgeslagen in `user_location_preferences`
- [ ] `profiles.lead_locations` wordt automatisch gesync't
- [ ] API endpoints werken correct
- [ ] Integratie met Lead Flow Intelligence werkt

---

## 🎯 Klaar!

Na het uitvoeren van de migration en testen, is het systeem volledig operationeel:
- ✅ Consistente structuur (net zoals industry preferences)
- ✅ Automatische sync met profiles.lead_locations
- ✅ Backwards compatible
- ✅ Klaar voor Lead Flow Intelligence integratie

**Start met STAP 1 (migration uitvoeren) - dat is het belangrijkst!**

