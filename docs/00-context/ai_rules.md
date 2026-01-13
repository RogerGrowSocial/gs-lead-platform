# AI Rules for Cursor

**Last Updated:** 2025-01-28

These rules must be followed by AI assistants (like Cursor) when working on this codebase. They prevent hallucinations and ensure consistency.

---

## 🚫 Never Guess Schema

### Rule 1: Always Refer to Schema Files
- **NEVER** invent database tables, columns, or relationships
- **ALWAYS** check `/docs/01-data/schema.sql` or `supabase/migrations/` first
- **IF** schema is missing, create a placeholder and add a TODO section
- **WHEN** uncertain, ask a targeted question or state explicit assumptions

### Rule 2: Schema Discovery Process
1. Check `/docs/01-data/schema.sql` (if exists)
2. Check `supabase/migrations/` (chronological order)
3. Check `prisma/schema.prisma` (may be legacy)
4. If still unclear, state: "Schema unknown - need to export from Supabase"

### Rule 3: Schema Changes
- **NEVER** suggest schema changes without checking existing migrations
- **ALWAYS** propose migration files (not direct ALTER TABLE)
- **ALWAYS** consider RLS policies, indexes, constraints, triggers

---

## 📋 Always Output: Plan → Code → Tests → Risks

### Rule 4: Structured Output Format
When making changes, **ALWAYS** provide:

1. **Plan**
   - What will change
   - Why (business reason or bug fix)
   - Which files affected
   - Dependencies

2. **Code Changes**
   - Show diffs or file contents
   - Explain each change
   - Link to related files

3. **Tests/Checks**
   - How to test the change
   - What to verify
   - Edge cases to consider

4. **Risks**
   - What could break
   - Migration considerations
   - Performance impact
   - Rollback plan

---

## 🗄️ Supabase-Specific Rules

### Rule 5: Always Consider RLS
- **NEVER** write queries that ignore RLS
- **ALWAYS** check if RLS policies exist for the table
- **WHEN** creating new tables, propose RLS policies
- **USE** service role key only for admin operations (document why)

### Rule 6: Always Consider Indexes
- **CHECK** if indexes exist on foreign keys
- **CHECK** if indexes exist on frequently queried columns
- **PROPOSE** indexes for new queries that scan large tables

### Rule 7: Always Consider Constraints
- **CHECK** for unique constraints, foreign keys, check constraints
- **PROPOSE** constraints for data integrity
- **DOCUMENT** why constraints are needed

### Rule 8: Always Consider Migrations
- **NEVER** suggest direct SQL in code (use migrations)
- **ALWAYS** create migration files with timestamp: `YYYYMMDDHHMMSS_description.sql`
- **ALWAYS** test migrations on local/staging first
- **INCLUDE** rollback SQL if possible

### Rule 9: Always Consider Edge Functions
- **CHECK** if logic should be in Edge Function vs. Node.js service
- **CURRENTLY:** Most logic is in Node.js services, not Edge Functions
- **ONLY** suggest Edge Functions if there's a clear benefit (e.g., direct DB access without service role)

---

## ❓ When Uncertain: Propose 2 Options

### Rule 10: Explicit Assumptions
When uncertain about:
- Schema structure
- Business rules
- Architecture decisions
- Integration behavior

**ALWAYS:**
1. State what you're uncertain about
2. Propose 2 options with explicit assumptions
3. Ask which option to proceed with
4. Document the decision in `/docs/04-decisions/` if significant

### Example:
```
I'm uncertain about the lead assignment flow. I see two options:

Option A: Assume auto-assignment happens immediately on lead creation
- Assumption: routing_mode = 'ai_segment_routing' triggers auto-assignment
- Files: routes/api.js, services/leadAssignmentService.js

Option B: Assume auto-assignment is triggered separately
- Assumption: Lead created first, then admin/API triggers assignment
- Files: routes/api.js (separate endpoint)

Which option should I proceed with?
```

---

## 🔍 Code Discovery Rules

### Rule 11: Search Before Assuming
- **ALWAYS** use `codebase_search` to find existing patterns
- **ALWAYS** use `grep` to find exact matches
- **NEVER** assume a function exists without checking
- **NEVER** assume a file structure without exploring

### Rule 12: Read Related Files
- **ALWAYS** read related files before making changes
- **ALWAYS** check for similar implementations
- **ALWAYS** follow existing patterns (don't invent new ones)

---

## 📝 Documentation Rules

### Rule 13: Update Documentation
- **ALWAYS** update `/docs/00-context/project_snapshot.md` after major changes
- **ALWAYS** create ADR in `/docs/04-decisions/` for significant decisions
- **ALWAYS** update relevant docs when schema/API changes

### Rule 14: Never Duplicate Documentation
- **CHECK** if documentation already exists
- **INTEGRATE** instead of duplicating
- **LINK** to existing docs instead of copying

---

## 🎯 Business Rules (Never Violate)

### Rule 15: Hard Business Rules
These rules are **NEVER** violated:
1. **Payment Method Required:** Partners without active payment method = 0 capacity
2. **No Segment Deletion:** Segments are deactivated, never deleted
3. **Available Capacity for Targets:** Targets = (total - open) * 0.8
4. **Platform-First LPs:** Landing pages are platform-owned
5. **One Partner Per Lead:** AI router assigns exactly one partner

**IF** a change would violate these, **STOP** and ask for clarification.

---

## 🔄 Migration Rules

### Rule 16: Migration Safety
- **ALWAYS** check if migration is backward compatible
- **ALWAYS** consider data migration for schema changes
- **ALWAYS** test on local/staging first
- **NEVER** suggest destructive migrations without explicit approval

### Rule 17: Migration Naming
- Format: `YYYYMMDDHHMMSS_description.sql`
- Example: `20250128120000_add_lead_priority.sql`
- **ALWAYS** include description of what it does

---

## 🧪 Testing Rules

### Rule 18: Always Consider Testing
- **PROPOSE** how to test the change
- **CHECK** if test files exist for the module
- **SUGGEST** manual testing steps if automated tests don't exist
- **CONSIDER** edge cases and error scenarios

---

## 📚 Reference Files

### Always Check These First
1. `/docs/00-context/project_snapshot.md` - Current state
2. `/docs/00-context/architecture.md` - System design
3. `/docs/01-data/schema.sql` - Database schema
4. `/docs/04-decisions/adr-index.md` - Past decisions
5. `supabase/migrations/` - Database migrations

---

## Related Documentation

- **Project Snapshot:** `/docs/00-context/project_snapshot.md`
- **Architecture:** `/docs/00-context/architecture.md`
- **Schema:** `/docs/01-data/schema.sql`

