---
name: jobhunt-issue-workflow
description: Project workflow for team-diamond-2026/jobhunt_notion_dev_memo GitHub issue implementation. Use when Codex is asked to choose, start, implement, or continue project tasks from GitHub Issues; enforce assigning the Issue before work, choosing ready unassigned priority work in order, creating a dedicated branch, verifying changes, and always opening a Pull Request after implementation.
---

# Jobhunt Issue Workflow

## Overview

Use this workflow for implementation work driven by GitHub Issues in `team-diamond-2026/jobhunt_notion_dev_memo`.

The rule is simple: no implementation starts without an assignee, and no implementation ends without a PR.

## Repository

- Repository: `team-diamond-2026/jobhunt_notion_dev_memo`
- Default branch: `main`
- Branch prefix: `codex/`
- Current known CLI user may be checked with `gh api user --jq .login`

## Issue Selection

When the user says to work through tasks in order, select from open Issues using this priority:

1. Open Issues with no assignee and explicit high priority.
2. Open Issues with no assignee and MVP/blocking impact.
3. Open Issues with no assignee and medium priority.
4. Small cleanup/documentation Issues only when they unblock future implementation.

Do not treat parent/tracking Issues as implementation tasks unless the user explicitly asks. Use them to understand order and dependencies.

Prefer tasks that are actually actionable in the current repository state. If a high-priority Issue is blocked by missing credentials, missing product decisions, or unavailable infrastructure, document the blocker and move to the next ready Issue.

## Required Workflow

1. Inspect current git state with `git status --short --branch`.
2. Identify the next Issue and summarize why it is next.
3. Assign the Issue before editing files.
   - First try the GitHub connector if available.
   - If the connector cannot update assignees, use `gh issue edit <number> --add-assignee <login>`.
   - If assignee assignment fails, do not implement; report the blocker.
4. Create a dedicated branch from the current base branch.
   - Use `codex/issue-<number>-<short-slug>`.
5. Implement the Issue in focused commits or changes.
6. Run the relevant checks before PR.
   - For app changes, prefer `npm run lint` and `npm run build` from `app/` when dependencies allow.
   - For docs/process-only changes, run the narrow validation command that applies, or state why no automated check exists.
7. Update or reference the Issue as appropriate.
8. Commit, push, and open a PR.
   - PR title should include the Issue number.
   - PR body should include `Closes #<number>` when the implementation fully completes the Issue.
   - If the Issue is only partially handled, use `Refs #<number>` and state remaining work.

## Implementation Notes

- Keep changes scoped to the selected Issue.
- Do not take over Issues that already have an assignee unless the user explicitly instructs it.
- Do not batch unrelated Issues into one PR.
- Preserve user changes in the working tree; never reset or revert unrelated work.
- Use existing project patterns before adding new abstractions.
- If a task requires secrets or production Supabase changes, add reproducible scripts/docs to the repo rather than silently depending on local state.

## Completion Response

When done, report:

- Issue selected and assignee used.
- Branch name.
- PR URL.
- Checks run and their result.
- Any remaining risk or follow-up.
