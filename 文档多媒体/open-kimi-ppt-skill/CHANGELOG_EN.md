# Changelog

[简体中文](CHANGELOG.md) | [English](CHANGELOG_EN.md)

This project follows [Semantic Versioning](https://semver.org/).

## [1.3.0] - 2026-08-07

### Added

- Offline neo-ppt editor mirror (`editor/`): no iframe, no `www.kimi.com`; open a PPTD folder and export from the official UI
- Skill install copies the full `editor/` tree plus patched WASM into installed skill directories
- Image QA / `--browser` export now drives the local editor (`?ndExport=1` + `payload.json`) instead of kimi.com

### Changed

- Default PPTX export uses the local patched WASM (single source: `editor/neo-ppt/assets/pptd_wasm_bg-DPPWdROu.wasm`)
- Local editor hides share / cloud / Google Drive entry points and blocks related cloud/Google API calls
- Removed the old iframe shell (`app.js` / `styles.css`), deprecated `export_host.html`, and unused browser top-bar export glue
- **Be sure to upgrade**: this release is fully localized — editing and export now run entirely on the local neo-ppt mirror + patched WASM instead of the official cloud export pipeline, so the "official export requires signature" issue no longer occurs. Run `npx open-kimi-ppt-skill@latest install -y` (or pick a target directory interactively) to reinstall and sync the fully localized resources into your installed directory.

### Fixed

- Avoid dark-theme FOUC by forcing light mode
- Demo / read-only opens can edit, present, and export again (`isCreate: false` + editable config)
- Browser sessions strip `HTTP(S)_PROXY` so corporate proxies do not 403 localhost

## [1.2.0] - 2026-08-06

### Added

- CLI supports `-h` / `--help` and `-V` / `--version`

### Changed

- Renamed the npm package and CLI from `open-kimi-ppt-skills` to `open-kimi-ppt-skill` to match the GitHub repo. Use `npx open-kimi-ppt-skill@latest` going forward; the old package name will no longer receive updates

## [1.1.3] - 2026-08-06

### Added

- Interactive `install` checklist for `.agents` / `.codex` / `.claude` / `.cursor` / `.workbuddy` skill directories (space to multi-select)
- `-y/--yes` (non-interactive default) and repeatable `--target`
- `--all` installs only into detected agent directories; missing agents are skipped with a notice instead of being created
- Windows export auto-starts a persistent debug browser (Chrome, falling back to Edge) to work around agent-browser failing to launch Chrome itself; the instance stays resident and is reused across exports, and `AGENT_BROWSER_CDP` can point to a debug browser you started yourself

### Fixed

- Tolerate files vanishing mid-scan in `find_download` when Chrome renames `.crdownload` entries in Downloads, avoiding `FileNotFoundError` aborting export (Related to #4)

### Changed

- README now steers agents to `npx open-kimi-ppt-skill@latest install -y` instead of cloning the repo

## [1.1.2] - 2026-08-06

### Fixed

- Fix Chinese-locale Windows export hang / GBK decode errors in `export_pptx.py` / `export_images.py` (capture stdout via temp file + UTF-8)
- Work around agent-browser `--download-path` silently canceling Chrome downloads: click download and poll the default Downloads folder
- Stop shipping `__pycache__/*.pyc` in the npm package (list script sources explicitly in `files`)

## [1.1.1] - 2026-08-06

### Added

- Align PPTD with official element-level `animations`; Skill notes for animation / `notes` usage bounds
- Align image priority, anti-AI copy rules, clarification asks, replicate guidance, and parallel page writes
- Ship ~30 preset design systems, invoked only when named
- Restore `customFonts` (Google Fonts) and poster size recommendations
- Root theme catalogs: `theme.md` / `theme_EN.md` (with preview images)
- Sample project `example/xiaomi-yu7-ppt-animation` (on-slide entrance animations)

### Changed

- Sync scenario docs with official animation guidance and `customFonts` references
- README: document element animations, preset themes, and sample prompts

## [1.0.2] - 2026-08-06

### Changed

- `install` overwrites an existing skill by default; `--force` is no longer required (still accepted for compatibility)

## [1.0.1] - 2026-08-06

### Added

- Skill workflow **step0 prerequisite check**: verify Node.js 18+, npm/npx, and python3 before generation; note that a Chromium-based browser is required for export
- Export scripts check **Node.js 18+** and **npm** at startup, with clear install guidance when missing or too old
- CLI (`open-kimi-ppt-skill`) refuses to start when the Node.js major version is below 18
- Auto-install **PyYAML** via `pip install --user pyyaml` when missing (same pattern as Pillow / websocket-client)

### Docs

- Added multi-agent / multi-model example screenshots (ChatGPT·Codex + 5.6 Luna, Reasonix + DeepSeek, WorkBuddy, and more)
- Clarified install as “automatic or manual — pick one”, with Windows path notes
- Updated README structure and example images

## [1.0.0] - 2026-08-05

### Added

- Initial release of `open-kimi-ppt-skill`
- PPTD create / edit / replicate, delivering both an editable PPTD project and a PPTX by default
- Browser-side PPTX export (embedded fonts, fade transitions) with optional multimodal visual QA before export
- Local in-browser PPTD editor (`npx open-kimi-ppt-skill serve`)
- CLI to install the skill into `~/.agents/skills` (or another agent directory via `--target`)
