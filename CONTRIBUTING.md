# Contributing

## Commits

Commit in a clear, organized way so history stays readable.

### 1. See what changed

```bash
git status
git diff --stat
```

Use this to decide whether to make one commit or several.

### 2. Group by purpose

Prefer **multiple small commits** when changes touch different areas. Group by:

- **Feature** – one area (e.g. TV, auth, wallet)
- **Fix** – bug or regression
- **Config / docs** – config, README, env examples
- **Dependencies** – `package.json` / lockfile only

If everything is one feature or fix, a single commit is fine.

### 3. Stage and commit

**One commit for everything:**

```bash
git add -A
git commit -m "Short description of the change"
```

**Several commits:**

```bash
git add path/to/area1/
git commit -m "feat(scope): description"

git add path/to/area2/
git commit -m "fix(scope): description"

git push
```

### 4. Message format

- Use **present tense**: "add filter" not "added filter"
- Keep the first line under ~50 characters
- Add a blank line and extra detail in the body if needed

Examples:

- `feat(tv): move filter next to search bar`
- `fix(auth): correct login redirect`
- `chore: update .gitignore for server debug log`
