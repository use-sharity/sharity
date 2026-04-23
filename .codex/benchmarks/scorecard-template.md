# Benchmark Scorecard Template

Run timestamp:
Starting commit:
Task prompt:

## Agent A

Name:
Command:
Branch/worktree:
Wall-clock:
Exit status:

### Diff

- Files changed:
- Insertions/deletions:
- Notable files:

### Verification

- `pnpm convex codegen`:
- `pnpm exec tsc --noEmit`:
- `pnpm lint`:
- `pnpm test`:
- Playwright/browser:
- Screenshots:

### Scores

| Category | Score 0-5 | Notes |
|---|---:|---|
| Requirements coverage |  |  |
| Convex auth/authz correctness |  |  |
| Existing pattern fit |  |  |
| UI and locale integration |  |  |
| Type/generated-file hygiene |  |  |
| Verification quality |  |  |
| Browser/UX evidence |  |  |
| Maintainability |  |  |

Blocking bugs:

## Agent B

Name:
Command:
Branch/worktree:
Wall-clock:
Exit status:

### Diff

- Files changed:
- Insertions/deletions:
- Notable files:

### Verification

- `pnpm convex codegen`:
- `pnpm exec tsc --noEmit`:
- `pnpm lint`:
- `pnpm test`:
- Playwright/browser:
- Screenshots:

### Scores

| Category | Score 0-5 | Notes |
|---|---:|---|
| Requirements coverage |  |  |
| Convex auth/authz correctness |  |  |
| Existing pattern fit |  |  |
| UI and locale integration |  |  |
| Type/generated-file hygiene |  |  |
| Verification quality |  |  |
| Browser/UX evidence |  |  |
| Maintainability |  |  |

Blocking bugs:

## Final Judgment

Winner:
Why:
Residual risks:
Recommended next patch:
