# SOP 08.2 – Opportunity uit e-mail en AI-antwoord

**Doel:** Uit een e-mail een opportunity aanmaken en met AI een professioneel antwoord genereren en versturen.

**Doelgroep:** Admins en sales.

---

## Opportunity aanmaken uit e-mail

1. Open de e-mail in **Admin → Mail** (`/admin/mail`).
2. Als de e-mail als lead/kans is herkend: klik **Create Opportunity** (of vergelijkbare actie).
3. Systeem maakt een opportunity aan met data uit de e-mail (afzender, onderwerp, inhoud).
4. Vul indien nodig aan: waarde, verwachte sluitingsdatum, toewijzing.
5. Sla op → opportunity verschijnt in **Admin → Opportunities**.

---

## Opportunity toewijzen

1. Ga naar **Admin → Opportunities**.
2. AI kan een **beste sales rep** per opportunity voorstellen.
3. Wijzig indien nodig de **assignee** en sla op.
4. Volg de status (open, in_progress, negotiation, won).

---

## AI-antwoord genereren en versturen

1. Open de e-mail in de inbox.
2. Klik op **AI Antwoord** (of vergelijkbare knop).
3. Systeem genereert een professionele reactie op basis van de e-mail.
4. **Bewerk** de tekst indien nodig.
5. Klik **Versturen** → mail gaat via Mailgun (of geconfigureerde provider) naar de afzender.

---

## Handmatige reply

- Kies **Handmatige reply** en schrijf zelf de reactie; verstuur via dezelfde mailprovider.

---

## Vereisten

- **OpenAI API key** in `.env` voor AI-labeling en -antwoorden.
- **Mailgun** (of andere provider) geconfigureerd voor verzending.
- Bij API-fout valt labeling terug op keyword-based; controleer dan `OPENAI_API_KEY` en credits.

---

**Gerelateerd:** [SOP 08.1 – E-mailinbox en AI-labeling](08-1-email-inbox-ai-labeling.md), `docs/03-flows/admin_flows.md` (Email Management, Opportunity Management)
