# AGENTS.md

Guidance for coding agents working in this repository.

## Project

This is a standalone Node.js / NPX version of the Skill Visualizer CLI. It scans workspace and global agent skill directories, then serves a live, self-contained HTML dashboard with automatic reloads when skills change.

## Commands

Run locally:

```bash
npx . --no-open
```

Run on a fixed port:

```bash
npx . --no-open --port 48765
```

Generate a static file and exit:

```bash
npx . --once --no-open --output /tmp/skills-visualizer.html
```

Syntax check:

```bash
node --check index.js
```

## Structure

- `index.js` — entire CLI implementation and generated HTML template.
- `package.json` — NPX/bin metadata.
- `README.md` — user-facing usage docs.
- `LICENSE` — MIT license.

## Development Notes

- Keep the tool dependency-free; it should run with Node.js built-ins only.
- The generated HTML must remain self-contained and work offline when emitted with `--once`.
- Preserve CLI compatibility where practical:
  - `--root <dir>`
  - `--agent` / `-a <name>`
  - `--output` / `-o <file>`
  - `--include` / `-I <dir>`
  - `--port` / `-p <port>`
  - `--once`
  - `--no-open` / `-n`
- When changing the generated UI, test both the Node script and generated browser JavaScript:

```bash
node --check index.js
npx . --once --no-open --output /tmp/skills-visualizer.html
npx . --no-open --port 48765
```

## Skill Discovery

Default selected profile is `common`. The UI scans profiles from `AGENT_PROFILES` in `index.js`, but only displays one selected agent at a time. Supported profiles include:

- `common`
- `pi`
- `claude`
- `codex`
- `antigravity`
- `copilot`
- `mavis`
- `minimax`
- `hermes`

Users can choose the initial profile with `--agent claude` or switch profiles in the UI.

A skill is a directory containing a direct `SKILL.md` file. Optional child directories:

- `scripts/`
- `references/`
- `assets/`
