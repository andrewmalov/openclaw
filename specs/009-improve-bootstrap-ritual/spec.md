# Feature Specification: Improve Bootstrap Ritual

**Feature Branch**: `009-improve-bootstrap-ritual`
**Created**: 2026-03-30
**Status**: Draft
**Input**: User description: "улучшить процесс bootstrap. Ниже комментарии"

## User Scenarios & Testing

### User Story 1 - Agent Follows Bootstrap Ritual Exactly (Priority: P1)

An agent enters a fresh workspace where `BOOTSTRAP.md` exists. The agent must stop, read the bootstrap file completely, execute its instructions, and only then continue — without skipping ahead or reading other files in parallel.

**Why this priority**: This is the core issue the user raised. The current "Follow it" instruction is too vague. Without explicit sequencing and explicit "stop" signals, agents may read files out of order, skip steps, or continue prematurely.

**Independent Test**: Can be tested by placing a fresh agent in a workspace with BOOTSTRAP.md and verifying (via logs or file state) that the agent: (1) did not read SOUL.md/USER.md first, (2) completed all bootstrap steps, (3) deleted BOOTSTRAP.md, (4) only then read other files.

**Acceptance Scenarios**:

1. **Given** a workspace with `BOOTSTRAP.md`, `SOUL.md`, and `USER.md`, **When** the agent starts a session, **Then** the agent reads only `BOOTSTRAP.md` first and does not read `SOUL.md` or `USER.md` until bootstrap is complete.

2. **Given** a workspace with `BOOTSTRAP.md`, **When** the agent completes all bootstrap instructions and writes identity information to `IDENTITY.md` and `USER.md`, **Then** the agent deletes `BOOTSTRAP.md`.

3. **Given** `BOOTSTRAP.md` still exists after the first session, **When** the agent starts a new session, **Then** the agent is reminded to complete bootstrap and is not allowed to proceed with other files.

---

### User Story 2 - Agent Understands Bootstrap Completion Without Ambiguity (Priority: P2)

The bootstrap ritual includes a clear "you are done" signal. The agent knows exactly when bootstrap is complete — not "figure out when you're done" but a concrete deletion of `BOOTSTRAP.md`.

**Why this priority**: Eliminates the ambiguity of "when am I finished?" The current system leaves this open-ended.

**Independent Test**: Can be tested by verifying that after bootstrap steps are complete, the agent's next action is deleting `BOOTSTRAP.md` and that subsequent sessions do not re-read it.

**Acceptance Scenarios**:

1. **Given** the agent has introduced itself, generated/confirmed its avatar, and written identity to `IDENTITY.md` and `USER.md`, **When** the agent considers bootstrap complete, **Then** the agent deletes `BOOTSTRAP.md` as the concrete completion signal.

2. **Given** a subsequent session where `BOOTSTRAP.md` does not exist, **When** the agent starts, **Then** the agent skips the bootstrap ritual entirely and proceeds to `SOUL.md`, `USER.md`, etc.

---

### User Story 3 - Fallback Reminder If Bootstrap Is Skipped (Priority: P2)

If an agent somehow proceeds past the bootstrap ritual without completing it (e.g., due to an interrupted session), the next session must detect this and redirect the agent back to bootstrap.

**Why this priority**: Covers the edge case where bootstrap is not completed in a single session.

**Independent Test**: Can be tested by simulating an interrupted bootstrap (BOOTSTRAP.md exists but identity files are incomplete) and verifying the agent detects the incomplete state and redirects to bootstrap.

**Acceptance Scenarios**:

1. **Given** `BOOTSTRAP.md` exists and identity files (`IDENTITY.md`, `USER.md`) are missing or incomplete, **When** the agent starts, **Then** the agent reads `BOOTSTRAP.md` and completes the missing steps before proceeding.

2. **Given** a "Remember" reminder exists in AGENTS.md, **When** `BOOTSTRAP.md` still exists, **Then** the agent is alerted that bootstrap was skipped and must be completed.

---

### Edge Cases

- What happens if the agent crashes during bootstrap — does it resume or restart?
- What if the user interrupts and says "skip bootstrap for now"?
- How does the agent handle bootstrap if multiple agents share the same workspace?
- What if `BOOTSTRAP.md` exists but the agent was run with a system prompt that bypasses file reading order?

## Requirements

### Functional Requirements

- **FR-001**: The agent MUST stop and read `BOOTSTRAP.md` first when it exists, before reading any other file.
- **FR-002**: The agent MUST NOT read `SOUL.md`, `USER.md`, `memory/`, or `MEMORY.md` until `BOOTSTRAP.md` is deleted.
- **FR-003**: The agent MUST complete all bootstrap steps (introduce itself, generate avatar, complete setup) before deleting `BOOTSTRAP.md`.
- **FR-004**: The agent MUST delete `BOOTSTRAP.md` only after completing all bootstrap steps and writing identity to `IDENTITY.md` and `USER.md`.
- **FR-005**: The agent MUST NOT re-read or re-execute bootstrap steps in subsequent sessions once `BOOTSTRAP.md` is deleted.
- **FR-006**: If `BOOTSTRAP.md` exists and the agent somehow skips it, the agent MUST detect this via a reminder check and redirect to bootstrap.

### Key Entities

- **BOOTSTRAP.md**: First-run ritual file. Deleted after completion. Acts as both instructions and completion gate.
- **IDENTITY.md**: Agent's name, nature, vibe, and emoji. Written during bootstrap.
- **USER.md**: Human's name, timezone, and preferences. Written during bootstrap.
- **SOUL.md**: Agent's guiding principles and behavioral boundaries. Read after bootstrap.
- **AGENTS.md**: Workspace rules. Contains the bootstrap redirect logic.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Agent reads `BOOTSTRAP.md` first in 100% of sessions where it exists, with zero instances of reading other files before bootstrap completion.
- **SC-002**: Agent deletes `BOOTSTRAP.md` immediately upon bootstrap completion in 100% of cases.
- **SC-003**: Zero instances of the agent proceeding past session startup without completing bootstrap when `BOOTSTRAP.md` is present.
- **SC-004**: Subsequent sessions after bootstrap completion never re-read `BOOTSTRAP.md`.
