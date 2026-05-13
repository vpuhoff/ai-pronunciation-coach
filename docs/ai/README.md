# AI workflow (Docs-as-Code / BMad)

This folder holds **specifications**, **implementation plans**, and **templates** used to drive AI-assisted development with clear roles.

## Start here after a break

1. Open **[`active_task.md`](./active_task.md)** (or maintain a single `current_context.md` instead—pick one convention for your team; this repo defaults to `active_task.md`).
2. Note the active feature, links to spec/plan, and current step.

## Flow

| Step | Owner (rule) | Output |
|------|----------------|--------|
| 1. Write / refine the spec | Human (+ optional Architect) | `docs/ai/specs/*.md` |
| 2. Produce an implementation plan | Architect — [`.cursor/rules/01-architect.mdc`](../.cursor/rules/01-architect.mdc) | `docs/ai/plans/*.md` from [`templates/plan_template.md`](./templates/plan_template.md) |
| 3. Implement | Coder — [`.cursor/rules/03-coder.mdc`](../.cursor/rules/03-coder.mdc) | Code + **updated checkboxes** in the plan file |
| 4. Review | Reviewer — [`.cursor/rules/02-reviewer.mdc`](../.cursor/rules/02-reviewer.mdc) | Findings / priorities (no drive-by rewrites) |

## Directories

| Path | Purpose |
|------|---------|
| `specs/` | Feature specs (ТЗ) |
| `plans/` | Step-by-step Markdown plans with `[ ]` / `[x]` tasks |
| `bugs/` | AI-oriented bug notes / repro context |
| `templates/` | Copy-paste starters for specs and plans |

## Cursor rules

Enable **one role at a time** in Cursor when possible to avoid conflicting instructions (especially between Reviewer and Coder on the same files).

Root project hints: [`.cursorrules`](../.cursorrules).
