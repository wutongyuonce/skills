"""Check local Markdown file links and current SDK installation pins (stdlib only)."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
entry = (root / "SKILL.md").read_text()
match = re.search(r"\*\*pi-coding-agent v([\d.]+)\*\*", entry)
assert match, "SKILL.md must declare one checked baseline"
baseline = match.group(1)
errors = []
links = 0
files = sorted(root.rglob("*.md"))
for file in files:
    content = file.read_text()
    for target in re.findall(r"\[[^\]\n]*\]\(([^)]+)\)", content):
        path = target.split("#", 1)[0]
        if not path or re.match(r"[a-zA-Z][a-zA-Z0-9+.-]*:", path):
            continue
        links += 1
        if not (file.parent / path).exists():
            errors.append(f"{file.relative_to(root)}: missing link {target}")
    # Historical reports record old install commands without changing active guidance.
    if file.name == "CHANGELOG.md" or "updates" in file.relative_to(root).parts:
        continue
    for version in re.findall(r"npm install[^\n`]*@earendil-works/pi-coding-agent@([\d.]+)", content):
        if version != baseline:
            errors.append(f"{file.relative_to(root)}: install pin {version} != baseline {baseline}")
assert not errors, "\n".join(errors)
print(f"PASS: {len(files)} Markdown files, {links} local file links, baseline install pins {baseline}")
