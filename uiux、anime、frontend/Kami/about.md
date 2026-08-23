# About Kami

Kami is a constraint-based design system for documents that an AI agent writes and a person actually reads.

HTML version: <https://kami.tw93.fun/about>

## A design system, not a template gallery

Language models write well and lay out badly. Ask one for a resume and the text is usually fine while the page is not: mixed accent colors, synthetic bold, hard drop shadows, a heading three sizes away from its body. Kami removes those decisions from the model. It ships a fixed constraint set, a warm parchment canvas at `#f5f4ed`, a single ink-blue accent at `#1B365D`, serif-led hierarchy, and editorial whitespace, and holds that set across every document type it produces.

What comes out is HTML that exports to PDF, PNG, or an editable PPTX deck. Eight document templates cover the common cases: one-pager, letter, long document, portfolio, resume, slides, equity report, and changelog. Eighteen inline SVG diagram types cover the pictures those documents need, from architecture and flowchart to candlestick and Venn. A separate landing-page template applies the same restraint to a product page.

Because the constraints are fixed, the interesting work moves to content quality and verification. Kami ships nine JSON content schemas and a set of checks that look for the failures agents actually produce: unfilled placeholders, markdown syntax leaking into the render, a line orphaned at a page break, a page that ends a third empty, a deck where six slides in a row share one layout.

## Deliberate omissions

Kami is not a hosted service. There is no Kami account, no API key, no server that receives your documents. The skill installs into your agent and runs on your machine; this domain serves a static site and a set of public metadata files, nothing more.

It is not a theme engine either. There is no second accent color, no dark mode, no per-document palette. Consistency is the feature and options would dilute it. If a document needs a different visual language, it needs a different system.

Finally, it is not a writing tool. Kami will not decide what your resume should claim or what your report should conclude. It sets the page so that a good decision reads as one.

## One maintainer, MIT licensed

Kami is built and maintained by [Tw93](https://tw93.fun), an independent developer. The source, including every template, script, and the skill definition itself, lives at <https://github.com/tw93/kami> under the MIT license. Use it commercially, fork it, or lift a single template out of it; attribution is welcome and not required.

Releases are tagged in the repository and published as a `kami.zip` asset for Claude Desktop, alongside the Claude Code and Codex plugin marketplaces. The homepage carries the current version. Interface, template registry, and public facts are cross-checked in CI, so the version on the site, in the plugin manifests, and in the skill package cannot drift apart.

The site is published in English, Simplified Chinese, Traditional Chinese, Japanese, and Korean, each with its own serif and its own typographic tuning rather than one font stretched across five scripts.

## Elsewhere

[Home](https://kami.tw93.fun/) · [Developers](https://kami.tw93.fun/developers) · [Contact](https://kami.tw93.fun/contact) · [Privacy](https://kami.tw93.fun/privacy) · [Source](https://github.com/tw93/kami)
