# 📊 Uitgebreide Lijst van Alle System Logs

## 🔐 Authentication & User Management Logs

### Login/Logout Events
- **`login_successful`** - Gebruiker succesvol ingelogd
- **`login_failed`** - Login poging gefaald
- **`logout_successful`** - Gebruiker uitgelogd
- **`token_refreshed`** - Gebruiker token succesvol ververst
- **`authentication_failed`** - Authenticatie gefaald - geen geldige sessie

### Registration Events
- **`registration_started`** - Gebruiker begint registratie proces
- **`registration_completed`** - Nieuwe gebruiker succesvol geregistreerd
- **`user_registered`** - Gebruiker heeft account aangemaakt

### Password Management
- **`password_reset_requested`** - Wachtwoord reset aangevraagd
- **`password_reset_completed`** - Wachtwoord reset voltooid
- **`password_reset_failed`** - Password reset gefaald

### Admin Access
- **`admin_access_denied`** - Admin toegang geweigerd (verschillende redenen)
- **`accessed admin area`** - Admin toegang verleend (via user_metadata of database)

## 👥 User Management Logs

### User Operations
- **`Gebruikerslijst Opgehaald`** - Alle gebruikers opgehaald via API
- **`Nieuwe Gebruiker Aangemaakt`** - Nieuwe gebruiker aangemaakt via admin
- **`profile_updated`** - Gebruiker profiel bijgewerkt via auth sync
- **`user_creation_failed`** - Gebruiker profiel aanmaken gefaald
- **`user_created`** - Nieuwe gebruiker succesvol aangemaakt

### User Status Changes
- **`user_status_changed`** - Admin heeft gebruiker status gewijzigd
- **`system_settings_changed`** - Admin heeft systeem instellingen gewijzigd
- **`bulk_user_operation`** - Admin heeft bulk gebruikers operatie uitgevoerd

## 📋 Lead Management Logs

### Lead Operations
- **`Lead Aangemaakt`** - Nieuwe lead succesvol aangemaakt
- **`Lead Toegewezen`** - Lead succesvol toegewezen aan gebruiker
- **`Lead Verwijderd`** - Lead succesvol verwijderd uit systeem
- **`Bulk Lead Operatie`** - Bulk lead operatie uitgevoerd

### Lead Details
- Lead ID, bedrijfsnaam, branche, bron
- Toegewezen gebruiker en admin
- Verwijderingsreden en methode
- Aantal leads verwerkt in bulk operaties

## 💳 Payment Operations Logs

### Payment Processing
- **`Betaling Aangemaakt`** - Nieuwe betaling aangemaakt
- **`Betaling Succesvol`** - Betaling succesvol verwerkt
- **`Betaling Gefaald`** - Betaling gefaald tijdens verwerking
- **`Betalingsmethode Gewijzigd`** - Gebruiker heeft betalingsmethode gewijzigd

### Payment Details
- Payment ID, bedrag, valuta
- Mollie payment ID en status
- Gebruiker en bedrijfsinformatie
- Foutmeldingen en redenen voor falen

## 📊 Subscription Management Logs

### Subscription Changes
- **`Abonnement Gewijzigd`** - Gebruiker abonnement gewijzigd
- **`Quota Bijgewerkt`** - Gebruiker lead quota bijgewerkt
- **`Abonnement Gepauzeerd`** - Gebruiker abonnement gepauzeerd

### Subscription Details
- Oude en nieuwe abonnement details
- Lead limieten en gebruik
- Redenen voor wijzigingen
- Admin die wijzigingen heeft doorgevoerd

## 🔄 Billing System Logs

### Automatic Billing Process
- **`Automatische Incasso Gestart`** - Automatische incasso proces gestart
- **`Geen Actieve Gebruikers`** - Geen actieve gebruikers gevonden voor incasso
- **`Geen Openstaande Balansen`** - Geen gebruikers met openstaande balansen gevonden
- **`Automatische Incasso Voltooid`** - Automatische incasso proces succesvol voltooid
- **`Automatische Incasso Voltooid - Geen Betalingen`** - Voltooid zonder betalingen
- **`Automatische Incasso Gefaald`** - Automatische incasso proces gefaald

### Billing Details
- Start/eind tijd en duur
- Aantal gebruikers verwerkt
- Succesvolle en gefaalde betalingen
- Totaalbedrag en aantal leads geïncasseerd
- Specifieke foutmeldingen

### Billing Settings
- **`Betalingsinstellingen Gewijzigd`** - Admin heeft billing instellingen gewijzigd
- **`Automatische Incasso Uitgeschakeld`** - Automatische incasso is uitgeschakeld
- **`Cron Job Herstart`** - Billing cron job herstart na instellingen wijziging

### User Billing Issues
- **`Gebruiker Geen Betalingsmethode`** - Gebruiker heeft geen actieve betalingsmethode
- **`Gebruiker Geen Abonnement`** - Gebruiker heeft geen actief abonnement

## ⚙️ System Operations Logs

### Database Operations
- **`Database Operatie`** - Database operatie uitgevoerd
- **`Database Setup`** - System logs table created successfully

### Cron Jobs
- **`daily_cleanup`** - Dagelijkse cleanup cron job uitgevoerd
- **`automatic_billing`** - Automatische incasso cron job gestart
- **`test_billing_scheduler`** - Test billing scheduler uitgevoerd
- **`test_automatic_billing`** - Test automatic billing uitgevoerd

### System Errors
- **`Systeem Fout`** - Onverwachte systeem fout opgetreden
- **`Auth Sync Error`** - Fout tijdens auth sync voor nieuwe gebruiker

### Security Events
- **`Beveiligings Event`** - Verdachte activiteit gedetecteerd
- **`brute_force_attempt`** - Meerdere gefaalde login pogingen

## 🌐 API Usage Logs

### API Endpoints
- **`/api/profiles`** - Profielen opgehaald via API
- **`/api/leads`** - Leads API succesvol gebruikt
- **`/api/payments`** - Payments API gebruikt

### API Events
- **`API endpoint aangeroepen`** - API endpoint succesvol gebruikt
- **`API endpoint fout`** - API endpoint gefaald
- **`Rate limit overschreden`** - Gebruiker heeft rate limit overschreden

### API Details
- Response tijd en aantal records
- Foutcodes en berichten
- Gebruiker en IP adres
- Rate limiting details

## 🧪 Test & Development Logs

### Test Operations
- **`Test: Betalingsinstellingen Gewijzigd`** - Test billing settings change
- **`Test: Automatische Incasso Gestart`** - Test automatic billing
- **`Test: Gebruiker Geen Betalingsmethode`** - Test user without payment method
- **`Test: Betaling Gefaald`** - Test payment failure
- **`Test: Systeem Fout`** - Test system error
- **`Billing Systeem Tests Voltooid`** - All billing system tests completed

## 📈 Log Categories & Types

### Log Types
- **`info`** - Informatieve berichten
- **`success`** - Succesvolle operaties
- **`warning`** - Waarschuwingen
- **`error`** - Fouten en problemen
- **`critical`** - Kritieke systeem problemen

### Log Categories
- **`authentication`** - Login, logout, registratie
- **`user_management`** - Gebruiker beheer
- **`billing`** - Betalingen en incasso
- **`system`** - Systeem operaties
- **`payment`** - Betaling verwerking
- **`cron`** - Geplande taken
- **`api`** - API gebruik
- **`database`** - Database operaties
- **`security`** - Beveiligings events
- **`admin`** - Admin operaties

### Severity Levels
- **`low`** - Lage prioriteit
- **`medium`** - Normale prioriteit
- **`high`** - Hoge prioriteit
- **`critical`** - Kritieke prioriteit

## 🎯 Monitoring Capabilities

### Real-time Monitoring
- Live dashboard van alle systeem activiteit
- Filtering op categorie, type en severity
- Zoeken op specifieke gebeurtenissen
- Export functionaliteit voor rapportage

### Billing Monitoring
- **100% zekerheid** dat automatische incasso werkt
- Monitoring van alle betalingen en fouten
- Tracking van gebruikers zonder betalingsmethoden
- Logging wanneer er geen openstaande balansen zijn

### Security Monitoring
- Login pogingen en mislukte authenticatie
- Admin toegang en geweigerde toegang
- Verdachte activiteit en brute force pogingen
- IP adressen en user agents

### Performance Monitoring
- API response tijden
- Database operatie duur
- Cron job uitvoering tijden
- Systeem fouten en herstel

## 📊 Total Log Count
**50+ verschillende log types** verspreid over **10 categorieën** met **4 severity levels**

Dit geeft je **complete visibility** in alle aspecten van je applicatie! 🚀
