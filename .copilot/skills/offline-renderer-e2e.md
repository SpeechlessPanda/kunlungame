# Offline Renderer E2E

Use this checklist when Playwright renderer tests randomly time out on `page.goto(...)` or when changing the renderer HTML entry.

## Failure Signature

- `page.goto('/src/renderer/index.html')` times out while waiting for `load` or `domcontentloaded`.
- Some tests pass in the same run, while unrelated tests fail at navigation before assertions.
- The app is meant to run offline, but `src/renderer/index.html` references external CSS, fonts, scripts, preconnects, or images.

## Verified Fix

1. Keep `src/renderer/index.html` self-contained for offline desktop use.
2. Do not load Google Fonts or other CDN resources from the renderer entry.
3. Prefer the font stacks in `src/renderer/styles/tokens.css` and local packaged assets.
4. In Playwright tests, navigate through a shared helper that waits for `domcontentloaded` and then assert app-specific readiness, such as `data-testid="game-shell"`.

## Verification

Run from the target workspace or worktree:

```powershell
pnpm exec playwright test --workers=1
pnpm test:e2e
```

Both commands should pass before treating renderer navigation as stable.
