<!--
Sync Impact Report (2026-03-21):
- Version change: 1.0.0 → 1.1.0 (MINOR: new Project Vision and Architecture section)
- Modified principles: none
- Added sections: Project Vision and Architecture (HOBOT system description)
- Removed sections: none
- Templates: plan-template.md ✅ (Constitution Check gate aligns); spec-template.md ✅ (scope unchanged); tasks-template.md ✅ (task types align)
- Follow-up TODOs: none
-->

# OpenClaw Constitution

## Project Vision and Architecture (HOBOT)

This codebase is an **OpenClaw fork** tailored for the **HOBOT** system architecture (codename).

**HOBOT** is an orchestrated multi-agent platform with the following design:

1. **Orchestrator** — A Telegram bot that manages OpenClaw agents for users.
2. **Default agent flow** — User ↔ Orchestrator (TG bot) ↔ RPC ↔ OpenClaw container. One agent is created by default and interacts with the user through the orchestrator.
3. **Additional agents** — Users may create extra agents. Flow: User ↔ User’s own TG bot ↔ OpenClaw container (direct to container, no orchestrator).
4. **LLM endpoint** — All OpenClaw containers use a custom **LiteLLM Proxy** as the LLM endpoint (not built-in provider configs directly).

All feature plans and implementations MUST align with this architecture; new work MUST fit the orchestrator, container, RPC, and LiteLLM Proxy integration model.

You can check functionality description at file orchestrator-functionality.md link
/Users/amalov/openclaw_farm/docs/orchestrator-functionality.md

_Rationale: Ensures a shared understanding of the system boundaries and keeps development focused on the HOBOT target._

## Core Principles

### I. Module and Structure

- Source lives under `src/` (CLI in `src/cli`, commands in `src/commands`, channels, routing, infra, media as documented).
- Plugins and extensions live under `extensions/*` as workspace packages; plugin-only dependencies MUST live in the extension `package.json`, not root.
- Runtime dependencies MUST NOT use `workspace:*` in `dependencies` (install breaks); put `openclaw` in `devDependencies` or `peerDependencies`.
- When refactoring shared logic (routing, allowlists, pairing, onboarding), consider all built-in and extension channels; update `.github/labeler.yml` and GitHub labels when adding channels or extensions.

_Rationale: Clear boundaries and install behavior keep the monorepo maintainable and installs reliable._

### II. CLI and Interface

- Functionality is exposed via the `openclaw` CLI; commands are the primary user-facing surface.
- Use shared CLI patterns: progress via `src/cli/progress.ts` (osc-progress, @clack/prompts), tables and ANSI-safe wrapping via `src/terminal/table.ts`, palette via `src/terminal/palette.ts` (no hardcoded colors).
- Status: `status --all` is read-only/pasteable; `status --deep` runs probes.
- Commits MUST be created with `scripts/committer "<msg>" <file...>` to keep staging scoped; use concise, action-oriented commit messages.

_Rationale: Consistent CLI behavior and tooling improve operator and contributor experience._

### III. Test and Evidence (NON-NEGOTIABLE for bug-fix PRs)

- Tests are colocated `*.test.ts`; e2e in `*.e2e.test.ts`. Framework: Vitest with V8 coverage thresholds (70% lines/branches/functions/statements).
- Run `pnpm test` (or `pnpm test:coverage`) before pushing when touching logic.
- Bug-fix PRs MUST NOT be merged on issue text, PR description, or AI rationale alone. Before merge there MUST be: (1) symptom evidence (repro/log/failing test), (2) verified root cause in code with file/line, (3) fix touching the implicated code path, (4) regression test (fail before/pass after) when feasible; if not feasible, document manual verification and why no test was added.
- Unsubstantiated or likely incorrect claims MUST result in requesting evidence/changes or closing as `invalid`.

_Rationale: Prevents speculative or wrong fixes from landing and keeps the bar for bug-fixes evidence-based._

### IV. Code Quality and Typing

- Language: TypeScript (ESM). Strict typing; avoid `any`. Never add `@ts-nocheck` or disable `no-explicit-any`; fix root causes instead.
- Formatting and linting via Oxlint and Oxfmt; run `pnpm check` before commits.
- No prototype mutation for shared behavior (`applyPrototypeMixins`, `Object.defineProperty` on `.prototype`, or exporting `Class.prototype` for merges). Use explicit inheritance or composition so TypeScript can typecheck.
- Keep files concise (~700 LOC guideline); extract helpers; add brief comments for non-obvious logic.
- Naming: **OpenClaw** for product/docs headings; `openclaw` for CLI, package, binary, and config keys. American spelling in code, comments, and UI strings.

_Rationale: Type safety and consistent style reduce defects and ease refactors._

### V. PR Truthfulness and Triage

- Never merge a bug-fix PR without explicit evidence satisfying the Test and Evidence principle.
- Use auto-close labels and `.github/workflows/auto-response.yml` for standardized close/comment/lock; do not manually close and comment for those reasons.
- Apply `invalid` when issues/PRs are invalid (issues closed as `not_planned`; PRs closed). Apply `dirty` for PRs with too many unrelated changes.
- Before security advisory triage or severity decisions, read `SECURITY.md` to align with OpenClaw’s trust model and design boundaries.

_Rationale: Consistent triage and automation keep the project predictable and reduce maintainer burden._

## Additional Constraints

- **Security**: Never commit or publish real phone numbers, videos, or live configuration; use obviously fake placeholders in docs, tests, and examples. Read `SECURITY.md` for advisories and trust model.
- **Version and release**: Version locations are defined in CLAUDE.md/AGENTS.md (“Version locations”); “bump version everywhere” means all of those except `appcast.xml`. Before any release work, read `docs/reference/RELEASING.md` and `docs/platforms/mac/release.md`. Do not change version numbers or run npm publish/release without operator consent.
- **Docs**: Docs are on Mintlify (github.com/andrewmalov/openclaw). Internal links in `docs/**/*.md` are root-relative without `.md`/`.mdx`. Doc headings and anchors MUST avoid em dashes and apostrophes (Mintlify anchor breaks). Use generic placeholders (e.g. `user@gateway-host`); no personal device names or hostnames.

## Development Workflow

- **Commit**: Use `scripts/committer "<msg>" <file...>`; group related changes; avoid bundling unrelated refactors.
- **PR**: Follow `.github/pull_request_template.md`; use `.github/ISSUE_TEMPLATE/` for issues. When landing or merging, follow the `/landpr` process (global Codex prompts). Optional full workflow: `.agents/skills/PR_WORKFLOW.md` (review-pr → prepare-pr → merge-pr).
- **Quality gates**: Run `pnpm check` (lint/format) and `pnpm test` (or `pnpm test:coverage`) as appropriate before pushing. Pre-commit: `prek install` runs same checks as CI.

## Governance

- This constitution supersedes ad-hoc or conflicting local practice for feature planning and implementation discipline within this repo.
- Amendments MUST be documented in this file, with version bump per semantic versioning: MAJOR for backward-incompatible principle removals or redefinitions; MINOR for new principles or materially expanded guidance; PATCH for clarifications, wording, or typo fixes.
- All implementation plans and PRs MUST verify compliance with these principles where applicable; the “Constitution Check” gate in plan templates MUST pass before Phase 0 research and after Phase 1 design.
- For day-to-day development, runtime guidance, and agent behavior, use `CLAUDE.md` and `AGENTS.md` at repo root (and any `AGENTS.md`/`CLAUDE.md` symlinks in subdirectories).

**Version**: 1.1.0 | **Ratified**: 2026-03-17 | **Last Amended**: 2026-03-21
