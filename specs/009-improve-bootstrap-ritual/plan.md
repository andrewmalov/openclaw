# Technical Plan: Improve Bootstrap Ritual

**Feature Branch**: `009-improve-bootstrap-ritual`
**Spec**: `spec.md`
**Status**: Ready for Implementation

## Overview

The implementation is a two-file text change: `AGENTS.md` (primary) and `BOOTSTRAP.md` (refinement). No code, no tests needed — purely instruction clarity in the workspace templates.

---

## Files to Change

### 1. `docs/reference/templates/AGENTS.md` — "First Run" section

**Current text (lines 12-14):**

```markdown
## First Run

If `BOOTSTRAP.md` exists, that's your birth certificate. Follow it, figure out who you are, then delete it. You won't need it again.
```

**Replace with:**

```markdown
## First Run

If `BOOTSTRAP.md` exists:

1. **STOP** — don't read anything else yet
2. Read `BOOTSTRAP.md` completely
3. Execute its instructions (introduce yourself, generate avatar, complete setup)
4. When finished: delete `BOOTSTRAP.md`
5. Only then continue with `SOUL.md`, `USER.md`, etc.

You won't need it again.

## Remember

If `BOOTSTRAP.md` still exists — you skipped it. Go back. Read it. Follow it.
```

**Why this works:**

- `STOP` — explicit halt signal, no ambiguity
- `don't read anything else yet` — blocks parallel reading
- Numbered steps — removes "choose your own order"
- `Only then continue` — clear sequencing gate
- `Remember` fallback — catches skipped bootstrap in subsequent sessions

---

### 2. `docs/reference/templates/BOOTSTRAP.md` — "When You're Done" section

**Current text (lines 56-58):**

```markdown
## When You're Done

Delete this file. You don't need a bootstrap script anymore — you're you now.
```

**Replace with:**

```markdown
## When You're Done

You are done when:

1. You have a name and shared it with the user
2. `IDENTITY.md` is written with your name, nature, vibe, and emoji
3. `USER.md` is written with their name and preferences
4. `SOUL.md` has been discussed and written

**Then delete this file.** You don't need a bootstrap script anymore — you're you now.
```

**Why this works:**

- Concrete checklist before the delete step — removes "when am I done?" ambiguity
- Matches the user's feedback pattern: explicit conditions, numbered, no room for "I'll decide"

---

## No Other Changes

- No code changes
- No new tests required (this is a documentation-only change)
- No new files
- `Session Startup` section in AGENTS.md remains unchanged — it already correctly starts with "Before doing anything else" and reads SOUL.md, USER.md, etc., but that section is only reached _after_ the First Run gate is passed
- Edge cases (agent crash, skip bootstrap, multi-agent workspace) are handled by the `Remember` reminder in AGENTS.md, not by additional logic

---

## Implementation Order

1. Update `AGENTS.md` "First Run" section
2. Update `BOOTSTRAP.md` "When You're Done" section
3. Verify templates are syntactically valid markdown
4. Commit
