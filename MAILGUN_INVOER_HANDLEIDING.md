# Mailgun - Wat Vul Ik Waar In?

## Stap 1: Mailgun Dashboard - SMTP Credentials Ophalen

1. Ga naar **Mailgun Dashboard** → **Sending** → **Domain Settings**
2. Klik op je domain: `growsocialmedia.nl`
3. Scroll naar beneden naar **"SMTP credentials"** sectie
4. Klik op **"Add password"** of **"Create password"**
5. Geef het een naam: `GrowSocial Platform`
6. **Kopieer het wachtwoord direct** - je ziet het maar één keer!

## Stap 2: In GrowSocial Platform - Mailbox Toevoegen

### 1. Klik op "📧 Mailgun (Aanbevolen)" knop
   - Dit vult automatisch de juiste instellingen in

### 2. E-mailadres *
   ```
   info@growsocialmedia.nl
   ```
   (Of welk email adres je ook wilt gebruiken)

### 3. IMAP Instellingen (Inkomend)
   
   **IMAP Host:**
   ```
   imap.mijndomein.nl
   ```
   (Of je huidige IMAP server - dit is alleen voor het OPNEMEN van emails)
   
   **IMAP Port:**
   ```
   993
   ```

### 4. SMTP Instellingen (Uitgaand) - Deze worden automatisch ingevuld na klik op Mailgun knop:

   **SMTP Host:**
   ```
   smtp.eu.mailgun.org
   ```
   (Automatisch ingevuld)
   
   **SMTP Port:**
   ```
   587
   ```
   (Automatisch ingevuld)
   
   **SSL/TLS checkbox:**
   - **UIT** (niet aangevinkt) - voor poort 587 (STARTTLS)
   - (Automatisch correct gezet)
   
   **Gebruikersnaam:**
   ```
   brad@growsocialmedia.nl
   ```
   (Of welk email je wilt gebruiken - **moet volledige email zijn!**)
   
   **Wachtwoord:**
   ```
   [Je Mailgun SMTP wachtwoord uit stap 1]
   ```
   (Het wachtwoord dat je net hebt gekopieerd uit Mailgun dashboard)

## Stap 3: Klik op "Mailbox toevoegen"

Dat is het! 🎉

---

## Samenvatting - Wat Waar:

| Veld | Wat In te Vullen | Waar Te Vinden |
|------|------------------|----------------|
| **E-mailadres** | `info@growsocialmedia.nl` | Je eigen keuze |
| **IMAP Host** | `imap.mijndomein.nl` | Je huidige IMAP server |
| **IMAP Port** | `993` | Standaard IMAP port |
| **SMTP Host** | `smtp.eu.mailgun.org` | Automatisch ingevuld |
| **SMTP Port** | `587` | Automatisch ingevuld |
| **SSL/TLS** | **UIT** (niet aangevinkt) | Automatisch gezet |
| **Gebruikersnaam** | `brad@growsocialmedia.nl` | Volledige email (je eigen keuze) |
| **Wachtwoord** | `[Mailgun SMTP password]` | Mailgun Dashboard → Domain Settings → SMTP credentials → Add password |

---

## Belangrijke Opmerkingen:

✅ **Username:** Moet een volledige email zijn (`email@domein.nl`) - Mailgun accepteert geen korte usernames

✅ **Password:** Dit is een apart wachtwoord dat je aanmaakt in Mailgun dashboard - NIET je Mijndomein wachtwoord, NIET je Mailgun account wachtwoord

✅ **IMAP vs SMTP:** 
- IMAP = Voor het OPNEMEN van emails (kun je bij Mijndomein houden)
- SMTP = Voor het VERZENDEN van emails (dit moet Mailgun zijn om SPF te fixen)

✅ **Poort 587:** Gebruikt STARTTLS (niet SSL), daarom is de SSL checkbox UIT

---

## Troubleshooting

**"Authentication failed":**
- Check of je het Mailgun SMTP wachtwoord gebruikt (niet Mijndomein)
- Check of je volledige email gebruikt als username

**"Connection timeout":**
- Check of poort 587 open is
- Probeer poort 465 met SSL checkbox AAN

**"SPF error":**
- Zorg dat je DNS records correct zijn toegevoegd in Mijndomein
- Wacht 30-60 minuten na DNS aanpassing

