-- Migration: Add CHECK constraint for lead_activities.type
-- This ensures data quality by restricting activity types to valid values
-- Date: 2025-11-18

-- Step 1: Clean up any invalid activity types (from testing or old data)
-- Delete test activities with invalid types
DELETE FROM lead_activities 
WHERE type NOT IN (
  'phone_call',
  'email_sent',
  'whatsapp',
  'meeting',
  'status_change_contacted',
  'note',
  'created',
  'message',
  'status_changed',
  'appointment_attended',
  'no_show_customer',
  'status_change_won',
  'status_change_lost'
);

-- Step 2: Drop existing constraint if it exists (for idempotency)
ALTER TABLE lead_activities 
DROP CONSTRAINT IF EXISTS lead_activities_type_check;

-- Step 3: Add CHECK constraint with all valid activity types
ALTER TABLE lead_activities 
ADD CONSTRAINT lead_activities_type_check 
CHECK (type IN (
  'phone_call',
  'email_sent',
  'whatsapp',
  'meeting',
  'status_change_contacted',
  'note',
  'created',
  'message',
  'status_changed',
  'appointment_attended',
  'no_show_customer',
  'status_change_won',
  'status_change_lost'
));

-- Note: The first_contact_at trigger already exists and will automatically
-- set leads.first_contact_at when a contact activity is created.
-- No need to create it here.

