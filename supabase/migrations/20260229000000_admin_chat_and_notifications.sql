-- =====================================================
-- ADMIN CHAT & NOTIFICATIONS (Communicatie + Bell)
-- =====================================================
-- Conversations (DM, group, system thread), messages,
-- notifications, mentions. RLS + triggers.
-- =====================================================

-- Enum types
DO $$ BEGIN
  CREATE TYPE conversation_type AS ENUM ('dm', 'group', 'system');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE message_type_enum AS ENUM ('user', 'system');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_type_enum AS ENUM ('message', 'mention', 'system');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE participant_role_enum AS ENUM ('member', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- 1. CONVERSATIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type conversation_type NOT NULL DEFAULT 'dm',
  title TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  dm_key TEXT
);

-- DM uniqueness: one DM per pair (sorted ids)
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_dm_key
  ON public.conversations (dm_key)
  WHERE type = 'dm' AND dm_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at
  ON public.conversations (last_message_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_conversations_type
  ON public.conversations (type);

-- =====================================================
-- 2. CONVERSATION_PARTICIPANTS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role participant_role_enum NOT NULL DEFAULT 'member',
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  muted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id
  ON public.conversation_participants (user_id);

CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation_last_read
  ON public.conversation_participants (conversation_id, last_read_at);

-- =====================================================
-- 3. MESSAGES
-- =====================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  message_type message_type_enum NOT NULL DEFAULT 'user',
  body TEXT NOT NULL DEFAULT '',
  body_rich JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON public.messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
  ON public.messages (conversation_id);

-- Full-text search on body (optional, for future)
CREATE INDEX IF NOT EXISTS idx_messages_body_fts
  ON public.messages USING gin(to_tsvector('dutch', body))
  WHERE deleted_at IS NULL;

-- =====================================================
-- 4. MESSAGE_MENTIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.message_mentions (
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (message_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_mentions_mentioned_user
  ON public.message_mentions (mentioned_user_id);

-- =====================================================
-- 5. NOTIFICATIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type notification_type_enum NOT NULL DEFAULT 'message',
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  url TEXT,
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_user_id
  ON public.admin_notifications (user_id);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_user_unread
  ON public.admin_notifications (user_id, is_read)
  WHERE is_read = FALSE;

CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at
  ON public.admin_notifications (user_id, created_at DESC);

-- =====================================================
-- 6. TRIGGER: update last_message_at on new message
-- =====================================================
CREATE OR REPLACE FUNCTION public.set_conversation_last_message_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_last_message_at ON public.messages;
CREATE TRIGGER trg_messages_last_message_at
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_conversation_last_message_at();

-- =====================================================
-- 7. TRIGGER: create notifications on user message
-- =====================================================
CREATE OR REPLACE FUNCTION public.notify_participants_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  is_mention BOOLEAN;
  mention_user_id UUID;
  notif_type notification_type_enum;
  conv_title TEXT;
  sender_name TEXT;
  notif_title TEXT;
  notif_body TEXT;
  notif_url TEXT;
BEGIN
  IF NEW.message_type <> 'user' OR NEW.sender_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.title INTO conv_title FROM public.conversations c WHERE c.id = NEW.conversation_id;
  SELECT COALESCE(p.first_name || ' ' || p.last_name, p.email, 'Iemand')
    INTO sender_name FROM public.profiles p WHERE p.id = NEW.sender_id;

  notif_url := '/admin/messages?open=' || NEW.conversation_id::TEXT || '&message=' || NEW.id::TEXT;

  FOR rec IN
    SELECT cp.user_id, cp.muted
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = NEW.conversation_id AND cp.user_id <> NEW.sender_id
  LOOP
    notif_type := 'message';
    notif_title := sender_name;
    notif_body := LEFT(NEW.body, 200);
    IF LENGTH(NEW.body) > 200 THEN notif_body := notif_body || '…'; END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.message_mentions mm
      WHERE mm.message_id = NEW.id AND mm.mentioned_user_id = rec.user_id
    ) INTO is_mention;
    IF is_mention THEN
      notif_type := 'mention';
      notif_title := sender_name || ' noemde je';
    END IF;

    INSERT INTO public.admin_notifications (user_id, type, title, body, url, metadata)
    VALUES (
      rec.user_id,
      notif_type,
      notif_title,
      notif_body,
      notif_url,
      jsonb_build_object(
        'conversation_id', NEW.conversation_id,
        'message_id', NEW.id,
        'sender_id', NEW.sender_id,
        'muted', rec.muted
      )
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_notify ON public.messages;
CREATE TRIGGER trg_messages_notify
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_participants_on_message();

-- Upgrade notification to 'mention' when message_mentions row is added
CREATE OR REPLACE FUNCTION public.upgrade_notification_to_mention()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.admin_notifications
  SET type = 'mention'
  WHERE metadata->>'message_id' = NEW.message_id::TEXT
    AND user_id = NEW.mentioned_user_id
    AND type = 'message';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_message_mentions_upgrade_notif ON public.message_mentions;
CREATE TRIGGER trg_message_mentions_upgrade_notif
  AFTER INSERT ON public.message_mentions
  FOR EACH ROW
  EXECUTE FUNCTION public.upgrade_notification_to_mention();

-- =====================================================
-- 8. TRIGGER: create notifications on system message
-- =====================================================
CREATE OR REPLACE FUNCTION public.notify_on_system_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  notif_url TEXT;
  target_ids UUID[];
BEGIN
  IF NEW.message_type <> 'system' THEN
    RETURN NEW;
  END IF;

  notif_url := COALESCE(
    (NEW.metadata->>'url')::TEXT,
    '/admin/messages?open=' || NEW.conversation_id::TEXT
  );

  IF NEW.metadata ? 'target_user_ids' AND jsonb_typeof(NEW.metadata->'target_user_ids') = 'array' THEN
    FOR rec IN SELECT jsonb_array_elements_text(NEW.metadata->'target_user_ids') AS uid
    LOOP
      INSERT INTO public.admin_notifications (user_id, type, title, body, url, metadata)
      VALUES (
        (rec.uid)::UUID,
        'system',
        COALESCE(NEW.metadata->>'title', 'Systeem'),
        NEW.body,
        notif_url,
        jsonb_build_object(
          'conversation_id', NEW.conversation_id,
          'message_id', NEW.id,
          'entity_type', NEW.metadata->>'entityType',
          'entity_id', NEW.metadata->>'entityId'
        )
      );
    END LOOP;
  ELSE
    FOR rec IN
      SELECT user_id FROM public.conversation_participants
      WHERE conversation_id = NEW.conversation_id
    LOOP
      INSERT INTO public.admin_notifications (user_id, type, title, body, url, metadata)
      VALUES (
        rec.user_id,
        'system',
        COALESCE((NEW.metadata->>'title')::TEXT, 'Systeem'),
        NEW.body,
        notif_url,
        jsonb_build_object(
          'conversation_id', NEW.conversation_id,
          'message_id', NEW.id,
          'entity_type', NEW.metadata->>'entityType',
          'entity_id', NEW.metadata->>'entityId'
        )
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_system_notify ON public.messages;
CREATE TRIGGER trg_messages_system_notify
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_system_message();

-- =====================================================
-- 9. RLS
-- =====================================================
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- Conversations: select only if participant
DROP POLICY IF EXISTS "conversations_select_participant" ON public.conversations;
CREATE POLICY "conversations_select_participant"
  ON public.conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = id AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "conversations_insert_authenticated" ON public.conversations;
CREATE POLICY "conversations_insert_authenticated"
  ON public.conversations FOR INSERT
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "conversations_update_creator" ON public.conversations;
CREATE POLICY "conversations_update_creator"
  ON public.conversations FOR UPDATE
  USING (created_by = auth.uid());

-- Service role can do everything (used by Express backend with supabaseAdmin)
DROP POLICY IF EXISTS "conversations_service_all" ON public.conversations;
CREATE POLICY "conversations_service_all"
  ON public.conversations FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Participants: select/insert/update own row or if admin in group
DROP POLICY IF EXISTS "participants_select_own" ON public.conversation_participants;
CREATE POLICY "participants_select_own"
  ON public.conversation_participants FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "participants_insert_own" ON public.conversation_participants;
CREATE POLICY "participants_insert_own"
  ON public.conversation_participants FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "participants_update_own" ON public.conversation_participants;
CREATE POLICY "participants_update_own"
  ON public.conversation_participants FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "participants_service_all" ON public.conversation_participants;
CREATE POLICY "participants_service_all"
  ON public.conversation_participants FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Messages: select if participant; insert if participant; update/delete sender or admin
DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;
CREATE POLICY "messages_select_participant"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "messages_insert_participant" ON public.messages;
CREATE POLICY "messages_insert_participant"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "messages_service_all" ON public.messages;
CREATE POLICY "messages_service_all"
  ON public.messages FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Message mentions: service and participant
DROP POLICY IF EXISTS "mentions_select_participant" ON public.message_mentions;
CREATE POLICY "mentions_select_participant"
  ON public.message_mentions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id
      WHERE m.id = message_mentions.message_id AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "mentions_service_all" ON public.message_mentions;
CREATE POLICY "mentions_service_all"
  ON public.message_mentions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Notifications: own only
DROP POLICY IF EXISTS "admin_notifications_select_own" ON public.admin_notifications;
CREATE POLICY "admin_notifications_select_own"
  ON public.admin_notifications FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_notifications_update_own" ON public.admin_notifications;
CREATE POLICY "admin_notifications_update_own"
  ON public.admin_notifications FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_notifications_service_all" ON public.admin_notifications;
CREATE POLICY "admin_notifications_service_all"
  ON public.admin_notifications FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Grant usage (RLS handles row access)
GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.conversation_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT SELECT, INSERT ON public.message_mentions TO authenticated;
GRANT SELECT, UPDATE ON public.admin_notifications TO authenticated;

-- =====================================================
-- 10. HELPER: extract mentions from body (@name or @id)
-- Call from app layer when sending message to fill message_mentions
-- =====================================================
COMMENT ON TABLE public.conversations IS 'Admin chat: DM, group, or system thread';
COMMENT ON TABLE public.admin_notifications IS 'Bell notifications and toasts for admin';

-- Realtime: In Supabase Dashboard > Database > Replication, add tables "messages" and "admin_notifications" to the publication if you use client-side Realtime.
