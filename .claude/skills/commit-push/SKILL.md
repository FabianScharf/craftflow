---
name: commit-push
description: Stage all modified tracked files, commit with a message provided as $ARGUMENTS, and push to main. Use when the user says "commit and push" or "committen und pushen".
disable-model-invocation: false
---

The user wants to commit and push. The commit message is: $ARGUMENTS

Steps:
1. Run `git diff --stat` to show what's changing.
2. Stage only modified tracked files: `git add -u` (never `git add -A` unless the user explicitly asks to include untracked files).
3. Commit with the provided message, appending the Co-Authored-By trailer:
   ```
   git commit -m "<message>

   Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
   ```
4. Push: `git push origin main`
5. Confirm with the commit hash and "Gepusht auf main."

If $ARGUMENTS is empty, ask the user for a commit message before proceeding.
