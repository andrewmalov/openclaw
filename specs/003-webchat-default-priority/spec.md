# Feature Specification: Webchat default channel for orchestrator agent

**Feature Branch**: `003-webchat-default-priority`  
**Created**: 2026-03-22  
**Status**: Draft  
**Input**: User description: "необходимо доработать агента для приоритетного использования канал webchat в том числе для передачи файлов. webchat - канал по умолчанию в нашем оркестраторе. Агент должен использовать webchat без возникающих ошибок"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Deliver files through the same webchat session (Priority: P1)

An operator uses the orchestrator webchat to talk to the agent. The operator asks the agent to generate or package logs (or any file) and send them back in the conversation. The agent completes the request and the operator receives the file in that same webchat thread without errors.

**Why this priority**: File handoff in webchat is the most visible failure mode today and blocks operational workflows (support, debugging, reporting).

**Independent Test**: In an orchestrator webchat-only environment (no external chat connectors required), run a scripted conversation that ends with the agent offering a file; confirm the operator receives it in webchat and sees no channel-configuration errors.

**Acceptance Scenarios**:

1. **Given** an active orchestrator webchat session and no external messaging channels configured, **When** the operator asks the agent to send an archive or attachment, **Then** the file is delivered in webchat and the operator does not see errors about a missing or unconfigured channel.
2. **Given** an active orchestrator webchat session, **When** the agent uses messaging capabilities to attach media intended for the current operator, **Then** delivery targets the current webchat context without requiring the operator to name a channel.

---

### User Story 2 - Webchat is the default surface for orchestrator turns (Priority: P2)

When the user interacts only through the orchestrator webchat, the agent treats webchat as the primary conversation surface for outbound actions that mirror “reply here,” including short text follow-ups that today might incorrectly assume an external messenger.

**Why this priority**: Prevents confusing failures and redundant configuration for teams that standardize on the orchestrator UI.

**Independent Test**: With only webchat in use, run prompts that previously failed with “channel required” style outcomes; confirm the agent completes them using webchat as the implicit surface.

**Acceptance Scenarios**:

1. **Given** a webchat-origin session in the orchestrator, **When** the agent performs an outbound messaging action that should return to the same operator, **Then** the default target is webchat without the operator supplying channel parameters.
2. **Given** a webchat-origin session, **When** no external channel is configured, **Then** the agent does not fail solely because no external connector exists.

---

### User Story 3 - Clear behavior when the operator explicitly wants another surface (Priority: P3)

If the deployment also has external channels configured, an operator may still ask to send something via a named surface. The product should respect explicit intent without breaking webchat-first defaults for everyone else.

**Why this priority**: Avoids regressions for mixed-mode deployments while keeping orchestrator-first teams unblocked.

**Independent Test**: In a deployment with at least one external channel configured, issue an explicit instruction to use that channel; confirm delivery follows instruction. Separately, issue a generic “send here” request from webchat; confirm webchat remains the default.

**Acceptance Scenarios**:

1. **Given** both webchat and at least one external channel are available, **When** the operator clearly requests delivery via a specific external surface, **Then** the system can route accordingly without blocking webchat-only flows.
2. **Given** both surfaces exist, **When** the operator does not specify an external surface, **Then** webchat remains the default for orchestrator-originated work.

---

### Edge Cases

- Very large files exceed product or orchestrator attachment limits: user sees a clear, non-channel-related explanation and suggested alternatives (link, chunking, or support path)—not a generic “channel required” error.
- Concurrent operators or multiple webchat tabs: delivery remains tied to the correct session or user context; cross-user leakage is prevented.
- Agent attempts a cross-surface send without permission or policy: user sees a policy-appropriate message, not an internal channel-selection error.
- Partial failures (e.g., file missing on disk): user sees a specific validation message, not a channel defaulting error.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: For orchestrator sessions that originate in webchat, the system MUST default outbound “reply to user” messaging behavior to webchat without requiring the operator to select or configure an external messaging connector.
- **FR-002**: The system MUST support delivering files and media to the operator through webchat when the session is webchat-originated, including cases where no external messaging channel is configured.
- **FR-003**: The system MUST NOT surface errors that imply “no channel configured” or “channel required” for legitimate webchat-only flows that should complete in the current webchat session.
- **FR-004**: When an operator explicitly requests delivery via another available surface (where product policy allows), the system MUST honor that intent without breaking FR-001–FR-003 for unspecified cases.
- **FR-005**: Observable errors MUST distinguish configuration or policy problems from channel-defaulting problems so operators and support can tell “wrong channel logic” from “file too large” or “not found.”

### Key Entities

- **Orchestrator webchat session**: The operator’s conversation context in the orchestrator UI; defines the default delivery surface.
- **Outbound delivery action**: Any agent-initiated action meant to push text or attachments to the operator (including “send file” style tasks).
- **File or media attachment**: Binary or document content the operator requested (archives, logs, exports) subject to existing size and safety limits.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In a webchat-only orchestrator test environment, one hundred percent of scripted “request file in webchat” runs complete without any channel-configuration or channel-required class errors (measured over the acceptance scenarios in this specification).
- **SC-002**: Operators report zero mandatory steps to “add Telegram/Discord/etc.” solely to receive files in webchat for flows scoped to this feature (qualitative check via pilot or support ticket review within one release cycle).
- **SC-003**: For mixed-surface deployments, at least ninety percent of ambiguous “send this to me” requests from webchat default to webchat delivery in usability testing sessions (target sample: minimum five scenarios across two operator personas).
- **SC-004**: Support or internal logs show a measurable drop in incidents tagged “channel required / no configured channels” for orchestrator webchat sessions after release (baseline compared to prior four weeks).

## Assumptions

- “Orchestrator” refers to the product context where webchat is already documented as the default operator surface.
- Existing product limits on attachment size, rate, and acceptable file types remain unchanged unless a separate initiative updates them.
- “Priority” for webchat means defaulting to webchat for orchestrator-originated delivery unless the operator clearly names another surface and policy allows it.
