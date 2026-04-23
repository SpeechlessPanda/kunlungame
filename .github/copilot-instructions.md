# Kunlungame Project Instructions

These instructions apply to all future Copilot sessions in this repository.

## 1. Source Control Workflow

1. At the end of every work session, commit the completed changes and push them to GitHub.
2. Do not create meaningless micro-commits for every small edit. The default commit granularity is one completed session or one logically complete unit of work within the session.
3. Use Conventional Commits for commit messages. Preferred prefixes include `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, and `build:`.
4. Before committing, confirm the working tree only includes intended changes for the current session. Do not revert user-authored changes unless explicitly instructed.
5. If changes are blocked from being pushed because of authentication, network, or remote problems, report the exact blocker and keep the local commit in place.

## 2. Documentation Sync Rule

1. Every code or content change must update the affected documentation in the same session.
2. At minimum, update the impacted design document or implementation plan when the change alters behavior, structure, scope, assets, test policy, or workflow.
3. If a change affects content authoring, update the corresponding content format or authoring guide.
4. If a release-facing behavior changes, update release notes or delivery notes before release.

## 3. Reusable Knowledge And Project Skills

1. When a problem is found and solved, evaluate whether the lesson is worth preserving.
2. Write the lesson into a project skill under `.copilot/skills/` when it meets at least one of these conditions:
   - it is likely to recur,
   - it is specific to this repository or toolchain,
   - it is counterintuitive enough that it could waste time again,
   - it encodes a validated workflow or debugging pattern.
3. Keep project skills concise, procedural, and reusable. Prefer checklists, failure signatures, and verified fixes over long prose.
4. Do not create skills for trivial one-off issues with no reuse value.

## 4. Engineering Quality Bar

1. Follow widely accepted industry practices for architecture, typing, error handling, naming, modularity, and dependency management.
2. Prefer clear boundaries between renderer, desktop shell, story state, retrieval, AI orchestration, and presentation code.
3. Favor minimal, maintainable solutions over clever shortcuts.
4. New code must match the best practices of the relevant language and framework used in this repository.
5. Use `pnpm` as the default package manager unless the user explicitly requests otherwise.

## 5. Testing Policy

1. Every feature must include both black-box and white-box tests when technically applicable.
2. Black-box tests should validate externally observable behavior, user flows, state transitions, streaming output behavior, save and restore behavior, and failure handling.
3. White-box tests should validate internal logic such as prompt assembly, retrieval filtering, state transitions, parsers, mappers, scoring logic, and error branches.
4. Run relevant tests immediately after implementing the feature instead of batching all verification until the end.
5. Minimum coverage targets are:
   - overall line coverage: at least 80%,
   - core modules: at least 90%.
6. Core modules include story progression, attitude state, save system, knowledge compilation, knowledge retrieval, prompt building, and AI stream orchestration.
7. If a feature cannot be covered by one test type, document the limitation and add the strongest practical alternative test.

## 6. Release Audit Policy

Before every formal release, perform and record a project audit that includes all of the following:

1. dependency and security review,
2. test suite and coverage review,
3. build and packaging verification,
4. startup and runtime smoke verification,
5. performance and resource usage check,
6. documentation and release note review,
7. content and asset compliance review.

The audit record should clearly list what was checked, what passed, what failed, and what remains deferred.

## 7. Working With User Changes

1. If the repository contains changes not created by the current session, treat them as intentional user changes unless there is clear evidence otherwise.
2. You may build on top of those changes and modify them when needed for the task.
3. Do not revert or discard such changes without explicit approval.

## 8. Conversation Continuation Rule

1. Do not end the conversation immediately after finishing a task.
2. At the end of each session, use the appropriate question tool to ask whether anything should be improved next or what the next step should be.
3. If user confirmation, clarification, or further scoping detail is needed at any point, do not interrupt the flow with a plain-text question, and do not make the decision silently on the user's behalf. Use the question tool so the user can choose directly.
4. If a task is likely to run for a long time or consume substantial context, explicitly judge whether it should be delegated to a subagent. Base that decision on whether the work is largely independent and whether its intermediate context is useful to the main agent.
5. When the long-running or context-heavy task is a good fit for delegation, hand it to a subagent instead of keeping the full workload in the main agent context. If additional user detail is needed before that delegation decision or before dispatch, use the question tool rather than interrupting the conversation in plain text.
6. After the question tool returns an answer, continue the task immediately using that answer unless the user explicitly asks to stop or wait. Do not pause for redundant confirmation after receiving the user's selection or clarification.

## 9. Project-Specific Content Rule

1. Mainline content planning must stay aligned with the project's hybrid background strategy.
2. Story nodes should explicitly decide whether a scene is primarily fictional, photographic, or composite.
3. Mythic or symbolic nodes should prefer fictional imagery.
4. Historically grounded cultural nodes should prefer real photography or photo-led composites.
5. Transitional nodes should intentionally bridge the two modes instead of switching art arbitrarily.
