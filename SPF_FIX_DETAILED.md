# SPF Fix - Gedetailleerde Instructies

## Huidige Situatie
- **Error**: `554 5.7.1 : End-of-data rejected: SPF Incorrect`
- **Huidige SPF Record**: `v=spf1 include:spf.mijndomeinhosting.nl include:_spf.wpcloud.com -all`
- **SMTP Server**: `mail.mijndomein.nl:465`
- **Van adres**: `info@growsocialmedia.nl`

## Het Probleem
Je SPF record heeft `-all` wat betekent: "BLOCK alles wat niet expliciet is toegestaan". 

Hoewel je `include:spf.mijndomeinhosting.nl` hebt staan, controleren sommige e-mailservers (zoals Epic Games) het **bounce-back IP adres** waar de verbinding vandaan komt. Als je vanaf je eigen server/localhost verzendt maar verbindt met Mijndomein's SMTP, dan kan het zijn dat het IP van jouw server niet is toegestaan.

## Oplossing 1: SPF Record Aanpassen (Aanbevolen)

### Stap 1: Bepaal je Server IP
Als je in productie draait, bepaal het publieke IP adres van je server:
```bash
# Op je server:
curl ifconfig.me
```

### Stap 2: Update SPF Record in Mijndomein

Ga naar je Mijndomein DNS instellingen:

1. Log in bij Mijndomein
2. Ga naar je domein: `growsocialmedia.nl`
3. Ga naar "DNS Beheer" of "DNS Records"
4. Zoek de TXT record met `v=spf1`
5. Update deze naar:

**Optie A: Als je een vast server IP hebt:**
```
v=spf1 include:spf.mijndomeinhosting.nl include:_spf.wpcloud.com ip4:JOUW_SERVER_IP -all
```

**Optie B: Als je niet zeker bent van je IP (soft fail):**
```
v=spf1 include:spf.mijndomeinhosting.nl include:_spf.wpcloud.com ~all
```
(Let op: `~all` in plaats van `-all` - dit geeft een soft fail in plaats van hard block)

**Optie C: Laat Mijndomein alles verzenden (aanbevolen voor nu):**
```
v=spf1 include:spf.mijndomeinhosting.nl include:_spf.wpcloud.com ?all
```
(`?all` = neutraal, alles wordt toegestaan maar niet expliciet goedgekeurd)

### Stap 3: Wacht op DNS Propagatie
DNS wijzigingen kunnen 5-60 minuten duren voordat ze wereldwijd zijn doorgevoerd.

### Stap 4: Test
Test je SPF record op:
- https://mxtoolbox.com/spf.aspx
- Voer `growsocialmedia.nl` in en check of je server IP is toegestaan

## Oplossing 2: Direct via Mijndomein's SMTP Relay (Als Oplossing 1 niet werkt)

Als bovenstaande niet werkt, kan het zijn dat je direct via Mijndomein's SMTP moet verzenden zonder authenticatie, of dat je een ander e-mailaccount moet gebruiken.

### Contacteer Mijndomein Support
Vraag Mijndomein support:
- "Welk IP adres moet in mijn SPF record staan om via mail.mijndomein.nl te kunnen verzenden?"
- "Moet ik een specifieke SMTP configuratie gebruiken voor SPF compliance?"

## Oplossing 3: Alternatieve SMTP Service

Als Mijndomein problemen blijft geven, overweeg:

1. **SendGrid** (gratis tier: 100 emails/dag)
   - SPF: `include:sendgrid.net`
   
2. **Mailgun** (gratis tier: 5,000 emails/maand)
   - SPF: `include:mailgun.org`

3. **AWS SES** (zeer goedkoop)
   - SPF via AWS

## Debugging: Check Huidige SPF

```bash
# Check huidige SPF record
dig +short TXT growsocialmedia.nl | grep spf

# Check of je server IP is toegestaan
# (gebruik online tool: https://mxtoolbox.com/spf.aspx)
```

## Belangrijkste Punt

Het probleem is waarschijnlijk dat:
1. Je verzendt via `mail.mijndomein.nl` (OK)
2. MAAR je verbindt vanaf je eigen server IP
3. Die server IP staat NIET in je SPF record
4. De ontvangende server (Epic Games) checkt dit en weigert

**Fix**: Voeg je server IP toe aan de SPF record OF gebruik `~all` in plaats van `-all`.

