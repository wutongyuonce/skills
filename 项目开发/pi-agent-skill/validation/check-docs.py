"""Check local Markdown file links, in-page anchors, and SDK installation pins (stdlib only)."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
entry = (root / "SKILL.md").read_text()
match = re.search(r"\*\*pi-coding-agent v([\d.]+)\*\*", entry)
assert match, "SKILL.md must declare one checked baseline"
baseline = match.group(1)
errors = []
links = 0
anchors = 0
files = [
    file
    for file in sorted(root.rglob("*.md"))
    if "node_modules" not in file.parts and not any(part.startswith(".check-") for part in file.parts)
]


def slug(text: str) -> str:
    """Approximate the anchor GitHub generates for a heading."""
    text = text.strip().lower()
    text = re.sub(r"`([^`]*)`", r"\1", text)
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"[^\w\u4e00-\u9fff\- ]", "", text)
    return text.replace(" ", "-")


headings = {
    file.resolve(): {slug(h) for h in re.findall(r"^#{1,6}\s+(.*)$", file.read_text(), re.M)}
    for file in files
}

for file in files:
    content = file.read_text()
    for target in re.findall(r"\[[^\]\n]*\]\(([^)]+)\)", content):
        path, _, fragment = target.partition("#")
        if not path and not fragment:
            continue
        if re.match(r"[a-zA-Z][a-zA-Z0-9+.-]*:", path):
            continue
        destination = (file.parent / path).resolve() if path else file.resolve()
        if path:
            links += 1
            if not destination.exists():
                errors.append(f"{file.relative_to(root)}: missing link {target}")
                continue
        if fragment and destination.suffix == ".md":
            anchors += 1
            if slug(fragment) not in headings.get(destination, set()):
                errors.append(f"{file.relative_to(root)}: missing anchor {target}")
    # Historical reports record old install commands without changing active guidance.
    if file.name == "CHANGELOG.md" or "updates" in file.relative_to(root).parts:
        continue
    for version in re.findall(r"npm install[^\n`]*@earendil-works/pi-coding-agent@([\d.]+)", content):
        if version != baseline:
            errors.append(f"{file.relative_to(root)}: install pin {version} != baseline {baseline}")
assert not errors, "\n".join(errors)
print(
    f"PASS: {len(files)} Markdown files, {links} local file links, "
    f"{anchors} in-page anchors, baseline install pins {baseline}"
)
