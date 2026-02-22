# Admin Chat & Notificaties

Intern communicatiesysteem (Slack/WhatsApp-achtig) in de admin-omgeving: chat (DM + groep), bel-meldingen in de header, en realtime updates.

## Lokaal runnen

1. **Migrations uitvoeren** (Supabase Postgres):
   ```bash
   # Via Supabase CLI (lokaal)
   npx supabase db push

   # Of handmatig de SQL uitvoeren:
   # supabase/migrations/20260229000000_admin_chat_and_notifications.sql
   ```

2. **Server starten**
   ```bash
   npm run dev
   ```

3. **Chat openen**: ga naar **Communicatie → Chat** in het admin-menu, of direct naar `/admin/messages`.

## Onderdelen

- **Chat** (`/admin/messages`): conversatielijst (links), berichtthread (midden), deelnemers-panel (rechts, inklapbaar). Nieuwe chat via “Nieuwe chat” → zoek collega → start DM.
- **Header-bel**: rechtsboven in de admin-header. Klik opent popover met tabs Alles / Mentions / Systeem. Unread-badge wordt elke minuut ververst; bij toename verschijnt een toast.
- **System messages**: in de database ondersteund (`message_type = 'system'`). Voorbeeld aanmaken via service:
  ```js
  const chatService = require('../services/chatService');
  await chatService.sendSystemMessage(conversationId, 'Ticket toegewezen aan Jan', {
    entityType: 'ticket',
    entityId: '...',
    url: '/admin/tickets/...',
    title: 'Systeem'
  });
  ```

## API (alle onder `requireAuth` / `isEmployeeOrAdmin`)

| Method | Pad | Beschrijving |
|--------|-----|--------------|
| GET | `/admin/api/messages/conversations` | Lijst conversaties (query: `unread`, `search`) |
| GET | `/admin/api/messages/conversations/:id` | Eén conversatie + deelnemers |
| GET | `/admin/api/messages/conversations/:id/messages` | Berichten (cursor-pagination, `cursor`, `limit`) |
| POST | `/admin/api/messages/conversations/:id/messages` | Bericht versturen (`body`, optioneel `mention_user_ids`) |
| POST | `/admin/api/messages/conversations/:id/read` | Markeer als gelezen |
| POST | `/admin/api/messages/dm` | DM starten (`other_user_id`) |
| POST | `/admin/api/messages/group` | Groep aanmaken (manager/admin; `title`, `participant_ids`) |
| POST | `/admin/api/messages/conversations/:id/participants` | Deelnemers toevoegen (manager/admin; `user_ids`) |
| GET | `/admin/api/messages/users?search=` | Gebruikers zoeken (voor “Nieuwe chat”) |
| GET | `/admin/api/notifications` | Meldingen (query: `type`, `limit`) |
| GET | `/admin/api/notifications/unread-count` | Unread-count voor badge |
| POST | `/admin/api/notifications/:id/read` | Eén melding gelezen |
| POST | `/admin/api/notifications/read-all` | Alles gelezen |

## Database

- **conversations**: type `dm` | `group` | `system`, `dm_key` voor unieke DM per koppel.
- **conversation_participants**: `last_read_at`, `muted`, `role` (member/admin).
- **messages**: `message_type` user | system, `body`, `metadata` (voor system: entityType, entityId, url).
- **message_mentions**: koppelt bericht aan genoemde users; trigger zet notificatie op type `mention`.
- **admin_notifications**: type message | mention | system, `url` voor navigatie, `is_read`.

RLS is ingeschakeld; de Express-app gebruikt `supabaseAdmin` (service role) en rechten worden in de routes gecontroleerd.

## Realtime

- Berichten en meldingen worden nu via **polling** ververst (messages elke 5s in open conversatie, unread-count elke 60s).
- Voor echte realtime: in Supabase Dashboard → Database → Replication de tabellen `messages` en `admin_notifications` toevoegen aan de publication, en de front-end met een Supabase-client (met gebruikers-JWT) op deze tabellen abonneren.
