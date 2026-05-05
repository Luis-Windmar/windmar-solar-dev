You are wrapping up a Claude Code work session on the Windmar Commercial PreQual estimator.
Perform the following steps in order. Do not skip any step.

---

### Step 1 — Write session notes

Create a session notes file at:
  docs/session_notes_$CURRENT_DATE.md

Where $CURRENT_DATE is today's date in YYYY-MM-DD format.

If a file for today already exists, append to it rather than overwriting.

The session notes must include:
- **Overview**: 2-3 sentence summary of what was accomplished this session
- **Files Modified**: for each file changed, what was changed and why
- **New Files Created**: any new files added and their purpose
- **External Repos Changed**: any changes made to the Tool Belt or other repos
- **Architectural Notes**: any decisions made that affect how the system works,
  including API integrations, data flow changes, or patterns established
- **Known Issues / Follow-ups**: anything left incomplete or that needs attention next session
- **Deployment Status**: what was deployed, to where, and whether it was verified

---

### Step 2 — Update CLAUDE.md

Read the current CLAUDE.md carefully. Then update it to reflect the current state
of the project. Specifically:

1. **Implementation Status section** — update checkboxes/status for anything completed
   or changed this session

2. **Architecture section** (create one if it doesn't exist) — maintain a concise
   "current architecture" summary with:
   - Which data comes from the Tool Belt API vs hardcoded fallbacks
   - Which endpoints are live and wired
   - Any endpoints that exist in the Tool Belt but are NOT yet wired

3. **Directory Structure** — update if any new files or folders were added

4. **Do NOT rewrite CLAUDE.md from scratch** — make targeted updates only.
   Preserve all existing content that is still accurate.

---

### Step 3 — Commit everything to GitHub

```bash
git add docs/ CLAUDE.md
git commit -m "docs: session wrap-up $(date +%Y-%m-%d)"
git push
```

Report the git output and confirm the push succeeded.

---

### Step 4 — Print a summary

Print a brief confirmation:
- Session notes written to: docs/session_notes_YYYY-MM-DD.md
- CLAUDE.md updated: yes/no (and what sections changed)
- GitHub: pushed ✅ or error message
- Reminder of any follow-up items from the Known Issues section
