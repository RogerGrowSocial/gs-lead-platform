# Opportunity assignment follow-up automation

## Summary

- **Assignment hook**: When an opportunity is assigned (manual or AI), we send an email to the assignee and create one follow-up task. Idempotent per (opportunity, assignee, day).
- **Sales status**: `sales_status` (new, contacted, appointment_set, customer, lost, unreachable) with history and required reason when lost.
- **Reminders**: +1 day and +3 days to assignee; +7 days escalation to manager/admin. Stored in `opportunity_followup_reminders` (once per type).
- **UI**: Sales status panel on opportunity detail, stale banner (>48h still new), list badges and "Stale kansen" filter.

---

## Files changed/added

### New files
- `supabase/migrations/20260229000000_opportunity_sales_status_and_followup.sql` – sales_status fields, history, assignment_actions, followup_reminders, employee_tasks.opportunity_id, assigned_at
- `services/opportunityAssignmentFollowUpService.js` – recordAssignmentAndNotify, createFollowUpTaskIfNeeded, sendAssignmentEmail, assignmentHash
- `services/opportunityFollowUpReminderService.js` – runReminders, day1/day3/day7 escalation, getManagerAndAdminUserIds
- `cron/opportunityFollowUpReminders.js` – cron every 15 min
- `templates/emails/opportunity_assigned.html` – HTML email for assignee
- `services/opportunityAssignmentFollowUpService.test.js` – unit test for assignmentHash
- `docs/OPPORTUNITY-ASSIGNMENT-FOLLOWUP.md` – this file

### Modified files
- `services/taskService.js` – add `opportunity_id` to createTask insertData
- `services/notificationService.js` – opportunity_assigned_notification default, sendOpportunityAssigned, case opportunity_assigned in sendNotification
- `services/opportunityAssignmentService.js` – call recordAssignmentAndNotify after AI assign; set assigned_at on update
- `routes/admin.js` – POST assign: set assigned_at, call recordAssignmentAndNotify; PATCH opportunities: set assigned_at when assigned_to set, call recordAssignmentAndNotify; GET opportunities: stale filter, pass filterStale/filterQuery; require opportunityAssignmentFollowUpService
- `routes/api.js` – canUpdateOpportunityStatus helper, PUT /admin/opportunities/:id/sales-status, POST /admin/opportunities/:id/contact-attempt; isEmployeeOrAdmin
- `views/admin/partials/opportunity-detail-body.ejs` – Sales status panel, stale banner, salesStatusConfigs, isStale
- `views/admin/opportunity-detail.ejs` – (no change; body partial handles it)
- `public/js/admin/opportunity-detail.js` – setupSalesStatusPanel (save status, +1 poging, show reason when lost)
- `public/css/opportunity-detail.css` – opportunity-stale-banner, sales-status-form, sales-status-meta, btn-primary-sm
- `views/admin/opportunities.ejs` – sales_status badge, stale icon, getSalesStatusClass/Label, Stale kansen filter link
- `public/css/opportunities.css` – opportunities-filter-link, opportunity-stale-icon
- `server.js` – load cron/opportunityFollowUpReminders

---

## Local test steps

### 1. Run migration
```bash
# Apply migration (Supabase CLI or dashboard)
npx supabase db push
# or run the SQL in supabase/migrations/20260229000000_opportunity_sales_status_and_followup.sql
```

### 2. Assign opportunity to user
- Log in as admin.
- Go to **Kansen** → open an opportunity (or create one).
- Assign to a sales rep via "Toewijzen" (assign button) or in "Details bewerken" set "Toegewezen aan" and save.
- **Verify**: Email received (subject like "Nieuwe kans aan jou toegewezen: …") and one task created for that user with title "Volg kans op: …" and due in ~1 hour. In DB: `opportunity_assignment_actions` has one row with `email_sent_at` and `task_id` set; `employee_tasks` has row with `opportunity_id` and that assignee.

### 3. Idempotency (no duplicate email/task)
- Re-assign the **same** opportunity to the **same** user again (same day).
- **Verify**: No second email, no second open follow-up task. Same `opportunity_assignment_actions` row used (or duplicate hash not inserted).

### 4. Reassign to different user
- Assign the same opportunity to a **different** user.
- **Verify**: New assignee gets email and one new follow-up task. Previous assignee’s open follow-up task for this opportunity is closed (status done).

### 5. Sales status and “lost” reason
- Open an opportunity → **Sales status** panel.
- Set status to **Verloren** and leave reason empty → click **Opslaan**.
- **Verify**: Validation error (reason required).
- Set reason (e.g. "Geen budget") → **Opslaan**.
- **Verify**: Status and reason saved; `opportunity_sales_status_history` has new row; `sales_status_updated_at` updated.
- **API**: `PUT /api/admin/opportunities/:id/sales-status` with `{ "sales_status": "lost" }` (no reason) → **400**. With `sales_outcome_reason` → **200**.

### 6. Contact attempt
- In Sales status panel click **+1 poging**.
- **Verify**: `contact_attempts` incremented, `last_contact_at` set; or call `POST /api/admin/opportunities/:id/contact-attempt` and check response.

### 7. Stale banner and list
- Create or pick an opportunity that is **assigned**, **sales_status = new**, and **assigned_at** > 48 hours ago (or temporarily set `assigned_at` in DB to 3 days ago).
- Open that opportunity.
- **Verify**: Yellow banner "Deze kans is nog niet bijgewerkt. Update de status." with "Naar status" link.
- Go to **Kansen** list.
- **Verify**: That opportunity shows sales status badge (e.g. "Nieuw") and a warning icon (stale). Click **Stale kansen** filter → only stale opportunities shown.

### 8. Reminder job and escalation
- Ensure an opportunity is assigned, `sales_status = 'new'`, and `assigned_at` is 1+, 3+, and 7+ days ago (or set in DB for testing).
- Run the reminder job once (e.g. call `opportunityFollowUpReminderService.runReminders()` from a small script or trigger the cron).
- **Verify**: Rows in `opportunity_followup_reminders` for that opportunity: `day1`, `day3`, `day7_escalation` (each once). Assignee gets reminder emails; for day7, users with manager or admin role get escalation email.

### 9. Escalation recipients
- **Verify**: Escalation emails are sent to all users with `is_admin = true` or role name containing "manager" (from `profiles` + `roles`).

### 10. Unit test
```bash
node services/opportunityAssignmentFollowUpService.test.js
```
- **Verify**: assignmentHash deterministic and 64-char hex; different (opp, user) give different hashes.

---

## API reference

- **PUT /api/admin/opportunities/:id/sales-status**  
  Body: `{ "sales_status", "sales_outcome_reason?", "contact_attempt_increment?" }`  
  If `sales_status === 'lost'`, `sales_outcome_reason` is required. Updates `sales_status_updated_at` and inserts history.

- **POST /api/admin/opportunities/:id/contact-attempt**  
  No body. Increments `contact_attempts` and sets `last_contact_at`.  
  Permission: assignee or manager/admin.

Permission for both: assignee of the opportunity or user with manager/admin role.
