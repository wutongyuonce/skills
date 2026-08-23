# Contact Kami

One maintainer, one queue. GitHub is the fastest way in, and a reproducible report is the fastest way through.

HTML version: <https://kami.tw93.fun/contact>

## Where to write

- **Bugs, template requests, and questions**: open an issue at <https://github.com/tw93/kami/issues>. This is the primary channel and the one with public history, so a question answered there helps the next person.
- **Fixes and new templates**: pull requests are welcome at <https://github.com/tw93/kami/pulls>. Run `python3 scripts/build.py --check` before opening one; it covers template lint, design-token sync, and public-fact drift.
- **Anything that should not be public**, including a security report: email the maintainer at <hitw93@gmail.com>, the same address published in the plugin manifests.
- **Everything else**: [@HiTw93](https://x.com/HiTw93) on X, or the maintainer's site at <https://tw93.fun>.

Kami is maintained by one person alongside other work, so replies are best-effort rather than guaranteed within any window. There is no paid support tier and no contract to sign; the trade is that everything is MIT licensed and you can fix it yourself if waiting does not suit.

## What to include in a report

Most layout reports stall on missing context. These four lines usually unblock a fix.

- The template name, for example `resume-en` or `slides-weasy`, and the Kami version from the homepage badge or `VERSION`.
- How it was invoked: the Claude Code plugin, the Codex plugin, a Claude Desktop upload, the MCP server, or a direct `scripts/build.py` run.
- The rendered artifact, a PDF or a page PNG, rather than a description of it. Layout problems are visual and a screenshot settles most of them immediately.
- The output of the relevant check, for example `python3 scripts/build.py --check-content content.json filled.html`, if the document verified clean but still looks wrong.

For rendering failures, the exact error text matters: WeasyPrint, pypdf, and PyMuPDF are optional dependencies, and a missing one surfaces as an install hint rather than a crash. Pasting that hint is usually the whole diagnosis.

## Elsewhere

[Home](https://kami.tw93.fun/) · [Developers](https://kami.tw93.fun/developers) · [About](https://kami.tw93.fun/about) · [Privacy](https://kami.tw93.fun/privacy) · [Source](https://github.com/tw93/kami)
