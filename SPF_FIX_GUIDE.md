# SPF Error Fix Guide

## Probleem
Error: `554 5.7.1 : End-of-data rejected: SPF Incorrect`

Dit betekent dat de ontvangende e-mailserver je e-mail heeft afgewezen omdat de SPF (Sender Policy Framework) check faalt.

## Oorzaken

### 1. Code Issue (Gefixed)
- ✅ Het "from" adres moet EXACT overeenkomen met de SMTP authenticated username
- ✅ De envelope sender (Return-Path) moet ook overeenkomen
- ✅ Beide worden nu automatisch gelijkgesteld aan de SMTP authenticatie user

### 2. SPF Record Issue (DNS)
De SPF-record van je domein staat mogelijk je server niet toe om e-mails te verzenden.

## Oplossing: SPF Record Controleren & Updaten

### Stap 1: Check Huidige SPF Record
Gebruik een van deze tools om je huidige SPF record te checken:
- https://mxtoolbox.com/spf.aspx
- https://www.dmarcanalyzer.com/spf-checker/

Voer je domein in (bijv. `growsocialmedia.nl`) en check je SPF record.

### Stap 2: SPF Record Format
Een SPF record ziet er meestal zo uit:
```
v=spf1 include:_spf.google.com ~all
```

of voor eigen SMTP server:
```
v=spf1 ip4:YOUR_SERVER_IP ~all
```

### Stap 3: Wat moet er in je SPF record staan?

**Als je Gmail/Google Workspace gebruikt:**
```
v=spf1 include:_spf.google.com ~all
```
Dit staat je toe om via Gmail servers te verzenden.

**Als je eigen SMTP server gebruikt:**
Je moet het IP-adres van je server toevoegen:
```
v=spf1 ip4:YOUR_SERVER_IP ~all
```

**Voor meerdere opties:**
```
v=spf1 include:_spf.google.com ip4:YOUR_SERVER_IP ~all
```

### Stap 4: SPF Record Updaten
1. Log in bij je DNS provider (TransIP, Mijndomein, Namecheap, etc.)
2. Ga naar DNS records voor je domein
3. Zoek de TXT record die begint met `v=spf1`
4. Update deze met je server IP of include statement
5. Wacht 5-60 minuten tot DNS is gepropageerd

### Stap 5: Verificatie
Test je SPF record met:
- https://mxtoolbox.com/spf.aspx
- Check of het IP-adres van je server is toegestaan

## Debugging in Code

In de logs zie je nu:
```
📧 SPF Compliance Check:
   SMTP Auth User: rogier@growsocialmedia.nl
   Mailbox Email: rogier@growsocialmedia.nl
   From Address: rogier@growsocialmedia.nl
   Envelope From: rogier@growsocialmedia.nl
```

Als deze allemaal hetzelfde zijn, dan ligt het probleem waarschijnlijk aan de SPF record.

## Veelvoorkomende Fouten

1. **SPF record ontbreekt**: Domein heeft geen SPF record
2. **Verkeerd IP**: Server IP staat niet in SPF record
3. **Include ontbreekt**: Als je Gmail gebruikt maar `include:_spf.google.com` ontbreekt
4. **Syntax fout**: Verkeerde SPF syntax in DNS record

## Alternatieve Oplossing (Als SPF niet werkt)

Als je niet de SPF record kunt aanpassen, kun je:
1. Een andere SMTP server gebruiken (bijv. SendGrid, Mailgun, AWS SES)
2. Deze services hebben eigen SPF records die je kunt includen
3. Of gebruik dezelfde SMTP server waar je e-mails voor ontvangt

## Test na Fix

Stuur een test e-mail naar jezelf en check:
1. Of de e-mail wordt ontvangen
2. Of er geen SPF errors meer zijn in de logs
3. Check de e-mail headers in je mail client om te zien of SPF passed

