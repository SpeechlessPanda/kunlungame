# Model Smoke In Git Worktrees

Use this checklist when running `pnpm dialogue:smoke` or `pnpm playthrough` from a git worktree.

## Failure Signature

- The main checkout has `runtime-cache/models/**` populated, but the worktree smoke reports no local GGUF files.
- The searched paths point at `.worktrees/<branch>/runtime-cache/models/**`.
- The code under test is only present in the worktree, so running the smoke from the main checkout would test stale code.

## Verified Fix

1. Keep the command working directory inside the worktree so `process.cwd()` points at the changed code.
2. Temporarily link the worktree cache to the main checkout cache, for example on Windows:

```powershell
Set-Location 'D:\project\kunlungame\.worktrees\rag-model-ui-refresh'
$created = $false
if (-not (Test-Path runtime-cache)) {
  cmd /c mklink /J runtime-cache D:\project\kunlungame\runtime-cache
  $created = $true
}
try {
  pnpm dialogue:smoke
} finally {
  if ($created) { Remove-Item runtime-cache -Force }
}
```

3. Confirm the smoke output includes `selectedProfileId=qwen2.5-3b-instruct-q4km` when validating the default Quality profile.
4. Remove only the temporary junction, never the target `D:\project\kunlungame\runtime-cache` directory.
