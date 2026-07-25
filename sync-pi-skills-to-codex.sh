#!/usr/bin/env bash
set -euo pipefail

src_root="${1:-"$HOME/.pi/agent/skills"}"
dest_root="${2:-"$HOME/.codex/skills"}"

if [[ ! -d "$src_root" ]]; then
  echo "Source skills directory does not exist: $src_root" >&2
  exit 1
fi

mkdir -p "$dest_root"

created=0
skipped=0
conflicts=0

build_link_name() {
  local src_root="$1"
  local skill_dir="$2"
  local rel_path
  local base_name

  rel_path="${skill_dir#"$src_root"/}"
  if [[ "$rel_path" == "$skill_dir" ]]; then
    return 1
  fi

  base_name="$(basename "$skill_dir")"

  # Normalize packaged skills like `foo/skill/SKILL.md` to `foo`.
  if [[ "$base_name" == "skill" ]]; then
    basename "$(dirname "$skill_dir")"
    return 0
  fi

  printf '%s\n' "${rel_path//\//-}"
}

while IFS= read -r -d '' skill_md; do
  skill_dir="$(dirname "$skill_md")"
  if ! link_name="$(build_link_name "$src_root" "$skill_dir")"; then
    echo "Skipping path outside source root: $skill_dir" >&2
    conflicts=$((conflicts + 1))
    continue
  fi

  dest_path="$dest_root/$link_name"

  if [[ -L "$dest_path" ]]; then
    current_target="$(readlink "$dest_path")"
    if [[ "$current_target" == "$skill_dir" ]]; then
      echo "skip  $link_name -> $skill_dir"
      skipped=$((skipped + 1))
    else
      echo "conflict symlink exists: $dest_path -> $current_target, expected $skill_dir" >&2
      conflicts=$((conflicts + 1))
    fi
    continue
  fi

  if [[ -e "$dest_path" ]]; then
    echo "conflict path exists and is not a symlink: $dest_path" >&2
    conflicts=$((conflicts + 1))
    continue
  fi

  ln -s "$skill_dir" "$dest_path"
  echo "link  $link_name -> $skill_dir"
  created=$((created + 1))
done < <(find "$src_root" -type f -name SKILL.md -print0 | sort -z)

echo
echo "Created: $created"
echo "Skipped: $skipped"
echo "Conflicts: $conflicts"

if [[ "$conflicts" -gt 0 ]]; then
  exit 2
fi
