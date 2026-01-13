# Aanbevolen Notificatie-instellingen voor GrowSocial Lead Platform

## Huidige Notificaties (al geïmplementeerd)
✅ **Nieuwe leads** - Instelbaar door gebruiker
✅ **Betalingen** - Verplicht, altijd aan
✅ **Account updates** - Verplicht, altijd aan  
✅ **Marketingberichten** - Instelbaar door gebruiker

## Aanbevolen extra notificaties

### 1. **Quota/Waarschuwingen** (Hoogste prioriteit)
- `quota_warning_notification` - Waarschuwing wanneer je 80% van je quota hebt gebruikt
- `quota_reached_notification` - Notificatie wanneer je quota is bereikt
- `quota_reset_notification` - Notificatie wanneer je maandelijkse quota wordt gereset

**Waarom:** Gebruikers moeten weten wanneer ze hun quota naderen of hebben bereikt.

### 2. **Lead Status Updates** (Hoog prioriteit)
- `lead_assigned_notification` - Notificatie wanneer een lead aan jou wordt toegewezen
- `lead_status_changed_notification` - Notificatie wanneer status van een lead verandert (bijv. van "pending" naar "accepted")
- `lead_updated_notification` - Notificatie wanneer details van een lead worden bijgewerkt

**Waarom:** Gebruikers willen weten wanneer leads worden toegewezen of wanneer er wijzigingen zijn.

### 3. **Betalingen & Facturen** (Verplicht, maar kan uitgebreid worden)
- `payment_overdue_notification` - Herinnering voor achterstallige betalingen
- `payment_reminder_notification` - Herinnering voor naderende betaaldatums
- `invoice_created_notification` - Notificatie wanneer nieuwe factuur wordt aangemaakt (al gedekt door payment_notification)

**Waarom:** Belangrijk voor cashflow management.

### 4. **Subscription Management** (Hoog prioriteit)
- `subscription_expiring_notification` - Waarschuwing wanneer subscription binnenkort afloopt
- `subscription_expired_notification` - Notificatie wanneer subscription is verlopen
- `subscription_paused_notification` - Notificatie wanneer subscription wordt gepauzeerd
- `subscription_resumed_notification` - Notificatie wanneer subscription wordt hervat

**Waarom:** Gebruikers moeten weten wanneer hun service wordt beïnvloed.

### 5. **Systeem & Beveiliging** (Verplicht voor account updates)
- `login_from_new_device_notification` - Notificatie bij inloggen vanaf nieuw apparaat
- `password_changed_notification` - Notificatie wanneer wachtwoord wordt gewijzigd
- `two_factor_enabled_notification` - Notificatie wanneer 2FA wordt ingeschakeld/uitgeschakeld

**Waarom:** Belangrijk voor accountbeveiliging.

### 6. **Ondersteuning & Communicatie** (Optioneel)
- `support_ticket_notification` - Notificatie bij nieuwe support tickets of updates
- `admin_message_notification` - Notificatie bij berichten van beheerders
- `system_maintenance_notification` - Notificatie bij geplande onderhoud

**Waarom:** Voor communicatie tussen platform en gebruiker.

## Implementatie Prioriteit

### Fase 1 (Direct toe te voegen):
1. `quota_warning_notification` - 80% quota bereikt
2. `quota_reached_notification` - Quota volledig gebruikt
3. `lead_assigned_notification` - Lead toegewezen

### Fase 2 (Later toe te voegen):
4. `lead_status_changed_notification` - Status wijziging
5. `subscription_expiring_notification` - Subscription loopt af
6. `subscription_expired_notification` - Subscription verlopen

### Fase 3 (Optioneel):
7. `login_from_new_device_notification` - Nieuw apparaat
8. `support_ticket_notification` - Support tickets

## Database Schema Suggestie

```sql
-- Voeg deze kolommen toe aan settings tabel:
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS quota_warning_notification INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS quota_reached_notification INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS lead_assigned_notification INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS lead_status_changed_notification INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS subscription_expiring_notification INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS subscription_expired_notification INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS login_from_new_device_notification INTEGER DEFAULT 1;
```

## Notificatie Categorieën

**Altijd aan (verplicht):**
- Betalingen
- Account updates
- Subscription verlopen/gepauzeerd
- Beveiliging (nieuwe devices, wachtwoord wijzigingen)

**Standaard aan (aanbevolen maar instelbaar):**
- Quota waarschuwingen
- Lead toegewezen
- Subscription verloopt binnenkort

**Optioneel (standaard uit):**
- Lead status wijzigingen
- Marketingberichten
- Support tickets

