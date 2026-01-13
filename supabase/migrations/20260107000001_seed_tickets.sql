-- =====================================================
-- TICKETS MODULE - SEED DATA
-- =====================================================
-- Creates sample tickets with comments, attachments,
-- and different statuses/priorities for testing
-- =====================================================

-- Get a sample admin user for assignments
DO $$
DECLARE
  admin_user_id UUID;
  customer_id UUID;
  ticket1_id UUID;
  ticket2_id UUID;
  ticket3_id UUID;
  ticket4_id UUID;
  ticket5_id UUID;
BEGIN
  -- Get first admin user
  SELECT id INTO admin_user_id
  FROM public.profiles
  WHERE is_admin = true
  LIMIT 1;
  
  -- Get first customer if exists
  SELECT id INTO customer_id
  FROM public.customers
  LIMIT 1;
  
  -- Only seed if we have an admin user
  IF admin_user_id IS NOT NULL THEN
    
    -- Ticket 1: Open, High Priority
    INSERT INTO public.tickets (
      subject,
      description,
      status,
      priority,
      category,
      tags,
      source,
      requester_email,
      requester_name,
      customer_id,
      assignee_id,
      created_by,
      due_at,
      created_at,
      updated_at,
      last_activity_at
    ) VALUES (
      'Probleem met betaling niet verwerkt',
      'De betaling voor lead #12345 is niet correct verwerkt. De klant heeft betaald maar de status blijft op "pending" staan.',
      'open',
      'high',
      'billing',
      ARRAY['betaling', 'urgent'],
      'email',
      'klant@example.com',
      'Jan Jansen',
      customer_id,
      admin_user_id,
      admin_user_id,
      NOW() + INTERVAL '2 days',
      NOW() - INTERVAL '3 days',
      NOW() - INTERVAL '1 day',
      NOW() - INTERVAL '1 hour'
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO ticket1_id;
    
    -- Add comment to ticket 1
    IF ticket1_id IS NOT NULL THEN
      INSERT INTO public.ticket_comments (
        ticket_id,
        body,
        is_internal,
        author_user_id,
        created_at
      ) VALUES (
        ticket1_id,
        'Ik heb de betaling gecontroleerd en het lijkt erop dat de webhook niet is aangekomen. Ik ga dit handmatig verwerken.',
        false,
        admin_user_id,
        NOW() - INTERVAL '2 hours'
      )
      ON CONFLICT DO NOTHING;
      
      INSERT INTO public.ticket_comments (
        ticket_id,
        body,
        is_internal,
        author_user_id,
        created_at
      ) VALUES (
        ticket1_id,
        'Interne notitie: Klant heeft al 3x gebeld hierover. Prioriteit verhogen naar urgent als dit niet snel opgelost wordt.',
        true,
        admin_user_id,
        NOW() - INTERVAL '1 hour'
      )
      ON CONFLICT DO NOTHING;
      
      -- Add audit log entry
      INSERT INTO public.ticket_audit_log (
        ticket_id,
        actor_user_id,
        action,
        field_name,
        old_value,
        new_value
      ) VALUES (
        ticket1_id,
        admin_user_id,
        'status_changed',
        'status',
        'new',
        'open'
      )
      ON CONFLICT DO NOTHING;
    END IF;
    
    -- Ticket 2: Waiting on Customer, Normal Priority
    INSERT INTO public.tickets (
      subject,
      description,
      status,
      priority,
      category,
      tags,
      source,
      requester_email,
      requester_name,
      assignee_id,
      created_by,
      created_at,
      updated_at,
      last_activity_at
    ) VALUES (
      'Vraag over lead kwaliteit',
      'De klant vraagt waarom de lead die ze hebben ontvangen niet overeenkomt met hun voorkeuren. Ze hebben specifiek gevraagd om schilders in Amsterdam, maar kregen een loodgieter uit Utrecht.',
      'waiting_on_customer',
      'normal',
      'support',
      ARRAY['lead-kwaliteit', 'voorkeuren'],
      'phone',
      'klant2@example.com',
      'Maria de Vries',
      admin_user_id,
      admin_user_id,
      NOW() - INTERVAL '5 days',
      NOW() - INTERVAL '2 days',
      NOW() - INTERVAL '1 day'
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO ticket2_id;
    
    -- Ticket 3: Resolved, Low Priority
    INSERT INTO public.tickets (
      subject,
      description,
      status,
      priority,
      category,
      tags,
      source,
      requester_email,
      requester_name,
      assignee_id,
      created_by,
      resolved_at,
      created_at,
      updated_at,
      last_activity_at
    ) VALUES (
      'Account instellingen niet zichtbaar',
      'De klant kan de account instellingen niet vinden in het dashboard. Na onderzoek bleek dit een caching probleem te zijn.',
      'resolved',
      'low',
      'technical',
      ARRAY['dashboard', 'instellingen'],
      'internal',
      'klant3@example.com',
      'Piet Bakker',
      admin_user_id,
      admin_user_id,
      NOW() - INTERVAL '1 day',
      NOW() - INTERVAL '7 days',
      NOW() - INTERVAL '1 day',
      NOW() - INTERVAL '1 day'
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO ticket3_id;
    
    -- Ticket 4: New, Urgent Priority, Unassigned
    INSERT INTO public.tickets (
      subject,
      description,
      status,
      priority,
      category,
      tags,
      source,
      requester_email,
      requester_name,
      created_by,
      due_at,
      created_at,
      updated_at,
      last_activity_at
    ) VALUES (
      'Systeem crash bij lead allocatie',
      'Het systeem crasht wanneer we proberen een lead toe te wijzen aan een partner. Dit gebeurt consistent bij alle allocatie pogingen.',
      'new',
      'urgent',
      'technical',
      ARRAY['crash', 'allocatie', 'systeem'],
      'system',
      'systeem@growsocial.nl',
      'Systeem',
      admin_user_id,
      NOW() + INTERVAL '4 hours',
      NOW() - INTERVAL '30 minutes',
      NOW() - INTERVAL '30 minutes',
      NOW() - INTERVAL '30 minutes'
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO ticket4_id;
    
    -- Ticket 5: Closed
    INSERT INTO public.tickets (
      subject,
      description,
      status,
      priority,
      category,
      tags,
      source,
      requester_email,
      requester_name,
      assignee_id,
      created_by,
      resolved_at,
      closed_at,
      created_at,
      updated_at,
      last_activity_at
    ) VALUES (
      'Vraag over facturering',
      'Klant vroeg hoe de facturering werkt voor maandelijkse abonnementen. Uitgelegd en ticket gesloten.',
      'closed',
      'normal',
      'billing',
      ARRAY['facturering', 'abonnement'],
      'email',
      'klant4@example.com',
      'Lisa Smit',
      admin_user_id,
      admin_user_id,
      NOW() - INTERVAL '10 days',
      NOW() - INTERVAL '9 days',
      NOW() - INTERVAL '10 days',
      NOW() - INTERVAL '9 days',
      NOW() - INTERVAL '9 days'
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO ticket5_id;
    
    RAISE NOTICE 'Seed data created successfully';
  ELSE
    RAISE NOTICE 'No admin user found, skipping seed data';
  END IF;
END $$;

