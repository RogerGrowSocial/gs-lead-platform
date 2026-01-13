# Architecture Decision Records (ADR) Index

**Last Updated:** 2025-01-28

---

## Overview

This index tracks all Architecture Decision Records (ADRs) for the GS Lead Platform.

**Purpose:** Document significant decisions so future developers understand why choices were made.

---

## ADR List

### [No ADRs yet - add them here as they are created]

**Format:**
- `ADR-XXXX: [Title]` - [Status] - [Date] - [Brief description]

---

## How to Add an ADR

1. **Create new ADR file:**
   ```bash
   cp docs/04-decisions/adr-0001-template.md docs/04-decisions/adr-XXXX-description.md
   ```
   Replace `XXXX` with next number (0002, 0003, etc.)

2. **Fill in the template:**
   - Title: Clear, descriptive
   - Status: Proposed, Accepted, Deprecated, Superseded
   - Context: Why this decision is needed
   - Decision: What was decided
   - Consequences: Pros, cons, trade-offs
   - Alternatives: What else was considered

3. **Update this index:**
   - Add entry to ADR List above
   - Link to the ADR file

---

## ADR Statuses

- **Proposed:** Decision is being discussed, not yet finalized
- **Accepted:** Decision is final and implemented (or will be)
- **Deprecated:** Decision is no longer valid (replaced by new decision)
- **Superseded:** Decision was replaced by another ADR

---

## When to Create an ADR

### Create ADR for:
- ✅ Database schema changes (new tables, major column changes)
- ✅ API design decisions (REST vs GraphQL, authentication method)
- ✅ Service architecture (monolith vs microservices, service boundaries)
- ✅ Technology choices (library selection, framework decisions)
- ✅ Business rule decisions (how platform behaves)
- ✅ Integration decisions (how to integrate with external services)
- ✅ Performance optimizations (caching strategy, query optimization)

### Don't create ADR for:
- ❌ Bug fixes
- ❌ Small feature additions (unless they change architecture)
- ❌ Routine updates (dependency updates, minor refactoring)
- ❌ Temporary workarounds

---

## Related Documentation

- **Template:** `/docs/04-decisions/adr-0001-template.md`
- **Architecture:** `/docs/00-context/architecture.md`
- **Project Snapshot:** `/docs/00-context/project_snapshot.md`

