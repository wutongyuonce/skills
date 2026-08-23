# Release (Notes · Flow · Demo Assets)

Read this when cutting or refreshing a release, or when regenerating tracked demo
screenshots. Everyday template, script, and site work does not need it.

## Part 1 · Release notes

- Read the previous published release first and treat it as a hard format template:
  `gh release view $(gh release list -R tw93/Kami --limit 1 --json tagName --jq '.[0].tagName') -R tw93/Kami`.
  Mirror its exact structure (centered logo block, `### Changelog`, `### 更新日志`,
  closing tagline blockquote). Do not rebuild the shape from memory.
- Title shape: `V<x.y.z> <Two-Word Codename>`, for example `V1.7.2 Cleaner Resumes`.
- Body: centered logo block + `### Changelog` (English numbered list) + `### 更新日志`
  (Chinese numbered list) + the closing tagline line.
- Bilingual and one-to-one: 3 to 8 items, one sentence each, English item N maps to
  Chinese item N. Fewer, denser items beat padding the list: group the commits by the
  capability a user gains, and drop anything that shipped to the site rather than into
  the package, since a site change is already live and needs no upgrade.
- The budget is the rendered line, not the sentence. Each item must fit one line at
  GitHub release-page width: roughly 90 characters English, 45 characters Chinese,
  counting the number prefix and bold markers. Check the longest item first; if it
  wraps, cut words instead of splitting the item.
- Generate the scaffold, then rewrite it:
  `python3 scripts/draft-release-notes.py V<prev>..HEAD --version V<new> --title "<Codename>"`.
  Regroup the raw commit list into product-themed bullets; never paste commit subjects.

## Part 2 · Release flow

- `bash scripts/package-skill.sh` writes the tracked `dist/kami.zip` with a top-level
  `kami/` skill folder, and its audit gate excludes large TsangerJinKai / Source Han
  Serif K fonts plus showcase, demo, and example assets.
- Commit `dist/kami.zip` with the release change, and upload it to the latest GitHub
  release asset when refreshing the Claude Desktop package.
- Verify a refreshed asset by content, not by page text: download the uploaded
  `kami.zip` and compare ZIP entry names plus per-entry SHA-256 digests against local
  `dist/kami.zip`. File size or container SHA alone proves nothing.
- README and public site download links point at
  `https://github.com/tw93/kami/releases/latest/download/kami.zip`. For small packaging
  or documentation fixes, refresh that asset instead of cutting a new tag.
- Confirm remote CI is green on the exact commit about to be tagged, and read the
  `headSha` back rather than trusting the newest row:

  ```bash
  gh run list --workflow=check.yml --limit 1 --json headSha,status,conclusion
  ```

  A full local pass is not the verdict. V1.11.0 shipped while CI had been red for
  seven consecutive runs, because a test read `assets/examples/one-pager.pdf`, which
  is gitignored build output: it passed on any machine that had run a build and
  failed on every fresh checkout. Local green means "my working copy is fine", CI
  green means "a clean checkout is fine", and only the second one is what a user
  downloads. Poll the structured status; piping `gh run watch` into `tail` swallows
  the exit code and reports an unfinished or failed run as passing.
- The release workflow enforces the same contract before it can create or overwrite
  an asset: `TAG == V$(cat VERSION)`, the tag resolves to the checked-out commit, an
  exact-SHA `check.yml` run is complete and successful, and the rebuilt archive has
  the same entry names and per-entry SHA-256 payloads as tracked `dist/kami.zip`.
  Immediately before upload, it also confirms the remote tag still resolves to the
  reviewed SHA. Keep these as hard gates; a manual dispatch is not an override.
- Create a version tag only when the maintainer explicitly asks for a versioned
  release, and tag the commit that already contains the final refreshed
  `dist/kami.zip`. Never tag a source-only commit and refresh the archive afterward.
- On tag push, `.github/workflows/release.yml` builds and attaches `dist/kami.zip`,
  creates the release if missing, and adds and verifies the house-style reactions. Do not
  `gh release create` by hand: let CI create the placeholder, then set the real title
  and notes with
  `gh release edit V<x> --title "V<x> <Codename>" --notes-file <file>`.
- If reactions are missing (older release, CI skipped), add them manually:
  `rid=$(gh api repos/tw93/Kami/releases/tags/V<x> --jq .id); for r in +1 eyes heart hooray laugh rocket; do gh api -X POST repos/tw93/Kami/releases/$rid/reactions -f content="$r"; done`.
- Reactions are part of publish completion. After the release is live, read them back
  with `gh api repos/tw93/Kami/releases/$rid/reactions --jq '.[].content'` and confirm
  all six positive reactions are present. Never add `-1` or `confused`; a negative
  reaction on our own release reads as self-deprecation.

## Part 3 · Demo screenshots

Every demo PNG under `assets/demos/` is 1241x1754px, the first A4 portrait page at
150dpi. Regenerate them whenever the demo's PDF changes.

Portrait documents (one-pager / letter / resume / portfolio / long-doc /
equity-report), capture page 1:

```bash
pdftoppm -r 150 -f 1 -l 1 -png <pdf> /tmp/p && cp /tmp/p-1.png <target>.png
```

Landscape slides: capture the first 2 pages, resize each to 867px high, add a 20px
parchment gap, then extend to the portrait frame:

```bash
pdftoppm -r 150 -f 1 -l 2 -png <pdf> /tmp/sl
magick /tmp/sl-1.png -resize x867 /tmp/sl1.png
magick /tmp/sl-2.png -resize x867 /tmp/sl2.png
magick -size $(identify -format '%w' /tmp/sl1.png)x20 xc:'#f5f4ed' /tmp/gap.png
magick /tmp/sl1.png /tmp/gap.png /tmp/sl2.png -append /tmp/stacked.png
magick /tmp/stacked.png -gravity Center -background '#f5f4ed' -extent 1241x1754 <target>.png
```

Before replacing a tracked PNG, confirm the source PDF used an intended primary or
listed fallback font (not DejaVu or Bitstream Vera) and that the captured page has
representative content with no placeholders or missing assets.
