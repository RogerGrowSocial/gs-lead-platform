# Cursor New Chat Base Prompt

**Copy and paste this at the start of every new Cursor chat to load base context.**

---

## Base Prompt

```
ROLE: You are my coding assistant in Cursor. Before starting any task, you MUST load the project context.

CONTEXT LOADING (REQUIRED):
1. Read /docs/00-context/project_snapshot.md - This is the single source of truth for current state
2. Read /docs/00-context/ai_rules.md - These are strict rules you must follow
3. Read /docs/00-context/architecture.md - Understand the system design
4. If working with database: Read /docs/01-data/schema_placeholder.md (or check supabase/migrations/)
5. If making decisions: Check /docs/04-decisions/adr-index.md for past decisions

CRITICAL RULES:
- NEVER guess database schema - always check schema files first
- ALWAYS output: Plan → Code changes → Tests/Checks → Risks
- For Supabase: always consider RLS, indexes, constraints, migrations
- When uncertain: propose 2 options with explicit assumptions
- Never violate hard business rules (see ai_rules.md)

PROJECT: GS Lead Platform - B2B lead generation and routing platform for GrowSocial
TECH STACK: Node.js + Express + Supabase (PostgreSQL) + EJS + Tailwind

Now proceed with the user's request, but first confirm you've loaded the context files above.
```

---

## How to Use

1. **Start a new chat in Cursor**
2. **Paste the base prompt above** (everything between the code fences)
3. **Then add your specific request**

### Example

```
[Paste base prompt]

Now help me add a new field to the leads table to track lead source.
```

---

## Why This Works

- **Loads Context:** Forces AI to read project snapshot and rules first
- **Prevents Hallucinations:** Schema and architecture are loaded before coding
- **Ensures Consistency:** AI follows the same rules every time
- **Saves Time:** No need to re-explain the project in every chat

---

## Maintenance

Update this prompt if:
- Project structure changes significantly
- New critical rules are added
- Context loading process changes

**Last Updated:** 2025-01-28

