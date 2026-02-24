# Rabobank mTLS – productie

Handleiding voor de **exacte volgorde**: CSR laten tekenen → fullchain plakken → mTLS testen → daarna pas bank-sync live zetten.

Alle keys en certificaten gaan naar **`.secrets/rabobank/`**. Deze map staat in `.gitignore` en mag **nooit** gecommit worden.

---

## Waarschuwing: keys nooit committen

- **Private keys** (`client.key`, of keys in een .p12) mogen **nooit** in de repo of in versiebeheer.
- Gebruik alleen de scripts; ze schrijven uitsluitend naar `.secrets/`.
- Controleer met `git status` dat `.secrets/` niet wordt toegevoegd.

---

## De volgorde (7 stappen)

### Stap 1 — CSR aanmaken

```bash
./scripts/rabobank/create-prod-csr.sh
```

Dit geeft je:

- `.secrets/rabobank/client.csr` ✅ **deze ga je delen**
- `.secrets/rabobank/client.key` ❌ **deze blijft geheim**

---

### Stap 2 — CSR laten ondertekenen (de echte “productie”-stap)

Je stuurt **alleen `client.csr`** naar de partij die het cert uitgeeft. **Nooit de key delen.**

Twee veel voorkomende routes:

#### Route A (meest voorkomend bij PSD2/open banking): eIDAS / QTSP

Een **QTSP** (Qualified Trust Service Provider) geeft een **QWAC** uit op basis van je CSR (en je TPP-registratie). Je krijgt terug:

- `client.crt` (jouw certificaat)
- `intermediate.crt` (vaak 1 of meer)
- evt. `root.crt`

#### Route B (als Rabobank je eigen client-cert accepteert voor hun business API)

Je geeft je CSR aan Rabobank (portal/onboarding); zij leveren de chain terug.

➡️ Concreet: **je stuurt alleen `client.csr`**, nooit de key.

---

### Stap 3 — Fullchain bouwen

Als je `client.crt` + intermediates hebt:

```bash
./scripts/rabobank/build-fullchain.sh path/to/client.crt path/to/intermediate.crt path/to/root.crt
```

Output:

- `.secrets/rabobank/fullchain.pem`

**Als je een .p12 hebt gekregen** (geen losse .crt-bestanden):

```bash
./scripts/rabobank/extract-from-p12.sh /pad/naar/cert.p12
# of met wachtwoord:
./scripts/rabobank/extract-from-p12.sh /pad/naar/cert.p12 "wachtwoord"
```

Dan staat `fullchain.pem` al in `.secrets/rabobank/`.

---

### Stap 4 — Rabobank-portal invullen

In het Rabobank Developer Portal:

| Veld | Invullen |
|------|----------|
| **Copy-paste your PEM certificate chain** | Volledige inhoud van `.secrets/rabobank/fullchain.pem` |
| **Name of your certificate** | Bijv. `GrowSocial-Rabo-Prod-mTLS-2026-02` |

Geen private key plakken; alleen certificaten.

---

### Stap 5 — Key + cert klaarzetten in de backend (mTLS)

De app moet bij requests naar Rabobank **client.key** en **fullchain.pem** (of client.crt) gebruiken.

**Belangrijk voor deploy:**

- Zet `client.key` en `fullchain.pem` als **secrets** in je hosting (Vercel/Supabase env, secret store), **niet** als bestanden in git.
- In runtime: schrijf ze eventueel naar tijdelijke bestanden, of gebruik ze direct in de HTTP-client (bijv. Node `https.Agent` met key + cert).

Env-variabelen voor mTLS (PEM-inhoud als string):

- `RABOBANK_MTLS_CLIENT_KEY` — inhoud van `client.key`
- `RABOBANK_MTLS_FULLCHAIN` — inhoud van `fullchain.pem`

Zie ook: endpoint **GET /admin/api/banking/rabobank/test-mtls** (stap 6).

---

### Stap 6 — mTLS testen vóór sync (ping/health)

Doel: bewijzen dat certificaten goed staan **vóór** je de hele sync aanzet.

- **GET /admin/api/banking/rabobank/test-mtls**  
  Doet één simpele call naar Rabobank met client-certificaat (bijv. discovery/health of basis-URL).

**Als dit faalt**, zijn veelvoorkomende oorzaken:

- Verkeerd certificaat gebruikt (leaf vs chain)
- Verkeerde volgorde in de chain
- Key hoort niet bij cert → gebruik de sanity check hieronder
- SNI/host mismatch
- Cert in Rabobank-portal nog niet “active/approved”
- Verkeerde omgeving (sandbox vs productie base URL)

Pas als deze test **groen** is: door naar stap 7.

---

### Stap 7 — Daarna pas: auto-sync aanzetten

Als mTLS-test groen is:

- Cron job / scheduler aan
- Bankrekeningen ophalen
- Transacties syncen
- Suggestions-pipeline erop

---

## Snelle sanity checks (2 commando’s)

**Controleren of key bij cert hoort:**

```bash
openssl x509 -noout -modulus -in path/to/client.crt | openssl md5
openssl rsa  -noout -modulus -in .secrets/rabobank/client.key | openssl md5
```

De hashes moeten **exact gelijk** zijn.

Of gebruik het script:

```bash
./scripts/rabobank/verify-key-cert-match.sh path/to/client.crt
```

**Controleren of fullchain alleen certs bevat (geen private key):**

```bash
grep "BEGIN" .secrets/rabobank/fullchain.pem
```

Er mag alleen `-----BEGIN CERTIFICATE-----` in staan, geen `-----BEGIN PRIVATE KEY-----` of `-----BEGIN RSA PRIVATE KEY-----`.

---

## Wat we moeten weten (zodat we je exact kunnen sturen)

Om de **volgende stap** concreet te kunnen geven:

1. **Welke Rabobank API gebruik je precies?**  
   (PSD2 AIS / business API / iets anders)

2. **Heb je al `client.crt` + intermediates gekregen, of zit je nog op “CSR insturen”?**  
   - Als je al een **.p12** hebt: gebruik het extract-script en plak `fullchain.pem` direct in het portal.

---

## Bestandenoverzicht

| Bestand | Doel |
|---------|------|
| `scripts/rabobank/create-prod-csr.sh` | Genereert `client.key` + `client.csr` in `.secrets/rabobank/`. |
| `scripts/rabobank/build-fullchain.sh` | Bouwt `fullchain.pem` uit client.crt + optioneel intermediate/root. |
| `scripts/rabobank/extract-from-p12.sh` | Exporteert uit .p12: client_cert.pem, ca_chain.pem, fullchain.pem. |
| `scripts/rabobank/verify-key-cert-match.sh` | Controleert of client.key en client.crt bij elkaar horen. |
| `.secrets/rabobank/` | Alle gegenereerde keys en certs (**niet committen**). |

---

## Referenties

- [Rabobank Developer Portal](https://developer.rabobank.nl/)
- [RABOBANK_QUICK_START.md](../RABOBANK_QUICK_START.md) – OAuth/API-configuratie
