# skill-viz

Visualize Agent Skills from your terminal.

`skill-viz` is a dependency-free `npx` CLI that scans local and global Agent Skill directories, starts a live local dashboard, and reloads automatically when skills change.

## Quick start

```bash
npx skill-viz
```

The dashboard opens in your browser. It starts on the `common` profile and lets you switch agent profiles from the UI.

## Usage

```bash
npx skill-viz [options]
```

Common examples:

```bash
# Start the live dashboard without opening a browser
npx skill-viz --no-open

# Start on a specific agent profile
npx skill-viz --agent claude
npx skill-viz --agent pi

# Use a fixed server port
npx skill-viz --port 48765

# Scan a different workspace root
npx skill-viz --root /path/to/project

# Add an extra skills directory
npx skill-viz --include /extra/skills/dir

# Generate one static HTML file and exit
npx skill-viz --once --output skills.html
```

Local checkout:

```bash
npx ../skill-visualizer.sh --no-open
```

## Options

| Option | Description |
| --- | --- |
| `--agent`, `-a <name>` | Initially selected agent profile. |
| `--root <dir>` | Workspace root to scan. Defaults to the current directory. |
| `--include`, `-I <dir>` | Additional skills directory to scan. Can be repeated. |
| `--port`, `-p <port>` | Port for the live server. Defaults to a random available port. |
| `--output`, `-o <file>` | Also write the generated HTML snapshot to this file. |
| `--once` | Write a static HTML file and exit instead of starting the live server. |
| `--no-open`, `-n` | Do not open the dashboard in a browser. |
| `--help`, `-h` | Show help. |

## Agent profiles

Supported profiles:

- `common`
- `pi`
- `claude`
- `codex`
- `antigravity`
- `copilot`
- `mavis`
- `minimax`
- `hermes`

By default, `skill-viz` starts with `common`, which shows shared `.agents` / `.config/agents` skills. The dashboard scans known profiles and lets you switch views from the agent selector.

Some agent views include shared `common` skills when that agent's documented behavior loads `.agents/skills`:

- `pi` includes `common` plus Pi-specific skill directories.
- `codex` includes `common`, because OpenAI Codex documents `.agents/skills` as repository/user skill locations.
- `antigravity` includes `common`, because Google Antigravity documents workspace skills under `.agents/skills`.
- `claude` does **not** include `common`; Claude Code documents `.claude/skills` for personal/project skills.

## Dashboard features

- Live reload when skill files change.
- Agent selector for supported agent profiles.
- Search by skill name, description, scripts, references, assets, and paths.
- Contents sidebar with `SKILL.md`, scripts, and resources sections.
- Markdown rendering with tables and code highlighting.
- Symlink detection with inline indicators.
- Light/dark mode.
- Mobile-friendly collapsible navigation.

## Publishing to npm / npx

`npx` runs packages from the npm registry. To publish:

```bash
npm login
npm pack --dry-run
npm publish --access public --otp YOUR_2FA_CODE
```

If your npm account requires 2FA, pass `--otp` or use a granular access token with publish permissions.

For updates, bump the version first:

```bash
npm version patch
npm publish --access public --otp YOUR_2FA_CODE
```

## License

MIT. See [LICENSE](LICENSE).
