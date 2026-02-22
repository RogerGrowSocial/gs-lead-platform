# SOP 01.2 – Gebruikersbeheer (admin)

**Doel:** Gebruikers bekijken, aanmaken, bewerken en rollen wijzigen in het admin-panel.

**Doelgroep:** Admins.

---

## Gebruikersoverzicht

1. Ga naar **Admin → Gebruikers** (`/admin/users`).
2. Je ziet een lijst van alle gebruikers.
3. **Filters:** rol, status, zoekterm.
4. Klik op een gebruiker voor het detailscherm.

---

## Gebruikersdetail (`/admin/users/:id`)

Op het detailscherm staan:

- **Profiel:** naam, e-mail, bedrijf, telefoon, adres.
- **Leadhistoriek** en **prestatiestatistieken**.
- **Billing:** betaalmethoden, saldo, quota, facturen.
- **Risico-assessment** (indien ingeschakeld).

**Mogelijke acties:**

- Gegevens wijzigen.
- **Rol wijzigen** (bijv. USER ↔ ADMIN).
- Gebruiker **activeren/deactiveren**.
- Betalings- en capaciteitsinformatie controleren.

---

## Nieuwe gebruiker aanmaken

1. Ga naar de aanmaak-flow (bijv. “Nieuwe gebruiker” in het menu).
2. Vul in: e-mail, wachtwoord, bedrijfsnaam, rol.
3. Systeem maakt auth user + profiel aan.
4. Indien geconfigureerd: welkomstmail wordt verstuurd.

---

## Veelvoorkomende taken

| Taak | Waar | Actie |
|------|------|--------|
| Partner deactiveren | Gebruikersdetail | Status op “Inactief” zetten |
| Adminrechten geven | Gebruikersdetail | Rol wijzigen naar ADMIN |
| Billing controleren | Gebruikersdetail → Billing | Saldo, betaalmethode, quota bekijken |
| Gebruiker zoeken | Gebruikersoverzicht | Zoekveld of filters gebruiken |

---

**Gerelateerd:** [SOP 01.1 – Partner onboarding](01-1-partner-onboarding.md), `docs/03-flows/admin_flows.md` (User Management Flow)
