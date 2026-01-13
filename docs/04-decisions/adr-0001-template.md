# ADR-0001: [Decision Title]

**Status:** [Proposed | Accepted | Deprecated | Superseded]  
**Date:** YYYY-MM-DD  
**Deciders:** [Names/roles]  
**Context:** [Brief description of the situation]

---

## Context

[Describe the issue or situation that requires a decision. Include:
- What problem are we trying to solve?
- What are the constraints?
- What are the requirements?]

---

## Decision

[State the decision clearly and concisely. This should be a single sentence or short paragraph.]

**We will [do X] because [reason Y].**

---

## Consequences

### Positive
- [Benefit 1]
- [Benefit 2]
- [Benefit 3]

### Negative
- [Drawback 1]
- [Drawback 2]
- [Drawback 3]

### Neutral / Trade-offs
- [Trade-off 1]
- [Trade-off 2]

---

## Alternatives Considered

### Alternative 1: [Name]
**Description:** [What is this alternative?]

**Pros:**
- [Pro 1]
- [Pro 2]

**Cons:**
- [Con 1]
- [Con 2]

**Why not chosen:** [Reason]

---

### Alternative 2: [Name]
**Description:** [What is this alternative?]

**Pros:**
- [Pro 1]
- [Pro 2]

**Cons:**
- [Con 1]
- [Con 2]

**Why not chosen:** [Reason]

---

## Implementation Notes

[Optional: Add notes about how this decision was or will be implemented:
- Files changed
- Migration needed
- Configuration updates
- Testing requirements]

---

## Related ADRs

- [Link to related ADRs if any]

---

## References

- [Link to relevant documentation, issues, PRs, etc.]

---

## Template Usage

**When to create an ADR:**
- Architecture decisions (database schema, API design, service structure)
- Technology choices (libraries, frameworks, tools)
- Business rule decisions (how the platform should behave)
- Significant refactoring decisions

**When NOT to create an ADR:**
- Bug fixes
- Small feature additions (unless they change architecture)
- Routine updates
- Temporary workarounds

**How to use this template:**
1. Copy this file: `cp adr-0001-template.md adr-XXXX-description.md`
2. Replace `XXXX` with next number (0002, 0003, etc.)
3. Replace `[Decision Title]` with actual title
4. Fill in all sections
5. Update `adr-index.md` with new ADR

